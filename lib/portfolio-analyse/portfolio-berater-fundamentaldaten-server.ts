/** Fundamentaldaten-Kompakt für den Portfolio-Berater (serverseitig wie Fundamentaldaten-Seite). */

import 'server-only'

import { ladeFundamentaldaten } from '@/lib/portfolio-analyse/fundamentaldaten-server'
import type { FundamentaldatenPaket } from '@/lib/portfolio-analyse/fundamentaldaten-types'

const MAX_LADEN = 7
const ZEILEN_HIGHLIGHT = [
  'revenue',
  'gross_margin',
  'operating_margin',
  'net_margin',
  'fcf',
  'fcf_per_share',
  'eps_diluted',
  'pe_ratio',
  'ev_ebitda',
  'ev_fcf',
  'roic',
  'roe',
  'debt_equity',
  'interest_coverage',
  'dividend_yield',
  'revenue_growth',
  'eps_growth',
]

export type FundamentalBeraterZiel = {
  isin: string
  name: string
  symbolYahoo: string | null
  symbolCandidates?: string[]
  fokus: boolean
  gewichtPct?: number | null
}

function kuerze(text: string | null | undefined, max: number): string | null {
  if (!text?.trim()) return null
  const t = text.trim()
  if (t.length <= max) return t
  return t.slice(0, max - 1).trimEnd() + '…'
}

function zeilenHighlights(p: FundamentaldatenPaket, fokus: boolean) {
  const perioden = p.perioden
    .filter((pe) => !pe.istNtm && !pe.istSchaetzung)
    .slice(0, fokus ? 5 : 3)
    .map((pe) => pe.iso)

  return p.zeilen
    .filter((z) => ZEILEN_HIGHLIGHT.includes(z.id))
    .map((z) => ({
      id: z.id,
      label: z.label,
      werte: Object.fromEntries(
        perioden.map((iso) => [iso, z.werte[iso] ?? null]),
      ),
    }))
}

function erweitertKompakt(p: FundamentaldatenPaket, fokus: boolean) {
  const e = p.erweitert
  if (!e) return null
  return {
    beatMiss: e.beatMiss
      ? {
          epsBeatRatePct: e.beatMiss.epsBeatRatePct,
          epsBeatRate12Pct: e.beatMiss.agg12?.epsBeatRatePct ?? null,
          streak: e.beatMiss.streak?.eps ?? null,
        }
      : null,
    dividenden: e.dividenden
      ? {
          cagr5yPct: e.dividenden.cagr5yPct,
          jahreOhneSenkung: e.dividenden.jahreOhneSenkung,
        }
      : null,
    insiderNetto: e.insiderNetto?.nettoRichtung ?? null,
    secStruktur: e.secStruktur
      ? {
          segmentKonzentration: e.secStruktur.segmente?.[0]?.anteilPct ?? null,
          pensionMio: e.secStruktur.pensionVerpflichtungMio,
        }
      : null,
  }
}

export function fundamentalPaketKompakt(p: FundamentaldatenPaket, fokus: boolean) {
  const m = p.mantra
  return {
    ok: p.ok,
    ticker: p.ticker,
    firmenname: p.firmenname,
    sektor: p.sektor,
    branche: p.branche,
    quelle: p.quelle,
    fehler: p.fehler ?? null,
    beschreibung: kuerze(p.beschreibung, fokus ? 500 : 220),
    keyMetrics: p.keyMetrics.slice(0, fokus ? 22 : 14).map((k) => ({
      label: k.label,
      wert: k.wert,
      gruppe: k.gruppe,
    })),
    mantra: {
      ampel: m.ampel,
      ampelScorePct: m.ampelScorePct,
      ampelHinweis: m.ampelHinweis,
      zusammenfassung: m.zusammenfassung,
      standard: m.standard.map((z) => ({
        kategorie: z.kategorie,
        kennzahl: z.kennzahl,
        zielwert: z.zielwert,
        istWert: z.istWert,
        status: z.status,
      })),
      sektor: m.sektor.slice(0, fokus ? 16 : 8).map((z) => ({
        kategorie: z.kategorie,
        kennzahl: z.kennzahl,
        istWert: z.istWert,
        status: z.status,
      })),
      sellTriggerWatch: m.sellTriggerWatch.map((s) => ({
        titel: s.titel,
        status: s.status,
        begruendung: kuerze(s.begruendung, fokus ? 200 : 100),
      })),
    },
    zeilenHighlights: zeilenHighlights(p, fokus),
    erweitert: erweitertKompakt(p, fokus),
    news: fokus
      ? p.news.slice(0, 3).map((n) => ({ titel: n.titel, quelle: n.quelle }))
      : [],
  }
}

export async function ladeFundamentaldatenFuerBerater(
  ziele: FundamentalBeraterZiel[],
): Promise<
  Array<{
    isin: string
    fokus: boolean
    gewichtPct: number | null
    daten: ReturnType<typeof fundamentalPaketKompakt>
  }>
> {
  if (ziele.length === 0) return []

  const sortiert = [...ziele]
    .sort((a, b) => {
      if (a.fokus !== b.fokus) return a.fokus ? -1 : 1
      return (b.gewichtPct ?? 0) - (a.gewichtPct ?? 0)
    })
    .slice(0, MAX_LADEN)

  const ergebnisse = await Promise.allSettled(
    sortiert.map(async (z) => {
      const paket = await ladeFundamentaldaten({
        isin: z.isin,
        name: z.name,
        symbolYahoo: z.symbolYahoo,
        symbolCandidates: z.symbolCandidates,
        frequenz: 'jahr',
        segmentNurCloud: true,
      })
      return {
        isin: z.isin,
        fokus: z.fokus,
        gewichtPct: z.gewichtPct ?? null,
        daten: fundamentalPaketKompakt(paket, z.fokus),
      }
    }),
  )

  const out: Array<{
    isin: string
    fokus: boolean
    gewichtPct: number | null
    daten: ReturnType<typeof fundamentalPaketKompakt>
  }> = []

  for (const r of ergebnisse) {
    if (r.status === 'fulfilled') out.push(r.value)
    else console.warn('[portfolio-berater] Fundamentaldaten laden:', r.reason)
  }

  return out
}
