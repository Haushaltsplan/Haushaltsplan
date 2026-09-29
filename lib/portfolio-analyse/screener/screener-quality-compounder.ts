/**
 * Quality-Compounder-Checkliste — Schwellen unabhängig vom Hartfilter.
 * Verfehlte oder fehlende Werte bleiben sichtbar (Hinweis, kein Ausschluss).
 */

import type { ScreenerZeile } from '@/lib/portfolio-analyse/screener/screener-types'

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

export function bewerteQualityCompounder(z: ScreenerZeile): QualityBewertung[] {
  const bruttoOkRoh = spannt(z.bruttoMargePct ?? null, 40)
  const bruttoOk =
    bruttoOkRoh === true && z.bruttoMargeStabil === false
      ? false
      : bruttoOkRoh === true && z.bruttoMargeStabil == null
        ? true
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
      label: 'Incremental ROIC (3–5J)',
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
          : `${fmtPct(z.bruttoMargePct)}${z.bruttoMargeStabil === false ? ' unstabil' : z.bruttoMargeStabil ? ' stabil' : ''}`,
    }),
    eintrag({
      id: 'reinvest',
      label: 'Reinvestitionsquote',
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
  return bewerteQualityCompounder(z).filter((e) => e.ok !== true)
}

export function iroicAusJahresreihe(
  punkte: Array<{ jahr: number; ebitMio: number | null; ekMio: number | null; debtMio?: number | null }>,
): number | null {
  const snaps = punkte
    .map((p) => {
      const ic = (p.ekMio ?? 0) + (p.debtMio ?? 0)
      if (p.ebitMio == null || !(ic > 0)) return null
      return { jahr: p.jahr, nopat: p.ebitMio * 0.79, ic }
    })
    .filter((s): s is { jahr: number; nopat: number; ic: number } => s != null)
  if (snaps.length < 4) return null
  const last = snaps[snaps.length - 1]!
  for (const span of [5, 4, 3]) {
    const basis = snaps.find((s) => s.jahr === last.jahr - span)
    if (!basis) continue
    const dIc = last.ic - basis.ic
    const dNopat = last.nopat - basis.nopat
    if (!(dIc > 1) || !Number.isFinite(dNopat)) continue
    const pct = (dNopat / dIc) * 100
    if (!Number.isFinite(pct) || pct <= 0 || pct > 150) continue
    return runde(pct)
  }
  return null
}

export function roic5ySchnitt(
  punkte: Array<{ ebitMio: number | null; ekMio: number | null; debtMio?: number | null }>,
): number | null {
  const vals: number[] = []
  for (const p of punkte) {
    const ic = (p.ekMio ?? 0) + (p.debtMio ?? 0)
    if (p.ebitMio == null || !(ic > 0)) continue
    const v = ((p.ebitMio * 0.79) / ic) * 100
    if (Number.isFinite(v) && v > 0 && v <= 80) vals.push(v)
  }
  const last5 = vals.slice(-5)
  if (last5.length < 3) return null
  return runde(last5.reduce((a, b) => a + b, 0) / last5.length)
}
