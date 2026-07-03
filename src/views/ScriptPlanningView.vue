<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import VideoUploader from '../components/VideoUploader.vue'
import { useAuthStore } from '../stores/auth'
import { useCatalogStore } from '../stores/catalog'
import { supabase } from '../lib/supabase'
import type { Category, Course, Lesson } from '../data/mockData'

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
const loading = ref(false)
const saving = ref(false)
const errorText = ref('')
const scripts = ref<LessonScript[]>([])
const selectedCategoryId = ref<number | null>(null)
const selectedCourseId = ref<string | null>(null)
const selectedLessonId = ref<string>('')
const newTopicName = ref('')
const courseSearch = ref('')
const editingTopicId = ref<number | null>(null)
const topicNameInput = ref('')
const topicSortOrderInput = ref(0)
const topicEnabledInput = ref(true)
const publishPanelOpen = ref(false)
const publishSaving = ref(false)
const publishError = ref('')
const coverFile = ref<File | null>(null)
const coverPreview = ref('')
const coverUploading = ref(false)
const courseEnabled = ref(true)
const coursePortalSections = ref<string[]>([])
const courseAudienceType = ref<'all' | 'org' | 'role'>('all')
const courseAudienceId = ref<number | string | null>(null)
const editingLessonId = ref<string | null>(null)
const lessonTitle = ref('')
const lessonSummary = ref('')
const lessonDurationSeconds = ref(0)
const lessonSortOrder = ref(0)
const lessonBunnyVideoId = ref('')
const showUploader = ref(false)

const PORTAL_SECTIONS = [
  { id: 'store-newcomer', label: '門市－新人培訓' },
  { id: 'store-supervisor', label: '門市－主管課程' },
  { id: 'store-general', label: '門市－通識學習' },
  { id: 'pharmacist-clinical', label: '藥師－藥學專業' },
  { id: 'pharmacist-general', label: '藥師－通識學習' },
  { id: 'hq-general', label: '總部－通識學習' },
] as const

const courseForm = reactive({
  title: '',
  outline: '',
})

const scriptForm = reactive({
  id: '',
  scriptBody: '',
  actors: [] as ScriptActor[],
  shootingCompleted: false,
  videoFileName: '',
  sequenceNo: 0,
  notes: '',
})

const categories = computed(() =>
  [...catalog.categories].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'zh-TW')),
)

const selectedCategory = computed(() =>
  categories.value.find((category) => category.id === selectedCategoryId.value),
)

const coursesInTopic = computed(() => {
  if (!selectedCategoryId.value) return []
  const keyword = courseSearch.value.trim().toLowerCase()
  return catalog.courses
    .filter((course) => course.categoryId === selectedCategoryId.value)
    .filter((course) => {
      if (!keyword) return true
      return [course.title, course.description, course.lessons.map((lesson) => lesson.title).join(' ')]
        .some((value) => value.toLowerCase().includes(keyword))
    })
    .sort((a, b) => a.title.localeCompare(b.title, 'zh-TW'))
})

const selectedCourse = computed<Course | undefined>(() =>
  catalog.courses.find((course) => course.id === selectedCourseId.value),
)

const selectedLesson = computed<Lesson | undefined>(() =>
  selectedCourse.value?.lessons.find((lesson) => lesson.id === selectedLessonId.value),
)

const selectedScript = computed(() => {
  if (scriptForm.id) return scripts.value.find((script) => script.id === scriptForm.id)
  if (selectedLessonId.value) return scripts.value.find((script) => script.lessonId === selectedLessonId.value)
  if (selectedCourseId.value) return scripts.value.find((script) => script.courseId === selectedCourseId.value)
  return undefined
})

const stats = computed(() => {
  const topicCourses = catalog.courses.filter((course) => course.categoryId === selectedCategoryId.value)
  const topicCourseIds = new Set(topicCourses.map((course) => course.id))
  const topicScripts = scripts.value.filter((script) => topicCourseIds.has(script.courseId))
  const totalCourses = topicCourses.length
  const scriptedCourses = topicCourses
    .filter((course) => scripts.value.some((script) => script.courseId === course.id)).length
  const completed = topicScripts.filter((script) => script.shootingCompleted).length
  return {
    topics: categories.value.length,
    totalCourses,
    scriptedCourses,
    pending: Math.max(topicScripts.length - completed, 0),
  }
})

onMounted(async () => {
  loading.value = true
  await Promise.all([
    catalog.fetchCategories(),
    catalog.fetchCourses(),
    catalog.fetchOrganizations(),
    catalog.fetchAllRoles(),
    fetchScripts(),
  ])
  selectedCategoryId.value = categories.value[0]?.id ?? null
  loading.value = false
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
  }
}

function topicCourseCount(categoryId: number) {
  return catalog.courses.filter((course) => course.categoryId === categoryId).length
}

function scriptsForCourse(courseId: string) {
  return scripts.value.filter((script) => script.courseId === courseId)
}

function hasVideo(course: Course) {
  return course.lessons.some((lesson) => Boolean(lesson.bunnyVideoId))
}

function courseVideoLabel(course: Course) {
  if (hasVideo(course)) return '已有影片'
  if (scriptsForCourse(course.id).some((script) => script.shootingCompleted)) return '已拍攝待上傳'
  return '尚無影片'
}

function chooseTopic(category: Category) {
  selectedCategoryId.value = category.id
  selectedCourseId.value = null
  selectedLessonId.value = ''
  courseSearch.value = ''
  publishPanelOpen.value = false
  cancelTopicEdit()
  resetEditor()
}

