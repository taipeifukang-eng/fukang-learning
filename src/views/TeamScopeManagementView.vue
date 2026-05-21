<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useCatalogStore } from '../stores/catalog'

const catalog = useCatalogStore()

const selectedManagerId = ref('')
const selectedOrgIds = ref<number[]>([])   // 已勾選的組織 ID（寫入 staff_manager_org_scope）
const saving = ref(false)
const saveMessage = ref('')

// ── 主管選項：有 team_progress:view 權限且啟用中的人員 ──────────
function hasTeamProgressPermission(member: { roles: Array<{ key: string }> }) {
  return member.roles.some((role) =>
    catalog.roles.find((roleDef) => roleDef.key === role.key)?.permissions.includes('team_progress:view'),
  )
}

const managerOptions = computed(() =>
  catalog.staff
    .filter((m) => m.enabled)
    .filter((m) => hasTeamProgressPermission(m))
    .sort((a, b) => a.name.localeCompare(b.name, 'zh-Hant')),
)

const selectedManager = computed(() =>
  managerOptions.value.find((m) => m.id === selectedManagerId.value) ?? null,
)

// ── 每位主管的管轄組織數量（for 左側清單顯示）──────────────────
const orgCountByManager = computed(() => {
  const map = new Map<string, number>()
  catalog.managerOrgScopes.forEach((s) => {
    if (!s.active) return
    map.set(s.managerId, (map.get(s.managerId) ?? 0) + 1)
  })
  return map
})

// ── 此主管因督導設定自動擁有的組織 ──────────────────────────────
const supervisorOrgs = computed(() => {
  if (!selectedManager.value) return []
  const name = selectedManager.value.name
  return catalog.organizations.filter((org) => org.supervisor === name)
})

// ── 此主管在 org_scope 中明確指派的組織 ID ───────────────────────
const currentManagerOrgScopes = computed(() =>
  catalog.managerOrgScopes.filter((s) => s.managerId === selectedManagerId.value && s.active),
)

// 當切換主管時，重新載入已指派的組織
watch(selectedManagerId, () => {
  saveMessage.value = ''
  selectedOrgIds.value = currentManagerOrgScopes.value.map((s) => s.orgId)
})

watch(currentManagerOrgScopes, (scopes) => {
  if (!selectedManagerId.value) return
  selectedOrgIds.value = scopes.map((s) => s.orgId)
}, { deep: true })

function toggleOrg(orgId: number) {
  if (selectedOrgIds.value.includes(orgId)) {
    selectedOrgIds.value = selectedOrgIds.value.filter((id) => id !== orgId)
  } else {
    selectedOrgIds.value = [...selectedOrgIds.value, orgId]
  }
}

async function saveScope() {
  if (!selectedManagerId.value) return
  saving.value = true
  saveMessage.value = ''
  try {
    await catalog.replaceManagerOrgScope(selectedManagerId.value, selectedOrgIds.value)
    saveMessage.value = '✓ 已儲存組織管轄範圍。'
  } catch (err: any) {
    // 顯示完整錯誤訊息（含 Supabase PostgrestError）
    const msg = err?.message ?? err?.error_description ?? JSON.stringify(err)
    saveMessage.value = `儲存失敗：${msg}`
    console.error('[saveScope]', err)
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  await catalog.fetchOrganizations()
  await catalog.fetchStaff()
  await catalog.fetchManagerOrgScopes()
  if (managerOptions.value.length > 0) {
    selectedManagerId.value = managerOptions.value[0].id
  }
})
</script>

