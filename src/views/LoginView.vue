<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import AppIcon from '../components/AppIcon.vue'
import { appConfig } from '../lib/config'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const auth = useAuthStore()

const isRealLineConfigured = computed(() => Boolean(appConfig.lineClientId))
const memberCount = ref<number | null>(null)

onMounted(async () => {
  const { count } = await supabase
    .from('staff_profiles')
    .select('id', { count: 'exact', head: true })
  memberCount.value = count ?? 0
})

function loginAs(role: 'super_admin' | 'content_admin' | 'Supervision' | 'student') {
  auth.loginWithMockLine(role)
  router.push(auth.defaultHomePath)
}

function startLineLogin() {
  auth.startLineLogin()
}

const tagline = computed(() => {
  const n = memberCount.value
  if (n === null) return '正在載入學員資訊...'
  if (n === 0) return '成為第一位踏上這段學習旅程的人！'
  return `與 ${n} 位同仁一起，開啟精進自我的學習之路`
})
</script>

<template>
  <div class="login-screen">
    <div class="login-screen__decor login-screen__decor--primary"></div>
    <div class="login-screen__decor login-screen__decor--secondary"></div>

    <div class="login-card">
      <!-- 品牌 -->
      <div class="login-card__brand">
        <div class="admin-brand-mark">FK</div>
        <div>
          <h1>富康學院學習網</h1>
        </div>
      </div>

      <!-- 激勵語 -->
      <div class="login-tagline">
        <p class="login-tagline__main">{{ tagline }}</p>
        <p class="login-tagline__sub">請使用 LINE 帳號登入，開始您的學習歷程</p>
      </div>

      <!-- 登入按鈕 -->
      <button class="line-login-button" type="button" @click="startLineLogin">
        <AppIcon name="line" :size="20" />
        使用 LINE 登入
      </button>

      <!-- 示範用按鈕（僅在開發環境或未設定 LINE 時顯示） -->
      <div v-if="!isRealLineConfigured" class="demo-role-grid">
        <button type="button" @click="loginAs('super_admin')">示範：系統管理員</button>
        <button type="button" @click="loginAs('content_admin')">示範：內容管理員</button>
        <button type="button" @click="loginAs('Supervision')">示範：督導</button>
        <button type="button" @click="loginAs('student')">示範：學生</button>
      </div>
    </div>
  </div>
</template>