async function addTopic() {
  const name = newTopicName.value.trim()
  if (!canEdit.value || !name) return
  saving.value = true
  errorText.value = ''
  try {
    await catalog.upsertCategory({
      name,
      sortOrder: categories.value.length + 1,
      enabled: true,
    })
    await catalog.fetchCategories()
    const created = categories.value.find((category) => category.name === name)
    selectedCategoryId.value = created?.id ?? categories.value[0]?.id ?? null
    newTopicName.value = ''
  } catch (err) {
    errorText.value = err instanceof Error ? err.message : '新增主題失敗'
  } finally {
    saving.value = false
  }
}

function startEditTopic(category: Category) {
  editingTopicId.value = category.id
  topicNameInput.value = category.name
  topicSortOrderInput.value = category.sortOrder
  topicEnabledInput.value = category.enabled
}

function cancelTopicEdit() {
  editingTopicId.value = null
  topicNameInput.value = ''
}

async function saveTopic() {
  if (!canEdit.value || editingTopicId.value === null || !topicNameInput.value.trim()) return
  saving.value = true
  errorText.value = ''
  try {
    await catalog.upsertCategory({
      id: editingTopicId.value,
      name: topicNameInput.value,
      sortOrder: topicSortOrderInput.value,
      enabled: topicEnabledInput.value,
    })
    cancelTopicEdit()
  } catch (err) {
    errorText.value = err instanceof Error ? err.message : '儲存主題失敗'
  } finally {
    saving.value = false
  }
}

async function removeTopic(category: Category) {
  if (!canEdit.value) return
  const message = `確定刪除「${category.name}」？已指派的課程分類將被清空。`
  if (!confirm(message)) return
  saving.value = true
  errorText.value = ''
  try {
    await catalog.deleteCategory(category.id)
    if (selectedCategoryId.value === category.id) {
      selectedCategoryId.value = categories.value[0]?.id ?? null
      selectedCourseId.value = null
      selectedLessonId.value = ''
      resetEditor()
    }
    cancelTopicEdit()
  } catch (err) {
    errorText.value = err instanceof Error ? err.message : '刪除主題失敗'
  } finally {
    saving.value = false
  }
}

function resetEditor() {
  courseForm.title = ''
  courseForm.outline = ''
  scriptForm.id = ''
  scriptForm.scriptBody = ''
  scriptForm.actors = []
  scriptForm.shootingCompleted = false
  scriptForm.videoFileName = ''
  scriptForm.sequenceNo = nextSequenceNo()
  scriptForm.notes = ''
  publishPanelOpen.value = false
  resetPublishForm()
}

function startNewCourse() {
  selectedCourseId.value = null
  selectedLessonId.value = ''
  resetEditor()
}

function chooseCourse(course: Course) {
  selectedCourseId.value = course.id
  courseForm.title = course.title
  courseForm.outline = course.description || course.lessons[0]?.summary || ''
  publishPanelOpen.value = false
  loadPublishForm(course)

  const courseScripts = scriptsForCourse(course.id)
  const firstScript = courseScripts[0]
  selectedLessonId.value = firstScript?.lessonId ?? course.lessons[0]?.id ?? ''
  loadScript(firstScript ?? scripts.value.find((script) => script.lessonId === selectedLessonId.value))
}

function resetPublishForm() {
  coverFile.value = null
  coverPreview.value = ''
  courseEnabled.value = true
  coursePortalSections.value = []
  courseAudienceType.value = 'all'
  courseAudienceId.value = null
  editingLessonId.value = null
  showUploader.value = false
  publishError.value = ''
}

function loadPublishForm(course: Course) {
  coverFile.value = null
  coverPreview.value = course.coverUrl
  courseEnabled.value = course.enabled
  coursePortalSections.value = [...(course.portalSections ?? [])]
  const audience = course.audiences[0]
  courseAudienceType.value = audience?.audienceType ?? 'all'
  courseAudienceId.value = audience?.audienceId ?? null
  editingLessonId.value = null
  showUploader.value = false
  publishError.value = ''
}

function openPublishPanel() {
  if (!selectedCourse.value) return
  loadPublishForm(selectedCourse.value)
  publishPanelOpen.value = true
}

function loadScript(script?: LessonScript) {
  if (!script) {
    scriptForm.id = ''
    scriptForm.scriptBody = ''
    scriptForm.actors = []
    scriptForm.shootingCompleted = false
    scriptForm.videoFileName = ''
    scriptForm.sequenceNo = nextSequenceNo()
    scriptForm.notes = ''
    generateFileName()
    return
  }

  scriptForm.id = script.id
  scriptForm.scriptBody = script.scriptBody
  scriptForm.actors = script.actors.map((actor) => ({ ...actor }))
  scriptForm.shootingCompleted = script.shootingCompleted
  scriptForm.videoFileName = script.videoFileName
  scriptForm.sequenceNo = script.sequenceNo || nextSequenceNo()
  scriptForm.notes = script.notes
}

function onLessonChanged() {
  const script = scripts.value.find((item) => item.lessonId === selectedLessonId.value)
  loadScript(script)
  if (!courseForm.outline.trim() && selectedLesson.value?.summary) {
    courseForm.outline = selectedLesson.value.summary
  }
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
  if (!scriptForm.sequenceNo) scriptForm.sequenceNo = nextSequenceNo()
  const source = courseForm.title || selectedLesson.value?.title || '未命名課程'
  scriptForm.videoFileName = `FK-LEARN-${String(scriptForm.sequenceNo).padStart(4, '0')}-${safeFileSegment(source)}`
}

