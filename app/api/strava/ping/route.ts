import { stravaApiKonfiguriert } from '@/lib/strava/strava-server'
import { stravaCallbackDomain, stravaRedirectUri } from '@/lib/strava/strava-types'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const origin = new URL(req.url).origin
  let redirectUri = ''
  let callbackDomain = ''
  try {
    redirectUri = stravaRedirectUri(origin)
    callbackDomain = stravaCallbackDomain(origin)
  } catch {
    /* nicht konfiguriert */
  }
  return NextResponse.json({
    configured: stravaApiKonfiguriert(),
    redirectUri: redirectUri || undefined,
    callbackDomain: callbackDomain || undefined,
  })
}
