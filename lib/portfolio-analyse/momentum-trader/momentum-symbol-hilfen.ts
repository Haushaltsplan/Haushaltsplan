/**
 * Symbol-Auflösung für Momentum Trader.
 * EU-Ticker (NKE.DE) → US-Basis (NKE) für Earnings, Gaps und MarketBeat.
 */

import type { MomentumWatchlistEintrag } from '@/lib/portfolio-analyse/momentum-trader/momentum-trader-types'

const BOERSE_SUFFIX_RE =
  /^([A-Z0-9-]+)\.(DE|PA|AS|L|SW|HM|F|MI|MC|MU|BE|VI|WA|BR|HE|DU|SG|ST|TO|AX|NZ|US)$/i

export function basisTickerOhneBoerse(symbol: string): string {
  const s = symbol.trim().toUpperCase()
  const m = BOERSE_SUFFIX_RE.exec(s)
  return m ? m[1].toUpperCase() : s
}

export function hatBoersenSuffix(symbol: string): boolean {
  return BOERSE_SUFFIX_RE.test(symbol.trim().toUpperCase())
}

/** US-/Basis-Ticker für Earnings-Scraper (NKE.DE → NKE). */
export function momentumEarningsTicker(symbol: string): string {
  return basisTickerOhneBoerse(symbol)
}

export function normalisiereMomentumWatchlistSymbole(input: {
  symbolYahoo: string | null
  symbolCandidates: string[]
}): { symbolYahoo: string | null; symbolCandidates: string[] } {
  const roh =
    input.symbolYahoo?.trim().toUpperCase() || input.symbolCandidates[0]?.trim().toUpperCase() || null
  if (!roh) {
    return {
      symbolYahoo: input.symbolYahoo?.trim().toUpperCase() || null,
      symbolCandidates: input.symbolCandidates.map((s) => s.trim().toUpperCase()).filter(Boolean),
    }
  }

  const basis = basisTickerOhneBoerse(roh)
  const kandidaten = new Set<string>()

  for (const s of [roh, basis, ...input.symbolCandidates]) {
    const n = s?.trim().toUpperCase()
    if (n) kandidaten.add(n)
  }

  return {
    symbolYahoo: roh,
    symbolCandidates: [...kandidaten],
  }
}

export function primaeresAnzeigeSymbol(e: MomentumWatchlistEintrag): string | null {
  const eu = e.symbolCandidates.find((s) => hatBoersenSuffix(s))
  if (eu) return eu.trim().toUpperCase()
  return e.symbolYahoo?.trim().toUpperCase() || e.symbolCandidates[0]?.trim().toUpperCase() || null
}

export function primaeresEarningsSymbol(e: MomentumWatchlistEintrag): string | null {
  const sym = e.symbolYahoo?.trim().toUpperCase() || e.symbolCandidates[0]?.trim().toUpperCase() || null
  if (!sym) return null
  const euGelistet =
    hatBoersenSuffix(sym) || e.symbolCandidates.some((c) => hatBoersenSuffix(c))
  return euGelistet ? momentumEarningsTicker(sym) : sym
}

/** Alle Symbole für Bars-Sync (US + EU). */
export function momentumBarsSymboleAusWatchlist(eintraege: MomentumWatchlistEintrag[]): string[] {
  const out: string[] = []
  const add = (s: string | null | undefined) => {
    const sym = s?.trim().toUpperCase()
    if (sym && !out.includes(sym)) out.push(sym)
  }
  for (const e of eintraege) {
    add(e.symbolYahoo)
    for (const c of e.symbolCandidates) add(c)
    const basis = primaeresEarningsSymbol(e)
    add(basis)
    const anzeige = primaeresAnzeigeSymbol(e)
    add(anzeige)
  }
  return out
}

export function symbolKandidatenFuerEarnings(e: MomentumWatchlistEintrag): string[] {
  const sym = e.symbolYahoo?.trim().toUpperCase() || e.symbolCandidates[0]?.trim().toUpperCase() || null
  if (!sym) return []
  const basis = momentumEarningsTicker(sym)
  const out = [basis, sym, ...e.symbolCandidates.map((s) => s.trim().toUpperCase())]
  return [...new Set(out.filter(Boolean))]
}
