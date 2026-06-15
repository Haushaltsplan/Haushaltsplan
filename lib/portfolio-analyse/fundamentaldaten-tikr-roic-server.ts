import 'server-only'

import type { FundamentalFrequenz, FundamentalMetrikZeile, FundamentalPeriode } from '@/lib/portfolio-analyse/fundamentaldaten-types'
import { FUNDAMENTAL_TTM_KEY } from '@/lib/portfolio-analyse/fundamentaldaten-types'
import {
  ladeMacrotrendsChartSerie,
  type MacrotrendsIdent,
} from '@/lib/portfolio-analyse/macrotrends-scraper-server'
import { ladeYahooBalanceSheetHistorie } from '@/lib/portfolio-analyse/yahoo-balance-sheet-historie-server'

export type TikrRoicErgebnis = {
  wert: number | null
  nm: boolean
}

/** Tikr: EBIT / (EK + Schulden + latente Steuern NC + latente Steuern C). NM wenn Nenner ≤ 0 oder ROIC < −300 %. */
export function berechneTikrRoicPct(
  ebitUsd: number | null,
  equityUsd: number | null,
  debtUsd: number | null,
  dtlNonCurrentUsd: number | null,
  dtlCurrentUsd: number | null,
): TikrRoicErgebnis {
  if (ebitUsd == null || !Number.isFinite(ebitUsd)) return { wert: null, nm: false }

  const equity = equityUsd ?? 0
  const debt = debtUsd ?? 0
  const dtlNc = dtlNonCurrentUsd ?? 0
  const dtlC = dtlCurrentUsd ?? 0
  const denom = equity + debt + dtlNc + dtlC
  if (denom <= 0) return { wert: null, nm: true }

  const roic = (ebitUsd / denom) * 100
  if (roic < -300) return { wert: null, nm: true }
  return { wert: roic, nm: false }
}

function bilanzFuerPeriode(
  bilanz: Awaited<ReturnType<typeof ladeYahooBalanceSheetHistorie>>,
  iso: string,
): (typeof bilanz)[number] | null {
  const exact = bilanz.find((b) => b.datum === iso)
  if (exact) return exact

  const ziel = new Date(`${iso}T12:00:00Z`).getTime()
  let best: (typeof bilanz)[number] | null = null
  let bestDiff = Infinity
  for (const b of bilanz) {
    const diff = Math.abs(new Date(`${b.datum}T12:00:00Z`).getTime() - ziel)
    if (diff < bestDiff && diff <= 120 * 86400000) {
      best = b
      bestDiff = diff
    }
  }
  return best
}

type MacrotrendsBilanzFallback = Map<
  string,
  { equityUsd: number | null; debtUsd: number | null }
>

async function ladeMacrotrendsBilanzFallback(
  ident: MacrotrendsIdent,
  frequenz: FundamentalFrequenz = 'jahr',
): Promise<MacrotrendsBilanzFallback> {
  const [equitySerie, ltDebtSerie, stDebtSerie] = await Promise.all([
    ladeMacrotrendsChartSerie(ident, 'total-share-holder-equity', 'balance-sheet', frequenz),
    ladeMacrotrendsChartSerie(ident, 'long-term-debt', 'balance-sheet', frequenz),
    ladeMacrotrendsChartSerie(ident, 'short-term-debt', 'balance-sheet', frequenz),
  ])

  const out: MacrotrendsBilanzFallback = new Map()
  const allDates = new Set([
    ...equitySerie.map((p) => p.datum),
    ...ltDebtSerie.map((p) => p.datum),
    ...stDebtSerie.map((p) => p.datum),
  ])

  const byDate = (serie: typeof equitySerie) => new Map(serie.map((p) => [p.datum, p.wert]))

  for (const iso of allDates) {
    const eqMio = byDate(equitySerie).get(iso)
    const ltMio = byDate(ltDebtSerie).get(iso)
    const stMio = byDate(stDebtSerie).get(iso)
    const debtMio = ltMio != null || stMio != null ? (ltMio ?? 0) + (stMio ?? 0) : null
    out.set(iso, {
      equityUsd: eqMio != null ? eqMio * 1_000_000 : null,
      debtUsd: debtMio != null ? debtMio * 1_000_000 : null,
    })
  }
  return out
}

