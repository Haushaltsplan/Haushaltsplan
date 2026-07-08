/** npx tsx scripts/probe-ms-tables-deep.ts */
import { writeFileSync } from 'fs'

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

async function main() {
  const slug = 'SERVICENOW-INC-10912979'
  const html = await fetch(`https://www.marketscreener.com/quote/stock/${slug}/finances-segments/`, {
    headers: { 'User-Agent': UA, Referer: 'https://www.marketscreener.com/' },
  }).then((r) => r.text())

  // All table row labels
  const labels = new Set<string>()
  for (const m of html.matchAll(/<tr[^>]*>[\s\S]*?<\/tr>/gi)) {
    const row = m[0]
    if (!/backlog|order book|rpo|deferred|remaining|bookings|revenue|segment|geograph/i.test(row)) continue
    const cells = [...row.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((c) =>
      c[1]!.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
    )
    if (cells[0]) labels.add(cells.join(' | '))
  }
  console.log('Table rows matching:', [...labels].slice(0, 30))

  // All JSON keys in data-fct-attr containing backlog-like terms
  for (const m of html.matchAll(/data-fct-attr="(\{&quot;.*?&quot;\})"/gs)) {
    const raw = m[1]!.replace(/&quot;/g, '"').replace(/&amp;/g, '&')
    if (/backlog|order book|rpo|deferred|remaining performance|bookings|contract asset|unearned/i.test(raw)) {
      console.log('\nJSON snippet:', raw.slice(0, 400))
    }
  }

  // financialDataChart - parse first 3 with index method
  const ids = [...html.matchAll(/id="(financialDataChart-[^"]+)"/g)].map((x) => x[1]!)
  console.log('\nChart count', ids.length)
  for (const id of ids) {
    const pos = html.indexOf(`id="${id}"`)
    const chunk = html.slice(pos, pos + 8000)
    const attr = chunk.match(/data-fct-attr="(\{&quot;.*?&quot;\})"/s)
    if (!attr) continue
    const raw = attr[1]!.replace(/&quot;/g, '"').replace(/&amp;/g, '&')
    try {
      const j = JSON.parse(raw) as { title?: string; data?: Record<string, unknown> }
      const keys = Object.keys(j.data ?? {})
      const title = j.title ?? keys[0]?.slice(0, 40) ?? '?'
      if (/backlog|order|rpo|deferred|bookings|remaining|contract|unearned|revenue/i.test(raw)) {
        console.log('CHART', id.slice(-15), title, 'keys', keys.slice(0, 4))
      }
    } catch {
      /* */
    }
  }

  // Save snippet around "Backlog" if any
  const idx = html.toLowerCase().indexOf('backlog')
  if (idx >= 0) console.log('\nBacklog context:', html.slice(idx - 100, idx + 300).replace(/\s+/g, ' '))
}

main()
