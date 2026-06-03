import { baueMonatsVerlauf } from '@/lib/portfolio-analyse/depot-berechnung'
import {
  cashSaldoAusBuchungen,
  depotStandBisDatum,
  positionenFuerBewertung,
} from '@/lib/portfolio-analyse/bestand'
import { teileArray } from '@/lib/portfolio-analyse/batch-hilfen'
import { isinKenntnis } from '@/lib/portfolio-analyse/isin-kenntnisse'
import { anzeigeNameFuerIsin, wknFuerIsin } from '@/lib/portfolio-analyse/isin-metadata-client'
import type { IsinMetadata } from '@/lib/portfolio-analyse/isin-lookup-server'
import {
  FX_SYMBOLE,
  fxKurseAusYahooMap,
  kandidatenMitDeFallback,
  kursAusErzwungenemSymbol,
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
  kursVortagEur: number | null
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
  fx: FxKurse
  verlauf: { label: string; wert: number; monat: string }[]
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
    const k = isinKenntnis(isin)
    if (k?.kursNurSymbol) set.add(k.kursNurSymbol)
    if (k?.stooqSymbol) set.add(`stooq:${k.stooqSymbol}`)
    const basis = k?.symbolCandidates?.length
      ? k.symbolCandidates
      : m?.symbolCandidates?.length
        ? m.symbolCandidates.slice(0, 6)
        : m?.symbolYahoo
          ? [m.symbolYahoo]
          : []
    const mitFallback =
      k?.kursNurSymbol || k?.symbolCandidates?.length === 0
        ? basis
        : kandidatenMitDeFallback(basis)
    for (const sym of mitFallback) {
      const key = sym.toUpperCase()
      if (k?.verboteneSymbole?.some((v) => v.toUpperCase() === key)) continue
      set.add(sym)
    }
  }
  return [...set]
}

export type LiveKursePaket = {
  kurse: Map<string, YahooKursZeile>
  stand: string | null
  fx: FxKurse
  stooqEur: Map<string, number>
}

export async function ladeLiveKurseClient(symbols: string[]): Promise<LiveKursePaket> {
  const stooqEur = new Map<string, number>()
  if (symbols.length === 0) {
    return { kurse: new Map(), stand: null, fx: fxKurseAusYahooMap(new Map()), stooqEur }
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
      const key = sym.toUpperCase()
      if (key.startsWith('STOOQ:')) {
        if (row.preis != null) stooqEur.set(key, row.preis)
      } else {
        map.set(key, row)
      }
    }
  }

  return { kurse: map, stand, fx: fxKurseAusYahooMap(map), stooqEur }
}

