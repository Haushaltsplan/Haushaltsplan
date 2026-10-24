import { NextResponse } from 'next/server'
import { loeseYoutubePending } from '@/lib/youtube/youtube-oauth-store'
import { tauscheYoutubeAuthCode, youtubeApiKonfiguriert } from '@/lib/youtube/youtube-oauth-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const error = url.searchParams.get('error')
  const origin = url.origin
  const ziel = `${origin}/youtube`

  if (error) return NextResponse.redirect(`${ziel}?yt_error=${encodeURIComponent(error)}`)
  if (!youtubeApiKonfiguriert() || !code || !state) {
    return NextResponse.redirect(`${ziel}?yt_error=invalid_callback`)
  }

  const pending = await loeseYoutubePending(state)
  if (!pending) return NextResponse.redirect(`${ziel}?yt_error=state_mismatch`)

  try {
    await tauscheYoutubeAuthCode({
      code,
      origin,
      ownerUserId: pending.ownerUserId,
      codeVerifier: pending.codeVerifier,
    })
    return NextResponse.redirect(`${ziel}?yt=connected`)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'token_exchange_failed'
    return NextResponse.redirect(`${ziel}?yt_error=${encodeURIComponent(msg.slice(0, 120))}`)
  }
}
