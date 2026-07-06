import type { FundamentaldatenErweitert } from '@/lib/portfolio-analyse/fundamentaldaten-erweitert-types'
import type { FundamentaldatenPaket } from '@/lib/portfolio-analyse/fundamentaldaten-types'
import { FUNDAMENTAL_TTM_KEY } from '@/lib/portfolio-analyse/fundamentaldaten-types'

export type StrukturSignalSchwere = 'gut' | 'neutral' | 'warnung' | 'kritisch'

export type StrukturRisikoSignal = {
  id: string
  label: string
  wert: string
  schwere: StrukturSignalSchwere
  hinweis?: string
}

export type StrukturBilanzKennzahlen = {
  netDebtEbitda: number | null
  nettoCashMio: number | null
  goodwillAnteilPct: number | null
  capexDaRatio: number | null
  sbcVsFcfPct: number | null
  dsoAktuell: number | null
  dsoTrendDelta: number | null
  dioTrendDelta: number | null
  dpoTrendDelta: number | null
  aktienrueckkaufMio: number | null
}

export type StrukturRisikoUebersicht = {
  score: number
  scoreLabel: 'niedrig' | 'moderat' | 'erhöht' | 'hoch' | 'unbekannt'
  scoreHinweis: string
  signale: StrukturRisikoSignal[]
  bilanz: StrukturBilanzKennzahlen
  segmentKonzentrationPct: number | null
  beta: number | null
  drawdown52wPct: number | null
}

const SEGMENT_PALETTE = [
  '#f97316',
  '#22d3ee',
  '#a78bfa',
  '#34d399',
  '#f472b6',
  '#fbbf24',
  '#6366f1',
  '#94a3b8',
  '#fb7185',
  '#2dd4bf',
]

export function segmentFarben(n: number): string[] {
  return Array.from({ length: n }, (_, i) => SEGMENT_PALETTE[i % SEGMENT_PALETTE.length]!)
}

function letzterHistorischerWert(paket: FundamentaldatenPaket, zeilenId: string): number | null {
  const z = paket.zeilen.find((r) => r.id === zeilenId)
  if (!z) return null
  const ttm = z.werte[FUNDAMENTAL_TTM_KEY]
  if (ttm != null && Number.isFinite(ttm)) return ttm
  for (let i = paket.perioden.length - 1; i >= 0; i--) {
    const p = paket.perioden[i]!
    if (p.istSchaetzung || p.istNtm) continue
    const v = z.werte[p.iso]
    if (v != null && Number.isFinite(v)) return v
  }
  return null
}

function trendDeltaAusZeile(paket: FundamentaldatenPaket, zeilenId: string): number | null {
  const z = paket.zeilen.find((r) => r.id === zeilenId)
  if (!z) return null
  const werte: number[] = []
  for (let i = paket.perioden.length - 1; i >= 0 && werte.length < 2; i--) {
    const p = paket.perioden[i]!
    if (p.istSchaetzung || p.istNtm) continue
    const v = z.werte[p.iso]
    if (v != null && Number.isFinite(v)) werte.push(v)
  }
  if (werte.length < 2) return null
  return Math.round((werte[0]! - werte[1]!) * 10) / 10
}

function parseMetricZahl(wert: string): number | null {
  const s = wert
    .replace(/[x%\s$€]/g, '')
    .replace(/\./g, '')
    .replace(',', '.')
  const v = parseFloat(s)
  return Number.isFinite(v) ? v : null
}

function kmZahl(paket: FundamentaldatenPaket, id: string): number | null {
  const km = paket.keyMetrics.find((m) => m.id === id)
  return km ? parseMetricZahl(km.wert) : null
}

function kmText(paket: FundamentaldatenPaket, id: string): string | null {
  const km = paket.keyMetrics.find((m) => m.id === id)
  const w = km?.wert?.trim()
  return w && w !== '–' ? w : null
}

