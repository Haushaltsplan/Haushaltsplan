import 'server-only'

import { ladeFinnhubJahresForecast } from '@/lib/portfolio-analyse/finnhub-jahres-schaetzungen-server'
import type { EarningsSchaetzungen } from '@/lib/portfolio-analyse/earnings-schaetzungen'
import {
  FUNDAMENTAL_TTM_KEY,
  fruehestesSchaetzJahr,
  fundamentalQuartalSchaetzungIso,
  fundamentalSchaetzungIso,
  type FundamentalMetrikZeile,
  type FundamentalPeriode,
} from '@/lib/portfolio-analyse/fundamentaldaten-types'
import { istSchaetzungZumVorjahrPlausibel } from '@/lib/portfolio-analyse/fundamentaldaten-format'
import { ladeMarketscreenerJahresForecast } from '@/lib/portfolio-analyse/marketscreener-jahres-consensus-server'
import {
  ladeMarketscreenerQuartalsForecastReihe,
  marketscreenerUmsatzPlausibel,
  type MarketscreenerQuartalsForecastEintrag,
} from '@/lib/portfolio-analyse/marketscreener-forecast-server'
import type { MarketscreenerJahresForecast } from '@/lib/portfolio-analyse/marketscreener-jahres-consensus-server'
import type { FinnhubJahresForecast } from '@/lib/portfolio-analyse/finnhub-jahres-schaetzungen-server'
import {
  ladeStockanalysisJahresForecast,
  type StockanalysisJahresForecast,
  type StockanalysisJahresForecastEintrag,
} from '@/lib/portfolio-analyse/stockanalysis-forecast-server'
import { ladeWallstreetEarningsSchaetzungen } from '@/lib/portfolio-analyse/wallstreet-earnings-schaetzungen-server'
import {
  holeYahooFinanceAuth,
  YAHOO_FINANCE_FETCH_HEADERS,
} from '@/lib/portfolio-analyse/yahoo-finance-auth-server'

type TrendZeile = Record<string, unknown> & { period?: string }

export type FundamentalSchaetzungenAnfrage = {
  symbol: string
  isin?: string | null
  name?: string | null
  ticker?: string | null
}

export type FundamentalSchaetzungenRoh = {
  perioden: FundamentalPeriode[]
  zeilen: FundamentalMetrikZeile[]
  /** Eine Quelle: StockAnalysis, sonst MS → Finnhub → Wallstreet → Yahoo. */
  quelle?: 'stockanalysis' | 'marketscreener' | 'wallstreet' | 'finnhub' | 'yahoo' | 'kombiniert'
}

function rawUnix(v: unknown): number | null {
  if (v == null || typeof v !== 'object') return null
  const raw = (v as { raw?: number }).raw
  return raw != null && Number.isFinite(raw) ? raw : null
}

function periodEndLabel(jahr: number | null, fallback: string): string {
  if (jahr != null && jahr > 2000) return `FY${String(jahr).slice(2)}E`
  return fallback
}

function wachstumPct(neu: number | null, alt: number | null): number | null {
  if (neu == null || alt == null || alt === 0) return null
  const w = ((neu - alt) / Math.abs(alt)) * 100
  return Number.isFinite(w) ? w : null
}

type MergeFy = {
  jahr: number | null
  umsatzMio: number | null
  eps: number | null
  umsatzWachstumPct: number | null
  epsWachstumPct: number | null
}

async function ladeYahooTrend(symbol: string): Promise<{
  fy0: MergeFy
  fy1: MergeFy
} | null> {
  const auth = await holeYahooFinanceAuth()
  if (!auth) return null
  const u = new URL(`https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}`)
  u.searchParams.set('modules', 'earningsTrend')
  u.searchParams.set('crumb', auth.crumb)
  const res = await fetch(u.toString(), {
    headers: { ...YAHOO_FINANCE_FETCH_HEADERS, Cookie: auth.cookie },
    cache: 'no-store',
  })
  if (!res.ok) return null

  const j = (await res.json()) as {
    quoteSummary?: { result?: Array<{ earningsTrend?: { trend?: TrendZeile[] } }> }
  }
  const trend = j.quoteSummary?.result?.[0]?.earningsTrend?.trend ?? []
  const fy0 = trend.find((t) => t.period === '0y')
  const fy1 = trend.find((t) => t.period === '+1y')
  if (!fy0 && !fy1) return null

  function ausTrend(row: TrendZeile | undefined): MergeFy {
    if (!row) {
      return { jahr: null, umsatzMio: null, eps: null, umsatzWachstumPct: null, epsWachstumPct: null }
    }
    const revEst = row.revenueEstimate as Record<string, unknown> | undefined
    const epsEst = row.earningsEstimate as Record<string, unknown> | undefined
    const end = row.endDate as { fmt?: string } | undefined
    const jahr = end?.fmt?.match(/^(\d{4})/)?.[1] ? Number(end.fmt.slice(0, 4)) : null
    const rev = rawUnix(revEst?.avg)
    const rg = rawUnix(revEst?.growth)
    const eg = rawUnix(epsEst?.growth)
    return {
      jahr,
      umsatzMio: rev != null ? rev / 1_000_000 : null,
      eps: rawUnix(epsEst?.avg),
      umsatzWachstumPct: rg != null ? rg * 100 : null,
      epsWachstumPct: eg != null ? eg * 100 : null,
    }
  }

  return { fy0: ausTrend(fy0), fy1: ausTrend(fy1) }
}

