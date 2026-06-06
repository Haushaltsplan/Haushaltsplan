import { loescheTokens } from '@/lib/fitnessdaten/whoop-cloud-server'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST() {
  await loescheTokens()
  return NextResponse.json({ ok: true })
}
