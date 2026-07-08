/** Segment-Margen aus Operating Income + Umsatz (ohne server-only). */

import type { SecSegmentHistorie } from '@/lib/portfolio-analyse/fundamentaldaten-erweitert-types'

export function normalisiereSegmentname(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

export function segmentNamenPassen(a: string, b: string): boolean {
  const na = normalisiereSegmentname(a)
  const nb = normalisiereSegmentname(b)
  if (!na || !nb) return false
  if (na === nb) return true
  if (na.includes(nb) || nb.includes(na)) return true
  const wa = na.split(/\s+/).filter((w) => w.length > 2)
  const wb = nb.split(/\s+/).filter((w) => w.length > 2)
  if (wa.length === 0 || wb.length === 0) return false
  const overlap = wa.filter((w) => wb.includes(w)).length
  return overlap >= Math.min(2, Math.min(wa.length, wb.length))
}

export function berechneSegmentMargePct(umsatzMio: number | null, oiMio: number | null): number | null {
  if (umsatzMio == null || oiMio == null || umsatzMio === 0) return null
  return Math.round((oiMio / umsatzMio) * 1000) / 10
}

/** Operating-Income-Historie (OI in operatingIncomeMio) in Umsatz-Historie einmischen. */
export function ergaenzeSegmentHistorieMitMargen(
  umsatz: SecSegmentHistorie,
  oi: SecSegmentHistorie | null,
): SecSegmentHistorie {
  if (!oi) return umsatz

  return {
    ...umsatz,
    jahre: umsatz.jahre.map((j) => {
      const oiJahr = oi.jahre.find((x) => x.jahr === j.jahr)
      return {
        ...j,
        segmente: j.segmente.map((s) => {
          const oiSeg = oiJahr?.segmente.find((o) => segmentNamenPassen(o.name, s.name))
          const oiMio = oiSeg?.operatingIncomeMio ?? oiSeg?.umsatzMio ?? null
          const margePct = berechneSegmentMargePct(s.umsatzMio, oiMio)
          if (oiMio == null && margePct == null) return s
          return { ...s, operatingIncomeMio: oiMio, margePct }
        }),
      }
    }),
  }
}
