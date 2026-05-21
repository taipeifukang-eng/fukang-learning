<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import VideoUploader from '../components/VideoUploader.vue'
import { useAuthStore } from '../stores/auth'
import { useCatalogStore } from '../stores/catalog'
import { supabase } from '../lib/supabase'
import type { Course, Lesson } from '../data/mockData'

const auth = useAuthStore()
const catalog = useCatalogStore()

const canEdit = computed(() => auth.hasPermission('courses:edit'))
const saving = ref(false)
const saveError = ref('')
const deleting = ref<string | null>(null)

// 學習入口方塊定義（與 LearningHomeView 同步）
const PORTAL_SECTIONS = [
  { id: 'store-newcomer',      label: '🌱 門市－新人培訓' },
  { id: 'store-supervisor',    label: '👔 門市－主管課程' },
  { id: 'store-general',       label: '📚 門市－通識學習' },
  { id: 'pharmacist-newcomer', label: '🌱 藥師－新進藥師' },
  { id: 'pharmacist-clinical', label: '🔬 藥師－藥學專業' },
  { id: 'pharmacist-law',      label: '📜 藥師－法規合規' },
  { id: 'pharmacist-general',  label: '📚 藥師－通識學習' },
  { id: 'hq-general',          label: '🏢 總部－通識學習' },
] as const

const coursePortalSections = ref<string[]>([])

// ── 分類 Tab ─────────────────────────────────────────────────
type TabId = number | 'all' | 'uncategorized'
const activeTab = ref<TabId>('all')

const categoryTabs = computed(() => {
  const tabs: { id: TabId; label: string; count: number }[] = [
    { id: 'all', label: '全部', count: catalog.courses.length },
  ]
  for (const cat of catalog.categories) {
    tabs.push({
      id: cat.id,
      label: cat.name,
      count: catalog.courses.filter((c) => c.categoryId === cat.id).length,
    })
  }
  const uncatCount = catalog.courses.filter((c) => !c.categoryId).length
  if (uncatCount > 0) {
    tabs.push({ id: 'uncategorized', label: '未分類', count: uncatCount })
  }
  return tabs
})

const filteredCourses = computed(() => {
  if (activeTab.value === 'all') return catalog.courses
  if (activeTab.value === 'uncategorized') return catalog.courses.filter((c) => !c.categoryId)
  return catalog.courses.filter((c) => c.categoryId === activeTab.value)
})

// ── 課程編輯狀態 ─────────────────────────────────────────────
const editingCourseId = ref<string | null>(null)   // null=清單, 'new'=新增, uuid=編輯
const courseTitle = ref('')
const courseCategoryId = ref<number | null>(null)
const courseDescription = ref('')
const courseCoverUrl = ref('')
const coverFile = ref<File | null>(null)
const coverPreview = ref('')
const coverUploading = ref(false)
const courseEnabled = ref(true)
const courseAudienceType = ref<'all' | 'org' | 'role'>('all')
const courseAudienceId = ref<number | null>(null)

// ── 影片清單狀態 ─────────────────────────────────────────────
const editingLessonId = ref<string | null>(null)
const lessonTitle = ref('')
const lessonSummary = ref('')
const lessonDurationSeconds = ref(0)
const lessonSortOrder = ref(0)
const lessonBunnyVideoId = ref('')
const showUploader = ref(false)

function normalizeBunnyVideoId(input: string) {
  const value = input.trim()
  if (!value) return ''
  if (!value.includes('/')) return value

  // Accept pasted Bunny URLs and extract the final segment as videoId.
  const cleaned = value.split('?')[0].replace(/\/+$/, '')
  const parts = cleaned.split('/').filter(Boolean)
  return parts[parts.length - 1] ?? ''
}

onMounted(() => {
  catalog.fetchCourses()
  catalog.fetchCategories()
})

const activeCourse = computed<Course | undefined>(() =>
  catalog.courses.find((c) => c.id === editingCourseId.value),
)

// ── 課程操作 ─────────────────────────────────────────────────
function startAddCourse() {
  editingCourseId.value = 'new'
  courseTitle.value = ''
  // 若當前有選定分類 tab，自動帶入
  courseCategoryId.value = (activeTab.value !== 'all' && activeTab.value !== 'uncategorized')
    ? (activeTab.value as number)
    : null
  courseDescription.value = ''
  courseCoverUrl.value = ''
  coverFile.value = null
  coverPreview.value = ''
  courseEnabled.value = true
  courseAudienceType.value = 'all'
  courseAudienceId.value = null
  coursePortalSections.value = []
}

