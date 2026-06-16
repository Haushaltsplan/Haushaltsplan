const UA = 'Mozilla/5.0 Chrome/131'

const h = await fetch('https://finance.hermes.com/en/', { headers: { 'User-Agent': UA } }).then((r) => r.text())

for (const kw of ['webcast', 'replay', 'audio', 'video', 'conference', 'results presentation', 'half-year', 'financial results', 'publishing']) {
  const re = new RegExp(kw, 'gi')
  const matches = [...h.matchAll(re)]
  if (matches.length) {
    const idx = matches[0].index
    console.log(kw, 'count', matches.length, 'ctx:', h.slice(idx - 60, idx + 120).replace(/\s+/g, ' '))
  }
}

// All publication slugs from sitemap-like links
const slugs = [...new Set([...h.matchAll(/\/en\/publications\/([a-z0-9-]+)/gi)].map((m) => m[1]))]
console.log('\nPublication slugs on home:', slugs.filter((s) => /result|revenue|financial|webcast|half|annual|message|executive|publishing/i.test(s)).slice(0, 20))

// Try financial calendar / results pages
for (const path of [
  '/en/financial-calendar',
  '/en/financial-calendar/',
  '/en/results',
  '/en/financial-results',
  '/en/publications?type=financial',
]) {
  const url = `https://finance.hermes.com${path}`
  const r = await fetch(url, { headers: { 'User-Agent': UA } }).then((x) => x.status)
  console.log(path, r)
}

// Deep search message executive management 2025 page
const msg = await fetch('https://finance.hermes.com/en/publications/message-executive-management-2025', { headers: { 'User-Agent': UA } }).then((r) => r.text())
console.log('\nmessage-2025 len', msg.length)
for (const kw of ['webcast', 'pdf', 'download', 'presentation', 'replay']) {
  const c = (msg.match(new RegExp(kw, 'gi')) ?? []).length
  if (c) console.log(' ', kw, c)
}
const msgLinks = [...msg.matchAll(/href="([^"]+)"/gi)].map((m) => m[1]).filter((u) => /pdf|webcast|video|download|assets-finance/i.test(u))
console.log(' asset links', msgLinks.slice(0, 10))

// French site
const fr = await fetch('https://finance.hermes.com/fr/publications/', { headers: { 'User-Agent': UA } }).then((r) => r.text())
const frSlugs = [...new Set([...fr.matchAll(/\/fr\/publications\/([a-z0-9-]+)/gi)].map((m) => m[1]))]
console.log('\nFR slugs results-related:', frSlugs.filter((s) => /result|webcast|conf|revenu|semest|annuel|message/i.test(s)).slice(0, 15))
