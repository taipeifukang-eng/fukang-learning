<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useCatalogStore, type DbPermission, type RoleMember } from '../stores/catalog'

const catalog = useCatalogStore()

// ── View 狀態 ───────────────────────────────────────────────
const viewMode = ref<'list' | 'detail'>('list')
const selectedRoleId = ref<number | null>(null)
const activeTab = ref<'permissions' | 'members'>('permissions')
const loadingDetail = ref(false)

// ── 角色詳細資料 ────────────────────────────────────────────
const selectedPermIds = ref<Set<number>>(new Set())
const roleMembers = ref<RoleMember[]>([])
const savingPerms = ref(false)
const savingPermErr = ref('')

// ── 新增角色 ────────────────────────────────────────────────
const showAddForm = ref(false)
const addForm = reactive({ key: '', title: '', description: '' })
const addErr = ref('')
const adding = ref(false)

// ── 編輯角色資訊 ────────────────────────────────────────────
const editingInfo = ref(false)
const editInfoForm = reactive({ key: '', title: '', description: '' })
const editInfoErr = ref('')
const savingInfo = ref(false)

// ── 新增成員 ────────────────────────────────────────────────
const showAddMember = ref(false)
const addMemberNo = ref('')
const addMemberErr = ref('')
const addingMember = ref(false)

// ── Computed ────────────────────────────────────────────────
const selectedRole = computed(() =>
  catalog.allRoles.find(r => r.id === selectedRoleId.value) ?? null,
)

const permsByCategory = computed(() => {
  const groups = new Map<string, DbPermission[]>()
  const ORDER = ['儀表板', '人員管理', '角色權限', '課程管理', '測驗管理', '學習專區', '組織管理', '分類管理', '學習進度']
  for (const p of catalog.allPermissions) {
    const cat = p.category || '一般'
    if (!groups.has(cat)) groups.set(cat, [])
    groups.get(cat)!.push(p)
  }
  const result: { cat: string; perms: DbPermission[] }[] = []
  for (const cat of ORDER) {
    if (groups.has(cat)) result.push({ cat, perms: groups.get(cat)! })
  }
  for (const [cat, perms] of groups) {
    if (!ORDER.includes(cat)) result.push({ cat, perms })
  }
  return result
})

const grantedCount = computed(() => selectedPermIds.value.size)

// ── Methods ────────────────────────────────────────────────
onMounted(async () => {
  await Promise.all([catalog.fetchAllRoles(), catalog.fetchAllPermissions()])
})

async function openRole(id: number) {
  selectedRoleId.value = id
  viewMode.value = 'detail'
  activeTab.value = 'permissions'
  editingInfo.value = false
  loadingDetail.value = true
  try {
    const [permIds, members] = await Promise.all([
      catalog.fetchRolePermissionIds(id),
      catalog.fetchRoleMembers(id),
    ])
    selectedPermIds.value = new Set(permIds)
    roleMembers.value = members
  } finally {
    loadingDetail.value = false
  }
}

function backToList() {
  viewMode.value = 'list'
  selectedRoleId.value = null
  editingInfo.value = false
  showAddForm.value = false
}

function togglePerm(id: number) {
  const s = new Set(selectedPermIds.value)
  s.has(id) ? s.delete(id) : s.add(id)
  selectedPermIds.value = s
}

function catCheckedCount(perms: DbPermission[]) {
  return perms.filter(p => selectedPermIds.value.has(p.id)).length
}

function selectAllInCat(perms: DbPermission[]) {
  const s = new Set(selectedPermIds.value)
  perms.forEach(p => s.add(p.id))
  selectedPermIds.value = s
}

function clearAllInCat(perms: DbPermission[]) {
  const s = new Set(selectedPermIds.value)
  perms.forEach(p => s.delete(p.id))
  selectedPermIds.value = s
}

async function savePermissions() {
  if (!selectedRoleId.value) return
  savingPerms.value = true
  savingPermErr.value = ''
  try {
    await catalog.saveRolePermissions(selectedRoleId.value, Array.from(selectedPermIds.value))
  } catch (e: any) {
    savingPermErr.value = e.message
  } finally {
    savingPerms.value = false
  }
}

