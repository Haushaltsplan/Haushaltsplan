import 'server-only'

import type { YahooFundamentalKennzahlen } from '@/lib/portfolio-analyse/fundamentaldaten-key-metrics'
import {
  FUNDAMENTAL_NTM_KEY,
  istFundamentalQuartalSchaetzungIso,
  type FundamentalMetrikZeile,
  type FundamentalPeriode,
} from '@/lib/portfolio-analyse/fundamentaldaten-types'
import { YAHOO_FINANCE_FETCH_HEADERS } from '@/lib/portfolio-analyse/yahoo-finance-auth-server'

const YAHOO_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'

function wert(zeilen: FundamentalMetrikZeile[], id: string, key: string): number | null {
  const z = zeilen.find((r) => r.id === id)
  const v = z?.werte[key]
  return v != null && Number.isFinite(v) ? v : null
}

function epsAusZeilen(
  zeilen: FundamentalMetrikZeile[],
  key: string,
  sharesMio: number | null,
): number | null {
  const eps = wert(zeilen, 'eps', key)
  if (eps != null && eps > 0) return eps
  const niMio = wert(zeilen, 'nettogewinn', key)
  if (niMio != null && sharesMio != null && sharesMio > 0) return niMio / sharesMio
  return null
}

function marktCapMio(
  price: number | null,
  sharesMio: number | null,
  yahoo: YahooFundamentalKennzahlen | null,
): number | null {
  if (yahoo?.marketCap != null && yahoo.marketCap > 0) return yahoo.marketCap / 1_000_000
  if (price != null && sharesMio != null && sharesMio > 0) return price * sharesMio
  return null
}

function enterpriseValueMio(
  yahoo: YahooFundamentalKennzahlen | null,
  marktCapMioVal: number | null,
): number | null {
  if (yahoo?.enterpriseValue != null && yahoo.enterpriseValue > 0) {
    return yahoo.enterpriseValue / 1_000_000
  }
  return marktCapMioVal
}

function ebitdaAusZeilen(zeilen: FundamentalMetrikZeile[], key: string): number | null {
  const ebitda = wert(zeilen, 'ebitda', key)
  if (ebitda != null && ebitda > 0) return ebitda
  const ebit = wert(zeilen, 'ebit', key)
  return ebit != null && ebit > 0 ? ebit : null
}

function historischeFyKeys(perioden: FundamentalPeriode[]): string[] {
  return perioden
    .filter((p) => !p.istLtm && !p.istNtm && !p.istSchaetzung && /^\d{4}-\d{2}-\d{2}$/.test(p.iso))
    .map((p) => p.iso)
}

function schaetzungsPeriodenKeys(perioden: FundamentalPeriode[]): string[] {
  return perioden
    .filter((p) => p.istSchaetzung && !istFundamentalQuartalSchaetzungIso(p.iso))
    .map((p) => p.iso)
}

/** Historische FYs plus Schätzungs-Spalten — für NTM „nächstes Jahr“. */
function alleNtmFundamentalKeys(perioden: FundamentalPeriode[]): string[] {
  const hist = historischeFyKeys(perioden)
  const schaetz = schaetzungsPeriodenKeys(perioden)
  const out = [...hist]
  for (const s of schaetz) {
    if (!out.includes(s)) out.push(s)
  }
  return out
}

function fuelleNtmSpalte(
  keys: {
    pe: Record<string, number | null>
    ps: Record<string, number | null>
    pfcf: Record<string, number | null>
    evRev: Record<string, number | null>
    evEbitda: Record<string, number | null>
  },
  spalte: string,
  price: number | null,
  zeilen: FundamentalMetrikZeile[],
  nextKey: string,
  yahoo: YahooFundamentalKennzahlen | null,
): void {
  const shares = wert(zeilen, 'aktien', spalte)
  const epsNext = epsAusZeilen(zeilen, nextKey, shares)
  const revNext = wert(zeilen, 'umsatz', nextKey)
  const fcfNext = wert(zeilen, 'fcf', nextKey)
  const ebitdaNext = ebitdaAusZeilen(zeilen, nextKey)

  keys.pe[spalte] = safeDiv(price, epsNext)
  const mcMio = marktCapMio(price, shares, yahoo)
  const evMio = enterpriseValueMio(yahoo, mcMio)
  keys.ps[spalte] = safeDiv(mcMio, revNext)
  keys.pfcf[spalte] = safeDiv(mcMio, fcfNext)
  keys.evRev[spalte] = safeDiv(evMio, revNext)
  keys.evEbitda[spalte] = safeDiv(evMio, ebitdaNext)
}

