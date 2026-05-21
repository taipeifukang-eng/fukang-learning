<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useAuthStore } from '../stores/auth'
import { useCatalogStore } from '../stores/catalog'
import { supabase } from '../lib/supabase'

const auth = useAuthStore()
const catalog = useCatalogStore()

const filterJobTitle = ref<string>('all')
const filterEnabled = ref<'all' | 'enabled' | 'disabled'>('all')
const editingId = ref<string | null>(null)
const editEmployeeNo = ref('')
const editName = ref('')
const editJobTitle = ref('')
const saving = ref(false)
const syncing = ref(false)
const syncResult = ref('')

const canToggle = computed(() => auth.hasPermission('staff:toggle'))
const canEdit = computed(() => auth.hasPermission('staff:assign_role') || auth.hasPermission('staff:toggle'))

const jobTitleOptions = computed(() => {
  const titles = catalog.staff.map((m) => m.jobTitle).filter(Boolean)
  return [...new Set(titles)].sort()
})

const filteredStaff = computed(() => {
  return catalog.staff.filter((member) => {
    if (filterJobTitle.value !== 'all' && member.jobTitle !== filterJobTitle.value) return false
    if (filterEnabled.value === 'enabled' && !member.enabled) return false
    if (filterEnabled.value === 'disabled' && member.enabled) return false
    return true
  })
})

function startEdit(id: string) {
  const target = catalog.staff.find((item) => item.id === id)
  if (!target) return
  editingId.value = id
  editEmployeeNo.value = target.employeeNo
  editName.value = target.name
  editJobTitle.value = target.jobTitle
}

function cancelEdit() {
  editingId.value = null
}

async function saveEdit(id: string) {
  const target = catalog.staff.find((item) => item.id === id)
  if (!target) return

  saving.value = true
  try {
    if (editEmployeeNo.value !== target.employeeNo) {
      await catalog.updateStaffEmployeeNo(id, editEmployeeNo.value)
    }
    if (editName.value.trim() && editName.value.trim() !== target.name) {
      await catalog.updateStaffName(id, editName.value.trim())
    }
    if (editJobTitle.value.trim() !== target.jobTitle) {
      await catalog.updateStaffJobTitle(id, editJobTitle.value.trim())
    }
    editingId.value = null
  } finally {
    saving.value = false
  }
}

async function syncJobTitles() {
  syncing.value = true
  syncResult.value = ''
  try {
    const { data, error } = await supabase.functions.invoke('sync-job-titles')
    if (error) throw error
    syncResult.value = `同步完成：${data?.updated ?? 0} 筆更新`
    await catalog.fetchStaff()
  } catch (e: any) {
    syncResult.value = `同步失敗：${e.message}`
  } finally {
    syncing.value = false
  }
}

onMounted(async () => {
  await catalog.fetchStaff()

  // 背景靜默同步職位（不擋畫面，完成後自動刷新）
  supabase.functions.invoke('sync-job-titles').then(({ error }) => {
    if (!error) catalog.fetchStaff()
  }).catch(() => { /* 靜默失敗 */ })
})
</script>

