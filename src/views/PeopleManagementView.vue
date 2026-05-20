<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useAuthStore } from '../stores/auth'
import { useCatalogStore } from '../stores/catalog'
import type { OrgType } from '../data/mockData'

const auth = useAuthStore()
const catalog = useCatalogStore()

const activeOrganizationId = ref<number | null>(null)
const draggingStaffId = ref<string | null>(null)
const draggingOver = ref(false)
const moving = ref(false)
const filterSupervisor = ref<string>('all')

const canAssignOrg = computed(() => auth.hasPermission('staff:assign_org'))
const unassignedStaff = computed(() => catalog.staff.filter((member) => member.orgId === null))
const supervisorOptions = computed(() => {
  const names = catalog.organizations.map((o) => o.supervisor).filter(Boolean)
  return [...new Set(names)].sort()
})
const visibleOrganizations = computed(() => {
  if (filterSupervisor.value === 'all') return catalog.organizations
  return catalog.organizations.filter((o) => o.supervisor === filterSupervisor.value)
})
const activeOrganization = computed(() =>
  catalog.organizations.find((o) => o.id === activeOrganizationId.value) ?? null,
)
const activeMembers = computed(() =>
  activeOrganizationId.value ? catalog.staff.filter((m) => m.orgId === activeOrganizationId.value) : [],
)

function typeLabel(value: OrgType) {
  return value === 'headquarters' ? '總部' : '門市'
}

function membersOf(orgId: number) {
  return catalog.staff.filter((member) => member.orgId === orgId)
}

function selectOrganization(id: number) {
  activeOrganizationId.value = activeOrganizationId.value === id ? null : id
}

function handleDragStart(staffId: string) {
  draggingStaffId.value = staffId
}

function handleDragEnd() {
  draggingStaffId.value = null
  draggingOver.value = false
}

async function assignDraggedStaff() {
  if (!draggingStaffId.value || !activeOrganizationId.value || !canAssignOrg.value) return
  moving.value = true
  try {
    await catalog.updateStaffOrg(draggingStaffId.value, activeOrganizationId.value)
  } finally {
    draggingStaffId.value = null
    draggingOver.value = false
    moving.value = false
  }
}

async function removeFromOrganization(staffId: string) {
  moving.value = true
  try {
    await catalog.updateStaffOrg(staffId, null)
  } finally {
    moving.value = false
  }
}

onMounted(async () => {
  await catalog.fetchOrganizations()
  await catalog.fetchStaff()
})
</script>

<template>
  <div class="page-stack">
    <section class="panel-card">
      <div class="section-heading">
        <div>
          <h2>人員管理</h2>
          <p>從左側點選組織進入編輯模式，右側面板即可拖曳待編制人員加入或移出。</p>
        </div>
      </div>
      <div class="filter-bar">
        <select v-model="filterSupervisor" class="filter-select">
          <option value="all">全部督導/副理</option>
          <option v-for="name in supervisorOptions" :key="name" :value="name">{{ name }}</option>
        </select>
        <span class="filter-count">顯示 {{ visibleOrganizations.length }} 個組織</span>
      </div>
    </section>

    <section class="management-board">
      <!-- 左側：組織清單 -->
      <div class="org-list">
        <article
          v-for="organization in visibleOrganizations"
          :key="organization.id"
          class="org-list-item panel-card"
          :class="{ 'is-active': activeOrganizationId === organization.id }"
          @click="canAssignOrg && selectOrganization(organization.id)"
        >
          <div class="org-list-item__meta">{{ organization.code }}｜{{ typeLabel(organization.type) }}</div>
          <div class="org-list-item__name">{{ organization.shortName }}</div>
          <div class="org-list-item__count">{{ membersOf(organization.id).length }} 人</div>
        </article>
      </div>

      <!-- 右側：黏性編輯面板 -->
      <aside class="edit-panel panel-card">
        <!-- 尚未選取組織 -->
        <template v-if="!activeOrganization">
          <div class="edit-panel__empty">
            <p>← 點選左側組織開始編制人員</p>
          </div>
        </template>

        <!-- 已選取組織 -->
        <template v-else>
          <div class="edit-panel__header">
            <div>
              <div class="org-meta">{{ activeOrganization.code }}｜{{ typeLabel(activeOrganization.type) }}</div>
              <h3>{{ activeOrganization.shortName }}</h3>
            </div>
            <button class="table-action" type="button" @click="activeOrganizationId = null">結束編輯</button>
          </div>

          <!-- 組織成員（drop zone） -->
          <div
            class="drop-zone"
            :class="{ 'is-over': draggingOver, 'is-busy': moving }"
            @dragover.prevent="draggingOver = true"
            @dragleave="draggingOver = false"
            @drop.prevent="assignDraggedStaff"
          >
            <p class="drop-zone__label">組織成員</p>

            <div class="member-list">
              <article v-for="member in activeMembers" :key="member.id" class="member-row">
                <div>
                  <strong>{{ member.employeeNo || '未填員編' }}</strong>
                  <span>{{ member.name }}</span>
                </div>
                <button
                  class="table-action table-action--danger"
                  type="button"
                  :disabled="moving"
                  @click="removeFromOrganization(member.id)"
                >
                  移出
                </button>
              </article>
            </div>

            <p v-if="activeMembers.length === 0" class="empty-text">目前沒有編制人員。</p>
            <p class="drop-hint">↓ 將下方人員拖曳到此處即可加入</p>
          </div>

          <!-- 待編制人員（可拖曳） -->
          <div class="unassigned-pool">
            <p class="pool-label">待編制人員（{{ unassignedStaff.length }}）</p>

            <div class="staff-pool" :class="{ 'is-empty': unassignedStaff.length === 0 }">
              <article
                v-for="member in unassignedStaff"
                :key="member.id"
                class="staff-chip"
                draggable="true"
                @dragstart="handleDragStart(member.id)"
                @dragend="handleDragEnd"
              >
                <div class="chip-info">
                  <strong>{{ member.name || '未命名' }}</strong>
                  <span>{{ member.employeeNo || '未填員編' }}</span>
                </div>
                <span class="drag-icon">☰</span>
              </article>

              <p v-if="unassignedStaff.length === 0" class="empty-text">沒有待編制人員。</p>
            </div>
          </div>
        </template>
      </aside>
    </section>
  </div>
