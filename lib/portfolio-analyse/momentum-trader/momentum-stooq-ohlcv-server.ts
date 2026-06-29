import 'server-only'

import { teileArray } from '@/lib/portfolio-analyse/batch-hilfen'
import type { MomentumBarDaily } from '@/lib/portfolio-analyse/momentum-trader/momentum-trader-types'
import { yahooZuStooqSymbol } from '@/lib/portfolio-analyse/stooq-historie-server'

const STOOQ_HEADERS = { 'User-Agent': 'Mozilla/5.0' } as const
const BATCH_PARALLEL = 4
const CHUNK_TAGE = 800

function tagZuStooqD(tag: string): string {
  return tag.replace(/-/g, '')
}

function parseStooqDatum(raw: string): string | null {
  const s = raw.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  if (/^\d{8}$/.test(s)) {
    return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`
  }
  return null
}

function runde4(n: number): number {
  return Math.round(n * 10_000) / 10_000
}

function datumChunks(vonIso: string, bisIso: string, maxTage: number): { von: string; bis: string }[] {
  const alle: string[] = []
  const [y0, m0, d0] = vonIso.split('-').map(Number)
  const [y1, m1, d1] = bisIso.split('-').map(Number)
  const cur = new Date(y0, m0 - 1, d0)
  const end = new Date(y1, m1 - 1, d1)
  while (cur <= end) {
    const y = cur.getFullYear()
    const m = String(cur.getMonth() + 1).padStart(2, '0')
    const d = String(cur.getDate()).padStart(2, '0')
    alle.push(`${y}-${m}-${d}`)
    cur.setDate(cur.getDate() + 1)
  }
  if (alle.length <= maxTage) return [{ von: vonIso, bis: bisIso }]
  const chunks: { von: string; bis: string }[] = []
  for (let i = 0; i < alle.length; i += maxTage) {
    const slice = alle.slice(i, i + maxTage)
    chunks.push({ von: slice[0], bis: slice[slice.length - 1] })
  }
  return chunks
}

async function ladeStooqOhlcvChunk(
  stooqSymbol: string,
  yahooSymbol: string,
  vonIso: string,
  bisIso: string,
): Promise<MomentumBarDaily[]> {
  const sym = stooqSymbol.trim().toLowerCase()
  if (!sym) return []

  const u = new URL('https://stooq.com/q/d/l/')
  u.searchParams.set('s', sym)
  u.searchParams.set('i', 'd')
  u.searchParams.set('d1', tagZuStooqD(vonIso))
  u.searchParams.set('d2', tagZuStooqD(bisIso))

  try {
    const res = await fetch(u.toString(), {
      headers: STOOQ_HEADERS,
      next: { revalidate: 3600 },
    })
    if (!res.ok) return []
    const lines = (await res.text()).trim().split(/\r?\n/)
    if (lines.length < 2) return []

    const out: MomentumBarDaily[] = []
    const ySym = yahooSymbol.trim().toUpperCase()
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',')
      if (cols.length < 5) continue
      const tag = parseStooqDatum(cols[0] ?? '')
      const o = Number.parseFloat((cols[1] ?? '').replace(',', '.'))
      const h = Number.parseFloat((cols[2] ?? '').replace(',', '.'))
      const l = Number.parseFloat((cols[3] ?? '').replace(',', '.'))
      const c = Number.parseFloat((cols[4] ?? '').replace(',', '.'))
      const v = cols.length > 5 ? Number.parseFloat((cols[5] ?? '').replace(',', '.')) : 0
      if (!tag || ![o, h, l, c].every((x) => Number.isFinite(x) && x > 0)) continue
      out.push({
        symbol: ySym,
        handelstag: tag,
        open: runde4(o),
        high: runde4(h),
        low: runde4(l),
        close: runde4(c),
        adjClose: runde4(c),
        volume: Number.isFinite(v) && v > 0 ? Math.round(v) : 0,
      })
    }
    return out
  } catch {
    return []
  }
}

/** Stooq-Tageskerzen (OHLCV) für ein Yahoo-Symbol. */
export async function ladeStooqOhlcvFuerYahooSymbol(
  yahooSymbol: string,
  vonDatum: string,
  bisDatum: string,
): Promise<MomentumBarDaily[]> {
  const st = yahooZuStooqSymbol(yahooSymbol)
  if (!st) return []
  const merged = new Map<string, MomentumBarDaily>()
  for (const chunk of datumChunks(vonDatum, bisDatum, CHUNK_TAGE)) {
    const part = await ladeStooqOhlcvChunk(st, yahooSymbol, chunk.von, chunk.bis)
    for (const bar of part) merged.set(bar.handelstag, bar)
  }
  return [...merged.values()].sort((a, b) => a.handelstag.localeCompare(b.handelstag))
}

/** Batch Stooq-OHLCV für Yahoo-Symbole. */
export async function ladeStooqOhlcvBatch(
  yahooSymbols: string[],
  vonDatum: string,
  bisDatum: string,
): Promise<Map<string, MomentumBarDaily[]>> {
  const uniq = [...new Set(yahooSymbols.map((s) => s.trim().toUpperCase()).filter(Boolean))].filter(
    (s) => !s.startsWith('^') && !s.startsWith('STOOQ:'),
  )
  const out = new Map<string, MomentumBarDaily[]>()

  for (const batch of teileArray(uniq, BATCH_PARALLEL)) {
    await Promise.all(
      batch.map(async (sym) => {
        const bars = await ladeStooqOhlcvFuerYahooSymbol(sym, vonDatum, bisDatum)
        if (bars.length > 0) out.set(sym, bars)
      }),
    )
  }
  return out
}
