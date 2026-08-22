/**
 * Kompakte Signale aus secSegmentHistorie (Struktur & Daten) für Nachkauf-Radar.
 */

import type {
  SecSegmentHistorie,
  SecSegmentHistoriePaket,
  SecStrukturPaket,
} from '@/lib/portfolio-analyse/fundamentaldaten-erweitert-types'

export type SegmentStrukturSignale = {
  segmentKonzentrationPct: number | null
  produktTopSegmentName: string | null
  auslandsumsatzAnteilPct: number | null
  geoTopRegionName: string | null
  geoTopRegionPct: number | null
  backlogWachstumPct: number | null
  backlogLabel: string | null
  segmentShiftPct: number | null
  segmentQuelle: 'marketscreener' | 'stockanalysis' | 'mixed' | 'sec_edgar' | 'eu_urd' | null
  /** false = Segment-Konzentration nicht für Score nutzen (nur MS). */
  segmentDatenZuverlaessig: boolean
}

function maxSegmentAusJahr(historie: SecSegmentHistorie | null | undefined): {
  name: string
  anteilPct: number
} | null {
  const jahr = historie?.jahre.at(-1)
  if (!jahr?.segmente.length) return null
  let best = jahr.segmente[0]!
  for (const s of jahr.segmente) {
    if ((s.anteilPct ?? 0) > (best.anteilPct ?? 0)) best = s
  }
  if (best.anteilPct == null || best.anteilPct <= 0) return null
  return { name: best.name, anteilPct: best.anteilPct }
}

function segmentShiftYoY(historie: SecSegmentHistorie | null | undefined): number | null {
  const jahre = historie?.jahre ?? []
  if (jahre.length < 2) return null
  const neu = jahre[jahre.length - 1]!
  const alt = jahre[jahre.length - 2]!
  const topNeu = maxSegmentAusJahr({ ...historie!, jahre: [neu] })
  if (!topNeu) return null
  const altSeg = alt.segmente.find(
    (s) => s.name.toLowerCase().trim() === topNeu.name.toLowerCase().trim(),
  )
  if (altSeg?.anteilPct == null) return null
  return Math.round((topNeu.anteilPct - altSeg.anteilPct) * 10) / 10
}

function backlogWachstumPct(
  backlog: SecSegmentHistoriePaket['backlog'],
): number | null {
  const e = backlog?.eintraege ?? []
  if (e.length < 2) return null
  const neu = e[e.length - 1]!
  const alt = e[e.length - 2]!
  if (alt.wertMio <= 0) return null
  return Math.round(((neu.wertMio - alt.wertMio) / alt.wertMio) * 1000) / 10
}

function backlogTrendNegativ(backlog: SecSegmentHistoriePaket['backlog']): boolean {
  const e = backlog?.eintraege ?? []
  if (e.length < 3) return false
  const letzte = e.slice(-3)
  let neg = 0
  for (let i = 1; i < letzte.length; i++) {
    const vor = letzte[i - 1]!.wertMio
    const jetzt = letzte[i]!.wertMio
    if (vor > 0 && jetzt < vor) neg++
  }
  return neg >= 2
}

function segmentKonzentrationSec(
  segmente: { anteilPct: number | null }[] | undefined,
): number | null {
  if (!segmente?.length) return null
  const max = Math.max(...segmente.map((s) => s.anteilPct ?? 0))
  return max > 0 ? max : null
}