function startEditCourse(course: Course) {
  editingCourseId.value = course.id
  courseTitle.value = course.title
  courseCategoryId.value = course.categoryId
  courseDescription.value = course.description
  courseCoverUrl.value = course.coverUrl
  coverPreview.value = course.coverUrl
  coverFile.value = null
  courseEnabled.value = course.enabled
  // 取第一個 audience 規則顯示
  const aud = course.audiences[0]
  courseAudienceType.value = aud?.audienceType ?? 'all'
  courseAudienceId.value = aud?.audienceId ?? null
  coursePortalSections.value = [...(course.portalSections ?? [])]
}

function onCoverFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  coverFile.value = file
  coverPreview.value = URL.createObjectURL(file)
}

async function uploadCoverIfNeeded(): Promise<string> {
  if (!coverFile.value) return courseCoverUrl.value
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

function backToList() {
  editingCourseId.value = null
  editingLessonId.value = null
  showUploader.value = false
}

async function saveCourse() {
  if (!courseTitle.value.trim()) return
  saving.value = true
  saveError.value = ''
  try {
    // 封面上傳（失敗不阻擋儲存）
    let finalCoverUrl = courseCoverUrl.value
    if (coverFile.value) {
      try {
        finalCoverUrl = await uploadCoverIfNeeded()
        courseCoverUrl.value = finalCoverUrl
      } catch (uploadErr) {
        saveError.value = `封面圖上傳失敗：${uploadErr instanceof Error ? uploadErr.message : String(uploadErr)}。請先到 Supabase Dashboard 執行 patch_cover_storage.sql。`
      }
    }
    const id = await catalog.upsertCourse({
      id: editingCourseId.value === 'new' ? undefined : editingCourseId.value ?? undefined,
      title: courseTitle.value,
      categoryId: courseCategoryId.value,
      description: courseDescription.value,
      coverUrl: finalCoverUrl,
      enabled: courseEnabled.value,
      portalSections: coursePortalSections.value,
    })
    // 儲存學習對象
    if (id) {
      await catalog.saveCourseAudiences(id as string, courseAudienceType.value === 'all'
        ? [{ courseId: id as string, audienceType: 'all', audienceId: null }]
        : [{ courseId: id as string, audienceType: courseAudienceType.value, audienceId: courseAudienceId.value }],
      )
    }
    if (editingCourseId.value === 'new') {
      backToList()
    } else {
      editingCourseId.value = id as string
    }
  } finally {
    saving.value = false
  }
}

async function removeCourse(id: string) {
  if (!confirm('確定刪除此課程？所有影片與進度紀錄也會一併移除。')) return
  deleting.value = id
  try {
    await catalog.deleteCourse(id)
  } finally {
    deleting.value = null
  }
}

// ── 影片操作 ─────────────────────────────────────────────────
function startAddLesson() {
  editingLessonId.value = 'new'
  lessonTitle.value = ''
  lessonSummary.value = ''
  lessonDurationSeconds.value = 0
  lessonSortOrder.value = activeCourse.value?.lessons.length ?? 0
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
  if (!lessonTitle.value.trim() || !editingCourseId.value) return
  const normalizedVideoId = normalizeBunnyVideoId(lessonBunnyVideoId.value)
  if (!normalizedVideoId) {
    alert('請先上傳影片，或填入 Bunny Video ID 才能儲存。')
    return
  }
  saving.value = true
  try {
    await catalog.upsertLesson({
      id: editingLessonId.value === 'new' ? undefined : editingLessonId.value ?? undefined,
      courseId: editingCourseId.value,
      title: lessonTitle.value,
      summary: lessonSummary.value,
      durationSeconds: lessonDurationSeconds.value,
      sortOrder: lessonSortOrder.value,
      bunnyVideoId: normalizedVideoId,
      coverUrl: '',
    })
    lessonBunnyVideoId.value = normalizedVideoId
    editingLessonId.value = null
  } finally {
    saving.value = false
  }
}

async function removeLesson(lessonId: string) {
  if (!editingCourseId.value || !confirm('確定刪除此影片？')) return
  await catalog.deleteLesson(lessonId, editingCourseId.value)
}

function audienceLabel(course: Course) {
  const aud = course.audiences[0]
  if (!aud || aud.audienceType === 'all') return '全體'
  if (aud.audienceType === 'org') {
    const org = catalog.organizations.find((o) => o.id === aud.audienceId)
    return org?.shortName ?? `組織 #${aud.audienceId}`
  }
  const role = catalog.roles.find((r) => r.key === String(aud.audienceId))
  return role?.title ?? `角色 #${aud.audienceId}`
}
</script>

<template>
  <div class="page-stack">

    <!-- ── 課程清單 ─────────────────────────────────────────── -->
    <template v-if="editingCourseId === null">
      <div class="panel-card">
        <div class="panel-header">
          <h2>課程管理</h2>
          <button v-if="canEdit" class="btn btn--primary" type="button" @click="startAddCourse">+ 新增課程</button>
        </div>

        <!-- 分類 Tab Bar -->
        <div v-if="categoryTabs.length > 1" class="category-tabs" style="margin-bottom:1rem">
          <button
            v-for="tab in categoryTabs"
            :key="tab.id"
            class="category-tab"
            :class="{ 'is-active': activeTab === tab.id }"
            type="button"
            @click="activeTab = tab.id"
          >
            {{ tab.label }}
            <span class="category-tab__count">{{ tab.count }}</span>
          </button>
        </div>

        <table class="data-table">
          <thead>
            <tr>
              <th>課程名稱</th>
              <th>分類</th>
              <th>適用對象</th>
              <th>影片數</th>
              <th>狀態</th>
              <th v-if="canEdit">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="catalog.isLoading">
              <td colspan="6" class="muted-text" style="text-align:center;padding:2rem">載入中…</td>
            </tr>
            <tr v-else-if="filteredCourses.length === 0">
              <td colspan="6" class="muted-text" style="text-align:center;padding:2rem">此分類尚無課程</td>
            </tr>
            <tr v-for="course in filteredCourses" :key="course.id">
              <td>{{ course.title }}</td>
              <td>{{ course.categoryName || '—' }}</td>
              <td>{{ audienceLabel(course) }}</td>
              <td>{{ course.lessons.length }} 支</td>
              <td>
                <span :class="course.enabled ? 'status-badge status-badge--active' : 'status-badge status-badge--inactive'">
                  {{ course.enabled ? '上架' : '下架' }}
                </span>
              </td>
              <td v-if="canEdit">
                <button class="table-action" type="button" @click="startEditCourse(course)">編輯</button>
                <button class="table-action" type="button" @click="catalog.toggleCourseStatus(course.id, !course.enabled)">
                  {{ course.enabled ? '下架' : '上架' }}
                </button>
                <button class="table-action table-action--danger" type="button" :disabled="deleting === course.id" @click="removeCourse(course.id)">刪除</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>

    <!-- ── 新增課程表單 ──────────────────────────────────────── -->
    <template v-else-if="editingCourseId === 'new'">
      <div class="panel-card">
        <div class="panel-header">
          <h2>新增課程</h2>
          <button class="btn" type="button" @click="backToList">← 返回</button>
        </div>
        <form class="form-stack" @submit.prevent="saveCourse">
          <label class="form-label">課程標題 *
            <input v-model="courseTitle" class="form-input" required />
          </label>
          <label class="form-label">分類
            <select v-model="courseCategoryId" class="form-input">
              <option :value="null">— 無分類 —</option>
              <option v-for="cat in catalog.categories" :key="cat.id" :value="cat.id">{{ cat.name }}</option>
            </select>
          </label>
          <div class="form-label">學習入口方塊（可彈選多個）
            <div class="portal-section-checks">
              <label v-for="s in PORTAL_SECTIONS" :key="s.id" class="section-check">
                <input type="checkbox" :value="s.id" v-model="coursePortalSections" />
                {{ s.label }}
              </label>
            </div>
          </div>
          <label class="form-label">說明
            <textarea v-model="courseDescription" class="form-input" rows="3" />
          </label>
          <div class="form-label">封面圖
            <div style="display:flex;align-items:center;gap:.75rem;margin-top:.25rem">
              <img v-if="coverPreview" :src="coverPreview" alt="封面預覽" style="width:80px;height:56px;object-fit:cover;border-radius:6px;border:1px solid #444" />
              <span v-else style="display:inline-flex;align-items:center;justify-content:center;width:80px;height:56px;border-radius:6px;border:1px dashed #555;color:#888;font-size:.75rem">無封面</span>
              <label class="btn" style="cursor:pointer;margin:0">
                {{ coverUploading ? '上傳中...' : '選取圖片' }}
                <input type="file" accept="image/*" style="display:none" :disabled="coverUploading" @change="onCoverFileChange" />
              </label>
              <button v-if="coverPreview" class="btn" type="button" style="color:#e05" @click="coverPreview='';coverFile=null;courseCoverUrl=''">移除</button>
            </div>
          </div>
          <label class="form-label">適用對象
            <select v-model="courseAudienceType" class="form-input">
              <option value="all">全體</option>
              <option value="org">指定組織</option>
              <option value="role">指定角色</option>
            </select>
          </label>
          <label v-if="courseAudienceType === 'org'" class="form-label">選擇組織
            <select v-model="courseAudienceId" class="form-input">
              <option :value="null">— 請選擇 —</option>
              <option v-for="org in catalog.organizations" :key="org.id" :value="org.id">{{ org.shortName }}</option>
            </select>
          </label>
          <label v-if="courseAudienceType === 'role'" class="form-label">選擇角色
            <select v-model="courseAudienceId" class="form-input">
              <option :value="null">— 請選擇 —</option>
              <option v-for="role in catalog.roles" :key="role.key" :value="role.key">{{ role.title }}</option>
            </select>
          </label>
          <label class="form-label">分類管理
            <RouterLink class="hint-link" to="/admin/categories">＋ 新增 / 編輯分類</RouterLink>
          </label>
          <label class="toggle-label">
            <input v-model="courseEnabled" type="checkbox" />
            立即上架
          </label>
          <div class="form-actions">
            <button class="btn btn--primary" type="submit" :disabled="saving">儲存課程</button>
            <button class="btn" type="button" @click="backToList">取消</button>
          </div>
        </form>

                <p v-if="saveError" class="error-text" style="margin-top:.5rem">{{ saveError }}</p>
      </div>
    </template>

    <!-- ── 編輯課程 + 影片清單 ──────────────────────────────── -->
    <template v-else-if="activeCourse">
      <div class="panel-card">
        <div class="panel-header">
          <h2>編輯課程：{{ activeCourse.title }}</h2>
          <button class="btn" type="button" @click="backToList">← 返回清單</button>
        </div>

        <!-- 基本資訊 -->
        <form class="form-stack" @submit.prevent="saveCourse">
          <label class="form-label">課程標題 *
            <input v-model="courseTitle" class="form-input" required />
          </label>
          <label class="form-label">分類
            <select v-model="courseCategoryId" class="form-input">
              <option :value="null">— 無分類 —</option>
              <option v-for="cat in catalog.categories" :key="cat.id" :value="cat.id">{{ cat.name }}</option>
            </select>
          </label>
          <div class="form-label">學習入口方塊（可彈選多個）
            <div class="portal-section-checks">
              <label v-for="s in PORTAL_SECTIONS" :key="s.id" class="section-check">
                <input type="checkbox" :value="s.id" v-model="coursePortalSections" />
                {{ s.label }}
              </label>
            </div>
          </div>
          <label class="form-label">說明
            <textarea v-model="courseDescription" class="form-input" rows="3" />
          </label>
          <div class="form-label">封面圖
            <div style="display:flex;align-items:center;gap:.75rem;margin-top:.25rem">
              <img v-if="coverPreview" :src="coverPreview" alt="封面預覽" style="width:80px;height:56px;object-fit:cover;border-radius:6px;border:1px solid #444" />
              <span v-else style="display:inline-flex;align-items:center;justify-content:center;width:80px;height:56px;border-radius:6px;border:1px dashed #555;color:#888;font-size:.75rem">無封面</span>
              <label class="btn" style="cursor:pointer;margin:0">
                {{ coverUploading ? '上傳中...' : '選取圖片' }}
                <input type="file" accept="image/*" style="display:none" :disabled="coverUploading" @change="onCoverFileChange" />
              </label>
              <button v-if="coverPreview" class="btn" type="button" style="color:#e05" @click="coverPreview='';coverFile=null;courseCoverUrl=''">移除</button>
            </div>
          </div>
          <label class="form-label">適用對象
            <select v-model="courseAudienceType" class="form-input">
              <option value="all">全體</option>
              <option value="org">指定組織</option>
              <option value="role">指定角色</option>
            </select>
          </label>
          <label v-if="courseAudienceType === 'org'" class="form-label">選擇組織
            <select v-model="courseAudienceId" class="form-input">
              <option :value="null">— 請選擇 —</option>
              <option v-for="org in catalog.organizations" :key="org.id" :value="org.id">{{ org.shortName }}</option>
            </select>
          </label>
          <label v-if="courseAudienceType === 'role'" class="form-label">選擇角色
            <select v-model="courseAudienceId" class="form-input">
              <option :value="null">— 請選擇 —</option>
              <option v-for="role in catalog.roles" :key="role.key" :value="role.key">{{ role.title }}</option>
            </select>
          </label>
          <label class="toggle-label">
            <input v-model="courseEnabled" type="checkbox" />
            上架中
          </label>
          <div class="form-actions">
            <button class="btn btn--primary" type="submit" :disabled="saving">儲存變更</button>

                    <p v-if="saveError" class="error-text" style="margin-top:.5rem">{{ saveError }}</p>
          </div>
        </form>
      </div>

      <!-- 影片清單 -->
      <div class="panel-card">
        <div class="panel-header">
          <h3>影片章節（{{ activeCourse.lessons.length }} 支）</h3>
          <button v-if="canEdit && editingLessonId === null" class="btn btn--primary" type="button" @click="startAddLesson">+ 新增影片</button>
        </div>

        <!-- 影片表單 -->
        <form v-if="editingLessonId !== null" class="form-stack" style="border-top:1px solid var(--border);padding-top:1rem;margin-top:1rem" @submit.prevent="saveLesson">
          <label class="form-label">影片標題 *
            <input v-model="lessonTitle" class="form-input" required />
          </label>
          <label class="form-label">摘要說明
            <textarea v-model="lessonSummary" class="form-input" rows="2" />
          </label>
          <label class="form-label">Bunny Video ID
            <div style="display:flex;gap:.5rem">
              <input v-model="lessonBunnyVideoId" class="form-input" placeholder="上傳後自動填入，或手動貼上" />
              <button class="btn" type="button" @click="showUploader = !showUploader">
                {{ showUploader ? '收起' : '上傳影片' }}
              </button>
            </div>
          </label>

          <VideoUploader v-if="showUploader" :course-id="editingCourseId!" :on-uploaded="onVideoUploaded" />

          <div style="display:flex;gap:1rem">
            <label class="form-label" style="flex:1">時長（秒）
              <input v-model.number="lessonDurationSeconds" class="form-input" type="number" min="0" />
            </label>
            <label class="form-label" style="flex:1">排序
              <input v-model.number="lessonSortOrder" class="form-input" type="number" min="0" />
            </label>
          </div>
          <div class="form-actions">
            <button class="btn btn--primary" type="submit" :disabled="saving">儲存影片</button>
            <button class="btn" type="button" @click="cancelLesson">取消</button>
          </div>
        </form>

        <!-- 影片列表 -->
        <table class="data-table">
          <thead>
            <tr>
              <th>排序</th>
              <th>標題</th>
              <th>時長</th>
              <th>Video ID</th>
              <th v-if="canEdit">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="activeCourse.lessons.length === 0">
              <td colspan="5" class="muted-text" style="text-align:center;padding:1.5rem">尚無影片，點上方「新增影片」</td>
            </tr>
            <tr v-for="lesson in activeCourse.lessons" :key="lesson.id">
              <td>{{ lesson.sortOrder }}</td>
              <td>{{ lesson.title }}</td>
              <td>{{ Math.floor(lesson.durationSeconds / 60) }}:{{ String(lesson.durationSeconds % 60).padStart(2, '0') }}</td>
              <td class="muted-text" style="font-size:.8rem;max-width:160px;overflow:hidden;text-overflow:ellipsis">{{ lesson.bunnyVideoId || '—' }}</td>
              <td v-if="canEdit">
                <button class="table-action" type="button" @click="startEditLesson(lesson)">編輯</button>
                <button class="table-action table-action--danger" type="button" @click="removeLesson(lesson.id)">刪除</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>

  </div>
</template>

<style scoped>
.hint-link {
  display: inline-block;
  margin-top: .25rem;
  font-size: .8rem;
  color: var(--accent, #f90);
  text-decoration: none;
}
.hint-link:hover { text-decoration: underline; }

.portal-section-checks {
  display: flex;
  flex-wrap: wrap;
  gap: .5rem .75rem;
  margin-top: .35rem;
}
.section-check {
  display: flex;
  align-items: center;
  gap: .3rem;
  font-size: .85rem;
  color: #d1d5db;
  cursor: pointer;
  padding: .3rem .6rem;
  border: 1px solid rgba(255,255,255,.15);
  border-radius: .4rem;
  background: rgba(255,255,255,.05);
  transition: background .15s, border-color .15s;
}
.section-check:hover { background: rgba(255,255,255,.1); }
.section-check input { accent-color: #f59e0b; cursor: pointer; }
</style>
