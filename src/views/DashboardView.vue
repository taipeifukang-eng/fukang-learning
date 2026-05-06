<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useCatalogStore } from '../stores/catalog'

const catalog = useCatalogStore()

onMounted(() => {
  catalog.init()
})

const stats = computed(() => [
  { label: '啟用中的人員', value: catalog.enabledStaffCount, note: '可登入使用 LINE 的教職員' },
  { label: '啟用中的課程', value: catalog.enabledCoursesCount, note: '目前可提供學習的課程數量' },
  { label: '影片節數', value: catalog.totalLessonsCount, note: '課程內所有 lesson 總數' },
])
</script>

<template>
  <div class="page-stack">
    <section class="metric-grid">
      <article v-for="item in stats" :key="item.label" class="metric-card">
        <span>{{ item.label }}</span>
        <strong>{{ item.value }}</strong>
        <p>{{ item.note }}</p>
      </article>
    </section>

    <section class="panel-grid panel-grid--2">
      <article class="panel-card">
        <h2>使用提醒</h2>
        <p>請依照課程安排完成學習與測驗，系統會自動記錄進度並更新個人學習狀態。</p>
        <ul class="plain-list">
          <li>完成影片後可進行課後測驗</li>
          <li>測驗可重複作答，系統會保留歷次紀錄</li>
          <li>可於「我的學習紀錄」查看完訓率與課程狀態</li>
        </ul>
      </article>

      <article class="panel-card">
        <h2>平台公告</h2>
        <p>歡迎使用富康學院學習平台，請定期查看最新課程與指派學習任務。</p>
        <ul class="plain-list">
          <li>課程與章節將持續更新</li>
          <li>如有內容問題請回報管理員</li>
          <li>請確保帳號資訊為最新狀態</li>
        </ul>
      </article>
    </section>
  </div>
</template>