function leererJahresEintrag(jahr: number): StockanalysisJahresForecastEintrag {
  return {
    jahr,
    periodenEnde: `${jahr}-12-31`,
    umsatzUsd: null,
    operatingIncomeUsd: null,
    ebitdaUsd: null,
    netIncomeUsd: null,
    freeCashFlowUsd: null,
    grossProfitUsd: null,
    eps: null,
    gaapEps: null,
    adjustedEps: null,
    grossMarginPct: null,
    revenueGrowthPct: null,
    epsGrowthPct: null,
    istSchätzung: true,
  }
}

function hatJahresWert(e: StockanalysisJahresForecastEintrag): boolean {
  return (
    e.umsatzUsd != null ||
    e.operatingIncomeUsd != null ||
    e.ebitdaUsd != null ||
    e.netIncomeUsd != null ||
    e.freeCashFlowUsd != null ||
    e.grossProfitUsd != null ||
    e.eps != null
  )
}

function ergaenzeWachstumAusReihe(eintraege: StockanalysisJahresForecastEintrag[]): void {
  for (let i = 1; i < eintraege.length; i++) {
    const prev = eintraege[i - 1]!
    const cur = eintraege[i]!
    if (cur.revenueGrowthPct == null) {
      cur.revenueGrowthPct = wachstumPct(cur.umsatzUsd, prev.umsatzUsd)
    }
    if (cur.epsGrowthPct == null) {
      cur.epsGrowthPct = wachstumPct(cur.eps, prev.eps)
    }
  }
}

/** Bruttogewinn-Schätzung aus Umsatz × letzter bekannter Bruttomarge. */
function ergaenzeBruttogewinnAusMarge(eintraege: StockanalysisJahresForecastEintrag[]): void {
  let lastMargin: number | null = null
  for (const e of eintraege) {
    if (e.grossMarginPct != null && Number.isFinite(e.grossMarginPct)) {
      lastMargin = e.grossMarginPct > 1.5 ? e.grossMarginPct / 100 : e.grossMarginPct
    } else if (
      e.grossProfitUsd != null &&
      e.umsatzUsd != null &&
      e.umsatzUsd > 0 &&
      e.grossProfitUsd > 0
    ) {
      lastMargin = e.grossProfitUsd / e.umsatzUsd
    }
    if (e.grossProfitUsd == null && e.umsatzUsd != null && lastMargin != null && lastMargin > 0 && lastMargin < 1) {
      e.grossProfitUsd = e.umsatzUsd * lastMargin
      if (e.grossMarginPct == null) e.grossMarginPct = lastMargin * 100
    }
  }
}

/** EPS aus Nettogewinn, wenn Jahr mit bekannter Gewinn/Aktie als Referenz (z. B. FY26E → FY27/28E). */
function ergaenzeEpsAusNetIncome(eintraege: StockanalysisJahresForecastEintrag[]): void {
  const ref = eintraege.find(
    (e) =>
      e.eps != null &&
      e.eps > 0 &&
      e.netIncomeUsd != null &&
      e.netIncomeUsd > 0,
  )
  if (!ref?.eps || !ref.netIncomeUsd) return
  const aktien = ref.netIncomeUsd / ref.eps
  if (!Number.isFinite(aktien) || aktien < 1e6) return

  for (const e of eintraege) {
    if (e.eps != null || e.netIncomeUsd == null || e.netIncomeUsd <= 0) continue
    const eps = e.netIncomeUsd / aktien
    if (!Number.isFinite(eps) || eps <= 0) continue
    if (ref.eps > 0 && (eps < ref.eps * 0.4 || eps > ref.eps * 2.5)) continue
    e.eps = eps
    e.adjustedEps = eps
  }
}

