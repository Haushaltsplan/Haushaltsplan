/** Marketscreener finances-segments — reine Parser-Logik (ohne server-only). */

import type {
  SecSegmentEintrag,
  SecSegmentHistorie,
} from '@/lib/portfolio-analyse/fundamentaldaten-erweitert-types'

export const MS_SEGMENT_MAX_JAHRE = 10

export type MsChartRoh = {
  start: number
  currency: string
  segmente: { name: string; werte: number[] }[]
}

function decodeAttr(s: string): string {
  return s.replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
}

export function bereinigeMsSegmentname(raw: string): string {
  return raw
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\s*\([^)]*\)\s*$/g, '')
    .trim()
}

function istIgnoriertSegment(name: string): boolean {
  const n = name.toLowerCase()
  return (
    !n ||
    n === 'total' ||
    n.includes('unallocated') ||
    n.includes('elimination') ||
    n.includes('intersegment') ||
    n.includes('corporate unallocated') ||
    n === 'corporate'
  )
}

export function parseMsChart(html: string, chartId: string): MsChartRoh | null {
  const idPos = html.indexOf(`id="${chartId}"`)
  if (idPos < 0) return null
  const chunk = html.slice(idPos, idPos + 600_000)
  const attrIdx = chunk.indexOf('data-fct-attr="')
  if (attrIdx < 0 || attrIdx > 3_000) return null
  const jsonStart = attrIdx + 'data-fct-attr="'.length
  const jsonEnd = chunk.indexOf('">', jsonStart)
  if (jsonEnd < 0) return null
  try {
    const parsed = JSON.parse(decodeAttr(chunk.slice(jsonStart, jsonEnd))) as {
      start?: number
      currency?: string
      data?: Record<string, { data?: number[] }>
    }
    const start = parsed.start
    if (start == null || !parsed.data) return null
    const segmente = Object.entries(parsed.data)
      .map(([name, row]) => ({
        name: bereinigeMsSegmentname(name),
        werte: row.data ?? [],
      }))
      .filter((s) => !istIgnoriertSegment(s.name) && s.werte.some((v) => Math.abs(v) > 0))
    if (segmente.length === 0) return null
    const len = Math.max(...segmente.map((s) => s.werte.length))
    return {
      start,
      currency: parsed.currency ?? 'USD',
      segmente: segmente.map((s) => ({ ...s, werte: s.werte.slice(0, len) })),
    }
  } catch {
    return null
  }
}

function begrenzeChartRoh(chart: MsChartRoh): MsChartRoh {
  const len = Math.max(...chart.segmente.map((s) => s.werte.length))
  if (len <= MS_SEGMENT_MAX_JAHRE) return chart
  const offset = len - MS_SEGMENT_MAX_JAHRE
  return {
    ...chart,
    start: chart.start + offset,
    segmente: chart.segmente.map((s) => ({ ...s, werte: s.werte.slice(offset) })),
  }
}

export function msChartZuHistorie(
  art: SecSegmentHistorie['art'],
  chartRoh: MsChartRoh,
): SecSegmentHistorie | null {
  const chart = begrenzeChartRoh(chartRoh)
  const jahre: SecSegmentHistorie['jahre'] = []
  const jahrAnzahl = Math.max(...chart.segmente.map((s) => s.werte.length))
  if (jahrAnzahl < 1) return null
  const minSegProJahr = chart.segmente.length === 1 ? 1 : 2

  for (let i = 0; i < jahrAnzahl; i++) {
    const jahr = chart.start + i
    const segmente: SecSegmentEintrag[] = []
    for (const s of chart.segmente) {
      const roh = s.werte[i]
      if (roh == null || !Number.isFinite(roh) || roh <= 0) continue
      const umsatzMio = Math.round((roh / 1_000_000) * 10) / 10
      if (umsatzMio <= 0) continue
      segmente.push({ name: s.name, umsatzMio, anteilPct: null })
    }
    if (segmente.length < minSegProJahr) continue
    const summe = segmente.reduce((acc, x) => acc + (x.umsatzMio ?? 0), 0)
    if (summe <= 0) continue
    for (const seg of segmente) {
      seg.anteilPct = Math.round(((seg.umsatzMio ?? 0) / summe) * 1000) / 10
    }
    jahre.push({ jahr, segmente })
  }

  if (jahre.length < 1) return null
  const segmentNamen = [...new Set(jahre.flatMap((j) => j.segmente.map((s) => s.name)))].sort()
  const begrenzt = jahre.length > MS_SEGMENT_MAX_JAHRE ? jahre.slice(-MS_SEGMENT_MAX_JAHRE) : jahre
  return {
    art,
    jahre: begrenzt,
    segmentNamen,
    anzahlJahre: begrenzt.length,
    aeltestesJahr: begrenzt[0]!.jahr,
    juengstesJahr: begrenzt[begrenzt.length - 1]!.jahr,
  }
}

