/**
 * npx tsx --conditions=react-server --require ./scripts/mock-server-only.cjs scripts/diag-ma-segment-years.ts
 */
import { ladeSecSegmentHistorie } from '../lib/portfolio-analyse/sec-edgar-segment-historie-server'
import { ladeGescrapteSegmentStruktur } from '../lib/portfolio-analyse/segment-struktur-scraper-server'
import { cikFuerTicker, padCik, secFetch } from '../lib/portfolio-analyse/sec-edgar-common-server'
import { leseAlsJson } from '../lib/http/safe-json-response'

async function main() {
  const cik = await cikFuerTicker('MA')
  console.log('CIK', cik)
  if (cik) {
    const subRes = await secFetch(`https://data.sec.gov/submissions/CIK${padCik(cik)}.json`)
    const sub = (await leseAlsJson<{
      filings?: { recent?: { form?: string[]; reportDate?: string[]; filingDate?: string[]; accessionNumber?: string[] } }
    }>(subRes)) ?? {}
    const r = sub.filings?.recent
    const forms: string[] = []
    if (r?.form) {
      for (let i = 0; i < Math.min(30, r.form.length); i++) {
        if (r.form[i] === '10-K' || r.form[i] === '10-Q') {
          forms.push(`${r.form[i]} report=${r.reportDate?.[i]} filed=${r.filingDate?.[i]} acc=${r.accessionNumber?.[i]}`)
        }
      }
    }
    console.log('Recent 10-K/10-Q:\n', forms.join('\n'))
  }

  const sec = await ladeSecSegmentHistorie('MA')
  console.log('\n=== ladeSecSegmentHistorie MA ===')
  console.log('quelle', sec?.quelle, 'berichtJahr', sec?.berichtJahr, 'anzahl10k', sec?.anzahl10k)
  console.log(
    'produkt Jahre',
    sec?.produkt?.jahre.map((j) => `${j.jahr}:${j.segmente.map((s) => s.name.slice(0, 20)).join(',')}`).join(' | '),
  )
  console.log(
    'geo Jahre',
    sec?.geo?.jahre.map((j) => `${j.jahr}:${j.segmente.map((s) => `${s.name}=${s.anteilPct?.toFixed(0)}`).join(',')}`).join(' | '),
  )

  const live = await ladeGescrapteSegmentStruktur({
    ticker: 'MA',
    symbolYahoo: 'MA',
    isin: 'US57636Q1040',
    name: 'Mastercard',
    refresh: true,
  })
  console.log('\n=== ladeGescrapteSegmentStruktur MA ===')
  console.log('quelle', live?.quelle)
  console.log(
    'produkt',
    live?.produkt?.aeltestesJahr,
    '-',
    live?.produkt?.juengstesJahr,
    live?.produkt?.anzahlJahre,
    'J',
  )
  console.log(
    'geo',
    live?.geo?.aeltestesJahr,
    '-',
    live?.geo?.juengstesJahr,
    live?.geo?.anzahlJahre,
    'J',
  )
  const last = live?.produkt?.jahre.at(-1)
  console.log(
    'last produkt',
    last?.jahr,
    last?.segmente.map((s) => `${s.name}=${s.umsatzMio}`).join(' | '),
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