async function submitCreateRole() {
  if (!addForm.key || !addForm.title) { addErr.value = '請填寫角色名稱與代碼'; return }
  adding.value = true
  addErr.value = ''
  try {
    const newId = await catalog.createRole(addForm)
    showAddForm.value = false
    addForm.key = addForm.title = addForm.description = ''
    await openRole(newId)
  } catch (e: any) {
    addErr.value = e.message
  } finally {
    adding.value = false
  }
}

function startEditInfo() {
  if (!selectedRole.value) return
  editInfoForm.key = selectedRole.value.key
  editInfoForm.title = selectedRole.value.title
  editInfoForm.description = selectedRole.value.description
  editingInfo.value = true
}

async function saveInfo() {
  if (!selectedRoleId.value) return
  savingInfo.value = true
  editInfoErr.value = ''
  try {
    await catalog.updateRole(selectedRoleId.value, editInfoForm)
    editingInfo.value = false
  } catch (e: any) {
    editInfoErr.value = e.message
  } finally {
    savingInfo.value = false
  }
}

async function toggleRoleStatus(id: number, enabled: boolean) {
  try {
    await catalog.toggleRoleEnabled(id, !enabled)
  } catch (e: any) {
    alert(e.message)
  }
}

async function handleDeleteRole(id: number) {
  if (!confirm('確定刪除此角色？此操作無法復原。')) return
  try {
    await catalog.deleteRole(id)
  } catch (e: any) {
    alert(e.message)
  }
}

async function addMember() {
  if (!addMemberNo.value.trim() || !selectedRoleId.value) return
  addingMember.value = true
  addMemberErr.value = ''
  try {
    const profile = await catalog.addMemberToRole(selectedRoleId.value, addMemberNo.value)
    roleMembers.value.push({
      staffProfileId: profile.id,
      displayName: profile.display_name,
      employeeNo: profile.employee_no ?? '',
      email: profile.email ?? '',
      enabled: profile.enabled,
      assignedAt: new Date().toISOString(),
    })
    addMemberNo.value = ''
    showAddMember.value = false
  } catch (e: any) {
    addMemberErr.value = e.message
  } finally {
    addingMember.value = false
  }
}

async function removeMember(staffId: string) {
  if (!confirm('確定移除此人員的角色？') || !selectedRoleId.value) return
  try {
    await catalog.removeMemberFromRole(selectedRoleId.value, staffId)
    roleMembers.value = roleMembers.value.filter(m => m.staffProfileId !== staffId)
  } catch (e: any) {
    alert(e.message)
  }
}

function formatDate(iso: string) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('zh-TW')
}

function getActionTag(key: string): { label: string; cls: string } | null {
  if (key.includes(':view'))    return { label: '檢視', cls: 'tag--view' }
  if (key.includes(':edit'))    return { label: '編輯', cls: 'tag--edit' }
  if (key.includes(':attempt')) return { label: '進行', cls: 'tag--attempt' }
  if (key.includes(':toggle') || key.includes(':assign'))
    return { label: '操作', cls: 'tag--action' }
  return null
}
</script>

