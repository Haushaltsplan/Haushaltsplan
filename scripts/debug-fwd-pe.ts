/**
 * npx tsx --conditions=react-server --require ./scripts/mock-server-only.cjs scripts/debug-fwd-pe.ts
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
    { isin: 'US8835561023', symbolYahoo: 'TMO', name: 'Thermo' },
  ]) {
    const p = await runWithPrimaeremOwner(() =>
      ladeFundamentaldaten({ ...t, cacheModus: 'immer' }),
    )
    if (!p.ok) continue
    const kgv = p.zeilen.find((z) => z.id === 'kgv')
    const eps = p.zeilen.find((z) => z.id === 'eps')
    const schaetz = p.perioden.filter((x) => x.istSchaetzung)
    const hist = p.perioden.filter((x) => !x.istSchaetzung && !x.istLtm && !x.istNtm).slice(-3)
    console.log('\n===', t.name, '===')
    console.log(
      'schaetz',
      schaetz.map((x) => ({
        iso: x.iso,
        kgv: kgv?.werte[x.iso],
        eps: eps?.werte[x.iso],
      })),
    )
    console.log(
      'histTail',
      hist.map((x) => ({
        iso: x.iso,
        kgv: kgv?.werte[x.iso],
        eps: eps?.werte[x.iso],
      })),
    )
    console.log(
      'ntm/ltm',
      p.keyMetrics.filter((m) => m.id === 'ntm_pe' || m.id === 'ltm_pe').map((m) => `${m.id}=${m.wert}`),
    )
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
