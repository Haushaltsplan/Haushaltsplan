import { loeseStravaPending } from '@/lib/strava/strava-oauth-store'
import { stravaApiKonfiguriert, tauscheAuthCode } from '@/lib/strava/strava-server'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const error = url.searchParams.get('error')
  const origin = url.origin
  const redirectBase = `${origin}/rennrad`

  if (error) {
    return NextResponse.redirect(`${redirectBase}?strava_error=${encodeURIComponent(error)}`)
  }

  if (!stravaApiKonfiguriert() || !code || !state) {
    return NextResponse.redirect(`${redirectBase}?strava_error=invalid_callback`)
  }

  const ownerUserId = await loeseStravaPending(state)
  if (!ownerUserId) {
    return NextResponse.redirect(`${redirectBase}?strava_error=state_mismatch`)
  }

  try {
    await tauscheAuthCode(code, origin, ownerUserId)
    return NextResponse.redirect(`${redirectBase}?strava=connected`)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'token_exchange_failed'
    return NextResponse.redirect(`${redirectBase}?strava_error=${encodeURIComponent(msg.slice(0, 120))}`)
  }
}