<template>
  <div class="page-stack">

    <!-- ── 角色列表 ── -->
    <template v-if="viewMode === 'list'">
      <section class="panel-card">
        <div class="panel-header">
          <div>
            <h2 style="margin:0">角色管理</h2>
            <p class="muted-text" style="margin:.25rem 0 0">管理系統角色及其權限設定</p>
          </div>
          <button class="btn btn--primary" @click="showAddForm = true">+ 新增角色</button>
        </div>

        <!-- 新增角色 inline form -->
        <div v-if="showAddForm" class="add-role-form">
          <h4>新增角色</h4>
          <div class="form-row">
            <label>角色名稱<input v-model="addForm.title" placeholder="e.g. 督導角色" class="form-input" /></label>
            <label>角色代碼<input v-model="addForm.key" placeholder="e.g. supervisor_role" class="form-input" /></label>
          </div>
          <label>說明<input v-model="addForm.description" placeholder="角色用途描述" class="form-input" /></label>
          <p v-if="addErr" class="err-text">{{ addErr }}</p>
          <div class="form-actions">
            <button class="btn btn--ghost" @click="showAddForm = false; addErr = ''">取消</button>
            <button class="btn btn--primary" :disabled="adding" @click="submitCreateRole">
              {{ adding ? '建立中...' : '建立角色' }}
            </button>
          </div>
        </div>
      </section>

      <section class="panel-card" style="padding:0;overflow:hidden">
        <div class="role-count-bar">共 {{ catalog.allRoles.length }} 個角色</div>
        <table class="data-table">
          <thead>
            <tr>
              <th>角色名稱</th>
              <th>角色代碼</th>
              <th>說明</th>
              <th style="text-align:center">權限數</th>
              <th style="text-align:center">使用者數</th>
              <th style="text-align:center">狀態</th>
              <th style="text-align:right">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="catalog.allRoles.length === 0">
              <td colspan="7" class="muted-text" style="text-align:center;padding:2rem">載入中…</td>
            </tr>
            <tr v-for="role in catalog.allRoles" :key="role.id">
              <td>
                <strong>{{ role.title }}</strong>
                <div class="role-type-label">{{ role.isSystem ? '系統角色' : '自訂角色' }}</div>
              </td>
              <td><code class="key-chip">{{ role.key }}</code></td>
              <td class="muted-text" style="font-size:.85rem;max-width:200px">{{ role.description || '—' }}</td>
              <td style="text-align:center">{{ role.permissionCount }}</td>
              <td style="text-align:center">
                <span :class="role.userCount > 0 ? 'count-badge count-badge--active' : 'count-badge'">
                  {{ role.userCount }}
                </span>
              </td>
              <td style="text-align:center">
                <span :class="role.enabled ? 'status-chip status-chip--on' : 'status-chip status-chip--off'">
                  {{ role.enabled ? '啟用' : '停用' }}
                </span>
              </td>
              <td style="text-align:right">
                <div class="action-group">
                  <button class="act-btn act-btn--edit" @click="openRole(role.id)">編輯</button>
                  <template v-if="!role.isSystem">
                    <button
                      class="act-btn"
                      :class="role.enabled ? 'act-btn--warn' : 'act-btn--edit'"
                      @click="toggleRoleStatus(role.id, role.enabled)"
                    >{{ role.enabled ? '停用' : '啟用' }}</button>
                    <button class="act-btn act-btn--del" @click="handleDeleteRole(role.id)">刪除</button>
                  </template>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </section>
    </template>

    <!-- ── 角色詳細 ── -->
    <template v-else-if="viewMode === 'detail' && selectedRole">
      <div class="breadcrumb-bar">
        <button class="back-link" @click="backToList">← 返回</button>
        <span class="breadcrumb-sep">›</span>
        <span>{{ selectedRole.title }}</span>
      </div>

      <!-- 角色資訊卡 -->
      <section class="panel-card">
        <div class="info-card-header">
          <span>角色資訊</span>
          <div style="display:flex;gap:.5rem">
            <button v-if="!editingInfo" class="text-btn" @click="startEditInfo">編輯</button>
            <button v-else class="text-btn text-btn--cancel" @click="editingInfo = false">取消</button>
          </div>
        </div>

        <div v-if="!editingInfo" class="info-grid">
          <div class="info-cell">
            <div class="info-label">角色名稱</div>
            <div class="info-value"><strong>{{ selectedRole.title }}</strong></div>
          </div>
          <div class="info-cell">
            <div class="info-label">角色代碼</div>
            <code class="key-chip">{{ selectedRole.key }}</code>
          </div>
          <div class="info-cell">
            <div class="info-label">說明</div>
            <div class="info-value">{{ selectedRole.description || '—' }}</div>
          </div>
          <div class="info-cell">
            <div class="info-label">類型</div>
            <div class="info-value">{{ selectedRole.isSystem ? '系統角色' : '自訂角色' }}</div>
          </div>
          <div class="info-cell">
            <div class="info-label">狀態</div>
            <span :class="selectedRole.enabled ? 'status-chip status-chip--on' : 'status-chip status-chip--off'">
              {{ selectedRole.enabled ? '啟用' : '停用' }}
            </span>
          </div>
        </div>

        <div v-else class="edit-info-form">
          <div class="form-row">
            <label>角色名稱<input v-model="editInfoForm.title" class="form-input" /></label>
            <label>角色代碼<input v-model="editInfoForm.key" class="form-input" :disabled="selectedRole.isSystem" /></label>
          </div>
          <label>說明<input v-model="editInfoForm.description" class="form-input" /></label>
          <p v-if="editInfoErr" class="err-text">{{ editInfoErr }}</p>
          <div class="form-actions">
            <button class="btn btn--primary" :disabled="savingInfo" @click="saveInfo">
              {{ savingInfo ? '儲存中...' : '儲存' }}
            </button>
          </div>
        </div>
      </section>

      <!-- Tabs -->
      <div class="tabs-bar">
        <button :class="['tab-btn', activeTab === 'permissions' && 'tab-btn--active']" @click="activeTab = 'permissions'">
          權限設定
        </button>
        <button :class="['tab-btn', activeTab === 'members' && 'tab-btn--active']" @click="activeTab = 'members'">
          使用者管理
        </button>
      </div>

      <!-- 權限設定 Tab -->
      <section v-if="activeTab === 'permissions'" class="panel-card">
        <div class="perm-tab-header">
          <div>
            <h3 style="margin:0">權限設定</h3>
            <p class="muted-text" style="font-size:.82rem;margin:.2rem 0 0">
              已授予 {{ grantedCount }} / {{ catalog.allPermissions.length }} 個權限
            </p>
          </div>
          <div style="display:flex;gap:.5rem;align-items:center">
            <span v-if="savingPermErr" class="err-text">{{ savingPermErr }}</span>
            <button class="btn btn--primary" :disabled="savingPerms || loadingDetail" @click="savePermissions">
              {{ savingPerms ? '儲存中...' : '儲存權限' }}
            </button>
          </div>
        </div>

        <div v-if="loadingDetail" class="muted-text" style="padding:2rem;text-align:center">載入中…</div>
        <div v-else class="perm-groups">
          <div v-for="group in permsByCategory" :key="group.cat" class="perm-group">
            <div class="perm-group-header">
              <strong>{{ group.cat }}</strong>
              <span class="perm-group-count">{{ catCheckedCount(group.perms) }}/{{ group.perms.length }}</span>
              <div class="perm-group-actions">
                <button class="text-btn" @click="selectAllInCat(group.perms)">全選</button>
                <button class="text-btn" @click="clearAllInCat(group.perms)">全不選</button>
              </div>
            </div>
            <div class="perm-list">
              <label v-for="perm in group.perms" :key="perm.id" class="perm-row">
                <input
                  type="checkbox"
                  :checked="selectedPermIds.has(perm.id)"
                  @change="togglePerm(perm.id)"
                />
                <div class="perm-info">
                  <div class="perm-key-row">
                    <code class="perm-key">{{ perm.key }}</code>
                    <span v-if="getActionTag(perm.key)" :class="['perm-tag', getActionTag(perm.key)!.cls]">
                      {{ getActionTag(perm.key)!.label }}
                    </span>
                  </div>
                  <div class="perm-desc">{{ perm.description || perm.title }}</div>
                </div>
              </label>
            </div>
          </div>
        </div>
      </section>

      <!-- 使用者管理 Tab -->
      <section v-else-if="activeTab === 'members'" class="panel-card">
        <div class="perm-tab-header">
          <h3 style="margin:0">使用者管理</h3>
          <button class="btn btn--primary" @click="showAddMember = true; addMemberErr = ''; addMemberNo = ''">+ 新增使用者</button>
        </div>

        <div v-if="showAddMember" class="add-member-form">
          <label>
            輸入員工編號
            <div class="add-member-row">
              <input v-model="addMemberNo" class="form-input" placeholder="e.g. FK0171" @keydown.enter="addMember" />
              <button class="btn btn--primary" :disabled="addingMember" @click="addMember">
                {{ addingMember ? '加入中...' : '加入' }}
              </button>
              <button class="btn btn--ghost" @click="showAddMember = false; addMemberNo = ''; addMemberErr = ''">取消</button>
            </div>
          </label>
          <p v-if="addMemberErr" class="err-text">{{ addMemberErr }}</p>
        </div>

        <div v-if="loadingDetail" class="muted-text" style="padding:2rem;text-align:center">載入中…</div>
        <table v-else class="data-table" style="margin-top:.5rem">
          <thead>
            <tr>
              <th>EMAIL</th>
              <th>姓名</th>
              <th>員工編號</th>
              <th>狀態</th>
              <th>指派日期</th>
              <th style="text-align:right">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="roleMembers.length === 0">
              <td colspan="6" class="muted-text" style="text-align:center;padding:1.5rem">尚無成員</td>
            </tr>
            <tr v-for="m in roleMembers" :key="m.staffProfileId">
              <td class="muted-text" style="font-size:.85rem">{{ m.email || '—' }}</td>
              <td><strong>{{ m.displayName }}</strong></td>
              <td><code class="key-chip">{{ m.employeeNo || '—' }}</code></td>
              <td>
                <span :class="m.enabled ? 'status-chip status-chip--on' : 'status-chip status-chip--off'">
                  {{ m.enabled ? '啟用' : '停用' }}
                </span>
              </td>
              <td class="muted-text" style="font-size:.85rem">{{ formatDate(m.assignedAt) }}</td>
              <td style="text-align:right">
                <button class="act-btn act-btn--del" @click="removeMember(m.staffProfileId)">移除</button>
              </td>
            </tr>
          </tbody>
        </table>
      </section>
    </template>

  </div>
