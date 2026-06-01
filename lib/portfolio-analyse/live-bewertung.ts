import { cashSaldoAusBuchungen, positionenFuerBewertung } from '@/lib/portfolio-analyse/bestand'
import { teileArray } from '@/lib/portfolio-analyse/batch-hilfen'
import { anzeigeNameFuerIsin, wknFuerIsin } from '@/lib/portfolio-analyse/isin-metadata-client'
import type { IsinMetadata } from '@/lib/portfolio-analyse/isin-lookup-server'
import {
  FX_SYMBOLE,
  fxKurseAusYahooMap,
  kandidatenMitDeFallback,
  type FxKurse,
  waehleBesterKurs,
} from '@/lib/portfolio-analyse/kurs-aufloesung'
import type { YahooKursZeile } from '@/lib/portfolio-analyse/yahoo-kurse-server'
import type {
  PortfolioAnalyseKennzahlen,
  PortfolioBuchung,
  PortfolioDbSnapshot,
  PortfolioPositionSnapshot,
} from '@/lib/portfolio-analyse/types'

export type LivePosition = PortfolioPositionSnapshot & {
  symbolYahoo: string | null
  kursLiveEur: number | null
  wertLiveEur: number
  einstandEur: number
  gewinnVerlustEur: number
  gewinnVerlustProzent: number | null
  aenderungTagProzent: number | null
  gewichtProzent: number
  anzeigeName: string
  wkn: string | null
  hatLiveKurs: boolean
}

const KURSE_BATCH = 80

export type LivePortfolio = {
  positionen: LivePosition[]
  kennzahlen: PortfolioAnalyseKennzahlen & {
    wertpapiereEur: number
    cashEur: number
    einstandOffenEur: number
    kurseQuelle: 'live' | 'einstand' | 'snapshot'
    kurseStand: string | null
  }
  verlauf: { label: string; wert: number }[]
}

/** Symbole für Yahoo-Abfrage (pro Position begrenzt, um API-Limits nicht zu sprengen). */
export function symboleAusMeta(
  positionen: PortfolioPositionSnapshot[],
  meta: Map<string, IsinMetadata>,
): string[] {
  const set = new Set<string>()
  for (const p of positionen) {
    const isin = p.isin?.toUpperCase()
    if (!isin) continue
    const m = meta.get(isin)
    const basis =
      m?.symbolCandidates?.length ? m.symbolCandidates.slice(0, 6) : m?.symbolYahoo ? [m.symbolYahoo] : []
    for (const sym of kandidatenMitDeFallback(basis)) set.add(sym)
  }
  return [...set]
}

export async function ladeLiveKurseClient(symbols: string[]): Promise<{
  kurse: Map<string, YahooKursZeile>
  stand: string | null
  fx: FxKurse
}> {
  if (symbols.length === 0) {
    return { kurse: new Map(), stand: null, fx: fxKurseAusYahooMap(new Map()) }
  }
  const symbole = [...new Set([...symbols, ...FX_SYMBOLE])]
  const map = new Map<string, YahooKursZeile>()
  let stand: string | null = null

  for (const batch of teileArray(symbole, KURSE_BATCH)) {
    const res = await fetch('/api/portfolio-analyse/kurse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbols: batch }),
    })
    const j = (await res.json()) as {
      ok?: boolean
      kurse?: Record<string, YahooKursZeile>
      stand?: string
    }
    if (!j.ok || !j.kurse) continue
    stand = j.stand ?? stand
    for (const [sym, row] of Object.entries(j.kurse)) {
      map.set(sym.toUpperCase(), row)
    }
  }

  return { kurse: map, stand, fx: fxKurseAusYahooMap(map) }
}

function usBasisTickerAusKandidaten(kandidaten: string[]): string | null {
  return kandidaten.find((s) => !s.includes('.') && s.length <= 6)?.split('.')[0].toUpperCase() ?? null
}