function parseWertAusZelle(cellHtml: string): number | null {
  const title = cellHtml.match(/title="([^"]+)"/)?.[1]
  if (title) {
    const n = Number(title.replace(/,/g, ''))
    if (Number.isFinite(n)) return n
  }
  const txt = cellHtml.replace(/<[^>]+>/g, '').trim()
  if (!txt || txt === '-' || txt === '—') return null
  const m = txt.match(/^([\d,.]+)\s*([BMK])?$/i)
  if (!m) return null
  let n = Number(m[1]!.replace(/,/g, ''))
  if (!Number.isFinite(n)) return null
  const unit = (m[2] ?? '').toUpperCase()
  if (unit === 'B') n *= 1_000_000_000
  else if (unit === 'M') n *= 1_000_000
  else if (unit === 'K') n *= 1_000
  return n
}

export function parseMsSegmentTabelle(html: string, marker: RegExp): MsChartRoh | null {
  const pos = html.search(marker)
  if (pos < 0) return null
  const block = html.slice(pos, pos + 120_000)
  const table = block.match(/<table[\s\S]*?<\/table>/i)?.[0]
  if (!table) return null

  const jahre: number[] = []
  const thead = table.match(/<thead[\s\S]*?<\/thead>/i)?.[0] ?? ''
  for (const m of thead.matchAll(/>\s*(\d{4})\s*</g)) {
    const j = Number(m[1])
    if (Number.isFinite(j) && !jahre.includes(j)) jahre.push(j)
  }
  if (jahre.length < 1) return null
  const offset = Math.max(0, jahre.length - MS_SEGMENT_MAX_JAHRE)
  const jahreBegrenzt = jahre.slice(offset)

  const segmente: MsChartRoh['segmente'] = []
  for (const tr of table.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...tr[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)]
    if (cells.length < jahre.length + 1) continue
    const label = bereinigeMsSegmentname(cells[0]![1].replace(/<[^>]+>/g, ' '))
    if (!label || istIgnoriertSegment(label) || /fiscal period/i.test(label)) continue
    const werte: number[] = []
    for (let i = 0; i < jahreBegrenzt.length; i++) {
      const v = parseWertAusZelle(cells[offset + i + 1]![1])
      werte.push(v ?? 0)
    }
    if (werte.some((v) => v > 0)) segmente.push({ name: label, werte })
  }
  if (segmente.length < 1) return null
  return { start: jahreBegrenzt[0]!, currency: 'USD', segmente }
}

function parseChartMehrereIds(html: string, ids: string[]): MsChartRoh | null {
  for (const id of ids) {
    const hit = parseMsChart(html, id)
    if (hit) return hit
  }
  return null
}

function waehleReichhaltigereHistorie(
  a: SecSegmentHistorie | null,
  b: SecSegmentHistorie | null,
): SecSegmentHistorie | null {
  if (!a) return b
  if (!b) return a
  return a.anzahlJahre >= b.anzahlJahre ? a : b
}

export function extrahiereMsSegmentHistorien(html: string): {
  produkt: SecSegmentHistorie | null
  geo: SecSegmentHistorie | null
} {
  const produktChart = parseChartMehrereIds(html, [
    'financialSegmentCA1',
    'financialSegmentLastYearChar1',
    'financialSegmentRevenueChar1',
  ])
  const geoChart = parseChartMehrereIds(html, [
    'financialSegmentCA2',
    'financialSegmentLastYearChar2',
    'financialSegmentRevenueChar2',
  ])
  const produktTable = parseMsSegmentTabelle(html, /Breakdown by Business Segment/i)
  const geoTable = parseMsSegmentTabelle(html, /Geographical breakdown of sales/i)

  return {
    produkt: waehleReichhaltigereHistorie(
      produktChart ? msChartZuHistorie('produkt', produktChart) : null,
      produktTable ? msChartZuHistorie('produkt', produktTable) : null,
    ),
    geo: waehleReichhaltigereHistorie(
      geoChart ? msChartZuHistorie('geo', geoChart) : null,
      geoTable ? msChartZuHistorie('geo', geoTable) : null,
    ),
  }
}

export function htmlHatMsSegmentDaten(html: string): boolean {
  const { produkt, geo } = extrahiereMsSegmentHistorien(html)
  return (
    (produkt?.segmentNamen.length ?? 0) >= 2 ||
    (geo?.segmentNamen.length ?? 0) >= 2 ||
    (produkt?.anzahlJahre ?? 0) >= 1 ||
    (geo?.anzahlJahre ?? 0) >= 1
  )
}