export function extrahiereSegmentStrukturSignale(
  secHist: SecSegmentHistoriePaket | null | undefined,
  secStruktur: SecStrukturPaket | null | undefined,
): SegmentStrukturSignale {
  const produktTop = maxSegmentAusJahr(secHist?.produkt)
  const geoTop = maxSegmentAusJahr(secHist?.geo)
  const konzAusHist = produktTop?.anteilPct ?? geoTop?.anteilPct ?? null
  const konzAusSec =
    segmentKonzentrationSec(secStruktur?.segmenteProdukt) ??
    segmentKonzentrationSec(secStruktur?.segmente) ??
    segmentKonzentrationSec(secStruktur?.segmenteGeo)

  const segmentQuelle = secHist?.quelle ?? secStruktur?.quelle ?? null
  const segmentDatenZuverlaessig =
    segmentQuelle === 'stockanalysis' || segmentQuelle === 'mixed' || segmentQuelle === 'sec_edgar'

  return {
    segmentKonzentrationPct: konzAusHist ?? konzAusSec,
    produktTopSegmentName: produktTop?.name ?? null,
    auslandsumsatzAnteilPct: secHist?.zusatz?.auslandsumsatzAnteilPct ?? null,
    geoTopRegionName: geoTop?.name ?? null,
    geoTopRegionPct: geoTop?.anteilPct ?? null,
    backlogWachstumPct: backlogWachstumPct(secHist?.backlog ?? null),
    backlogLabel: secHist?.backlog?.label ?? null,
    segmentShiftPct: segmentShiftYoY(secHist?.produkt) ?? segmentShiftYoY(secHist?.geo),
    segmentQuelle,
    segmentDatenZuverlaessig,
  }
}

export function backlogTrendSchwach(secHist: SecSegmentHistoriePaket | null | undefined): boolean {
  return backlogTrendNegativ(secHist?.backlog ?? null)
}

/** ~10 Zeilen für Deep Research / Kaufempfehlung. */
export function formatSegmentStrukturKontext(
  secHist: SecSegmentHistoriePaket | null | undefined,
  secStruktur: SecStrukturPaket | null | undefined,
): string | null {
  if (!secHist?.produkt && !secHist?.geo && !secHist?.backlog) return null
  const sig = extrahiereSegmentStrukturSignale(secHist, secStruktur)
  const zeilen: string[] = []

  if (secHist?.produkt?.jahre.length) {
    const j = secHist.produkt.jahre.at(-1)!
    const top3 = [...j.segmente]
      .sort((a, b) => (b.anteilPct ?? 0) - (a.anteilPct ?? 0))
      .slice(0, 3)
      .map((s) => `${s.name} ${s.anteilPct?.toFixed(0) ?? '?'} %`)
      .join(', ')
    zeilen.push(`Produktmix FY${j.jahr}: ${top3}`)
  }

  if (secHist?.geo?.jahre.length) {
    const j = secHist.geo.jahre.at(-1)!
    const top3 = [...j.segmente]
      .sort((a, b) => (b.anteilPct ?? 0) - (a.anteilPct ?? 0))
      .slice(0, 3)
      .map((s) => `${s.name} ${s.anteilPct?.toFixed(0) ?? '?'} %`)
      .join(', ')
    zeilen.push(`Geo-Mix FY${j.jahr}: ${top3}`)
  }

  if (sig.auslandsumsatzAnteilPct != null) {
    zeilen.push(`Auslandsumsatz-Anteil: ${sig.auslandsumsatzAnteilPct.toFixed(0)} %`)
  }

  if (secHist?.backlog?.eintraege.length) {
    const b = secHist.backlog
    const letzt = b.eintraege.at(-1)!
    const w = sig.backlogWachstumPct
    const wTxt = w != null ? ` (${w > 0 ? '+' : ''}${w.toFixed(1)} % YoY)` : ''
    zeilen.push(`${b.label} FY${letzt.jahr}: $${letzt.wertMio.toLocaleString('de-DE')} Mio.${wTxt}`)
  }

  const kunden = secHist?.zusatz?.hauptkunden?.filter((k) => k.anteilPct > 0) ?? []
  if (kunden.length) {
    zeilen.push(
      `Kundenkonzentration: ${kunden.map((k) => `${k.name} ${k.anteilPct} %`).join(', ')}`,
    )
  }

  if (sig.segmentShiftPct != null && Math.abs(sig.segmentShiftPct) >= 3) {
    zeilen.push(`Größtes Segment YoY-Verschiebung: ${sig.segmentShiftPct > 0 ? '+' : ''}${sig.segmentShiftPct.toFixed(1)} PP`)
  }

  if (zeilen.length === 0) return null
  return zeilen.join('\n')
}
