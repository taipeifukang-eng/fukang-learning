<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useCatalogStore } from '../stores/catalog'

const auth = useAuthStore()
const catalog = useCatalogStore()

onMounted(() => {
  catalog.fetchCourses()
  catalog.fetchCategories()
  if (auth.currentUser?.id) {
    catalog.fetchUserProgress(auth.currentUser.id)
  }
})

// ── 學習入口設定（與 CoursesManagementView.PORTAL_SECTIONS 同步）──
interface PortalSection {
  id: string        // 對應 courses.portal_sections[] 的值
  label: string
  icon: string
  description: string
  color: string
}

interface PortalRole {
  id: string
  label: string
  description: string
  icon: string
  bgClass: string
  accentColor: string
  sections: PortalSection[]
}

const portalConfig: PortalRole[] = [
  {
    id: 'store-staff',
    label: '門市人員',
    description: '藥局第一線服務人員學習資源',
    icon: '🏪',
    accentColor: '#f59e0b',
    bgClass: 'role-store',
    sections: [
      { id: 'store-newcomer',   label: '新人培訓', icon: '🌱', description: '剛加入富康大家庭？從這裡開始！',     color: '#10b981' },
      { id: 'store-supervisor', label: '主管課程', icon: '👔', description: '提升管理能力與工具應用',             color: '#6366f1' },
      { id: 'store-general',    label: '通識學習', icon: '📚', description: '藥學知識、法規合規、顧客服務',       color: '#0ea5e9' },
    ],
  },
  {
    id: 'hq-staff',
    label: '總部人員',
    description: '行政、採購、行銷等職能學習資源',
    icon: '🏢',
    accentColor: '#64748b',
    bgClass: 'role-hq',
    sections: [
      { id: 'hq-general', label: '通識學習', icon: '📋', description: '總部共用職能課程', color: '#64748b' },
    ],
  },
]

// ── 導覽狀態 ──────────────────────────────────────────────────
type Level = 'role' | 'section' | 'category' | 'courses'
const currentLevel   = ref<Level>('role')
const selectedRole    = ref<PortalRole | null>(null)
const selectedSection = ref<PortalSection | null>(null)
const selectedCatId   = ref<number | null | 'all'>(null)   // null=未選, 'all'=全部, number=分類id
const isAnimating     = ref(false)

function navigate(level: Level, role?: PortalRole, sec?: PortalSection, catId?: number | 'all') {
  if (isAnimating.value) return
  isAnimating.value = true
  if (role !== undefined)  selectedRole.value    = role
  if (sec  !== undefined)  selectedSection.value = sec
  if (catId !== undefined) selectedCatId.value   = catId
  currentLevel.value = level
  setTimeout(() => { isAnimating.value = false }, 350)
}

function goBack() {
  if      (currentLevel.value === 'courses')  navigate('category')
  else if (currentLevel.value === 'category') navigate('section')
  else if (currentLevel.value === 'section')  navigate('role')
}

// ── 課程過濾 ──────────────────────────────────────────────────
const visibleCourses = computed(() => catalog.courses.filter((c) => c.enabled))

/** 屬於目前 section 的課程 */
const sectionCourses = computed(() => {
  if (!selectedSection.value) return []
  const sid = selectedSection.value.id
  return visibleCourses.value.filter((c) => (c.portalSections ?? []).includes(sid))
})

/** section 內有哪些 DB 分類（用來顯示分類卡片） */
const sectionCategories = computed(() => {
  const catIds = new Set(sectionCourses.value.map((c) => c.categoryId).filter((id): id is number => id !== null))
  return catalog.categories.filter((cat) => catIds.has(cat.id))
})

/** 是否有未分類課程 */
const hasUncategorized = computed(() =>
  sectionCourses.value.some((c) => !c.categoryId),
)

/** 最終課程列表（依選擇的分類過濾） */
const filteredCourses = computed(() => {
  if (selectedCatId.value === 'all' || selectedCatId.value === null) return sectionCourses.value
  if (selectedCatId.value === -1) return sectionCourses.value.filter((c) => !c.categoryId)   // 未分類
  return sectionCourses.value.filter((c) => c.categoryId === selectedCatId.value)
})

