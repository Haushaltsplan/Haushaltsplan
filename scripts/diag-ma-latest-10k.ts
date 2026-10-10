/**
 * npx tsx --conditions=react-server --require ./scripts/mock-server-only.cjs scripts/diag-ma-latest-10k.ts
 */
import { cikFuerTicker, padCik, secFetch } from '../lib/portfolio-analyse/sec-edgar-common-server'
import { leseAlsJson } from '../lib/http/safe-json-response'
import { ladeLesbarenBerichtText } from '../lib/portfolio-analyse/sec-edgar-bericht-text-server'
import {
  extrahiereBeideSegmentartenAus10kHtml,
  extrahiereSegmentHistorieAus10kHtml,
} from '../lib/portfolio-analyse/sec-edgar-segment-extraktion'
import { extrahiereAlleDetailBloeckeAus10kHtml } from '../lib/portfolio-analyse/sec-edgar-detail-extraktion'

async function main() {
  const cik = await cikFuerTicker('MA')
  if (!cik) throw new Error('no cik')
  const subRes = await secFetch(`https://data.sec.gov/submissions/CIK${padCik(cik)}.json`)
  const sub =
    (await leseAlsJson<{
      filings?: {
        recent?: {
          form?: string[]
          reportDate?: string[]
          filingDate?: string[]
          accessionNumber?: string[]
          primaryDocument?: string[]
        }
      }
    }>(subRes)) ?? {}
  const r = sub.filings?.recent
  if (!r?.form) throw new Error('no filings')

  const hits: {
    form: string
    reportDate: string | null
    filingDate: string | null
    accession: string
    doc: string
  }[] = []
  for (let i = 0; i < r.form.length && hits.length < 8; i++) {
    const form = r.form[i]!
    if (form !== '10-K' && form !== '10-Q') continue
    hits.push({
      form,
      reportDate: r.reportDate?.[i] ?? null,
      filingDate: r.filingDate?.[i] ?? null,
      accession: r.accessionNumber![i]!,
      doc: r.primaryDocument![i]!,
    })
  }
  console.log('Top filings:')
  for (const h of hits) console.log(h)

  const k = hits.find((h) => h.form === '10-K')
  if (!k) throw new Error('no 10-K')
  console.log('\nLoading latest 10-K', k)
  const bericht = await ladeLesbarenBerichtText(cik, k.accession, '10-K', k.doc)
  if (!bericht?.url) throw new Error('no bericht')
  const hres = await secFetch(bericht.url)
  const html = hres.ok ? await hres.text() : ''
  console.log('html len', html.length, 'text len', bericht.text.length)

  const beide = extrahiereBeideSegmentartenAus10kHtml(html)
  console.log(
    'beide.produkt',
    beide.produkt.segmente.map((s) => `${s.name}=${s.umsatzMio}`).join(' | '),
  )
  console.log('beide.geo', beide.geo.segmente.map((s) => `${s.name}=${s.umsatzMio}`).join(' | '))

  const hist = extrahiereSegmentHistorieAus10kHtml(html)
  console.log('historie type', Array.isArray(hist) ? 'array' : typeof hist, hist)

  const details = extrahiereAlleDetailBloeckeAus10kHtml(html)
  console.log('details count', details.length)
  for (const d of details.slice(0, 12)) {
    const jahre = [...d.jahre].sort((a, b) => a.jahr - b.jahr)
    console.log(
      'detail',
      d.def.id,
      d.def.titel ?? '',
      '→',
      jahre.map((j) => `${j.jahr}(${j.segmente.length})`).join(','),
    )
    const last = jahre.at(-1)
    if (last) {
      console.log(
        '  last',
        last.jahr,
        last.segmente
          .slice(0, 8)
          .map((s) => `${s.name}=${s.umsatzMio}`)
          .join(' | '),
      )
    }
  }

  for (const needle of ['Payment network', 'Value-added services', 'Net Revenue', '2025']) {
    console.log('find', needle, html.includes(needle))
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