</template>

<style scoped>
/* ── 整體版面 ── */
.management-board {
  display: grid;
  grid-template-columns: 280px minmax(0, 1fr);
  gap: 1rem;
  align-items: start;
}

/* ── 左側：組織清單 ── */
.org-list {
  display: grid;
  gap: 0.5rem;
}

.org-list-item {
  display: grid;
  grid-template-columns: 1fr auto;
  grid-template-rows: auto auto;
  gap: 0.15rem 0.75rem;
  padding: 0.85rem 1rem;
  cursor: pointer;
  border: 1px solid var(--color-border, #473729);
  border-radius: 14px;
  transition: border-color 0.18s ease, background 0.18s ease;
}

.org-list-item:hover {
  border-color: color-mix(in srgb, var(--color-primary) 50%, transparent);
}

.org-list-item.is-active {
  border-color: var(--color-primary);
  background: color-mix(in srgb, var(--color-primary) 10%, transparent);
}

.org-list-item__meta {
  font-size: 0.78rem;
  opacity: 0.6;
  grid-column: 1;
}

.org-list-item__name {
  font-weight: 600;
  font-size: 0.97rem;
  grid-column: 1;
}

.org-list-item__count {
  font-size: 0.82rem;
  opacity: 0.65;
  grid-column: 2;
  grid-row: 1 / 3;
  align-self: center;
}

/* ── 右側：黏性編輯面板 ── */
.edit-panel {
  position: sticky;
  top: 1rem;
  max-height: calc(100vh - 2rem);
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.edit-panel__empty {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 260px;
  opacity: 0.5;
  font-size: 0.95rem;
}

.edit-panel__header {
  display: flex;
  justify-content: space-between;
  align-items: start;
  gap: 1rem;
}

/* ── Drop Zone（組織成員） ── */
.drop-zone {
  border: 2px dashed color-mix(in srgb, var(--color-primary) 35%, transparent);
  border-radius: 16px;
  padding: 0.85rem;
  background: color-mix(in srgb, var(--color-primary) 5%, transparent);
  transition: border-color 0.18s ease, background 0.18s ease;
}

.drop-zone.is-over {
  border-color: var(--color-primary);
  background: color-mix(in srgb, var(--color-primary) 14%, transparent);
}

.drop-zone__label {
  font-size: 0.8rem;
  font-weight: 600;
  opacity: 0.6;
  margin: 0 0 0.6rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

/* ── 待編制人員 ── */
.unassigned-pool {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.pool-label {
  font-size: 0.8rem;
  font-weight: 600;
  opacity: 0.6;
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.staff-pool {
  display: grid;
  gap: 0.5rem;
  padding: 0.75rem;
  border: 1px dashed color-mix(in srgb, var(--color-primary) 28%, transparent);
  border-radius: 14px;
  background: color-mix(in srgb, var(--color-primary) 3%, transparent);
}

/* ── 共用：人員卡片 ── */
.staff-chip,
.member-row {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  align-items: center;
  padding: 0.65rem 0.85rem;
  border-radius: 10px;
  background: color-mix(in srgb, var(--color-surface) 88%, black 12%);
  border: 1px solid var(--color-border, #473729);
}

.staff-chip {
  cursor: grab;
}

.staff-chip:active {
  cursor: grabbing;
  opacity: 0.7;
}

.staff-chip strong,
.member-row strong {
  display: block;
  font-size: 0.88rem;
}

.staff-chip span,
.member-row span {
  display: block;
  font-size: 0.8rem;
  opacity: 0.7;
}

.chip-info {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}

.drag-icon {
  font-size: 1rem;
  opacity: 0.4;
  flex-shrink: 0;
}

.member-list {
  display: grid;
  gap: 0.5rem;
}

.table-action--danger {
  color: #f87171;
  border-color: color-mix(in srgb, #f87171 40%, transparent);
}

.drop-hint,
.empty-text {
  margin: 0.65rem 0 0;
  font-size: 0.82rem;
  opacity: 0.55;
  text-align: center;
}

.org-meta {
  font-size: 0.82rem;
  opacity: 0.65;
  margin-bottom: 0.15rem;
}

.filter-bar {
  display: flex;
  gap: 0.75rem;
  align-items: center;
  margin-top: 1rem;
}

.filter-select {
  width: auto;
  min-width: 160px;
  padding: 0.7rem 0.85rem;
  border-radius: 10px;
  border: 1px solid var(--color-border, #473729);
  background: var(--color-surface, transparent);
  color: inherit;
}

.filter-count {
  margin-left: auto;
  font-size: 0.85rem;
  opacity: 0.65;
}

@media (max-width: 900px) {
  .management-board {
    grid-template-columns: 1fr;
  }

  .edit-panel {
    position: static;
    max-height: none;
  }
}
</style>