/** 選擇分類卡後進入課程列表 */
function selectCategory(catId: number | 'all') {
  navigate('courses', undefined, undefined, catId)
}

function getProgress(courseId: string) {
  const course = catalog.courses.find((c) => c.id === courseId)
  if (!course || course.lessons.length === 0) return 0
  const pcts = course.lessons.map((lesson) => {
    const p = catalog.progresses.find(
      (p) => p.lessonId === lesson.id && p.staffProfileId === auth.currentUser?.id,
    )
    if (!p) return 0
    if (p.completedAt) return 100
    const dur = Math.max(p.durationSeconds ?? 0, lesson.durationSeconds ?? 0)
    if (dur <= 0) return 0
    return Math.min(100, Math.round((p.watchedSeconds / dur) * 100))
  })
  return Math.round(pcts.reduce((a, b) => a + b, 0) / course.lessons.length)
}

/** 計算特定 section 的課程數量 */
function sectionCourseCount(sectionId: string) {
  return visibleCourses.value.filter((c) => (c.portalSections ?? []).includes(sectionId)).length
}

// ── 麵包屑 ────────────────────────────────────────────────────
const breadcrumbs = computed(() => {
  const crumbs: Array<{ label: string; level: Level }> = [{ label: '學習入口', level: 'role' }]
  if (selectedRole.value    && currentLevel.value !== 'role')     crumbs.push({ label: selectedRole.value.label,    level: 'section' })
  if (selectedSection.value && (currentLevel.value === 'category' || currentLevel.value === 'courses'))
    crumbs.push({ label: selectedSection.value.label, level: 'category' })
  if (currentLevel.value === 'courses') {
    const cat = catalog.categories.find((c) => c.id === selectedCatId.value)
    const label = selectedCatId.value === 'all' ? '全部課程'
                : selectedCatId.value === -1 ? '未分類'
                : (cat?.name ?? '全部課程')
    crumbs.push({ label, level: 'courses' })
  }
  return crumbs
})
</script>

