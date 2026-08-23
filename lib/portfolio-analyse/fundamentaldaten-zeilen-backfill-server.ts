/**
 * Fehlende GuV/CF-Zeilen aus StockAnalysis + Yahoo nachziehen (alle Titel).
 */

import 'server-only'

import type { FundamentalMetrikZeile, FundamentalPeriode } from '@/lib/portfolio-analyse/fundamentaldaten-types'
import {
  ladeStockanalysisStatementsRoh,
  type StockanalysisStatementsRoh,
} from '@/lib/portfolio-analyse/stockanalysis-statements-server'
import type { MantraYahooFinanzdaten } from '@/lib/portfolio-analyse/yahoo-fundamentals-timeseries-server'

const BACKFILL_IDS = ['sbc', 'da', 'capex', 'fcf', 'ocf', 'rd', 'sga', 'goodwill', 'intangibles'] as const

function histKeys(perioden: FundamentalPeriode[]): string[] {
  return perioden
    .filter((p) => !p.istLtm && !p.istNtm && !p.istSchaetzung && /^\d{4}-\d{2}-\d{2}$/.test(p.iso))
    .map((p) => p.iso)
}

function zaehleZeile(zeilen: FundamentalMetrikZeile[], id: string, keys: string[]): number {
  const z = zeilen.find((r) => r.id === id)
  if (!z) return 0
  return keys.filter((k) => z.werte[k] != null && Number.isFinite(z.werte[k]!)).length
}

function brauchtBackfill(zeilen: FundamentalMetrikZeile[], perioden: FundamentalPeriode[]): boolean {
  const keys = histKeys(perioden)
  if (keys.length === 0) return false
  for (const id of BACKFILL_IDS) {
    if (zaehleZeile(zeilen, id, keys) < 1) return true
  }
  return false
}

function mergeSaInZeilen(
  zeilen: FundamentalMetrikZeile[],
  perioden: FundamentalPeriode[],
  sa: StockanalysisStatementsRoh,
): void {
  const keys = histKeys(perioden)
  for (const src of sa.zeilen) {
    if (!BACKFILL_IDS.includes(src.id as (typeof BACKFILL_IDS)[number])) continue
    let dst = zeilen.find((z) => z.id === src.id)
    if (!dst) {
      dst = { ...src, werte: { ...src.werte } }
      zeilen.push(dst)
      continue
    }
    for (const iso of keys) {
      const v = src.werte[iso]
      if (v != null && dst.werte[iso] == null) dst.werte[iso] = v
    }
  }
}

function mergeYahooTrailingInZeilen(
  zeilen: FundamentalMetrikZeile[],
  perioden: FundamentalPeriode[],
  yf: MantraYahooFinanzdaten,
): void {
  const keys = histKeys(perioden)
  const lastKey = keys[keys.length - 1]
  if (!lastKey) return

  const upsert = (id: string, label: string, mio: number | null, gruppe: FundamentalMetrikZeile['gruppe'] = 'cashflow') => {
    if (mio == null || !Number.isFinite(mio)) return
    let z = zeilen.find((r) => r.id === id)
    if (!z) {
      z = { id, label, gruppe, einheit: 'waehrung_usd_mio', werte: {} }
      zeilen.push(z)
    }
    if (z.werte[lastKey] == null) z.werte[lastKey] = Math.round(mio * 10) / 10
  }

  if (yf.stockBasedCompensationUsd != null) {
    upsert('sbc', 'Aktienbasierte Vergütung (SBC)', yf.stockBasedCompensationUsd / 1_000_000)
  }
  if (yf.researchDevelopmentUsd != null) {
    upsert('rd', 'Forschung & Entwicklung (R&D)', yf.researchDevelopmentUsd / 1_000_000, 'finanzdaten')
  }
  if (yf.sgaUsd != null) {
    upsert('sga', 'SG&A (Vertrieb & Verwaltung)', yf.sgaUsd / 1_000_000, 'finanzdaten')
  }
  if (yf.freeCashFlowUsd != null) {
    upsert('fcf', 'Free Cashflow (FCF)', yf.freeCashFlowUsd / 1_000_000)
  }
  if (yf.operatingCashFlowUsd != null) {
    upsert('ocf', 'Operativer Cashflow', yf.operatingCashFlowUsd / 1_000_000)
  }
}

/** StockAnalysis + Yahoo-Trailing für fehlende SBC/CapEx/D&A/FCF — alle Aktien. */
export async function ergaenzeFehlendeStatementZeilen(opts: {
  perioden: FundamentalPeriode[]
  zeilen: FundamentalMetrikZeile[]
  symbolYahoo: string
  isin?: string | null
  ticker?: string | null
  firmenname?: string | null
  yahooFinanz?: MantraYahooFinanzdaten | null
}): Promise<void> {
  const { perioden, zeilen } = opts
  if (!brauchtBackfill(zeilen, perioden)) {
    if (opts.yahooFinanz) mergeYahooTrailingInZeilen(zeilen, perioden, opts.yahooFinanz)
    return
  }

  const sa = await ladeStockanalysisStatementsRoh({
    symbolYahoo: opts.symbolYahoo,
    isin: opts.isin,
    ticker: opts.ticker,
    firmenname: opts.firmenname,
  }).catch(() => null)

  if (sa) mergeSaInZeilen(zeilen, perioden, sa)
  if (opts.yahooFinanz) mergeYahooTrailingInZeilen(zeilen, perioden, opts.yahooFinanz)
}
