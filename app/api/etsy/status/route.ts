import { etsyStatus } from '@/lib/etsy/etsy-server'
import { createSupabaseFuerRequest } from '@/lib/supabase-user'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const sb = createSupabaseFuerRequest(req)
  const status = await etsyStatus(sb)
  return NextResponse.json(status)
}