function wsKennzahlMio(ws: EarningsSchaetzungen | null, schluessel: string): number | null {
  const v = ws?.kennzahlen.find((k) => k.schluessel === schluessel)?.spanne.average
  return v != null && Number.isFinite(v) ? v : null
}

/** Eine Quelle → eine Jahresreihe. Kein Feld-Mix über Anbieter. */
function mergeJahresSchaetzungen(opts: {
  stockanalysis: StockanalysisJahresForecast | null
  marketscreener: MarketscreenerJahresForecast | null
  finnhub: FinnhubJahresForecast | null
  wallstreet: EarningsSchaetzungen | null
  yahoo: { fy0: MergeFy; fy1: MergeFy } | null
}): StockanalysisJahresForecastEintrag[] {
  const byJahr = new Map<number, StockanalysisJahresForecastEintrag>()
  const minJahr = fruehestesSchaetzJahr()

  for (const e of opts.stockanalysis?.jahresreihe?.filter((x) => x.istSchätzung && x.jahr >= minJahr) ?? []) {
    byJahr.set(e.jahr, { ...e })
  }

  const saReferenzUmsatz =
    opts.stockanalysis?.umsatzUsdFy0 ??
    opts.stockanalysis?.jahresreihe?.find((e) => e.umsatzUsd != null && e.umsatzUsd >= 1e9)?.umsatzUsd ??
    null

  for (const ms of opts.marketscreener?.jahresreihe ?? []) {
    if (ms.jahr <= 2000 || ms.jahr < minJahr) continue
    const umsatzOk =
      ms.umsatzUsd == null || marketscreenerUmsatzPlausibel(ms.umsatzUsd, saReferenzUmsatz)
    if (!umsatzOk && ms.netIncomeUsd == null && ms.operatingIncomeUsd == null && ms.ebitdaUsd == null) {
      continue
    }
    const cur = byJahr.get(ms.jahr) ?? leererJahresEintrag(ms.jahr)
    if (umsatzOk && cur.umsatzUsd == null && ms.umsatzUsd != null) cur.umsatzUsd = ms.umsatzUsd
    if (cur.netIncomeUsd == null && ms.netIncomeUsd != null) cur.netIncomeUsd = ms.netIncomeUsd
    if (cur.operatingIncomeUsd == null && ms.operatingIncomeUsd != null) {
      cur.operatingIncomeUsd = ms.operatingIncomeUsd
    }
    if (cur.ebitdaUsd == null && ms.ebitdaUsd != null) cur.ebitdaUsd = ms.ebitdaUsd
    byJahr.set(ms.jahr, cur)
  }

  for (const fh of opts.finnhub?.jahresreihe ?? []) {
    if (fh.jahr < minJahr) continue
    const cur = byJahr.get(fh.jahr) ?? leererJahresEintrag(fh.jahr)
    if (cur.umsatzUsd == null && fh.umsatzUsd != null) cur.umsatzUsd = fh.umsatzUsd
    if (cur.eps == null && fh.eps != null) cur.eps = fh.eps
    byJahr.set(fh.jahr, cur)
  }

  const wsJahr = opts.wallstreet?.jahr
  if (wsJahr != null && wsJahr > 2000 && wsJahr >= minJahr) {
    const cur = byJahr.get(wsJahr) ?? leererJahresEintrag(wsJahr)
    if (cur.eps == null) {
      const eps = wsKennzahlMio(opts.wallstreet, 'eps')
      if (eps != null) cur.eps = eps
    }
    if (cur.operatingIncomeUsd == null) {
      const ebitMio = wsKennzahlMio(opts.wallstreet, 'ebit')
      if (ebitMio != null) cur.operatingIncomeUsd = ebitMio * 1_000_000
    }
    if (cur.freeCashFlowUsd == null) {
      const fcfMio = wsKennzahlMio(opts.wallstreet, 'free_cashflow')
      if (fcfMio != null) cur.freeCashFlowUsd = fcfMio * 1_000_000
    }
    if (cur.umsatzUsd == null && opts.wallstreet?.umsatz.average != null) {
      cur.umsatzUsd = opts.wallstreet.umsatz.average
    }
    byJahr.set(wsJahr, cur)
  }

  for (const yf of [opts.yahoo?.fy0, opts.yahoo?.fy1]) {
    if (!yf?.jahr || yf.jahr <= 2000 || yf.jahr < minJahr) continue
    const cur = byJahr.get(yf.jahr) ?? leererJahresEintrag(yf.jahr)
    if (cur.umsatzUsd == null && yf.umsatzMio != null) cur.umsatzUsd = yf.umsatzMio * 1_000_000
    if (cur.eps == null && yf.eps != null) cur.eps = yf.eps
    if (cur.revenueGrowthPct == null && yf.umsatzWachstumPct != null) {
      cur.revenueGrowthPct = yf.umsatzWachstumPct
    }
    if (cur.epsGrowthPct == null && yf.epsWachstumPct != null) cur.epsGrowthPct = yf.epsWachstumPct
    byJahr.set(yf.jahr, cur)
  }

  const reihe = [...byJahr.values()]
    .filter(hatJahresWert)
    .filter((e) => e.jahr >= minJahr)
    .sort((a, b) => a.jahr - b.jahr)
  ergaenzeEpsAusNetIncome(reihe)
  ergaenzeWachstumAusReihe(reihe)
  ergaenzeBruttogewinnAusMarge(reihe)
  return reihe
}

