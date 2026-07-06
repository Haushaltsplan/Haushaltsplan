/**
 * Mehrjahres-Analystenprognosen (FY0 … 2027) für den Nachkauf-Radar.
 *
 * Langfrist-Investor: Prognosen fließen moderat ein — Trend und
 * Konsistenz über mehrere Jahre, kein Trading auf Einzeljahres-Schätzungen.
 */

import type { FundamentaldatenPaket, FundamentalPeriode } from '@/lib/portfolio-analyse/fundamentaldaten-types'
import { fruehestesSchaetzJahr } from '@/lib/portfolio-analyse/fundamentaldaten-types'

const MAX_PROGNOSE_JAHR = 2027

export type JahresPrognoseZeile = {
  jahr: number
  label: string
  epsWachstumPct: number | null
  umsatzWachstumPct: number | null
}

export type NachkaufPrognoseProfil = {
  jahre: JahresPrognoseZeile[]
  anzahlJahre: number
  /** Median EPS-Wachstum über alle Schätzjahre mit Daten. */
  epsWachstumMedianPct: number | null
  /** Median Umsatz-Wachstum. */
  umsatzWachstumMedianPct: number | null
  /** Anzahl Schätzjahre mit positivem EPS-Wachstum. */
  epsJahreMitWachstum: number
  /** Spätes Schätzjahr ≥8 Pp. schwächer als erstes (Verlangsamung). */
  verlangsamung: boolean
  /** Kompakte Zeile für KI-Prompts. */
  zusammenfassung: string
}

function wertAusZeile(paket: FundamentaldatenPaket, zeilenId: string, iso: string): number | null {
  const z = paket.zeilen.find((r) => r.id === zeilenId)
  const v = z?.werte[iso]
  return v != null && Number.isFinite(v) ? v : null
}

function jahrAusSchaetzPeriode(p: FundamentalPeriode): number | null {
  const m = p.iso.match(/^__fy(\d{4})e__$/)
  if (m) return Number(m[1])
  const lm = p.label.match(/^FY(\d{2})E$/i)
  if (lm) return 2000 + Number(lm[1])
  return null
}

function median(werte: number[]): number | null {
  if (werte.length === 0) return null
  const s = [...werte].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 === 1 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2
}

/** Schätzjahre aus dem Fundamentaldaten-Paket (bereits gemerged bis 2027). */
export function extrahierePrognoseProfil(paket: FundamentaldatenPaket): NachkaufPrognoseProfil | null {
  const minJahr = fruehestesSchaetzJahr()
  const schaetzPerioden = paket.perioden
    .filter((p) => p.istSchaetzung)
    .map((p) => ({ p, jahr: jahrAusSchaetzPeriode(p) }))
    .filter((x): x is { p: FundamentalPeriode; jahr: number } =>
      x.jahr != null && x.jahr >= minJahr && x.jahr <= MAX_PROGNOSE_JAHR,
    )
    .sort((a, b) => a.jahr - b.jahr)

  if (schaetzPerioden.length === 0) return null

  const jahre: JahresPrognoseZeile[] = schaetzPerioden.map(({ p, jahr }) => ({
    jahr,
    label: p.label || `FY${String(jahr).slice(2)}E`,
    epsWachstumPct: wertAusZeile(paket, 'eps_wachstum_schaetzung', p.iso),
    umsatzWachstumPct: wertAusZeile(paket, 'umsatz_wachstum_schaetzung', p.iso),
  }))

  const epsWerte = jahre.map((j) => j.epsWachstumPct).filter((v): v is number => v != null)
  const umsWerte = jahre.map((j) => j.umsatzWachstumPct).filter((v): v is number => v != null)
  const epsMedian = median(epsWerte)
  const umsMedian = median(umsWerte)
  const epsJahreMitWachstum = epsWerte.filter((v) => v > 0).length

  let verlangsamung = false
  if (epsWerte.length >= 2) {
    const erstes = epsWerte[0]!
    const letztes = epsWerte[epsWerte.length - 1]!
    if (erstes - letztes >= 8) verlangsamung = true
  }

  return {
    jahre,
    anzahlJahre: jahre.length,
    epsWachstumMedianPct: epsMedian != null ? Math.round(epsMedian * 10) / 10 : null,
    umsatzWachstumMedianPct: umsMedian != null ? Math.round(umsMedian * 10) / 10 : null,
    epsJahreMitWachstum,
    verlangsamung,
    zusammenfassung: formatPrognoseKurz({
      jahre,
      anzahlJahre: jahre.length,
      epsWachstumMedianPct: epsMedian,
      umsatzWachstumMedianPct: umsMedian,
      epsJahreMitWachstum,
      verlangsamung,
      zusammenfassung: '',
    }),
  }
}

export function formatPrognoseKurz(prog: NachkaufPrognoseProfil): string {
  const teile = prog.jahre
    .filter((j) => j.epsWachstumPct != null || j.umsatzWachstumPct != null)
    .map((j) => {
      const eps =
        j.epsWachstumPct != null
          ? `EPS ${j.epsWachstumPct > 0 ? '+' : ''}${j.epsWachstumPct.toFixed(0)}%`
          : null
      const ums =
        j.umsatzWachstumPct != null
          ? `Ums. ${j.umsatzWachstumPct > 0 ? '+' : ''}${j.umsatzWachstumPct.toFixed(0)}%`
          : null
      return `${j.label}: ${[eps, ums].filter(Boolean).join(', ') || '–'}`
    })

  if (teile.length === 0) return 'keine Mehrjahres-Schätzungen'

  const med =
    prog.epsWachstumMedianPct != null
      ? ` · Median EPS ${prog.epsWachstumMedianPct > 0 ? '+' : ''}${prog.epsWachstumMedianPct.toFixed(1)}%`
      : ''
  const verl = prog.verlangsamung ? ' · Verlangsamung im Prognosepfad' : ''

  return teile.join(' | ') + med + verl
}

/**
 * Moderater Score-Beitrag für Langfrist-Investor (max. +2 / −2 auf Momentum).
 * Wird in berechneMomentumPunkte addiert.
 */
export function berechnePrognoseMomentumDelta(prog: NachkaufPrognoseProfil | null | undefined): number {
  if (!prog || prog.anzahlJahre < 2) return 0

  let delta = 0
  const eps = prog.epsWachstumMedianPct
  const ums = prog.umsatzWachstumMedianPct

  if (eps != null) {
    if (eps >= 10 && prog.epsJahreMitWachstum >= prog.anzahlJahre - 1) delta += 1
    else if (eps >= 6 && prog.epsJahreMitWachstum >= Math.ceil(prog.anzahlJahre / 2)) delta += 1
    else if (eps < -5) delta -= 1
    else if (eps < 0 && prog.epsJahreMitWachstum === 0) delta -= 2
  }

  if (ums != null && ums < -3 && eps != null && eps < 0) delta -= 1

  if (prog.verlangsamung && (eps == null || eps < 8)) delta -= 1

  return Math.max(-2, Math.min(2, delta))
}
