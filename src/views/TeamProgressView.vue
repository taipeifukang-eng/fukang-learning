<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useCatalogStore } from '../stores/catalog'
import { useAuthStore } from '../stores/auth'
import { supabase } from '../lib/supabase'

const catalog = useCatalogStore()
const auth = useAuthStore()

// 展開/收合狀態
const collapsedOrgs = ref(new Set<number>())
function toggleCollapse(orgId: number) {
  if (collapsedOrgs.value.has(orgId)) collapsedOrgs.value.delete(orgId)
  else collapsedOrgs.value.add(orgId)
}
function isCollapsed(orgId: number) { return collapsedOrgs.value.has(orgId) }

onMounted(async () => {
  await Promise.all([
    catalog.fetchOrganizations(),
    catalog.fetchStaff(),
    catalog.fetchTeamProgressRows(),
    catalog.fetchCategories(),
    catalog.fetchCourses(),
    auth.currentUser?.id ? catalog.fetchManagerOrgScopes(auth.currentUser.id) : Promise.resolve(),
  ])
})

// ── 計算此登入用戶可管轄的組織 ID ────────────────────────────────
const managedOrgIds = computed<number[]>(() => {
  const user = auth.currentUser
  // 管理員 → 全部組織
  if (auth.hasPermission('dashboard:view')) {
    return catalog.organizations.map((o) => o.id)
  }
  if (!user) return []

  const ids = new Set<number>()

  // 1. 經理：門市登記 manager 中有自己名字的所有組織
  catalog.organizations.forEach((org) => {
    if (org.manager && org.manager === user.name) ids.add(org.id)
  })

  // 2. 督導：在組織管理中登記為 supervisor 的組織（以 display name 比對）
  catalog.organizations.forEach((org) => {
    if (org.supervisor && org.supervisor === user.name) ids.add(org.id)
  })

  // 3. 明確指派：staff_manager_org_scope
  catalog.managerOrgScopes.forEach((scope) => {
    if (scope.managerId === user.id && scope.active) ids.add(scope.orgId)
  })

  return Array.from(ids)
})

// ── 管轄的組織物件（排序：code 升冪）────────────────────────────
const managedOrgs = computed(() =>
  catalog.organizations
    .filter((org) => managedOrgIds.value.includes(org.id))
    .sort((a, b) => a.code.localeCompare(b.code)),
)

// ── 每人在某組織的彙整進度 ──────────────────────────────────────
function staffProgressInOrg(orgId: number) {
  const rows = catalog.teamProgressRows.filter((r) => r.orgId === orgId)
  const map = new Map<string, {
    staffProfileId: string
    displayName: string
    employeeNo: string
    progressSum: number
    completedCount: number
    totalLessons: number
  }>()

  rows.forEach((row) => {
    const key = row.staffProfileId
    const entry = map.get(key) ?? {
      staffProfileId: row.staffProfileId,
      displayName: row.displayName,
      employeeNo: row.employeeNo,
      progressSum: 0,
      completedCount: 0,
      totalLessons: 0,
    }
    entry.progressSum += row.progressPercent
    entry.completedCount += row.completedAt ? 1 : 0
    entry.totalLessons += 1
    map.set(key, entry)
  })

  return Array.from(map.values())
    .map((e) => ({
      ...e,
      avgProgress: e.totalLessons > 0 ? Math.round(e.progressSum / e.totalLessons) : 0,
    }))
    .sort((a, b) => b.avgProgress - a.avgProgress)
}

function orgAvgProgress(orgId: number) {
  const list = staffProgressInOrg(orgId)
  if (list.length === 0) return 0
  return Math.round(list.reduce((s, e) => s + e.avgProgress, 0) / list.length)
}

function orgStaffCount(orgId: number) {
  return catalog.staff.filter((m) => m.enabled && m.orgId === orgId).length
}

// ── 人員詳細 Drill-down ────────────────────────────────────────
interface MemberSummary { staffProfileId: string; displayName: string; employeeNo: string }

const memberModal = ref(false)
const catDrillOpen = ref(false)
const drillMember = ref<MemberSummary | null>(null)
const drillCatKey = ref<string | null>(null)
const quizLoading = ref(false)
const memberQuizMap = ref<Map<string, { passed: boolean; score: number }>>(new Map())
const memberQuizLessonSet = ref<Set<string>>(new Set())

