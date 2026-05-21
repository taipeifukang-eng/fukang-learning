import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { supabase } from '../lib/supabase'
import {
  roleDefinitions,
  type Category,
  type Course,
  type CourseAudience,
  type Lesson,
  type LearningProgress,
  type Organization,
  type StaffMember,
} from '../data/mockData'

export interface DbRole {
  id: number
  key: string
  title: string
  description: string
  isSystem: boolean
  enabled: boolean
  permissionCount: number
  userCount: number
}

export interface DbPermission {
  id: number
  key: string
  title: string
  description: string
  category: string
}

export interface RoleMember {
  staffProfileId: string
  displayName: string
  employeeNo: string
  email: string
  enabled: boolean
  assignedAt: string
}

export const useCatalogStore = defineStore('catalog', () => {
  const managerScopes = ref<Array<{
    id: number
    managerId: string
    memberId: string
    active: boolean
    createdAt: string
  }>>([])

  // 以「組織」為單位的主管範圍（店長用）
  const managerOrgScopes = ref<Array<{
    id: number
    managerId: string
    orgId: number
    active: boolean
    createdAt: string
  }>>([])
  const staff = ref<StaffMember[]>([])

  // ── RBAC 管理 ─────────────────────────────────────────────
  const allRoles = ref<DbRole[]>([])
  const allPermissions = ref<DbPermission[]>([])
  const organizations = ref<Organization[]>([])
  const categories = ref<Category[]>([])
  const courses = ref<Course[]>([])
  const progresses = ref<LearningProgress[]>([])
  const teamProgressRows = ref<Array<{
    staffProfileId: string
    displayName: string
    employeeNo: string
    orgId: number | null
    rank: string | null
    lessonId: string
    lessonTitle: string
    courseId: string
    courseTitle: string
    watchedSeconds: number
    durationSeconds: number
    progressPercent: number
    completedAt: string | null
  }>>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // ── Computed ──────────────────────────────────────────────
  const enabledStaffCount = computed(() => staff.value.filter((member) => member.enabled).length)
  const enabledCoursesCount = computed(() => courses.value.filter((course) => course.enabled).length)
  const totalLessonsCount = computed(() =>
    courses.value.reduce((total, course) => total + course.lessons.length, 0),
  )

  function resolveOrgSummary(orgId: number | null) {
    const org = organizations.value.find((item) => item.id === orgId)
    return {
      orgCode: org?.code ?? '',
      orgShortName: org?.shortName ?? '',
    }
  }

  // ── 用戶管理 ──────────────────────────────────────────────
  async function fetchStaff() {
    try {
      isLoading.value = true
      error.value = null

      const { data, error: err } = await supabase
        .from('staff_profiles')
        .select(`
          id, display_name, employee_no, email, department, enabled, org_id, created_at,
          user_roles (
            roles (id, key, title)
          )
        `)
        .order('created_at', { ascending: false })

      if (err) throw err

      staff.value = (data ?? []).map((profile: any) => ({
        id: profile.id,
        name: profile.display_name,
        employeeNo: profile.employee_no ?? '',
        email: profile.email ?? '',
        department: profile.department ?? '',
        orgId: profile.org_id ?? null,
        ...resolveOrgSummary(profile.org_id ?? null),
        lineUserId: '',
        enabled: profile.enabled,
        role: (profile.user_roles?.[0]?.roles?.key ?? 'student') as StaffMember['role'],
        roles: (profile.user_roles ?? []).map((ur: any) => ({
          id: ur.roles.id,
          key: ur.roles.key,
          title: ur.roles.title,
        })),
        lastLoginAt: '',
      }))
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to fetch staff'
      // 不 fallback mock data，保持空列表讓 UI 顯示真實錯誤
      staff.value = []
    } finally {
      isLoading.value = false
    }
  }

  async function toggleStaffStatus(id: string, enabled: boolean) {
    try {
      const { error: err } = await supabase
        .from('staff_profiles')
        .update({ enabled })
        .eq('id', id)

      if (err) throw err

      const target = staff.value.find((member) => member.id === id)
      if (target) target.enabled = enabled
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to update staff status'
      const target = staff.value.find((member) => member.id === id)
      if (target) target.enabled = !enabled
    }
  }

  async function updateStaffEmployeeNo(id: string, employeeNo: string) {
    const { error: err } = await supabase
      .from('staff_profiles')
      .update({ employee_no: employeeNo.trim() || null })
      .eq('id', id)

    if (err) throw err
    const target = staff.value.find((m) => m.id === id)
    if (target) target.employeeNo = employeeNo.trim()
  }

  async function updateStaffName(id: string, name: string) {
    const { error: err } = await supabase
      .from('staff_profiles')
      .update({ display_name: name.trim() })
      .eq('id', id)

    if (err) throw err
    const target = staff.value.find((m) => m.id === id)
    if (target) target.name = name.trim()
  }

  async function updateStaffOrg(id: string, orgId: number | null) {
    const { error: err } = await supabase
      .from('staff_profiles')
      .update({ org_id: orgId })
      .eq('id', id)

    if (err) throw err
    const target = staff.value.find((m) => m.id === id)
    if (target) {
      target.orgId = orgId
      Object.assign(target, resolveOrgSummary(orgId))
    }
  }

  async function assignStaffRole(staffId: string, roleKey: string) {
    const { data: roleRecord, error: roleErr } = await supabase
      .from('roles')
      .select('id, key, title')
      .eq('key', roleKey)
      .single()

    if (roleErr) throw roleErr

    const { error: delErr } = await supabase
      .from('user_roles')
      .delete()
      .eq('staff_profile_id', staffId)

    if (delErr) throw delErr

    const { error: insErr } = await supabase
      .from('user_roles')
      .insert({ staff_profile_id: staffId, role_id: roleRecord.id })

    if (insErr) throw insErr

    const target = staff.value.find((m) => m.id === staffId)
    if (target) {
      target.role = roleKey as StaffMember['role']
      target.roles = [roleRecord]
    }
  }

  // ── 組織管理 ──────────────────────────────────────────────
  async function fetchOrganizations() {
    const { data, error: err } = await supabase
      .from('organizations')
      .select('id, code, name, short_name, type, supervisor, manager, enabled')
      .order('code')

    if (err) {
      error.value = err.message
      return
    }

    organizations.value = (data ?? []).map((item: any) => ({
      id: item.id,
      code: item.code ?? '',
      name: item.name,
      shortName: item.short_name ?? item.name,
      type: item.type,
      supervisor: item.supervisor ?? '',
      manager: item.manager ?? '',
      enabled: item.enabled,
    }))
  }

  async function upsertOrganization(
    org: Partial<Organization> & { code: string; shortName: string; type: Organization['type'] },
  ) {
    const payload = {
      code: org.code.trim(),
      name: org.name?.trim() || org.shortName.trim(),
      short_name: org.shortName.trim(),
      type: org.type,
      supervisor: org.supervisor?.trim() ?? '',
      manager: org.manager?.trim() ?? '',
      enabled: org.enabled ?? true,
    }

    if (org.id) {
      const { error: err } = await supabase
        .from('organizations')
        .update(payload)
        .eq('id', org.id)
      if (err) throw err
      const target = organizations.value.find((o) => o.id === org.id)
      if (target) {
        Object.assign(target, {
          ...target,
          code: payload.code,
          name: payload.name,
          shortName: payload.short_name,
          type: payload.type,
          supervisor: payload.supervisor,
          manager: payload.manager,
          enabled: payload.enabled,
        })
      }
    } else {
      const { data, error: err } = await supabase
        .from('organizations')
        .insert(payload)
        .select()
        .single()
      if (err) throw err
      organizations.value.push({
        id: data.id,
        code: data.code ?? '',
        name: data.name,
        shortName: data.short_name ?? data.name,
        type: data.type,
        supervisor: data.supervisor ?? '',
        manager: data.manager ?? '',
        enabled: data.enabled,
      })
      organizations.value.sort((a, b) => a.code.localeCompare(b.code, 'zh-TW', { numeric: true }))
    }
  }

  async function deleteOrganization(id: number) {
    const { error: err } = await supabase
      .from('organizations')
      .delete()
      .eq('id', id)
    if (err) throw err
    organizations.value = organizations.value.filter((o) => o.id !== id)
  }

  // ── 主管範圍管理 ──────────────────────────────────────────
  async function fetchManagerScopes(managerId?: string) {
    let query = supabase
      .from('staff_manager_scope')
      .select('id, manager_id, member_id, active, created_at')
      .order('created_at', { ascending: false })

    if (managerId) {
      query = query.eq('manager_id', managerId)
    }

    const { data, error: err } = await query
    if (err) throw err

    managerScopes.value = (data ?? []).map((row: any) => ({
      id: row.id,
      managerId: row.manager_id,
      memberId: row.member_id,
      active: row.active,
      createdAt: row.created_at,
    }))
  }

  // ── 以組織為單位的主管範圍（店長用） ──────────────────────
  async function fetchManagerOrgScopes(managerId?: string) {
    let query = supabase
      .from('staff_manager_org_scope')
      .select('id, manager_id, org_id, active, created_at')
      .order('created_at', { ascending: false })

    if (managerId) query = query.eq('manager_id', managerId)

    const { data, error: err } = await query
    if (err) throw err

    managerOrgScopes.value = (data ?? []).map((row: any) => ({
      id: row.id,
      managerId: row.manager_id,
      orgId: row.org_id,
      active: row.active,
      createdAt: row.created_at,
    }))
  }

  async function replaceManagerOrgScope(managerId: string, orgIds: number[]) {
    const { error: delErr } = await supabase
      .from('staff_manager_org_scope')
      .delete()
      .eq('manager_id', managerId)
    if (delErr) throw delErr

    if (orgIds.length > 0) {
      const rows = orgIds.map((orgId) => ({
        manager_id: managerId,
        org_id: orgId,
        active: true,
      }))
      const { error: insErr } = await supabase
        .from('staff_manager_org_scope')
        .insert(rows)
      if (insErr) throw insErr
    }

    await fetchManagerOrgScopes()
  }

  async function replaceManagerScope(managerId: string, memberIds: string[]) {
    const dedupedMemberIds = Array.from(new Set(memberIds.filter((id) => id && id !== managerId)))

    const { error: delErr } = await supabase
      .from('staff_manager_scope')
      .delete()
      .eq('manager_id', managerId)
    if (delErr) throw delErr

    if (dedupedMemberIds.length > 0) {
      const rows = dedupedMemberIds.map((memberId) => ({
        manager_id: managerId,
        member_id: memberId,
        active: true,
      }))
      const { error: insErr } = await supabase
        .from('staff_manager_scope')
        .insert(rows)
      if (insErr) throw insErr
    }

    await fetchManagerScopes()
  }

  // ── 分類管理 ──────────────────────────────────────────────
  async function fetchCategories() {
    const { data, error: err } = await supabase
      .from('categories')
      .select('id, name, sort_order, enabled')
      .order('sort_order')
    if (err) { error.value = err.message; return }
    categories.value = (data ?? []).map((r: any) => ({
      id: r.id,
      name: r.name,
      sortOrder: r.sort_order,
      enabled: r.enabled,
    }))
  }

  async function upsertCategory(cat: Partial<Category> & { name: string }) {
    const payload = { name: cat.name.trim(), sort_order: cat.sortOrder ?? 0, enabled: cat.enabled ?? true }
    if (cat.id) {
      const { error: err } = await supabase.from('categories').update(payload).eq('id', cat.id)
      if (err) throw err
      const target = categories.value.find((c) => c.id === cat.id)
      if (target) Object.assign(target, { name: payload.name, sortOrder: payload.sort_order, enabled: payload.enabled })
    } else {
      const { data, error: err } = await supabase.from('categories').insert(payload).select().single()
      if (err) throw err
      categories.value.push({ id: data.id, name: data.name, sortOrder: data.sort_order, enabled: data.enabled })
    }
  }

  async function deleteCategory(id: number) {
    const { error: err } = await supabase.from('categories').delete().eq('id', id)
    if (err) throw err
    categories.value = categories.value.filter((c) => c.id !== id)
  }

  // ── 課程管理 ──────────────────────────────────────────────
  function mapCourseRows(data: any[]): typeof courses.value {
    return data.map((row: any) => ({
      id: row.id,
      title: row.title,
      categoryId: row.category_id ?? null,
      categoryName: row.categories?.name ?? '',
      description: row.description ?? '',
      enabled: row.enabled,
      coverUrl: row.cover_url ?? '',
      portalSections: row.portal_sections ?? [],
      audiences: (row.course_audiences ?? []).map((a: any) => ({
        id: a.id,
        courseId: a.course_id,
        audienceType: a.audience_type,
        audienceId: a.audience_id ?? null,
      })),
      lessons: (row.lessons ?? []).map((l: any) => ({
        id: l.id,
        courseId: row.id,
        title: l.title,
        summary: l.summary ?? '',
        durationSeconds: l.duration_seconds ?? 0,
        sortOrder: l.sort_order ?? 0,
        provider: l.video_provider ?? 'bunny',
        bunnyVideoId: l.bunny_video_id ?? '',
        coverUrl: l.cover_url ?? '',
      })).sort((a: any, b: any) => a.sortOrder - b.sortOrder),
    }))
  }

  async function fetchCourses() {
    try {
      isLoading.value = true
      error.value = null

      // 先嘗試含 portal_sections 欄位的查詢
      const { data, error: err } = await supabase
        .from('courses')
        .select(`
          id, title, category_id, description, enabled, cover_url, created_at, portal_sections,
          categories (name),
          course_audiences (id, course_id, audience_type, audience_id),
          lessons (id, title, summary, duration_seconds, cover_url, video_provider, bunny_video_id, sort_order)
        `)
        .order('created_at', { ascending: false })

      if (err) {
        // portal_sections 欄位尚未建立時，改用不含該欄位的查詢
        const { data: data2, error: err2 } = await supabase
          .from('courses')
          .select(`
            id, title, category_id, description, enabled, cover_url, created_at,
            categories (name),
            course_audiences (id, course_id, audience_type, audience_id),
            lessons (id, title, summary, duration_seconds, cover_url, video_provider, bunny_video_id, sort_order)
          `)
          .order('created_at', { ascending: false })
        if (err2) throw err2
        courses.value = mapCourseRows(data2 ?? [])
        return
      }

      courses.value = mapCourseRows(data ?? [])
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to fetch courses'
      courses.value = []
    } finally {
      isLoading.value = false
    }
  }

  async function upsertCourse(course: Partial<Course> & { title: string }) {
    const payload = {
      title: course.title.trim(),
      category_id: course.categoryId ?? null,
      description: course.description?.trim() ?? '',
      enabled: course.enabled ?? true,
      cover_url: course.coverUrl?.trim() ?? '',
      portal_sections: course.portalSections ?? [],
    }
    if (course.id) {
      const { error: err } = await supabase.from('courses').update(payload).eq('id', course.id)
      if (err) throw err
      const target = courses.value.find((c) => c.id === course.id)
      if (target) {
        target.title = payload.title
        target.categoryId = payload.category_id
        target.description = payload.description
        target.enabled = payload.enabled
        target.coverUrl = payload.cover_url
        target.portalSections = payload.portal_sections
        target.categoryName = categories.value.find((c) => c.id === payload.category_id)?.name ?? ''
      }
      return course.id
    } else {
      const { data, error: err } = await supabase.from('courses').insert(payload).select().single()
      if (err) throw err
      courses.value.unshift({
        id: data.id,
        title: data.title,
        categoryId: data.category_id ?? null,
        categoryName: categories.value.find((c) => c.id === data.category_id)?.name ?? '',
        description: data.description ?? '',
        enabled: data.enabled,
        coverUrl: data.cover_url ?? '',
        portalSections: data.portal_sections ?? [],
        audiences: [],
        lessons: [],
      })
      return data.id as string
    }
  }

  async function deleteCourse(id: string) {
    const { error: err } = await supabase.from('courses').delete().eq('id', id)
    if (err) throw err
    courses.value = courses.value.filter((c) => c.id !== id)
  }

  async function toggleCourseStatus(id: string, enabled: boolean) {
    const { error: err } = await supabase.from('courses').update({ enabled }).eq('id', id)
    if (err) throw err
    const target = courses.value.find((c) => c.id === id)
    if (target) target.enabled = enabled
  }

  async function saveCourseAudiences(courseId: string, audiences: Omit<CourseAudience, 'id'>[]) {
    const { error: delErr } = await supabase.from('course_audiences').delete().eq('course_id', courseId)
    if (delErr) throw delErr
    if (audiences.length === 0) {
      const target = courses.value.find((c) => c.id === courseId)
      if (target) target.audiences = []
      return
    }
    const rows = audiences.map((a) => ({
      course_id: courseId,
      audience_type: a.audienceType,
      audience_id: a.audienceId,
    }))
    const { data, error: insErr } = await supabase.from('course_audiences').insert(rows).select()
    if (insErr) throw insErr
    const target = courses.value.find((c) => c.id === courseId)
    if (target) {
      target.audiences = (data ?? []).map((r: any) => ({
        id: r.id,
        courseId: r.course_id,
        audienceType: r.audience_type,
        audienceId: r.audience_id ?? null,
      }))
    }
  }

  // ── 影片管理 ──────────────────────────────────────────────
  async function upsertLesson(lesson: Partial<Lesson> & { courseId: string; title: string }) {
    const payload = {
      course_id: lesson.courseId,
      title: lesson.title.trim(),
      summary: lesson.summary?.trim() ?? '',
      duration_seconds: lesson.durationSeconds ?? 0,
      sort_order: lesson.sortOrder ?? 0,
      video_provider: lesson.provider ?? 'bunny',
      bunny_video_id: lesson.bunnyVideoId?.trim() ?? '',
      cover_url: lesson.coverUrl?.trim() ?? '',
    }
    if (lesson.id) {
      const { error: err } = await supabase.from('lessons').update(payload).eq('id', lesson.id)
      if (err) throw err
      const course = courses.value.find((c) => c.id === lesson.courseId)
      const target = course?.lessons.find((l) => l.id === lesson.id)
      if (target) {
        target.title = payload.title
        target.summary = payload.summary
        target.durationSeconds = payload.duration_seconds
        target.sortOrder = payload.sort_order
        target.bunnyVideoId = payload.bunny_video_id
        target.coverUrl = payload.cover_url
      }
    } else {
      const { data, error: err } = await supabase.from('lessons').insert(payload).select().single()
      if (err) throw err
      const course = courses.value.find((c) => c.id === lesson.courseId)
      if (course) {
        course.lessons.push({
          id: data.id,
          courseId: data.course_id,
          title: data.title,
          summary: data.summary ?? '',
          durationSeconds: data.duration_seconds ?? 0,
          sortOrder: data.sort_order ?? 0,
          provider: data.video_provider ?? 'bunny',
          bunnyVideoId: data.bunny_video_id ?? '',
          coverUrl: data.cover_url ?? '',
        })
      }
    }
  }

  async function deleteLesson(lessonId: string, courseId: string) {
    const { error: err } = await supabase.from('lessons').delete().eq('id', lessonId)
    if (err) throw err
    const course = courses.value.find((c) => c.id === courseId)
    if (course) course.lessons = course.lessons.filter((l) => l.id !== lessonId)
  }

  // ── 學習進度 ──────────────────────────────────────────────
  async function fetchUserProgress(userId: string) {
    const { data, error: err } = await supabase
      .from('learning_progress')
      .select('staff_profile_id, lesson_id, completed_at, watched_seconds, duration_seconds')
      .eq('staff_profile_id', userId)
    if (err) { error.value = err.message; return }
    progresses.value = (data ?? []).map((r: any) => ({
      staffProfileId: r.staff_profile_id,
      lessonId: r.lesson_id,
      watchedSeconds: r.watched_seconds ?? 0,
      durationSeconds: r.duration_seconds ?? 0,
      completedAt: r.completed_at ?? null,
    }))
  }

  async function fetchTeamProgressRows() {
    const { data, error: err } = await supabase
      .from('v_team_learning_progress')
      .select('staff_profile_id, display_name, employee_no, org_id, rank, lesson_id, lesson_title, course_id, course_title, watched_seconds, duration_seconds, progress_percent, completed_at')
      .order('display_name')

    if (err) {
      error.value = err.message
      teamProgressRows.value = []
      return
    }

    teamProgressRows.value = (data ?? []).map((row: any) => ({
      staffProfileId: row.staff_profile_id,
      displayName: row.display_name ?? '',
      employeeNo: row.employee_no ?? '',
      orgId: row.org_id ?? null,
      rank: row.rank ?? null,
      lessonId: row.lesson_id,
      lessonTitle: row.lesson_title ?? '',
      courseId: row.course_id,
      courseTitle: row.course_title ?? '',
      watchedSeconds: row.watched_seconds ?? 0,
      durationSeconds: row.duration_seconds ?? 0,
      progressPercent: row.completed_at
        ? 100
        : (row.progress_percent ?? (row.duration_seconds > 0 ? Math.round((row.watched_seconds / row.duration_seconds) * 100) : 0)),
      completedAt: row.completed_at ?? null,
    }))
  }

  // 更新高水位線進度（不得往回移動）
  async function updateLessonProgress(payload: {
    userId: string
    lessonId: string
    watchedSeconds: number    // 目前高水位線
    durationSeconds: number
  }) {
    const existing = progresses.value.find(
      (p) => p.staffProfileId === payload.userId && p.lessonId === payload.lessonId,
    )
    // 高水位線：只會往前移
    const newWatched = Math.max(existing?.watchedSeconds ?? 0, payload.watchedSeconds)
    // duration=0 時不自動判定完成，避免誤判
    const isCompleted = payload.durationSeconds > 0 && newWatched >= payload.durationSeconds * 0.95
    const completedAt = isCompleted
      ? (existing?.completedAt ?? new Date().toISOString())
      : null

    const { error: err } = await supabase
      .from('learning_progress')
      .upsert({
        staff_profile_id: payload.userId,
        lesson_id: payload.lessonId,
        watched_seconds: newWatched,
        duration_seconds: payload.durationSeconds,
        completed_at: completedAt,
        progress_percent: payload.durationSeconds > 0
          ? Math.round((newWatched / payload.durationSeconds) * 100)
          : 0,
      })
    if (err) throw err

    // 本地更新
    if (existing) {
      existing.watchedSeconds = newWatched
      existing.durationSeconds = payload.durationSeconds
      existing.completedAt = completedAt
    } else {
      progresses.value.push({
        staffProfileId: payload.userId,
        lessonId: payload.lessonId,
        watchedSeconds: newWatched,
        durationSeconds: payload.durationSeconds,
        completedAt,
      })
    }
    return { isCompleted }
  }

  function markLessonCompleted(_userId: string, _lessonId: string) {
    // 已被 updateLessonProgress 取代，保留為相容
  }

  // ── RBAC 完整管理 ──────────────────────────────────────────
  async function fetchAllRoles() {
    const { data, error: err } = await supabase
      .from('roles')
      .select('id, key, title, description, is_system, enabled, role_permissions(count), user_roles(count)')
      .order('id')
    if (err) throw err
    allRoles.value = (data ?? []).map((r: any) => ({
      id: r.id,
      key: r.key,
      title: r.title,
      description: r.description ?? '',
      isSystem: r.is_system ?? false,
      enabled: r.enabled ?? true,
      permissionCount: Number(r.role_permissions?.[0]?.count ?? 0),
      userCount: Number(r.user_roles?.[0]?.count ?? 0),
    }))
  }

  async function fetchAllPermissions() {
    const { data, error: err } = await supabase
      .from('permissions')
      .select('id, key, title, description, category')
      .order('category')
    if (err) throw err
    allPermissions.value = (data ?? []).map((p: any) => ({
      id: p.id,
      key: p.key,
      title: p.title,
      description: p.description ?? '',
      category: p.category ?? '一般',
    }))
  }

  async function fetchRolePermissionIds(roleId: number): Promise<number[]> {
    const { data, error: err } = await supabase
      .from('role_permissions')
      .select('permission_id')
      .eq('role_id', roleId)
    if (err) throw err
    return (data ?? []).map((r: any) => r.permission_id)
  }

  async function fetchRoleMembers(roleId: number): Promise<RoleMember[]> {
    const { data, error: err } = await supabase
      .from('user_roles')
      .select('created_at, staff_profiles(id, display_name, employee_no, email, enabled)')
      .eq('role_id', roleId)
      .order('created_at')
    if (err) throw err
    return (data ?? []).map((r: any) => ({
      staffProfileId: r.staff_profiles?.id ?? '',
      displayName: r.staff_profiles?.display_name ?? '',
      employeeNo: r.staff_profiles?.employee_no ?? '',
      email: r.staff_profiles?.email ?? '',
      enabled: r.staff_profiles?.enabled ?? false,
      assignedAt: r.created_at ?? '',
    }))
  }

  async function saveRolePermissions(roleId: number, permissionIds: number[]) {
    const { error: delErr } = await supabase
      .from('role_permissions')
      .delete()
      .eq('role_id', roleId)
    if (delErr) throw delErr
    if (permissionIds.length > 0) {
      const { error: insErr } = await supabase
        .from('role_permissions')
        .insert(permissionIds.map(pid => ({ role_id: roleId, permission_id: pid })))
      if (insErr) throw insErr
    }
    const target = allRoles.value.find(r => r.id === roleId)
    if (target) target.permissionCount = permissionIds.length
  }

  async function addMemberToRole(roleId: number, employeeNo: string): Promise<any> {
    const { data: profile, error: findErr } = await supabase
      .from('staff_profiles')
      .select('id, display_name, employee_no, email, enabled')
      .eq('employee_no', employeeNo.trim())
      .single()
    if (findErr || !profile) throw new Error('找不到此員編的人員')
    const { error: insErr } = await supabase
      .from('user_roles')
      .insert({ staff_profile_id: profile.id, role_id: roleId })
    if (insErr) {
      if (insErr.code === '23505') throw new Error('此人員已擁有此角色')
      throw insErr
    }
    const target = allRoles.value.find(r => r.id === roleId)
    if (target) target.userCount++
    return profile
  }

  async function removeMemberFromRole(roleId: number, staffId: string) {
    const { error: err } = await supabase
      .from('user_roles')
      .delete()
      .eq('role_id', roleId)
      .eq('staff_profile_id', staffId)
    if (err) throw err
    const target = allRoles.value.find(r => r.id === roleId)
    if (target && target.userCount > 0) target.userCount--
  }

  async function createRole(data: { key: string; title: string; description: string }): Promise<number> {
    const { data: row, error: err } = await supabase
      .from('roles')
      .insert({ key: data.key.trim(), title: data.title.trim(), description: data.description.trim(), is_system: false, enabled: true })
      .select()
      .single()
    if (err) throw err
    allRoles.value.push({
      id: row.id, key: row.key, title: row.title,
      description: row.description ?? '', isSystem: false, enabled: true,
      permissionCount: 0, userCount: 0,
    })
    return row.id as number
  }

  async function updateRole(id: number, data: { key: string; title: string; description: string }) {
    const { error: err } = await supabase
      .from('roles')
      .update({ key: data.key.trim(), title: data.title.trim(), description: data.description.trim() })
      .eq('id', id)
    if (err) throw err
    const target = allRoles.value.find(r => r.id === id)
    if (target) Object.assign(target, { key: data.key.trim(), title: data.title.trim(), description: data.description.trim() })
  }

  async function toggleRoleEnabled(id: number, enabled: boolean) {
    const { error: err } = await supabase
      .from('roles')
      .update({ enabled })
      .eq('id', id)
    if (err) throw err
    const target = allRoles.value.find(r => r.id === id)
    if (target) target.enabled = enabled
  }

  async function deleteRole(id: number) {
    const { error: err } = await supabase.from('roles').delete().eq('id', id)
    if (err) throw err
    allRoles.value = allRoles.value.filter(r => r.id !== id)
  }

  // ── 初始化 ────────────────────────────────────────────────
  async function init() {
    await fetchOrganizations()
    await Promise.all([fetchStaff(), fetchCourses()])
  }

  return {
    staff,
    organizations,
    managerScopes,
    managerOrgScopes,
    categories,
    courses,
    progresses,
    teamProgressRows,
    roles: roleDefinitions,
    allRoles,
    allPermissions,
    isLoading,
    error,
    enabledStaffCount,
    enabledCoursesCount,
    totalLessonsCount,
    fetchStaff,
    fetchOrganizations,
    fetchCategories,
    upsertCategory,
    deleteCategory,
    fetchCourses,
    upsertCourse,
    deleteCourse,
    saveCourseAudiences,
    upsertLesson,
    deleteLesson,
    fetchUserProgress,
    fetchTeamProgressRows,
    updateLessonProgress,
    toggleStaffStatus,
    updateStaffEmployeeNo,
    updateStaffName,
    updateStaffOrg,
    assignStaffRole,
    upsertOrganization,
    deleteOrganization,
    fetchManagerScopes,
    replaceManagerScope,
    fetchManagerOrgScopes,
    replaceManagerOrgScope,
    toggleCourseStatus,
    markLessonCompleted,
    fetchAllRoles,
    fetchAllPermissions,
    fetchRolePermissionIds,
    fetchRoleMembers,
    saveRolePermissions,
    addMemberToRole,
    removeMemberFromRole,
    createRole,
    updateRole,
    toggleRoleEnabled,
    deleteRole,
    init,
  }
})