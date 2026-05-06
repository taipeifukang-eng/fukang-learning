<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { getLessonEmbedUrl } from '../data/mockData'
import { useAuthStore } from '../stores/auth'
import { useCatalogStore } from '../stores/catalog'

const auth = useAuthStore()
const catalog = useCatalogStore()

onMounted(() => {
  catalog.fetchCourses()
})

const canEdit = computed(() => auth.hasPermission('courses:edit'))
</script>

<template>
  <div class="page-stack">
    <section class="panel-grid panel-grid--2">
      <article v-for="course in catalog.courses" :key="course.id" class="panel-card course-card">
        <img :src="course.coverUrl" :alt="course.title" class="course-card__cover" />
        <div class="course-card__body">
          <div class="course-card__header">
            <div>
              <span class="course-tag">{{ course.categoryName || '未分類' }}</span>
              <h2>{{ course.title }}</h2>
            </div>
            <button class="table-action" type="button" :disabled="!canEdit" @click="catalog.toggleCourseStatus(course.id, !course.enabled)">
              {{ course.enabled ? '停用課程' : '啟用課程' }}
            </button>
          </div>

          <p>{{ course.description }}</p>

          <div class="lesson-list">
            <article v-for="lesson in course.lessons" :key="lesson.id" class="lesson-card">
              <div>
                <strong>{{ lesson.title }}</strong>
                <p>{{ lesson.summary }}</p>
              </div>
              <ul class="plain-list">
                <li>時長：{{ Math.round(lesson.durationSeconds / 60) }} 分鐘</li>
                <li>來源：Bunny Stream</li>
                <li>Embed：{{ getLessonEmbedUrl(lesson.bunnyVideoId) || '待設定 Bunny Library ID' }}</li>
              </ul>
            </article>
          </div>
        </div>
      </article>
    </section>
  </div>
</template>