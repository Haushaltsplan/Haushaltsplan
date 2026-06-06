import {
  baueWhoopAuthUrl,
  setzeOAuthState,
  whoopApiKonfiguriert,
} from '@/lib/fitnessdaten/whoop-cloud-server'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  if (!whoopApiKonfiguriert()) {
    return NextResponse.json(
      { error: 'WHOOP OAuth nicht konfiguriert — WHOOP_CLIENT_ID und WHOOP_CLIENT_SECRET in .env.local.' },
      { status: 501 },
    )
  }

  const origin = new URL(req.url).origin
  const state = crypto.randomUUID().replace(/-/g, '').slice(0, 16)
  await setzeOAuthState(state)
  return NextResponse.redirect(baueWhoopAuthUrl(origin, state))
}
