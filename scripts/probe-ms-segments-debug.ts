/** Debug Marketscreener segment scraper — npx tsx scripts/probe-ms-segments-debug.ts */

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

function decodeAttr(s: string): string {
  return s.replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
}

async function probeHtml(slug: string, isin?: string) {
  const url = `https://www.marketscreener.com/quote/stock/${slug}/finances-segments/`
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, 'Accept-Language': 'en-US,en;q=0.9' },
  })
  const html = await res.text()
  const ids = [...html.matchAll(/id="(financialSegment[^"]+)"/g)].map((m) => m[1]!)
  console.log(`\n--- ${slug} status=${res.status} len=${html.length} isin=${isin ? html.includes(isin) : 'n/a'} ---`)
  console.log('chart ids:', [...new Set(ids)])
  for (const id of [
    'financialSegmentCA1',
    'financialSegmentCA2',
    'financialSegmentLastYearChar1',
    'financialSegmentLastYearChar2',
    'financialSegmentRevenueChar1',
    'financialSegmentRevenueChar2',
  ]) {
    const m = html.match(new RegExp(`id="${id}"[\\s\\S]*?data-fct-attr="(\\{[^"]+\\})"`))
    if (!m?.[1]) {
      console.log(id, 'NOT FOUND')
      continue
    }
    const p = JSON.parse(decodeAttr(m[1])) as {
      start?: number
      data?: Record<string, { data?: number[] }>
    }
    const keys = Object.keys(p.data ?? {})
    const years = keys.length ? Math.max(...keys.map((k) => p.data![k]!.data?.length ?? 0)) : 0
    console.log(id, 'start=', p.start, 'seg=', keys.length, 'years=', years, keys.slice(0, 3))
  }
  console.log('biz table', /Breakdown by Business Segment/i.test(html))
  console.log('geo table', /Geographical breakdown of sales/i.test(html))
}

async function slugPasstZuIsin(slug: string, isin: string): Promise<boolean> {
  for (const path of ['/', '/company/', '/finances/', '/finances-segments/']) {
    const res = await fetch(`https://www.marketscreener.com/quote/stock/${slug}${path}`, {
      headers: { 'User-Agent': UA, 'Accept-Language': 'en-US,en;q=0.9' },
    })
    if (!res.ok) continue
    const html = await res.text()
    if (html.includes(isin)) return true
  }
  return false
}

async function main() {
  await probeHtml('ALPHABET-INC-24203373', 'US02079K3059')
  await probeHtml('ALPHABET-INC-8578579', 'US02079K3059')
  await probeHtml('MICROSOFT-CORPORATION-4835', 'US5949181045')

  const isin = 'US02079K3059'
  const slug = 'ALPHABET-INC-24203373'
  console.log('\nslugPasstZuIsin', slug, await slugPasstZuIsin(slug, isin))
}

main().catch(console.error)
