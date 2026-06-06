import { whoopCloudStatus } from '@/lib/fitnessdaten/whoop-cloud-server'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const status = await whoopCloudStatus()
  return NextResponse.json(status)
}
