/**
 * GET — Katalog der Moat-Short-Musik. Lokal werden fehlende Dateien nachgeladen.
 */
import { NextResponse } from 'next/server'
import { MOAT_SHORT_KATALOG_PFADE } from '@/lib/youtube/moat-short-musik'
import { stelleTracksSicher } from '@/lib/youtube/moat-short-musik-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

export async function GET() {
  try {
    await stelleTracksSicher()
  } catch {
    /* Vercel oder Netz — Katalog gilt trotzdem, Stream-Route holt remote. */
  }
  return NextResponse.json({ ok: true, tracks: MOAT_SHORT_KATALOG_PFADE })
}
