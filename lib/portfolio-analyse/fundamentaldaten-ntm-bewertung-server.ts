import 'server-only'

import type { YahooFundamentalKennzahlen } from '@/lib/portfolio-analyse/fundamentaldaten-key-metrics'
import {
  FUNDAMENTAL_NTM_KEY,
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

  const preise = symbolYahoo ? await ladeSchlusskurseNaheDatum(symbolYahoo, fyKeys) : new Map()

  const ntmPe: Record<string, number | null> = {}
  const ntmPs: Record<string, number | null> = {}
  const ntmPfcf: Record<string, number | null> = {}
  const ntmEvRev: Record<string, number | null> = {}
  const ntmEvEbitda: Record<string, number | null> = {}

  for (let i = 0; i < fyKeys.length - 1; i++) {
    const cur = fyKeys[i]!
    const next = fyKeys[i + 1]!
    const price = preise.get(cur) ?? null
    const epsNext = wert(zeilen, 'eps', next)
    const revNext = wert(zeilen, 'umsatz', next)
    const fcfNext = wert(zeilen, 'fcf', next)
    const ebitdaNext = wert(zeilen, 'ebitda', next)
    const shares = wert(zeilen, 'aktien', cur)

    ntmPe[cur] = safeDiv(price, epsNext)

    const mc = price != null && shares != null ? price * shares : null
    ntmPs[cur] = safeDiv(mc, revNext)
    ntmPfcf[cur] = safeDiv(mc, fcfNext)
    ntmEvRev[cur] = ntmPs[cur]
    ntmEvEbitda[cur] = safeDiv(mc, ebitdaNext)
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

  ntmPe[FUNDAMENTAL_NTM_KEY] = ntmKgv
  ntmPs[FUNDAMENTAL_NTM_KEY] = ntmPsAktuell
  ntmPfcf[FUNDAMENTAL_NTM_KEY] = ntmMcFcf
  ntmEvRev[FUNDAMENTAL_NTM_KEY] = ntmEvRevenueAktuell
  ntmEvEbitda[FUNDAMENTAL_NTM_KEY] = ntmEvEbitdaAktuell

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
