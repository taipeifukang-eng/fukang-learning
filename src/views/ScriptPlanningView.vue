<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useAuthStore } from '../stores/auth'
import { useCatalogStore } from '../stores/catalog'
import { supabase } from '../lib/supabase'
import type { Course, Lesson } from '../data/mockData'

interface ScriptActor {
  name: string
  role: string
  note: string
}

interface LessonScript {
  id: string
  courseId: string
  lessonId: string | null
  topic: string
  learningItem: string
  scriptBody: string
  actors: ScriptActor[]
  shootingCompleted: boolean
  videoFileName: string
  sequenceNo: number
  notes: string
  createdAt: string
  updatedAt: string
}

const auth = useAuthStore()
const catalog = useCatalogStore()

const canEdit = computed(() => auth.hasPermission('courses:edit'))
const scripts = ref<LessonScript[]>([])
const loading = ref(false)
const saving = ref(false)
const deleting = ref<string | null>(null)
const errorText = ref('')
const selectedScriptId = ref<string | null>(null)
const courseFilter = ref<string>('all')
const statusFilter = ref<'all' | 'pending' | 'done'>('all')
const searchText = ref('')

const form = reactive({
  id: '',
  courseId: '',
  lessonId: '',
  topic: '',
  learningItem: '',
  scriptBody: '',
  actors: [] as ScriptActor[],
  shootingCompleted: false,
  videoFileName: '',
  sequenceNo: 0,
  notes: '',
})

const selectedCourse = computed(() =>
  catalog.courses.find((course) => course.id === form.courseId),
)

const selectedLesson = computed(() =>
  selectedCourse.value?.lessons.find((lesson) => lesson.id === form.lessonId),
)

const courseOptions = computed(() =>
  [...catalog.courses].sort((a, b) => a.title.localeCompare(b.title, 'zh-TW')),
)

const lessonOptions = computed(() => selectedCourse.value?.lessons ?? [])

const filteredScripts = computed(() => {
  const keyword = searchText.value.trim().toLowerCase()
  return scripts.value.filter((script) => {
    if (courseFilter.value !== 'all' && script.courseId !== courseFilter.value) return false
    if (statusFilter.value === 'done' && !script.shootingCompleted) return false
    if (statusFilter.value === 'pending' && script.shootingCompleted) return false
    if (!keyword) return true
    return [
      script.topic,
      script.learningItem,
      script.videoFileName,
      findCourse(script.courseId)?.title ?? '',
      script.lessonId ? findLesson(script.lessonId)?.title ?? '' : '',
    ].some((value) => value.toLowerCase().includes(keyword))
  })
})

const stats = computed(() => {
  const total = scripts.value.length
  const done = scripts.value.filter((script) => script.shootingCompleted).length
  const withActors = scripts.value.filter((script) => script.actors.length > 0).length
  return { total, done, pending: total - done, withActors }
})

onMounted(async () => {
  await Promise.all([catalog.fetchCourses(), catalog.fetchCategories(), fetchScripts()])
})

