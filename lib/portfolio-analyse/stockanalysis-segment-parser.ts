/** StockAnalysis /metrics/revenue-by-segment — Parser (TTM → Jahreswerte). */

import type { SecSegmentHistorie } from '@/lib/portfolio-analyse/fundamentaldaten-erweitert-types'

export const SA_SEGMENT_MAX_JAHRE = 10

function parseUsdZuMio(s: string): number | null {
  const raw = s.replace(/,/g, '').trim()
  const m = raw.match(/^([\d.]+)\s*([BMK])?$/i)
  if (!m) return null
  let n = Number(m[1])
  if (!Number.isFinite(n) || n <= 0) return null
  const u = (m[2] ?? '').toUpperCase()
  if (u === 'B') n *= 1_000
  else if (u === 'M') n *= 1
  else if (u === 'K') n /= 1_000
  else n /= 1_000_000
  return Math.round(n * 10) / 10
}

function parseDatum(text: string): Date | null {
  const d = new Date(text.trim())
  return Number.isFinite(d.getTime()) ? d : null
}

type TabellenZeile = { date: Date; values: number[]; total: number }

function parseSegmentTabelle(html: string): { segmentNamen: string[]; zeilen: TabellenZeile[] } | null {
  const allRows: string[][] = []
  for (const r of html.matchAll(/<tr[\s\S]*?<\/tr>/gi)) {
    const cells = [...r[0].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((c) =>
      c[1]!.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim(),
    )
    if (cells.length >= 2) allRows.push(cells)
  }
  if (allRows.length < 3) return null

  const headerIdx = allRows.findIndex((row) => /^date$/i.test(row[0] ?? ''))
  if (headerIdx < 0) return null
  const segmentNamen = allRows[headerIdx]!.slice(1).filter(Boolean)
  if (segmentNamen.length < 1) return null

  const zeilen: TabellenZeile[] = []
  for (const cells of allRows.slice(headerIdx + 1)) {
    const date = parseDatum(cells[0] ?? '')
    if (!date) continue
    const values = cells.slice(1).map((c) => parseUsdZuMio(c))
    const nums = values.filter((v): v is number => v != null && v > 0)
    if (nums.length < 1) continue
    zeilen.push({ date, values: values.map((v) => v ?? 0), total: nums.reduce((a, b) => a + b, 0) })
  }
  if (zeilen.length < 2) return null
  return { segmentNamen, zeilen }
}

/** FY-Ende = Quartal mit höchstem TTM-Umsatz je Kalenderjahr. */
function erkenneFyEndMonat(zeilen: TabellenZeile[]): number {
  const proJahr = new Map<number, TabellenZeile[]>()
  for (const z of zeilen) {
    const y = z.date.getFullYear()
    if (!proJahr.has(y)) proJahr.set(y, [])
    proJahr.get(y)!.push(z)
  }
  const monatSiege = new Map<number, number>()
  for (const jahrZeilen of proJahr.values()) {
    if (jahrZeilen.length < 2) continue
    const best = jahrZeilen.reduce((a, b) => (a.total >= b.total ? a : b))
    const m = best.date.getMonth()
    monatSiege.set(m, (monatSiege.get(m) ?? 0) + 1)
  }
  if (monatSiege.size === 0) {
    const haeufig = new Map<number, number>()
    for (const z of zeilen) haeufig.set(z.date.getMonth(), (haeufig.get(z.date.getMonth()) ?? 0) + 1)
    let best = 11
    let score = -1
    for (const [m, c] of haeufig) {
      if (c > score) {
        score = c
        best = m
      }
    }
    return best
  }
  let bestMonat = 11
  let bestScore = -1
  for (const [m, score] of monatSiege) {
    if (score > bestScore) {
      bestScore = score
      bestMonat = m
    }
  }
  return bestMonat
}

export function extrahiereStockanalysisSegmentHistorieAusHtml(html: string): SecSegmentHistorie | null {
  if (!/revenue by segment|revenue-by-segment/i.test(html)) return null
  const tabelle = parseSegmentTabelle(html)
  if (!tabelle) return null

  const fyEndMonat = erkenneFyEndMonat(tabelle.zeilen)
  const jahreMap = new Map<number, SecSegmentHistorie['jahre'][0]>()

  for (const z of tabelle.zeilen) {
    if (z.date.getMonth() !== fyEndMonat) continue
    const jahr = z.date.getFullYear()
    const segmente = tabelle.segmentNamen
      .map((name, i) => {
        const umsatzMio = z.values[i]
        if (umsatzMio == null || umsatzMio <= 0) return null
        return { name, umsatzMio, anteilPct: null as number | null }
      })
      .filter((s): s is NonNullable<typeof s> => s != null)
    if (segmente.length < 1) continue
    const summe = segmente.reduce((a, s) => a + s.umsatzMio, 0)
    if (summe <= 0) continue
    for (const s of segmente) {
      s.anteilPct = Math.round((s.umsatzMio / summe) * 1000) / 10
    }
    jahreMap.set(jahr, { jahr, segmente })
  }

  const jahre = [...jahreMap.values()].sort((a, b) => a.jahr - b.jahr)
  if (jahre.length < 2) return null

  const begrenzt = jahre.length > SA_SEGMENT_MAX_JAHRE ? jahre.slice(-SA_SEGMENT_MAX_JAHRE) : jahre
  const segmentNamen = [...new Set(begrenzt.flatMap((j) => j.segmente.map((s) => s.name)))].sort()
  return {
    art: 'produkt',
    jahre: begrenzt,
    segmentNamen,
    anzahlJahre: begrenzt.length,
    aeltestesJahr: begrenzt[0]!.jahr,
    juengstesJahr: begrenzt[begrenzt.length - 1]!.jahr,
  }
}
