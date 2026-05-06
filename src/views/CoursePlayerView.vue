<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import AppIcon from '../components/AppIcon.vue'
import QuizEditor from '../components/QuizEditor.vue'
import QuizPlayer from '../components/QuizPlayer.vue'
import { getLessonEmbedUrl } from '../data/mockData'
import type { Quiz } from '../data/mockData'
import { appConfig } from '../lib/config'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../stores/auth'
import { useCatalogStore } from '../stores/catalog'
import { useQuizStore } from '../stores/quiz'

const route = useRoute()
const auth = useAuthStore()
const catalog = useCatalogStore()
const quizStore = useQuizStore()

// ── 測驗相關狀態 ─────────────────────────────────────────────
const lessonQuiz = ref<Quiz | null>(null)
const quizLoading = ref(false)
const activeTab = ref<'video' | 'quiz' | 'quiz-edit'>('video')
const canEditQuiz = computed(() => auth.hasPermission('quiz:edit'))
const canAttemptQuiz = computed(() => auth.hasPermission('quiz:attempt'))

const course = computed(() => catalog.courses.find((item) => item.id === route.params.courseId))
const selectedLessonId = ref('')

const watchedHighWater = ref(0)
const durationSeconds = ref(0)
const lastSavedWatched = ref(0)
const isCompleted = ref(false)
const syncError = ref('')
const syncing = ref(false)
const isPausedByEvent = ref(false)
const playerDebugEnabled = ref(true)
const progressReady = ref(false)     // 等待用戶進度載入完再顯示 iframe
const startPositionSeconds = ref(0)  // 載入章節時固定的起始播放位置，不隨播放更新
const playerIframeRef = ref<HTMLIFrameElement | null>(null)

let periodicSyncTimer: number | null = null
let lastSyncAt = 0
let playerBridgeSeq = 0
let bunnyPlayer: any = null

declare global {
  interface Window {
    playerjs?: {
      Player: new (target: string | HTMLIFrameElement) => any
    }
  }
}

watch(
  course,
  (nextCourse) => {
    selectedLessonId.value = nextCourse?.lessons[0]?.id ?? ''
  },
  { immediate: true },
)

const selectedLesson = computed(() =>
  course.value?.lessons.find((lesson) => lesson.id === selectedLessonId.value) ?? course.value?.lessons[0],
)

const embedUrl = computed(() => {
  if (!selectedLesson.value) return ''
  const base = getLessonEmbedUrl(selectedLesson.value.bunnyVideoId)
  if (!base) return ''
  // 使用固定的 startPositionSeconds，不隨 watchedHighWater 更新，避免 iframe 不斷重載
  return startPositionSeconds.value > 5 ? `${base}?t=${startPositionSeconds.value}` : base
})

const progressPercent = computed(() => {
  const duration = Math.max(durationSeconds.value, selectedLesson.value?.durationSeconds ?? 0)
  if (duration <= 0) return 0
  return Math.min(100, Math.round((watchedHighWater.value / duration) * 100))
})

const playerErrorMessage = computed(() => {
  if (!selectedLesson.value) return '目前課程沒有可播放的章節。'
  if (!appConfig.bunnyLibraryId) return '尚未設定 Bunny Library ID。請先檢查 .env 的 VITE_BUNNY_LIBRARY_ID。'
  if (!selectedLesson.value.bunnyVideoId) return `章節「${selectedLesson.value.title}」尚未設定 Bunny Video ID。`
  return '播放器載入失敗，請稍後重整再試。'
})

function refreshFromStoredProgress() {
  if (!selectedLesson.value || !auth.currentUser) return
  const stored = catalog.progresses.find(
    (item) => item.staffProfileId === auth.currentUser?.id && item.lessonId === selectedLesson.value?.id,
  )
  watchedHighWater.value = stored?.watchedSeconds ?? 0
  durationSeconds.value = Math.max(stored?.durationSeconds ?? 0, selectedLesson.value.durationSeconds ?? 0)
  lastSavedWatched.value = watchedHighWater.value
  isCompleted.value = Boolean(stored?.completedAt)
  // 固定起始位置：已完成則從頭播，未完成則跳到上次觀看處
  startPositionSeconds.value = isCompleted.value ? 0 : Math.floor(watchedHighWater.value)
}

