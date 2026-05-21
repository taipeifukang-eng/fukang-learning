import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { Session } from '@supabase/supabase-js'
import { appConfig, buildLineAuthorizeUrl } from '../lib/config'
import { supabase } from '../lib/supabase'
import { getRoleDefinition, staffSeed, type PermissionKey, type RoleKey, type StaffMember } from '../data/mockData'

// ── Mock mode helpers (保留示範登入功能) ─────────────────────────────
const MOCK_STORAGE_KEY = 'fukang-learning-mock-auth'

type MockUser = StaffMember & { displayRole: string }

function readMockUser(): MockUser | null {
  const raw = localStorage.getItem(MOCK_STORAGE_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as MockUser
  } catch {
    localStorage.removeItem(MOCK_STORAGE_KEY)
    return null
  }
}

// ── Real user profile type ────────────────────────────────────────────
export interface StaffProfile {
  id: string
  lineUserId: string
  displayName: string
  email: string | null
  department: string | null
  enabled: boolean
  roles: Array<{ id: number; key: string; title: string }>
  permissions: string[]
}

export const useAuthStore = defineStore('auth', () => {
  // 真實登入的 Supabase session
  const session = ref<Session | null>(null)
  const profile = ref<StaffProfile | null>(null)

  // Mock 模式（示範用）
  const mockUser = ref<MockUser | null>(readMockUser())

  // ── Computed ──────────────────────────────────────────────────────
  const isAuthenticated = computed(
    () => session.value !== null || mockUser.value !== null,
  )

  const currentUser = computed(() => {
    if (profile.value) {
      return {
        id: profile.value.id,
        name: profile.value.displayName,
        employeeNo: '',
        jobTitle: '',
        role: (profile.value.roles[0]?.key ?? 'student') as RoleKey,
        roles: profile.value.roles,
        orgId: null,
        orgCode: '',
        orgShortName: '',
        department: profile.value.department ?? '',
        lineUserId: profile.value.lineUserId,
        email: profile.value.email ?? '',
        enabled: profile.value.enabled,
        lastLoginAt: '',
        displayRole: profile.value.roles[0]?.title ?? '學員',
      } satisfies MockUser
    }
    if (mockUser.value) return mockUser.value
    return null
  })

  const permissions = computed<string[]>(() => {
    if (profile.value) return profile.value.permissions ?? []
    if (mockUser.value) return getRoleDefinition(mockUser.value.role)?.permissions ?? []
    return []
  })

  const defaultHomePath = computed(() => {
    const perms = permissions.value
    return perms.includes('dashboard:view') ? '/admin' : '/learning'
  })

  // ── Real LINE Login ────────────────────────────────────────────────
  function startLineLogin() {
    // CSRF 保護：產生 state + nonce 存在 sessionStorage
    const state = crypto.randomUUID()
    const nonce = crypto.randomUUID()
    sessionStorage.setItem('line_oauth_state', state)
    sessionStorage.setItem('line_oauth_nonce', nonce)
    window.location.href = buildLineAuthorizeUrl(state, nonce)
  }

  async function completeLineLogin(code: string, receivedState: string): Promise<void> {
    // CSRF 驗證
    const storedState = sessionStorage.getItem('line_oauth_state')
    sessionStorage.removeItem('line_oauth_state')
    sessionStorage.removeItem('line_oauth_nonce')

    if (!storedState || storedState !== receivedState) {
      throw new Error('OAuth state 不符，可能遭到 CSRF 攻擊，請重新登入。')
    }

    // 呼叫 Edge Function
    const fnUrl = `${appConfig.supabaseUrl}/functions/v1/line-callback`
    const res = await fetch(fnUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: appConfig.supabaseAnonKey,
        Authorization: `Bearer ${appConfig.supabaseAnonKey}`,
      },
      body: JSON.stringify({
        code,
        redirect_uri: appConfig.lineRedirectUri,
      }),
    })

    const data = await res.json()

    if (!res.ok) {
      if (data.error === 'account_disabled') {
        throw new Error('您的帳號已停用，請聯絡管理員。')
      }
      // 顯示完整錯誤訊息以便診斷
      const detail = data.detail ? ` (${data.detail})` : ''
      const code = data.code ? ` [${data.code}]` : ''
      throw new Error(`${data.error}${detail}${code}`)
    }

    // 用 verifyOtp 交換 session（Edge Function 回傳 token_hash）
    const { data: otpData, error: otpError } = await supabase.auth.verifyOtp({
      token_hash: data.token_hash,
      type: 'magiclink',
    })

    if (otpError || !otpData?.session) {
      throw new Error(`session_exchange_failed (${otpError?.message ?? 'no session'})`)
    }

    session.value = otpData.session
    // 若切回正式登入，清除 mock 狀態避免 UI 權限誤判
    mockUser.value = null
    localStorage.removeItem(MOCK_STORAGE_KEY)

    // 取得完整 profile（含角色/權限），傳入 session 避免 deadlock
    await fetchProfile(otpData.session)
  }

  async function fetchProfile(sessionArg?: Session): Promise<void> {
    // 優先使用傳入的 session，避免在 onAuthStateChange callback 內再呼叫 getSession（會造成 deadlock）
    let currentSession = sessionArg ?? null
    if (!currentSession) {
      const { data } = await supabase.auth.getSession()
      currentSession = data.session
    }
    if (!currentSession) return

    session.value = currentSession
    // 有正式 session 時，強制採用正式身份
    mockUser.value = null
    localStorage.removeItem(MOCK_STORAGE_KEY)

    const { data, error } = await supabase
      .from('staff_profiles')
      .select(`
        id, line_user_id, display_name, email, department, enabled,
        user_roles (
          roles (
            id, key, title,
            role_permissions (
              permissions ( key )
            )
          )
        )
      `)
      .eq('id', currentSession.user.id)
      .single()

    if (error || !data) return

    const roles = (data.user_roles as any[])
      .filter((ur: any) => ur.roles != null)
      .map((ur: any) => ({
        id: ur.roles.id,
        key: ur.roles.key,
        title: ur.roles.title,
      }))

    const permissionsSet = new Set<string>()
    ;(data.user_roles as any[]).forEach((ur: any) => {
      if (!ur.roles) return
      ;(ur.roles.role_permissions as any[]).forEach((rp: any) => {
        if (rp.permissions?.key) permissionsSet.add(rp.permissions.key)
      })
    })

    profile.value = {
      id: data.id,
      lineUserId: data.line_user_id,
      displayName: data.display_name,
      email: data.email ?? null,
      department: data.department ?? null,
      enabled: data.enabled,
      roles,
      permissions: Array.from(permissionsSet),
    }
  }

  // ── Mock 模式（示範登入） ──────────────────────────────────────────
  function loginWithMockLine(role: RoleKey = 'super_admin') {
    const matched = staffSeed.find((s) => s.role === role) ?? staffSeed[0]
    mockUser.value = {
      ...matched,
      enabled: true,
      lastLoginAt: new Date().toLocaleString('zh-TW', { hour12: false }),
      displayRole: getRoleDefinition(role).title,
    }
    localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(mockUser.value))
  }

  // ── Permission check ───────────────────────────────────────────────
  function hasPermission(permission: PermissionKey | string) {
    return permissions.value.includes(permission as PermissionKey)
  }

  // ── Logout ────────────────────────────────────────────────────────
  async function logout() {
    if (session.value) {
      await supabase.auth.signOut()
    }
    session.value = null
    profile.value = null
    mockUser.value = null
    localStorage.removeItem(MOCK_STORAGE_KEY)
  }

  // ── Init：app 啟動時恢復 session ──────────────────────────────────
  async function init() {
    // Supabase v2 正確做法：
    // onAuthStateChange callback 內【只做同步更新】，絕不 await 任何東西。
    // 在 callback 內 await（包含任何 Supabase 呼叫）會阻塞 auth 狀態機 → 頁面卡死。
    supabase.auth.onAuthStateChange((event, newSession) => {
      if (event === 'SIGNED_OUT') {
        session.value = null
        profile.value = null
      } else if (newSession) {
        // 只更新 session（同步），讓 isAuthenticated 在 token refresh 後維持正確
        session.value = newSession
        if (!newSession) {
          mockUser.value = null
        }
      }
    })

    // 初始化：從 localStorage 還原 session（在 callback 外部安全呼叫）
    const { data: { session: existing } } = await supabase.auth.getSession()
    if (existing) {
      session.value = existing
      mockUser.value = null
      localStorage.removeItem(MOCK_STORAGE_KEY)
      await fetchProfile(existing)
    }
  }

  return {
    session,
    profile,
    currentUser,
    isAuthenticated,
    permissions,
    defaultHomePath,
    startLineLogin,
    completeLineLogin,
    fetchProfile,
    loginWithMockLine,
    hasPermission,
    logout,
    init,
  }
})