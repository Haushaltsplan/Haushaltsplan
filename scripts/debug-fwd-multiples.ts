/**
 * npx tsx --conditions=react-server --require ./scripts/mock-server-only.cjs scripts/debug-fwd-multiples.ts
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
    { isin: 'NL0010273215', symbolYahoo: 'ASML', name: 'ASML' },
    { isin: 'US92826C8394', symbolYahoo: 'V', name: 'Visa' },
  ]) {
    const p = await runWithPrimaeremOwner(() =>
      ladeFundamentaldaten({ ...t, cacheModus: 'immer' }),
    )
    if (!p.ok) continue
    const ids = [
      'ntm_pe',
      'ltm_pe',
      'ntm_ev_rev',
      'ltm_ev_rev',
      'ntm_ev_ebitda',
      'ntm_mc_fcf',
      'ltm_pfcf',
      'peg_ratio',
    ]
    console.log('\n===', t.name, '===')
    for (const id of ids) {
      const m = p.keyMetrics.find((x) => x.id === id)
      console.log(id, m?.wert ?? 'missing', 'zahl=', m?.zahl)
    }
    for (const zid of ['ev_rev', 'ev_ebitda', 'pfcf', 'kgv']) {
      const z = p.zeilen.find((x) => x.id === zid)
      const fy = p.perioden.filter((x) => x.istSchaetzung).slice(0, 2)
      console.log(
        zid,
        'fy',
        fy.map((x) => z?.werte[x.iso]),
        'hist',
        p.perioden
          .filter((x) => !x.istSchaetzung && !x.istLtm)
          .slice(-1)
          .map((x) => z?.werte[x.iso]),
      )
    }
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
