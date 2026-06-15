import { isinKenntnis } from '@/lib/portfolio-analyse/isin-kenntnisse'

/** Symbol-Kandidaten für Beat/Miss (Finnhub, MarketBeat). */
export function beatMissSymbolKandidaten(opts: {
  ticker: string
  symbolYahoo?: string | null
  isin?: string | null
}): string[] {
  const out: string[] = []
  const add = (s: string | null | undefined) => {
    const t = s?.trim().toUpperCase()
    if (t && !out.includes(t)) out.push(t)
  }

  const sym = (opts.symbolYahoo ?? opts.ticker).trim().toUpperCase()
  add(sym)
  if (sym.includes('.')) add(sym.split('.')[0])

  const k = opts.isin?.trim() ? isinKenntnis(opts.isin.trim().toUpperCase()) : null
  if (k?.logoSymbol) add(k.logoSymbol)
  if (k?.macrotrendsTicker) add(k.macrotrendsTicker)
  for (const c of k?.symbolCandidates ?? []) add(c)
  if (k?.symbolYahoo) add(k.symbolYahoo)

  add(opts.ticker)
  return out
}
