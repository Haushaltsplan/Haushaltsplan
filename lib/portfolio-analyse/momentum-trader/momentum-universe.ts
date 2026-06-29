import 'server-only'

/** Index-Symbole für Markt-Regime (Yahoo-Ticker). */
export const MOMENTUM_REGIME_SYMBOLS = ['^GSPC', '^IXIC', '^VIX'] as const

const KONSTITUENTEN_CSV_URL =
  'https://raw.githubusercontent.com/datasets/s-and-p-500-companies/master/data/constituents.csv'

function parseCsvZeile(zeile: string): string[] {
  const zellen: string[] = []
  let aktuell = ''
  let inAnfuehrung = false
  for (let i = 0; i < zeile.length; i++) {
    const c = zeile[i]
    if (c === '"') {
      inAnfuehrung = !inAnfuehrung
      continue
    }
    if (c === ',' && !inAnfuehrung) {
      zellen.push(aktuell)
      aktuell = ''
      continue
    }
    aktuell += c
  }
  zellen.push(aktuell)
  return zellen
}

function yahooSymbolAusCsv(symbol: string): string {
  return symbol.trim().replace(/\./g, '-')
}

/** S&P-500-Symbole für den täglichen Bars-Sync. */
export async function ladeSp500Symbole(): Promise<string[]> {
  const res = await fetch(KONSTITUENTEN_CSV_URL, {
    next: { revalidate: 86_400 },
    headers: { 'User-Agent': 'omnia/1.0 (private; momentum sp500)' },
  })
  if (!res.ok) throw new Error('S&P-Konstituenten: HTTP ' + res.status)
  const text = await res.text()
  const zeilen = text.split(/\r?\n/).filter(Boolean)
  const out: string[] = []
  for (let i = 1; i < zeilen.length; i++) {
    const z = parseCsvZeile(zeilen[i])
    const sym = z[0]?.trim()
    if (sym) out.push(yahooSymbolAusCsv(sym))
  }
  return out
}

/**
 * Standard-Universum: Regime-Indizes + S&P 500.
 * Für manuelle Tests kann die API auch eine eigene Symbol-Liste übergeben.
 */
export async function ladeMomentumUniversumSymbole(): Promise<string[]> {
  const sp500 = await ladeSp500Symbole()
  return [...new Set([...MOMENTUM_REGIME_SYMBOLS, ...sp500])]
}

/** Kleines Test-Set (schneller Sync beim ersten Ausprobieren). */
export const MOMENTUM_TEST_SYMBOLE = [
  ...MOMENTUM_REGIME_SYMBOLS,
  'AAPL',
  'MSFT',
  'NVDA',
  'META',
  'AMZN',
  'TSLA',
  'GOOGL',
] as const