async function openMemberModal(member: MemberSummary) {
  drillMember.value = member
  memberModal.value = true
  catDrillOpen.value = false
  drillCatKey.value = null
  memberQuizMap.value = new Map()
  memberQuizLessonSet.value = new Set()
  quizLoading.value = true
  try {
    const myRows = catalog.teamProgressRows.filter(r => r.staffProfileId === member.staffProfileId)
    const lessonIds = [...new Set(myRows.map(r => r.lessonId))]

    const { data: attemptData } = await supabase
      .from('quiz_attempts')
      .select('quiz_id, score, passed, quizzes(lesson_id)')
      .eq('staff_profile_id', member.staffProfileId)
      .not('submitted_at', 'is', null)

    const { data: quizData } = lessonIds.length > 0
      ? await supabase.from('quizzes').select('lesson_id').in('lesson_id', lessonIds)
      : { data: [] as { lesson_id: string }[] }

    const qzSet = new Set<string>()
    for (const qz of quizData ?? []) qzSet.add((qz as any).lesson_id)
    memberQuizLessonSet.value = qzSet

    const map = new Map<string, { passed: boolean; score: number }>()
    for (const row of attemptData ?? []) {
      const lessonId = (row as any).quizzes?.lesson_id
      if (!lessonId) continue
      const existing = map.get(lessonId)
      if (!existing || row.score > existing.score) map.set(lessonId, { passed: row.passed, score: row.score })
    }
    memberQuizMap.value = map
  } catch { /* RLS 可能限制存取，靜默忽略 */ }
  finally { quizLoading.value = false }
}

function closeMemberModal() {
  memberModal.value = false
  drillMember.value = null
  catDrillOpen.value = false
  drillCatKey.value = null
}
function openCatDrill(catKey: string) { drillCatKey.value = catKey; catDrillOpen.value = true }
function closeCatDrill() { catDrillOpen.value = false; drillCatKey.value = null }

const activeMemberRows = computed(() =>
  drillMember.value
    ? catalog.teamProgressRows.filter(r => r.staffProfileId === drillMember.value!.staffProfileId)
    : [],
)

interface DrillLesson {
  lessonId: string; lessonTitle: string; progressPercent: number; completedAt: string | null
  hasQuiz: boolean; quizPassed: boolean | null; quizScore: number | null
}
interface DrillCourse { courseId: string; courseTitle: string; lessons: DrillLesson[]; avgProgress: number; completedCount: number }
interface DrillCat {
  catKey: string; catName: string; courses: DrillCourse[]
  totalLessons: number; completedCount: number; avgProgress: number
  quizPassCount: number; quizTotal: number
}

const memberByCategory = computed((): DrillCat[] => {
  const catMap = new Map<string, { catName: string; courseMap: Map<string, { courseTitle: string; rows: typeof activeMemberRows.value }> }>()
  for (const row of activeMemberRows.value) {
    const course = catalog.courses.find(c => c.id === row.courseId)
    const catId = course?.categoryId ?? null
    const catName = catId != null ? (catalog.categories.find(c => c.id === catId)?.name ?? '未分類') : '未分類'
    const catKey = catId != null ? String(catId) : 'uncategorized'
    if (!catMap.has(catKey)) catMap.set(catKey, { catName, courseMap: new Map() })
    const cat = catMap.get(catKey)!
    if (!cat.courseMap.has(row.courseId)) cat.courseMap.set(row.courseId, { courseTitle: row.courseTitle, rows: [] })
    cat.courseMap.get(row.courseId)!.rows.push(row)
  }
  return Array.from(catMap.entries()).map(([catKey, cat]) => {
    const courses: DrillCourse[] = Array.from(cat.courseMap.entries()).map(([courseId, c]) => {
      const lessons: DrillLesson[] = c.rows.map(row => {
        const qz = memberQuizMap.value.get(row.lessonId)
        return {
          lessonId: row.lessonId, lessonTitle: row.lessonTitle,
          progressPercent: row.progressPercent, completedAt: row.completedAt,
          hasQuiz: memberQuizLessonSet.value.has(row.lessonId),
          quizPassed: qz?.passed ?? null, quizScore: qz?.score ?? null,
        }
      })
      return {
        courseId, courseTitle: c.courseTitle, lessons,
        avgProgress: lessons.length > 0 ? Math.round(lessons.reduce((s, l) => s + l.progressPercent, 0) / lessons.length) : 0,
        completedCount: lessons.filter(l => l.completedAt).length,
      }
    })
    const totalLessons = courses.reduce((s, c) => s + c.lessons.length, 0)
    const completedCount = courses.reduce((s, c) => s + c.completedCount, 0)
    const progressSum = courses.reduce((s, c) => s + c.lessons.reduce((ls, l) => ls + l.progressPercent, 0), 0)
    const allLessons = courses.flatMap(c => c.lessons)
    const quizLessons = allLessons.filter(l => l.hasQuiz)
    return {
      catKey, catName: cat.catName, courses, totalLessons, completedCount,
      avgProgress: totalLessons > 0 ? Math.round(progressSum / totalLessons) : 0,
      quizPassCount: quizLessons.filter(l => l.quizPassed === true).length,
      quizTotal: quizLessons.length,
    }
  }).sort((a, b) => a.catName.localeCompare(b.catName, 'zh-TW'))
})