function generateDraft() {
  const title = courseForm.title.trim() || '課程題目'
  const outline = courseForm.outline.trim() || '請補上本堂課要完成的學習重點。'
  const actorNames = scriptForm.actors.map((actor) => actor.name).filter(Boolean).join('、') || '講師'
  scriptForm.scriptBody = [
    `【課程題目】${title}`,
    `【課程內容大綱】${outline}`,
    '',
    '【開場】',
    `${actorNames}：大家好，這堂課要帶大家完成「${title}」。`,
    '',
    '【核心內容】',
    '1. 先說明這個情境為什麼重要，以及學員完成後應該會做什麼。',
    '2. 依實際工作流程拆成 3 到 5 個步驟，每一步搭配畫面或示範。',
    '3. 標出常見錯誤、判斷標準，以及主管會檢核的重點。',
    '',
    '【示範畫面】',
    '畫面：切到實際操作、門市情境或系統畫面。',
    '旁白：用短句說明操作目的，不只唸出畫面文字。',
    '',
    '【收尾】',
    `${actorNames}：以上就是「${title}」的重點。看完後請回到學習平台確認進度，並依照主管安排練習。`,
  ].join('\n')
}

function normalizeBunnyVideoId(input: string) {
  const value = input.trim()
  if (!value) return ''
  if (!value.includes('/')) return value
  const cleaned = value.split('?')[0].replace(/\/+$/, '')
  const parts = cleaned.split('/').filter(Boolean)
  return parts[parts.length - 1] ?? ''
}

function audienceLabel(course: Course) {
  const audience = course.audiences[0]
  if (!audience || audience.audienceType === 'all') return '全體'
  if (audience.audienceType === 'org') {
    const org = catalog.organizations.find((item) => item.id === audience.audienceId)
    return org?.shortName ?? `組織 #${audience.audienceId}`
  }
  const role = catalog.allRoles.find((item) => item.id === Number(audience.audienceId))
  return role?.title ?? `角色 #${audience.audienceId}`
}

function onCoverFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  coverFile.value = file
  coverPreview.value = URL.createObjectURL(file)
}

async function uploadCoverIfNeeded() {
  if (!coverFile.value) return selectedCourse.value?.coverUrl ?? ''
  coverUploading.value = true
  try {
    const ext = coverFile.value.name.split('.').pop() ?? 'jpg'
    const path = `covers/${Date.now()}.${ext}`
    const { error } = await supabase.storage
      .from('course-covers')
      .upload(path, coverFile.value, { upsert: true })
    if (error) throw error
    const { data } = supabase.storage.from('course-covers').getPublicUrl(path)
    return data.publicUrl
  } finally {
    coverUploading.value = false
  }
}

async function savePublishSettings() {
  if (!canEdit.value || !selectedCourseId.value || !courseForm.title.trim()) return
  publishSaving.value = true
  publishError.value = ''
  try {
    const coverUrl = coverPreview.value ? await uploadCoverIfNeeded() : ''
    const courseId = await catalog.upsertCourse({
      id: selectedCourseId.value,
      title: courseForm.title,
      categoryId: selectedCategoryId.value,
      description: courseForm.outline,
      enabled: courseEnabled.value,
      coverUrl,
      portalSections: coursePortalSections.value,
    })
    await catalog.saveCourseAudiences(courseId, courseAudienceType.value === 'all'
      ? [{ courseId, audienceType: 'all', audienceId: null }]
      : [{ courseId, audienceType: courseAudienceType.value, audienceId: courseAudienceId.value === null ? null : Number(courseAudienceId.value) }],
    )
    await catalog.fetchCourses()
    const course = catalog.courses.find((item) => item.id === courseId)
    if (course) {
      selectedCourseId.value = course.id
      loadPublishForm(course)
    }
  } catch (err) {
    publishError.value = err instanceof Error ? err.message : '儲存發布設定失敗'
  } finally {
    publishSaving.value = false
  }
}

function startAddLesson() {
  editingLessonId.value = 'new'
  lessonTitle.value = ''
  lessonSummary.value = ''
  lessonDurationSeconds.value = 0
  lessonSortOrder.value = selectedCourse.value?.lessons.length ?? 0
  lessonBunnyVideoId.value = ''
  showUploader.value = false
}

function startEditLesson(lesson: Lesson) {
  editingLessonId.value = lesson.id
  lessonTitle.value = lesson.title
  lessonSummary.value = lesson.summary
  lessonDurationSeconds.value = lesson.durationSeconds
  lessonSortOrder.value = lesson.sortOrder
  lessonBunnyVideoId.value = lesson.bunnyVideoId
  showUploader.value = false
}

function cancelLesson() {
  editingLessonId.value = null
  showUploader.value = false
}

function onVideoUploaded(videoId: string, duration: number, title: string) {
  lessonBunnyVideoId.value = normalizeBunnyVideoId(videoId)
  if (!lessonTitle.value) lessonTitle.value = title
  lessonDurationSeconds.value = duration
  showUploader.value = false
}

async function saveLesson() {
  if (!selectedCourseId.value || !lessonTitle.value.trim()) return
  const normalizedVideoId = normalizeBunnyVideoId(lessonBunnyVideoId.value)
  if (!normalizedVideoId) {
    publishError.value = '請先上傳影片，或填入 Bunny Video ID 才能儲存。'
    return
  }
  publishSaving.value = true
  publishError.value = ''
  try {
    await catalog.upsertLesson({
      id: editingLessonId.value === 'new' ? undefined : editingLessonId.value ?? undefined,
      courseId: selectedCourseId.value,
      title: lessonTitle.value,
      summary: lessonSummary.value,
      durationSeconds: lessonDurationSeconds.value,
      sortOrder: lessonSortOrder.value,
      bunnyVideoId: normalizedVideoId,
      coverUrl: '',
    })
    await catalog.fetchCourses()
    const course = catalog.courses.find((item) => item.id === selectedCourseId.value)
    if (course) chooseCourse(course)
    publishPanelOpen.value = true
    editingLessonId.value = null
  } catch (err) {
    publishError.value = err instanceof Error ? err.message : '儲存影片失敗'
  } finally {
    publishSaving.value = false
  }
}