/** Tägliche Yahoo-Schlusskurse (Rohwährung der Börse). */
export async function ladeHistorischeKurseClient(
  symbols: string[],
  vonDatum: string,
  bisDatum: string,
  stooqSymbols: string[] = [],
): Promise<Map<string, Map<string, number>>> {
  const uniq = [...new Set(symbols.map((s) => s.trim().toUpperCase()).filter(Boolean))].filter(
    (s) => !s.startsWith('STOOQ:'),
  )
  const stooq = [...new Set(stooqSymbols.map((s) => s.trim().toLowerCase()).filter(Boolean))]
  if (uniq.length === 0 && stooq.length === 0) return new Map()

  const out = new Map<string, Map<string, number>>()
  const BATCH = 60
  const STOOQ_BATCH = 40
  const batches: { yahoo: string[]; stooq: string[] }[] = []
  const n = Math.max(Math.ceil(uniq.length / BATCH), Math.ceil(stooq.length / STOOQ_BATCH), 1)
  for (let i = 0; i < n; i++) {
    batches.push({
      yahoo: uniq.slice(i * BATCH, (i + 1) * BATCH),
      stooq: stooq.slice(i * STOOQ_BATCH, (i + 1) * STOOQ_BATCH),
    })
  }
  for (const batch of batches) {
    if (batch.yahoo.length === 0 && batch.stooq.length === 0) continue
    const res = await fetch('/api/portfolio-analyse/kurse/historie', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        symbols: batch.yahoo,
        stooqSymbols: batch.stooq,
        vonDatum,
        bisDatum,
      }),
    })
    const j = (await res.json()) as {
      ok?: boolean
      serien?: Record<string, Record<string, number>>
    }
    if (!j.ok || !j.serien) continue
    for (const [sym, tage] of Object.entries(j.serien)) {
      out.set(sym.toUpperCase(), new Map(Object.entries(tage)))
    }
  }
  return out
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
  stooqEur: Map<string, number> = new Map(),
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
    const kenntnis = isin ? isinKenntnis(isin) : null
    const kandidatenBasis = kenntnis?.symbolCandidates?.length
      ? kenntnis.symbolCandidates
      : m?.symbolCandidates?.length
        ? m.symbolCandidates
        : m?.symbolYahoo
          ? [m.symbolYahoo]
          : []
    const kandidaten = kenntnis?.symbolCandidates?.length
      ? kandidatenBasis
      : kandidatenMitDeFallback(kandidatenBasis)
    const einstandEur = p.wertEur
    einstandOffenEur += einstandEur
    const einstandKurs = p.stueck > 0 ? einstandEur / p.stueck : (p.kursEur ?? 0)

    let kursWahl =
      kenntnis?.kursNurSymbol != null
        ? kursAusErzwungenemSymbol(
            kenntnis.kursNurSymbol,
            yahooKurse,
            fx,
            kenntnis.symbolWaehrung,
          )
        : null

    if (kursWahl == null) {
      kursWahl = waehleBesterKurs(kandidaten, yahooKurse, einstandKurs, p.kursEur ?? null, {
        isin,
        fx,
        usBasisTicker: isin.startsWith('US') ? usBasisTickerAusKandidaten(kandidaten) : null,
        symbolWaehrung: kenntnis?.symbolWaehrung,
        verboteneSymbole: kenntnis?.verboteneSymbole,
      })
    }

    if (kursWahl == null && kenntnis?.kursFallbackEur != null && kenntnis.kursFallbackEur > 0) {
      const fb = kenntnis.kursFallbackEur
      const symFb = kenntnis.kursNurSymbol ?? kenntnis.symbolYahoo ?? 'fallback'
      kursWahl = {
        symbol: symFb,
        kurs: fb,
        direktEur: true,
        zeile: { preis: fb, aenderungTagProzent: null },
      }
    }

    if (kursWahl == null && kenntnis?.stooqSymbol) {
      const stooqPreis = stooqEur.get(`STOOQ:${kenntnis.stooqSymbol}`.toUpperCase())
      if (stooqPreis != null && stooqPreis > 0) {
        kursWahl = {
          symbol: `stooq:${kenntnis.stooqSymbol}`,
          kurs: stooqPreis,
          direktEur: true,
          zeile: { preis: stooqPreis, aenderungTagProzent: null },
        }
      }
    }
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
      kursVortagEur: kursZeile?.vortagPreis ?? null,
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

  const verlauf = baueMonatsVerlauf(buchungen, depotwertEur)

  return {
    positionen,
    kennzahlen: {
      depotwertEur,
      investiertEur: nettoEingezahlt > 0 ? nettoEingezahlt : einstandOffenEur,
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
    fx,
    verlauf,
  }
}

function vortagIso(heute: string): string {
  const d = new Date(`${heute}T12:00:00`)
  d.setDate(d.getDate() - 1)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const da = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${da}`
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/**
 * Portfoliowert vor Börsenbeginn heute (Parqet „Wert am [heute]“ bei Filter „Heute“):
 * Bestand vom Vortag × Yahoo-Schlusskurs (previous close) je Position.
 */
export function depotwertVorBoersenbeginn(
  buchungen: PortfolioBuchung[],
  positionen: LivePosition[],
  heuteIso: string,
): number | null {
  if (positionen.length === 0) return null

  const stand = depotStandBisDatum(buchungen, vortagIso(heuteIso))
  const posByIsin = new Map(positionen.map((p) => [p.isin?.toUpperCase() ?? '', p]))
  let wert = Math.max(0, stand.cash)
  let hatKursdaten = false

  for (const [isin, h] of stand.byIsin) {
    if (h.stueck <= 0) continue
    const pos = posByIsin.get(isin)
    if (pos?.kursVortagEur != null && pos.kursVortagEur > 0) {
      wert += h.stueck * pos.kursVortagEur
      hatKursdaten = true
      continue
    }
    if (pos?.kursLiveEur != null && pos.kursLiveEur > 0) {
      wert += h.stueck * pos.kursLiveEur
      hatKursdaten = true
    } else if (h.einstandKurs > 0) {
      wert += h.stueck * h.einstandKurs
    }
  }

  return hatKursdaten ? round2(wert) : null
}

