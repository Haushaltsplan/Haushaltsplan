import { cagrJaehrlichAusSerie, cagrProzent } from '@/lib/portfolio-analyse/fundamentaldaten-format'
import {
  effektiverSteuersatz,
  historischeWerteAusZeile,
  letzterVerfuegbarerWert,
  schaetzeWaccPct,
  ttmOderLetzterFlow,
} from '@/lib/portfolio-analyse/fundamentaldaten-roic-hilfen'
import type { FundamentaldatenPaket, FundamentalMetrikZeile } from '@/lib/portfolio-analyse/fundamentaldaten-types'
import {
  FUNDAMENTAL_FY0E_KEY,
  FUNDAMENTAL_FY1E_KEY,
  FUNDAMENTAL_TTM_KEY,
  istFundamentalSchaetzungIso,
} from '@/lib/portfolio-analyse/fundamentaldaten-types'
import type { DcfAnnahmen, DcfPaketInputs, DcfWaccBaustein } from '@/lib/portfolio-analyse/dcf/dcf-types'

const RISK_FREE_PCT = 4.5
const ERP_PCT = 5.5
const DEFAULT_G_START = 10
const DEFAULT_G_TERM = 2.5
const DEFAULT_JAHRE = 10
const DEFAULT_EXIT_MULTIPLE = 20

function zeile(paket: FundamentaldatenPaket, id: string): FundamentalMetrikZeile | undefined {
  return paket.zeilen.find((z) => z.id === id)
}

function clip(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v))
}

function runde1(v: number): number {
  return Math.round(v * 10) / 10
}

/** Sinnvolles High-Growth-g für 5–10J-DCF (nicht Restjahr FY0≈TTM). */
function istBrauchbaresWachstum(gPct: number): boolean {
  return Number.isFinite(gPct) && gPct >= 4 && gPct <= 25
}

function mittelWachstum(werte: Array<number | null | undefined>): number | null {
  const xs = werte.filter((v): v is number => v != null && Number.isFinite(v))
  if (xs.length === 0) return null
  return xs.reduce((a, b) => a + b, 0) / xs.length
}

/** Forward-FCF-Serie aus Schätzzeile (Mio. → geordnet FY0, FY1, …). */
function fcfForecastMioSerie(paket: FundamentaldatenPaket): number[] {
  const z = zeile(paket, 'fcf_schaetzung')
  if (!z) return []
  const keys = [
    FUNDAMENTAL_FY0E_KEY,
    FUNDAMENTAL_FY1E_KEY,
    ...Object.keys(z.werte)
      .filter((k) => istFundamentalSchaetzungIso(k) && k !== FUNDAMENTAL_FY0E_KEY && k !== FUNDAMENTAL_FY1E_KEY)
      .sort(),
  ]
  const out: number[] = []
  for (const k of keys) {
    const v = z.werte[k]
    if (v != null && Number.isFinite(v) && v > 0) out.push(v)
  }
  return out
}

/** DE-formatierte Key-Metric-Strings → Zahl (wie Nachkauf-Radar). */
export function parseMetricWert(wertStr: string | null | undefined): number | null {
  if (!wertStr) return null
  const s = wertStr
    .replace(/[x%\s$€]/g, '')
    .replace(/\./g, '')
    .replace(',', '.')
  const v = parseFloat(s)
  return Number.isFinite(v) ? v : null
}

function kmWert(paket: FundamentaldatenPaket, id: string): string | undefined {
  return paket.keyMetrics.find((m) => m.id === id)?.wert
}

function kmZahl(paket: FundamentaldatenPaket, id: string): number | null {
  const m = paket.keyMetrics.find((x) => x.id === id)
  if (m?.zahl != null && Number.isFinite(m.zahl)) return m.zahl
  return parseMetricWert(m?.wert)
}

function fcfUsdAusPaket(paket: FundamentaldatenPaket): { usd: number | null; quelle: 'ttm' | 'gj' | null } {
  const z = zeile(paket, 'fcf')
  if (!z) return { usd: null, quelle: null }
  const ttm = z.werte[FUNDAMENTAL_TTM_KEY]
  if (ttm != null && Number.isFinite(ttm) && ttm > 0) {
    return { usd: ttm * 1_000_000, quelle: 'ttm' }
  }
  const flow = ttmOderLetzterFlow(z, paket.perioden)
  if (flow != null && Number.isFinite(flow) && flow > 0) {
    return { usd: flow * 1_000_000, quelle: 'gj' }
  }
  return { usd: null, quelle: null }
}

/**
 * High-Growth-Default — nur prognostizierte Quellen (kein Hist-CAGR).
 *
 * 1. FCF-Forecast-CAGR (StockAnalysis; fehlende Jahre via Umsatz-Consensus gefüllt)
 * 2. Consensus-Umsatzwachstum (FY0/FY1 Mittel oder fwd_rev_cagr_2y)
 * 3. Consensus-EPS-Wachstum (dito)
 * 4. Fallback 10 %
 */