async function removeLesson(lessonId: string) {
  if (!selectedCourseId.value || !confirm('確定刪除此影片？')) return
  await catalog.deleteLesson(lessonId, selectedCourseId.value)
}

function addActor() {
  scriptForm.actors.push({ name: '', role: '', note: '' })
}

function removeActor(index: number) {
  scriptForm.actors.splice(index, 1)
}

async function createLesson(courseId: string) {
  const { data, error } = await supabase
    .from('lessons')
    .insert({
      course_id: courseId,
      title: courseForm.title.trim(),
      summary: courseForm.outline.trim(),
      duration_seconds: 0,
      sort_order: selectedCourse.value?.lessons.length ?? 0,
      video_provider: 'bunny',
      bunny_video_id: '',
      cover_url: '',
    })
    .select()
    .single()

  if (error) throw error
  return data.id as string
}

async function saveProduction() {
  if (!canEdit.value || !selectedCategoryId.value || !courseForm.title.trim()) return
  saving.value = true
  errorText.value = ''
  try {
    const courseId = await catalog.upsertCourse({
      id: selectedCourseId.value ?? undefined,
      title: courseForm.title,
      categoryId: selectedCategoryId.value,
      description: courseForm.outline,
      enabled: true,
      coverUrl: selectedCourse.value?.coverUrl ?? '',
      portalSections: selectedCourse.value?.portalSections ?? [],
    })

    let lessonId = selectedLessonId.value
    if (lessonId) {
      await catalog.upsertLesson({
        id: lessonId,
        courseId,
        title: courseForm.title,
        summary: courseForm.outline,
        durationSeconds: selectedLesson.value?.durationSeconds ?? 0,
        sortOrder: selectedLesson.value?.sortOrder ?? 0,
        provider: 'bunny',
        bunnyVideoId: selectedLesson.value?.bunnyVideoId ?? '',
        coverUrl: selectedLesson.value?.coverUrl ?? '',
      })
    } else {
      lessonId = await createLesson(courseId)
    }

    if (!scriptForm.videoFileName.trim()) generateFileName()

    const existingScript = scripts.value.find((script) => script.lessonId === lessonId)
    const scriptId = scriptForm.id || existingScript?.id
    const payload = {
      course_id: courseId,
      lesson_id: lessonId,
      topic: courseForm.title.trim(),
      learning_item: courseForm.outline.trim(),
      script_body: scriptForm.scriptBody.trim(),
      actors: scriptForm.actors
        .map((actor) => ({
          name: actor.name.trim(),
          role: actor.role.trim(),
          note: actor.note.trim(),
        }))
        .filter((actor) => actor.name || actor.role || actor.note),
      shooting_completed: scriptForm.shootingCompleted,
      video_file_name: scriptForm.videoFileName.trim(),
      sequence_no: Number(scriptForm.sequenceNo) || nextSequenceNo(),
      notes: scriptForm.notes.trim(),
      updated_by: auth.currentUser?.id ?? null,
    }

    if (scriptId) {
      const { error } = await supabase.from('lesson_scripts').update(payload).eq('id', scriptId)
      if (error) throw error
    } else {
      const { error } = await supabase
        .from('lesson_scripts')
        .insert({ ...payload, created_by: auth.currentUser?.id ?? null })
      if (error) throw error
    }

    await Promise.all([catalog.fetchCourses(), fetchScripts()])
    selectedCourseId.value = courseId
    selectedLessonId.value = lessonId
    const course = catalog.courses.find((item) => item.id === courseId)
    if (course) chooseCourse(course)
  } catch (err) {
    errorText.value = err instanceof Error ? err.message : '儲存課程腳本失敗'
  } finally {
    saving.value = false
  }
}

