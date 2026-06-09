import { whoopCloudStatus } from '@/lib/fitnessdaten/whoop-cloud-server'
import { createSupabaseFuerRequest } from '@/lib/supabase-user'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const sb = createSupabaseFuerRequest(req)
  const status = await whoopCloudStatus(sb)
  return NextResponse.json(status)
}
