/** npx tsx scripts/probe-ms-finances-labels.ts */
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

async function main() {
  const slug = 'SERVICENOW-INC-10912979'
  const html = await fetch(`https://www.marketscreener.com/quote/stock/${slug}/finances/`, {
    headers: { 'User-Agent': UA, Referer: 'https://www.marketscreener.com/' },
  }).then((r) => r.text())

  for (const m of html.matchAll(/financial-graph-dropdown[^>]*data-fct-attr="([^"]+)"/g)) {
    const raw = m[1]!.replace(/&quot;/g, '"').replace(/&amp;/g, '&')
    if (/backlog|order book|rpo|deferred|remaining/i.test(raw)) {
      console.log('dropdown attr snippet:', raw.slice(0, 200))
    }
  }

  for (const m of html.matchAll(/>([^<]{0,80}(?:backlog|order book|RPO|deferred revenue)[^<]{0,80})</gi)) {
    console.log('text:', m[1]!.replace(/\s+/g, ' ').trim())
  }

  for (const m of html.matchAll(/financialDataChart-[^"]+"[^>]*data-fct-attr="(\{&quot;.*?&quot;\})"/gs)) {
    const raw = m[1]!.replace(/&quot;/g, '"').replace(/&amp;/g, '&')
    if (/backlog|order book|rpo|deferred/i.test(raw)) {
      try {
        const j = JSON.parse(raw) as { title?: string; label?: string }
        console.log('chart:', j.title ?? j.label ?? raw.slice(0, 120))
      } catch {
        console.log('chart raw', raw.slice(0, 120))
      }
    }
  }
}

main()