<template>
  <div class="portal-wrap">

    <!-- 麵包屑 -->
    <nav v-if="currentLevel !== 'role'" class="portal-breadcrumb">
      <button class="back-btn" @click="goBack">← 返回</button>
      <span v-for="(crumb, i) in breadcrumbs" :key="crumb.level" class="crumb">
        <span v-if="i > 0" class="crumb-sep">›</span>
        <span
          class="crumb-label"
          :class="{ 'crumb-active': i === breadcrumbs.length - 1 }"
          @click="i < breadcrumbs.length - 1 ? navigate(crumb.level) : null"
        >{{ crumb.label }}</span>
      </span>
    </nav>

    <!-- ─ Level 0：角色 ─ -->
    <Transition name="slide-up">
      <div v-if="currentLevel === 'role'" class="portal-level">
        <div class="portal-header">
          <h2 class="portal-title">歡迎來到學習專區</h2>
          <p class="portal-subtitle">請選擇你的工作角色，開始你的學習旅程</p>
        </div>
        <div class="role-grid">
          <button
            v-for="role in portalConfig"
            :key="role.id"
            class="role-card"
            :class="role.bgClass"
            @click="navigate('section', role)"
          >
            <div class="role-card__icon">{{ role.icon }}</div>
            <div class="role-card__body">
              <h3>{{ role.label }}</h3>
              <p>{{ role.description }}</p>
            </div>
            <div class="role-card__arrow">→</div>
          </button>
        </div>
      </div>
    </Transition>

    <!-- ─ Level 1：學習方塊 ─ -->
    <Transition name="slide-up">
      <div v-if="currentLevel === 'section' && selectedRole" class="portal-level">
        <div class="portal-header">
          <span class="portal-role-badge" :style="{ background: selectedRole.accentColor }">
            {{ selectedRole.icon }} {{ selectedRole.label }}
          </span>
          <h2 class="portal-title">選擇學習方塊</h2>
          <p class="portal-subtitle">點擊下方方塊，進入對應的分類課程</p>
        </div>
        <div class="section-grid">
          <button
            v-for="(sec, i) in selectedRole.sections"
            :key="sec.id"
            class="section-card"
            :style="{ '--card-color': sec.color, animationDelay: `${i * 80}ms` }"
            @click="navigate('category', selectedRole!, sec)"
          >
            <div class="section-card__icon">{{ sec.icon }}</div>
            <h3 class="section-card__label">{{ sec.label }}<span class="section-card__count">({{ sectionCourseCount(sec.id) }})</span></h3>
            <p class="section-card__desc">{{ sec.description }}</p>
            <div class="section-card__cta">選擇分類 →</div>
          </button>
        </div>
      </div>
    </Transition>

    <!-- ─ Level 2：DB 分類卡片 ─ -->
    <Transition name="slide-up">
      <div v-if="currentLevel === 'category' && selectedSection" class="portal-level">
        <div class="portal-header">
          <span class="portal-role-badge" :style="{ background: selectedSection.color }">
            {{ selectedSection.icon }} {{ selectedSection.label }}
          </span>
          <h2 class="portal-title">選擇課程分類</h2>
          <p class="portal-subtitle">{{ sectionCourses.length }} 個課程，請選擇分類進入</p>
        </div>

        <p v-if="sectionCourses.length === 0" class="empty-courses">
          此學習方塊目前尚無課程。請先至課程管理中為課程設定學習方塊。
        </p>

        <div v-else class="category-grid">
          <!-- 全部 -->
          <button
            class="cat-card cat-card--all"
            style="animationDelay: 0ms"
            @click="selectCategory('all')"
          >
            <div class="cat-card__icon">📂</div>
            <h3 class="cat-card__name">全部課程</h3>
            <p class="cat-card__count">{{ sectionCourses.length }} 個課程</p>
            <span class="cat-card__cta">進入 →</span>
          </button>
          <!-- 各分類 -->
          <button
            v-for="(cat, i) in sectionCategories"
            :key="cat.id"
            class="cat-card"
            :style="{ animationDelay: `${(i + 1) * 80}ms` }"
            @click="selectCategory(cat.id)"
          >
            <div class="cat-card__icon">🗂️</div>
            <h3 class="cat-card__name">{{ cat.name }}</h3>
            <p class="cat-card__count">
              {{ sectionCourses.filter(c => c.categoryId === cat.id).length }} 個課程
            </p>
            <span class="cat-card__cta">進入 →</span>
          </button>
          <!-- 未分類 -->
          <button
            v-if="hasUncategorized"
            class="cat-card cat-card--uncat"
            :style="{ animationDelay: `${(sectionCategories.length + 1) * 80}ms` }"
            @click="selectCategory(-1)"
          >
            <div class="cat-card__icon">📄</div>
            <h3 class="cat-card__name">其他</h3>
            <p class="cat-card__count">
              {{ sectionCourses.filter(c => !c.categoryId).length }} 個課程
            </p>
            <span class="cat-card__cta">進入 →</span>
          </button>
        </div>
      </div>
    </Transition>

    <!-- ─ Level 3：課程列表 ─ -->
    <Transition name="slide-up">
      <div v-if="currentLevel === 'courses'" class="portal-level">
        <div class="portal-header">
          <h2 class="portal-title">
            {{ selectedCatId === 'all' || selectedCatId === null ? '全部課程'
               : selectedCatId === -1 ? '其他課程'
               : (catalog.categories.find(c => c.id === selectedCatId)?.name ?? '課程列表') }}
          </h2>
          <p class="portal-subtitle">{{ filteredCourses.length }} 個課程</p>
        </div>
        <p v-if="filteredCourses.length === 0" class="empty-courses">此分類目前尚無課程。</p>
        <section class="course-grid">
          <RouterLink
            v-for="course in filteredCourses"
            :key="course.id"
            :to="`/learning/course/${course.id}`"
            class="learning-card"
          >
            <img v-if="course.coverUrl" :src="course.coverUrl" :alt="course.title" class="learning-card__cover" />
            <div v-else class="learning-card__cover learning-card__cover--empty"></div>
            <div class="learning-card__body">
              <span class="course-tag">{{ course.categoryName || '未分類' }}</span>
              <h3>{{ course.title }}</h3>
              <p>{{ course.description }}</p>
              <div class="progress-row">
                <div class="progress-bar"><span :style="{ width: `${getProgress(course.id)}%` }"></span></div>
                <strong>{{ getProgress(course.id) }}%</strong>
              </div>
            </div>
          </RouterLink>
        </section>
      </div>
    </Transition>

  </div>
