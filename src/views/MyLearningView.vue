<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useAuthStore } from '../stores/auth'
import { useCatalogStore } from '../stores/catalog'
import { useQuizStore } from '../stores/quiz'
import type { LearningStats, CourseLearningStatus } from '../data/mockData'

const auth = useAuthStore()
const catalog = useCatalogStore()
const quizStore = useQuizStore()

const stats = ref<LearningStats | null>(null)
const isLoading = ref(true)
const error = ref('')

// ── 載入統計 ──────────────────────────────────────────────────
onMounted(async () => {
  try {
    await catalog.fetchCourses()
    if (auth.currentUser?.id) {
      await catalog.fetchUserProgress(auth.currentUser.id)
      stats.value = await quizStore.fetchMyLearningStats(
        auth.currentUser.id,
        catalog.courses,
      )
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : '載入失敗'
  } finally {
    isLoading.value = false
  }
})

// ── SVG 圓環圖計算 ────────────────────────────────────────────
function donutArcData(percent: number, r = 42, stroke = 9): { bg: string; arc: string; offset: number } {
  const circ = 2 * Math.PI * r
  const filled = (percent / 100) * circ
  return {
    bg: `stroke-dasharray:${circ};stroke-dashoffset:0`,
    arc: `stroke-dasharray:${filled} ${circ - filled}`,
    offset: circ * 0.25,   // rotate start to top
  }
}

const completionArc = computed(() => {
  const p = stats.value?.completionRate ?? 0
  return donutArcData(p)
})

// 課程狀態分布：完成/進行/未開始/測驗待/測驗未過
const statusColors: Record<CourseLearningStatus['status'], string> = {
  completed: '#16a34a',
  in_progress: '#f59e0b',
  not_started: '#d1d5db',
  quiz_pending: '#3b82f6',
  quiz_failed: '#ef4444',
}
const statusLabels: Record<CourseLearningStatus['status'], string> = {
  completed: '已完訓',
  in_progress: '進行中',
  not_started: '未開始',
  quiz_pending: '待測驗',
  quiz_failed: '測驗未過',
}

interface StatusSegment { status: CourseLearningStatus['status']; label: string; count: number; color: string; percent: number }

const statusSegments = computed<StatusSegment[]>(() => {
  const s = stats.value
  if (!s) return []
  const total = s.courseStats.length
  if (total === 0) return []
  const countMap: Record<string, number> = {}
  for (const c of s.courseStats) {
    countMap[c.status] = (countMap[c.status] ?? 0) + 1
  }
  return (Object.keys(statusLabels) as CourseLearningStatus['status'][])
    .filter((k) => (countMap[k] ?? 0) > 0)
    .map((k) => ({
      status: k,
      label: statusLabels[k],
      count: countMap[k] ?? 0,
      color: statusColors[k],
      percent: Math.round(((countMap[k] ?? 0) / total) * 100),
    }))
})

// 多段圓弧 for 課程狀態 pie
function buildStatusArcs(segments: StatusSegment[], r = 42) {
  const circ = 2 * Math.PI * r
  const arcs: Array<{ color: string; dasharray: string; dashoffset: number }> = []
  let cumPercent = 0
  for (const seg of segments) {
    const filled = (seg.percent / 100) * circ
    const offset = circ * 0.25 - (cumPercent / 100) * circ
    arcs.push({
      color: seg.color,
      dasharray: `${filled} ${circ - filled}`,
      dashoffset: offset,
    })
    cumPercent += seg.percent
  }
  return arcs
}

const statusArcs = computed(() => buildStatusArcs(statusSegments.value))

// ── 工具 ──────────────────────────────────────────────────────
function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' })
}
</script>

