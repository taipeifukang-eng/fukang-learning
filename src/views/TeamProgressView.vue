<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useCatalogStore } from '../stores/catalog'
import { useAuthStore } from '../stores/auth'

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

  // 1. 督導：在組織管理中登記為 supervisor 的組織（以 display name 比對）
  catalog.organizations.forEach((org) => {
    if (org.supervisor && org.supervisor === user.name) ids.add(org.id)
  })

  // 2. 明確指派：staff_manager_org_scope
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
</style>
