/**
 * npx tsx scripts/discover-marketscreener-slugs.ts
 */
import { NACHKAUF_RADAR_WHITELIST } from '../lib/portfolio-analyse/nachkauf-radar/nachkauf-radar-whitelist'
import { ISIN_KENNTNISSE } from '../lib/portfolio-analyse/isin-kenntnisse'

const UA = 'Mozilla/5.0'

function decodeAttr(s: string) {
  return s.replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
}

function hatSegmentDaten(html: string): boolean {
  for (const id of ['financialSegmentCA1', 'financialSegmentCA2']) {
    const m = html.match(new RegExp(`id="${id}"[\\s\\S]*?data-fct-attr="(\\{[^"]+\\})"`))
    if (!m?.[1]) continue
    try {
      const p = JSON.parse(decodeAttr(m[1])) as { data?: Record<string, unknown> }
      if (Object.keys(p.data ?? {}).length >= 2) return true
    } catch { /* */ }
  }
  return false
}

async function slugsFromSearch(q: string): Promise<string[]> {
  const html = await (
    await fetch(`https://www.marketscreener.com/search/?q=${encodeURIComponent(q)}`, {
      headers: { 'User-Agent': UA },
    })
  ).text()
  return [...new Set([...html.matchAll(/\/quote\/stock\/([A-Z0-9-]+-\d+)\//g)].map((m) => m[1]!))]
}

async function main() {
  const out: Record<string, string> = {}
  for (const p of NACHKAUF_RADAR_WHITELIST) {
    const sym = ISIN_KENNTNISSE[p.isin]?.symbolYahoo?.split('.')[0]
    const kandidaten = [
      ...new Set([...(await slugsFromSearch(p.isin)), ...(sym ? await slugsFromSearch(sym) : [])]),
    ]
    let found: string | null = null
    for (const slug of kandidaten.slice(0, 10)) {
      await new Promise((r) => setTimeout(r, 350))
      const html = await (
        await fetch(`https://www.marketscreener.com/quote/stock/${slug}/finances-segments/`, {
          headers: { 'User-Agent': UA },
        })
      ).text()
      if (html.length > 80_000 && hatSegmentDaten(html)) {
        found = slug
        break
      }
    }
    out[p.isin] = found ?? ''
    console.log(p.isin, sym ?? '-', found ?? 'FAIL')
  }
  console.log('\nSLUGS =', JSON.stringify(out, null, 2))
}

main()