function mapScript(row: any): LessonScript {
  return {
    id: row.id,
    courseId: row.course_id,
    lessonId: row.lesson_id ?? null,
    topic: row.topic ?? '',
    learningItem: row.learning_item ?? '',
    scriptBody: row.script_body ?? '',
    actors: Array.isArray(row.actors) ? row.actors : [],
    shootingCompleted: Boolean(row.shooting_completed),
    videoFileName: row.video_file_name ?? '',
    sequenceNo: row.sequence_no ?? 0,
    notes: row.notes ?? '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

async function fetchScripts() {
  loading.value = true
  errorText.value = ''
  try {
    const { data, error } = await supabase
      .from('lesson_scripts')
      .select('*')
      .order('sequence_no', { ascending: true })
      .order('updated_at', { ascending: false })

    if (error) throw error
    scripts.value = (data ?? []).map(mapScript)
  } catch (err) {
    scripts.value = []
    errorText.value = err instanceof Error
      ? `${err.message}。若尚未建立資料表，請先在 Supabase SQL Editor 執行 supabase/patch_lesson_scripts.sql。`
      : '讀取腳本資料失敗'
  } finally {
    loading.value = false
  }
}

function findCourse(courseId: string): Course | undefined {
  return catalog.courses.find((course) => course.id === courseId)
}

function findLesson(lessonId: string): Lesson | undefined {
  return catalog.courses.flatMap((course) => course.lessons).find((lesson) => lesson.id === lessonId)
}

function lessonLabel(script: LessonScript) {
  if (!script.lessonId) return '尚未指定影片'
  const lesson = findLesson(script.lessonId)
  return lesson ? `${lesson.sortOrder + 1}. ${lesson.title}` : '影片已不存在'
}

function resetForm() {
  form.id = ''
  form.courseId = courseFilter.value !== 'all' ? courseFilter.value : (courseOptions.value[0]?.id ?? '')
  form.lessonId = selectedCourse.value?.lessons[0]?.id ?? ''
  form.topic = selectedLesson.value?.title ?? ''
  form.learningItem = selectedLesson.value?.summary ?? ''
  form.scriptBody = ''
  form.actors = []
  form.shootingCompleted = false
  form.videoFileName = ''
  form.sequenceNo = nextSequenceNo()
  form.notes = ''
  selectedScriptId.value = null
}

function startAdd() {
  resetForm()
  if (form.lessonId) {
    syncFromLesson()
    generateFileName()
  }
}

function startEdit(script: LessonScript) {
  selectedScriptId.value = script.id
  form.id = script.id
  form.courseId = script.courseId
  form.lessonId = script.lessonId ?? ''
  form.topic = script.topic
  form.learningItem = script.learningItem
  form.scriptBody = script.scriptBody
  form.actors = script.actors.map((actor) => ({ ...actor }))
  form.shootingCompleted = script.shootingCompleted
  form.videoFileName = script.videoFileName
  form.sequenceNo = script.sequenceNo
  form.notes = script.notes
}

function onCourseChanged() {
  form.lessonId = selectedCourse.value?.lessons[0]?.id ?? ''
  syncFromLesson()
}

function syncFromLesson() {
  if (!selectedLesson.value) return
  if (!form.topic.trim()) form.topic = selectedLesson.value.title
  if (!form.learningItem.trim()) form.learningItem = selectedLesson.value.summary
}

function nextSequenceNo() {
  return scripts.value.reduce((max, script) => Math.max(max, script.sequenceNo || 0), 0) + 1
}

function safeFileSegment(input: string) {
  return input
    .trim()
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 36)
}

function generateFileName() {
  if (!form.sequenceNo) form.sequenceNo = nextSequenceNo()
  const title = selectedLesson.value?.title || form.learningItem || form.topic || '未命名教學項目'
  form.videoFileName = `FK-LEARN-${String(form.sequenceNo).padStart(4, '0')}-${safeFileSegment(title)}`
}

function generateScriptDraft() {
  syncFromLesson()
  if (!form.topic.trim()) form.topic = selectedLesson.value?.title ?? '教學主題'
  if (!form.learningItem.trim()) form.learningItem = '請補上本支影片要完成的學習項目'

  const actorNames = form.actors.map((actor) => actor.name).filter(Boolean).join('、') || '講師'
  form.scriptBody = [
    `【教學主題】${form.topic}`,
    `【學習項目】${form.learningItem}`,
    '',
    '【開場】',
    `${actorNames}：大家好，這支影片要帶大家完成「${form.learningItem}」。請先留意今天的操作情境與關鍵判斷點。`,
    '',
    '【重點說明】',
    '1. 說明這個主題在門市或工作現場會遇到的情境。',
    '2. 拆解標準流程、注意事項與常見錯誤。',
    '3. 補充學員完成後應能說出或做出的成果。',
    '',
    '【示範段落】',
    '畫面：切到實際操作或情境演練。',
    '旁白：依步驟示範，每一步用一句短句說清楚目的。',
    '',
    '【收尾】',
    `${actorNames}：以上就是「${form.topic}」的重點。完成觀看後，請回到學習系統確認進度，並依主管安排進行實作。`,
  ].join('\n')
}

function addActor() {
  form.actors.push({ name: '', role: '', note: '' })
}

function removeActor(index: number) {
  form.actors.splice(index, 1)
}

async function saveScript() {
  if (!canEdit.value || !form.courseId || !form.topic.trim()) return
  saving.value = true
  errorText.value = ''
  try {
    const payload = {
      course_id: form.courseId,
      lesson_id: form.lessonId || null,
      topic: form.topic.trim(),
      learning_item: form.learningItem.trim(),
      script_body: form.scriptBody.trim(),
      actors: form.actors
        .map((actor) => ({
          name: actor.name.trim(),
          role: actor.role.trim(),
          note: actor.note.trim(),
        }))
        .filter((actor) => actor.name || actor.role || actor.note),
      shooting_completed: form.shootingCompleted,
      video_file_name: form.videoFileName.trim(),
      sequence_no: Number(form.sequenceNo) || nextSequenceNo(),
      notes: form.notes.trim(),
      updated_by: auth.currentUser?.id ?? null,
    }

    if (form.id) {
      const { data, error } = await supabase
        .from('lesson_scripts')
        .update(payload)
        .eq('id', form.id)
        .select()
        .single()
      if (error) throw error
      const next = mapScript(data)
      const index = scripts.value.findIndex((script) => script.id === next.id)
      if (index >= 0) scripts.value[index] = next
      startEdit(next)
    } else {
      const { data, error } = await supabase
        .from('lesson_scripts')
        .insert({ ...payload, created_by: auth.currentUser?.id ?? null })
        .select()
        .single()
      if (error) throw error
      const next = mapScript(data)
      scripts.value.unshift(next)
      startEdit(next)
    }
  } catch (err) {
    errorText.value = err instanceof Error ? err.message : '儲存腳本失敗'
  } finally {
    saving.value = false
  }
}

async function removeScript(script: LessonScript) {
  if (!canEdit.value || !confirm(`確定刪除「${script.topic}」的腳本？`)) return
  deleting.value = script.id
  try {
    const { error } = await supabase.from('lesson_scripts').delete().eq('id', script.id)
    if (error) throw error
    scripts.value = scripts.value.filter((item) => item.id !== script.id)
    if (selectedScriptId.value === script.id) startAdd()
  } catch (err) {
    errorText.value = err instanceof Error ? err.message : '刪除腳本失敗'
  } finally {
    deleting.value = null
  }
}

function formatDate(value: string) {
  if (!value) return '—'
  return new Date(value).toLocaleString('zh-TW', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}
</script>

<template>
  <div class="page-stack script-page">
    <section class="script-hero">
      <div>
        <span class="script-kicker">Teaching Production Board</span>
        <h2>教學腳本設計</h2>
        <p>把課程章節延伸成可拍攝的腳本，集中管理演員、影片檔名與拍攝完成狀態。</p>
      </div>
      <div class="script-stats">
        <div><strong>{{ stats.total }}</strong><span>腳本</span></div>
        <div><strong>{{ stats.pending }}</strong><span>待拍攝</span></div>
        <div><strong>{{ stats.done }}</strong><span>已完成</span></div>
        <div><strong>{{ stats.withActors }}</strong><span>已排演員</span></div>
      </div>
    </section>

    <section v-if="errorText" class="panel-card script-error">
      {{ errorText }}
    </section>

    <section class="script-workspace">
      <div class="panel-card script-list-panel">
        <div class="panel-header">
          <h3>腳本清單</h3>
          <button v-if="canEdit" class="btn btn--primary" type="button" @click="startAdd">+ 新增腳本</button>
        </div>

        <div class="script-filters">
          <input v-model="searchText" class="form-input" placeholder="搜尋主題、項目或檔名" />
          <select v-model="courseFilter" class="form-input">
            <option value="all">全部課程</option>
            <option v-for="course in courseOptions" :key="course.id" :value="course.id">{{ course.title }}</option>
          </select>
          <select v-model="statusFilter" class="form-input">
            <option value="all">全部狀態</option>
            <option value="pending">待拍攝</option>
            <option value="done">已完成</option>
          </select>
        </div>

        <div v-if="loading" class="empty-state">載入腳本中…</div>
        <div v-else-if="filteredScripts.length === 0" class="empty-state">目前沒有符合條件的腳本</div>

        <div v-else class="script-list">
          <button
            v-for="script in filteredScripts"
            :key="script.id"
            class="script-row"
            :class="{ 'is-active': selectedScriptId === script.id }"
            type="button"
            @click="startEdit(script)"
          >
            <div class="script-row__main">
              <strong>{{ script.topic || '未命名腳本' }}</strong>
              <span>{{ findCourse(script.courseId)?.title ?? '課程已不存在' }} · {{ lessonLabel(script) }}</span>
            </div>
            <div class="script-row__meta">
              <span :class="script.shootingCompleted ? 'script-chip script-chip--done' : 'script-chip'">
                {{ script.shootingCompleted ? '已拍攝' : '待拍攝' }}
              </span>
              <small>{{ script.videoFileName || `#${script.sequenceNo || '—'}` }}</small>
            </div>
          </button>
        </div>
      </div>

      <form class="panel-card script-editor" @submit.prevent="saveScript">
        <div class="panel-header">
          <h3>{{ form.id ? '編輯腳本' : '新增腳本' }}</h3>
          <button class="btn" type="button" @click="fetchScripts">重新整理</button>
        </div>

        <div class="editor-grid">
          <label class="form-label">課程
            <select v-model="form.courseId" class="form-input" :disabled="!canEdit" @change="onCourseChanged">
              <option value="">請選擇課程</option>
              <option v-for="course in courseOptions" :key="course.id" :value="course.id">{{ course.title }}</option>
            </select>
          </label>
          <label class="form-label">教學影片章節
            <select v-model="form.lessonId" class="form-input" :disabled="!canEdit" @change="syncFromLesson">
              <option value="">尚未指定影片</option>
              <option v-for="lesson in lessonOptions" :key="lesson.id" :value="lesson.id">
                {{ lesson.sortOrder + 1 }}. {{ lesson.title }}
              </option>
            </select>
          </label>
        </div>

        <div class="editor-grid">
          <label class="form-label">教學主題 *
            <input v-model="form.topic" class="form-input" :disabled="!canEdit" required />
          </label>
          <label class="form-label">學習項目
            <input v-model="form.learningItem" class="form-input" :disabled="!canEdit" placeholder="例如：完成處方箋核對流程" />
          </label>
        </div>

        <div class="editor-grid editor-grid--file">
          <label class="form-label">影片流水號
            <input v-model.number="form.sequenceNo" class="form-input" type="number" min="1" :disabled="!canEdit" />
          </label>
          <label class="form-label">影片檔名
            <div class="input-with-button">
              <input v-model="form.videoFileName" class="form-input" :disabled="!canEdit" />
              <button class="btn" type="button" :disabled="!canEdit" @click="generateFileName">產生</button>
            </div>
          </label>
        </div>

        <div class="script-tools">
          <button class="btn" type="button" :disabled="!canEdit" @click="generateScriptDraft">產生腳本草稿</button>
          <label class="shoot-toggle">
            <input v-model="form.shootingCompleted" type="checkbox" :disabled="!canEdit" />
            <span>{{ form.shootingCompleted ? '影片拍攝已完成' : '影片尚未拍攝完成' }}</span>
          </label>
        </div>

        <label class="form-label">教學腳本
          <textarea
            v-model="form.scriptBody"
            class="form-input script-textarea"
            rows="14"
            :disabled="!canEdit"
            placeholder="可貼上你和 Codex 在 VS Code 共同生成的腳本，也可以先用上方按鈕產生草稿。"
          />
        </label>

        <div class="actor-block">
          <div class="actor-block__header">
            <strong>影片演員名單</strong>
            <button class="btn" type="button" :disabled="!canEdit" @click="addActor">+ 新增演員</button>
          </div>
          <div v-if="form.actors.length === 0" class="empty-state empty-state--compact">尚未安排演員</div>
          <div v-for="(actor, index) in form.actors" :key="index" class="actor-row">
            <input v-model="actor.name" class="form-input" :disabled="!canEdit" placeholder="姓名" />
            <input v-model="actor.role" class="form-input" :disabled="!canEdit" placeholder="角色 / 職責" />
            <input v-model="actor.note" class="form-input" :disabled="!canEdit" placeholder="備註" />
            <button class="table-action table-action--danger" type="button" :disabled="!canEdit" @click="removeActor(index)">移除</button>
          </div>
        </div>

        <label class="form-label">製作備註
          <textarea v-model="form.notes" class="form-input" rows="3" :disabled="!canEdit" placeholder="拍攝場地、道具、補拍事項..." />
        </label>

        <div class="form-actions">
          <button class="btn btn--primary" type="submit" :disabled="!canEdit || saving">
            {{ saving ? '儲存中…' : '儲存腳本' }}
          </button>
          <button v-if="form.id && canEdit" class="btn btn--danger" type="button" :disabled="deleting === form.id" @click="removeScript({ id: form.id, courseId: form.courseId, lessonId: form.lessonId || null, topic: form.topic, learningItem: form.learningItem, scriptBody: form.scriptBody, actors: form.actors, shootingCompleted: form.shootingCompleted, videoFileName: form.videoFileName, sequenceNo: form.sequenceNo, notes: form.notes, createdAt: '', updatedAt: '' })">
            刪除腳本
          </button>
          <span v-if="form.id" class="muted-text">最後更新：{{ formatDate(scripts.find((script) => script.id === form.id)?.updatedAt ?? '') }}</span>
        </div>
      </form>
    </section>
  </div>
</template>

<style scoped>
.script-page {
  gap: 1rem;
}

.script-hero {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(22rem, 0.8fr);
  gap: 1rem;
  align-items: end;
  padding: 1.35rem;
  border: 1px solid var(--admin-border);
  border-radius: 1.4rem;
  background:
    linear-gradient(135deg, rgba(var(--admin-primary-rgb), 0.16), transparent 54%),
    color-mix(in srgb, var(--admin-surface-raised) 92%, transparent);
  box-shadow: var(--admin-shadow);
}

.script-kicker {
  display: inline-block;
  margin-bottom: 0.35rem;
  color: var(--admin-primary);
  font-size: 0.78rem;
  font-weight: 800;
  letter-spacing: 0;
}

.script-hero h2 {
  margin: 0;
  font-size: 1.65rem;
}

.script-hero p {
  max-width: 42rem;
  margin: 0.55rem 0 0;
  color: var(--admin-ink-muted);
}

.script-stats {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.65rem;
}

.script-stats div {
  min-width: 0;
  padding: 0.8rem;
  border: 1px solid var(--admin-border);
  border-radius: 1rem;
  background: var(--admin-surface);
}

.script-stats strong,
.script-stats span {
  display: block;
}

.script-stats strong {
  font-size: 1.55rem;
}

.script-stats span {
  margin-top: 0.2rem;
  color: var(--admin-ink-muted);
  font-size: 0.78rem;
}

.script-error {
  color: var(--admin-danger);
}

.script-workspace {
  display: grid;
  grid-template-columns: minmax(18rem, 0.78fr) minmax(0, 1.22fr);
  gap: 1rem;
  align-items: start;
}

.script-list-panel,
.script-editor {
  min-width: 0;
}

.script-filters,
.script-list,
.actor-block {
  display: grid;
  gap: 0.75rem;
}

.script-filters {
  margin-bottom: 0.85rem;
}

.script-list {
  max-height: 42rem;
  overflow: auto;
}

.script-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 0.75rem;
  width: 100%;
  padding: 0.85rem;
  border: 1px solid var(--admin-border);
  border-radius: 1rem;
  background: var(--admin-surface);
  color: inherit;
  text-align: left;
}

.script-row:hover,
.script-row.is-active {
  border-color: rgba(var(--admin-primary-rgb), 0.45);
  background: var(--admin-primary-soft);
}

.script-row__main,
.script-row__meta {
  display: grid;
  gap: 0.35rem;
}

.script-row__main {
  min-width: 0;
}

.script-row__main strong,
.script-row__main span,
.script-row__meta small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.script-row__main span,
.script-row__meta small {
  color: var(--admin-ink-muted);
  font-size: 0.78rem;
}

.script-row__meta {
  justify-items: end;
}

.script-chip {
  width: fit-content;
  padding: 0.25rem 0.6rem;
  border-radius: 999px;
  background: rgba(217, 119, 6, 0.12);
  color: var(--admin-warning);
  font-size: 0.76rem;
  font-weight: 700;
}

.script-chip--done {
  background: rgba(107, 142, 35, 0.14);
  color: var(--admin-success);
}

.editor-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
}

