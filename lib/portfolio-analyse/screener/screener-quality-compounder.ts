/**
 * Quality-Compounder-Checkliste — Schwellen unabhängig vom Hartfilter.
 * Verfehlte oder fehlende Werte bleiben sichtbar (Hinweis, kein Ausschluss).
 */

import type { ScreenerHistPunkt, ScreenerZeile } from '@/lib/portfolio-analyse/screener/screener-types'

export type QualityGruppe = 'rentabilitaet' | 'reinvestition' | 'cashflow'

export type QualityBewertung = {
  id: string
  label: string
  kurz: string
  gruppe: QualityGruppe
  soll: string
  wert: number | null
  /** true = erfüllt, false = verfehlt, null = keine Daten */
  ok: boolean | null
  text: string
}

const MAX_ROIC_PCT = 80
const MAX_IROIC_ABS = 150
const STEUER = 0.79

function runde(n: number | null, stellen = 1): number | null {
  if (n == null || !Number.isFinite(n)) return null
  const f = 10 ** stellen
  return Math.round(n * f) / f
}

function spannt(wert: number | null, min?: number, max?: number): boolean | null {
  if (wert == null || !Number.isFinite(wert)) return null
  if (min != null && wert < min) return false
  if (max != null && wert > max) return false
  return true
}

function fmtPct(v: number | null): string {
  if (v == null) return '–'
  return `${v.toLocaleString('de-DE', { maximumFractionDigits: 1 })} %`
}

function fmtX(v: number | null): string {
  if (v == null) return '–'
  return `${v.toLocaleString('de-DE', { maximumFractionDigits: 1 })}×`
}

function eintrag(teil: {
  id: string
  label: string
  kurz: string
  gruppe: QualityGruppe
  soll: string
  wert: number | null
  ok: boolean | null
  text: string
}): QualityBewertung {
  return teil
}

/** Investiertes Kapital: EK + verzinsliche Schulden − Cash/STI. */
export function investedCapitalMio(
  ekMio: number | null | undefined,
  debtMio: number | null | undefined,
  cashMio: number | null | undefined,
): number | null {
  if (ekMio == null || !Number.isFinite(ekMio)) return null
  const ic = ekMio + (debtMio ?? 0) - (cashMio ?? 0)
  return ic > 0 ? ic : null
}