function normalizeMessageData(raw: unknown) {
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw)
    } catch {
      // 某些播放器事件會直接傳字串（如 "pause" / "play"）
      return { event: raw }
    }
  }
  if (raw && typeof raw === 'object') return raw as Record<string, unknown>
  return null
}

function extractNumber(source: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = source[key]
    if (typeof value === 'number' && Number.isFinite(value)) return value
    if (typeof value === 'string') {
      const parsed = Number(value)
      if (Number.isFinite(parsed)) return parsed
    }
  }
  return null
}

function extractPlaybackData(payload: Record<string, unknown>) {
  const candidates = [payload, payload.data, payload.value].filter((item) => item && typeof item === 'object') as Array<Record<string, unknown>>
  for (const candidate of candidates) {
    // 僅接受最明確的播放秒數欄位，避免暫停時誤判累加。
    const current = extractNumber(candidate, ['currentTime', 'current_time'])
    const total = extractNumber(candidate, ['duration', 'durationSeconds', 'totalDuration', 'videoDuration'])
    if (current !== null || total !== null) {
      return { current: current ?? 0, duration: total ?? 0 }
    }
  }
  return null
}

function normalizeCurrentSeconds(rawCurrent: number, knownDuration: number) {
  if (!Number.isFinite(rawCurrent) || rawCurrent < 0) return null
  // 若播放器傳毫秒，轉為秒
  if (knownDuration > 0 && rawCurrent > knownDuration * 10 && rawCurrent <= knownDuration * 1000 + 5000) {
    return rawCurrent / 1000
  }
  return rawCurrent
}

function extractPlaybackState(payload: Record<string, unknown>): 'paused' | 'playing' | null {
  const candidates = [payload, payload.data, payload.value].filter((item) => item && typeof item === 'object') as Array<Record<string, unknown>>
  for (const candidate of candidates) {
    const pausedBool = candidate.paused ?? candidate.isPaused
    if (typeof pausedBool === 'boolean') return pausedBool ? 'paused' : 'playing'

    const playingBool = candidate.playing ?? candidate.isPlaying
    if (typeof playingBool === 'boolean') return playingBool ? 'playing' : 'paused'

    for (const key of ['state', 'playerState', 'status']) {
      const raw = candidate[key]
      if (typeof raw !== 'string') continue
      const value = raw.toLowerCase().trim()
      if (value.includes('pause')) return 'paused'
      if (value.includes('play')) return 'playing'
    }
  }
  return null
}

function debugPlayer(label: string, data?: Record<string, unknown>) {
  if (!playerDebugEnabled.value) return
  const now = new Date().toISOString().slice(11, 23)
  // eslint-disable-next-line no-console
  console.log(`[FK_PLAYER ${now}] ${label}`, data ?? {})
}

function handleTelemetryAdvance(seconds: number, duration: number, source: string) {
  if (!selectedLesson.value) return

  if (duration > 0) {
    durationSeconds.value = Math.max(durationSeconds.value, Math.round(duration))
  }

  const knownDuration = Math.max(durationSeconds.value, selectedLesson.value.durationSeconds ?? 0)
  const normalizedCurrent = normalizeCurrentSeconds(seconds, knownDuration)
  if (normalizedCurrent === null) {
    debugPlayer('telemetry ignored: invalid current', { source, seconds, duration, knownDuration })
    return
  }
  if (knownDuration > 0 && normalizedCurrent > knownDuration + 5) {
    debugPlayer('telemetry ignored: out of range', { source, normalizedCurrent, knownDuration })
    return
  }

  if (isPausedByEvent.value && normalizedCurrent > watchedHighWater.value + 1) {
    isPausedByEvent.value = false
    debugPlayer('pause gate OFF (auto by telemetry advance)', {
      source,
      normalizedCurrent,
      watchedHighWater: watchedHighWater.value,
    })
  }

  if (isPausedByEvent.value) {
    debugPlayer('telemetry ignored: paused gate ON', { source, normalizedCurrent, watchedHighWater: watchedHighWater.value })
    return
  }

  if (normalizedCurrent > watchedHighWater.value) {
    debugPlayer('telemetry advance', { source, normalizedCurrent, prevHighWater: watchedHighWater.value, knownDuration })
    watchedHighWater.value = Math.round(normalizedCurrent)
    void syncProgress(false)
  } else {
    debugPlayer('telemetry no-advance', { source, normalizedCurrent, watchedHighWater: watchedHighWater.value })
  }
}

