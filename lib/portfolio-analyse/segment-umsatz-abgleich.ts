/**
 * Segment-Umsätze an Konzern-Umsatz aus Finanzdaten (Macrotrends) angleichen.
 * Finanzdaten-Umsatz gilt als maßgeblich — Segmente werden proportional skaliert.
 */

import type {
  SecSegmentEintrag,
  SecSegmentHistorie,
  SecSegmentHistoriePaket,
} from '@/lib/portfolio-analyse/fundamentaldaten-erweitert-types'
import type { FundamentalMetrikZeile } from '@/lib/portfolio-analyse/fundamentaldaten-types'
import { anteileBerechnen, type SecSegmentRoh } from '@/lib/portfolio-analyse/sec-edgar-segment-extraktion'

const SUMMEN_TOLERANZ = 0.012

const GEO_KEIN_UMSATZ = /total assets|non.?current assets|property,? plant|intangible assets|goodwill\b/i

/** Segment-Jahr ↔ GuV-Jahr (Non-Dec-FY kann ±1 abweichen). */
function konzernUmsatzFuerSegmentJahr(jahr: number, umsatzProJahr: Map<number, number>): number | undefined {
  const direct = umsatzProJahr.get(jahr)
  if (direct != null && direct > 0) return direct
  for (const delta of [-1, 1] as const) {
    const alt = umsatzProJahr.get(jahr + delta)
    if (alt != null && alt > 0) return alt
  }
  return undefined
}

function segmentNamenAusJahren(jahre: SecSegmentHistorie['jahre']): string[] {
  return [...new Set(jahre.flatMap((j) => j.segmente.map((s) => s.name)))].sort()
}

export function baueUmsatzProJahrAusFinanzzeile(
  umsatzZeile: FundamentalMetrikZeile | null | undefined,
): Map<number, number> {
  const map = new Map<number, number>()
  if (!umsatzZeile) return map
  for (const [key, val] of Object.entries(umsatzZeile.werte)) {
    if (val == null || !Number.isFinite(val) || val <= 0) continue
    const m = key.match(/^(\d{4})-\d{2}-\d{2}$/)
    if (!m) continue
    map.set(Number(m[1]), val)
  }
  return map
}

export function istUmsatzGeoHistorie(hist: SecSegmentHistorie): boolean {
  if (hist.art === 'geo_assets') return false
  return !hist.segmentNamen.some((n) => GEO_KEIN_UMSATZ.test(n))
}

function skaliereSegmenteAufSumme(segmente: SecSegmentRoh[], zielSumme: number): SecSegmentRoh[] {
  const summe = segmente.reduce((s, x) => s + (x.umsatzMio ?? 0), 0)
  if (summe <= 0 || zielSumme <= 0) return segmente
  const scaled = segmente.map((s) => ({
    ...s,
    umsatzMio: Math.round(((s.umsatzMio ?? 0) * zielSumme) / summe * 10) / 10,
  }))
  const neuSumme = scaled.reduce((s, x) => s + (x.umsatzMio ?? 0), 0)
  const diff = Math.round((zielSumme - neuSumme) * 10) / 10
  if (diff !== 0 && scaled.length > 0) {
    let maxIdx = 0
    for (let i = 1; i < scaled.length; i++) {
      if ((scaled[i]!.umsatzMio ?? 0) > (scaled[maxIdx]!.umsatzMio ?? 0)) maxIdx = i
    }
    scaled[maxIdx] = {
      ...scaled[maxIdx]!,
      umsatzMio: Math.round(((scaled[maxIdx]!.umsatzMio ?? 0) + diff) * 10) / 10,
    }
  }
  return scaled
}

function eintraegeZuRoh(segmente: SecSegmentEintrag[]): SecSegmentRoh[] {
  return segmente.map((s) => ({
    name: s.name,
    umsatzMio: s.umsatzMio,
    anteilPct: s.anteilPct,
    operatingIncomeMio: s.operatingIncomeMio,
    netIncomeMio: s.netIncomeMio,
    margePct: s.margePct,
  }))
}

function rohZuEintraege(segmente: SecSegmentRoh[]): SecSegmentEintrag[] {
  return segmente.map((s) => ({
    name: s.name,
    umsatzMio: s.umsatzMio,
    anteilPct: s.anteilPct,
    operatingIncomeMio: s.operatingIncomeMio ?? null,
    netIncomeMio: s.netIncomeMio ?? null,
    margePct: s.margePct ?? null,
  }))
}

