import { whoopCloudTrennen } from '@/lib/fitnessdaten/whoop-cloud-server'
import { createSupabaseFuerRequest } from '@/lib/supabase-user'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const sb = createSupabaseFuerRequest(req)
  await whoopCloudTrennen(sb)
  return NextResponse.json({ ok: true })
}