async function ensurePlayerJsLoaded() {
  if (window.playerjs?.Player) return
  await new Promise<void>((resolve, reject) => {
    const existing = document.querySelector('script[data-fk-playerjs="1"]') as HTMLScriptElement | null
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true })
      existing.addEventListener('error', () => reject(new Error('playerjs load failed')), { once: true })
      return
    }

    const script = document.createElement('script')
    script.src = 'https://assets.mediadelivery.net/playerjs/playerjs-latest.min.js'
    script.async = true
    script.dataset.fkPlayerjs = '1'
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('playerjs load failed'))
    document.head.appendChild(script)
  })
}

async function setupPlayerBridge() {
  if (!playerIframeRef.value || !embedUrl.value) return
  try {
    await ensurePlayerJsLoaded()
  } catch (error) {
    debugPlayer('playerjs load error', { message: error instanceof Error ? error.message : String(error) })
    return
  }
  if (!window.playerjs?.Player || !playerIframeRef.value) return

  const seq = ++playerBridgeSeq
  bunnyPlayer = new window.playerjs.Player(playerIframeRef.value)
  debugPlayer('player bridge init', { seq })

  bunnyPlayer.on('ready', () => {
    if (seq !== playerBridgeSeq) return
    debugPlayer('playerjs ready', { seq })
  })

  bunnyPlayer.on('play', () => {
    if (seq !== playerBridgeSeq) return
    isPausedByEvent.value = false
    debugPlayer('playerjs play', { seq })
  })

  bunnyPlayer.on('pause', () => {
    if (seq !== playerBridgeSeq) return
    isPausedByEvent.value = true
    debugPlayer('playerjs pause', { seq })
  })

  bunnyPlayer.on('ended', () => {
    if (seq !== playerBridgeSeq) return
    isPausedByEvent.value = true
    const dur = Math.max(durationSeconds.value, selectedLesson.value?.durationSeconds ?? 0)
    if (dur > 0) watchedHighWater.value = Math.round(dur)
    debugPlayer('playerjs ended', { seq, dur })
    void syncProgress(true)
  })

  bunnyPlayer.on('timeupdate', (data: any) => {
    if (seq !== playerBridgeSeq) return
    const seconds = typeof data?.seconds === 'number' ? data.seconds : Number(data?.seconds ?? 0)
    const duration = typeof data?.duration === 'number' ? data.duration : Number(data?.duration ?? 0)
    handleTelemetryAdvance(seconds, duration, 'playerjs-timeupdate')
  })

  bunnyPlayer.on('seeked', () => {
    if (seq !== playerBridgeSeq) return
    debugPlayer('playerjs seeked', { seq })
  })

  bunnyPlayer.on('error', (err: any) => {
    if (seq !== playerBridgeSeq) return
    debugPlayer('playerjs error', { seq, err })
  })
}

function extractEventName(payload: Record<string, unknown>) {
  const candidates = [payload, payload.data, payload.value].filter((item) => item && typeof item === 'object') as Array<Record<string, unknown>>
  for (const candidate of candidates) {
    for (const key of ['event', 'type', 'action', 'name']) {
      const raw = candidate[key]
      if (typeof raw === 'string' && raw.trim()) {
        return raw.toLowerCase()
      }
    }
  }
  return ''
}