function jahrAusSchaetzungsLabel(label: string): number | null {
  const m = label.match(/FY(\d{2})E/i)
  if (m) return 2000 + Number(m[1])
  const qm = label.match(/^(\d{4}) Q\d/i)
  return qm ? Number(qm[1]) : null
}

function jahrAusSchaetzungIso(iso: string): number | null {
  const m = iso.match(/^__fy(\d{4})e__$/)
  if (m) return Number(m[1])
  const qm = iso.match(/^__(\d{4})q[1-4]e__$/)
  return qm ? Number(qm[1]) : null
}

/** Kalenderjahre mit mindestens einem Ist-Wert in den Macrotrends-Zeilen. */
export function historischeJahreMitDaten(
  historisch: Pick<{ perioden: FundamentalPeriode[]; zeilen: FundamentalMetrikZeile[] }, 'perioden' | 'zeilen'>,
): Set<number> {
  const jahre = new Set<number>()
  for (const p of historisch.perioden) {
    if (p.istLtm || p.istSchaetzung || p.istNtm) continue
    const m = p.iso.match(/^(\d{4})-\d{2}-\d{2}$/)
    if (!m) continue
    const jahr = Number(m[1])
    const hatDaten = historisch.zeilen.some((z) => {
      if (z.istSchaetzung || z.gruppe === 'schaetzungen') return false
      const v = z.werte[p.iso]
      return v != null && Number.isFinite(v)
    })
    if (hatDaten) jahre.add(jahr)
  }
  return jahre
}

/**
 * Entfernt Schätzungs-Spalten für Jahre, die bereits als Ist-Daten in Macrotrends vorkommen
 * (z. B. FY25E wenn 2025-12-31 in GuV/CF schon befüllt ist).
 */
export function filterSchaetzungenGegenHistorisch(
  schaetzungen: FundamentalSchaetzungenRoh,
  historisch: Pick<{ perioden: FundamentalPeriode[]; zeilen: FundamentalMetrikZeile[] }, 'perioden' | 'zeilen'>,
): FundamentalSchaetzungenRoh {
  if (schaetzungen.perioden.length === 0) return schaetzungen

  const minJahr = fruehestesSchaetzJahr()
  const histJahre = historischeJahreMitDaten(historisch)

  const behalten: Array<{ jahr: number; altIso: string }> = []
  for (const p of schaetzungen.perioden) {
    const jahr = jahrAusSchaetzungsLabel(p.label) ?? jahrAusSchaetzungIso(p.iso)
    if (jahr != null && jahr < minJahr) continue
    if (jahr != null && histJahre.has(jahr)) continue
    if (jahr != null) behalten.push({ jahr, altIso: p.iso })
  }

  if (behalten.length === schaetzungen.perioden.length) return schaetzungen
  if (behalten.length === 0) return { perioden: [], zeilen: [], quelle: schaetzungen.quelle }

  const perioden: FundamentalPeriode[] = behalten.map(({ jahr }, i) => ({
    iso: fundamentalSchaetzungIso(jahr, i),
    label: periodEndLabel(jahr, `FY${i}E`),
    istSchaetzung: true,
  }))

  const isoMap = new Map(behalten.map((b, i) => [b.altIso, perioden[i]!.iso]))
  const zeilen = schaetzungen.zeilen.map((z) => {
    const werte: Record<string, number | null> = {}
    for (const [altIso, neuIso] of isoMap) {
      werte[neuIso] = z.werte[altIso] ?? null
    }
    return { ...z, werte }
  })

  return { perioden, zeilen, quelle: schaetzungen.quelle }
}