function formatDate(value?: string) {
  if (!value) return '尚未儲存'
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
    <section class="script-flow-hero">
      <div>
        <span class="script-kicker">Teaching Production Flow</span>
        <h2>腳本設計工作台</h2>
        <p>先選主題，再整理該主題底下的課程，最後編輯課程題目、大綱、腳本、演員與影片流水檔名。</p>
      </div>
      <div class="flow-steps">
        <span :class="{ 'is-active': !selectedCategoryId }">1 主題</span>
        <span :class="{ 'is-active': selectedCategoryId && !selectedCourseId && !courseForm.title }">2 課程</span>
        <span :class="{ 'is-active': selectedCategoryId && (selectedCourseId || courseForm.title) }">3 腳本</span>
      </div>
    </section>

    <section v-if="errorText" class="panel-card script-error">{{ errorText }}</section>

    <section class="script-topic-board">
      <div class="topic-board__head">
        <div>
          <h3>課程主題</h3>
          <p>這裡會列出目前課程架構的主題。新增主題後，就能在主題底下新增課程。</p>
        </div>
        <form v-if="canEdit" class="topic-add" @submit.prevent="addTopic">
          <input v-model="newTopicName" class="form-input" placeholder="新增主題，例如：門市設備教學" />
          <button class="btn btn--primary" type="submit" :disabled="saving || !newTopicName.trim()">新增主題</button>
        </form>
      </div>

      <div v-if="loading" class="empty-state">讀取課程架構中…</div>
      <div v-else class="topic-grid">
        <article
          v-for="category in categories"
          :key="category.id"
          class="topic-card"
          :class="{ 'is-active': selectedCategoryId === category.id }"
        >
          <form v-if="editingTopicId === category.id" class="topic-edit-form" @submit.prevent="saveTopic">
            <input v-model="topicNameInput" class="form-input" required />
            <div class="topic-edit-form__row">
              <input v-model.number="topicSortOrderInput" class="form-input" type="number" min="0" aria-label="排序" />
              <label class="mini-toggle">
                <input v-model="topicEnabledInput" type="checkbox" />
                啟用
              </label>
            </div>
            <div class="topic-actions">
              <button class="table-action" type="submit" :disabled="saving">儲存</button>
              <button class="table-action" type="button" @click="cancelTopicEdit">取消</button>
            </div>
          </form>
          <template v-else>
            <button class="topic-card__main" type="button" @click="chooseTopic(category)">
              <strong>{{ category.name }}</strong>
              <span>{{ topicCourseCount(category.id) }} 門課程</span>
            </button>
            <div v-if="canEdit" class="topic-actions">
              <button class="table-action" type="button" @click="startEditTopic(category)">編輯</button>
              <button class="table-action table-action--danger" type="button" @click="removeTopic(category)">刪除</button>
            </div>
          </template>
        </article>
      </div>
    </section>

    <section v-if="selectedCategory" class="topic-detail">
      <aside class="course-column">
        <div class="course-column__head">
          <div>
            <span>目前主題</span>
            <h3>{{ selectedCategory.name }}</h3>
          </div>
          <button v-if="canEdit" class="btn btn--primary" type="button" @click="startNewCourse">新增課程</button>
        </div>

        <div class="topic-stats">
          <div><strong>{{ stats.totalCourses }}</strong><span>課程</span></div>
          <div><strong>{{ stats.scriptedCourses }}</strong><span>已編腳本</span></div>
          <div><strong>{{ stats.pending }}</strong><span>待拍攝</span></div>
        </div>

        <input v-model="courseSearch" class="form-input" placeholder="搜尋此主題課程" />

        <div v-if="coursesInTopic.length === 0" class="empty-state">
          此主題尚無課程，請先新增第一門課程。
        </div>

        <div v-else class="course-list">
          <button
            v-for="course in coursesInTopic"
            :key="course.id"
            class="course-item"
            :class="{ 'is-active': selectedCourseId === course.id }"
            type="button"
            @click="chooseCourse(course)"
          >
            <div>
              <strong>{{ course.title }}</strong>
              <span>{{ course.description || course.lessons[0]?.summary || '尚未填寫課程大綱' }}</span>
            </div>
            <div class="course-item__meta">
              <span :class="hasVideo(course) ? 'status-dot is-done' : 'status-dot'">{{ courseVideoLabel(course) }}</span>
              <small>{{ scriptsForCourse(course.id)[0]?.videoFileName || '尚未產生流水號' }}</small>
            </div>
          </button>
        </div>
      </aside>

      <section class="script-editor-panel">
        <form class="script-main-form" @submit.prevent="saveProduction">
          <div class="editor-title-row">
            <div>
              <span>課程腳本</span>
              <h3>{{ selectedCourseId ? '編輯課程與腳本' : '新增此主題的課程' }}</h3>
            </div>
            <div class="editor-title-actions">
              <span class="save-state">最後更新：{{ formatDate(selectedScript?.updatedAt) }}</span>
              <button
                class="btn"
                type="button"
                :disabled="!selectedCourse"
                @click="openPublishPanel"
              >
                發布設定與影片
              </button>
            </div>
          </div>

          <div class="editor-grid">
          <label class="form-label">課程題目 *
            <input
              v-model="courseForm.title"
              class="form-input"
              :disabled="!canEdit"
              required
              placeholder="例如：印表機安裝設定教學"
              @blur="generateFileName"
            />
          </label>

          <label v-if="selectedCourse?.lessons.length" class="form-label">影片章節
            <select v-model="selectedLessonId" class="form-input" :disabled="!canEdit" @change="onLessonChanged">
              <option v-for="lesson in selectedCourse.lessons" :key="lesson.id" :value="lesson.id">
                {{ lesson.sortOrder + 1 }}. {{ lesson.title }}
              </option>
            </select>
          </label>
        </div>

        <label class="form-label">課程內容大綱
          <textarea
            v-model="courseForm.outline"
            class="form-input outline-textarea"
            :disabled="!canEdit"
            placeholder="寫給拍攝者與講師看的內容重點，例如：本堂課要完成的操作、判斷標準、常見錯誤。"
          />
        </label>

        <section class="filename-panel">
          <div>
            <span>影片流水編號</span>
            <strong>{{ String(scriptForm.sequenceNo || nextSequenceNo()).padStart(4, '0') }}</strong>
          </div>
          <label class="form-label">本機影片檔名
            <div class="input-with-button">
              <input v-model="scriptForm.videoFileName" class="form-input" :disabled="!canEdit" />
              <button class="btn" type="button" :disabled="!canEdit" @click="generateFileName">重新產生</button>
            </div>
          </label>
          <label class="shoot-toggle">
            <input v-model="scriptForm.shootingCompleted" type="checkbox" :disabled="!canEdit" />
            <span>{{ scriptForm.shootingCompleted ? '影片已拍攝完成' : '影片尚未拍攝' }}</span>
          </label>
        </section>

        <div class="script-toolbar">
          <button class="btn" type="button" :disabled="!canEdit" @click="generateDraft">產生腳本草稿</button>
          <button class="btn" type="button" :disabled="!canEdit" @click="addActor">新增演員</button>
        </div>

        <label class="form-label">腳本
          <textarea
            v-model="scriptForm.scriptBody"
            class="form-input script-textarea"
            :disabled="!canEdit"
            placeholder="在這裡撰寫完整拍攝腳本。可先按「產生腳本草稿」，再依實際拍攝情境調整。"
          />
        </label>

        <section class="actor-panel">
          <div class="actor-panel__head">
            <strong>演員 / 出鏡人員</strong>
            <span>{{ scriptForm.actors.length }} 人</span>
          </div>
          <div v-if="scriptForm.actors.length === 0" class="empty-state empty-state--compact">
            尚未安排演員，按「新增演員」即可加入姓名、角色與備註。
          </div>
          <div v-for="(actor, index) in scriptForm.actors" :key="index" class="actor-row">
            <input v-model="actor.name" class="form-input" :disabled="!canEdit" placeholder="姓名" />
            <input v-model="actor.role" class="form-input" :disabled="!canEdit" placeholder="角色 / 職責" />
            <input v-model="actor.note" class="form-input" :disabled="!canEdit" placeholder="備註" />
            <button class="table-action table-action--danger" type="button" :disabled="!canEdit" @click="removeActor(index)">移除</button>
          </div>
        </section>

        <label class="form-label">製作備註
          <textarea v-model="scriptForm.notes" class="form-input" rows="3" :disabled="!canEdit" placeholder="拍攝場地、道具、補拍事項..." />
        </label>

        <div class="form-actions">
          <button class="btn btn--primary" type="submit" :disabled="!canEdit || saving || !courseForm.title.trim()">
            {{ saving ? '儲存中…' : '儲存課程腳本' }}
          </button>
        </div>
        </form>

        <section v-if="publishPanelOpen && selectedCourse" class="publish-panel">
          <div class="publish-panel__head">
            <div>
              <span class="script-kicker">Publish & Video</span>
              <h3>發布設定與影片章節</h3>
            </div>
            <button class="btn" type="button" @click="publishPanelOpen = false">收起</button>
          </div>

          <p v-if="publishError" class="script-error">{{ publishError }}</p>

          <form class="publish-form" @submit.prevent="savePublishSettings">
            <div class="publish-grid">
              <div class="form-label">學習入口方塊
                <div class="portal-section-checks">
                  <label v-for="section in PORTAL_SECTIONS" :key="section.id" class="section-check">
                    <input v-model="coursePortalSections" type="checkbox" :value="section.id" :disabled="!canEdit" />
                    {{ section.label }}
                  </label>
                </div>
              </div>

              <div class="form-label">封面圖
                <div class="cover-picker">
                  <img v-if="coverPreview" :src="coverPreview" alt="封面預覽" />
                  <span v-else>無封面</span>
                  <label class="btn">
                    {{ coverUploading ? '上傳中...' : '選取圖片' }}
                    <input type="file" accept="image/*" :disabled="coverUploading || !canEdit" @change="onCoverFileChange" />
                  </label>
                  <button v-if="coverPreview" class="btn" type="button" :disabled="!canEdit" @click="coverPreview = ''; coverFile = null">移除</button>
                </div>
              </div>

              <label class="form-label">適用對象
                <select v-model="courseAudienceType" class="form-input" :disabled="!canEdit">
                  <option value="all">全體</option>
                  <option value="org">指定組織</option>
                  <option value="role">指定角色</option>
                </select>
              </label>

              <label v-if="courseAudienceType === 'org'" class="form-label">選擇組織
                <select v-model="courseAudienceId" class="form-input" :disabled="!canEdit">
                  <option :value="null">請選擇</option>
                  <option v-for="org in catalog.organizations" :key="org.id" :value="org.id">{{ org.shortName }}</option>
                </select>
              </label>

              <label v-if="courseAudienceType === 'role'" class="form-label">選擇角色
                <select v-model="courseAudienceId" class="form-input" :disabled="!canEdit">
                  <option :value="null">請選擇</option>
                  <option v-for="role in catalog.allRoles" :key="role.id" :value="role.id">{{ role.title }}</option>
                </select>
              </label>

              <label class="shoot-toggle publish-toggle">
                <input v-model="courseEnabled" type="checkbox" :disabled="!canEdit" />
                <span>{{ courseEnabled ? '課程上架中' : '課程目前下架' }}</span>
              </label>
            </div>

            <div class="form-actions">
              <button class="btn btn--primary" type="submit" :disabled="!canEdit || publishSaving">
                {{ publishSaving ? '儲存中…' : '儲存發布設定' }}
              </button>
            </div>
          </form>

          <section class="lesson-panel">
            <div class="actor-panel__head">
              <strong>影片章節（{{ selectedCourse.lessons.length }} 支）</strong>
              <button v-if="canEdit && editingLessonId === null" class="btn btn--primary" type="button" @click="startAddLesson">新增影片</button>
            </div>

            <form v-if="editingLessonId !== null" class="lesson-form" @submit.prevent="saveLesson">
              <label class="form-label">影片標題 *
                <input v-model="lessonTitle" class="form-input" required />
              </label>
              <label class="form-label">摘要說明
                <textarea v-model="lessonSummary" class="form-input" rows="2" />
              </label>
              <label class="form-label">Bunny Video ID
                <div class="input-with-button">
                  <input v-model="lessonBunnyVideoId" class="form-input" placeholder="上傳後自動填入，或手動貼上" />
                  <button class="btn" type="button" @click="showUploader = !showUploader">
                    {{ showUploader ? '收起' : '上傳影片' }}
                  </button>
                </div>
              </label>

              <VideoUploader v-if="showUploader && selectedCourseId" :course-id="selectedCourseId" :on-uploaded="onVideoUploaded" />

              <div class="editor-grid">
                <label class="form-label">時長（秒）
                  <input v-model.number="lessonDurationSeconds" class="form-input" type="number" min="0" />
                </label>
                <label class="form-label">排序
                  <input v-model.number="lessonSortOrder" class="form-input" type="number" min="0" />
                </label>
              </div>

              <div class="form-actions">
                <button class="btn btn--primary" type="submit" :disabled="publishSaving">儲存影片</button>
                <button class="btn" type="button" @click="cancelLesson">取消</button>
              </div>
            </form>

            <div class="lesson-list">
              <div v-if="selectedCourse.lessons.length === 0" class="empty-state empty-state--compact">
                尚無影片，按「新增影片」即可上傳或填入 Bunny Video ID。
              </div>
              <div v-for="lesson in selectedCourse.lessons" :key="lesson.id" class="lesson-row">
                <div>
                  <strong>{{ lesson.sortOrder }}. {{ lesson.title }}</strong>
                  <span>{{ lesson.summary || '尚未填寫摘要' }}</span>
                </div>
                <div class="lesson-row__meta">
                  <span>{{ Math.floor(lesson.durationSeconds / 60) }}:{{ String(lesson.durationSeconds % 60).padStart(2, '0') }}</span>
                  <small>{{ lesson.bunnyVideoId || '尚未綁定影片' }}</small>
                </div>
                <div v-if="canEdit" class="topic-actions">
                  <button class="table-action" type="button" @click="startEditLesson(lesson)">編輯</button>
                  <button class="table-action table-action--danger" type="button" @click="removeLesson(lesson.id)">刪除</button>
                </div>
              </div>
            </div>
          </section>
        </section>
      </section>
    </section>
  </div>
</template>

<style scoped>
.script-page {
  gap: 1rem;
}

.script-flow-hero,
.script-topic-board,
.course-column,
.script-editor-panel {
  border: 1px solid var(--admin-border);
  border-radius: 1.1rem;
  background: color-mix(in srgb, var(--admin-surface-raised) 94%, transparent);
  box-shadow: var(--admin-shadow);
}

.script-flow-hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1.25rem;
  background:
    linear-gradient(135deg, rgba(15, 118, 110, 0.14), transparent 46%),
    color-mix(in srgb, var(--admin-surface-raised) 94%, transparent);
}

