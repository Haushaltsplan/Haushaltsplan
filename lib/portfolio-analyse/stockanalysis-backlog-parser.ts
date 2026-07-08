/** StockAnalysis /metrics — RPO & Backlog (Parser). */

import type { SecBacklogHistorie } from '@/lib/portfolio-analyse/fundamentaldaten-erweitert-types'

export const SA_BACKLOG_MAX_JAHRE = 10

const RPO_LABELS = [
  'Commercial Remaining Performance Obligations',
  'Remaining Performance Obligations',
  'Total Backlog',
  'Order Backlog',
  'Contract Backlog',
] as const

function parseUsdZuMio(s: string): number | null {
  const raw = s.replace(/,/g, '').trim()
  if (!raw || /^upgrade$/i.test(raw) || raw === '-' || raw === '—') return null
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

function findeLabel(html: string): string | null {
  for (const label of RPO_LABELS) {
    if (html.includes(label)) return label
  }
  return null
}

function parseMetrikTabelle(
  html: string,
  label: string,
): { daten: { date: Date; wertMio: number }[] } | null {
  const periodIdx = html.indexOf('Period Ending')
  const labelIdx = html.indexOf(label)
  if (periodIdx < 0 || labelIdx < 0) return null

  const tableStart = html.lastIndexOf('<table', labelIdx)
  if (tableStart < 0 || tableStart > labelIdx) return null
  const tableEnd = html.indexOf('</table>', labelIdx)
  if (tableEnd < 0) return null
  const table = html.slice(tableStart, tableEnd + 8)

  const rows = [...table.matchAll(/<tr[\s\S]*?<\/tr>/gi)].map((r) => r[0])
  const headerRow = rows.find((r) => r.includes('Period Ending'))
  if (!headerRow) return null

  const dates = [...headerRow.matchAll(/>([A-Z][a-z]{2} \d{1,2}, \d{4})</g)]
    .map((m) => parseDatum(m[1]!))
    .filter((d): d is Date => d != null)
  if (dates.length < 2) return null

  const dataRowHtml = rows.find((r) => r.includes(label) && !/growth/i.test(r.replace(/<[^>]+>/g, ' ')))
  if (!dataRowHtml) return null

  const zellen = [...dataRowHtml.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((c) =>
    c[1]!.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim(),
  )
  const werte = zellen.slice(1).map((c) => parseUsdZuMio(c))

  const daten: { date: Date; wertMio: number }[] = []
  for (let i = 0; i < Math.min(dates.length, werte.length); i++) {
    const wertMio = werte[i]
    if (wertMio == null || wertMio <= 0) continue
    daten.push({ date: dates[i]!, wertMio })
  }
  if (daten.length < 2) return null
  return { daten }
}

/** Bekannte Geschäftsjahresenden (Monat 0–11) — Whitelist-Ticker mit Nicht-Kalender-FY. */
const FY_END_MONAT: Record<string, number> = {
  MSFT: 5,
}

function fyEndMonatFuerTicker(ticker: string | undefined, daten: { date: Date; wertMio: number }[]): number {
  const t = ticker?.trim().toUpperCase()
  if (t && FY_END_MONAT[t] != null) return FY_END_MONAT[t]!
  return erkenneFyEndMonat(daten)
}

function erkenneFyEndMonat(daten: { date: Date; wertMio: number }[]): number {
  const monatJahre = new Map<number, Set<number>>()
  for (const d of daten) {
    const m = d.date.getMonth()
    if (!monatJahre.has(m)) monatJahre.set(m, new Set())
    monatJahre.get(m)!.add(d.date.getFullYear())
  }
  const kandidaten = [{ monat: 11 }, { monat: 5 }, { monat: 8 }, { monat: 2 }]
  let bestMonat = 11
  let bestScore = -1
  for (const k of kandidaten) {
    const score = monatJahre.get(k.monat)?.size ?? 0
    if (score > bestScore) {
      bestScore = score
      bestMonat = k.monat
    }
  }
  return bestMonat
}

function zuJahresHistorie(
  daten: { date: Date; wertMio: number }[],
  label: string,
  ticker?: string,
): SecBacklogHistorie | null {
  const fyEndMonat = fyEndMonatFuerTicker(ticker, daten)
  const jahreMap = new Map<number, number>()
  for (const d of daten) {
    if (d.date.getMonth() !== fyEndMonat) continue
    jahreMap.set(d.date.getFullYear(), d.wertMio)
  }
  const eintraege = [...jahreMap.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([jahr, wertMio]) => ({ jahr, wertMio }))
  if (eintraege.length < 2) return null

  const begrenzt = eintraege.length > SA_BACKLOG_MAX_JAHRE ? eintraege.slice(-SA_BACKLOG_MAX_JAHRE) : eintraege
  const art: SecBacklogHistorie['art'] = /remaining performance|rpo/i.test(label)
    ? 'rpo'
    : /backlog/i.test(label)
      ? 'backlog'
      : 'rpo'

  const titel = /commercial remaining/i.test(label)
    ? 'Commercial RPO'
    : /remaining performance/i.test(label)
      ? 'Verbleibende Leistungsverpflichtungen (RPO)'
      : 'Auftragsbestand (Backlog)'

  return {
    art,
    label: titel,
    quelleTag: `StockAnalysis · ${label}`,
    eintraege: begrenzt,
    anzahlJahre: begrenzt.length,
    aeltestesJahr: begrenzt[0]!.jahr,
    juengstesJahr: begrenzt[begrenzt.length - 1]!.jahr,
  }
}

export function extrahiereStockanalysisBacklogAusHtml(html: string, ticker?: string): SecBacklogHistorie | null {
  const label = findeLabel(html)
  if (!label) return null
  const tabelle = parseMetrikTabelle(html, label)
  if (!tabelle) return null
  return zuJahresHistorie(tabelle.daten, label, ticker)
}
