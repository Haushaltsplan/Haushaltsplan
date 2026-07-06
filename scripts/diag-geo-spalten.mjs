/** Debug Spalten-Mapping Geo-Tabelle */
import { extrahiereIxbrlTextBlock } from '../lib/portfolio-analyse/sec-edgar-segment-extraktion.ts'

const UA = 'test@example.com'
const sym = process.argv[2] ?? 'GOOGL'

async function secFetch(url) {
  return fetch(url, { headers: { 'User-Agent': UA }, cache: 'no-store' })
}

function zellenText(tdHtml) {
  return tdHtml
    .replace(/<ix:nonfraction[^>]*>([\s\S]*?)<\/ix:nonfraction>/gi, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function betraegeAusZeile(trHtml) {
  const betraege = []
  const ixRe = /<ix:nonfraction[^>]*>([\s\S]*?)<\/ix:nonfraction>/gi
  let m
  while ((m = ixRe.exec(trHtml)) !== null) {
    const s = m[1].replace(/<[^>]+>/g, '').replace(/,/g, '').trim()
    if (/^\d+(?:\.\d+)?$/.test(s)) betraege.push(Number(s))
  }
  return betraege
}

const tickers = await (await secFetch('https://www.sec.gov/files/company_tickers.json')).json()
let cik
for (const row of Object.values(tickers)) if (row.ticker === sym) cik = row.cik_str
const sub = await (await secFetch(`https://data.sec.gov/submissions/CIK${String(cik).padStart(10,'0')}.json`)).json()
const f = sub.filings.recent
let acc, doc
for (let i = 0; i < f.form.length; i++) if (f.form[i] === '10-K') { acc = f.accessionNumber[i]; doc = f.primaryDocument[i]; break }
const html = await (await secFetch(`https://www.sec.gov/Archives/edgar/data/${cik}/${acc.replace(/-/g,'')}/${doc}`)).text()
const tag = 'RevenueFromExternalCustomersByGeographicAreasTableTextBlock'
const i = html.indexOf(tag)
const start = html.lastIndexOf('<ix:nonNumeric', i)
let end = html.indexOf('</ix:nonNumeric>', start)
const block = html.slice(start, end)

const rows = [...block.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)]
let headerRow = null
for (const row of rows) {
  const zellen = [...row[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((c) => zellenText(c[1]))
  const jahre = zellen.map((z, idx) => ({ z, idx })).filter(({ z }) => /^20\d{2}$/.test(z))
  if (jahre.length >= 2) {
    headerRow = { zellen, jahre }
    break
  }
}
console.log('Header:', headerRow?.zellen)
console.log('Jahre:', headerRow?.jahre)

let n = 0
for (const row of rows) {
  const tr = row[1]
  const zellen = [...tr.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((c) => zellenText(c[1]))
  const betraege = betraegeAusZeile(tr)
  if (zellen[0]?.includes('United States') || zellen[0]?.includes('EMEA')) {
    console.log('\nRow:', zellen[0])
    console.log('  zellen:', zellen)
    console.log('  betraege:', betraege)
    for (const { z: jahr, idx } of headerRow.jahre) {
      const zelle = zellen[idx]
      const offset = Math.max(0, idx - 1)
      console.log(`  ${jahr} idx=${idx} zelle="${zelle}" betrag[${offset}]=${betraege[offset]}`)
    }
    if (++n >= 2) break
  }
}
