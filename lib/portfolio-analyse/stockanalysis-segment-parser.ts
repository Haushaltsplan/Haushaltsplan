/** StockAnalysis revenue-by-segment / revenue-by-geography — Parser. */

import type { SecSegmentHistorie } from '@/lib/portfolio-analyse/fundamentaldaten-erweitert-types'

export const SA_SEGMENT_MAX_JAHRE = 10

/** Bekannte Geschäftsjahresenden (Monat 0–11). */
const FY_END_MONAT: Record<string, number> = {
  MSFT: 5,
  LIN: 11,
}

function parseUsdZuMio(s: string, signed = false): number | null {
  const raw = s.replace(/,/g, '').trim()
  const m = raw.match(/^(-?[\d.]+)\s*([BMK])?$/i)
  if (!m) return null
  let n = Number(m[1])
  if (!Number.isFinite(n) || (!signed && n <= 0)) return null
  if (signed && n === 0) return null
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

function parseSegmentTabelle(html: string, signed = false): { segmentNamen: string[]; zeilen: TabellenZeile[] } | null {
  if (!html.includes('<table') && !html.includes('<tr')) return null

  const allRows: string[][] = []
  for (const r of html.matchAll(/<tr[\s\S]*?<\/tr>/gi)) {
    const cells = [...r[0].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((c) =>
      c[1]!
        .replace(/<[^>]+>/g, '')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/\s+/g, ' ')
        .trim(),
    )
    if (cells.length >= 2) allRows.push(cells)
  }
  if (allRows.length < 3) return null

  const headerIdx = allRows.findIndex(
    (row) => /^date$/i.test(row[0] ?? '') || /^period ending$/i.test(row[0] ?? ''),
  )
  if (headerIdx < 0) return null

  const segmentNamen = allRows[headerIdx]!
    .slice(1)
    .filter((c) => c && !parseDatum(c))
  if (segmentNamen.length < 1) return null

  const zeilen: TabellenZeile[] = []
  for (const cells of allRows.slice(headerIdx + 1)) {
    const date = parseDatum(cells[0] ?? '')
    if (!date) continue
    const values = cells.slice(1, 1 + segmentNamen.length).map((c) => parseUsdZuMio(c, signed))
    const nums = values.filter((v): v is number => v != null && (signed || v > 0))
    if (nums.length < 1) continue
    zeilen.push({ date, values: values.map((v) => v ?? 0), total: nums.reduce((a, b) => a + b, 0) })
  }
  if (zeilen.length < 2) return null
  return { segmentNamen, zeilen }
}

function erkenneFyEndMonat(zeilen: TabellenZeile[], ticker?: string): number {
  const t = ticker?.trim().toUpperCase().split('.')[0]
  if (t && FY_END_MONAT[t] != null) return FY_END_MONAT[t]!

  const monatJahre = new Map<number, Set<number>>()
  for (const z of zeilen) {
    const m = z.date.getMonth()
    if (!monatJahre.has(m)) monatJahre.set(m, new Set())
    monatJahre.get(m)!.add(z.date.getFullYear())
  }
  const kandidaten = [11, 5, 8, 2]
  let bestMonat = 11
  let bestScore = -1
  for (const monat of kandidaten) {
    const score = monatJahre.get(monat)?.size ?? 0
    if (score > bestScore) {
      bestScore = score
      bestMonat = monat
    }
  }
  return bestMonat
}

function baueHistorieAusTabelle(
  tabelle: { segmentNamen: string[]; zeilen: TabellenZeile[] },
  art: 'produkt' | 'geo',
  ticker: string | undefined,
  modus: 'umsatz' | 'oi',
): SecSegmentHistorie | null {
  const fyEndMonat = erkenneFyEndMonat(tabelle.zeilen, ticker)
  const jahreMap = new Map<number, SecSegmentHistorie['jahre'][0]>()

  for (const z of tabelle.zeilen) {
    if (z.date.getMonth() !== fyEndMonat) continue
    const jahr = z.date.getFullYear()
    const segmente = tabelle.segmentNamen
      .map((name, i) => {
        const wertMio = z.values[i]
        if (wertMio == null || wertMio === 0) return null
        if (modus === 'oi') {
          return { name, umsatzMio: null, anteilPct: null, operatingIncomeMio: wertMio }
        }
        if (wertMio <= 0) return null
        return { name, umsatzMio: wertMio, anteilPct: null as number | null }
      })
      .filter((s): s is NonNullable<typeof s> => s != null)
    if (segmente.length < 1) continue
    if (modus === 'umsatz') {
      const summe = segmente.reduce((a, s) => a + (s.umsatzMio ?? 0), 0)
      if (summe <= 0) continue
      for (const s of segmente) {
        s.anteilPct = Math.round(((s.umsatzMio ?? 0) / summe) * 1000) / 10
      }
    }
    jahreMap.set(jahr, { jahr, segmente })
  }

  const jahre = [...jahreMap.values()].sort((a, b) => a.jahr - b.jahr)
  if (jahre.length < 2) return null

  const begrenzt = jahre.length > SA_SEGMENT_MAX_JAHRE ? jahre.slice(-SA_SEGMENT_MAX_JAHRE) : jahre
  const segmentNamen = [...new Set(begrenzt.flatMap((j) => j.segmente.map((s) => s.name)))].sort()
  return {
    art,
    jahre: begrenzt,
    segmentNamen,
    anzahlJahre: begrenzt.length,
    aeltestesJahr: begrenzt[0]!.jahr,
    juengstesJahr: begrenzt[begrenzt.length - 1]!.jahr,
  }
}

export function extrahiereStockanalysisOiHistorieAusHtml(
  html: string,
  ticker?: string,
): SecSegmentHistorie | null {
  if (!/operating-income-by-segment|operating income by segment/i.test(html)) return null
  const tabelle = parseSegmentTabelle(html, true)
  if (!tabelle) return null
  return baueHistorieAusTabelle(tabelle, 'produkt', ticker, 'oi')
}

export function extrahiereStockanalysisSegmentHistorieAusHtml(
  html: string,
  art: 'produkt' | 'geo' = 'produkt',
  ticker?: string,
): SecSegmentHistorie | null {
  const istGeo = art === 'geo' || /revenue-by-geography|geographic-revenue/i.test(html)
  const istSegment =
    /revenue-by-segment|revenue by segment/i.test(html) || (!istGeo && /Period Ending|>Date</i.test(html))
  if (!istSegment && !istGeo) return null

  const tabelle = parseSegmentTabelle(html)
  if (!tabelle) return null

  return baueHistorieAusTabelle(tabelle, istGeo ? 'geo' : 'produkt', ticker, 'umsatz')
}
