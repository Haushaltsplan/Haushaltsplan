import 'server-only'

import type { YahooFundamentalKennzahlen } from '@/lib/portfolio-analyse/fundamentaldaten-key-metrics'
import {
  FUNDAMENTAL_NTM_KEY,
  FUNDAMENTAL_TTM_KEY,
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

function historischeFyKeys(perioden: FundamentalPeriode[]): string[] {
  return perioden
    .filter((p) => !p.istLtm && !p.istNtm && !p.istSchaetzung && /^\d{4}-\d{2}-\d{2}$/.test(p.iso))
    .map((p) => p.iso)
}

function schaetzungsPeriodenKeys(perioden: FundamentalPeriode[]): string[] {
  return perioden.filter((p) => p.istSchaetzung).map((p) => p.iso)
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
): void {
  const epsNext = wert(zeilen, 'eps', nextKey)
  const revNext = wert(zeilen, 'umsatz', nextKey)
  const fcfNext = wert(zeilen, 'fcf', nextKey)
  const ebitdaNext = wert(zeilen, 'ebitda', nextKey)
  const shares = wert(zeilen, 'aktien', spalte)

  keys.pe[spalte] = safeDiv(price, epsNext)
  const mc = price != null && shares != null ? price * shares : null
  keys.ps[spalte] = safeDiv(mc, revNext)
  keys.pfcf[spalte] = safeDiv(mc, fcfNext)
  keys.evRev[spalte] = keys.ps[spalte]
  keys.evEbitda[spalte] = safeDiv(mc, ebitdaNext)
}

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
  for (const iso of [FUNDAMENTAL_NTM_KEY, FUNDAMENTAL_TTM_KEY]) {
    keys.pe[iso] = aktuell.pe
    keys.ps[iso] = aktuell.ps
    keys.pfcf[iso] = aktuell.pfcf
    keys.evRev[iso] = aktuell.evRev
    keys.evEbitda[iso] = aktuell.evEbitda
  }
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
    fuelleNtmSpalte(keyMaps, cur, price, zeilen, next)
  }

  const ltmFcf =
    wert(zeilen, 'fcf', fyKeys[fyKeys.length - 1]!) != null
      ? wert(zeilen, 'fcf', fyKeys[fyKeys.length - 1]!)! * 1_000_000
      : null
  const ntmFcfUsd =
    ltmFcf != null && yahoo?.revenueGrowth != null ? ltmFcf * (1 + yahoo.revenueGrowth) : ltmFcf

  const ntmKgv =
    yahoo?.forwardPE ??
    (yahoo?.currentPrice != null && yahoo?.ntmEpsSchaetzung != null && yahoo.ntmEpsSchaetzung > 0
      ? yahoo.currentPrice / yahoo.ntmEpsSchaetzung
      : null)
  const ntmEvRevenueAktuell =
    yahoo?.enterpriseToRevenue ??
    (yahoo?.enterpriseValue != null && yahoo?.ntmRevenueUsd != null && yahoo.ntmRevenueUsd > 0
      ? yahoo.enterpriseValue / yahoo.ntmRevenueUsd
      : null)
  const ntmEvEbitdaAktuell =
    yahoo?.enterpriseToEbitda ??
    (yahoo?.enterpriseValue != null && yahoo?.ntmEbitdaUsd != null && yahoo.ntmEbitdaUsd > 0
      ? yahoo.enterpriseValue / yahoo.ntmEbitdaUsd
      : null)
  const ntmMcFcf =
    yahoo?.marketCap != null && ntmFcfUsd != null && ntmFcfUsd > 0
      ? yahoo.marketCap / ntmFcfUsd
      : null
  const ntmPsAktuell =
    yahoo?.marketCap != null && yahoo?.ntmRevenueUsd != null && yahoo.ntmRevenueUsd > 0
      ? yahoo.marketCap / yahoo.ntmRevenueUsd
      : null

  setzeAktuellNtmSpalten(keyMaps, {
    pe: ntmKgv,
    ps: ntmPsAktuell,
    pfcf: ntmMcFcf,
    evRev: ntmEvRevenueAktuell,
    evEbitda: ntmEvEbitdaAktuell,
  })

  // Schätzungs-Spalte (z. B. FY25E): aktueller Forward-Multiple, falls noch leer
  for (const sk of schaetzungsPeriodenKeys(perioden)) {
    if (ntmPe[sk] == null && ntmKgv != null) {
      ntmPe[sk] = ntmKgv
      ntmPs[sk] = ntmPsAktuell
      ntmPfcf[sk] = ntmMcFcf
      ntmEvRev[sk] = ntmEvRevenueAktuell
      ntmEvEbitda[sk] = ntmEvEbitdaAktuell
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
