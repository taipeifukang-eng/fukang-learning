import { createRouter, createWebHistory } from 'vue-router'
import AdminLayout from '../layouts/AdminLayout.vue'
import { useAuthStore } from '../stores/auth'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      redirect: () => {
        const auth = useAuthStore()
        return auth.isAuthenticated ? auth.defaultHomePath : '/login'
      },
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('../views/LoginView.vue'),
      meta: { title: 'LINE 登入', public: true },
    },
    {
      path: '/auth/line/callback',
      name: 'line-callback',
      component: () => import('../views/LineCallbackView.vue'),
      meta: { title: 'LINE 登入處理中', public: true },
    },
    {
      path: '/',
      component: AdminLayout,
      children: [
        {
          path: 'admin',
          name: 'admin-dashboard',
          component: () => import('../views/DashboardView.vue'),
          meta: {
            title: '儀表板',
            icon: 'grid',
            group: '平台管理',
            requiresAuth: true,
            permission: 'dashboard:view',
            closable: false,
          },
        },
        {
          path: 'admin/staff',
          name: 'admin-staff',
          component: () => import('../views/StaffView.vue'),
          meta: {
            title: '用戶管理',
            icon: 'users',
            group: '平台管理',
            requiresAuth: true,
            permission: 'staff:view',
          },
        },
        {
          path: 'admin/people',
          name: 'admin-people',
          component: () => import('../views/PeopleManagementView.vue'),
          meta: {
            title: '人員管理',
            icon: 'users',
            group: '平台管理',
            requiresAuth: true,
            permission: 'staff:view',
          },
        },
        {
          path: 'admin/organizations',
          name: 'admin-organizations',
          component: () => import('../views/OrganizationManagementView.vue'),
          meta: {
            title: '組織管理',
            icon: 'building',
            group: '平台管理',
            requiresAuth: true,
            permission: 'orgs:view',
          },
        },
        {
          path: 'admin/roles',
          name: 'admin-roles',
          component: () => import('../views/RolesView.vue'),
          meta: {
            title: 'RBAC 權限',
            icon: 'shield',
            group: '平台管理',
            requiresAuth: true,
            permission: 'roles:view',
          },
        },
        {
          path: 'admin/team-scope',
          name: 'admin-team-scope',
          component: () => import('../views/TeamScopeManagementView.vue'),
          meta: {
            title: '主管範圍管理',
            icon: 'users',
            group: '平台管理',
            requiresAuth: true,
            permission: 'roles:assign',
          },
        },
        {
          path: 'admin/team-progress',
          name: 'admin-team-progress',
          component: () => import('../views/TeamProgressView.vue'),
          meta: {
            title: '轄區進度總覽',
            icon: 'book',
            group: '平台管理',
            requiresAuth: true,
            permission: 'team_progress:view',
          },
        },
        {
          path: 'admin/courses',
          name: 'admin-courses',
          component: () => import('../views/CoursesManagementView.vue'),
          meta: {
            title: '課程管理',
            icon: 'video',
            group: '課程管理',
            requiresAuth: true,
            permission: 'courses:view',
          },
        },
        {
          path: 'admin/categories',
          name: 'admin-categories',
          component: () => import('../views/CategoriesView.vue'),
          meta: {
            title: '分類管理',
            icon: 'tag',
            group: '課程管理',
            requiresAuth: true,
            permission: 'categories:edit',
          },
        },
        {
          path: 'learning',
          name: 'learning-home',
          component: () => import('../views/LearningHomeView.vue'),
          meta: {
            title: '學習專區',
            icon: 'book',
            group: '學習中心',
            requiresAuth: true,
            permission: 'learning:view',
            closable: false,
          },
        },
        {
          path: 'learning/course/:courseId',
          name: 'learning-course',
          component: () => import('../views/CoursePlayerView.vue'),
          meta: {
            title: '課程播放',
            icon: 'play',
            group: '學習中心',
            requiresAuth: true,
            permission: 'learning:view',
          },
        },
        {
          path: 'learning/my-progress',
          name: 'my-learning-progress',
          component: () => import('../views/MyLearningView.vue'),
          meta: {
            title: '我的學習紀錄',
            icon: 'book',
            group: '學習中心',
            requiresAuth: true,
            permission: 'learning:view',
          },
        },
        {
          path: 'forbidden',
          name: 'forbidden',
          component: () => import('../views/ForbiddenView.vue'),
          meta: {
            title: '無權限',
            icon: 'shield',
            requiresAuth: true,
          },
        },
      ],
    },
  ],
})

router.beforeEach((to) => {
  const auth = useAuthStore()

  if (to.meta.public) {
    if (to.path === '/login' && auth.isAuthenticated) {
      return auth.defaultHomePath
    }
    return true
  }

  if (to.meta.requiresAuth && !auth.isAuthenticated) {
    return '/login'
  }

  if (typeof to.meta.permission === 'string' && !auth.hasPermission(to.meta.permission)) {
    return '/forbidden'
  }

  return true
})

export default router