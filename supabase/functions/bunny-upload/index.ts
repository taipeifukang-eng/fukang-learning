import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS })
  }

  const libraryId = Deno.env.get('BUNNY_LIBRARY_ID')
  const apiKey = Deno.env.get('BUNNY_API_KEY')

  if (!libraryId || !apiKey) {
    return new Response(JSON.stringify({ error: 'Server misconfiguration' }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  // GET: 取得影片資訊（包含時長）
  if (req.method === 'GET') {
    const url = new URL(req.url)
    const videoId = url.searchParams.get('videoId')
    if (!videoId) {
      return new Response(JSON.stringify({ error: 'videoId is required' }), {
        status: 400,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    const infoRes = await fetch(
      `https://video.bunnycdn.com/library/${libraryId}/videos/${videoId}`,
      { headers: { AccessKey: apiKey } },
    )
    if (!infoRes.ok) {
      return new Response(JSON.stringify({ error: 'Failed to fetch video info from Bunny' }), {
        status: 502,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }
    const info = await infoRes.json()
    return new Response(
      JSON.stringify({
        videoId: info.guid,
        duration: Math.round(info.length ?? 0),
        status: info.status, // 4 = 處理完成
        title: info.title,
      }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } },
    )
  }

  // POST: 建立新影片
  const { title } = await req.json()
  if (!title?.trim()) {
    return new Response(JSON.stringify({ error: 'title is required' }), {
      status: 400,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  // Step 1: 在 Bunny 建立 video 記錄，取得 videoId 與上傳 URL
  const createRes = await fetch(
    `https://video.bunnycdn.com/library/${libraryId}/videos`,
    {
      method: 'POST',
      headers: {
        AccessKey: apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title }),
    },
  )

  if (!createRes.ok) {
    const msg = await createRes.text()
    return new Response(JSON.stringify({ error: `Bunny error: ${msg}` }), {
      status: 502,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  const video = await createRes.json()

  // 回傳給前端：videoId（存 DB 用）+ 上傳端點 + 上傳用 API Key
  return new Response(
    JSON.stringify({
      videoId: video.guid,
      uploadUrl: `https://video.bunnycdn.com/library/${libraryId}/videos/${video.guid}`,
      apiKey,           // 前端直接 PUT 上去，只暴露給已登入使用者
      libraryId,
    }),
    { headers: { ...CORS, 'Content-Type': 'application/json' } },
  )
})
