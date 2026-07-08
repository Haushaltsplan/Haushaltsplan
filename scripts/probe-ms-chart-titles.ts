/** npx tsx scripts/probe-ms-chart-titles.ts */
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

function decode(s: string) {
  return s.replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
}

async function titles(slug: string) {
  const html = await fetch(`https://www.marketscreener.com/quote/stock/${slug}/finances/`, {
    headers: { 'User-Agent': UA, Referer: 'https://www.marketscreener.com/' },
  }).then((r) => r.text())

  const out = new Set<string>()
  for (const m of html.matchAll(/data-fct-attr="(\{&quot;.*?&quot;\})"/gs)) {
    try {
      const j = JSON.parse(decode(m[1]!)) as Record<string, unknown>
      for (const k of ['title', 'label', 'name', 'metric', 'seriesName']) {
        const v = j[k]
        if (typeof v === 'string' && v.trim()) out.add(v.trim())
      }
      const data = j.data as Record<string, unknown> | undefined
      if (data) Object.keys(data).forEach((k) => out.add(k.replace(/<[^>]+>/g, ' ').trim()))
    } catch {
      /* skip */
    }
  }
  console.log('\n===', slug, '===')
  ;[...out]
    .filter((t) => t.length > 2 && t.length < 120)
    .sort()
    .forEach((t) => {
      if (/backlog|order|book|rpo|deferred|pipeline|remaining|contract/i.test(t)) console.log('*', t)
    })
  console.log('total labels', out.size)
}

async function main() {
  await titles('SERVICENOW-INC-10912979')
  await titles('ARISTA-NETWORKS-INC-16617752')
  await titles('CINTAS-CORPORATION-4861')
}

main()
