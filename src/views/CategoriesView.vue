<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useAuthStore } from '../stores/auth'
import { useCatalogStore } from '../stores/catalog'
import type { Category } from '../data/mockData'

const auth = useAuthStore()
const catalog = useCatalogStore()

const canEdit = computed(() => auth.hasPermission('categories:edit'))
const saving = ref(false)
const editingId = ref<number | null>(null)
const nameInput = ref('')
const sortOrderInput = ref(0)
const enabledInput = ref(true)

onMounted(() => catalog.fetchCategories())

function startAdd() {
  editingId.value = -1
  nameInput.value = ''
  sortOrderInput.value = catalog.categories.length
  enabledInput.value = true
}

function startEdit(cat: Category) {
  editingId.value = cat.id
  nameInput.value = cat.name
  sortOrderInput.value = cat.sortOrder
  enabledInput.value = cat.enabled
}

function cancelEdit() {
  editingId.value = null
}

async function save() {
  if (!nameInput.value.trim()) return
  saving.value = true
  try {
    await catalog.upsertCategory({
      id: editingId.value === -1 ? undefined : editingId.value ?? undefined,
      name: nameInput.value,
      sortOrder: sortOrderInput.value,
      enabled: enabledInput.value,
    })
    editingId.value = null
  } finally {
    saving.value = false
  }
}

async function remove(id: number) {
  if (!confirm('確定刪除此分類？已指派的課程分類將被清空。')) return
  await catalog.deleteCategory(id)
}
</script>

<template>
  <div class="page-stack">
    <div class="panel-card">
      <div class="panel-header">
        <h2>課程分類管理</h2>
        <button v-if="canEdit && editingId === null" class="btn btn--primary" type="button" @click="startAdd">
          + 新增分類
        </button>
      </div>

      <!-- 新增 / 編輯表單 -->
      <form v-if="editingId !== null && canEdit" class="inline-form" @submit.prevent="save">
        <input v-model="nameInput" class="form-input" placeholder="分類名稱" required />
        <input v-model.number="sortOrderInput" class="form-input form-input--sm" type="number" placeholder="排序" min="0" />
        <label class="toggle-label">
          <input v-model="enabledInput" type="checkbox" />
          啟用
        </label>
        <button class="btn btn--primary" type="submit" :disabled="saving">儲存</button>
        <button class="btn" type="button" @click="cancelEdit">取消</button>
      </form>

      <!-- 分類列表 -->
      <table class="data-table">
        <thead>
          <tr>
            <th>排序</th>
            <th>名稱</th>
            <th>狀態</th>
            <th v-if="canEdit">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="catalog.categories.length === 0">
            <td colspan="4" class="muted-text" style="text-align:center;padding:2rem">尚無分類</td>
          </tr>
          <tr v-for="cat in [...catalog.categories].sort((a, b) => a.sortOrder - b.sortOrder)" :key="cat.id">
            <td>{{ cat.sortOrder }}</td>
            <td>{{ cat.name }}</td>
            <td>
              <span :class="cat.enabled ? 'status-badge status-badge--active' : 'status-badge status-badge--inactive'">
                {{ cat.enabled ? '啟用' : '停用' }}
              </span>
            </td>
            <td v-if="canEdit">
              <button class="table-action" type="button" @click="startEdit(cat)">編輯</button>
              <button class="table-action table-action--danger" type="button" @click="remove(cat.id)">刪除</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
