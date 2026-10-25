/**
 * Cache-first Quellen für Earnings Check. Kein Force-Scrape, kein Billing-Gemini.
 */
import 'server-only'

import { formatEpsUsd, formatKompaktUsd } from '@/lib/portfolio-analyse/earnings-quartals-prognose'
import {
  ladeEarningsBeatMissHistorie,
  type BeatMissMetrik,
  type BeatMissQuartal,
} from '@/lib/portfolio-analyse/earnings-beat-miss-historie-server'
import { ladeFundamentalExportAnreicherung } from '@/lib/portfolio-analyse/fundamentaldaten-export-anreichern-server'
import type { EarningsShortLuecke } from '@/lib/youtube/earnings-short-types'
import type { EarningsShortBeatArt, EarningsShortKarte } from '@/remotion/earnings-short-types'

export type EarningsShortQuellen = {
  ticker: string
  firmenname: string
  quartalLabel: string
  beat: EarningsShortBeatArt
  metricValue: string
  metricLabel: string
  eps: EarningsShortKarte
  umsatz: EarningsShortKarte
  callZusammenfassung: string
  callLabel: string
  transcriptAuszug: string | null
  berichtZusammenfassung: string | null
  berichtLabel: string | null
}

function tickerNorm(t: string): string {
  return t.trim().toUpperCase().split('.')[0] ?? ''
}

function surpriseWert(m: BeatMissMetrik): string {
  if (m.surprisePct != null && Number.isFinite(m.surprisePct)) {
    const v = m.surprisePct
    return `${v > 0 ? '+' : ''}${v.toFixed(1)}%`
  }
  const a = m.anzeige?.match(/([+-]?\d+(?:\.\d+)?%)/)
  return a?.[1] ?? '—'
}

function klassifiziere(m: BeatMissMetrik): EarningsShortBeatArt {
  const p = m.surprisePct
  if (p == null || !Number.isFinite(p)) {
    const a = (m.anzeige ?? '').toLowerCase()
    if (a.includes('miss')) return 'miss'
    if (a.includes('inline')) return 'inline'
    if (a.includes('beat')) return 'beat'
    return 'inline'
  }
  if (p > 1) return 'beat'
  if (p < -1) return 'miss'
  return 'inline'
}

function karte(label: string, m: BeatMissMetrik, fmt: (n: number) => string): EarningsShortKarte {
  return {
    label,
    ist: m.ist != null ? fmt(m.ist) : '—',
    schaetzung: m.schaetzung != null ? fmt(m.schaetzung) : '—',
    anzeige: m.anzeige ?? '—',
  }
}

function hatIst(q: BeatMissQuartal): boolean {
  return q.eps.ist != null || q.umsatz.ist != null
}

export async function ladeEarningsShortQuellen(opts: {
  ticker: string
  firmenname?: string | null
}): Promise<{ ok: true; quellen: EarningsShortQuellen } | { ok: false; luecken: EarningsShortLuecke[] }> {
  const ticker = tickerNorm(opts.ticker)
  if (ticker.length < 1) {
    return { ok: false, luecken: [{ art: 'beatMiss', hinweis: 'Ticker fehlt.' }] }
  }

  const [beatMiss, anreichern] = await Promise.all([
    ladeEarningsBeatMissHistorie({ ticker, limit: 4 }),
    ladeFundamentalExportAnreicherung({ ticker }),
  ])

  const luecken: EarningsShortLuecke[] = []
  const quartal = beatMiss.ok ? beatMiss.quartale.find(hatIst) ?? beatMiss.quartale[0] : null
  if (!beatMiss.ok || !quartal || !hatIst(quartal)) {
    luecken.push({
      art: 'beatMiss',
      hinweis: 'Beat/Miss für das letzte Quartal fehlt. Öffne den Titel in Fundamentaldaten → Quartalszahlen, dann hier erneut.',
    })
  }

  const calls = anreichern.earningsCalls?.quartale.filter((q) => q.zusammenfassung?.trim()) ?? []
  const call = calls[0] ?? null
  if (!call?.zusammenfassung?.trim()) {
    luecken.push({
      art: 'call',
      hinweis: 'Earnings-Call-KI fehlt. Öffne Fundamentaldaten → Quartalszahlen → Earnings Call, dann hier erneut.',
    })
  }
  if (luecken.length) return { ok: false, luecken }

  const anker = quartal!.eps.ist != null ? quartal!.eps : quartal!.umsatz
  const berichte =
    anreichern.secBerichte?.berichte.filter((b) => b.zusammenfassung?.trim()).sort((a, b) => (b.filingDatum ?? '').localeCompare(a.filingDatum ?? '')) ?? []
  const bericht = berichte[0] ?? null

  return {
    ok: true,
    quellen: {
      ticker,
      firmenname: opts.firmenname?.trim() || ticker,
      quartalLabel: quartal!.quartalLabel || call!.label,
      beat: klassifiziere(anker),
      metricValue: surpriseWert(anker),
      metricLabel: quartal!.eps.ist != null ? 'EPS surprise' : 'Revenue surprise',
      eps: karte('EPS', quartal!.eps, formatEpsUsd),
      umsatz: karte('Revenue', quartal!.umsatz, formatKompaktUsd),
      callZusammenfassung: call!.zusammenfassung!.trim(),
      callLabel: call!.label,
      transcriptAuszug: call!.transcriptText ? call!.transcriptText.slice(0, 2500) : null,
      berichtZusammenfassung: bericht?.zusammenfassung?.trim() || null,
      berichtLabel: bericht?.label ?? bericht?.formular ?? null,
    },
  }
}