export function berechneLivePortfolio(
  buchungen: PortfolioBuchung[],
  snapshot: PortfolioDbSnapshot | null,
  meta: Map<string, IsinMetadata>,
  yahooKurse: Map<string, YahooKursZeile>,
  kurseStand: string | null,
  fx: FxKurse = fxKurseAusYahooMap(new Map()),
): LivePortfolio {
  const basis = positionenFuerBewertung(buchungen, snapshot)
  let dividendenEur = 0
  let zinsenEur = 0
  let einzahlungenEur = 0
  let auszahlungenEur = 0

  for (const b of buchungen) {
    if (b.typ === 'dividende') dividendenEur += b.betragEur
    if (b.typ === 'zins') zinsenEur += b.betragEur
    if (b.typ === 'einzahlung') einzahlungenEur += b.betragEur
    if (b.typ === 'auszahlung') auszahlungenEur += b.betragEur
  }

  const cashEur = cashSaldoAusBuchungen(buchungen)
  let wertpapiereEur = 0
  let einstandOffenEur = 0
  let liveCount = 0

  const positionen: LivePosition[] = basis.map((p) => {
    const isin = p.isin?.toUpperCase() ?? ''
    const m = isin ? meta.get(isin) : undefined
    const kandidaten = m
      ? kandidatenMitDeFallback(
          m.symbolCandidates?.length ? m.symbolCandidates : m.symbolYahoo ? [m.symbolYahoo] : [],
        )
      : []
    const einstandEur = p.wertEur
    einstandOffenEur += einstandEur
    const einstandKurs = p.stueck > 0 ? einstandEur / p.stueck : (p.kursEur ?? 0)

    const kursWahl = waehleBesterKurs(kandidaten, yahooKurse, einstandKurs, p.kursEur ?? null, {
      isin,
      fx,
      usBasisTicker: isin.startsWith('US') ? usBasisTickerAusKandidaten(kandidaten) : null,
    })
    const sym = kursWahl?.symbol ?? m?.symbolYahoo ?? null
    const kursZeile = kursWahl?.zeile ?? null
    let kursLive = kursWahl?.kurs ?? null
    if (kursLive == null && p.kursEur != null && p.kursEur > 0) kursLive = p.kursEur
    if (kursWahl != null) liveCount++

    let wertLive = kursLive != null ? Math.round(p.stueck * kursLive * 100) / 100 : einstandEur
    if (einstandEur > 0 && wertLive / einstandEur > 8) {
      wertLive = einstandEur
      kursLive = p.stueck > 0 ? Math.round((einstandEur / p.stueck) * 10000) / 10000 : kursLive
    }
    wertpapiereEur += wertLive

    const gv = Math.round((wertLive - einstandEur) * 100) / 100
    const gvPct = einstandEur > 0 ? Math.round((gv / einstandEur) * 10000) / 100 : null

    const hatLiveKurs = kursWahl != null

    return {
      ...p,
      name: anzeigeNameFuerIsin(isin, p.name, meta),
      anzeigeName: anzeigeNameFuerIsin(isin, p.name, meta),
      wkn: wknFuerIsin(isin, meta),
      symbolYahoo: sym,
      kursLiveEur: kursLive,
      wertLiveEur: wertLive,
      einstandEur,
      gewinnVerlustEur: gv,
      gewinnVerlustProzent: gvPct,
      aenderungTagProzent: kursZeile?.aenderungTagProzent ?? null,
      gewichtProzent: 0,
      hatLiveKurs,
    }
  })

  wertpapiereEur = Math.round(wertpapiereEur * 100) / 100
  einstandOffenEur = Math.round(einstandOffenEur * 100) / 100
  const depotwertEur = Math.round((wertpapiereEur + Math.max(0, cashEur)) * 100) / 100

  for (const p of positionen) {
    p.gewichtProzent = depotwertEur > 0 ? Math.round((p.wertLiveEur / depotwertEur) * 10000) / 100 : 0
  }
  positionen.sort((a, b) => b.wertLiveEur - a.wertLiveEur)

  const nettoEingezahlt = Math.round((einzahlungenEur - auszahlungenEur) * 100) / 100
  const gewinnVerlustEur = Math.round((depotwertEur - nettoEingezahlt) * 100) / 100
  const gewinnVerlustProzent =
    nettoEingezahlt > 0 ? Math.round((gewinnVerlustEur / nettoEingezahlt) * 10000) / 100 : null

  const kurseQuelle: LivePortfolio['kennzahlen']['kurseQuelle'] =
    liveCount > 0 ? 'live' : snapshot?.depotwert_eur != null ? 'snapshot' : 'einstand'

  const verlauf = verlaufAusBuchungen(buchungen, depotwertEur)

  return {
    positionen,
    kennzahlen: {
      depotwertEur,
      investiertEur: einstandOffenEur,
      gewinnVerlustEur,
      gewinnVerlustProzent,
      dividendenEur: Math.round(dividendenEur * 100) / 100,
      zinsenEur: Math.round(zinsenEur * 100) / 100,
      einzahlungenEur: Math.round(einzahlungenEur * 100) / 100,
      auszahlungenEur: Math.round(auszahlungenEur * 100) / 100,
      anzahlPositionen: positionen.length,
      anzahlBuchungen: buchungen.length,
      wertpapiereEur,
      cashEur: Math.max(0, cashEur),
      einstandOffenEur,
      kurseQuelle,
      kurseStand,
    },
    verlauf,
  }
}

function verlaufAusBuchungen(buchungen: PortfolioBuchung[], depotwertHeute: number): { label: string; wert: number }[] {
  const sortiert = [...buchungen].sort((a, b) => a.datum.localeCompare(b.datum))
  if (sortiert.length === 0) return []

  const punkte = new Map<string, number>()
  let cash = 0
  let wpKosten = 0

  for (const b of sortiert) {
    switch (b.typ) {
      case 'einzahlung':
        cash += b.betragEur
        break
      case 'auszahlung':
        cash -= b.betragEur
        break
      case 'kauf':
        cash -= b.betragEur
        wpKosten += b.betragEur
        break
      case 'verkauf':
        cash += b.betragEur
        wpKosten = Math.max(0, wpKosten - b.betragEur)
        break
      case 'dividende':
      case 'zins':
        cash += b.betragEur
        break
      case 'steuer':
      case 'gebuehr':
        cash -= b.betragEur
        break
      default:
        break
    }
    const k = b.datum.slice(0, 7)
    punkte.set(k, Math.round((Math.max(0, cash) + wpKosten) * 100) / 100)
  }

  const keys = [...punkte.keys()].sort()
  if (keys.length === 0) return []
  const out = keys.map((k) => {
    const [y, mo] = k.split('-')
    const d = new Date(Number(y), Number(mo) - 1, 1)
    return { label: d.toLocaleDateString('de-DE', { month: 'short', year: '2-digit' }), wert: punkte.get(k)! }
  })
  const last = out[out.length - 1]
  if (last) last.wert = depotwertHeute
  return out
}
