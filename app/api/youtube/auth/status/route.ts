import { NextResponse } from 'next/server'
import { createSupabaseFuerRequest } from '@/lib/supabase-user'
import { youtubeStatus } from '@/lib/youtube/youtube-oauth-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const sb = createSupabaseFuerRequest(req)
  return NextResponse.json(await youtubeStatus(sb))
}