async function syncProgress(force = false) {
  if (!selectedLesson.value || !auth.currentUser) return

  const now = Date.now()
  const normalizedDuration = Math.max(durationSeconds.value, selectedLesson.value.durationSeconds ?? 0)
  const normalizedWatched = normalizedDuration > 0
    ? Math.min(normalizedDuration, Math.max(0, Math.round(watchedHighWater.value)))
    : Math.max(0, Math.round(watchedHighWater.value))

  // 尚無任何觀看紀錄就不儲存
  if (normalizedWatched <= 0) {
    debugPlayer('sync skip: watched<=0', { normalizedWatched, normalizedDuration, force })
    return
  }

  if (!force) {
    if (normalizedWatched - lastSavedWatched.value < 5) {
      debugPlayer('sync skip: delta<5', { normalizedWatched, lastSavedWatched: lastSavedWatched.value, force })
      return
    }
    if (now - lastSyncAt < 3500) {
      debugPlayer('sync skip: throttle', { now, lastSyncAt, force })
      return
    }
  }

  syncing.value = true
  try {
    const result = await catalog.updateLessonProgress({
      userId: auth.currentUser.id,
      lessonId: selectedLesson.value.id,
      watchedSeconds: normalizedWatched,
      durationSeconds: normalizedDuration,
    })
    lastSavedWatched.value = normalizedWatched
    isCompleted.value = Boolean(result?.isCompleted)
    syncError.value = ''
    lastSyncAt = now
    debugPlayer('sync ok', { normalizedWatched, normalizedDuration, force, isCompleted: isCompleted.value })
  } catch (err) {
    syncError.value = err instanceof Error ? err.message : '同步進度失敗'
    debugPlayer('sync error', { message: syncError.value, force })
  } finally {
    syncing.value = false
  }
}

function handlePlayerMessage(event: MessageEvent) {
  // 接受 Bunny CDN 各 domain 的訊息（實際 origin 可能是 mediadelivery.net 或 b-cdn.net）
  const origin = event.origin
  const acceptedOrigin = !origin || origin.includes('mediadelivery.net') || origin.includes('b-cdn.net') || origin.includes('bunny')
  if (!acceptedOrigin) {
    debugPlayer('message ignored: origin', { origin, dataType: typeof event.data })
    return
  }
  if (!selectedLesson.value) {
    debugPlayer('message ignored: no selectedLesson', { origin })
    return
  }

  debugPlayer('message received', { origin, dataType: typeof event.data })

  const payload = normalizeMessageData(event.data)
  if (!payload) {
    debugPlayer('message ignored: payload parse failed', { rawType: typeof event.data })
    return
  }

  const eventName = extractEventName(payload)
  const playbackState = extractPlaybackState(payload)
  debugPlayer('message', {
    origin,
    eventName,
    playbackState,
    pausedGate: isPausedByEvent.value,
    watchedHighWater: watchedHighWater.value,
  })

  if (playbackState === 'paused') {
    isPausedByEvent.value = true
    debugPlayer('pause gate ON (state)')
  } else if (playbackState === 'playing') {
    isPausedByEvent.value = false
    debugPlayer('pause gate OFF (state)')
  }

  if (eventName === 'pause' || eventName === 'paused') {
    isPausedByEvent.value = true
    debugPlayer('pause gate ON (event)')
    return
  }
  if (eventName === 'play' || eventName === 'playing' || eventName === 'resume') {
    isPausedByEvent.value = false
    debugPlayer('pause gate OFF (event)')
  }
  // 影片結束時直接同步完成
  if (eventName === 'ended' || eventName === 'end' || eventName === 'complete' || eventName === 'videocompleted') {
    isPausedByEvent.value = true
    debugPlayer('pause gate ON (ended)')
    const dur = durationSeconds.value
    if (dur > 0) watchedHighWater.value = dur
    void syncProgress(true)
    return
  }

  const playbackData = extractPlaybackData(payload)
  if (!playbackData) {
    if (isPausedByEvent.value) {
      debugPlayer('ignore telemetry: paused gate ON (no playbackData)')
    }
    return
  }
  handleTelemetryAdvance(playbackData.current, playbackData.duration, 'postMessage')
}

async function selectLesson(nextLessonId: string) {
  await syncProgress(true)
  selectedLessonId.value = nextLessonId
}