/**
 * Fehlende absolute EPS-Schätzungen aus letztem Ist-EPS × EPS-Wachstum ableiten.
 * Ohne das bleibt Forward-KGV (FY26E/FY27E) leer, obwohl Umsatz (→ KUV) und Wachstum da sind.
 */
export function fuelleFehlendeEpsSchaetzungen(opts: {
  schaetzungen: FundamentalSchaetzungenRoh
  historisch: Pick<{ perioden: FundamentalPeriode[]; zeilen: FundamentalMetrikZeile[] }, 'perioden' | 'zeilen'>
  trailingEps?: number | null
  yahooFy0Eps?: number | null
  yahooFy1Eps?: number | null
  yahooFy0Jahr?: number | null
  yahooFy1Jahr?: number | null
}): FundamentalSchaetzungenRoh {
  const { schaetzungen } = opts
  if (schaetzungen.perioden.length === 0) return schaetzungen

  let epsZeile = schaetzungen.zeilen.find((z) => z.id === 'eps_schaetzung')
  const wachstumZeile = schaetzungen.zeilen.find((z) => z.id === 'eps_wachstum_schaetzung')
  const zeilen = schaetzungen.zeilen.map((z) =>
    z.id === 'eps_schaetzung' ? { ...z, werte: { ...z.werte } } : z,
  )
  if (!epsZeile) {
    epsZeile = {
      id: 'eps_schaetzung',
      label: 'EPS (Schätzung)',
      gruppe: 'schaetzungen',
      einheit: 'waehrung_usd_aktie',
      werte: Object.fromEntries(schaetzungen.perioden.map((p) => [p.iso, null])),
      istSchaetzung: true,
    }
    zeilen.push(epsZeile)
  } else {
    epsZeile = zeilen.find((z) => z.id === 'eps_schaetzung')!
  }

  const histEpsZeile = opts.historisch.zeilen.find((z) => z.id === 'eps')
  const histKeys = opts.historisch.perioden
    .filter((p) => !p.istLtm && !p.istNtm && !p.istSchaetzung && /^\d{4}-\d{2}-\d{2}$/.test(p.iso))
    .map((p) => p.iso)
  const lastHist = histKeys[histKeys.length - 1]
  const basisEps =
    (lastHist && histEpsZeile?.werte[lastHist] != null && histEpsZeile.werte[lastHist]! > 0
      ? histEpsZeile.werte[lastHist]!
      : null) ??
    (histEpsZeile?.werte[FUNDAMENTAL_TTM_KEY] != null && histEpsZeile.werte[FUNDAMENTAL_TTM_KEY]! > 0
      ? histEpsZeile.werte[FUNDAMENTAL_TTM_KEY]!
      : null) ??
    (opts.trailingEps != null && opts.trailingEps > 0 ? opts.trailingEps : null)

  // Yahoo-Absolutwerte nach Jahr zuordnen (falls vorhanden)
  for (const p of schaetzungen.perioden) {
    if (epsZeile.werte[p.iso] != null && epsZeile.werte[p.iso]! > 0) continue
    const jahr = jahrAusSchaetzungsLabel(p.label) ?? jahrAusSchaetzungIso(p.iso)
    if (jahr != null && jahr === opts.yahooFy0Jahr && opts.yahooFy0Eps != null && opts.yahooFy0Eps > 0) {
      epsZeile.werte[p.iso] = opts.yahooFy0Eps
    } else if (jahr != null && jahr === opts.yahooFy1Jahr && opts.yahooFy1Eps != null && opts.yahooFy1Eps > 0) {
      epsZeile.werte[p.iso] = opts.yahooFy1Eps
    }
  }

  let prev = basisEps
  const growthWerte = schaetzungen.perioden
    .map((p) => wachstumZeile?.werte[p.iso])
    .filter((v): v is number => v != null && Number.isFinite(v))
  const avgGrowth =
    growthWerte.length > 0 ? growthWerte.reduce((a, b) => a + b, 0) / growthWerte.length : null
  let lastGrowth: number | null = null

  for (const p of schaetzungen.perioden) {
    const vorhanden = epsZeile.werte[p.iso]
    if (vorhanden != null && vorhanden > 0) {
      prev = vorhanden
      continue
    }
    const growthPct: number | null = wachstumZeile?.werte[p.iso] ?? lastGrowth ?? avgGrowth
    if (prev == null || prev <= 0) continue
    if (growthPct == null || !Number.isFinite(growthPct)) continue
    // Wachstum: |x|≤1 → Dezimal (Yahoo 0,12 = 12 %), sonst Prozent (StockAnalysis 12 = 12 %).
    const pct = Math.abs(growthPct) <= 1 ? growthPct * 100 : growthPct
    if (!Number.isFinite(pct) || Math.abs(pct) > 75) continue
    lastGrowth = growthPct
    const faktor = 1 + pct / 100
    if (!Number.isFinite(faktor) || faktor <= 0) continue
    const next = prev * faktor
    if (!Number.isFinite(next) || next <= 0) continue
    if (!istSchaetzungZumVorjahrPlausibel(next, prev)) continue
    epsZeile.werte[p.iso] = next
    prev = next
  }

  return { ...schaetzungen, zeilen }
}

