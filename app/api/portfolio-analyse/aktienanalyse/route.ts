import { NextResponse } from 'next/server'
import {
  generiereAktienanalyseBericht,
  ladeAktienanalyseEintraege,
  speichereAktienanalyseEintrag,
} from '@/lib/portfolio-analyse/aktienanalyse-server'
import { jsonMitOwner } from '@/lib/request-owner'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function GET(req: Request) {
  const out = await jsonMitOwner(req, async () => {
    const url = new URL(req.url)
    const ticker = (url.searchParams.get('ticker') || '').trim().toUpperCase()
    if (!ticker) return { ok: false, message: 'ticker fehlt' }
    const eintraege = await ladeAktienanalyseEintraege(ticker)
    return { ok: true, eintraege }
  })
  if (out instanceof NextResponse) return out
  return NextResponse.json(out)
}

export async function POST(req: Request) {
  const out = await jsonMitOwner(req, async () => {
    let body: Record<string, unknown>
    try {
      body = (await req.json()) as Record<string, unknown>
    } catch {
      return { ok: false, message: 'Kein gültiges JSON.' }
    }

    const ticker = String(body.ticker ?? '').trim().toUpperCase()
    if (!ticker) return { ok: false, message: 'ticker fehlt' }

    const prompt = String(body.prompt ?? '').trim()
    if (prompt.length < 20) return { ok: false, message: 'Prompt zu kurz.' }

    const exportPayload = body.exportPayload
    if (!exportPayload || typeof exportPayload !== 'object') {
      return { ok: false, message: 'exportPayload fehlt.' }
    }

    try {
      const bericht = await generiereAktienanalyseBericht({
        ticker,
        prompt,
        exportPayload,
      })
      const eintrag = await speichereAktienanalyseEintrag({
        ticker,
        titel: bericht.titel,
        promptSnapshot: prompt,
        bericht,
      })
      return { ok: true, eintrag }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Analyse fehlgeschlagen'
      console.error('[aktienanalyse]', msg)
      return { ok: false, message: msg }
    }
  })
  if (out instanceof NextResponse) return out
  return NextResponse.json(out)
}
