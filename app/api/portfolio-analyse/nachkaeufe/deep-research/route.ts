import { NextResponse } from 'next/server'
import { fuhreDeepResearchDurch } from '@/lib/portfolio-analyse/nachkauf-radar/nachkauf-radar-deep-research-server'
import { ladeNachkaufScanAusCloud } from '@/lib/portfolio-analyse/nachkauf-radar/nachkauf-radar-db-server'
import { ergaenzeScoreVerlauf } from '@/lib/portfolio-analyse/nachkauf-radar/nachkauf-radar-verlauf-server'
import { NACHKAUF_RADAR_WHITELIST } from '@/lib/portfolio-analyse/nachkauf-radar/nachkauf-radar-whitelist'
import type { NachkaufDeepResearchAnfrage } from '@/lib/portfolio-analyse/nachkauf-radar/nachkauf-radar-types'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function POST(req: Request) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, fehler: 'Kein gültiges JSON.' }, { status: 400 })
  }

  const row = (body ?? {}) as Record<string, unknown>
  const ticker = row.ticker != null ? String(row.ticker).trim() : ''
  if (!ticker) {
    return NextResponse.json({ ok: false, fehler: 'ticker fehlt.' }, { status: 400 })
  }

  const anfrage: NachkaufDeepResearchAnfrage = {
    ticker,
    isin: row.isin != null ? String(row.isin).trim() || null : null,
    name: row.name != null ? String(row.name).trim() || null : null,
  }

  // Aktuellen Scan-Eintrag als Kontext für das LLM laden
  let scanKontext: Parameters<typeof fuhreDeepResearchDurch>[0]['scanEintrag'] | undefined
  let historischerMedianPe: number | null | undefined

  try {
    const alleEintraege = await ladeNachkaufScanAusCloud()
    const eintrag = alleEintraege.find(
      (e) => e.ticker.toUpperCase() === ticker.toUpperCase() || e.isin === (anfrage.isin ?? ''),
    )
    if (eintrag) {
      await ergaenzeScoreVerlauf([eintrag])
      scanKontext = {
        score: eintrag.score,
        ampel: eintrag.ampel,
        kaufTriggerAusgeloest: eintrag.kaufTriggerAusgeloest,
        kaufTriggerText: eintrag.kaufTriggerText,
        premiumDiscountPct: eintrag.bewertung.premiumDiscountPct,
        scoreVerlauf: eintrag.scoreVerlauf,
      }
    }
    const wl = NACHKAUF_RADAR_WHITELIST.find(
      (p) => p.isin === (anfrage.isin ?? '') || p.name.toLowerCase().includes(ticker.toLowerCase()),
    )
    historischerMedianPe = wl?.historischerMedianPe ?? null
  } catch {
    // Kontext ist optional — Fehler hier darf Deep Research nicht blockieren
  }

  try {
    const result = await fuhreDeepResearchDurch({ ...anfrage, scanEintrag: scanKontext, historischerMedianPe })
    if (!result.ok) {
      return NextResponse.json({ ok: false, fehler: result.fehler }, { status: 502 })
    }
    return NextResponse.json({ ok: true, dr: result.dr })
  } catch (e) {
    console.error('[api/nachkaeufe/deep-research]', e)
    return NextResponse.json({ ok: false, fehler: 'Deep Research fehlgeschlagen.' }, { status: 502 })
  }
}