function gStartAusPaket(paket: FundamentaldatenPaket, _fcf0Usd: number | null): {
  gStartPct: number
  quelle: DcfPaketInputs['gStartQuelle']
} {
  const fcfSerie = fcfForecastMioSerie(paket)
  if (fcfSerie.length >= 2) {
    const cagr = cagrProzent(fcfSerie, fcfSerie.length - 1)
    if (cagr != null && istBrauchbaresWachstum(cagr)) {
      return { gStartPct: runde1(clip(cagr, -5, 25)), quelle: 'fcf_forecast' }
    }
    // Einzel-YoYs mitteln, falls CAGR durch Plateau verzerrt
    const yoy: number[] = []
    for (let i = 1; i < fcfSerie.length; i++) {
      const a = fcfSerie[i - 1]!
      const b = fcfSerie[i]!
      if (a > 0) yoy.push(((b - a) / a) * 100)
    }
    const mid = mittelWachstum(yoy)
    if (mid != null && istBrauchbaresWachstum(mid)) {
      return { gStartPct: runde1(clip(mid, -5, 25)), quelle: 'fcf_forecast' }
    }
  }

  const umsatzW = zeile(paket, 'umsatz_wachstum_schaetzung')
  const umsatzMid = mittelWachstum([
    umsatzW?.werte[FUNDAMENTAL_FY0E_KEY],
    umsatzW?.werte[FUNDAMENTAL_FY1E_KEY],
  ])
  const fwdRev = kmZahl(paket, 'fwd_rev_cagr_2y')
  for (const g of [umsatzMid, fwdRev]) {
    if (g != null && istBrauchbaresWachstum(g)) {
      return { gStartPct: runde1(clip(g, -5, 25)), quelle: 'umsatz_consensus' }
    }
  }

  const epsW = zeile(paket, 'eps_wachstum_schaetzung')
  const epsMid = mittelWachstum([
    epsW?.werte[FUNDAMENTAL_FY0E_KEY],
    epsW?.werte[FUNDAMENTAL_FY1E_KEY],
  ])
  const fwdEps = kmZahl(paket, 'fwd_eps_cagr_2y')
  for (const g of [epsMid, fwdEps]) {
    if (g != null && istBrauchbaresWachstum(g)) {
      return { gStartPct: runde1(clip(g, -5, 25)), quelle: 'eps_consensus' }
    }
  }

  return { gStartPct: DEFAULT_G_START, quelle: 'fallback' }
}

function waccBaustein(paket: FundamentaldatenPaket): DcfWaccBaustein {
  const meta = paket.mantraMeta
  const yt = meta?.yahooFinanz
  const beta = meta?.beta ?? kmZahl(paket, 'beta')
  const marketCapUsd = meta?.marketCapUsd ?? null
  const totalDebtUsd = meta?.totalDebtUsd ?? null
  const interestExpenseUsd = yt?.interestExpenseUsd ?? null
  const pretax = yt?.pretaxIncomeUsd ?? null
  const taxProv = yt?.taxProvisionUsd ?? null
  const taxRate = effektiverSteuersatz(pretax, taxProv)
  const taxRatePct = taxRate * 100

  const waccPct = schaetzeWaccPct({
    beta,
    marketCapUsd,
    totalDebtUsd,
    interestExpenseUsd,
    pretaxIncomeUsd: pretax,
    taxProvisionUsd: taxProv,
  })

  const b = beta ?? 1
  const costEquityPct = RISK_FREE_PCT + b * ERP_PCT
  let costDebtPct = 5
  if (totalDebtUsd != null && totalDebtUsd > 0 && interestExpenseUsd != null && interestExpenseUsd > 0) {
    costDebtPct = (interestExpenseUsd / totalDebtUsd) * 100
  }
  const equity = marketCapUsd ?? 0
  const debt = totalDebtUsd ?? 0
  const total = equity + debt
  const equityWeight = total > 0 ? equity / total : null
  const debtWeight = total > 0 ? debt / total : null

  return {
    beta,
    riskFreePct: RISK_FREE_PCT,
    equityRiskPremiumPct: ERP_PCT,
    costEquityPct,
    costDebtPct,
    taxRatePct,
    equityWeight,
    debtWeight,
    waccPct: waccPct != null ? Math.round(waccPct * 100) / 100 : null,
  }
}

