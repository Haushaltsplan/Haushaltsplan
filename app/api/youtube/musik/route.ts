/**
 * GET — Katalog der Moat-Short-Musik. Lokal werden fehlende Dateien nachgeladen.
 * Extra-MP3s in public/youtube-music/ erscheinen als eigener Track.
 */
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { NextResponse } from 'next/server'
import { MOAT_SHORT_KATALOG_PFADE } from '@/lib/youtube/moat-short-musik'
import { istMusikDateiname, MUSIK_ORDNER, stelleTracksSicher } from '@/lib/youtube/moat-short-musik-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

export async function GET() {
  try {
    await stelleTracksSicher()
  } catch {
    /* Vercel oder Netz — Katalog gilt trotzdem, Stream-Route holt remote. */
  }
  let extra: string[] = []
  try {
    extra = (await fs.readdir(path.join(process.cwd(), 'public', MUSIK_ORDNER)))
      .filter(istMusikDateiname)
      .map((d) => `${MUSIK_ORDNER}/${d}`)
  } catch {
    extra = []
  }
  return NextResponse.json({ ok: true, tracks: [...new Set([...MOAT_SHORT_KATALOG_PFADE, ...extra])] })
}
