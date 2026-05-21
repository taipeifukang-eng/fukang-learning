export const appConfig = {
  appName: '富康學院學習網',
  appSubtitle: '富康連鎖藥局學習平台',
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL ?? '',
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY ?? '',
  lineClientId: import.meta.env.VITE_LINE_CLIENT_ID ?? '',
  lineRedirectUri:
    import.meta.env.VITE_LINE_REDIRECT_URI ?? `${window.location.origin}/auth/line/callback`,
  bunnyLibraryId: import.meta.env.VITE_BUNNY_LIBRARY_ID ?? '',
  bunnyCdnHost: import.meta.env.VITE_BUNNY_CDN_HOST ?? 'iframe.mediadelivery.net',
}

export function buildLineAuthorizeUrl(state: string, nonce: string) {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: appConfig.lineClientId,
    redirect_uri: appConfig.lineRedirectUri,
    scope: 'profile openid',
    state,
    nonce,
    // 每次都強制顯示 LINE 帳號選擇畫面，防止公用電腦自動帶入前一個登入者
    prompt: 'consent',
  })
  return `https://access.line.me/oauth2/v2.1/authorize?${params.toString()}`
}

export function getBunnyEmbedUrl(videoId: string) {
  if (!appConfig.bunnyLibraryId || !videoId) {
    return ''
  }

  return `https://${appConfig.bunnyCdnHost}/embed/${appConfig.bunnyLibraryId}/${videoId}?defaultQuality=720`
}