<template>
  <div class="page-stack">
    <section class="panel-card">
      <div class="section-heading">
        <div>
          <h2>用戶管理</h2>
          <p>管理已完成 LINE 登入的用戶，維護員編、職位名稱與登入權限。</p>
        </div>
        <div style="display:flex;gap:.5rem;align-items:center">
          <span v-if="syncResult" :class="syncResult.includes('失敗') ? 'sync-err' : 'sync-ok'">《 {{ syncResult }} 》</span>
          <button class="table-action is-primary" :disabled="syncing" @click="syncJobTitles">
            {{ syncing ? '同步中…' : '同步職位' }}
          </button>
        </div>
      </div>

      <div class="filter-bar">
        <select v-model="filterJobTitle" class="filter-select">
          <option value="all">全部職位</option>
          <option v-for="t in jobTitleOptions" :key="t" :value="t">{{ t }}</option>
        </select>

        <select v-model="filterEnabled" class="filter-select">
          <option value="all">全部狀態</option>
          <option value="enabled">啟用中</option>
          <option value="disabled">已停用</option>
        </select>

        <span class="filter-count">共 {{ filteredStaff.length }} 位登入者</span>
      </div>

      <div v-if="catalog.error" class="error-banner">資料載入失敗：{{ catalog.error }}</div>
    </section>

    <section class="panel-card">
      <div class="data-table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>員編</th>
              <th>姓名</th>
              <th>Email</th>
              <th>職位名稱</th>
              <th>狀態</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <template v-for="member in filteredStaff" :key="member.id">
              <tr v-if="editingId !== member.id">
                <td>{{ member.employeeNo || '未填' }}</td>
                <td>{{ member.name }}</td>
                <td>{{ member.email || '—' }}</td>
                <td>
                  <span v-if="member.jobTitle" class="job-title-chip">{{ member.jobTitle }}</span>
                  <span v-else class="text-muted">未填寫</span>
                </td>
                <td>
                  <span class="status-pill" :class="member.enabled ? 'is-enabled' : 'is-disabled'">
                    {{ member.enabled ? '啟用中' : '已停用' }}
                  </span>
                </td>
                <td class="action-cell">
                  <button class="table-action" type="button" @click="startEdit(member.id)">編輯</button>
                  <button
                    class="table-action"
                    :class="member.enabled ? 'is-danger' : ''"
                    type="button"
                    :disabled="!canToggle"
                    @click="catalog.toggleStaffStatus(member.id, !member.enabled)"
                  >
                    {{ member.enabled ? '停用' : '啟用' }}
                  </button>
                </td>
              </tr>

              <tr v-else class="editing-row">
                <td><input v-model="editEmployeeNo" class="inline-input" placeholder="請輸入員編" /></td>
                <td><input v-model="editName" class="inline-input" placeholder="請輸入姓名" /></td>
                <td>{{ member.email || '—' }}</td>
                <td>
                  <input v-model="editJobTitle" class="inline-input" placeholder="職位名稱" />
                </td>
                <td>
                  <span class="status-pill" :class="member.enabled ? 'is-enabled' : 'is-disabled'">
                    {{ member.enabled ? '啟用中' : '已停用' }}
                  </span>
                </td>
                <td class="action-cell">
                  <button class="table-action is-primary" type="button" :disabled="saving" @click="saveEdit(member.id)">
                    {{ saving ? '儲存中…' : '儲存' }}
                  </button>
                  <button class="table-action" type="button" @click="cancelEdit">取消</button>
                </td>
              </tr>
            </template>

            <tr v-if="filteredStaff.length === 0">
              <td colspan="6" class="empty-row">目前沒有登入者資料</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>

<style scoped>
.filter-bar {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
  margin-top: 1rem;
}

.filter-select,
.inline-input {
  min-width: 160px;
  padding: 0.65rem 0.8rem;
  border-radius: 10px;
  border: 1px solid var(--color-border, #473729);
  background: var(--color-surface, transparent);
  color: inherit;
}

.filter-count {
  margin-left: auto;
  font-size: 0.85rem;
  opacity: 0.68;
}

.role-badge {
  display: inline-block;
  margin-right: 0.35rem;
  padding: 0.2rem 0.55rem;
  border-radius: 999px;
  background: color-mix(in srgb, var(--color-secondary) 22%, transparent);
  color: var(--color-secondary);
  font-size: 0.8rem;
}

.job-title-chip {
  display: inline-block;
  padding: 0.2rem 0.6rem;
  border-radius: 999px;
  background: color-mix(in srgb, var(--color-primary, #f59e0b) 16%, transparent);
  color: var(--color-primary, #d97706);
  font-size: 0.8rem;
  font-weight: 500;
}

.sync-ok {
  font-size: 0.82rem;
  color: #059669;
  opacity: .85;
}

.sync-err {
  font-size: 0.82rem;
  color: #dc2626;
  opacity: .85;
}

.text-muted {
  opacity: 0.45;
}

.action-cell {
  display: flex;
  gap: 0.45rem;
}

.editing-row {
  background: color-mix(in srgb, var(--color-primary) 5%, transparent);
}

.table-action.is-danger {
  color: #f87171;
  border-color: #f8717140;
}

.table-action.is-primary {
  color: var(--color-primary);
  border-color: var(--color-primary);
}

.empty-row {
  text-align: center;
  opacity: 0.45;
  padding: 2rem 0;
}

.error-banner {
  margin-top: 1rem;
  padding: 0.75rem 1rem;
  border-radius: 8px;
  background: color-mix(in srgb, #f87171 15%, transparent);
  border: 1px solid #f8717150;
  color: #f87171;
  font-size: 0.85rem;
}
</style>
