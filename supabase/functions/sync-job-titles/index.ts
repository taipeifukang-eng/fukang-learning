import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // ── 1. 驗證呼叫者為管理員 ─────────────────────────────────
    const authHeader = req.headers.get('Authorization') ?? ''
    const learningClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    )
    const { data: { user } } = await userClient.auth.getUser()
    if (!user) {
      return new Response(JSON.stringify({ error: '未授權' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ── 2. 從 FK菁英業務管理網 抓取 employee_code + job_title ──
    const bizUrl = Deno.env.get('BIZMGMT_SUPABASE_URL')!
    const bizKey = Deno.env.get('BIZMGMT_SERVICE_ROLE_KEY')!

    const bizRes = await fetch(
      `${bizUrl}/rest/v1/profiles?select=employee_code,job_title`,
      {
        headers: {
          apikey: bizKey,
          Authorization: `Bearer ${bizKey}`,
          'Content-Type': 'application/json',
        },
      },
    )

    if (!bizRes.ok) {
      const text = await bizRes.text()
      throw new Error(`業務網查詢失敗: ${bizRes.status} ${text}`)
    }

    const bizProfiles: Array<{ employee_code: string | null; job_title: string | null }> =
      await bizRes.json()

    // ── 3. 更新學院系統 staff_profiles.job_title ─────────────
    let updated = 0
    let skipped = 0

    for (const p of bizProfiles) {
      if (!p.employee_code || !p.job_title) { skipped++; continue }

      const { error } = await learningClient
        .from('staff_profiles')
        .update({ job_title: p.job_title })
        .eq('employee_no', p.employee_code)
        .neq('job_title', p.job_title) // 只更新有變化的

      if (!error) updated++
    }

    return new Response(
      JSON.stringify({
        success: true,
        updated,
        skipped,
        total: bizProfiles.length,
        message: `已同步 ${updated} 筆職位資料（跳過 ${skipped} 筆）`,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error(err)
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