function bilanzKennzahlen(paket: FundamentaldatenPaket): StrukturBilanzKennzahlen {
  const cash = letzterHistorischerWert(paket, 'bargeld')
  const debt = letzterHistorischerWert(paket, 'gesamtverschuldung')
  const goodwill = letzterHistorischerWert(paket, 'goodwill')
  const assets = letzterHistorischerWert(paket, 'gesamtvermoegen')
  const sbc = letzterHistorischerWert(paket, 'sbc')
  const fcf = letzterHistorischerWert(paket, 'fcf')
  const capex = letzterHistorischerWert(paket, 'capex')
  const da = letzterHistorischerWert(paket, 'da')

  const nettoCashMio =
    cash != null && debt != null ? Math.round((cash - debt) * 10) / 10 : null

  const goodwillAnteilPct =
    goodwill != null && assets != null && assets > 0
      ? Math.round((goodwill / assets) * 1000) / 10
      : null

  const capexDaRatio =
    capex != null && da != null && Math.abs(da) > 0
      ? Math.round((Math.abs(capex) / Math.abs(da)) * 100) / 100
      : null

  const sbcVsFcfPct =
    sbc != null && fcf != null && Math.abs(fcf) >= 1
      ? Math.round((Math.abs(sbc) / Math.abs(fcf)) * 1000) / 10
      : null

  return {
    netDebtEbitda: kmZahl(paket, 'net_debt_ebitda'),
    nettoCashMio,
    goodwillAnteilPct,
    capexDaRatio,
    sbcVsFcfPct,
    dsoAktuell: letzterHistorischerWert(paket, 'dso'),
    dsoTrendDelta: trendDeltaAusZeile(paket, 'dso'),
    dioTrendDelta: trendDeltaAusZeile(paket, 'dio'),
    dpoTrendDelta: trendDeltaAusZeile(paket, 'dpo'),
    aktienrueckkaufMio: letzterHistorischerWert(paket, 'aktienrueckkauf'),
  }
}

function segmentKonzentration(erweitert: FundamentaldatenErweitert | null | undefined): number | null {
  const seg = erweitert?.secStruktur?.segmente
  if (!seg?.length) return null
  const max = Math.max(...seg.map((s) => s.anteilPct ?? 0))
  return max > 0 ? max : null
}

function drawdown52wPct(paket: FundamentaldatenPaket): number | null {
  const hoch = kmZahl(paket, '52w_hoch')
  const kurs = kmZahl(paket, 'kurs_aktuell')
  if (hoch == null || kurs == null || hoch <= 0) return null
  return Math.round(((hoch - kurs) / hoch) * 1000) / 10
}

function strukturPunkte(
  bilanz: StrukturBilanzKennzahlen,
  erweitert: FundamentaldatenErweitert | null | undefined,
  segKonz: number | null,
): number {
  let pts = 0
  const nd = bilanz.netDebtEbitda
  if (nd != null) {
    if (nd > 3.5) pts -= 4
    else if (nd > 2.5) pts -= 2
    else if (nd < 0.8) pts += 1
  } else if (bilanz.nettoCashMio != null) {
    if (bilanz.nettoCashMio > 500) pts += 1
    else if (bilanz.nettoCashMio < -2_000) pts -= 2
  }

  if (bilanz.capexDaRatio != null) {
    if (bilanz.capexDaRatio > 2.8) pts -= 1
    else if (bilanz.capexDaRatio < 1.15) pts += 1
  }

  if (bilanz.goodwillAnteilPct != null && bilanz.goodwillAnteilPct >= 35) pts -= 1
  if (segKonz != null && segKonz >= 55) pts -= 1

  const sec = erweitert?.secStruktur
  const strukturRisiko = (sec?.pensionVerpflichtungMio ?? 0) + (sec?.leaseVerpflichtungMio ?? 0)
  if (strukturRisiko > 5_000) pts -= 2
  else if (strukturRisiko > 2_000) pts -= 1

  const short = erweitert?.finviz?.shortFloatPct
  if (short != null && short >= 12) pts -= 2
  else if (short != null && short >= 8) pts -= 1

  const ins = erweitert?.insiderNetto?.nettoRichtung
  if (ins === 'verkauf') pts -= 2
  else if (ins === 'kauf') pts += 1

  if (bilanz.sbcVsFcfPct != null) {
    if (bilanz.sbcVsFcfPct >= 28) pts -= 2
    else if (bilanz.sbcVsFcfPct >= 16) pts -= 1
  }

  if (bilanz.dsoTrendDelta != null && bilanz.dsoTrendDelta >= 8) pts -= 1
  if (bilanz.dioTrendDelta != null && bilanz.dioTrendDelta >= 12) pts -= 1
  if (bilanz.dpoTrendDelta != null && bilanz.dpoTrendDelta <= -10) pts -= 1

  return Math.max(-10, Math.min(5, pts))
}

function scoreLabel(score: number): StrukturRisikoUebersicht['scoreLabel'] {
  if (score >= 75) return 'niedrig'
  if (score >= 55) return 'moderat'
  if (score >= 35) return 'erhöht'
  return 'hoch'
}