function sharesAusPaket(paket: FundamentaldatenPaket): number | null {
  const holders = paket.erweitert?.holders?.sharesOutstanding
  if (holders != null && holders > 0) return holders

  const aktienMio = letzterVerfuegbarerWert(zeile(paket, 'aktien'), paket.perioden)
  if (aktienMio != null && aktienMio > 0) return aktienMio * 1_000_000

  const raw = kmWert(paket, 'shares_out')
  if (raw) {
    // "123,45 Mio." → Aktien
    const m = raw.match(/([\d.,]+)\s*Mio/i)
    if (m) {
      const mio = parseMetricWert(m[1]!)
      if (mio != null && mio > 0) return mio * 1_000_000
    }
  }
  return null
}

function shareCagrAusPaket(paket: FundamentaldatenPaket): number {
  const hist = historischeWerteAusZeile(zeile(paket, 'aktien'), paket.perioden)
  const cagr = cagrJaehrlichAusSerie(hist, 5, 1.85)
  if (cagr == null || !Number.isFinite(cagr)) return 0
  return clip(cagr, -10, 15)
}

function netDebtAusPaket(paket: FundamentaldatenPaket): number | null {
  const ndMio = letzterVerfuegbarerWert(zeile(paket, 'nettoverschuldung'), paket.perioden)
  if (ndMio != null && Number.isFinite(ndMio)) return ndMio * 1_000_000

  const meta = paket.mantraMeta
  if (meta?.totalDebtUsd != null && meta?.totalCashUsd != null) {
    return meta.totalDebtUsd - meta.totalCashUsd
  }

  const km = kmZahl(paket, 'net_debt')
  // key metric oft schon absolut USD (waehrungNegativ) — unsicher; nur wenn |v| groß
  if (km != null && Math.abs(km) > 1_000) return km
  return null
}

function kursAusPaket(paket: FundamentaldatenPaket): number | null {
  return kmZahl(paket, 'kurs_aktuell')
}

function exitMultipleDefault(paket: FundamentaldatenPaket, fcf0Usd: number | null): number {
  const pfcf = kmZahl(paket, 'ltm_pfcf') ?? kmZahl(paket, 'ntm_mc_fcf')
  if (pfcf != null && pfcf > 0 && pfcf < 200) return Math.round(pfcf * 10) / 10
  const mcap = paket.mantraMeta?.marketCapUsd
  if (mcap != null && fcf0Usd != null && fcf0Usd > 0) {
    const m = mcap / fcf0Usd
    if (m > 0 && m < 200) return Math.round(m * 10) / 10
  }
  return DEFAULT_EXIT_MULTIPLE
}

export function dcfInputsAusPaket(paket: FundamentaldatenPaket): DcfPaketInputs {
  const fcf = fcfUsdAusPaket(paket)
  const g = gStartAusPaket(paket, fcf.usd)
  return {
    ticker: paket.ticker,
    name: paket.firmenname,
    symbolYahoo: paket.symbolYahoo,
    fcf0Usd: fcf.usd,
    fcf0Quelle: fcf.quelle,
    gStartPct: g.gStartPct,
    gStartQuelle: g.quelle,
    gTerminalPct: DEFAULT_G_TERM,
    jahre: DEFAULT_JAHRE,
    wacc: waccBaustein(paket),
    sharesOutstanding: sharesAusPaket(paket),
    shareCagrPct: shareCagrAusPaket(paket),
    netDebtUsd: netDebtAusPaket(paket),
    kursUsd: kursAusPaket(paket),
    currency: paket.waehrung || 'USD',
  }
}

/** Basis-Annahmen für den Rechner (fehlende Felder → sichere Fallbacks). */
export function annahmenAusPaketInputs(
  inputs: DcfPaketInputs,
  overrides?: Partial<DcfAnnahmen>,
): DcfAnnahmen | null {
  if (inputs.fcf0Usd == null || !(inputs.fcf0Usd > 0)) return null
  if (inputs.sharesOutstanding == null || !(inputs.sharesOutstanding > 0)) return null
  const waccPct = inputs.wacc.waccPct ?? 8
  const base: DcfAnnahmen = {
    fcf0Usd: inputs.fcf0Usd,
    jahre: inputs.jahre,
    gStartPct: inputs.gStartPct,
    gTerminalPct: inputs.gTerminalPct,
    fade: true,
    waccPct,
    terminalMethode: 'gordon',
    exitMultiple: DEFAULT_EXIT_MULTIPLE,
    netDebtUsd: inputs.netDebtUsd ?? 0,
    minoritiesUsd: 0,
    sharesOutstanding: inputs.sharesOutstanding,
    shareCagrPct: inputs.shareCagrPct,
    mosPct: 25,
    kursUsd: inputs.kursUsd,
  }
  return { ...base, ...overrides }
}

export function defaultExitMultipleFuerPaket(paket: FundamentaldatenPaket): number {
  const fcf = fcfUsdAusPaket(paket)
  return exitMultipleDefault(paket, fcf.usd)
}
