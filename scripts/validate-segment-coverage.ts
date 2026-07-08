/** npx tsx scripts/validate-segment-coverage.ts */
import { readFileSync } from 'fs'
import { join } from 'path'
import { NACHKAUF_RADAR_WHITELIST } from '../lib/portfolio-analyse/nachkauf-radar/nachkauf-radar-whitelist'
import { isinKenntnis } from '../lib/portfolio-analyse/isin-kenntnisse'
import { bekannterMarketscreenerSlug } from '../lib/portfolio-analyse/marketscreener-slug'
import {
  extrahiereMsSegmentHistorien,
  htmlHatMsSegmentDaten,
} from '../lib/portfolio-analyse/marketscreener-segment-parser'
import { extrahiereStockanalysisSegmentHistorieAusHtml } from '../lib/portfolio-analyse/stockanalysis-segment-parser'

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

async function probeMs(isin: string, name: string) {
  const slug = bekannterMarketscreenerSlug(isin)
  if (!slug) return { ok: false, produkt: 0, geo: 0, slug: null }
  const html = await fetch(`https://www.marketscreener.com/quote/stock/${slug}/finances-segments/`, {
    headers: { 'User-Agent': UA, Referer: 'https://www.marketscreener.com/' },
  }).then((r) => r.text())
  if (!htmlHatMsSegmentDaten(html)) return { ok: false, produkt: 0, geo: 0, slug }
  const { produkt, geo } = extrahiereMsSegmentHistorien(html)
  return {
    ok: Boolean(produkt || geo),
    produkt: produkt?.anzahlJahre ?? 0,
    geo: geo?.anzahlJahre ?? 0,
    slug,
  }
}

async function probeSaPaths(slug: string, ticker: string, isin: string) {
  const k = isinKenntnis(isin)
  const sym = (k?.logoSymbol ?? k?.symbolYahoo ?? ticker).toLowerCase().split('.')[0]!
  const paths = [
    `/stocks/${sym}/metrics/revenue-by-segment/`,
    `/quote/us/${ticker.split('.')[0]}/metrics/revenue-by-segment/`,
    `/quote/eur/${sym}/metrics/revenue-by-segment/`,
    `/stocks/${sym}/metrics/revenue-by-geography/`,
    `/quote/eur/${sym}/metrics/revenue-by-geography/`,
  ]
  let produkt = 0
  let geo = 0
  let hitPath = ''
  for (const p of paths) {
    try {
      const res = await fetch(`https://stockanalysis.com${p}`, { headers: { 'User-Agent': UA } })
      if (!res.ok) continue
      const html = await res.text()
      if (p.includes('geography')) {
        const g = extrahiereStockanalysisSegmentHistorieAusHtml(html.replace(/geography/gi, 'segment'))
        if (g) {
          geo = g.anzahlJahre
          hitPath = p
        }
      } else {
        const s = extrahiereStockanalysisSegmentHistorieAusHtml(html)
        if (s) {
          produkt = s.anzahlJahre
          hitPath = p
        }
      }
    } catch {
      /* */
    }
  }
  return { produkt, geo, hitPath }
}

async function main() {
  const fails: string[] = []
  console.log('name | MS prod/geo | SA prod/geo | slug')
  for (const pos of NACHKAUF_RADAR_WHITELIST) {
    const k = isinKenntnis(pos.isin)
    const ticker = k?.symbolYahoo ?? '?'
    const [ms, sa] = await Promise.all([
      probeMs(pos.isin, pos.name),
      probeSaPaths('', ticker, pos.isin),
    ])
    const ok = (ms.produkt || ms.geo || sa.produkt || sa.geo) > 0
    const line = `${ok ? 'OK' : 'FAIL'} ${pos.name.padEnd(22)} MS ${ms.produkt}/${ms.geo} SA ${sa.produkt}/${sa.geo} ${ms.slug ?? '-'}`
    console.log(line)
    if (!ok) fails.push(`${pos.name} (${pos.isin})`)
    await new Promise((r) => setTimeout(r, 250))
  }
  console.log('\nFails:', fails.length, fails.join('; '))
}

main()
