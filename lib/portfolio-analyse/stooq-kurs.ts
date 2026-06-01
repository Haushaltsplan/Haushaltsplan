/** Stooq-CSV (Fallback für Werte ohne zuverlässiges Yahoo-Symbol). */
export async function ladeStooqSchlusskurs(stooqSymbol: string): Promise<number | null> {
  const sym = stooqSymbol.trim().toLowerCase()
  if (!sym) return null
  try {
    const res = await fetch(`https://stooq.com/q/l/?s=${encodeURIComponent(sym)}&f=sd2t2ohlcv&h&e=csv`, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      next: { revalidate: 300 },
    })
    if (!res.ok) return null
    const text = await res.text()
    const lines = text.trim().split(/\r?\n/)
    if (lines.length < 2) return null
    const cols = lines[lines.length - 1].split(',')
    const closeRaw = cols[6] ?? cols[cols.length - 2] ?? ''
    const close = Number.parseFloat(closeRaw.replace(',', '.'))
    return Number.isFinite(close) && close > 0 ? close : null
  } catch {
    return null
  }
}