function baueRohAusJahresreihe(
  eintraege: StockanalysisJahresForecastEintrag[],
  quelle: FundamentalSchaetzungenRoh['quelle'],
): FundamentalSchaetzungenRoh {
  const schaetz = eintraege.filter((e) => e.istSchätzung)
  if (schaetz.length === 0) return { perioden: [], zeilen: [] }
  return { ...baueRohAusStockanalysisReihe(schaetz), quelle }
}

function baueRohAusStockanalysisReihe(
  eintraege: StockanalysisJahresForecastEintrag[],
): FundamentalSchaetzungenRoh {
  const minJahr = fruehestesSchaetzJahr()
  const schaetz = eintraege.filter((e) => e.istSchätzung && e.jahr >= minJahr)
  if (schaetz.length === 0) return { perioden: [], zeilen: [] }

  const perioden: FundamentalPeriode[] = schaetz.map((e, i) => ({
    iso: fundamentalSchaetzungIso(e.jahr, i),
    label: periodEndLabel(e.jahr, `FY${i}E`),
    istSchaetzung: true,
  }))

  function werteMap(
    pick: (e: StockanalysisJahresForecastEintrag) => number | null,
    skaliere?: (v: number) => number,
  ): Record<string, number | null> {
    const out: Record<string, number | null> = {}
    schaetz.forEach((e, i) => {
      const raw = pick(e)
      const iso = fundamentalSchaetzungIso(e.jahr, i)
      out[iso] = raw != null ? (skaliere ? skaliere(raw) : raw) : null
    })
    return out
  }

  const zeilen: FundamentalMetrikZeile[] = [
    {
      id: 'umsatz_schaetzung',
      label: 'Umsatz (Schätzung)',
      gruppe: 'schaetzungen',
      einheit: 'waehrung_usd_mio',
      werte: werteMap((e) => e.umsatzUsd, (v) => v / 1_000_000),
      istSchaetzung: true,
    },
    {
      id: 'ebit_schaetzung',
      label: 'EBIT (Schätzung)',
      gruppe: 'schaetzungen',
      einheit: 'waehrung_usd_mio',
      werte: werteMap((e) => e.operatingIncomeUsd, (v) => v / 1_000_000),
      istSchaetzung: true,
    },
    {
      id: 'nettogewinn_schaetzung',
      label: 'Nettogewinn (Schätzung)',
      gruppe: 'schaetzungen',
      einheit: 'waehrung_usd_mio',
      werte: werteMap((e) => e.netIncomeUsd, (v) => v / 1_000_000),
      istSchaetzung: true,
    },
    {
      id: 'fcf_schaetzung',
      label: 'Free Cashflow (Schätzung)',
      gruppe: 'schaetzungen',
      einheit: 'waehrung_usd_mio',
      werte: werteMap((e) => e.freeCashFlowUsd, (v) => v / 1_000_000),
      istSchaetzung: true,
    },
    {
      id: 'bruttogewinn_schaetzung',
      label: 'Bruttogewinn (Schätzung)',
      gruppe: 'schaetzungen',
      einheit: 'waehrung_usd_mio',
      werte: werteMap((e) => e.grossProfitUsd, (v) => v / 1_000_000),
      istSchaetzung: true,
    },
    {
      id: 'ebitda_schaetzung',
      label: 'EBITDA (Schätzung)',
      gruppe: 'schaetzungen',
      einheit: 'waehrung_usd_mio',
      werte: werteMap((e) => e.ebitdaUsd, (v) => v / 1_000_000),
      istSchaetzung: true,
    },
    {
      id: 'eps_schaetzung',
      label: 'EPS (Schätzung)',
      gruppe: 'schaetzungen',
      einheit: 'waehrung_usd_aktie',
      werte: werteMap((e) => e.eps),
      istSchaetzung: true,
    },
    {
      id: 'umsatz_wachstum_schaetzung',
      label: 'Umsatz-Wachstum (Schätzung)',
      gruppe: 'schaetzungen',
      einheit: 'prozent',
      werte: werteMap((e) => e.revenueGrowthPct),
      istSchaetzung: true,
    },
    {
      id: 'eps_wachstum_schaetzung',
      label: 'EPS-Wachstum (Schätzung)',
      gruppe: 'schaetzungen',
      einheit: 'prozent',
      werte: werteMap((e) => e.epsGrowthPct),
      istSchaetzung: true,
    },
  ]

  return { perioden, zeilen, quelle: 'stockanalysis' }
}

