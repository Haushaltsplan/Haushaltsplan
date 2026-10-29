/**
 * GET — Musik, die wirklich in public/youtube-music liegt.
 * Ein Katalogname ohne Datei wird nicht angeboten, sonst spielt der Player Stille.
 */
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { NextResponse } from 'next/server'
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
  const tracks: string[] = []
  try {
    const ordner = path.join(process.cwd(), 'public', MUSIK_ORDNER)
    for (const name of await fs.readdir(ordner)) {
      if (!istMusikDateiname(name)) continue
      const stat = await fs.stat(path.join(ordner, name))
      if (stat.size >= 80_000) tracks.push(`${MUSIK_ORDNER}/${name}`)
    }
  } catch {
    /* Ordner fehlt — ohne Datei bleibt die Spur stumm. */
  }
  return NextResponse.json(
    { ok: true, tracks },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
