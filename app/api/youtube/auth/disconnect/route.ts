import { NextResponse } from 'next/server'
import { createSupabaseFuerRequest } from '@/lib/supabase-user'
import { youtubeTrennen } from '@/lib/youtube/youtube-oauth-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const sb = createSupabaseFuerRequest(req)
  if (!sb) return NextResponse.json({ error: 'Anmeldung erforderlich.' }, { status: 401 })
  await youtubeTrennen(sb)
  return NextResponse.json({ ok: true })
}