function scoreHinweis(label: StrukturRisikoUebersicht['scoreLabel']): string {
  switch (label) {
    case 'niedrig':
      return 'Kapitalstruktur, Markt- und Bilanzsignale überwiegend solide.'
    case 'moderat':
      return 'Einige Risikofaktoren — Details in den Einzelkarten prüfen.'
    case 'erhöht':
      return 'Mehrere Warnsignale bei Verschuldung, Struktur oder Markt.'
    case 'hoch':
      return 'Deutliche strukturelle Risiken — vertiefte Prüfung empfohlen.'
    default:
      return 'Zu wenig Daten für eine belastbare Gesamteinschätzung.'
  }
}

function baueSignale(
  paket: FundamentaldatenPaket,
  bilanz: StrukturBilanzKennzahlen,
  erweitert: FundamentaldatenErweitert | null | undefined,
  segKonz: number | null,
): StrukturRisikoSignal[] {
  const out: StrukturRisikoSignal[] = []

  const nd = bilanz.netDebtEbitda
  if (nd != null) {
    out.push({
      id: 'nd_ebitda',
      label: 'Net Debt / EBITDA',
      wert: `${nd.toLocaleString('de-DE', { maximumFractionDigits: 2 })}×`,
      schwere: nd > 3.5 ? 'kritisch' : nd > 2.5 ? 'warnung' : nd < 0.8 ? 'gut' : 'neutral',
    })
  } else if (bilanz.nettoCashMio != null) {
    out.push({
      id: 'net_cash',
      label: 'Netto-Cash',
      wert: `${bilanz.nettoCashMio.toLocaleString('de-DE')} Mio. USD`,
      schwere:
        bilanz.nettoCashMio > 500 ? 'gut' : bilanz.nettoCashMio < -2_000 ? 'warnung' : 'neutral',
    })
  }

  const short = erweitert?.finviz?.shortFloatPct
  if (short != null) {
    out.push({
      id: 'short',
      label: 'Short Float',
      wert: `${short.toFixed(1)} %`,
      schwere: short >= 12 ? 'kritisch' : short >= 8 ? 'warnung' : 'neutral',
      hinweis: erweitert?.finviz?.shortRatio != null ? `${erweitert.finviz.shortRatio} Tage Cover` : undefined,
    })
  }

  if (segKonz != null) {
    out.push({
      id: 'seg_konz',
      label: 'Segment-Konzentration',
      wert: `${segKonz.toFixed(0)} %`,
      schwere: segKonz >= 65 ? 'kritisch' : segKonz >= 55 ? 'warnung' : 'neutral',
    })
  }

  if (bilanz.goodwillAnteilPct != null) {
    out.push({
      id: 'goodwill',
      label: 'Goodwill / Assets',
      wert: `${bilanz.goodwillAnteilPct.toFixed(1)} %`,
      schwere: bilanz.goodwillAnteilPct >= 45 ? 'warnung' : bilanz.goodwillAnteilPct >= 35 ? 'neutral' : 'gut',
    })
  }

  const ins = erweitert?.insiderNetto
  if (ins?.nettoRichtung) {
    out.push({
      id: 'insider',
      label: 'Insider 90T',
      wert:
        ins.nettoRichtung === 'kauf'
          ? 'Netto-Kauf'
          : ins.nettoRichtung === 'verkauf'
            ? 'Netto-Verkauf'
            : 'Neutral',
      schwere:
        ins.nettoRichtung === 'kauf' ? 'gut' : ins.nettoRichtung === 'verkauf' ? 'warnung' : 'neutral',
    })
  }

  const bm = erweitert?.beatMiss
  if (bm?.agg12?.epsBeatRatePct != null) {
    out.push({
      id: 'eps_beat',
      label: 'EPS Beat 12Q',
      wert: `${Math.round(bm.agg12.epsBeatRatePct)} %`,
      schwere: bm.agg12.epsBeatRatePct >= 70 ? 'gut' : bm.agg12.epsBeatRatePct < 45 ? 'warnung' : 'neutral',
    })
  }

  const beta = kmZahl(paket, 'beta')
  if (beta != null) {
    out.push({
      id: 'beta',
      label: 'Beta (5J)',
      wert: beta.toLocaleString('de-DE', { maximumFractionDigits: 2 }),
      schwere: beta > 1.5 ? 'warnung' : beta < 0.85 ? 'neutral' : 'gut',
    })
  }

  const iv = erweitert?.optionsIv?.impliziteVolatilitaetPct
  if (iv != null) {
    out.push({
      id: 'iv',
      label: 'Impl. Volatilität',
      wert: `${iv.toFixed(1)} %`,
      schwere: iv >= 45 ? 'warnung' : iv >= 30 ? 'neutral' : 'gut',
    })
  }

  const pension = erweitert?.secStruktur?.pensionVerpflichtungMio
  if (pension != null && pension > 0) {
    out.push({
      id: 'pension',
      label: 'Pensionsverpflichtung',
      wert: `$${pension.toLocaleString('de-DE')} Mio.`,
      schwere: pension > 5_000 ? 'kritisch' : pension > 2_000 ? 'warnung' : 'neutral',
    })
  }

  return out
}

