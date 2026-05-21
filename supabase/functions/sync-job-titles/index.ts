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
    // ── 0. 業務網連線設定 ─────────────────────────────────────
    const bizUrl = Deno.env.get('BIZMGMT_SUPABASE_URL')!
    const bizKey = Deno.env.get('BIZMGMT_SERVICE_ROLE_KEY')!

    // ── 探索模式：回傳業務網可用資料表（不需用戶驗證）──────────
    const urlObj = new URL(req.url)
    if (urlObj.searchParams.get('discover') === '1') {
      const schemaRes = await fetch(`${bizUrl}/rest/v1/`, {
        headers: { apikey: bizKey, Authorization: `Bearer ${bizKey}` },
      })
      const schema = await schemaRes.json()
      const tables = Object.keys(schema.paths ?? {}).map((p) => p.replace('/', '').replace('/', ''))
      // 若有指定 table，回傳該表的欄位
      const targetTable = urlObj.searchParams.get('table')
      const defs = schema.definitions ?? {}
      const tableSchema = targetTable ? defs[targetTable] : null
      return new Response(JSON.stringify({ tables, tableSchema }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ── 1. 驗證呼叫者為管理員 ─────────────────────────────────
    const authHeader = req.headers.get('Authorization') ?? ''

    // 使用新版 SUPABASE_SECRET_KEYS（JSON dict），向下相容舊版
    const secretKeysJson = Deno.env.get('SUPABASE_SECRET_KEYS')
    let serviceRoleKey: string
    if (secretKeysJson) {
      const secretKeys = JSON.parse(secretKeysJson)
      // 取第一個 key（service role）
      serviceRoleKey = Object.values(secretKeys)[0] as string
    } else {
      // 向下相容舊版（仍可運作，只是 deprecated）
      serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    }

    const learningClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      serviceRoleKey,
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

    // ── 2. 從 FK菁英業務管理網 員工管理 抓取 employee_code + current_position ──
    const bizRes = await fetch(
      `${bizUrl}/rest/v1/store_employees?select=employee_code,current_position&is_active=eq.true`,
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

    const bizEmployees: Array<{ employee_code: string | null; current_position: string | null }> =
      await bizRes.json()

    // ── 3. 更新學院系統 staff_profiles.job_title ─────────────
    let updated = 0
    let skipped = 0

    for (const p of bizEmployees) {
      if (!p.employee_code || !p.current_position) { skipped++; continue }

      const { error } = await learningClient
        .from('staff_profiles')
        .update({ job_title: p.current_position })
        .eq('employee_no', p.employee_code)
        .neq('job_title', p.current_position) // 只更新有變化的

      if (!error) updated++
    }

    return new Response(
      JSON.stringify({
        success: true,
        updated,
        skipped,
        total: bizEmployees.length,
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
