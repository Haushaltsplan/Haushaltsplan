/**
 * Stooq-Tageskurse (kostenlos, CSV) — Fallback wenn Yahoo-Lücken oder falsche Symbole.
 * https://stooq.com/db/h/
 */

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

/** Yahoo/ISIN-Kürzel → Stooq (z. B. SAP.DE → sap.de, AAPL → aapl.us). */
export function yahooZuStooqSymbol(yahoo: string): string | null {
  const s = yahoo.trim()
  if (!s || s.startsWith('STOOQ:')) return null
  const u = s.toUpperCase()
  const dot = u.lastIndexOf('.')
  if (dot > 0) {
    const base = u.slice(0, dot).toLowerCase()
    const suffix = u.slice(dot + 1).toLowerCase()
    if (suffix === 'DE' || suffix === 'F' || suffix === 'HM' || suffix === 'MU') return `${base}.de`
    if (suffix === 'PA' || suffix === 'AS' || suffix === 'BR') return `${base}.${suffix}`
    if (suffix === 'L' || suffix === 'IL') return `${base}.uk`
    if (suffix === 'SW') return `${base}.ch`
    if (suffix === 'TO') return `${base}.ca`
    if (suffix === 'SG') return `${base}.de`
    return `${base}.${suffix}`
  }
  if (u.length <= 6 && /^[A-Z]+$/.test(u)) return `${u.toLowerCase()}.us`
  return null
}

export function stooqHistorieKey(stooqSymbol: string): string {
  return `STOOQ:${stooqSymbol.trim().toLowerCase()}`
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

async function ladeStooqCsvChunk(
  stooqSymbol: string,
  vonIso: string,
  bisIso: string,
): Promise<Map<string, number>> {
  const sym = stooqSymbol.trim().toLowerCase()
  if (!sym) return new Map()

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
    if (!res.ok) return new Map()
    const text = await res.text()
    const lines = text.trim().split(/\r?\n/)
    if (lines.length < 2) return new Map()

    const out = new Map<string, number>()
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',')
      if (cols.length < 5) continue
      const datum = parseStooqDatum(cols[0] ?? '')
      const close = Number.parseFloat((cols[4] ?? '').replace(',', '.'))
      if (!datum || !Number.isFinite(close) || close <= 0) continue
      out.set(datum, Math.round(close * 10000) / 10000)
    }
    return out
  } catch {
    return new Map()
  }
}

/** Tägliche Stooq-Schlusskurse (Rohkurs, bei .de i. d. R. EUR). */
export async function ladeStooqHistorieTaeglich(
  stooqSymbol: string,
  vonDatum: string,
  bisDatum: string,
): Promise<Map<string, number>> {
  const merged = new Map<string, number>()
  for (const chunk of datumChunks(vonDatum, bisDatum, CHUNK_TAGE)) {
    const part = await ladeStooqCsvChunk(stooqSymbol, chunk.von, chunk.bis)
    for (const [tag, kurs] of part) merged.set(tag, kurs)
  }
  return merged
}

export async function ladeStooqHistorieBatchTaeglich(
  stooqSymbols: string[],
  vonDatum: string,
  bisDatum: string,
): Promise<Map<string, Map<string, number>>> {
  const uniq = [...new Set(stooqSymbols.map((s) => s.trim().toLowerCase()).filter(Boolean))]
  const out = new Map<string, Map<string, number>>()

  for (let i = 0; i < uniq.length; i += BATCH_PARALLEL) {
    const batch = uniq.slice(i, i + BATCH_PARALLEL)
    await Promise.all(
      batch.map(async (sym) => {
        const serie = await ladeStooqHistorieTaeglich(sym, vonDatum, bisDatum)
        if (serie.size > 0) out.set(stooqHistorieKey(sym), serie)
      }),
    )
  }
  return out
}
