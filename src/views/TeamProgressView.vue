<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useCatalogStore } from '../stores/catalog'

const catalog = useCatalogStore()

const selectedCategory = ref('全部分類')
const selectedOrg = ref<'all' | string>('all')

onMounted(async () => {
  await Promise.all([
    catalog.fetchOrganizations(),
    catalog.fetchCourses(),
    catalog.fetchTeamProgressRows(),
  ])
})

const categoryByCourseId = computed(() => {
  const map = new Map<string, string>()
  catalog.courses.forEach((course) => {
    map.set(course.id, course.categoryName || '未分類')
  })
  return map
})

const orgNameById = computed(() => {
  const map = new Map<number, string>()
  catalog.organizations.forEach((org) => {
    map.set(org.id, org.shortName)
  })
  return map
})

const filteredRows = computed(() => {
  return catalog.teamProgressRows.filter((row) => {
    if (selectedOrg.value !== 'all' && String(row.orgId ?? '') !== selectedOrg.value) {
      return false
    }
    const categoryName = categoryByCourseId.value.get(row.courseId) || '未分類'
    if (selectedCategory.value !== '全部分類' && categoryName !== selectedCategory.value) {
      return false
    }
    return true
  })
})

const categorySummary = computed(() => {
  const map = new Map<string, { total: number; completed: number; progressSum: number }>()

  filteredRows.value.forEach((row) => {
    const categoryName = categoryByCourseId.value.get(row.courseId) || '未分類'
    const target = map.get(categoryName) ?? { total: 0, completed: 0, progressSum: 0 }
    target.total += 1
    target.completed += row.completedAt ? 1 : 0
    target.progressSum += row.progressPercent
    map.set(categoryName, target)
  })

  return Array.from(map.entries()).map(([name, stat]) => ({
    name,
    averageProgress: stat.total > 0 ? Math.round(stat.progressSum / stat.total) : 0,
    completed: stat.completed,
    total: stat.total,
  })).sort((a, b) => b.averageProgress - a.averageProgress)
})

const categoryOptions = computed(() => ['全部分類', ...new Set(categorySummary.value.map((c) => c.name))])

const lessonSummary = computed(() => {
  const map = new Map<string, {
    courseTitle: string
    lessonTitle: string
    total: number
    completed: number
    progressSum: number
  }>()

  filteredRows.value.forEach((row) => {
    const key = row.lessonId
    const target = map.get(key) ?? {
      courseTitle: row.courseTitle,
      lessonTitle: row.lessonTitle,
      total: 0,
      completed: 0,
      progressSum: 0,
    }
    target.total += 1
    target.completed += row.completedAt ? 1 : 0
    target.progressSum += row.progressPercent
    map.set(key, target)
  })

  return Array.from(map.values()).map((stat) => ({
    ...stat,
    averageProgress: stat.total > 0 ? Math.round(stat.progressSum / stat.total) : 0,
  })).sort((a, b) => b.averageProgress - a.averageProgress)
})

const overallProgress = computed(() => {
  if (filteredRows.value.length === 0) return 0
  const sum = filteredRows.value.reduce((acc, row) => acc + row.progressPercent, 0)
  return Math.round(sum / filteredRows.value.length)
})
</script>

<template>
  <div class="page-stack">
    <section class="panel-card">
      <h2>轄區學習進度總覽</h2>
      <p>大分類顯示平均進度%，點選分類後可看到各影片（lesson）的平均進度%。</p>

      <div class="filters">
        <label>
          門市 / 部門
          <select v-model="selectedOrg" class="form-input">
            <option value="all">全部</option>
            <option v-for="org in catalog.organizations" :key="org.id" :value="String(org.id)">
              {{ org.code }}｜{{ org.shortName }}
            </option>
          </select>
        </label>

        <label>
          分類
          <select v-model="selectedCategory" class="form-input">
            <option v-for="cat in categoryOptions" :key="cat" :value="cat">{{ cat }}</option>
          </select>
        </label>
      </div>

      <div class="progress-row" style="margin-top: .75rem; max-width: 380px;">
        <div class="progress-bar"><span :style="{ width: `${overallProgress}%` }"></span></div>
        <strong>{{ overallProgress }}%</strong>
      </div>
    </section>

    <section class="panel-grid panel-grid--2">
      <article class="panel-card">
        <h3>大分類學習進度</h3>
        <table class="data-table">
          <thead>
            <tr>
              <th>分類</th>
              <th>平均進度</th>
              <th>完成數</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="categorySummary.length === 0">
              <td colspan="3" class="muted-text" style="text-align:center;padding:1rem">目前沒有進度資料</td>
            </tr>
            <tr v-for="cat in categorySummary" :key="cat.name">
              <td>
                <button class="table-action" type="button" @click="selectedCategory = cat.name">{{ cat.name }}</button>
              </td>
              <td>{{ cat.averageProgress }}%</td>
              <td>{{ cat.completed }} / {{ cat.total }}</td>
            </tr>
          </tbody>
        </table>
      </article>

      <article class="panel-card">
        <h3>分類內各影片進度</h3>
        <table class="data-table">
          <thead>
            <tr>
              <th>課程 / 影片</th>
              <th>平均進度</th>
              <th>完成數</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="lessonSummary.length === 0">
              <td colspan="3" class="muted-text" style="text-align:center;padding:1rem">目前沒有進度資料</td>
            </tr>
            <tr v-for="item in lessonSummary" :key="`${item.courseTitle}-${item.lessonTitle}`">
              <td>
                <strong>{{ item.courseTitle }}</strong>
                <div class="muted-text">{{ item.lessonTitle }}</div>
              </td>
              <td>{{ item.averageProgress }}%</td>
              <td>{{ item.completed }} / {{ item.total }}</td>
            </tr>
          </tbody>
        </table>
      </article>
    </section>

    <section class="panel-card">
      <h3>明細資料</h3>
      <table class="data-table">
        <thead>
          <tr>
            <th>人員</th>
            <th>門市/部門</th>
            <th>課程</th>
            <th>影片</th>
            <th>進度</th>
            <th>狀態</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="filteredRows.length === 0">
            <td colspan="6" class="muted-text" style="text-align:center;padding:1rem">目前沒有明細資料</td>
          </tr>
          <tr v-for="row in filteredRows" :key="`${row.staffProfileId}-${row.lessonId}`">
            <td>{{ row.displayName }}<span class="muted-text">（{{ row.employeeNo || '未填員編' }}）</span></td>
            <td>{{ row.orgId ? orgNameById.get(row.orgId) : '未編制' }}</td>
            <td>{{ row.courseTitle }}</td>
            <td>{{ row.lessonTitle }}</td>
            <td>{{ row.progressPercent }}%</td>
            <td>{{ row.completedAt ? '完成' : '學習中' }}</td>
          </tr>
        </tbody>
      </table>
    </section>
  </div>
</template>

<style scoped>
.filters {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.filters label {
  display: grid;
  gap: 0.35rem;
  min-width: 220px;
}
</style>
