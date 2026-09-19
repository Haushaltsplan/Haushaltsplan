import { loeseEtsyPending } from '@/lib/etsy/etsy-oauth-store'
import { etsyApiKonfiguriert, tauscheEtsyAuthCode } from '@/lib/etsy/etsy-server'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const error = url.searchParams.get('error')
  const origin = url.origin
  const redirectBase = `${origin}/etsy-ki-agent`

  if (error) {
    return NextResponse.redirect(`${redirectBase}?etsy_error=${encodeURIComponent(error)}`)
  }

  if (!etsyApiKonfiguriert() || !code || !state) {
    return NextResponse.redirect(`${redirectBase}?etsy_error=invalid_callback`)
  }

  const pending = await loeseEtsyPending(state)
  if (!pending) {
    return NextResponse.redirect(`${redirectBase}?etsy_error=state_mismatch`)
  }

  try {
    await tauscheEtsyAuthCode({
      code,
      origin,
      ownerUserId: pending.ownerUserId,
      codeVerifier: pending.codeVerifier,
    })
    return NextResponse.redirect(`${redirectBase}?etsy=connected`)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'token_exchange_failed'
    return NextResponse.redirect(`${redirectBase}?etsy_error=${encodeURIComponent(msg.slice(0, 120))}`)
  }
}
