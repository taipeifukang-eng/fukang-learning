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

const visibleCourses = computed(() => catalog.courses.filter((course) => course.enabled))

// ── 分類 Tab ──────────────────────────────────────────────────
type TabId = number | 'all' | 'uncategorized'
const activeTab = ref<TabId>('all')

const categoryTabs = computed(() => {
  const enabled = visibleCourses.value
  const usedCatIds = new Set(enabled.map((c) => c.categoryId))
  const cats = catalog.categories.filter((cat) => usedCatIds.has(cat.id))
  const hasUncategorized = enabled.some((c) => !c.categoryId)
  return [
    { id: 'all' as TabId, name: '全部', count: enabled.length },
    ...cats.map((cat) => ({
      id: cat.id as TabId,
      name: cat.name,
      count: enabled.filter((c) => c.categoryId === cat.id).length,
    })),
    ...(hasUncategorized
      ? [{ id: 'uncategorized' as TabId, name: '未分類', count: enabled.filter((c) => !c.categoryId).length }]
      : []),
  ]
})

const filteredCourses = computed(() => {
  if (activeTab.value === 'all') return visibleCourses.value
  if (activeTab.value === 'uncategorized') return visibleCourses.value.filter((c) => !c.categoryId)
  return visibleCourses.value.filter((c) => c.categoryId === activeTab.value)
})

function getProgress(courseId: string) {
  const course = catalog.courses.find((c) => c.id === courseId)
  if (!course || course.lessons.length === 0) return 0

  const percentages = course.lessons.map((lesson) => {
    const progress = catalog.progresses.find(
      (p) => p.lessonId === lesson.id && p.staffProfileId === auth.currentUser?.id,
    )
    if (!progress) return 0
    if (progress.completedAt) return 100
    const duration = Math.max(progress.durationSeconds ?? 0, lesson.durationSeconds ?? 0)
    if (duration <= 0) return 0
    return Math.min(100, Math.round((progress.watchedSeconds / duration) * 100))
  })

  const sum = percentages.reduce((acc, val) => acc + val, 0)
  return Math.round(sum / course.lessons.length)
}
</script>

<template>
  <div class="page-stack">
    <section class="learning-hero panel-card">
      <div>
        <h2>你的學習課程</h2>
      </div>
    </section>

    <!-- 分類 Tab Bar（有任何分類就顯示） -->
    <div v-if="categoryTabs.length > 1" class="category-tabs">
      <button
        v-for="tab in categoryTabs"
        :key="String(tab.id)"
        class="category-tab"
        :class="{ 'is-active': activeTab === tab.id }"
        type="button"
        @click="activeTab = tab.id"
      >
        {{ tab.name }}
        <span class="category-tab__count">{{ tab.count }}</span>
      </button>
    </div>

    <p v-if="filteredCourses.length === 0" class="muted-text" style="padding:.5rem 0">此分類目前沒有課程。</p>

    <section class="panel-grid panel-grid--3">
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
</template>
