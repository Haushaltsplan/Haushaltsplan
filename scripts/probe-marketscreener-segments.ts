/**
 * Probe: Marketscreener finances-segments für alle Whitelist-Titel
 * npx tsx scripts/probe-marketscreener-segments.ts
 */
import { NACHKAUF_RADAR_WHITELIST } from '../lib/portfolio-analyse/nachkauf-radar/nachkauf-radar-whitelist'
import { ISIN_KENNTNISSE } from '../lib/portfolio-analyse/isin-kenntnisse'
import { marketscreenerSlugKandidaten } from '../lib/portfolio-analyse/marketscreener-slug'

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

async function probeSlug(slug: string) {
  const url = `https://www.marketscreener.com/quote/stock/${slug}/finances-segments/`
  const res = await fetch(url, {
    headers: {
      'User-Agent': UA,
      Accept: 'text/html,application/xhtml+xml',
      'Accept-Language': 'en-US,en;q=0.9,de;q=0.8',
    },
    redirect: 'follow',
  })
  const html = await res.text()
  const hasBusiness =
    /Breakdown by Business Segment/i.test(html) || /Historical Breakdown of Revenue by Business/i.test(html)
  const hasGeo =
    /Geographical breakdown of sales/i.test(html) || /Geographical Revenue Distribution/i.test(html)
  const jahre = [...html.matchAll(/Fiscal Period:[^<]*<\/th>\s*([\s\S]*?)<\/tr>/gi)][0]?.[1]
  const jahrCount = jahre ? (jahre.match(/\b20\d{2}\b/g) ?? []).length : 0
  const tableRows = (html.match(/<tr[\s\S]*?<\/tr>/gi) ?? []).filter((r) => /\d+(\.\d+)?[BMK]/.test(r)).length
  return {
    status: res.status,
    ok: res.ok && html.length > 80_000,
    hasBusiness,
    hasGeo,
    jahrCount,
    tableRows,
    len: html.length,
    url,
  }
}

async function main() {
  let ok = 0
  let partial = 0
  let fail = 0

  for (const pos of NACHKAUF_RADAR_WHITELIST) {
    const sym = ISIN_KENNTNISSE[pos.isin]?.symbolYahoo?.split('.')[0]?.toUpperCase() ?? '?'
    const slugs = marketscreenerSlugKandidaten(pos.isin, pos.name, sym)
    let best: Awaited<ReturnType<typeof probeSlug>> | null = null
    for (const slug of slugs.slice(0, 4)) {
      await new Promise((r) => setTimeout(r, 400))
      const r = await probeSlug(slug)
      if (!best || (r.hasBusiness && r.hasGeo && r.jahrCount > best.jahrCount)) best = r
      if (r.ok && r.hasBusiness && r.hasGeo && r.jahrCount >= 5) break
    }
    const b = best!
    const tag =
      b.ok && b.hasBusiness && b.hasGeo && b.jahrCount >= 5
        ? 'OK'
        : b.ok && (b.hasBusiness || b.hasGeo)
          ? 'PARTIAL'
          : 'FAIL'
    if (tag === 'OK') ok++
    else if (tag === 'PARTIAL') partial++
    else fail++
    console.log(
      `${tag.padEnd(7)} ${sym.padEnd(6)} ${pos.name.slice(0, 28).padEnd(28)} | biz=${b.hasBusiness} geo=${b.hasGeo} jahre≈${b.jahrCount} rows=${b.tableRows} | ${b.url.split('/quote/stock/')[1]?.split('/')[0]}`,
    )
  }
  console.log(`\n=== ${ok} OK, ${partial} PARTIAL, ${fail} FAIL / ${NACHKAUF_RADAR_WHITELIST.length} ===`)
}

main().catch(console.error)