.script-kicker,
.course-column__head span,
.editor-title-row span,
.filename-panel span {
  color: var(--admin-primary);
  font-size: 0.78rem;
  font-weight: 800;
}

.script-flow-hero h2,
.script-topic-board h3,
.course-column h3,
.script-editor-panel h3 {
  margin: 0;
}

.script-flow-hero p,
.topic-board__head p,
.course-item span,
.save-state {
  color: var(--admin-ink-muted);
}

.script-flow-hero p {
  margin: 0.45rem 0 0;
}

.flow-steps {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.flow-steps span {
  padding: 0.45rem 0.75rem;
  border: 1px solid var(--admin-border);
  border-radius: 999px;
  background: var(--admin-surface);
  color: var(--admin-ink-muted);
  font-weight: 800;
}

.flow-steps .is-active {
  border-color: rgba(var(--admin-primary-rgb), 0.42);
  background: var(--admin-primary-soft);
  color: var(--admin-primary);
}

.script-error {
  color: var(--admin-danger);
}

.script-topic-board {
  display: grid;
  gap: 1rem;
  padding: 1.15rem;
}

.topic-board__head,
.course-column__head,
.editor-title-row,
.editor-title-actions,
.script-toolbar,
.actor-panel__head,
.input-with-button,
.actor-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.topic-board__head,
.course-column__head,
.editor-title-row,
.actor-panel__head {
  justify-content: space-between;
}

.topic-add {
  display: grid;
  grid-template-columns: minmax(14rem, 1fr) auto;
  gap: 0.65rem;
  min-width: min(30rem, 100%);
}

.topic-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(12rem, 1fr));
  gap: 0.75rem;
}

