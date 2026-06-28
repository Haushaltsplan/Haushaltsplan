import { ladeActivityPolyline } from '@/lib/strava/strava-server'
import { createSupabaseFuerRequest } from '@/lib/supabase-user'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(
  req: Request,
  ctx: { params: Promise<{ stravaId: string }> },
) {
  const sb = createSupabaseFuerRequest(req)
  if (!sb) {
    return NextResponse.json({ error: 'Anmeldung erforderlich.' }, { status: 401 })
  }

  const { stravaId } = await ctx.params
  const id = Number(stravaId)
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: 'Ungültige Aktivitäts-ID.' }, { status: 400 })
  }

  const polyline = await ladeActivityPolyline(sb, id)
  return NextResponse.json({ polyline })
}