export function baueStrukturRisikoUebersicht(
  paket: FundamentaldatenPaket,
): StrukturRisikoUebersicht {
  const bilanz = bilanzKennzahlen(paket)
  const erweitert = paket.erweitert
  const segKonz = segmentKonzentration(erweitert)
  const pts = strukturPunkte(bilanz, erweitert, segKonz)
  const score = Math.max(0, Math.min(100, Math.round(50 + pts * 6)))
  const label = scoreLabel(score)

  return {
    score,
    scoreLabel: label,
    scoreHinweis: scoreHinweis(label),
    signale: baueSignale(paket, bilanz, erweitert, segKonz),
    bilanz,
    segmentKonzentrationPct: segKonz,
    beta: kmZahl(paket, 'beta'),
    drawdown52wPct: drawdown52wPct(paket),
  }
}

export type OwnershipSegment = {
  key: string
  label: string
  anteilPct: number
  farbe: string
}

export function baueOwnershipSegmente(
  erweitert: FundamentaldatenErweitert | null | undefined,
): OwnershipSegment[] {
  const h = erweitert?.holders
  const f = erweitert?.finviz

  const toPct = (v: number | null | undefined, yahooDecimal: boolean): number => {
    if (v == null || !Number.isFinite(v) || v <= 0) return 0
    if (yahooDecimal && v <= 1) return v * 100
    return v <= 100 ? v : 0
  }

  const insiderN = h?.insiderPct != null ? toPct(h.insiderPct, true) : toPct(f?.insiderOwnershipPct, false)
  const instN =
    h?.institutionenPct != null ? toPct(h.institutionenPct, true) : toPct(f?.institutionalOwnershipPct, false)
  const shortN = toPct(f?.shortFloatPct, false)
  const rest = Math.max(0, 100 - insiderN - instN - shortN)

  const raw = [
    { key: 'insider', label: 'Insider', anteilPct: insiderN },
    { key: 'inst', label: 'Institutionen', anteilPct: instN },
    { key: 'short', label: 'Short Interest', anteilPct: shortN },
    { key: 'public', label: 'Öffentlich / Float', anteilPct: rest },
  ].filter((s) => s.anteilPct >= 0.5)

  const farben = segmentFarben(raw.length)
  return raw.map((s, i) => ({ ...s, farbe: farben[i]! }))
}

export type BeatBalkenEintrag = {
  label: string
  wert: number
  farbe: string
}

export function baueBeatBalken(erweitert: FundamentaldatenErweitert | null | undefined): BeatBalkenEintrag[] {
  const bm = erweitert?.beatMiss
  if (!bm) return []
  const eintraege: BeatBalkenEintrag[] = []
  if (bm.epsBeatRatePct != null) {
    eintraege.push({ label: 'EPS 8Q', wert: bm.epsBeatRatePct, farbe: '#34d399' })
  }
  if (bm.agg12?.epsBeatRatePct != null) {
    eintraege.push({ label: 'EPS 12Q', wert: bm.agg12.epsBeatRatePct, farbe: '#2dd4bf' })
  }
  if (bm.agg20?.epsBeatRatePct != null) {
    eintraege.push({ label: 'EPS 20Q', wert: bm.agg20.epsBeatRatePct, farbe: '#14b8a6' })
  }
  if (bm.agg12?.umsatzBeatRatePct != null) {
    eintraege.push({ label: 'Umsatz 12Q', wert: bm.agg12.umsatzBeatRatePct, farbe: '#a78bfa' })
  }
  return eintraege
}

export function strukturKmText(paket: FundamentaldatenPaket, id: string): string | null {
  return kmText(paket, id)
}

export function strukturKmZahl(paket: FundamentaldatenPaket, id: string): number | null {
  return kmZahl(paket, id)
}

export function usdKompakt(v: number | null | undefined): string | null {
  if (v == null || !Number.isFinite(v)) return null
  if (Math.abs(v) >= 1_000_000_000) return `$${(v / 1_000_000_000).toFixed(2)} Mrd.`
  if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)} Mio.`
  if (Math.abs(v) >= 1_000) return `$${(v / 1_000).toFixed(0)}k`
  return `$${v.toFixed(0)}`
}

export function pctFmt(v: number | null | undefined, digits = 1): string | null {
  if (v == null || !Number.isFinite(v)) return null
  return `${v.toFixed(digits)} %`
}
