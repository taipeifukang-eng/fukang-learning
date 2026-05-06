import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  // 处理 CORS 预检
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { code, redirect_uri } = await req.json()

    if (!code || !redirect_uri) {
      console.error('Missing parameters:', { code: !!code, redirect_uri: !!redirect_uri })
      return jsonResponse({ error: 'missing_params', message: 'code and redirect_uri required' }, 400)
    }

    // ── 1. 驗證環境變數 ──────────────────────────────────────
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
    // 使用已驗證正確的 SERVICE_ROLE_KEY
    const SERVICE_ROLE_KEY = Deno.env.get('SERVICE_ROLE_KEY')
    const LINE_CHANNEL_ID = Deno.env.get('LINE_CHANNEL_ID')
    const LINE_CHANNEL_SECRET = Deno.env.get('LINE_CHANNEL_SECRET')

    console.log('Step 1: Environment validation', {
      hasSupabaseUrl: !!SUPABASE_URL,
      hasServiceRoleKey: !!SERVICE_ROLE_KEY,
      usingAutoInjectedKey: !!Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
      hasLineChannelId: !!LINE_CHANNEL_ID,
      hasLineChannelSecret: !!LINE_CHANNEL_SECRET,
    })

    if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !LINE_CHANNEL_ID || !LINE_CHANNEL_SECRET) {
      console.error('Missing critical environment variables')
      return jsonResponse({ 
        error: 'server_misconfiguration',
        missing: {
          supabaseUrl: !SUPABASE_URL,
          serviceRoleKey: !SERVICE_ROLE_KEY,
          lineChannelId: !LINE_CHANNEL_ID,
          lineChannelSecret: !LINE_CHANNEL_SECRET,
        }
      }, 500)
    }

    // ── 2. LINE 授權碼交換 ────────────────────────────────────
    console.log('Step 2: Exchanging LINE authorization code')
    
    const lineTokenUrl = 'https://api.line.me/oauth2/v2.1/token'
    const tokenParams = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri,
      client_id: LINE_CHANNEL_ID,
      client_secret: LINE_CHANNEL_SECRET,
    })

    const tokenRes = await fetch(lineTokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: tokenParams,
    })

    if (!tokenRes.ok) {
      const detail = await tokenRes.text()
      console.error('LINE token exchange failed:', {
        status: tokenRes.status,
        detail: detail.substring(0, 200),
      })
      return jsonResponse({ 
        error: 'line_token_failed', 
        status: tokenRes.status,
        detail: detail.substring(0, 100)
      }, 400)
    }

    const tokenData = await tokenRes.json()
    const access_token = tokenData.access_token

    if (!access_token) {
      console.error('No access_token in LINE response')
      return jsonResponse({ error: 'line_invalid_response' }, 400)
    }

    // ── 3. 取得 LINE 用戶資料 ──────────────────────────────────
    console.log('Step 3: Fetching LINE profile')
    
    const profileRes = await fetch('https://api.line.me/v2/profile', {
      headers: { Authorization: `Bearer ${access_token}` },
    })

    if (!profileRes.ok) {
      console.error('LINE profile fetch failed:', { status: profileRes.status })
      return jsonResponse({ error: 'line_profile_failed', status: profileRes.status }, 400)
    }

    const lineProfile = await profileRes.json() as {
      userId: string
      displayName: string
      pictureUrl?: string
    }

    console.log('Step 3: LINE profile retrieved', { userId: lineProfile.userId })

    // ── 4. 初始化 Supabase Admin 客戶端 ──────────────────────
    console.log('Step 4: Initializing Supabase admin client')
    
    // 強制使用 service_role 身份，不繼承前端傳入的 Authorization header
    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
      db: { schema: 'public' },
      global: {
        headers: {
          Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        },
      },
    })

    // ── 5. 查詢現有 staff_profile ────────────────────────────
    console.log('Step 5: Checking if staff profile exists')
    
    const { data: existingProfile, error: selectError } = await supabaseAdmin
      .from('staff_profiles')
      .select('id, enabled, display_name')
      .eq('line_user_id', lineProfile.userId)
      .maybeSingle()

    if (selectError && selectError.code !== 'PGRST116') {
      console.error('Error querying staff_profiles:', selectError)
      return jsonResponse({ 
        error: 'db_query_failed',
        detail: selectError.message
      }, 500)
    }

    let authUserId: string

    if (existingProfile) {
      console.log('Existing profile found:', { id: existingProfile.id })

      // 檢查帳號是否被停用
      if (!existingProfile.enabled) {
        console.warn('Account disabled:', { id: existingProfile.id })
        return jsonResponse({ error: 'account_disabled' }, 403)
      }

      authUserId = existingProfile.id

      // 更新顯示名稱
      if (existingProfile.display_name !== lineProfile.displayName) {
        await supabaseAdmin
          .from('staff_profiles')
          .update({ display_name: lineProfile.displayName })
          .eq('id', authUserId)
      }
    } else {
      // ── 6. 新使用者：建立 Supabase Auth 用戶 ──────────────
      console.log('Step 6: Creating new Supabase auth user')

      const fakeEmail = `${lineProfile.userId}@fukangtw.local`

      const { data: newUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: fakeEmail,
        email_confirm: true,
        user_metadata: {
          line_user_id: lineProfile.userId,
          display_name: lineProfile.displayName,
          picture_url: lineProfile.pictureUrl ?? '',
        },
      })

      if (authError || !newUser?.user) {
        // 如果 email 已存在，用 admin listUsers 查找現有用戶
        if ((authError as any)?.code === 'email_exists' || authError?.message?.includes('already been registered')) {
          console.log('Email exists, searching via admin.listUsers...')
          
          const { data: listData, error: listError } = await supabaseAdmin.auth.admin.listUsers({
            page: 1,
            perPage: 1000,
          })
          
          const foundUser = listData?.users?.find((u: any) => u.email === fakeEmail)
          
          if (listError || !foundUser) {
            console.error('Failed to find existing user:', listError?.message)
            return jsonResponse({ 
              error: 'create_user_failed', 
              detail: `email_exists but lookup failed: ${listError?.message ?? 'not found in listUsers'}` 
            }, 500)
          }
          
          authUserId = foundUser.id
          console.log('Found existing auth user:', { userId: authUserId })
        } else {
          console.error('❌ Auth user creation failed:', {
            error: authError?.message || 'unknown',
            errorCode: (authError as any)?.code,
            email: fakeEmail,
          })
          return jsonResponse({ 
            error: 'create_user_failed',
            detail: authError?.message || 'unknown error',
            code: (authError as any)?.code
          }, 500)
        }
      } else {
        authUserId = newUser.user.id
        console.log('✅ Auth user created:', { userId: authUserId })
      }

      // ── 7. 建立 staff_profiles 記錄 ────────────────────────
      console.log('Step 7: Creating staff_profiles record')

      const { error: insertError } = await supabaseAdmin
        .from('staff_profiles')
        .insert({
          id: authUserId,
          line_user_id: lineProfile.userId,
          display_name: lineProfile.displayName,
        })

      if (insertError) {
        console.error('❌ staff_profiles insert failed:', {
          error: insertError.message,
          code: insertError.code,
          details: insertError.details,
        })
        
        // 嘗試回滾 Auth 用戶（可選）
        await supabaseAdmin.auth.admin.deleteUser(authUserId).catch(e => 
          console.error('Rollback failed:', e)
        )
        
        return jsonResponse({ 
          error: 'create_profile_failed',
          detail: insertError.message
        }, 500)
      }

      console.log('✅ staff_profiles record created:', { userId: authUserId })
    }

    // ── 8. 產生 Magic Link Token（供前端 verifyOtp 換 session）──
    console.log('Step 8: Generating magic link token for session exchange')

    const fakeEmailForLink = `${lineProfile.userId}@fukangtw.local`

    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: fakeEmailForLink,
    })

    if (linkError || !linkData?.properties?.hashed_token) {
      console.error('❌ generateLink failed:', linkError?.message)
      return jsonResponse({ 
        error: 'session_failed',
        detail: linkError?.message ?? 'no hashed_token returned'
      }, 500)
    }

    console.log('✅ Token generated successfully')

    // ── 9. 成功回應 ──────────────────────────────────────────
    return jsonResponse({ 
      success: true,
      token_hash: linkData.properties.hashed_token,
      email: fakeEmailForLink,
    })

  } catch (err) {
    console.error('🔥 Unhandled exception:', {
      message: String(err),
      stack: err instanceof Error ? err.stack : 'unknown',
    })
    return jsonResponse({ 
      error: 'internal_error',
      detail: String(err)
    }, 500)
  }
})

