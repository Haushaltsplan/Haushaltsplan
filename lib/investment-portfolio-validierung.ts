import type { PortfolioPositionMitNotiz } from '@/lib/investment-portfolio-types'

const NOTIERUNGEN = new Set(['USD', 'EUR', 'GBP', 'CHF', 'CAD'])

const SYMBOL_MUSTER = /^[A-Z0-9][A-Z0-9.-]{0,31}$/

export function normalisiereYahooSymbol(roh: string): string {
  return roh.trim().toUpperCase().replace(/\s+/g, '')
}

export function parsePortfolioApiPayload(body: unknown): { ok: true; rows: PortfolioPositionMitNotiz[] } | { ok: false; message: string } {
  if (!body || typeof body !== 'object') return { ok: false, message: 'Ungültiger Body.' }
  const positionen = (body as { positionen?: unknown }).positionen
  if (!Array.isArray(positionen)) return { ok: false, message: '„positionen“ muss ein Array sein.' }
  if (positionen.length > 120) return { ok: false, message: 'Maximal 120 Positionen.' }

  const symbole = new Set<string>()
  const rows: PortfolioPositionMitNotiz[] = []

  for (let i = 0; i < positionen.length; i++) {
    const z = positionen[i]
    if (!z || typeof z !== 'object') return { ok: false, message: `Position ${i + 1}: ungültig.` }
    const o = z as Record<string, unknown>
    const id = typeof o.id === 'string' ? o.id.trim() : ''
    const name = typeof o.name === 'string' ? o.name.trim() : ''
    const symbolYahoo = typeof o.symbolYahoo === 'string' ? normalisiereYahooSymbol(o.symbolYahoo) : ''
    let notierung = typeof o.notierung === 'string' ? o.notierung.trim().toUpperCase() : 'USD'
    const notiz = typeof o.notiz === 'string' ? o.notiz : ''

    if (!id || id.length > 128) return { ok: false, message: `Position ${i + 1}: „id“ fehlt oder zu lang.` }
    if (!name || name.length > 160) return { ok: false, message: `Position ${i + 1}: Name fehlt oder zu lang.` }
    if (!symbolYahoo || !SYMBOL_MUSTER.test(symbolYahoo)) {
      return { ok: false, message: `Position ${i + 1}: Yahoo-Symbol ungültig (${symbolYahoo || '—'}).` }
    }
    if (!NOTIERUNGEN.has(notierung)) notierung = 'USD'
    if (notiz.length > 8000) return { ok: false, message: `Position ${i + 1}: Notiz zu lang.` }

    const symKey = symbolYahoo.toUpperCase()
    if (symbole.has(symKey)) {
      return { ok: false, message: `Doppeltes Symbol: ${symbolYahoo}` }
    }
    symbole.add(symKey)

    rows.push({
      id,
      name,
      symbolYahoo,
      notierung,
      notiz,
    })
  }

  return { ok: true, rows }
}
