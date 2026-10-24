/**
 * GET — Katalog-Tracks nach public/youtube-music/ holen (lokal, nicht auf Vercel).
 */
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { NextResponse } from 'next/server'
import { MOAT_SHORT_MUSIK_QUELLEN } from '@/lib/youtube/moat-short-musik'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

const MUSIK_ORDNER = 'youtube-music'

async function fehltNoch(datei: string): Promise<boolean> {
  try {
    const st = await fs.stat(datei)
    return st.size < 80_000
  } catch {
    return true
  }
}

async function stelleTracksSicher(ordner: string): Promise<void> {
  await fs.mkdir(ordner, { recursive: true })
  for (const quelle of MOAT_SHORT_MUSIK_QUELLEN) {
    const ziel = path.join(ordner, quelle.datei)
    if (!(await fehltNoch(ziel))) continue
    const res = await fetch(quelle.url, { redirect: 'follow' })
    if (!res.ok) throw new Error(`${quelle.titel}: HTTP ${res.status}`)
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.length < 80_000) throw new Error(`${quelle.titel}: Datei zu klein (${buf.length} Bytes)`)
    const tmp = `${ziel}.part`
    await fs.writeFile(tmp, buf)
    await fs.rename(tmp, ziel)
  }
}

export async function GET() {
  const ordner = path.join(process.cwd(), 'public', MUSIK_ORDNER)
  try {
    if (!process.env.VERCEL) await stelleTracksSicher(ordner)
    const dateien = await fs.readdir(ordner)
    const tracks = dateien.filter((d) => /\.(mp3|m4a|wav|ogg)$/i.test(d)).sort((a, b) => a.localeCompare(b))
    return NextResponse.json({ ok: true, tracks: tracks.map((d) => `${MUSIK_ORDNER}/${d}`) })
  } catch (e) {
    return NextResponse.json({ ok: false, tracks: [], fehler: e instanceof Error ? e.message : 'Musikordner fehlt' }, { status: 500 })
  }
}
