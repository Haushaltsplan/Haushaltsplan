/**
 * npx tsx --conditions=react-server --require ./scripts/mock-server-only.cjs scripts/debug-isin-resolve.ts
 */
import { readFileSync } from 'fs'
import { loeseIsinFuerTicker } from '../lib/portfolio-analyse/ticker-isin-aufloesung-server'
import { isinAusYahooSymbol, loesePortfolioIsin } from '../lib/portfolio-analyse/isin-kenntnisse'

try {
  const raw = readFileSync('.env.local', 'utf8').replace(/^\uFEFF/, '')
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^([^#=]+)=(.*)$/)
    if (!m) continue
    const k = m[1]!.trim()
    if (!k || process.env[k]) continue
    process.env[k] = m[2]!.trim().replace(/^["']|["']$/g, '')
  }
} catch {
  /* */
}

const syms = ['ELMD', 'QLYS', 'ALLE', 'HUBB', 'GE', 'IX1.F', 'IDXX', 'NS1.F', 'NSSC', 'AXON']

async function main() {
  for (const s of syms) {
    const k = isinAusYahooSymbol(s)
    const p = loesePortfolioIsin({ symbolYahoo: s, ticker: s })
    const live = await loeseIsinFuerTicker(s)
    console.log(s, { kenntnis: k, portfolio: p, live })
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
