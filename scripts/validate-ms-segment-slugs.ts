/**
 * npx tsx scripts/validate-ms-segment-slugs.ts
 */
import { NACHKAUF_RADAR_WHITELIST } from '../lib/portfolio-analyse/nachkauf-radar/nachkauf-radar-whitelist'
import { ISIN_KENNTNISSE } from '../lib/portfolio-analyse/isin-kenntnisse'
import { marketscreenerSlugKandidaten } from '../lib/portfolio-analyse/marketscreener-slug'

const UA = 'Mozilla/5.0'

function decodeAttr(s: string) {
  return s.replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
}

function parseCA(html: string, id: string) {
  const m = html.match(new RegExp(`id="${id}"[\\s\\S]*?data-fct-attr="(\\{[^"]+\\})"`))
  if (!m?.[1]) return 0
  try {
    return Object.keys((JSON.parse(decodeAttr(m[1])) as { data?: object }).data ?? {}).length
  } catch {
    return 0
  }
}

async function main() {
  const found: Record<string, string> = {}
  for (const p of NACHKAUF_RADAR_WHITELIST) {
    const sym = ISIN_KENNTNISSE[p.isin]?.symbolYahoo?.split('.')[0] ?? ''
    const kandidaten = [
      ...new Set(
        marketscreenerSlugKandidaten(p.isin, p.name, sym).flatMap((s) => [s, s.replace(/-CORP-/, '-CORPORATION-')]),
      ),
    ]
    let hit: string | null = null
    for (const slug of kandidaten) {
      await new Promise((r) => setTimeout(r, 300))
      const html = await (
        await fetch(`https://www.marketscreener.com/quote/stock/${slug}/finances-segments/`, {
          headers: { 'User-Agent': UA },
        })
      ).text()
      const ca1 = parseCA(html, 'financialSegmentCA1')
      const ca2 = parseCA(html, 'financialSegmentCA2')
      if (html.length > 80_000 && (ca1 >= 2 || ca2 >= 2)) {
        hit = slug
        console.log(`OK  ${sym.padEnd(6)} ${p.name.slice(0, 25).padEnd(25)} -> ${slug} (prod=${ca1} geo=${ca2})`)
        break
      }
    }
    if (!hit) console.log(`FAIL ${sym.padEnd(6)} ${p.name}`)
    else found[p.isin] = hit
  }
  console.log('\n', JSON.stringify(found, null, 2))
}

main()
