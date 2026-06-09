import {
  leseOAuthState,
  loescheOAuthState,
  tauscheAuthCode,
  whoopApiKonfiguriert,
} from '@/lib/fitnessdaten/whoop-cloud-server'
import { loeseWhoopPending } from '@/lib/fitnessdaten/whoop-oauth-store'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const error = url.searchParams.get('error')
  const origin = url.origin
  const redirectBase = `${origin}/fitnessdaten`

  if (error) {
    return NextResponse.redirect(`${redirectBase}?whoop_error=${encodeURIComponent(error)}`)
  }

  if (!whoopApiKonfiguriert() || !code || !state) {
    return NextResponse.redirect(`${redirectBase}?whoop_error=invalid_callback`)
  }

  const ownerUserId = await loeseWhoopPending(state)
  if (!ownerUserId) {
    const saved = await leseOAuthState()
    await loescheOAuthState()
    if (!saved || saved !== state) {
      return NextResponse.redirect(`${redirectBase}?whoop_error=state_mismatch`)
    }
  }

  try {
    await tauscheAuthCode(code, origin, ownerUserId)
    return NextResponse.redirect(`${redirectBase}?whoop=connected`)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'token_exchange_failed'
    return NextResponse.redirect(`${redirectBase}?whoop_error=${encodeURIComponent(msg.slice(0, 120))}`)
  }
}