const drillCatData = computed((): DrillCat | null =>
  drillCatKey.value ? (memberByCategory.value.find(c => c.catKey === drillCatKey.value) ?? null) : null,
)
</script>

<template>
  <div class="page-stack">
    <section class="panel-card">
      <h2>轄區學習進度總覽</h2>
      <p>依管轄組織分區顯示人員學習進度，點選區塊標題可展開 / 收合。</p>
    </section>

    <!-- 無管轄範圍 -->
    <section v-if="managedOrgs.length === 0" class="panel-card">
      <p class="muted-text">目前尚未設定管轄範圍。請聯絡管理員在「主管範圍管理」中指派組織。</p>
    </section>

    <!-- 每個管轄組織一個區塊 -->
    <section
      v-for="org in managedOrgs"
      :key="org.id"
      class="panel-card org-block"
    >
      <!-- 區塊 Header（可點擊展開/收合） -->
      <button class="org-header" type="button" @click="toggleCollapse(org.id)">
        <div class="org-header-left">
          <span class="org-collapse-icon">{{ isCollapsed(org.id) ? '▶' : '▼' }}</span>
          <div>
            <strong class="org-name">{{ org.code }}｜{{ org.shortName }}</strong>
            <span class="org-meta">
              {{ org.type === 'store' ? '門市' : '總部 / 部門' }}
              <template v-if="org.manager">・經理：{{ org.manager }}</template>
              <template v-if="org.supervisor">・督導/副理：{{ org.supervisor }}</template>
            </span>
          </div>
        </div>
        <div class="org-header-stats">
          <span class="stat-chip">{{ orgStaffCount(org.id) }} 人</span>
          <div class="progress-inline">
            <div class="progress-bar-sm">
              <span :style="{ width: `${orgAvgProgress(org.id)}%` }"></span>
            </div>
            <strong>{{ orgAvgProgress(org.id) }}%</strong>
          </div>
        </div>
      </button>

      <!-- 展開內容：人員進度列表 -->
      <div v-if="!isCollapsed(org.id)" class="org-content">
        <table class="data-table">
          <thead>
            <tr>
              <th>人員</th>
              <th>員編</th>
              <th>平均進度</th>
              <th>完成 / 總影片</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="staffProgressInOrg(org.id).length === 0">
              <td colspan="4" class="muted-text" style="text-align:center;padding:1rem">
                此組織尚無學習進度資料
              </td>
            </tr>
            <tr
              v-for="member in staffProgressInOrg(org.id)"
              :key="member.staffProfileId"
              class="clickable-row"
              @click="openMemberModal(member)"
            >
              <td><strong>{{ member.displayName }}</strong></td>
              <td class="muted-text">{{ member.employeeNo || '—' }}</td>
              <td>
                <div class="progress-inline">
                  <div class="progress-bar-sm">
                    <span :style="{ width: `${member.avgProgress}%` }"></span>
                  </div>
                  <span>{{ member.avgProgress }}%</span>
                </div>
              </td>
              <td>{{ member.completedCount }} / {{ member.totalLessons }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>

  <!-- ── Modal 1：人員 → 分類進度 ── -->
  <Teleport to="body">
    <div v-if="memberModal" class="drill-overlay" @click.self="closeMemberModal">
      <div class="drill-modal">
        <div class="drill-modal-header">
          <div class="drill-modal-title">
            <strong>{{ drillMember?.displayName }}</strong>
            <span class="muted-text" style="margin-left:.5rem;font-size:.82rem">{{ drillMember?.employeeNo }}</span>
          </div>
          <button class="drill-close-btn" @click="closeMemberModal">✕</button>
        </div>
        <div class="drill-body">
          <div v-if="quizLoading" class="drill-loading">載入測驗資料中…</div>
          <div v-else-if="memberByCategory.length === 0" class="muted-text" style="text-align:center;padding:2rem">尚無進度資料</div>
          <button
            v-for="cat in memberByCategory"
            :key="cat.catKey"
            class="cat-drill-card"
            @click="openCatDrill(cat.catKey)"
          >
            <div class="cat-drill-top">
              <span class="cat-drill-name">{{ cat.catName }}</span>
              <span class="cat-drill-pct" :class="cat.avgProgress >= 100 ? 'pct--done' : cat.avgProgress > 0 ? 'pct--prog' : ''">
                {{ cat.avgProgress }}%
              </span>
            </div>
            <div class="progress-bar-sm" style="margin:.4rem 0">
              <span :style="{ width: `${cat.avgProgress}%` }"></span>
            </div>
            <div class="cat-drill-stats">
              <span>影片 {{ cat.completedCount }} / {{ cat.totalLessons }} 完成</span>
              <span v-if="cat.quizTotal > 0">測驗 {{ cat.quizPassCount }} / {{ cat.quizTotal }} 通過</span>
              <span v-else class="muted-text">無測驗</span>
              <span class="cat-drill-arrow">›</span>
            </div>
          </button>
        </div>
      </div>
    </div>
  </Teleport>

  <!-- ── Modal 2：分類 → 課程 / 影片 / 測驗 ── -->
  <Teleport to="body">
    <div v-if="catDrillOpen && drillCatData" class="drill-overlay drill-overlay--front" @click.self="closeCatDrill">
      <div class="drill-modal">
        <div class="drill-modal-header">
          <button class="drill-back-btn" @click="closeCatDrill">← 返回</button>
          <span class="drill-modal-title">{{ drillCatData.catName }}</span>
          <button class="drill-close-btn" @click="closeMemberModal">✕</button>
        </div>
        <div class="drill-body">
          <div v-for="course in drillCatData.courses" :key="course.courseId" class="course-drill-block">
            <div class="course-drill-header">
              <span class="course-drill-title">{{ course.courseTitle }}</span>
              <div class="progress-inline">
                <div class="progress-bar-sm" style="min-width:70px"><span :style="{ width: `${course.avgProgress}%` }"></span></div>
                <span style="font-size:.85rem;font-weight:600">{{ course.avgProgress }}%</span>
              </div>
            </div>
            <div class="lesson-drill-list">
              <div v-for="lesson in course.lessons" :key="lesson.lessonId" class="lesson-drill-row">
                <div class="lesson-drill-title">{{ lesson.lessonTitle }}</div>
                <div class="lesson-drill-badges">
                  <span
                    class="badge"
                    :class="lesson.completedAt ? 'badge--done' : lesson.progressPercent > 0 ? 'badge--prog' : 'badge--none'"
                  >
                    {{ lesson.completedAt ? '✓ 完成' : lesson.progressPercent > 0 ? `${lesson.progressPercent}%` : '未開始' }}
                  </span>
                  <template v-if="lesson.hasQuiz">
                    <span v-if="lesson.quizPassed === true" class="badge badge--pass">測驗通過</span>
                    <span v-else-if="lesson.quizPassed === false" class="badge badge--fail">未通過 {{ lesson.quizScore }}分</span>
                    <span v-else class="badge badge--quiz-skip">尚未作答</span>
                  </template>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.org-block {
  padding: 0;
  overflow: hidden;
}

.org-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 1rem 1.25rem;
  background: transparent;
  border: none;
  color: inherit;
  cursor: pointer;
  gap: 1rem;
  text-align: left;
  transition: background .15s;
}

