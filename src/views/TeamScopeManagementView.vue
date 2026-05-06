<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useCatalogStore } from '../stores/catalog'

const catalog = useCatalogStore()

const selectedManagerId = ref('')
const selectedOrgFilters = ref<string[]>([])
const selectedMemberIds = ref<string[]>([])
const saving = ref(false)
const saveMessage = ref('')

function hasTeamProgressPermission(member: { roles: Array<{ key: string }> }) {
  return member.roles.some((role) =>
    catalog.roles.find((roleDef) => roleDef.key === role.key)?.permissions.includes('team_progress:view'),
  )
}

const managerOptions = computed(() =>
  catalog.staff
    .filter((member) => member.enabled)
    .filter((member) => hasTeamProgressPermission(member))
    .sort((a, b) => a.name.localeCompare(b.name, 'zh-Hant')),
)

const selectedManager = computed(() =>
  managerOptions.value.find((member) => member.id === selectedManagerId.value) ?? null,
)

const scopeCountByManager = computed(() => {
  const map = new Map<string, number>()
  catalog.managerScopes.forEach((scope) => {
    if (!scope.active) return
    map.set(scope.managerId, (map.get(scope.managerId) ?? 0) + 1)
  })
  return map
})

const orgFilterOptions = computed(() =>
  catalog.organizations.map((org) => ({ value: String(org.id), label: `${org.code}｜${org.shortName}` })),
)

const memberCandidates = computed(() =>
  catalog.staff
    .filter((member) => member.enabled)
    .filter((member) => member.id !== selectedManagerId.value)
    .filter((member) => {
      if (selectedOrgFilters.value.length === 0) return true
      return selectedOrgFilters.value.includes(String(member.orgId ?? ''))
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'zh-Hant')),
)

const selectedOrgLabel = computed(() => {
  if (selectedOrgFilters.value.length === 0) return '全部門市 / 部門'
  const names = selectedOrgFilters.value
    .map((id) => catalog.organizations.find((org) => String(org.id) === id)?.shortName)
    .filter(Boolean)
  return names.join('、')
})

const selectedManagerScopes = computed(() =>
  catalog.managerScopes.filter((scope) => scope.managerId === selectedManagerId.value && scope.active),
)

watch(selectedManagerId, (managerId) => {
  saveMessage.value = ''
  if (!managerId) {
    selectedMemberIds.value = []
    return
  }
  selectedMemberIds.value = selectedManagerScopes.value.map((scope) => scope.memberId)
})

watch(
  selectedManagerScopes,
  (scopes) => {
    if (!selectedManagerId.value) return
    selectedMemberIds.value = scopes.map((scope) => scope.memberId)
  },
  { deep: true },
)

function toggleMember(memberId: string) {
  if (selectedMemberIds.value.includes(memberId)) {
    selectedMemberIds.value = selectedMemberIds.value.filter((id) => id !== memberId)
    return
  }
  selectedMemberIds.value = [...selectedMemberIds.value, memberId]
}

function isSelected(memberId: string) {
  return selectedMemberIds.value.includes(memberId)
}

function selectAllVisible() {
  const visibleIds = memberCandidates.value.map((member) => member.id)
  selectedMemberIds.value = Array.from(new Set([...selectedMemberIds.value, ...visibleIds]))
}

function clearAllVisible() {
  const visibleIds = new Set(memberCandidates.value.map((member) => member.id))
  selectedMemberIds.value = selectedMemberIds.value.filter((id) => !visibleIds.has(id))
}

function addAllFromSelectedOrganizations() {
  if (selectedOrgFilters.value.length === 0) return
  const ids = catalog.staff
    .filter((member) => member.enabled)
    .filter((member) => member.id !== selectedManagerId.value)
    .filter((member) => selectedOrgFilters.value.includes(String(member.orgId ?? '')))
    .map((member) => member.id)
  selectedMemberIds.value = Array.from(new Set([...selectedMemberIds.value, ...ids]))
}

function clearOrganizationFilters() {
  selectedOrgFilters.value = []
}

async function saveScope() {
  if (!selectedManagerId.value) return
  saving.value = true
  saveMessage.value = ''
  try {
    await catalog.replaceManagerScope(selectedManagerId.value, selectedMemberIds.value)
    saveMessage.value = '已儲存主管轄下範圍。'
  } catch (err) {
    saveMessage.value = err instanceof Error ? err.message : '儲存失敗'
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  await catalog.fetchOrganizations()
  await catalog.fetchStaff()
  await catalog.fetchManagerScopes()
  if (managerOptions.value.length > 0) {
    selectedManagerId.value = managerOptions.value[0].id
  }
})
</script>