.topic-card__main,
.course-item {
  width: 100%;
  border: 1px solid var(--admin-border);
  background: var(--admin-surface);
  color: inherit;
  text-align: left;
  transition: 160ms ease;
}

.topic-card {
  display: grid;
  gap: 0.4rem;
  min-height: 5.6rem;
  padding: 0.8rem;
  border: 1px solid var(--admin-border);
  border-radius: 1rem;
  background: var(--admin-surface);
  transition: 160ms ease;
}

.topic-card__main {
  display: grid;
  gap: 0.4rem;
  padding: 0.2rem;
  border: 0;
  border-radius: 0.7rem;
  background: transparent;
}

.topic-card span,
.topic-card__main span {
  color: var(--admin-ink-muted);
  font-size: 0.82rem;
}

.topic-card:hover,
.topic-card.is-active,
.topic-card__main:hover,
.course-item:hover,
.course-item.is-active {
  border-color: rgba(var(--admin-primary-rgb), 0.46);
  background: var(--admin-primary-soft);
  transform: translateY(-1px);
}

.topic-edit-form,
.script-main-form,
.publish-form,
.lesson-form {
  display: grid;
  gap: 1rem;
}

.topic-edit-form__row,
.topic-actions {
  display: flex;
  align-items: center;
  gap: 0.55rem;
}

.topic-actions {
  justify-content: flex-end;
  flex-wrap: wrap;
}

.mini-toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  white-space: nowrap;
  color: var(--admin-ink-muted);
  font-size: 0.82rem;
  font-weight: 800;
}

.topic-detail {
  display: grid;
  grid-template-columns: minmax(17rem, 0.55fr) minmax(0, 1.45fr);
  gap: 1rem;
  align-items: start;
}