.org-header:hover {
  background: color-mix(in srgb, var(--color-primary, #f59e0b) 6%, transparent);
}

.org-header-left {
  display: flex;
  align-items: center;
  gap: .65rem;
}

.org-collapse-icon {
  font-size: .8rem;
  opacity: .7;
  flex-shrink: 0;
}

.org-name {
  display: block;
  font-size: 1.02rem;
}

.org-meta {
  display: block;
  font-size: .8rem;
  opacity: .65;
  margin-top: .1rem;
}

.org-header-stats {
  display: flex;
  align-items: center;
  gap: .85rem;
  flex-shrink: 0;
}

.stat-chip {
  font-size: .8rem;
  padding: .15rem .5rem;
  border-radius: 999px;
  background: color-mix(in srgb, var(--color-primary, #f59e0b) 18%, transparent);
}

.progress-inline {
  display: flex;
  align-items: center;
  gap: .5rem;
  min-width: 120px;
}

.progress-bar-sm {
  flex: 1;
  height: 8px;
  border-radius: 4px;
  background: color-mix(in srgb, currentColor 15%, transparent);
  overflow: hidden;
}

.progress-bar-sm span {
  display: block;
  height: 100%;
  background: var(--color-primary, #f59e0b);
  border-radius: 4px;
  transition: width .3s;
}

.org-content {
  border-top: 1px solid var(--color-border, #e5e7eb);
  padding: 0 1.25rem 1rem;
}

/* ── 可點擊行 ── */
.clickable-row { cursor: pointer; transition: background .12s; }
.clickable-row:hover { background: color-mix(in srgb, var(--color-primary, #f59e0b) 8%, transparent); }

/* ── Drill-down overlay ── */
.drill-overlay {
  position: fixed; inset: 0; z-index: 1000;
  background: rgba(0,0,0,.48);
  display: flex; align-items: center; justify-content: center;
  padding: 1rem;
}
.drill-overlay--front { z-index: 1100; }

.drill-modal {
  background: var(--color-bg, #fff);
  border-radius: 1rem;
  width: 100%; max-width: 560px;
  max-height: 82vh;
  display: flex; flex-direction: column;
  box-shadow: 0 24px 64px rgba(0,0,0,.28);
  overflow: hidden;
}

.drill-modal-header {
  display: flex; align-items: center; gap: .75rem;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid var(--color-border, #e5e7eb);
  flex-shrink: 0;
}
.drill-modal-title { font-size: 1rem; font-weight: 600; flex: 1; }
.drill-close-btn {
  background: none; border: none; cursor: pointer; font-size: 1rem;
  color: inherit; opacity: .5; padding: .25rem .5rem; border-radius: .4rem;
  transition: opacity .15s; flex-shrink: 0;
}
.drill-close-btn:hover { opacity: 1; }
.drill-back-btn {
  background: none; border: none; cursor: pointer; white-space: nowrap;
  color: var(--color-primary, #f59e0b); font-size: .875rem;
  padding: .25rem .4rem; border-radius: .4rem; flex-shrink: 0;
}
.drill-loading { text-align: center; padding: 2rem; opacity: .6; font-size: .9rem; }
.drill-body { overflow-y: auto; padding: .75rem; display: flex; flex-direction: column; gap: .5rem; }

/* ── Category cards ── */
.cat-drill-card {
  width: 100%; text-align: left; background: none;
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: .75rem; padding: .85rem 1rem;
  cursor: pointer; transition: border-color .15s, background .15s; color: inherit;
}
.cat-drill-card:hover {
  border-color: var(--color-primary, #f59e0b);
  background: color-mix(in srgb, var(--color-primary, #f59e0b) 6%, transparent);
}
.cat-drill-top { display: flex; justify-content: space-between; align-items: center; }
.cat-drill-name { font-weight: 600; font-size: .95rem; }
.cat-drill-pct { font-size: .9rem; font-weight: 700; }
.pct--done { color: #10b981; }
.pct--prog { color: var(--color-primary, #f59e0b); }
.cat-drill-stats {
  display: flex; align-items: center; gap: .75rem;
  font-size: .78rem; opacity: .65; margin-top: .25rem;
}
.cat-drill-arrow { margin-left: auto; opacity: .5; font-size: 1.1rem; }

/* ── Course / Lesson blocks ── */
.course-drill-block {
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: .75rem; overflow: hidden;
}
.course-drill-header {
  display: flex; align-items: center; justify-content: space-between; gap: .75rem;
  padding: .65rem 1rem;
  background: color-mix(in srgb, currentColor 4%, transparent);
}
.course-drill-title { font-weight: 600; font-size: .88rem; flex: 1; }
.lesson-drill-list { padding: 0; }
.lesson-drill-row {
  display: flex; align-items: center; justify-content: space-between;
  padding: .55rem 1rem; gap: .75rem;
  border-top: 1px solid var(--color-border, #e5e7eb);
}
.lesson-drill-title { font-size: .84rem; flex: 1; }
.lesson-drill-badges { display: flex; align-items: center; gap: .35rem; flex-shrink: 0; }

/* ── Badges ── */
.badge {
  font-size: .72rem; font-weight: 600; padding: .18rem .5rem;
  border-radius: 999px; white-space: nowrap;
}
.badge--done  { background: #d1fae5; color: #065f46; }
.badge--prog  { background: #fef3c7; color: #92400e; }
.badge--none  { background: color-mix(in srgb, currentColor 10%, transparent); opacity: .55; }
.badge--pass  { background: #d1fae5; color: #065f46; }
.badge--fail  { background: #fee2e2; color: #991b1b; }
.badge--quiz-skip { background: #e0e7ff; color: #3730a3; }
</style>