</template>

<style scoped>
/* ── 整體 ── */
.portal-wrap { display:flex; flex-direction:column; gap:1.5rem; min-height:60vh; }

/* ── 麵包屑 ── */
.portal-breadcrumb { display:flex; align-items:center; gap:.5rem; flex-wrap:wrap; }
.back-btn {
  background:rgba(128,128,128,.12); border:1px solid rgba(128,128,128,.2);
  color:inherit; border-radius:.5rem; padding:.3rem .75rem;
  font-size:.82rem; cursor:pointer;
}
.back-btn:hover { background:rgba(128,128,128,.2); }
.crumb { display:flex; align-items:center; gap:.35rem; font-size:.82rem; }
.crumb-sep { opacity:.4; }
.crumb-label { opacity:.6; cursor:pointer; }
.crumb-label:hover { color:#f59e0b; opacity:1; }
.crumb-active { font-weight:600; cursor:default; }

/* ── 標題區 ── */
.portal-header { text-align:center; margin-bottom:1.5rem; display:flex; flex-direction:column; align-items:center; gap:.5rem; }
.portal-title { font-size:1.5rem; font-weight:800; color:inherit; margin:0; }
.portal-subtitle { font-size:.9rem; opacity:.6; margin:0; }
.portal-role-badge {
  display:inline-flex; align-items:center; gap:.35rem;
  padding:.25rem .75rem; border-radius:2rem; font-size:.82rem; font-weight:600; color:#fff;
}

/* ── Level 0：角色卡 ── */
.role-grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(280px, 1fr)); gap:1.25rem; }
.role-card {
  position:relative; display:flex; align-items:center; gap:1.25rem;
  padding:2rem 1.75rem; border-radius:1.25rem; border:none; cursor:pointer;
  text-align:left; transition:transform .2s, box-shadow .2s; overflow:hidden;
}
.role-card:hover { transform:translateY(-4px); box-shadow:0 12px 30px rgba(0,0,0,.35); }
.role-store { background:linear-gradient(135deg,#78350f,#92400e,#b45309); box-shadow:0 4px 20px rgba(245,158,11,.25); }
.role-hq    { background:linear-gradient(135deg,#1e293b,#334155); box-shadow:0 4px 20px rgba(0,0,0,.3); }
.role-card__icon { font-size:2.75rem; flex-shrink:0; }
.role-card__body h3 { margin:0 0 .3rem; font-size:1.2rem; font-weight:800; color:#fff; }
.role-card__body p  { margin:0; font-size:.85rem; color:rgba(255,255,255,.75); }
.role-card__arrow { margin-left:auto; font-size:1.4rem; color:rgba(255,255,255,.6); flex-shrink:0; }

/* ── Level 1：學習方塊卡 ── */
.section-grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:1rem; }
.section-card {
  display:flex; flex-direction:column; align-items:flex-start; gap:.5rem;
  padding:1.5rem; border-radius:1rem; border:none; cursor:pointer;
  background:var(--card-color); color:#fff; text-align:left;
  transition:transform .2s, box-shadow .2s;
  animation:pop-in .35s ease both;
}
.section-card:hover { transform:translateY(-3px) scale(1.01); box-shadow:0 10px 28px rgba(0,0,0,.35); }
.section-card__icon  { font-size:2rem; }
.section-card__label { font-size:1.05rem; font-weight:700; margin:0; display:flex; align-items:baseline; gap:.35rem; }
.section-card__count { font-size:.8rem; font-weight:500; opacity:.75; }
.section-card__desc  { font-size:.82rem; opacity:.85; margin:0; flex:1; }
.section-card__cta   { font-size:.8rem; opacity:.75; font-weight:600; margin-top:.25rem; }

/* ── Level 2：DB分類卡 ── */
.category-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(180px, 1fr)); gap:1rem; }
.cat-card {
  display:flex; flex-direction:column; align-items:flex-start; gap:.4rem;
  padding:1.25rem; border-radius:.9rem; border:1px solid rgba(128,128,128,.2);
  background:var(--color-surface, rgba(128,128,128,.06)); cursor:pointer; text-align:left;
  transition:transform .2s, background .2s;
  animation:pop-in .35s ease both;
}
.cat-card:hover { transform:translateY(-2px); background:var(--color-surface-hover, rgba(128,128,128,.13)); }
.cat-card--all  { border-color:rgba(245,158,11,.4); background:rgba(245,158,11,.08); }
.cat-card--uncat { border-color:rgba(128,128,128,.15); }
.cat-card__icon  { font-size:1.6rem; }
.cat-card__name  { margin:0; font-size:.95rem; font-weight:700; color:inherit; }
.cat-card__count { margin:0; font-size:.78rem; opacity:.55; flex:1; }
.cat-card__cta   { font-size:.78rem; color:#f59e0b; font-weight:600; }

/* ── Level 3：課程列表 ── */
.course-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(260px, 1fr)); gap:1.25rem; }
.empty-courses { text-align:center; color:#6b7280; padding:3rem 0; font-size:.9rem; }
.learning-card {
  display:flex; flex-direction:column; border-radius:.9rem;
  overflow:hidden; text-decoration:none; transition:transform .2s, box-shadow .2s;
  background:var(--color-surface, rgba(128,128,128,.06)); border:1px solid rgba(128,128,128,.15);
}
.learning-card:hover { transform:translateY(-3px); box-shadow:0 8px 24px rgba(0,0,0,.15); }
.learning-card__cover { width:100%; height:160px; object-fit:cover; }
.learning-card__cover--empty { background:#cbd5e1; }
.learning-card__body { padding:1rem; display:flex; flex-direction:column; gap:.4rem; }
.learning-card__body h3 { margin:0; font-size:.95rem; font-weight:700; color:inherit; }
.learning-card__body p  { margin:0; font-size:.82rem; opacity:.6; }
.course-tag {
  display:inline-block; font-size:.72rem; font-weight:600;
  background:rgba(245,158,11,.2); color:#f59e0b; border-radius:.35rem; padding:.1rem .45rem;
}
.progress-row { display:flex; align-items:center; gap:.5rem; margin-top:.25rem; }
.progress-bar { flex:1; height:5px; background:rgba(255,255,255,.12); border-radius:3px; overflow:hidden; }
.progress-bar span { display:block; height:100%; background:#f59e0b; border-radius:3px; }
.progress-row strong { font-size:.78rem; color:#f59e0b; min-width:2.5rem; text-align:right; }

/* ── 過場動畫 ── */
.slide-up-enter-active { animation:slide-up-in .35s ease; }
.slide-up-leave-active { animation:slide-up-out .25s ease; }
@keyframes slide-up-in {
  from { opacity:0; transform:translateY(24px); }
  to   { opacity:1; transform:translateY(0); }
}
@keyframes slide-up-out {
  from { opacity:1; transform:translateY(0); }
  to   { opacity:0; transform:translateY(-12px); }
}
@keyframes pop-in {
  from { opacity:0; transform:scale(.92) translateY(12px); }
  to   { opacity:1; transform:scale(1) translateY(0); }
}
</style>
