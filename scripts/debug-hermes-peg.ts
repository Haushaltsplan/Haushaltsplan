/**
 * npx tsx --conditions=react-server --require ./scripts/mock-server-only.cjs scripts/debug-hermes-peg.ts
 */
import { readFileSync } from 'fs'
import { ladeFundamentaldaten } from '../lib/portfolio-analyse/fundamentaldaten-server'
import { runWithPrimaeremOwner } from '../lib/request-owner'

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

async function main() {
  for (const t of [
    { isin: 'FR0000052292', symbolYahoo: 'RMS.PA', name: 'Hermes' },
    { isin: 'CH0418792922', symbolYahoo: 'SIKA.SW', name: 'Sika' },
    { isin: 'US92826C8394', symbolYahoo: 'V', name: 'Visa' },
  ]) {
    const p = await runWithPrimaeremOwner(() =>
      ladeFundamentaldaten({ ...t, cacheModus: 'immer' }),
    )
    if (!p.ok) {
      console.log(t.name, p.fehler)
      continue
    }
    const ids = [
      'ntm_pe',
      'ltm_pe',
      'peg_ratio',
      'fwd_eps_cagr_2y',
      'eps_cagr_3y',
      'eps_cagr_5y',
      'rev_cagr_3y',
      'incremental_roic',
      'ltm_roic',
      'wacc',
      'ltm_value_spread',
      'reinvest_quote',
      'aktien_verwaesserung',
      'yoc',
      'div_yield',
    ]
    console.log('\n===', t.name, '===')
    for (const id of ids) {
      const m = p.keyMetrics.find((x) => x.id === id)
      if (m) console.log(id, m.wert, 'zahl=', m.zahl)
    }
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