<template>
  <div class="page-stack">
    <section class="panel-card">
      <h2>主管範圍管理</h2>
      <p>設定店長 / 督導 / 主管可查看哪些人員的學習進度（對應資料表：staff_manager_scope）。</p>
    </section>

    <section class="panel-grid panel-grid--2">
      <article class="panel-card">
        <h3>主管清單</h3>
        <p class="muted-text">只顯示「具有 team_progress:view 權限」且啟用中的人員。</p>

        <div class="manager-list">
          <button
            v-for="manager in managerOptions"
            :key="manager.id"
            class="manager-item"
            :class="{ 'is-active': selectedManagerId === manager.id }"
            type="button"
            @click="selectedManagerId = manager.id"
          >
            <div>
              <strong>{{ manager.name }}</strong>
              <p>{{ manager.employeeNo || '未填員編' }}｜{{ manager.orgShortName || '未編制組織' }}</p>
            </div>
            <span>{{ scopeCountByManager.get(manager.id) ?? 0 }} 人</span>
          </button>
        </div>
      </article>

      <article class="panel-card">
        <h3>轄下人員指派</h3>

        <template v-if="!selectedManager">
          <p class="muted-text">請先從左側選擇主管。</p>
        </template>

        <template v-else>
          <p>
            目前主管：
            <strong>{{ selectedManager.name }}</strong>
            （{{ selectedManager.employeeNo || '未填員編' }}）
          </p>

          <div class="actions">
            <select v-model="selectedOrgFilters" class="filter-select" multiple size="5">
              <option v-for="opt in orgFilterOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
            </select>
            <button class="table-action" type="button" @click="selectAllVisible">全選目前篩選</button>
            <button class="table-action" type="button" @click="clearAllVisible">清除目前篩選</button>
            <button class="table-action" type="button" :disabled="selectedOrgFilters.length === 0" @click="addAllFromSelectedOrganizations">
              加入所選門市全部人員
            </button>
            <button class="table-action" type="button" @click="clearOrganizationFilters">清空門市篩選</button>
          </div>

          <div class="muted-text">
            目前門市篩選：{{ selectedOrgLabel }}
          </div>

          <div class="member-list">
            <label v-for="member in memberCandidates" :key="member.id" class="member-item">
              <input :checked="isSelected(member.id)" type="checkbox" @change="toggleMember(member.id)" />
              <span>
                <strong>{{ member.name }}</strong>
                <small>{{ member.employeeNo || '未填員編' }}｜{{ member.orgShortName || '未編制組織' }}</small>
              </span>
            </label>
          </div>

          <div class="actions">
            <button class="btn btn--primary" type="button" :disabled="saving" @click="saveScope">
              {{ saving ? '儲存中...' : '儲存主管範圍' }}
            </button>
            <span v-if="saveMessage" class="muted-text">{{ saveMessage }}</span>
          </div>
        </template>
      </article>
    </section>
  </div>
</template>

<style scoped>
.manager-list {
  display: grid;
  gap: 0.5rem;
  max-height: 420px;
  overflow: auto;
}

.manager-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  text-align: left;
  border: 1px solid var(--color-border, #4b3a2f);
  border-radius: 12px;
  background: transparent;
  color: inherit;
  padding: 0.65rem 0.75rem;
  cursor: pointer;
}

.manager-item.is-active {
  border-color: var(--color-primary, #f59e0b);
  background: color-mix(in srgb, var(--color-primary, #f59e0b) 14%, transparent);
}

.manager-item p {
  margin: 0.2rem 0 0;
  opacity: 0.72;
  font-size: 0.82rem;
}

.actions {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  flex-wrap: wrap;
  margin: 0.75rem 0;
}

.member-list {
  display: grid;
  gap: 0.5rem;
  max-height: 320px;
  overflow: auto;
  border-top: 1px solid var(--color-border, #4b3a2f);
  border-bottom: 1px solid var(--color-border, #4b3a2f);
  padding: 0.75rem 0;
}

.member-item {
  display: flex;
  gap: 0.6rem;
  align-items: center;
}

.member-item span {
  display: grid;
}

.member-item small {
  opacity: 0.7;
}

@media (max-width: 960px) {
  .panel-grid--2 {
    grid-template-columns: 1fr;
  }
}
</style>
