/**
 * Probe Marketscreener segments via ISIN search
 * npx tsx scripts/probe-marketscreener-segments-isin.ts
 */
import { NACHKAUF_RADAR_WHITELIST } from '../lib/portfolio-analyse/nachkauf-radar/nachkauf-radar-whitelist'

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'

async function slugFromIsin(isin: string): Promise<string | null> {
  const url = `https://www.marketscreener.com/search/?q=${encodeURIComponent(isin)}`
  const html = await (await fetch(url, { headers: { 'User-Agent': UA } })).text()
  const matches = [...html.matchAll(/\/quote\/stock\/([A-Z0-9][A-Z0-9-]+-\d+)\//g)]
  for (const m of matches) {
    if (html.includes(isin)) return m[1]!
  }
  return matches[0]?.[1] ?? null
}

function parseChartData(html: string, chartId: string): { start?: number; segments?: number } | null {
  const re = new RegExp(`id="${chartId}"[\\s\\S]*?data-fct-attr="(\\{[^"]+\\})"`)
  const m = html.match(re)
  if (!m?.[1]) return null
  const json = m[1]
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
  try {
    const parsed = JSON.parse(json) as { data?: Record<string, unknown>; start?: number }
    return { start: parsed.start, segments: Object.keys(parsed.data ?? {}).length }
  } catch {
    return null
  }
}

async function main() {
  let ok = 0
  let partial = 0
  let fail = 0

  for (const pos of NACHKAUF_RADAR_WHITELIST) {
    await new Promise((r) => setTimeout(r, 450))
    const slug = await slugFromIsin(pos.isin)
    if (!slug) {
      console.log(`FAIL    ${pos.name.slice(0, 30)} — kein Slug`)
      fail++
      continue
    }
    const segUrl = `https://www.marketscreener.com/quote/stock/${slug}/finances-segments/`
    const seg = await (await fetch(segUrl, { headers: { 'User-Agent': UA } })).text()
    const hasBizTable = /Breakdown by Business Segment/i.test(seg)
    const hasGeoTable = /Geographical breakdown of sales/i.test(seg)
    const bizChart = parseChartData(seg, 'financialSegmentLastYearChar1')
    const geoChart = parseChartData(seg, 'financialSegmentLastYearChar2')
    const revChart = parseChartData(seg, 'financialSegmentRevenueChar1')

    const tag =
      hasBizTable && hasGeoTable && (bizChart?.segments ?? 0) >= 2
        ? 'OK'
        : hasBizTable || hasGeoTable
          ? 'PARTIAL'
          : 'FAIL'
    if (tag === 'OK') ok++
    else if (tag === 'PARTIAL') partial++
    else fail++

    console.log(
      `${tag.padEnd(7)} ${pos.name.slice(0, 28).padEnd(28)} | ${slug} | biz=${hasBizTable}(${bizChart?.segments ?? 0}seg,ab${bizChart?.start ?? '?'}) geo=${hasGeoTable}(${geoChart?.segments ?? 0}seg)`,
    )
  }
  console.log(`\n=== ${ok} OK, ${partial} PARTIAL, ${fail} FAIL ===`)
}

main().catch(console.error)
