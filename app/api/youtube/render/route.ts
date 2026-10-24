/**
 * Nur lokal: POST { props } rendert das Short per Remotion-CLI nach out/youtube/ und liefert die MP4.
 * Auf Vercel gibt es keinen Browser/FFmpeg für Remotion — dort 501.
 */
import { spawn } from 'node:child_process'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { NextResponse } from 'next/server'
import { jsonMitOwner } from '@/lib/request-owner'
import type { MoatShortProps } from '@/remotion/moat-short-types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const RENDER_PORT = 3939

function remotionRender(propsDatei: string, ziel: string): Promise<{ ok: true } | { ok: false; log: string }> {
  return new Promise((resolve) => {
    const kind = spawn(
      'npx',
      [
        'remotion',
        'render',
        'remotion/index.ts',
        'MoatShort',
        `"${ziel}"`,
        `--props="${propsDatei}"`,
        // Remotion wählt sonst ggf. Port 3000 und landet beim laufenden Next-Dev-Server.
        `--port=${RENDER_PORT}`,
        '--log=error',
      ],
      { cwd: process.cwd(), shell: true, windowsHide: true },
    )
    let log = ''
    kind.stdout.on('data', (d) => (log = (log + String(d)).slice(-4000)))
    kind.stderr.on('data', (d) => (log = (log + String(d)).slice(-4000)))
    kind.on('error', (e) => resolve({ ok: false, log: e.message }))
    kind.on('close', (code) => resolve(code === 0 ? { ok: true } : { ok: false, log }))
  })
}

export async function POST(req: Request) {
  if (process.env.VERCEL) {
    return NextResponse.json({ ok: false, fehler: 'MP4-Export läuft nur lokal (npm run dev).' }, { status: 501 })
  }

  const out = await jsonMitOwner(req, async () => {
    let props: MoatShortProps
    try {
      props = ((await req.json()) as { props: MoatShortProps }).props
    } catch {
      return NextResponse.json({ ok: false, fehler: 'Kein gültiges JSON.' }, { status: 400 })
    }
    if (!props?.ticker || !Array.isArray(props.pillars)) {
      return NextResponse.json({ ok: false, fehler: 'Short-Daten fehlen.' }, { status: 400 })
    }

    const ticker = props.ticker.replace(/[^A-Z0-9]/gi, '').toUpperCase() || 'SHORT'
    const stempel = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '')
    const dateiname = `${ticker}-${stempel}.mp4`
    const ziel = path.join(process.cwd(), 'out', 'youtube', dateiname)
    const propsDatei = path.join(os.tmpdir(), `moat-short-${ticker}-${stempel}.json`)

    await fs.mkdir(path.dirname(ziel), { recursive: true })
    await fs.writeFile(propsDatei, JSON.stringify(props), 'utf8')
    try {
      const r = await remotionRender(propsDatei, ziel)
      if (!r.ok) {
        return NextResponse.json({ ok: false, fehler: `Render fehlgeschlagen: ${r.log.trim().slice(-600)}` }, { status: 500 })
      }
      const mp4 = await fs.readFile(ziel)
      return new NextResponse(new Uint8Array(mp4), {
        headers: {
          'Content-Type': 'video/mp4',
          'Content-Disposition': `attachment; filename="${dateiname}"`,
        },
      })
    } finally {
      await fs.rm(propsDatei, { force: true })
    }
  })
  return out instanceof NextResponse ? out : NextResponse.json(out)
}