function baueRohAusQuartalsSchaetzungen(
  eintraege: MarketscreenerQuartalsForecastEintrag[],
): FundamentalSchaetzungenRoh {
  if (eintraege.length === 0) return { perioden: [], zeilen: [] }

  const perioden: FundamentalPeriode[] = eintraege.map((e) => ({
    iso: fundamentalQuartalSchaetzungIso(e.jahr, e.quartal),
    label: `${e.jahr} Q${e.quartal}E`,
    istSchaetzung: true,
  }))

  function werteMap(
    pick: (e: MarketscreenerQuartalsForecastEintrag) => number | null,
    skaliere?: (v: number) => number,
  ): Record<string, number | null> {
    const out: Record<string, number | null> = {}
    for (const e of eintraege) {
      const raw = pick(e)
      const iso = fundamentalQuartalSchaetzungIso(e.jahr, e.quartal)
      out[iso] = raw != null ? (skaliere ? skaliere(raw) : raw) : null
    }
    return out
  }

  const zeilen: FundamentalMetrikZeile[] = [
    {
      id: 'umsatz_schaetzung',
      label: 'Umsatz (Schätzung)',
      gruppe: 'schaetzungen',
      einheit: 'waehrung_usd_mio',
      werte: werteMap((e) => e.umsatzUsd, (v) => v / 1_000_000),
      istSchaetzung: true,
    },
    {
      id: 'ebit_schaetzung',
      label: 'EBIT (Schätzung)',
      gruppe: 'schaetzungen',
      einheit: 'waehrung_usd_mio',
      werte: werteMap((e) => e.operatingIncomeUsd, (v) => v / 1_000_000),
      istSchaetzung: true,
    },
    {
      id: 'ebitda_schaetzung',
      label: 'EBITDA (Schätzung)',
      gruppe: 'schaetzungen',
      einheit: 'waehrung_usd_mio',
      werte: werteMap((e) => e.ebitdaUsd, (v) => v / 1_000_000),
      istSchaetzung: true,
    },
    {
      id: 'nettogewinn_schaetzung',
      label: 'Nettogewinn (Schätzung)',
      gruppe: 'schaetzungen',
      einheit: 'waehrung_usd_mio',
      werte: werteMap((e) => e.netIncomeUsd, (v) => v / 1_000_000),
      istSchaetzung: true,
    },
  ]

  return { perioden, zeilen, quelle: 'marketscreener' }
}

function mergeSchaetzungenRoh(
  annual: FundamentalSchaetzungenRoh,
  quartals: FundamentalSchaetzungenRoh,
): FundamentalSchaetzungenRoh {
  if (quartals.perioden.length === 0) return annual
  if (annual.perioden.length === 0) return quartals

  const perioden = [...annual.perioden, ...quartals.perioden]
  const zeilen = annual.zeilen.map((z) => ({ ...z, werte: { ...z.werte } }))

  for (const qz of quartals.zeilen) {
    const az = zeilen.find((z) => z.id === qz.id)
    if (az) {
      Object.assign(az.werte, qz.werte)
    } else {
      zeilen.push({ ...qz, werte: { ...qz.werte } })
    }
  }

  const quelle =
    annual.quelle === quartals.quelle
      ? annual.quelle
      : annual.quelle && quartals.quelle
        ? 'kombiniert'
        : (annual.quelle ?? quartals.quelle)

  return { perioden, zeilen, quelle }
}

function mitQuartalsSchaetzungen(
  annual: FundamentalSchaetzungenRoh,
  quartals: MarketscreenerQuartalsForecastEintrag[] | null,
): FundamentalSchaetzungenRoh {
  if (!quartals?.length) return annual
  return mergeSchaetzungenRoh(annual, baueRohAusQuartalsSchaetzungen(quartals))
}

