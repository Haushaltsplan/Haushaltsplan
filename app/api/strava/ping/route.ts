import { stravaApiKonfiguriert } from '@/lib/strava/strava-server'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json({ configured: stravaApiKonfiguriert() })
}
