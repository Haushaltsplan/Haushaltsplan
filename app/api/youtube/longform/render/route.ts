/**
 * Nur lokal. GET = Musik-Katalog für die Vorschau.
 * POST { id } = Props serverseitig bauen (frische signierte URLs) und Render starten.
 * Status und Download laufen über /api/youtube/render?datei=…
 */
import { NextResponse } from 'next/server'
import { jsonMitOwner } from '@/lib/request-owner'
import { starteAktienAnalyseRender } from '@/lib/youtube/moat-short-render-server'
import { ladeProjekt, mitUrls } from '@/lib/youtube/longform/longform-db-server'
import { ladeMusikKatalog } from '@/lib/youtube/longform/longform-musik-server'
import { baueAnalyseProps, bildCredits } from '@/lib/youtube/longform/longform-props'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(req: Request) {
  const out = await jsonMitOwner(req, async () => ({ ok: true as const, katalog: await ladeMusikKatalog() }))
  if (out instanceof NextResponse) return out
  return NextResponse.json(out)
}

export async function POST(req: Request) {
  const env = process.env.VERCEL_ENV
  if (env === 'production' || env === 'preview') {
    return NextResponse.json(
      { ok: false, fehler: 'MP4-Export geht nur lokal: „npm run dev“ und http://localhost:3000/youtube?modus=analyse öffnen.' },
      { status: 501 },
    )
  }
  const out = await jsonMitOwner(req, async () => {
    let body: { id?: unknown }
    try {
      body = (await req.json()) as typeof body
    } catch {
      return { ok: false as const, fehler: 'Kein gültiges JSON.' }
    }
    const p = typeof body.id === 'string' ? await ladeProjekt(body.id) : null
    if (!p) return { ok: false as const, fehler: 'Projekt nicht gefunden.' }
    const zustand = await mitUrls(p.zustand)
    const props = baueAnalyseProps(zustand, await ladeMusikKatalog(), { sfx: false })
    if (!props) return { ok: false as const, fehler: 'Noch kein Skript.' }
    const ohneStimme = props.saetze.filter((s) => !s.audioUrl).length
    if (ohneStimme) return { ok: false as const, fehler: `${ohneStimme} Sätze haben noch keine Stimme.` }
    const { dateiname } = await starteAktienAnalyseRender(props)
    return { ok: true as const, dateiname, credits: bildCredits(zustand) }
  })
  if (out instanceof NextResponse) return out
  return NextResponse.json(out, { status: out.ok ? 200 : 400 })
}