/** Forward-Multiples für Schätzungs-Spalten (FY26E …) mit aktuellem Kurs + Konsens. */
function fuelleForwardSchaetzSpalte(
  keys: {
    pe: Record<string, number | null>
    ps: Record<string, number | null>
    pfcf: Record<string, number | null>
    evRev: Record<string, number | null>
    evEbitda: Record<string, number | null>
  },
  schaetzKey: string,
  aktuellerKurs: number | null,
  zeilen: FundamentalMetrikZeile[],
  sharesFromKey: string,
  yahoo: YahooFundamentalKennzahlen | null,
): void {
  const shares = wert(zeilen, 'aktien', sharesFromKey)
  const eps = epsAusZeilen(zeilen, schaetzKey, shares)
  const rev = wert(zeilen, 'umsatz', schaetzKey)
  const fcf = wert(zeilen, 'fcf', schaetzKey)
  const ebitda = ebitdaAusZeilen(zeilen, schaetzKey)
  const mcMio = marktCapMio(aktuellerKurs, shares, yahoo)
  const evMio = enterpriseValueMio(yahoo, mcMio)

  keys.pe[schaetzKey] = safeDiv(aktuellerKurs, eps)
  keys.ps[schaetzKey] = safeDiv(mcMio, rev)
  keys.pfcf[schaetzKey] = safeDiv(mcMio, fcf)
  keys.evRev[schaetzKey] = safeDiv(evMio, rev)
  keys.evEbitda[schaetzKey] = safeDiv(evMio, ebitda)
}

function ersterGefuellterWert(map: Record<string, number | null>, keys: string[]): number | null {
  for (const k of keys) {
    const v = map[k]
    if (v != null && Number.isFinite(v)) return v
  }
  return null
}

/** Nur die NTM-Spalte setzen — TTM gehört nicht in die Forward-Bewertung. */
function setzeAktuellNtmSpalten(
  keys: {
    pe: Record<string, number | null>
    ps: Record<string, number | null>
    pfcf: Record<string, number | null>
    evRev: Record<string, number | null>
    evEbitda: Record<string, number | null>
  },
  aktuell: {
    pe: number | null
    ps: number | null
    pfcf: number | null
    evRev: number | null
    evEbitda: number | null
  },
): void {
  keys.pe[FUNDAMENTAL_NTM_KEY] = aktuell.pe
  keys.ps[FUNDAMENTAL_NTM_KEY] = aktuell.ps
  keys.pfcf[FUNDAMENTAL_NTM_KEY] = aktuell.pfcf
  keys.evRev[FUNDAMENTAL_NTM_KEY] = aktuell.evRev
  keys.evEbitda[FUNDAMENTAL_NTM_KEY] = aktuell.evEbitda
}

function safeDiv(a: number | null, b: number | null): number | null {
  if (a == null || b == null || b === 0) return null
  return a / b
}