// 從 Bunny API 取得影片實際時長（當 DB 存 0 時）
async function fetchAndCacheDuration() {
  if (!selectedLesson.value?.bunnyVideoId) return
  const currentDuration = Math.max(durationSeconds.value, selectedLesson.value?.durationSeconds ?? 0)
  if (currentDuration > 0) return

  try {
    const { data: session } = await supabase.auth.getSession()
    const token = session.session?.access_token
    if (!token) return

    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/bunny-upload?videoId=${selectedLesson.value.bunnyVideoId}`,
      { headers: { Authorization: `Bearer ${token}` } },
    )
    if (!res.ok) return
    const json = await res.json()
    if ((json.duration ?? 0) > 0) {
      durationSeconds.value = json.duration
    }
  } catch {
    // 忽略錯誤，不影響播放
  }
}

async function loadLessonQuiz() {
  if (!selectedLessonId.value) return
  quizLoading.value = true
  lessonQuiz.value = null
  try {
    lessonQuiz.value = await quizStore.fetchQuizByLesson(selectedLessonId.value)
  } finally {
    quizLoading.value = false
  }
}

watch(selectedLessonId, () => {
  isPausedByEvent.value = false
  playerBridgeSeq += 1
  bunnyPlayer = null
  progressReady.value = false
  activeTab.value = 'video'
  refreshFromStoredProgress()
  progressReady.value = true
  void fetchAndCacheDuration()
  void loadLessonQuiz()
})

watch([embedUrl, progressReady], async ([url, ready]) => {
  if (!ready || !url) return
  await nextTick()
  void setupPlayerBridge()
})

// 影片完成時自動切到測驗 tab
watch(isCompleted, (val) => {
  if (val && lessonQuiz.value && activeTab.value === 'video') {
    activeTab.value = 'quiz'
  }
})

onMounted(async () => {
  const search = new URLSearchParams(window.location.search)
  if (search.get('playerDebug') === '1') {
    playerDebugEnabled.value = true
  } else if (search.get('playerDebug') === '0') {
    playerDebugEnabled.value = false
  } else {
    // 預設開啟，避免受舊 localStorage 狀態影響看不到 debug。
    playerDebugEnabled.value = true
  }
  debugPlayer('mounted', {
    lessonId: selectedLessonId.value,
    debugEnabled: playerDebugEnabled.value,
    hint: '可用 ?playerDebug=1 開啟、?playerDebug=0 關閉',
  })

  await catalog.fetchCourses()
  if (auth.currentUser?.id) {
    await catalog.fetchUserProgress(auth.currentUser.id)
  }
  refreshFromStoredProgress()
  progressReady.value = true
  void fetchAndCacheDuration()
  void loadLessonQuiz()

  window.addEventListener('message', handlePlayerMessage)
  periodicSyncTimer = window.setInterval(() => {
    void syncProgress(false)
  }, 5000)
})

onBeforeUnmount(async () => {
  playerBridgeSeq += 1
  bunnyPlayer = null
  window.removeEventListener('message', handlePlayerMessage)
  if (periodicSyncTimer !== null) {
    window.clearInterval(periodicSyncTimer)
  }
  await syncProgress(true)
})
</script>

<template>
  <div v-if="course" class="page-stack player-layout">
    <section class="player-shell panel-card">
      <!-- Tab 切換列 -->
      <div class="player-tabs">
        <button class="tab-btn" :class="{ active: activeTab === 'video' }" @click="activeTab = 'video'">影片</button>
        <button
          v-if="(lessonQuiz && canAttemptQuiz) || canEditQuiz"
          class="tab-btn"
          :class="{ active: activeTab === 'quiz' }"
          @click="activeTab = 'quiz'"
        >
          課後測驗
          <span v-if="lessonQuiz" class="tab-badge">📝</span>
        </button>
        <button
          v-if="canEditQuiz"
          class="tab-btn"
          :class="{ active: activeTab === 'quiz-edit' }"
          @click="activeTab = 'quiz-edit'"
        >編輯測驗</button>
      </div>

      <div class="video-frame-wrap" v-show="activeTab === 'video'">
        <div v-if="!progressReady" class="video-frame video-frame--empty" style="display:flex;align-items:center;justify-content:center">載入中…</div>
        <iframe
          v-else-if="embedUrl"
          ref="playerIframeRef"
          class="video-frame"
          :src="embedUrl"
          allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
          allowfullscreen
        ></iframe>
        <div v-else class="video-frame video-frame--empty">{{ playerErrorMessage }}</div>
      </div>

      <!-- 測驗作答 -->
      <div v-if="activeTab === 'quiz'" class="quiz-tab-panel">
        <div v-if="quizLoading" class="quiz-loading">測驗載入中…</div>
        <div v-else-if="lessonQuiz && auth.currentUser?.id && canAttemptQuiz">
          <QuizPlayer
            :quiz="lessonQuiz"
            :staff-profile-id="auth.currentUser.id"
            @passed="loadLessonQuiz"
          />
        </div>
        <div v-else-if="lessonQuiz && !canAttemptQuiz" class="no-quiz-msg">
          你目前沒有作答權限，請聯絡管理員指派 <strong>quiz:attempt</strong>。
        </div>
        <div v-else class="no-quiz-msg">
          本課程章節尚未設置測驗。
          <span v-if="canEditQuiz">請點「編輯測驗」新增。</span>
        </div>
      </div>

      <!-- 測驗編輯 -->
      <div v-if="activeTab === 'quiz-edit' && canEditQuiz" class="quiz-tab-panel">
        <QuizEditor
          :lesson-id="selectedLessonId"
          :lesson-title="selectedLesson?.title ?? ''"
          @saved="(quiz) => { lessonQuiz = quiz; activeTab = 'quiz' }"
          @cancelled="activeTab = 'video'"
        />
      </div>

      <div class="player-shell__meta" v-show="activeTab === 'video'">
        <div>
          <span class="course-tag">{{ course.categoryName || '未分類' }}</span>
          <h2>{{ selectedLesson?.title }}</h2>
          <p>{{ selectedLesson?.summary }}</p>
          <div class="progress-row" style="max-width: 320px; margin-top: .5rem;">
            <div class="progress-bar"><span :style="{ width: `${progressPercent}%` }"></span></div>
            <strong>{{ progressPercent }}%</strong>
          </div>
          <p class="muted-text" style="margin-top:.35rem">
            {{ syncing ? '同步進度中...' : isCompleted ? '已自動判定完成' : '自動追蹤觀看進度中' }}
          </p>
          <p v-if="syncError" class="error-text">{{ syncError }}</p>
        </div>
        <button class="table-action" type="button" @click="syncProgress(true)">
          <AppIcon name="check" :size="16" />
          立即同步進度
        </button>
      </div>
    </section>

    <section class="panel-card">
      <h2>課程章節</h2>
      <div class="lesson-list">
        <button
          v-for="lesson in course.lessons"
          :key="lesson.id"
          class="lesson-selector"
          :class="{ 'is-active': selectedLessonId === lesson.id }"
          type="button"
          @click="selectLesson(lesson.id)"
        >
          <div>
            <strong>{{ lesson.title }}</strong>
            <p>{{ lesson.summary }}</p>
          </div>
          <span>{{ Math.round((lesson.durationSeconds ?? 0) / 60) }} 分鐘</span>
        </button>
      </div>
    </section>
  </div>

  <div v-else class="panel-card">
    <h2>找不到課程</h2>
    <p>請回到學習專區重新選擇課程。</p>
  </div>
</template>

<style scoped>
.player-tabs {
  display: flex;
  gap: .5rem;
  padding: .75rem 1rem .5rem;
  border-bottom: 1px solid #e5e7eb;
  flex-wrap: wrap;
}
.tab-btn {
  background: none;
  border: none;
  padding: .4rem .9rem;
  border-radius: .5rem .5rem 0 0;
  cursor: pointer;
  font-size: .9rem;
  color: #6b7280;
  font-weight: 500;
  position: relative;
}
.tab-btn.active {
  background: #fef3c7;
  color: #b45309;
  font-weight: 700;
  border-bottom: 2px solid #f59e0b;
}
.tab-btn:hover:not(.active) { background: #f9fafb; }
.tab-badge { margin-left: .25rem; }
.quiz-tab-panel {
  padding: 1.25rem;
}
.quiz-loading, .no-quiz-msg {
  text-align: center;
  padding: 2rem;
  color: #9ca3af;
  font-size: .9rem;
}
</style>
