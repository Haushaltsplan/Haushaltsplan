/**
 * npx tsx --conditions=react-server --require ./scripts/mock-server-only.cjs scripts/debug-visa-cagr.ts
 */
import { readFileSync } from 'fs'
import { ladeFundamentaldaten } from '../lib/portfolio-analyse/fundamentaldaten-server'
import { runWithPrimaeremOwner } from '../lib/request-owner'
import { cagr3AusSerie, cagr5AusSerie, werteOhneNiveauSprung } from '../lib/portfolio-analyse/fundamentaldaten-format'
import { historischeWerteAusZeile } from '../lib/portfolio-analyse/fundamentaldaten-roic-hilfen'

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
console.log(
  'env',
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
  Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
  Boolean(process.env.APP_ALLOWED_EMAILS),
)

async function main() {
  const paket = await runWithPrimaeremOwner(() =>
    ladeFundamentaldaten({
      isin: 'US92826C8394',
      symbolYahoo: 'V',
      name: 'Visa',
      cacheModus: 'immer',
    }),
  )
  console.log('ok', paket.ok, paket.firmenname, 'frequenz', paket.frequenz)
  const umsatz = paket.zeilen.find((z) => z.id === 'umsatz')
  const eps = paket.zeilen.find((z) => z.id === 'eps')
  const ebitda = paket.zeilen.find((z) => z.id === 'ebitda')
  const perioden = paket.perioden.filter((p) => !p.istSchaetzung && !p.istNtm)
  console.log(
    'perioden hist',
    perioden.map((p) => `${p.iso}${p.istLtm ? ' LTM' : ''}`).join(' | '),
  )
  for (const z of [umsatz, eps, ebitda]) {
    if (!z) continue
    console.log('\n===', z.id, z.label, '===')
    for (const p of perioden) {
      const v = z.werte[p.iso]
      if (v != null) console.log(p.iso, v)
    }
    const hist = historischeWerteAusZeile(z, paket.perioden)
    console.log('hist', hist)
    console.log('ohneSprung', werteOhneNiveauSprung(hist))
    console.log('cagr3', cagr3AusSerie(hist), 'cagr5', cagr5AusSerie(hist))
  }
  const km = (id: string) => paket.keyMetrics.find((m) => m.id === id)
  for (const id of [
    'fwd_rev_cagr_2y',
    'fwd_ebitda_cagr_2y',
    'fwd_eps_cagr_2y',
    'rev_cagr_3y',
    'rev_cagr_5y',
    'ebitda_cagr_3y',
    'eps_cagr_3y',
    'eps_cagr_5y',
    'fcf_je_aktie_cagr_5y',
    'rule_of_40',
    'ltm_ebit',
    'fcf_conversion',
    'wacc',
    'ltm_roic',
    'ltm_value_spread',
    'peg_ratio',
    'incremental_roic',
    'incremental_value_spread',
  ]) {
    const m = km(id)
    console.log(id, m?.wert, 'zahl=', m?.zahl)
  }
  console.log('mantraMeta', {
    beta: paket.mantraMeta?.beta,
    mcap: paket.mantraMeta?.marketCapUsd,
    debt: paket.mantraMeta?.totalDebtUsd,
    hasYF: Boolean(paket.mantraMeta?.yahooFinanz),
  })
  const { schaetzeWaccPct } = await import('../lib/portfolio-analyse/fundamentaldaten-roic-hilfen')
  console.log(
    'waccDirect',
    schaetzeWaccPct({
      beta: paket.mantraMeta?.beta,
      marketCapUsd: paket.mantraMeta?.marketCapUsd,
      totalDebtUsd: paket.mantraMeta?.totalDebtUsd,
      interestExpenseUsd: paket.mantraMeta?.yahooFinanz?.interestExpenseUsd,
      pretaxIncomeUsd: paket.mantraMeta?.yahooFinanz?.pretaxIncomeUsd,
      taxProvisionUsd: paket.mantraMeta?.yahooFinanz?.taxProvisionUsd,
    }),
  )
  const { istQuartalsPerioden } = await import('../lib/portfolio-analyse/fundamentaldaten-roic-hilfen')
  console.log('istQuartalsPerioden', istQuartalsPerioden(paket.perioden))
  const schaetz = paket.perioden.filter((p) => p.istSchaetzung)
  console.log(
    'schaetz perioden',
    schaetz.map((p) => p.iso).join(' | '),
  )
  const ebitdaS = paket.zeilen.find((z) => z.id === 'ebitda_schaetzung')
  const umsatzS = paket.zeilen.find((z) => z.id === 'umsatz_schaetzung')
  for (const z of [umsatzS, ebitdaS]) {
    if (!z) {
      console.log('missing schaetz zeile')
      continue
    }
    console.log(
      z.id,
      schaetz.map((p) => `${p.iso}=${z.werte[p.iso] ?? '∅'}`).join(' '),
    )
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