export function bewerteQualityCompounder(z: ScreenerZeile): QualityBewertung[] {
  // Schein-Brutto (~100 % ohne COGS) oder fehlende Stabilität → keine ✓
  const scheinBrutto = z.bruttoMargePct != null && z.bruttoMargePct >= 99.5
  const bruttoOkRoh = scheinBrutto ? null : spannt(z.bruttoMargePct ?? null, 40)
  const bruttoOk =
    bruttoOkRoh == null
      ? null
      : z.bruttoMargeStabil === false
        ? false
        : z.bruttoMargeStabil == null
          ? null
          : bruttoOkRoh

  const epsFcf = (() => {
    const a = z.epsCagr5y
    const b = z.fcfJeAktieCagr5y
    if (a == null && b == null) return { wert: null as number | null, ok: null as boolean | null }
    const best = a != null && b != null ? Math.max(a, b) : (a ?? b)
    return { wert: best ?? null, ok: best != null ? best > 10 : null }
  })()

  return [
    eintrag({
      id: 'iroic',
      label: 'Incremental ROIC (3–5J, ΔIC 1J versetzt)',
      kurz: 'iROIC',
      gruppe: 'rentabilitaet',
      soll: '> 18 %',
      wert: z.iroicPct ?? null,
      ok: spannt(z.iroicPct ?? null, 18),
      text: fmtPct(z.iroicPct ?? null),
    }),
    eintrag({
      id: 'roic5y',
      label: 'Hist. ROIC (5J-Schnitt)',
      kurz: 'ROIC 5J',
      gruppe: 'rentabilitaet',
      soll: '> 15 %',
      wert: z.roic5yAvgPct ?? null,
      ok: spannt(z.roic5yAvgPct ?? null, 15),
      text: fmtPct(z.roic5yAvgPct ?? null),
    }),
    eintrag({
      id: 'ispread',
      label: 'Incremental Value Spread (iROIC − WACC)',
      kurz: 'i-Spread',
      gruppe: 'rentabilitaet',
      soll: '> 10 Pp.',
      wert: z.incrementalValueSpreadPct ?? null,
      ok: spannt(z.incrementalValueSpreadPct ?? null, 10),
      text: fmtPct(z.incrementalValueSpreadPct ?? null),
    }),
    eintrag({
      id: 'brutto',
      label: 'Bruttomarge (stabil 5–10J)',
      kurz: 'Brutto',
      gruppe: 'rentabilitaet',
      soll: '> 40 %',
      wert: z.bruttoMargePct ?? null,
      ok: bruttoOk,
      text:
        z.bruttoMargePct == null
          ? '–'
          : scheinBrutto
            ? `${fmtPct(z.bruttoMargePct)} (Schein)`
            : `${fmtPct(z.bruttoMargePct)}${z.bruttoMargeStabil === false ? ' unstabil' : z.bruttoMargeStabil ? ' stabil' : ''}`,
    }),
    eintrag({
      id: 'reinvest',
      label: 'Reinvestitionsquote (CapEx−D&A)/|FCF|',
      kurz: 'Reinvest',
      gruppe: 'reinvestition',
      soll: '> 30 %',
      wert: z.reinvestitionsquotePct ?? null,
      ok: spannt(z.reinvestitionsquotePct ?? null, 30),
      text: fmtPct(z.reinvestitionsquotePct ?? null),
    }),
    eintrag({
      id: 'umsatzCagr',
      label: 'Umsatz-CAGR 5J',
      kurz: 'Umsatz 5J',
      gruppe: 'reinvestition',
      soll: '5–15 %',
      wert: z.umsatzCagr5y,
      ok: spannt(z.umsatzCagr5y, 5, 15),
      text: fmtPct(z.umsatzCagr5y),
    }),
    eintrag({
      id: 'epsFcfCagr',
      label: 'EPS- oder FCF/Aktie-CAGR 5J',
      kurz: 'EPS/FCF 5J',
      gruppe: 'reinvestition',
      soll: '> 10 %',
      wert: epsFcf.wert,
      ok: epsFcf.ok,
      text: fmtPct(epsFcf.wert),
    }),
    eintrag({
      id: 'conv',
      label: 'FCF-Conversion (FCF / NI)',
      kurz: 'FCF/NI',
      gruppe: 'cashflow',
      soll: '> 80 %',
      wert: z.fcfConversionPct ?? null,
      ok: spannt(z.fcfConversionPct ?? null, 80),
      text: fmtPct(z.fcfConversionPct ?? null),
    }),
    eintrag({
      id: 'ndEbitda',
      label: 'Net Debt / EBITDA',
      kurz: 'ND/EBITDA',
      gruppe: 'cashflow',
      soll: '< 1,5×',
      wert: z.netDebtEbitda ?? null,
      ok: spannt(z.netDebtEbitda ?? null, undefined, 1.5),
      text: fmtX(z.netDebtEbitda ?? null),
    }),
    eintrag({
      id: 'zins',
      label: 'Zinsdeckung (EBIT / Zins)',
      kurz: 'Zins',
      gruppe: 'cashflow',
      soll: '> 10×',
      wert: z.interestCoverage ?? null,
      ok: spannt(z.interestCoverage ?? null, 10),
      text: fmtX(z.interestCoverage ?? null),
    }),
    eintrag({
      id: 'sbc',
      label: 'SBC / Operativer Cashflow',
      kurz: 'SBC/OCF',
      gruppe: 'cashflow',
      soll: '< 5 %',
      wert: z.sbcOcfPct ?? null,
      ok: spannt(z.sbcOcfPct ?? null, undefined, 5),
      text: fmtPct(z.sbcOcfPct ?? null),
    }),
  ]
}

export function qualityCompounderScore(z: ScreenerZeile): {
  ok: number
  fehl: number
  luecke: number
  n: number
} {
  const liste = bewerteQualityCompounder(z)
  let ok = 0
  let fehl = 0
  let luecke = 0
  for (const e of liste) {
    if (e.ok === true) ok++
    else if (e.ok === false) fehl++
    else luecke++
  }
  return { ok, fehl, luecke, n: liste.length }
}