<template>
  <div class="page-stack">
    <section class="panel-card">
      <h2>主管範圍管理</h2>
      <p>
        設定各主管（店長 / 督導）管轄哪些門市 / 部門。<br>
        勾選組織後，該組織下的所有人員都會自動納入此主管的管理範圍，無需逐一設定。<br>
        <em>督導若已在「組織管理」設定為某門市的督導，系統也會自動包含該門市。</em>
      </p>
    </section>

    <section class="panel-grid panel-grid--2">
      <!-- 左側：主管清單 -->
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
            <span class="scope-badge">{{ orgCountByManager.get(manager.id) ?? 0 }} 間</span>
          </button>
        </div>
      </article>

      <!-- 右側：組織指派 -->
      <article class="panel-card">
        <h3>管轄組織指派</h3>

        <template v-if="!selectedManager">
          <p class="muted-text">請先從左側選擇主管。</p>
        </template>

        <template v-else>
          <p class="manager-title">
            目前主管：<strong>{{ selectedManager.name }}</strong>
            （{{ selectedManager.employeeNo || '未填員編' }}）
          </p>

          <!-- 督導自動管轄（唯讀提示） -->
          <div v-if="supervisorOrgs.length > 0" class="supervisor-orgs">
            <p class="section-label">🔒 督導/副理自動管轄（來自組織管理設定，無需手動勾選）</p>
            <div v-for="org in supervisorOrgs" :key="org.id" class="org-chip supervisor">
              {{ org.code }}｜{{ org.shortName }}
            </div>
          </div>

          <!-- 明確指派的組織（可勾選） -->
          <p class="section-label" style="margin-top:.75rem">✏️ 手動指派管轄組織</p>
          <p class="muted-text" style="font-size:.82rem;margin-bottom:.5rem">
            勾選後，該組織所有啟用人員皆納入此主管的轄區進度。
          </p>

          <div class="org-list">
            <label
              v-for="org in catalog.organizations"
              :key="org.id"
              class="org-item"
              :class="{ 'is-checked': selectedOrgIds.includes(org.id), 'is-supervisor': supervisorOrgs.some(s => s.id === org.id) }"
            >
              <input
                :checked="selectedOrgIds.includes(org.id)"
                :disabled="supervisorOrgs.some(s => s.id === org.id)"
                type="checkbox"
                @change="toggleOrg(org.id)"
              />
              <span class="org-info">
                <strong>{{ org.code }}｜{{ org.shortName }}</strong>
                <small>{{ org.type === 'store' ? '門市' : '總部 / 部門' }}
                  <template v-if="org.supervisor"> · 督導/副理：{{ org.supervisor }}</template>
                </small>
              </span>
              <span class="org-count">
                {{ catalog.staff.filter(m => m.enabled && m.orgId === org.id).length }} 人
              </span>
            </label>
          </div>

          <div class="save-row">
            <button class="btn btn--primary" type="button" :disabled="saving" @click="saveScope">
              {{ saving ? '儲存中...' : '儲存管轄範圍' }}
            </button>
            <span v-if="saveMessage" class="save-msg">{{ saveMessage }}</span>
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
  max-height: 460px;
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
  gap: .5rem;
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

.scope-badge {
  font-size: .8rem;
  padding: .15rem .45rem;
  border-radius: 999px;
  background: color-mix(in srgb, var(--color-primary, #f59e0b) 20%, transparent);
  white-space: nowrap;
  flex-shrink: 0;
}

.manager-title { margin-bottom: .75rem; }

.section-label {
  font-size: .82rem;
  font-weight: 600;
  color: var(--color-text-muted, #6b7280);
  margin: 0 0 .35rem;
}

.supervisor-orgs {
  display: flex;
  flex-wrap: wrap;
  gap: .4rem;
  margin-bottom: .5rem;
  padding: .6rem;
  background: color-mix(in srgb, var(--color-primary, #f59e0b) 8%, transparent);
  border-radius: 8px;
}

.org-chip {
  font-size: .8rem;
  padding: .2rem .55rem;
  border-radius: 999px;
  background: color-mix(in srgb, var(--color-primary, #f59e0b) 22%, transparent);
}

.org-list {
  display: grid;
  gap: .45rem;
  max-height: 340px;
  overflow: auto;
  border-top: 1px solid var(--color-border, #4b3a2f);
  border-bottom: 1px solid var(--color-border, #4b3a2f);
  padding: .6rem 0;
}

.org-item {
  display: flex;
  align-items: center;
  gap: .6rem;
  padding: .5rem .6rem;
  border-radius: 8px;
  cursor: pointer;
}

.org-item.is-checked {
  background: color-mix(in srgb, var(--color-primary, #f59e0b) 10%, transparent);
}

.org-item.is-supervisor {
  opacity: .6;
  cursor: default;
}

.org-info {
  flex: 1;
  display: grid;
}

.org-info small {
  font-size: .78rem;
  opacity: .7;
}

.org-count {
  font-size: .8rem;
  opacity: .65;
  white-space: nowrap;
}

.save-row {
  display: flex;
  align-items: center;
  gap: .75rem;
  margin-top: .75rem;
}

.save-msg {
  font-size: .85rem;
  color: #16a34a;
}

@media (max-width: 960px) {
  .panel-grid--2 {
    grid-template-columns: 1fr;
  }
}
</style>