function mtBilanzFuerPeriode(
  mt: MacrotrendsBilanzFallback,
  iso: string,
): { equityUsd: number | null; debtUsd: number | null } | null {
  const exact = mt.get(iso)
  if (exact) return exact

  const ziel = new Date(`${iso}T12:00:00Z`).getTime()
  let best: { equityUsd: number | null; debtUsd: number | null } | null = null
  let bestDiff = Infinity
  for (const [datum, snap] of mt) {
    const diff = Math.abs(new Date(`${datum}T12:00:00Z`).getTime() - ziel)
    if (diff < bestDiff && diff <= 120 * 86400000) {
      best = snap
      bestDiff = diff
    }
  }
  return best
}

/** Ersetzt/ergänzt die `roi`-Zeile mit Tikr-ROIC (EBIT / Investiertes Kapital). */
export async function ergaenzeTikrRoicZeile(opts: {
  zeilen: FundamentalMetrikZeile[]
  perioden: FundamentalPeriode[]
  symbolYahoo: string | null | undefined
  macrotrendsIdent?: MacrotrendsIdent | null
  frequenz?: FundamentalFrequenz
}): Promise<boolean> {
  const ebitZeile = opts.zeilen.find((z) => z.id === 'ebit')
  if (!ebitZeile) return false

  const sym = opts.symbolYahoo?.trim()
  const freq = opts.frequenz ?? 'jahr'
  const [bilanz, mtBilanz] = await Promise.all([
    sym ? ladeYahooBalanceSheetHistorie(sym) : Promise.resolve([]),
    opts.macrotrendsIdent ? ladeMacrotrendsBilanzFallback(opts.macrotrendsIdent, freq) : Promise.resolve(new Map()),
  ])

  const fyPerioden = opts.perioden.filter((p) => !p.istSchaetzung && !p.istLtm)
  const werte: Record<string, number | null> = {}
  const nmWerte: Record<string, true> = {}

  for (const p of fyPerioden) {
    const ebitMio = ebitZeile.werte[p.iso]
    if (ebitMio == null) continue
    const ebitUsd = ebitMio * 1_000_000
    const yahoo = bilanzFuerPeriode(bilanz, p.iso)
    const mt = mtBilanzFuerPeriode(mtBilanz, p.iso)

    const equityUsd = yahoo?.stockholdersEquityUsd ?? mt?.equityUsd ?? null
    const debtUsd = yahoo?.totalDebtUsd ?? mt?.debtUsd ?? null

    const { wert, nm } = berechneTikrRoicPct(
      ebitUsd,
      equityUsd,
      debtUsd,
      yahoo?.deferredTaxLiabilitiesNonCurrentUsd ?? null,
      yahoo?.deferredTaxLiabilitiesCurrentUsd ?? null,
    )
    werte[p.iso] = wert
    if (nm) nmWerte[p.iso] = true
  }

  const letzteFy = fyPerioden[fyPerioden.length - 1]
  if (letzteFy && werte[letzteFy.iso] != null) {
    werte[FUNDAMENTAL_TTM_KEY] = werte[letzteFy.iso]
  }

  if (Object.values(werte).every((v) => v == null) && Object.keys(nmWerte).length === 0) return false

  const existingRoiIdx = opts.zeilen.findIndex((z) => z.id === 'roi')
  if (existingRoiIdx >= 0) opts.zeilen.splice(existingRoiIdx, 1)

  const roiZeile: FundamentalMetrikZeile = {
    id: 'roi',
    label: 'ROIC (Tikr %)',
    gruppe: 'rentabilitaet',
    einheit: 'prozent',
    werte,
    nmWerte: Object.keys(nmWerte).length > 0 ? nmWerte : undefined,
  }

  const roaIdx = opts.zeilen.findIndex((z) => z.id === 'roa')
  if (roaIdx >= 0) opts.zeilen.splice(roaIdx + 1, 0, roiZeile)
  else opts.zeilen.push(roiZeile)

  return true
}
