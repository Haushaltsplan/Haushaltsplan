import { existsSync } from 'node:fs'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { MOAT_SHORT_MUSIK_QUELLEN } from '@/lib/youtube/moat-short-musik'

export const MUSIK_ORDNER = 'youtube-music'

const DATEINAME = /^[a-z0-9][a-z0-9._-]*\.(mp3|m4a|wav|ogg)$/i

export function istMusikDateiname(name: string): boolean {
  return DATEINAME.test(name)
}

function ordner(): string {
  return path.join(process.cwd(), 'public', MUSIK_ORDNER)
}

async function fehltNoch(datei: string): Promise<boolean> {
  try {
    return (await fs.stat(datei)).size < 80_000
  } catch {
    return true
  }
}

export async function stelleTracksSicher(): Promise<void> {
  if (process.env.VERCEL) return
  const zielOrdner = ordner()
  await fs.mkdir(zielOrdner, { recursive: true })
  for (const quelle of MOAT_SHORT_MUSIK_QUELLEN) {
    if (!/\.mp3(\?|$)/i.test(quelle.url)) continue
    const ziel = path.join(zielOrdner, quelle.datei)
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

export async function ladeMusikdatei(dateiname: string): Promise<{ bytes: Buffer; typ: string } | null> {
  if (!istMusikDateiname(dateiname)) return null
  const lokal = path.join(ordner(), dateiname)
  if (existsSync(lokal)) {
    const bytes = await fs.readFile(lokal)
    if (bytes.length >= 80_000) return { bytes, typ: 'audio/mpeg' }
  }
  const quelle = MOAT_SHORT_MUSIK_QUELLEN.find((t) => t.datei === dateiname && /\.mp3(\?|$)/i.test(t.url))
  if (!quelle) return null
  const res = await fetch(quelle.url, { redirect: 'follow' })
  if (!res.ok) return null
  const bytes = Buffer.from(await res.arrayBuffer())
  if (bytes.length < 80_000) return null
  if (!process.env.VERCEL) {
    await fs.mkdir(ordner(), { recursive: true })
    await fs.writeFile(lokal, bytes)
  }
  return { bytes, typ: res.headers.get('content-type') || 'audio/mpeg' }
}