</template>

<style scoped>
.panel-header { display:flex; justify-content:space-between; align-items:flex-start; gap:1rem; margin-bottom:.75rem; }
.breadcrumb-bar { display:flex; align-items:center; gap:.5rem; font-size:.9rem; margin-bottom:.5rem; }
.back-link { background:none; border:none; color:var(--color-primary,#f59e0b); cursor:pointer; font-size:.9rem; padding:0; }
.breadcrumb-sep { opacity:.4; }

.btn { padding:.45rem .9rem; border-radius:.5rem; border:none; cursor:pointer; font-size:.875rem; font-weight:500; }
.btn--primary { background:var(--color-primary,#f59e0b); color:#fff; }
.btn--primary:hover { opacity:.9; }
.btn--primary:disabled { opacity:.5; cursor:not-allowed; }
.btn--ghost { background:transparent; border:1px solid var(--color-border,#e5e7eb); color:inherit; }
.btn--ghost:hover { background:color-mix(in srgb, currentColor 8%, transparent); }
.text-btn { background:none; border:none; cursor:pointer; color:var(--color-primary,#f59e0b); font-size:.82rem; padding:.1rem .3rem; }
.text-btn--cancel { color:inherit; opacity:.6; }
.action-group { display:flex; gap:.35rem; justify-content:flex-end; flex-wrap:wrap; }
.act-btn { font-size:.78rem; padding:.22rem .55rem; border-radius:.4rem; border:none; cursor:pointer; font-weight:500; }
.act-btn--edit   { background:#e0f2fe; color:#0369a1; }
.act-btn--warn   { background:#fef3c7; color:#92400e; }
.act-btn--del    { background:#fee2e2; color:#991b1b; }
.act-btn--edit:hover { background:#bae6fd; }
.act-btn--warn:hover { background:#fde68a; }
.act-btn--del:hover  { background:#fecaca; }

.role-count-bar { padding:.65rem 1.25rem; font-size:.82rem; opacity:.65; border-bottom:1px solid var(--color-border,#e5e7eb); }
.role-type-label { font-size:.72rem; opacity:.5; margin-top:.1rem; }
.key-chip { background:color-mix(in srgb, currentColor 8%, transparent); border-radius:.35rem; padding:.15rem .45rem; font-size:.78rem; font-family:monospace; }
.count-badge { display:inline-flex; align-items:center; justify-content:center; min-width:1.6rem; height:1.6rem; border-radius:999px; font-size:.78rem; font-weight:600; background:color-mix(in srgb, currentColor 10%, transparent); }
.count-badge--active { background:color-mix(in srgb, var(--color-primary,#f59e0b) 20%, transparent); color:var(--color-primary,#d97706); }
.status-chip { font-size:.75rem; font-weight:600; padding:.18rem .55rem; border-radius:999px; }
.status-chip--on  { background:#d1fae5; color:#065f46; }
.status-chip--off { background:#fee2e2; color:#991b1b; }

.add-role-form, .edit-info-form, .add-member-form {
  background:color-mix(in srgb, currentColor 4%, transparent);
  border:1px solid var(--color-border,#e5e7eb);
  border-radius:.75rem; padding:1rem; margin-top:.75rem;
  display:flex; flex-direction:column; gap:.65rem;
}
.add-role-form h4 { margin:0; font-size:.95rem; }
.form-row { display:grid; grid-template-columns:1fr 1fr; gap:.75rem; }
.form-input { display:block; width:100%; margin-top:.25rem; padding:.45rem .65rem; border:1px solid var(--color-border,#e5e7eb); border-radius:.45rem; background:var(--color-bg,#fff); color:inherit; font-size:.875rem; box-sizing:border-box; }
.form-input:focus { outline:none; border-color:var(--color-primary,#f59e0b); }
.form-input:disabled { opacity:.5; }
.form-actions { display:flex; gap:.5rem; justify-content:flex-end; }
.add-member-row { display:flex; gap:.5rem; align-items:center; margin-top:.25rem; }
.add-member-row .form-input { flex:1; }
.err-text { color:#dc2626; font-size:.82rem; margin:0; }

.info-card-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem; font-weight:600; }
.info-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(180px,1fr)); gap:.75rem 1.5rem; }
.info-label { font-size:.75rem; opacity:.5; margin-bottom:.25rem; }
.info-value { font-size:.9rem; }

.tabs-bar { display:flex; gap:0; border-bottom:2px solid var(--color-border,#e5e7eb); }
.tab-btn { background:none; border:none; border-bottom:2px solid transparent; margin-bottom:-2px; padding:.65rem 1.25rem; cursor:pointer; font-size:.9rem; color:inherit; opacity:.6; font-weight:500; }
.tab-btn--active { opacity:1; border-bottom-color:var(--color-primary,#f59e0b); color:var(--color-primary,#d97706); }

.perm-tab-header { display:flex; justify-content:space-between; align-items:flex-start; gap:1rem; margin-bottom:1.25rem; }
.perm-groups { display:flex; flex-direction:column; gap:.85rem; }
.perm-group { border:1px solid var(--color-border,#e5e7eb); border-radius:.75rem; overflow:hidden; }
.perm-group-header {
  display:flex; align-items:center; gap:.5rem; padding:.6rem 1rem;
  background:color-mix(in srgb, currentColor 4%, transparent);
  border-bottom:1px solid var(--color-border,#e5e7eb); font-size:.88rem;
}
.perm-group-count { font-size:.75rem; padding:.1rem .4rem; border-radius:999px; background:color-mix(in srgb, var(--color-primary,#f59e0b) 18%, transparent); color:var(--color-primary,#d97706); font-weight:700; }
.perm-group-actions { margin-left:auto; display:flex; gap:.25rem; }
.perm-list { padding:.2rem 0; }
.perm-row { display:flex; align-items:flex-start; gap:.75rem; padding:.5rem 1rem; cursor:pointer; }
.perm-row:hover { background:color-mix(in srgb, currentColor 3%, transparent); }
.perm-row input[type="checkbox"] { margin-top:.2rem; flex-shrink:0; accent-color:var(--color-primary,#f59e0b); }
.perm-info { flex:1; }
.perm-key-row { display:flex; align-items:center; gap:.4rem; flex-wrap:wrap; }
.perm-key { font-size:.78rem; font-family:monospace; }
.perm-desc { font-size:.76rem; opacity:.55; margin-top:.12rem; }
.perm-tag { font-size:.68rem; font-weight:600; padding:.1rem .35rem; border-radius:.3rem; }
.tag--view    { background:#dbeafe; color:#1d4ed8; }
.tag--edit    { background:#dcfce7; color:#15803d; }
.tag--action  { background:#fef3c7; color:#92400e; }
.tag--attempt { background:#f3e8ff; color:#7e22ce; }
</style>
