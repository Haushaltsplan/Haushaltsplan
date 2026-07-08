/** StockAnalysis /metrics — RPO & Backlog (Parser). */

import type { SecBacklogHistorie } from '@/lib/portfolio-analyse/fundamentaldaten-erweitert-types'

export const SA_BACKLOG_MAX_JAHRE = 10

const LABEL_RE =
  /remaining performance obligations|total backlog|order backlog|deferred revenue|contract backlog|backlog/i

function parseUsdKompakt(s: string): number | null {
  const raw = s.replace(/,/g, '').trim()
  const m = raw.match(/^([\d.]+)\s*([BMK])?$/i)
  if (!m) return null
  let n = Number(m[1])
  if (!Number.isFinite(n) || n <= 0) return null
  const u = (m[2] ?? '').toUpperCase()
  if (u === 'B') n *= 1_000_000_000
  else if (u === 'M') n *= 1_000_000
  else if (u === 'K') n *= 1_000
  return Math.round((n / 1_000_000) * 10) / 10
}

function jahreVorLabel(html: string, labelIdx: number): number[] {
  const block = html.slice(Math.max(0, labelIdx - 12_000), labelIdx)
  const years: number[] = []
  for (const m of block.matchAll(/>(20\d{2})</g)) {
    const y = Number(m[1])
    if (Number.isFinite(y) && y >= 2000 && y <= 2035 && !years.includes(y)) years.push(y)
  }
  if (years.length >= 2) return years.slice(-SA_BACKLOG_MAX_JAHRE - 4)
  for (const m of block.matchAll(/>(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+'(\d{2})</g)) {
    const yy = Number(m[2])
    const y = yy >= 70 ? 1900 + yy : 2000 + yy
    if (!years.includes(y)) years.push(y)
  }
  return years.slice(-SA_BACKLOG_MAX_JAHRE - 4)
}

export function extrahiereStockanalysisBacklogAusHtml(html: string): SecBacklogHistorie | null {
  const labelMatch = html.match(LABEL_RE)
  if (!labelMatch || labelMatch.index == null) return null

  const labelIdx = labelMatch.index
  const label = labelMatch[0]
  const rowChunk = html.slice(labelIdx, labelIdx + 12_000)
  const werteRaw = [...rowChunk.matchAll(/<td[^>]*>([\d.]+[BMK])<\/td>/gi)]
    .map((m) => parseUsdKompakt(m[1]!))
    .filter((v): v is number => v != null && v > 0)

  if (werteRaw.length < 2) return null

  const jahre = jahreVorLabel(html, labelIdx)
  const count = Math.min(Math.max(jahre.length, werteRaw.length), SA_BACKLOG_MAX_JAHRE + 4)
  const wOffset = Math.max(0, werteRaw.length - count)
  const jOffset = Math.max(0, jahre.length - count)
  const eintraege: SecBacklogHistorie['eintraege'] = []
  for (let i = 0; i < count && i + wOffset < werteRaw.length; i++) {
    const jahr = jahre[i + jOffset] ?? new Date().getFullYear() - count + i + 1
    eintraege.push({ jahr, wertMio: werteRaw[i + wOffset]! })
  }
  const begrenzt = eintraege.slice(-SA_BACKLOG_MAX_JAHRE)
  if (begrenzt.length < 2) return null

  const art: SecBacklogHistorie['art'] = /remaining performance|rpo/i.test(label)
    ? 'rpo'
    : /deferred/i.test(label)
      ? 'deferred_revenue'
      : 'backlog'

  const titel = /remaining performance/i.test(label)
    ? 'Verbleibende Leistungsverpflichtungen (RPO)'
    : /deferred/i.test(label)
      ? 'Deferred Revenue'
      : 'Auftragsbestand (Backlog)'

  return {
    art,
    label: titel,
    quelleTag: `StockAnalysis · ${label.replace(/\s+/g, ' ').trim()}`,
    eintraege: begrenzt,
    anzahlJahre: begrenzt.length,
    aeltestesJahr: begrenzt[0]!.jahr,
    juengstesJahr: begrenzt[begrenzt.length - 1]!.jahr,
  }
}