export function qualityVerfehlungen(z: ScreenerZeile): QualityBewertung[] {
  return bewerteQualityCompounder(z).filter((e) => e.ok === false)
}

type IcSnap = { jahr: number; nopat: number; ic: number }

/**
 * Incremental ROIC: ΔNOPAT / ΔIC mit ΔIC um 1 Jahr versetzt.
 * IC = EK + Debt − Cash. Negative Werte bleiben sichtbar (kein Nullen).
 */
export function iroicAusJahresreihe(
  punkte: Array<{
    jahr: number
    ebitMio: number | null
    ekMio: number | null
    debtMio?: number | null
    cashMio?: number | null
  }>,
): number | null {
  const byJahr = new Map<number, IcSnap>()
  for (const p of punkte) {
    const ic = investedCapitalMio(p.ekMio, p.debtMio, p.cashMio)
    if (p.ebitMio == null || ic == null) continue
    byJahr.set(p.jahr, { jahr: p.jahr, nopat: p.ebitMio * STEUER, ic })
  }
  const jahre = [...byJahr.keys()].sort((a, b) => a - b)
  if (jahre.length < 4) return null
  const lastJahr = jahre[jahre.length - 1]!
  const last = byJahr.get(lastJahr)!

  for (const span of [5, 4, 3]) {
    const nopatStart = byJahr.get(lastJahr - span)
    const icEnd = byJahr.get(lastJahr - 1) // Lag 1J
    const icStart = byJahr.get(lastJahr - 1 - span)
    if (!nopatStart || !icEnd || !icStart) continue
    const dIc = icEnd.ic - icStart.ic
    const dNopat = last.nopat - nopatStart.nopat
    if (!(Math.abs(dIc) > 1) || !Number.isFinite(dNopat)) continue
    // Kapitalleicht / Schrumpfung: Nenner zu klein oder negativ → überspringen
    if (dIc <= 1) continue
    const pct = (dNopat / dIc) * 100
    if (!Number.isFinite(pct) || Math.abs(pct) > MAX_IROIC_ABS) continue
    return runde(pct)
  }
  return null
}

/** ROIC-5J-Schnitt: alle endlichen Werte der letzten 5 verfügbaren Jahre (inkl. ≤0). */
export function roic5ySchnitt(
  punkte: Array<{
    ebitMio: number | null
    ekMio: number | null
    debtMio?: number | null
    cashMio?: number | null
  }>,
): number | null {
  const vals: number[] = []
  for (const p of punkte) {
    const ic = investedCapitalMio(p.ekMio, p.debtMio, p.cashMio)
    if (p.ebitMio == null || ic == null) continue
    const v = ((p.ebitMio * STEUER) / ic) * 100
    if (!Number.isFinite(v)) continue
    // Cap nur für Extrem-Ausreißer in der Anzeige-Mittelung
    vals.push(Math.min(MAX_ROIC_PCT, Math.max(-MAX_ROIC_PCT, v)))
  }
  const last5 = vals.slice(-5)
  if (last5.length < 3) return null
  return runde(last5.reduce((a, b) => a + b, 0) / last5.length)
}

export function roicPctAusPunkt(p: ScreenerHistPunkt, prev?: ScreenerHistPunkt | null): number | null {
  const icNow = investedCapitalMio(p.ekMio, p.debtMio, p.cashMio)
  if (p.ebitMio == null || icNow == null) return null
  const icPrev = prev ? investedCapitalMio(prev.ekMio, prev.debtMio, prev.cashMio) : null
  const avg = icPrev != null ? (icNow + icPrev) / 2 : icNow
  if (!(avg > 0)) return null
  const v = ((p.ebitMio * STEUER) / avg) * 100
  if (!Number.isFinite(v)) return null
  if (v > MAX_ROIC_PCT) return MAX_ROIC_PCT
  if (v < -MAX_ROIC_PCT) return -MAX_ROIC_PCT
  return runde(v)
}
