/** npx tsx scripts/discover-ms-slugs.ts */
import { htmlHatMsSegmentDaten } from '../lib/portfolio-analyse/marketscreener-segment-parser'
import { isinKenntnis } from '../lib/portfolio-analyse/isin-kenntnisse'

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'

const FAIL = [
  'US55354G1004',
  'US92826C8394',
  'US6795801009',
  'IE000S9YS762',
  'CH0418792922',
  'US49714P1084',
  'US9224751084',
  'CA01626P1484',
  'US0404132054',
  'US0576652004',
  'US23804L1035',
] as const

function normalisiereName(s: string): string {
  return s
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim()
}

async function slugsFromSearch(isin: string, name: string): Promise<string[]> {
  const html = await fetch(`https://www.marketscreener.com/search/?q=${encodeURIComponent(isin)}`, {
    headers: { 'User-Agent': UA },
  }).then((r) => r.text())
  const all = [...html.matchAll(/href="\/quote\/stock\/([A-Z0-9-]+-\d+)\//g)].map((m) => m[1]!)
  const kern = normalisiereName(name)
    .split(/\s+/)
    .filter((w) => w.length > 2 && !['INC', 'PLC', 'AG', 'THE', 'AND', 'HOLDING', 'GROUP'].includes(w))
  const haupt = kern.slice(0, 2).join(' ')
  const matched: string[] = []
  for (const slug of all) {
    const slugNorm = slug.replace(/-/g, ' ')
    if (haupt && haupt.split(' ').every((w) => slugNorm.includes(w))) matched.push(slug)
  }
  return [...new Set([...matched, ...all.slice(0, 8)])]
}

async function testSlug(slug: string): Promise<boolean> {
  const html = await fetch(`https://www.marketscreener.com/quote/stock/${slug}/finances-segments/`, {
    headers: { 'User-Agent': UA },
  }).then((r) => r.text())
  return html.length > 8000 && htmlHatMsSegmentDaten(html)
}

async function main() {
  for (const isin of FAIL) {
    const name = isinKenntnis(isin)?.name ?? isin
    const slugs = await slugsFromSearch(isin, name)
    let found: string | null = null
    for (const slug of slugs) {
      if (await testSlug(slug)) {
        found = slug
        break
      }
      await new Promise((r) => setTimeout(r, 250))
    }
    console.log(`${isin} (${name}): ${found ?? 'NOT FOUND'}`)
    await new Promise((r) => setTimeout(r, 400))
  }
}

main()
