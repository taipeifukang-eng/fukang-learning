<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useAuthStore } from '../stores/auth'
import { useCatalogStore } from '../stores/catalog'
import type { OrgType } from '../data/mockData'

const auth = useAuthStore()
const catalog = useCatalogStore()

const filterType = ref<'all' | OrgType>('all')
const filterSupervisor = ref<string>('all')
const editingId = ref<number | null>(null)
const code = ref('')
const shortName = ref('')
const supervisor = ref('')
const type = ref<OrgType>('store')
const saving = ref(false)

const canEdit = computed(() => auth.hasPermission('orgs:edit'))
const deleting = ref<number | null>(null)
const supervisorOptions = computed(() => {
  const names = catalog.organizations.map((o) => o.supervisor).filter(Boolean)
  return [...new Set(names)].sort()
})
const filteredOrganizations = computed(() => {
  return catalog.organizations.filter((item) => {
    if (filterType.value !== 'all' && item.type !== filterType.value) return false
    if (filterSupervisor.value !== 'all' && item.supervisor !== filterSupervisor.value) return false
    return true
  })
})

function typeLabel(value: OrgType) {
  return value === 'headquarters' ? '總部' : '門市'
}

function resetForm() {
  editingId.value = null
  code.value = ''
  shortName.value = ''
  supervisor.value = ''
  type.value = 'store'
}

function startEdit(id: number) {
  const target = catalog.organizations.find((item) => item.id === id)
  if (!target) return
  editingId.value = target.id
  code.value = target.code
  shortName.value = target.shortName
  supervisor.value = target.supervisor
  type.value = target.type
}

async function submitOrganization() {
  saving.value = true
  try {
    await catalog.upsertOrganization({
      id: editingId.value ?? undefined,
      code: code.value,
      shortName: shortName.value,
      supervisor: supervisor.value,
      type: type.value,
    })
    resetForm()
  } catch (error) {
    catalog.error = error instanceof Error ? error.message : String(error)
  } finally {
    saving.value = false
  }
}

async function confirmDelete(id: number, name: string) {
  if (!confirm(`確定要刪除「${name}」？此操作無法復原。`)) return
  deleting.value = id
  try {
    await catalog.deleteOrganization(id)
    if (editingId.value === id) resetForm()
  } catch (error) {
    catalog.error = error instanceof Error ? error.message : String(error)
  } finally {
    deleting.value = null
  }
}

onMounted(async () => {
  await catalog.fetchOrganizations()
})
</script>

<template>
  <div class="page-stack">
    <section class="panel-card">
      <div class="section-heading">
        <div>
          <h2>組織管理</h2>
          <p>維護門市與總部部門資料，提供人員管理拖曳編制使用。</p>
        </div>
      </div>

      <div class="filter-bar">
        <select v-model="filterType" class="filter-select">
          <option value="all">全部類型</option>
          <option value="headquarters">總部</option>
          <option value="store">門市</option>
        </select>
        <select v-model="filterSupervisor" class="filter-select">
          <option value="all">全部督導</option>
          <option v-for="name in supervisorOptions" :key="name" :value="name">{{ name }}</option>
        </select>
        <span class="filter-count">共 {{ filteredOrganizations.length }} 筆組織</span>
      </div>
    </section>

    <section class="panel-card management-grid">
      <form class="organization-form" @submit.prevent="submitOrganization">
        <h3>{{ editingId ? '編輯組織' : '新增組織' }}</h3>
        <label>
          <span>門市代號</span>
          <input v-model="code" class="text-input" maxlength="20" :disabled="!canEdit" required />
        </label>
        <label>
          <span>門市 / 總部</span>
          <select v-model="type" class="text-input" :disabled="!canEdit">
            <option value="headquarters">總部</option>
            <option value="store">門市</option>
          </select>
        </label>
        <label>
          <span>門市 / 部門簡稱</span>
          <input v-model="shortName" class="text-input" maxlength="40" :disabled="!canEdit" required />
        </label>
        <label>
          <span>督導</span>
          <input v-model="supervisor" class="text-input" maxlength="20" placeholder="請輸入督導姓名" :disabled="!canEdit" />
        </label>

        <div class="form-actions">
          <button class="table-action is-primary" type="submit" :disabled="!canEdit || saving">
            {{ saving ? '儲存中…' : editingId ? '更新組織' : '新增組織' }}
          </button>
          <button v-if="editingId" class="table-action" type="button" @click="resetForm">取消</button>
        </div>
      </form>

      <div class="data-table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>門市代號</th>
              <th>門市 / 總部</th>
              <th>門市 / 部門簡稱</th>
              <th>督導</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="organization in filteredOrganizations" :key="organization.id">
              <td>{{ organization.code }}</td>
              <td>{{ typeLabel(organization.type) }}</td>
              <td>{{ organization.shortName }}</td>
              <td>{{ organization.supervisor || '—' }}</td>
              <td class="action-cell">
                <button class="table-action" type="button" :disabled="!canEdit" @click="startEdit(organization.id)">
                  編輯
                </button>
                <button
                  class="table-action table-action--danger"
                  type="button"
                  :disabled="!canEdit || deleting === organization.id"
                  @click="confirmDelete(organization.id, organization.shortName)"
                >
                  {{ deleting === organization.id ? '刪除中…' : '刪除' }}
                </button>
              </td>
            </tr>
            <tr v-if="filteredOrganizations.length === 0">
              <td colspan="5" class="empty-row">目前沒有組織資料</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>

<style scoped>
.management-grid {
  display: grid;
  grid-template-columns: 320px minmax(0, 1fr);
  gap: 1rem;
}

.organization-form {
  display: grid;
  gap: 0.85rem;
  align-content: start;
  align-self: start;
  position: sticky;
  top: 1rem;
}

.organization-form label {
  display: grid;
  gap: 0.35rem;
}

.organization-form span {
  font-size: 0.85rem;
  opacity: 0.72;
}

.filter-bar {
  display: flex;
  gap: 0.75rem;
  align-items: center;
  margin-top: 1rem;
}

.filter-select,
.text-input {
  width: 100%;
  padding: 0.7rem 0.85rem;
  border-radius: 10px;
  border: 1px solid var(--color-border, #473729);
  background: var(--color-surface, #1f1711);
  color: inherit;
}

.filter-select {
  width: auto;
  min-width: 160px;
}

.filter-count {
  margin-left: auto;
  font-size: 0.85rem;
  opacity: 0.65;
}

.form-actions {
  display: flex;
  gap: 0.6rem;
}

.empty-row {
  text-align: center;
  opacity: 0.45;
  padding: 2rem 0;
}

.action-cell {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.table-action--danger {
  color: #f87171;
  border-color: color-mix(in srgb, #f87171 40%, transparent);
}

@media (max-width: 960px) {
  .management-grid {
    grid-template-columns: 1fr;
  }
}
</style>