.course-column,
.script-editor-panel {
  min-width: 0;
  padding: 1rem;
}

.topic-stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.6rem;
  margin: 1rem 0;
}

.topic-stats div,
.filename-panel {
  border: 1px solid var(--admin-border);
  border-radius: 0.9rem;
  background: var(--admin-surface);
}

.topic-stats div {
  padding: 0.75rem;
}

.topic-stats strong,
.topic-stats span {
  display: block;
}

.topic-stats strong {
  font-size: 1.45rem;
}

.topic-stats span {
  color: var(--admin-ink-muted);
  font-size: 0.76rem;
}

.course-list {
  display: grid;
  gap: 0.7rem;
  margin-top: 0.85rem;
  max-height: 44rem;
  overflow: auto;
}

.course-item {
  display: grid;
  gap: 0.75rem;
  padding: 0.9rem;
  border-radius: 0.95rem;
}

.course-item strong,
.course-item span,
.course-item small {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.course-item__meta {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
}

.status-dot {
  width: fit-content;
  padding: 0.24rem 0.6rem;
  border-radius: 999px;
  background: rgba(217, 119, 6, 0.13);
  color: var(--admin-warning);
  font-size: 0.76rem;
  font-weight: 800;
}

.status-dot.is-done {
  background: rgba(107, 142, 35, 0.14);
  color: var(--admin-success);
}

.editor-title-row {
  margin-bottom: 1rem;
}

.editor-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
}

.script-editor-panel .form-label {
  display: grid;
  gap: 0.45rem;
  width: 100%;
}

.script-editor-panel .form-input {
  width: 100%;
}

.outline-textarea {
  min-height: 7rem;
  line-height: 1.65;
  resize: vertical;
}

.filename-panel {
  display: grid;
  grid-template-columns: minmax(8rem, 0.22fr) minmax(0, 1fr) auto;
  gap: 0.85rem;
  align-items: end;
  padding: 0.9rem;
}

.filename-panel strong {
  display: block;
  margin-top: 0.15rem;
  font-size: 1.75rem;
}

.input-with-button .form-input {
  flex: 1;
}

.shoot-toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  color: var(--admin-ink-muted);
  font-weight: 800;
}

.shoot-toggle input {
  accent-color: var(--admin-primary);
}

.script-toolbar {
  justify-content: flex-end;
  flex-wrap: wrap;
}

.script-textarea {
  min-height: clamp(34rem, 62vh, 46rem);
  line-height: 1.72;
  resize: vertical;
}

.actor-panel {
  display: grid;
  gap: 0.75rem;
  padding: 1rem;
  border: 1px solid var(--admin-border);
  border-radius: 1rem;
  background: var(--admin-surface);
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

.table-action--danger {
  color: var(--admin-danger);
}

.publish-panel {
  display: grid;
  gap: 1rem;
  margin-top: 1.2rem;
  padding-top: 1.2rem;
  border-top: 1px solid var(--admin-border);
}

.publish-panel__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.publish-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
}

.portal-section-checks {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.section-check {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.42rem 0.6rem;
  border: 1px solid var(--admin-border);
  border-radius: 0.7rem;
  background: var(--admin-surface);
  color: var(--admin-ink-muted);
  font-size: 0.84rem;
  font-weight: 800;
}

.section-check input,
.mini-toggle input {
  accent-color: var(--admin-primary);
}

.cover-picker {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.cover-picker img,
.cover-picker > span {
  width: 7.5rem;
  aspect-ratio: 16 / 10;
  border: 1px solid var(--admin-border);
  border-radius: 0.7rem;
}

.cover-picker img {
  object-fit: cover;
}

.cover-picker > span {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--admin-ink-muted);
  background: var(--admin-surface);
  font-size: 0.82rem;
}

.cover-picker input[type='file'] {
  display: none;
}

.publish-toggle {
  align-self: end;
}

.lesson-panel {
  display: grid;
  gap: 0.85rem;
  padding: 1rem;
  border: 1px solid var(--admin-border);
  border-radius: 1rem;
  background: var(--admin-surface);
}

.lesson-form {
  padding: 1rem;
  border: 1px solid var(--admin-border);
  border-radius: 0.9rem;
  background: color-mix(in srgb, var(--admin-surface-raised) 80%, transparent);
}

.lesson-list {
  display: grid;
  gap: 0.65rem;
}

.lesson-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(9rem, auto) auto;
  gap: 0.75rem;
  align-items: center;
  padding: 0.8rem;
  border: 1px solid var(--admin-border);
  border-radius: 0.85rem;
  background: color-mix(in srgb, var(--admin-surface-raised) 70%, transparent);
}

.lesson-row strong,
.lesson-row span,
.lesson-row small {
  display: block;
}

.lesson-row span,
.lesson-row small {
  color: var(--admin-ink-muted);
}

.lesson-row__meta {
  text-align: right;
  min-width: 0;
}

@media (max-width: 1120px) {
  .script-flow-hero,
  .topic-board__head,
  .topic-detail,
  .publish-grid,
  .lesson-row {
    grid-template-columns: 1fr;
  }

  .script-flow-hero,
  .topic-board__head {
    display: grid;
  }

  .filename-panel {
    grid-template-columns: 1fr;
  }

  .lesson-row__meta {
    text-align: left;
  }
}

@media (max-width: 767px) {
  .topic-add,
  .topic-stats,
  .editor-grid {
    grid-template-columns: 1fr;
  }

  .course-item__meta,
  .actor-row,
  .input-with-button,
  .editor-title-row,
  .editor-title-actions,
  .publish-panel__head {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
