/**
 * Vertrags-Tests (Ticker, Whitelist) — lädt echte Module.
 * npx tsx scripts/portfolio-analyse-audit/contract.ts
 */
import { analyseTickerFuerPosition } from '../../lib/portfolio-analyse/isin-kenntnisse'
import { NACHKAUF_RADAR_WHITELIST } from '../../lib/portfolio-analyse/nachkauf-radar/nachkauf-radar-whitelist'
import { isinKenntnis } from '../../lib/portfolio-analyse/isin-kenntnisse'

type Case = { isin: string; symbol?: string | null; expect: string; label: string }

const TICKER_CASES: Case[] = [
  { isin: 'GB0004052071', symbol: 'H11.SG', expect: 'HLMA', label: 'Halma Stuttgart → HLMA' },
  { isin: 'FR0000052292', symbol: 'RMS.PA', expect: 'HESAY', label: 'Hermès → HESAY (Macrotrends ADR)' },
  { isin: 'US64110L3059', symbol: 'NFLX.DE', expect: 'NFLX', label: 'Netflix Xetra → US-Bare' },
  { isin: 'US02079K3059', symbol: 'GOOGL.DE', expect: 'GOOGL', label: 'Alphabet Xetra → GOOGL' },
  { isin: 'NL0010273215', symbol: 'ASML.AS', expect: 'ASML', label: 'ASML Amsterdam' },
  { isin: 'CA01626P1484', symbol: 'ATD.TO', expect: 'ATD', label: 'Couche-Tard logoSymbol' },
]

export type ContractFinding = {
  severity: 'error' | 'warn'
  message: string
  hint?: string
}

export function runContractTests(): ContractFinding[] {
  const findings: ContractFinding[] = []

  for (const c of TICKER_CASES) {
    const got = analyseTickerFuerPosition(c.isin, c.symbol ?? null)
    if (got !== c.expect) {
      findings.push({
        severity: 'error',
        message: `[ticker] ${c.label}: erwartet ${c.expect}, erhalten ${got}`,
        hint: 'analyseTickerFuerPosition in isin-kenntnisse.ts prüfen.',
      })
    }
  }

  for (const pos of NACHKAUF_RADAR_WHITELIST) {
    const k = isinKenntnis(pos.isin)
    const sym = k?.symbolYahoo ?? pos.symbolYahoo ?? null
    const ticker = analyseTickerFuerPosition(pos.isin, sym)
    if (!ticker || ticker.length < 1 || ticker.length > 8) {
      findings.push({
        severity: 'warn',
        message: `[whitelist] ${pos.name}: unplausibler Analyse-Ticker „${ticker}"`,
      })
    }
    // EU mit macrotrendsTicker sollte nicht H11-artige Kurs-Symbole sein
    if (k?.macrotrendsTicker && ticker !== k.macrotrendsTicker.toUpperCase()) {
      findings.push({
        severity: 'error',
        message: `[whitelist] ${pos.name}: macrotrendsTicker ${k.macrotrendsTicker} ≠ analyse ${ticker}`,
      })
    }
  }

  return findings
}

if (process.argv[1]?.replace(/\\/g, '/').endsWith('contract.ts')) {
  const findings = runContractTests()
  if (findings.length === 0) {
    console.log('Contract-Tests: OK')
    process.exit(0)
  }
  for (const f of findings) {
    console.log(`${f.severity.toUpperCase()}: ${f.message}`)
    if (f.hint) console.log(`  → ${f.hint}`)
  }
  process.exit(findings.some((f) => f.severity === 'error') ? 1 : 0)
}
