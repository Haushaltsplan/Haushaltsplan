/**
 * Test SEC Company Facts + Segment-Jahre aus mehreren 10-K
 * npx tsx scripts/test-sec-historie-voll.ts MSFT MA
 */
import {
  extrahiereSegmentHistorieAus10kHtml,
  extrahiereSegmenteFuerJahr,
} from '@/lib/portfolio-analyse/sec-edgar-segment-extraktion'

const UA = process.env.SEC_EDGAR_USER_AGENT || 'Omnia Haushalt test@example.com'
const TICKERS = process.argv.slice(2).length ? process.argv.slice(2) : ['MSFT', 'MA']

async function secFetch(url: string) {
  return fetch(url, { headers: { 'User-Agent': UA, Accept: '*/*' }, cache: 'no-store' })
}

async function cik(sym: string): Promise<number | null> {
  const tickers = await (await secFetch('https://www.sec.gov/files/company_tickers.json')).json()
  for (const row of Object.values(tickers) as { ticker: string; cik_str: number }[]) {
    if (row.ticker === sym.toUpperCase()) return row.cik_str
  }
  return null
}

async function liste10k(cik: number, max: number) {
  const sub = await (await secFetch(`https://data.sec.gov/submissions/CIK${String(cik).padStart(10, '0')}.json`)).json()
  const f = sub.filings.recent
  const out: { acc: string; doc: string; reportDate: string }[] = []
  for (let i = 0; i < f.form.length && out.length < max; i++) {
    if (f.form[i] !== '10-K') continue
    out.push({ acc: f.accessionNumber[i], doc: f.primaryDocument[i], reportDate: f.reportDate[i] })
  }
  return out
}

async function ladeHtml(cik: number, acc: string, doc: string) {
  const accPath = acc.replace(/-/g, '')
  const url = `https://www.sec.gov/Archives/edgar/data/${cik}/${accPath}/${doc}`
  const res = await secFetch(url)
  return res.ok ? res.text() : ''
}

async function companyFactsJahre(cik: number) {
  const res = await secFetch(`https://data.sec.gov/api/xbrl/companyfacts/CIK${String(cik).padStart(10, '0')}.json`)
  if (!res.ok) return null
  const data = await res.json()
  const tags = [
    'RevenueFromContractWithCustomerExcludingAssessedTax',
    'Revenues',
    'SalesRevenueNet',
  ]
  const jahre = new Set<number>()
  for (const tag of tags) {
    const rev = data?.facts?.['us-gaap']?.[tag]?.units?.USD ?? []
    for (const e of rev) {
      if (e.form === '10-K' && e.fp === 'FY' && e.fy) jahre.add(e.fy)
    }
    if (jahre.size >= 10) break
  }
  const sorted = [...jahre].sort((a, b) => a - b)
  return sorted.length ? { anzahl: sorted.length, min: sorted[0], max: sorted[sorted.length - 1] } : null
}

async function main() {
  for (const sym of TICKERS) {
    console.log(`\n=== ${sym} ===`)
    const c = await cik(sym)
    if (!c) continue

    const cf = await companyFactsJahre(c)
    console.log(`  Company Facts Umsatz: ${cf ? `${cf.anzahl}J (${cf.min}–${cf.max})` : 'n/a'}`)

    const filings = await liste10k(c, 14)
    const prodMap = new Map<number, number>()
    const geoMap = new Map<number, number>()

    for (let i = 0; i < filings.length; i++) {
      const f = filings[i]!
      if (i > 0) await new Promise((r) => setTimeout(r, 350))
      const html = await ladeHtml(c, f.acc, f.doc)
      if (html.length < 5000) continue
      const hist = extrahiereSegmentHistorieAus10kHtml(html)
      for (const j of hist.produkt?.jahre ?? []) prodMap.set(j.jahr, j.segmente.length)
      for (const j of hist.geo?.jahre ?? []) geoMap.set(j.jahr, j.segmente.length)
      const reportJahr = parseInt(f.reportDate?.slice(0, 4) ?? '0', 10)
      if (reportJahr > 2000) {
        const einzel = extrahiereSegmenteFuerJahr(html, reportJahr)
        if (einzel.produkt.length >= 2) prodMap.set(reportJahr, einzel.produkt.length)
        if (einzel.geo.length >= 2) geoMap.set(reportJahr, einzel.geo.length)
      }
    }

    const prodJ = [...prodMap.keys()].sort((a, b) => a - b)
    const geoJ = [...geoMap.keys()].sort((a, b) => a - b)
    console.log(`  Segment Geo: ${geoJ.length}J ${geoJ.length ? `(${geoJ[0]}–${geoJ[geoJ.length - 1]})` : ''}`)
    console.log(`  Segment Produkt: ${prodJ.length}J ${prodJ.length ? `(${prodJ[0]}–${prodJ[prodJ.length - 1]})` : ''}`)
    console.log(`  ${filings.length} 10-Ks geprüft`)
  }
}

main().catch(console.error)
