/** npx tsx scripts/validate-segment-coverage-v2.ts */
import { NACHKAUF_RADAR_WHITELIST } from '../lib/portfolio-analyse/nachkauf-radar/nachkauf-radar-whitelist'
import { isinKenntnis } from '../lib/portfolio-analyse/isin-kenntnisse'
import { bekannterMarketscreenerSlug } from '../lib/portfolio-analyse/marketscreener-slug'
import {
  extrahiereMsSegmentHistorien,
  htmlHatMsSegmentDaten,
} from '../lib/portfolio-analyse/marketscreener-segment-parser'
import { extrahiereStockanalysisSegmentHistorieAusHtml } from '../lib/portfolio-analyse/stockanalysis-segment-parser'
import { saMetrikPfade } from '../lib/portfolio-analyse/stockanalysis-metrik-pfade'

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

async function probeMs(isin: string) {
  const slug = bekannterMarketscreenerSlug(isin)
  if (!slug) return { produkt: 0, geo: 0 }
  const html = await fetch(`https://www.marketscreener.com/quote/stock/${slug}/finances-segments/`, {
    headers: { 'User-Agent': UA, Referer: 'https://www.marketscreener.com/' },
  }).then((r) => r.text())
  if (!htmlHatMsSegmentDaten(html)) return { produkt: 0, geo: 0 }
  const { produkt, geo } = extrahiereMsSegmentHistorien(html)
  return { produkt: produkt?.anzahlJahre ?? 0, geo: geo?.anzahlJahre ?? 0 }
}

async function probeSa(isin: string, symbolYahoo: string, ticker: string) {
  const opts = { isin, symbolYahoo, ticker }
  let produkt = 0
  let geo = 0
  for (const p of saMetrikPfade(opts, 'revenue-by-segment/')) {
    const html = await fetch(`https://stockanalysis.com${p}`, { headers: { 'User-Agent': UA } }).then((r) =>
      r.text(),
    )
    const s = extrahiereStockanalysisSegmentHistorieAusHtml(html, 'produkt', ticker)
    if (s) produkt = Math.max(produkt, s.anzahlJahre)
  }
  for (const p of saMetrikPfade(opts, 'revenue-by-geography/')) {
    const html = await fetch(`https://stockanalysis.com${p}`, { headers: { 'User-Agent': UA } }).then((r) =>
      r.text(),
    )
    const g = extrahiereStockanalysisSegmentHistorieAusHtml(html, 'geo', ticker)
    if (g) geo = Math.max(geo, g.anzahlJahre)
  }
  return { produkt, geo }
}

async function main() {
  const fails: string[] = []
  for (const pos of NACHKAUF_RADAR_WHITELIST) {
    const k = isinKenntnis(pos.isin)
    const sym = k?.symbolYahoo ?? ''
    const ticker = sym.split('.')[0] ?? ''
    const [ms, sa] = await Promise.all([probeMs(pos.isin), probeSa(pos.isin, sym, ticker)])
    const prod = Math.max(ms.produkt, sa.produkt)
    const geo = Math.max(ms.geo, sa.geo)
    const ok = prod > 0 || geo > 0
    console.log(
      `${ok ? 'OK' : 'FAIL'} ${pos.name.padEnd(22)} merged ${prod}/${geo} (MS ${ms.produkt}/${ms.geo} SA ${sa.produkt}/${sa.geo})`,
    )
    if (!ok) fails.push(pos.name)
    await new Promise((r) => setTimeout(r, 200))
  }
  console.log('\nFails:', fails.length, fails.join(', '))
}

main()
