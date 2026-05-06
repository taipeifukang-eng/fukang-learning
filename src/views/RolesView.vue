<script setup lang="ts">
import { computed } from 'vue'
import { useCatalogStore } from '../stores/catalog'

const catalog = useCatalogStore()

const permissionLabels: Record<string, string> = {
  'dashboard:view': '檢視儀表板',
  'staff:view': '檢視用戶/人員管理',
  'staff:toggle': '啟用 / 停用登入者',
  'staff:assign_role': '指派平台角色',
  'staff:assign_org': '編制人員到組織',
  'roles:view': '檢視 RBAC',
  'roles:assign': '指派角色',
  'courses:view': '檢視課程',
  'courses:edit': '編輯課程',
  'quiz:edit': '編輯課後測驗',
  'quiz:attempt': '進行課後測驗',
  'categories:edit': '編輯課程分類',
  'learning:view': '進入學習專區',
  'progress:view': '查看學習進度',
  'team_progress:view': '查看轄下學習進度',
  'orgs:view': '檢視組織管理',
  'orgs:edit': '編輯組織管理',
}

const teamProgressRoles = computed(() =>
  catalog.roles.filter((role) => role.permissions.includes('team_progress:view')),
)
</script>

<template>
  <div class="page-stack">
    <section class="panel-card">
      <h2>RBAC 權限矩陣</h2>
      <p>建議在 Supabase 以 roles、permissions、role_permissions、user_roles 四張表實作，前端則只讀取 permission 集合。</p>

      <p class="muted-text" style="margin-top:.5rem">
        <strong>具有 team_progress:view 的角色：</strong>
        <span v-if="teamProgressRoles.length === 0">目前沒有</span>
        <span v-else>{{ teamProgressRoles.map((r) => r.title).join('、') }}</span>
      </p>

      <div class="role-grid">
        <article v-for="role in catalog.roles" :key="role.key" class="role-card">
          <div>
            <h3>{{ role.title }}</h3>
            <p>{{ role.description }}</p>
          </div>
          <ul class="plain-list">
            <li v-for="permission in role.permissions" :key="permission">
              {{ permissionLabels[permission] ?? permission }}
              <span class="muted-text">（{{ permission }}）</span>
            </li>
          </ul>
        </article>
      </div>
    </section>
  </div>
</template>