function schaetzReiheAusSa(sa: StockanalysisJahresForecast | null): StockanalysisJahresForecastEintrag[] {
  const minJahr = fruehestesSchaetzJahr()
  const ausSerie = (sa?.jahresreihe ?? []).filter(
    (e) => e.istSchätzung && e.jahr >= minJahr && hatJahresWert(e),
  )
  if (ausSerie.length > 0) return ausSerie.map((e) => ({ ...e }))
  if (!sa) return []
  const kopf: StockanalysisJahresForecastEintrag[] = []
  if (sa.fy0Jahr != null && sa.fy0Jahr >= minJahr) {
    const e = leererJahresEintrag(sa.fy0Jahr)
    e.umsatzUsd = sa.umsatzUsdFy0
    e.eps = sa.epsFy0
    e.revenueGrowthPct = sa.umsatzWachstumFy0Pct
    e.epsGrowthPct = sa.epsWachstumFy0Pct
    if (hatJahresWert(e)) kopf.push(e)
  }
  if (sa.fy1Jahr != null && sa.fy1Jahr >= minJahr) {
    const e = leererJahresEintrag(sa.fy1Jahr)
    e.umsatzUsd = sa.umsatzUsdFy1
    e.eps = sa.epsFy1
    e.revenueGrowthPct = sa.umsatzWachstumFy1Pct
    e.epsGrowthPct = sa.epsWachstumFy1Pct
    if (hatJahresWert(e)) kopf.push(e)
  }
  return kopf
}

function rohAusEinerQuelle(
  reihe: StockanalysisJahresForecastEintrag[],
  quelle: NonNullable<FundamentalSchaetzungenRoh['quelle']>,
  quartals: MarketscreenerQuartalsForecastEintrag[] | null,
): FundamentalSchaetzungenRoh {
  if (reihe.length === 0) return { perioden: [], zeilen: [] }
  const annual = baueRohAusJahresreihe(reihe, quelle)
  if (quelle === 'marketscreener' && quartals?.length) {
    return mitQuartalsSchaetzungen(annual, quartals)
  }
  return annual
}

export async function ladeFundamentalSchaetzungen(
  anfrage: FundamentalSchaetzungenAnfrage | string,
): Promise<FundamentalSchaetzungenRoh> {
  const opts: FundamentalSchaetzungenAnfrage =
    typeof anfrage === 'string' ? { symbol: anfrage } : anfrage
  const symbol = opts.symbol.trim()
  if (!symbol) return { perioden: [], zeilen: [] }

  const isin = opts.isin?.trim().toUpperCase() ?? ''
  const name = opts.name?.trim() ?? ''
  const ticker = opts.ticker?.trim() ?? ''

  const leer = { stockanalysis: null, marketscreener: null, finnhub: null, wallstreet: null, yahoo: null }

  const stockanalysis = await ladeStockanalysisJahresForecast({
    symbolYahoo: symbol,
    ticker: ticker || undefined,
    firmenname: name || undefined,
    isin: isin || undefined,
  }).catch(() => null)
  const saReihe = schaetzReiheAusSa(stockanalysis)
  if (saReihe.length > 0) return rohAusEinerQuelle(saReihe, 'stockanalysis', null)

  let quartalsReihe: MarketscreenerQuartalsForecastEintrag[] | null = null
  if (isin.length >= 10) {
    const [marketscreener, quartals] = await Promise.all([
      ladeMarketscreenerJahresForecast(isin, name, symbol).catch(() => null),
      ladeMarketscreenerQuartalsForecastReihe(isin, name, symbol).catch(() => null),
    ])
    quartalsReihe = quartals
    const msReihe = mergeJahresSchaetzungen({ ...leer, marketscreener })
    if (msReihe.length > 0) return rohAusEinerQuelle(msReihe, 'marketscreener', quartalsReihe)
  }

  const [finnhub, wallstreet, yahoo] = await Promise.all([
    ladeFinnhubJahresForecast(symbol).catch(() => null),
    isin.length >= 10 ? ladeWallstreetEarningsSchaetzungen(isin, name).catch(() => null) : Promise.resolve(null),
    ladeYahooTrend(symbol).catch(() => null),
  ])

  const fhReihe = mergeJahresSchaetzungen({ ...leer, finnhub })
  if (fhReihe.length > 0) return rohAusEinerQuelle(fhReihe, 'finnhub', null)

  const wsReihe = mergeJahresSchaetzungen({ ...leer, wallstreet })
  if (wsReihe.length > 0) return rohAusEinerQuelle(wsReihe, 'wallstreet', null)

  const yReihe = mergeJahresSchaetzungen({ ...leer, yahoo })
  if (yReihe.length > 0) return rohAusEinerQuelle(yReihe, 'yahoo', null)

  if (quartalsReihe?.length) return baueRohAusQuartalsSchaetzungen(quartalsReihe)
  return { perioden: [], zeilen: [] }
}
