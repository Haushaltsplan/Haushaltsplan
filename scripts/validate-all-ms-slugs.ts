/** npx tsx scripts/validate-all-ms-slugs.ts */
import { readFileSync } from 'fs'
import { join } from 'path'
import { htmlHatMsSegmentDaten } from '../lib/portfolio-analyse/marketscreener-segment-parser'

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'

const src = readFileSync(join(process.cwd(), 'lib/portfolio-analyse/marketscreener-slug.ts'), 'utf8')
const entries = [...src.matchAll(/^\s+(US[A-Z0-9]{10}|NL[A-Z0-9]{10}|FR[A-Z0-9]{10}|CH[A-Z0-9]{10}|GB[A-Z0-9]{10}|IE[A-Z0-9]{10}|DE[A-Z0-9]{10}|CA[A-Z0-9]{10}|LU[A-Z0-9]{10}):\s+'([^']+)'/gm)].map(
  (m) => ({ isin: m[1]!, slug: m[2]! }),
)

async function main() {
  const bad: string[] = []
  for (const { isin, slug } of entries) {
    const html = await (
      await fetch(`https://www.marketscreener.com/quote/stock/${slug}/finances-segments/`, {
        headers: { 'User-Agent': UA },
      })
    ).text()
    const ok = html.length > 8000 && htmlHatMsSegmentDaten(html)
    console.log(`${ok ? 'OK  ' : 'FAIL'} ${isin} ${slug}`)
    if (!ok) bad.push(`${isin}=${slug}`)
    await new Promise((r) => setTimeout(r, 300))
  }
  if (bad.length) {
    console.log('\nBAD:', bad.join(', '))
    process.exit(1)
  }
}

main()
