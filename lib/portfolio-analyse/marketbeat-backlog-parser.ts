/** MarketBeat financials — Parser (ohne server-only). */

import type { SecBacklogHistorie } from '@/lib/portfolio-analyse/fundamentaldaten-erweitert-types'

export const MB_BACKLOG_MAX_JAHRE = 10

const EXPLICIT_ROW_RE =
  /backlog|order\s*book|remaining\s*performance|contract\s*backlog|total\s*backlog/i
const DEFERRED_ROW_RE = /deferred\s*revenue/i

type ZeileRoh = { id: string; label: string; werte: number[] }

function zuMioUsd(raw: string): number | null {
  const n = Number(raw.replace(/,/g, ''))
  if (!Number.isFinite(n) || n <= 0) return null
  return Math.round((n / 1_000_000) * 10) / 10
}

function jahreAusAnnualSection(html: string): number[] {
  const start = html.indexOf('Annual Balance Sheet')
  if (start < 0) return []
  const chunk = html.slice(start, start + 12_000)
  const jahre: number[] = []
  for (const m of chunk.matchAll(/<th[^>]*>\s*(20\d{2})\s*<\/th>/g)) {
    const j = Number(m[1])
    if (Number.isFinite(j) && !jahre.includes(j)) jahre.push(j)
  }
  return jahre.slice(0, MB_BACKLOG_MAX_JAHRE + 6)
}

function parseAnnualRows(html: string): ZeileRoh[] {
  const start = html.indexOf('Annual Balance Sheet')
  if (start < 0) return []
  const end = html.indexOf('Quarterly Balance Sheet', start)
  const chunk = html.slice(start, end > start ? end : start + 400_000)
  const out: ZeileRoh[] = []

  for (const m of chunk.matchAll(/<tr[^>]*id="(row-[^"]+-yBal)"[\s\S]*?<\/tr>/gi)) {
    const row = m[0]
    const id = m[1]!
    const label =
      row.match(/<td[^>]*>(?:<div[^>]*><\/div>)?([^<]+)<\/td>/i)?.[1]?.replace(/\s+/g, ' ').trim() ?? ''
    if (!label) continue
    const werte = [...row.matchAll(/data-value="([^"]+)"/g)]
      .map((x) => zuMioUsd(x[1]!))
      .filter((v): v is number => v != null)
    if (werte.length >= 2) out.push({ id, label, werte })
  }
  return out
}

function mapZuHistorie(
  jahre: number[],
  werte: number[],
  art: SecBacklogHistorie['art'],
  label: string,
  quelleTag: string,
): SecBacklogHistorie | null {
  const n = Math.min(jahre.length, werte.length)
  if (n < 2) return null
  const offset = Math.max(0, n - MB_BACKLOG_MAX_JAHRE)
  const eintraege: SecBacklogHistorie['eintraege'] = []
  for (let i = offset; i < n; i++) {
    const wertMio = werte[i]
    if (wertMio == null || wertMio <= 0) continue
    eintraege.push({ jahr: jahre[i]!, wertMio })
  }
  if (eintraege.length < 2) return null
  return {
    art,
    label,
    quelleTag,
    eintraege,
    anzahlJahre: eintraege.length,
    aeltestesJahr: eintraege[0]!.jahr,
    juengstesJahr: eintraege[eintraege.length - 1]!.jahr,
  }
}

function kombiniereDeferred(current: number[], noncurrent: number[]): number[] {
  const len = Math.max(current.length, noncurrent.length)
  const out: number[] = []
  for (let i = 0; i < len; i++) out.push((current[i] ?? 0) + (noncurrent[i] ?? 0))
  return out
}

export function extrahiereMarketbeatBacklogAusHtml(html: string): SecBacklogHistorie | null {
  const jahre = jahreAusAnnualSection(html)
  if (jahre.length < 2) return null
  const rows = parseAnnualRows(html)

  const explicit = rows.filter((r) => EXPLICIT_ROW_RE.test(r.id) || EXPLICIT_ROW_RE.test(r.label))
  if (explicit.length > 0) {
    const best = explicit.sort((a, b) => b.werte.length - a.werte.length)[0]!
    const art: SecBacklogHistorie['art'] = /remaining performance|rpo/i.test(best.label) ? 'rpo' : 'backlog'
    return mapZuHistorie(jahre, best.werte, art, best.label, `MarketBeat · ${best.label}`)
  }

  const current = rows.find((r) => r.id === 'row-currentdeferredrevenue-yBal')
  const noncurrent = rows.find((r) => r.id === 'row-noncurrentdeferredrevenue-yBal')
  if (current || noncurrent) {
    return mapZuHistorie(
      jahre,
      kombiniereDeferred(current?.werte ?? [], noncurrent?.werte ?? []),
      'deferred_revenue',
      'Deferred Revenue (gesamt)',
      'MarketBeat · Current + Noncurrent Deferred Revenue',
    )
  }

  const deferredAny = rows.filter((r) => DEFERRED_ROW_RE.test(r.label))
  if (deferredAny.length > 0) {
    const best = deferredAny.sort((a, b) => b.werte.length - a.werte.length)[0]!
    return mapZuHistorie(jahre, best.werte, 'deferred_revenue', best.label, `MarketBeat · ${best.label}`)
  }

  return null
}