.editor-grid--file {
  grid-template-columns: minmax(8rem, 0.32fr) minmax(0, 0.68fr);
}

.input-with-button,
.script-tools,
.actor-block__header,
.actor-row {
  display: flex;
  align-items: center;
  gap: 0.65rem;
}

.input-with-button .form-input {
  flex: 1;
}

.script-tools {
  justify-content: space-between;
  flex-wrap: wrap;
  padding: 0.75rem;
  border: 1px solid var(--admin-border);
  border-radius: 1rem;
  background: var(--admin-surface);
}

.shoot-toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  color: var(--admin-ink-muted);
  font-weight: 700;
}

.shoot-toggle input {
  accent-color: var(--admin-primary);
}

.script-textarea {
  min-height: 24rem;
  line-height: 1.7;
}

.actor-block {
  padding: 1rem;
  border: 1px solid var(--admin-border);
  border-radius: 1rem;
  background: var(--admin-surface);
}

.actor-block__header {
  justify-content: space-between;
}

.actor-row {
  align-items: stretch;
}

.actor-row .form-input {
  flex: 1;
}

.empty-state {
  padding: 2rem 1rem;
  border: 1px dashed var(--admin-border);
  border-radius: 1rem;
  color: var(--admin-ink-muted);
  text-align: center;
}

.empty-state--compact {
  padding: 1rem;
}

.btn--danger {
  color: var(--admin-danger);
}

@media (max-width: 1120px) {
  .script-hero,
  .script-workspace {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 767px) {
  .script-stats,
  .editor-grid,
  .editor-grid--file {
    grid-template-columns: 1fr;
  }

  .actor-row,
  .input-with-button {
    flex-direction: column;
    align-items: stretch;
  }

  .script-row {
    grid-template-columns: 1fr;
  }

  .script-row__meta {
    justify-items: start;
  }
}
</style>