<template>
  <div class="page-stack">
    <div class="page-header">
      <h1>我的學習紀錄</h1>
      <p class="sub">{{ auth.currentUser?.name }} 的個人完訓狀況</p>
    </div>

    <div v-if="isLoading" class="loading-panel panel-card">載入學習統計中…</div>
    <div v-else-if="error" class="error-panel panel-card">{{ error }}</div>

    <template v-else-if="stats">
      <!-- ── 頂端指標卡 ── -->
      <div class="metrics-row">
        <div class="metric-card">
          <div class="metric-value accent">{{ stats.completionRate }}%</div>
          <div class="metric-label">整體完訓率</div>
          <div class="metric-sub">{{ stats.completedLessons }} / {{ stats.totalLessons }} 章節</div>
        </div>
        <div class="metric-card">
          <div class="metric-value green">{{ stats.passedQuizzes }}</div>
          <div class="metric-label">測驗通過課程</div>
        </div>
        <div class="metric-card">
          <div class="metric-value amber">{{ stats.inProgressLessons }}</div>
          <div class="metric-label">學習中章節</div>
        </div>
        <div class="metric-card">
          <div class="metric-value gray">{{ stats.notStartedLessons }}</div>
          <div class="metric-label">未開始章節</div>
        </div>
      </div>

      <!-- ── 圖表區 ── -->
      <div class="charts-row">
        <!-- 完訓率圓環 -->
        <div class="chart-card panel-card">
          <h3>整體完訓率</h3>
          <div class="donut-wrap">
            <svg viewBox="0 0 100 100" class="donut-svg">
              <circle cx="50" cy="50" r="42" fill="none" stroke="#f3f4f6" stroke-width="9" />
              <circle
                cx="50" cy="50" r="42" fill="none"
                stroke="#f59e0b" stroke-width="9"
                stroke-linecap="round"
                :style="completionArc.arc"
                :transform="`rotate(-90 50 50)`"
              />
              <text x="50" y="46" text-anchor="middle" class="donut-pct">{{ stats.completionRate }}%</text>
              <text x="50" y="58" text-anchor="middle" class="donut-sub">完訓率</text>
            </svg>
          </div>
          <div class="legend-row">
            <span class="legend-dot" style="background:#f59e0b"></span>已完成
            <span class="legend-dot ml" style="background:#f3f4f6"></span>未完成
          </div>
        </div>

        <!-- 課程學習狀態圓餅 -->
        <div class="chart-card panel-card">
          <h3>課程學習狀態</h3>
          <div class="donut-wrap">
            <svg viewBox="0 0 100 100" class="donut-svg">
              <circle cx="50" cy="50" r="42" fill="none" stroke="#f3f4f6" stroke-width="9" />
              <circle
                v-for="(arc, i) in statusArcs"
                :key="i"
                cx="50" cy="50" r="42" fill="none"
                :stroke="arc.color" stroke-width="9"
                stroke-linecap="butt"
                :stroke-dasharray="arc.dasharray"
                :stroke-dashoffset="arc.dashoffset"
              />
              <text x="50" y="46" text-anchor="middle" class="donut-pct">{{ stats.courseStats.length }}</text>
              <text x="50" y="58" text-anchor="middle" class="donut-sub">課程</text>
            </svg>
          </div>
          <div class="legend-list">
            <div v-for="seg in statusSegments" :key="seg.status" class="legend-item">
              <span class="legend-dot" :style="{ background: seg.color }"></span>
              <span class="legend-label">{{ seg.label }}</span>
              <span class="legend-count">{{ seg.count }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- ── 課程詳細列表 ── -->
      <div class="panel-card">
        <h3>課程學習明細</h3>
        <div class="course-list">
          <div v-for="c in stats.courseStats" :key="c.courseId" class="course-row">
            <img v-if="c.coverUrl" :src="c.coverUrl" class="course-thumb" alt="" />
            <div v-else class="course-thumb-placeholder"></div>

            <div class="course-info">
              <div class="course-title-row">
                <span class="course-title">{{ c.courseTitle }}</span>
                <span class="status-badge" :class="c.status">{{ statusLabels[c.status] }}</span>
              </div>

              <div class="progress-row">
                <div class="progress-bar">
                  <div class="progress-fill" :style="{ width: c.completionRate + '%' }"></div>
                </div>
                <span class="progress-txt">{{ c.completionRate }}% ({{ c.completedLessons }}/{{ c.totalLessons }})</span>
              </div>

              <div class="course-meta-row">
                <template v-if="c.quizPassed !== null">
                  <span class="quiz-info">
                    測驗：{{ c.quizPassed ? '✅ 通過' : '❌ 未通過' }}
                    <span v-if="c.bestScore !== null">（最高 {{ c.bestScore }} 分，共 {{ c.attemptCount }} 次）</span>
                  </span>
                </template>
                <span v-else class="quiz-info muted">無測驗</span>
                <span class="last-at">最後活動：{{ formatDate(c.lastActivityAt) }}</span>
              </div>
            </div>
          </div>

          <div v-if="stats.courseStats.length === 0" class="empty-list">尚無課程學習紀錄</div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.page-header { margin-bottom: .5rem; }
.page-header h1 { font-size: 1.4rem; color: #1f2937; margin: 0; }
.sub { font-size: .85rem; color: #6b7280; margin: .25rem 0 0; }

/* ── 指標卡 ── */
.metrics-row { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 1rem; }
.metric-card {
  background: #fff; border: 1px solid #e5e7eb; border-radius: .75rem;
  padding: 1.1rem 1rem; text-align: center;
}
.metric-value { font-size: 2rem; font-weight: 900; }
.metric-value.accent { color: #b45309; }
.metric-value.green { color: #16a34a; }
.metric-value.amber { color: #d97706; }
.metric-value.gray { color: #9ca3af; }
.metric-label { font-size: .82rem; color: #6b7280; margin-top: .15rem; }
.metric-sub { font-size: .75rem; color: #d1d5db; margin-top: .1rem; }

/* ── 圖表卡 ── */
.charts-row { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 1rem; }
.chart-card { padding: 1.25rem; }
.chart-card h3 { margin: 0 0 .9rem; font-size: .95rem; color: #374151; }
.donut-wrap { width: 120px; margin: 0 auto; }
.donut-svg { width: 100%; height: auto; }
.donut-pct { font-size: 14px; font-weight: 800; fill: #1f2937; }
.donut-sub { font-size: 8px; fill: #9ca3af; }
.legend-row { display: flex; align-items: center; justify-content: center; gap: .4rem; margin-top: .75rem; font-size: .82rem; color: #374151; }
.legend-dot { display: inline-block; width: 10px; height: 10px; border-radius: 50%; }
.legend-dot.ml { margin-left: .75rem; }
.legend-list { display: flex; flex-direction: column; gap: .3rem; margin-top: .75rem; }
.legend-item { display: flex; align-items: center; gap: .4rem; font-size: .82rem; }
.legend-label { flex: 1; color: #374151; }
.legend-count { font-weight: 700; color: #1f2937; }

/* ── 課程列表 ── */
.course-list { display: flex; flex-direction: column; gap: .85rem; }
.course-row { display: flex; gap: .9rem; align-items: flex-start; }
.course-thumb { width: 72px; height: 48px; object-fit: cover; border-radius: .4rem; flex-shrink: 0; }
.course-thumb-placeholder { width: 72px; height: 48px; background: #f3f4f6; border-radius: .4rem; flex-shrink: 0; }
.course-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: .35rem; }
.course-title-row { display: flex; align-items: center; gap: .5rem; flex-wrap: wrap; }
.course-title { font-size: .92rem; font-weight: 600; color: #1f2937; }
.status-badge { font-size: .72rem; padding: .15rem .45rem; border-radius: .4rem; font-weight: 600; }
.status-badge.completed { background: #f0fdf4; color: #15803d; }
.status-badge.in_progress { background: #fef3c7; color: #92400e; }
.status-badge.not_started { background: #f3f4f6; color: #6b7280; }
.status-badge.quiz_pending { background: #eff6ff; color: #1d4ed8; }
.status-badge.quiz_failed { background: #fef2f2; color: #b91c1c; }
.progress-row { display: flex; align-items: center; gap: .5rem; }
.progress-bar { flex: 1; height: 6px; background: #f3f4f6; border-radius: 9px; overflow: hidden; max-width: 200px; }
.progress-fill { height: 100%; background: #f59e0b; border-radius: 9px; transition: width .3s; }
.progress-txt { font-size: .78rem; color: #6b7280; white-space: nowrap; }
.course-meta-row { display: flex; align-items: center; gap: 1rem; flex-wrap: wrap; }
.quiz-info { font-size: .78rem; color: #374151; }
.quiz-info.muted { color: #d1d5db; }
.last-at { font-size: .75rem; color: #9ca3af; margin-left: auto; }
.empty-list { text-align: center; padding: 2rem; color: #9ca3af; font-size: .9rem; }
.loading-panel, .error-panel { text-align: center; padding: 3rem; color: #6b7280; }
</style>