function normalisiereJahrSegmente(
  segmente: SecSegmentEintrag[],
  konzernMio: number,
): SecSegmentEintrag[] {
  const mitUmsatz = segmente.filter((s) => (s.umsatzMio ?? 0) > 0)
  if (mitUmsatz.length === 0) return segmente

  const summe = mitUmsatz.reduce((a, s) => a + (s.umsatzMio ?? 0), 0)
  if (summe <= 0) return segmente

  if (Math.abs(summe - konzernMio) / konzernMio <= SUMMEN_TOLERANZ) {
    return rohZuEintraege(anteileBerechnen(eintraegeZuRoh(mitUmsatz)))
  }

  const roh = eintraegeZuRoh(mitUmsatz)
  if (roh.length === 1) {
    roh[0] = { ...roh[0]!, umsatzMio: Math.round(konzernMio * 10) / 10, anteilPct: 100 }
    return rohZuEintraege(roh)
  }

  return rohZuEintraege(anteileBerechnen(skaliereSegmenteAufSumme(roh, konzernMio)))
}

export function normalisiereSegmentHistorieGegenUmsatz(
  hist: SecSegmentHistorie | null | undefined,
  umsatzProJahr: Map<number, number>,
  opts?: { geoUmsatzOnly?: boolean },
): SecSegmentHistorie | null {
  if (!hist?.jahre.length || umsatzProJahr.size === 0) return hist ?? null
  if (opts?.geoUmsatzOnly && !istUmsatzGeoHistorie(hist)) return hist

  const jahre = hist.jahre.map((j) => {
    const konzern = konzernUmsatzFuerSegmentJahr(j.jahr, umsatzProJahr)
    if (!konzern || konzern <= 0) return j
    return {
      jahr: j.jahr,
      segmente: normalisiereJahrSegmente(j.segmente, konzern),
    }
  })

  if (jahre.length < 1) return hist

  return {
    ...hist,
    jahre,
    segmentNamen: segmentNamenAusJahren(jahre),
    anzahlJahre: jahre.length,
    aeltestesJahr: jahre[0]!.jahr,
    juengstesJahr: jahre[jahre.length - 1]!.jahr,
  }
}

export function normalisiereSegmentPaketGegenUmsatz(
  paket: SecSegmentHistoriePaket | null | undefined,
  umsatzProJahr: Map<number, number>,
): SecSegmentHistoriePaket | null {
  if (!paket || umsatzProJahr.size === 0) return paket ?? null

  const produkt = normalisiereSegmentHistorieGegenUmsatz(paket.produkt, umsatzProJahr)
  const geo = normalisiereSegmentHistorieGegenUmsatz(paket.geo, umsatzProJahr, {
    geoUmsatzOnly: true,
  })

  if (produkt === paket.produkt && geo === paket.geo) return paket

  return {
    ...paket,
    produkt,
    geo,
  }
}

export function summeSegmentUmsatzMio(
  hist: SecSegmentHistorie | null | undefined,
  jahr: number,
): number {
  const j = hist?.jahre.find((x) => x.jahr === jahr)
  if (!j) return 0
  return j.segmente.reduce((a, s) => a + (s.umsatzMio ?? 0), 0)
}

export function pruefeSegmentPaketGegenUmsatz(
  paket: SecSegmentHistoriePaket | null | undefined,
  umsatzProJahr: Map<number, number>,
): Array<{ art: 'produkt' | 'geo'; jahr: number; segmentSum: number; konzern: number; ratio: number }> {
  const out: Array<{
    art: 'produkt' | 'geo'
    jahr: number
    segmentSum: number
    konzern: number
    ratio: number
  }> = []

  for (const art of ['produkt', 'geo'] as const) {
    const hist = paket?.[art]
    if (!hist) continue
    if (art === 'geo' && !istUmsatzGeoHistorie(hist)) continue
    for (const j of hist.jahre) {
      const konzern = konzernUmsatzFuerSegmentJahr(j.jahr, umsatzProJahr)
      if (!konzern || konzern <= 0) continue
      const segmentSum = summeSegmentUmsatzMio(hist, j.jahr)
      if (segmentSum <= 0) continue
      const ratio = segmentSum / konzern
      if (Math.abs(ratio - 1) > SUMMEN_TOLERANZ) {
        out.push({ art, jahr: j.jahr, segmentSum, konzern, ratio })
      }
    }
  }
  return out
}