async function ladeSchlusskurseNaheDatum(
  symbol: string,
  daten: string[],
): Promise<Map<string, number>> {
  const out = new Map<string, number>()
  if (daten.length === 0) return out

  const u = new URL(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`,
  )
  u.searchParams.set('interval', '1d')
  u.searchParams.set('range', 'max')
  u.searchParams.set('events', 'div,splits')

  const res = await fetch(u.toString(), {
    headers: { ...YAHOO_FINANCE_FETCH_HEADERS, 'User-Agent': YAHOO_UA },
    cache: 'no-store',
  })
  if (!res.ok) return out

  const j = (await res.json()) as {
    chart?: {
      result?: Array<{
        timestamp?: number[]
        indicators?: { quote?: Array<{ close?: Array<number | null> }> }
      }>
    }
  }
  const row = j.chart?.result?.[0]
  const timestamps = row?.timestamp ?? []
  const closes = row?.indicators?.quote?.[0]?.close ?? []
  if (timestamps.length === 0) return out

  const serie = timestamps
    .map((ts, i) => ({ ts, close: closes[i] }))
    .filter((p): p is { ts: number; close: number } => p.close != null && Number.isFinite(p.close))

  for (const iso of daten) {
    const ziel = new Date(`${iso}T12:00:00Z`).getTime() / 1000
    let best: { ts: number; close: number } | null = null
    let bestDiff = Infinity
    for (const p of serie) {
      const diff = Math.abs(p.ts - ziel)
      if (diff < bestDiff) {
        bestDiff = diff
        best = p
      }
    }
    if (best && bestDiff < 45 * 24 * 3600) out.set(iso, best.close)
  }

  return out
}

function zeileAusWerten(
  id: string,
  label: string,
  werte: Record<string, number | null>,
): FundamentalMetrikZeile {
  return {
    id,
    label,
    gruppe: 'bewertung_forward',
    einheit: 'multiple',
    werte,
  }
}

export type NtmBewertungErgebnis = {
  periodenPatch: FundamentalPeriode | null
  zeilen: FundamentalMetrikZeile[]
}

export async function baueNtmBewertungsZeilen(
  symbolYahoo: string | null,
  perioden: FundamentalPeriode[],
  zeilen: FundamentalMetrikZeile[],
  yahoo: YahooFundamentalKennzahlen | null,
): Promise<NtmBewertungErgebnis> {
  const fyKeys = historischeFyKeys(perioden)
  if (fyKeys.length < 2) return { periodenPatch: null, zeilen: [] }

  const allKeys = alleNtmFundamentalKeys(perioden)
  const preise = symbolYahoo ? await ladeSchlusskurseNaheDatum(symbolYahoo, fyKeys) : new Map()

  const ntmPe: Record<string, number | null> = {}
  const ntmPs: Record<string, number | null> = {}
  const ntmPfcf: Record<string, number | null> = {}
  const ntmEvRev: Record<string, number | null> = {}
  const ntmEvEbitda: Record<string, number | null> = {}
  const keyMaps = { pe: ntmPe, ps: ntmPs, pfcf: ntmPfcf, evRev: ntmEvRev, evEbitda: ntmEvEbitda }

  for (let i = 0; i < allKeys.length - 1; i++) {
    const cur = allKeys[i]!
    const next = allKeys[i + 1]!
    if (!/^\d{4}-\d{2}-\d{2}$/.test(cur)) continue
    const price = preise.get(cur) ?? null
    fuelleNtmSpalte(keyMaps, cur, price, zeilen, next, yahoo)
  }

  const letztesHistKey = fyKeys[fyKeys.length - 1]!
  const aktuellerKurs = yahoo?.currentPrice ?? preise.get(letztesHistKey) ?? null

  for (const sk of schaetzungsPeriodenKeys(perioden)) {
    fuelleForwardSchaetzSpalte(keyMaps, sk, aktuellerKurs, zeilen, letztesHistKey, yahoo)
  }

  const schKeys = schaetzungsPeriodenKeys(perioden)

  // NTM-FCF: nächstes Schätzjahr, sonst letztes FY × (1 + Umsatzwachstum)
  const fcfSchaetzMio = schKeys.map((sk) => wert(zeilen, 'fcf', sk)).find((v) => v != null && v > 0) ?? null
  const ltmFcfMio = wert(zeilen, 'fcf', fyKeys[fyKeys.length - 1]!)
  const ntmFcfUsd =
    fcfSchaetzMio != null
      ? fcfSchaetzMio * 1_000_000
      : ltmFcfMio != null && yahoo?.revenueGrowth != null
        ? ltmFcfMio * 1_000_000 * (1 + yahoo.revenueGrowth)
        : ltmFcfMio != null
          ? ltmFcfMio * 1_000_000
          : null

  let ntmKgv =
    yahoo?.forwardPE ??
    (yahoo?.currentPrice != null && yahoo?.ntmEpsSchaetzung != null && yahoo.ntmEpsSchaetzung > 0
      ? yahoo.currentPrice / yahoo.ntmEpsSchaetzung
      : null)
  let ntmEvRevenueAktuell =
    yahoo?.enterpriseToRevenue ??
    (yahoo?.enterpriseValue != null && yahoo?.ntmRevenueUsd != null && yahoo.ntmRevenueUsd > 0
      ? yahoo.enterpriseValue / yahoo.ntmRevenueUsd
      : null)
  let ntmEvEbitdaAktuell =
    yahoo?.enterpriseToEbitda ??
    (yahoo?.enterpriseValue != null && yahoo?.ntmEbitdaUsd != null && yahoo.ntmEbitdaUsd > 0
      ? yahoo.enterpriseValue / yahoo.ntmEbitdaUsd
      : null)
  let ntmMcFcf =
    yahoo?.marketCap != null && ntmFcfUsd != null && ntmFcfUsd > 0
      ? yahoo.marketCap / ntmFcfUsd
      : null
  let ntmPsAktuell =
    yahoo?.marketCap != null && yahoo?.ntmRevenueUsd != null && yahoo.ntmRevenueUsd > 0
      ? yahoo.marketCap / yahoo.ntmRevenueUsd
      : null

  // Wenn Yahoo-NTM fehlt: nächstes FY-Schätz-Multiple als NTM-Proxy
  if (ntmKgv == null) ntmKgv = ersterGefuellterWert(ntmPe, schKeys)
  if (ntmPsAktuell == null) ntmPsAktuell = ersterGefuellterWert(ntmPs, schKeys)
  if (ntmMcFcf == null) ntmMcFcf = ersterGefuellterWert(ntmPfcf, schKeys)
  if (ntmEvRevenueAktuell == null) ntmEvRevenueAktuell = ersterGefuellterWert(ntmEvRev, schKeys)
  if (ntmEvEbitdaAktuell == null) ntmEvEbitdaAktuell = ersterGefuellterWert(ntmEvEbitda, schKeys)

  setzeAktuellNtmSpalten(keyMaps, {
    pe: ntmKgv,
    ps: ntmPsAktuell,
    pfcf: ntmMcFcf,
    evRev: ntmEvRevenueAktuell,
    evEbitda: ntmEvEbitdaAktuell,
  })

  // Kein Backfill von Yahoo-NTM in FY-Schätzspalten — sonst springt die Linie
  // von „Kurs÷FY-EPS“ (~18–20×) auf NTM (~14×) und wirkt wie ein Datenfehler.
  // Leere Schätzspalten bleiben leer; der aktuelle NTM-Wert steht nur unter __ntm__.

  for (const sk of schKeys) {
    for (const map of [ntmPe, ntmPs, ntmPfcf, ntmEvRev, ntmEvEbitda]) {
      if (!(sk in map)) map[sk] = null
    }
  }

  if (ntmKgv == null && ntmEvRevenueAktuell == null && ntmEvEbitdaAktuell == null && ntmMcFcf == null) {
    const hatHistorie = Object.values(ntmPe).some((v) => v != null)
    if (!hatHistorie) return { periodenPatch: null, zeilen: [] }
  }

  return {
    periodenPatch: { iso: FUNDAMENTAL_NTM_KEY, label: 'NTM', istNtm: true },
    zeilen: [
      zeileAusWerten('ntm_pe', 'NTM KGV (P/E)', ntmPe),
      zeileAusWerten('ntm_ps', 'NTM Kurs / Umsatz', ntmPs),
      zeileAusWerten('ntm_pfcf', 'NTM MC / FCF', ntmPfcf),
      zeileAusWerten('ntm_ev_rev', 'NTM EV / Umsatz', ntmEvRev),
      zeileAusWerten('ntm_ev_ebitda', 'NTM EV / EBITDA', ntmEvEbitda),
    ],
  }
}
