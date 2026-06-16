const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131'

const pages = [
  'https://finance.hermes.com/en/',
  'https://finance.hermes.com/en/publications/',
  'https://finance.hermes.com/en/publications/first-quarter-2026-revenue',
  'https://finance.hermes.com/en/publications/message-executive-management-2025',
  'https://finance.hermes.com/fr/publications/',
]

function extractAssets(html) {
  const out = new Set()
  for (const m of html.matchAll(/assets-finance\.hermes\.com[^"'\\s<>]+/gi)) {
    out.add(m[0].startsWith('http') ? m[0] : `https://${m[0]}`)
  }
  for (const m of html.matchAll(/https:\\\/\\\/assets-finance\.hermes\.com[^"\\]+/gi)) {
    out.add(m[0].replace(/\\\//g, '/'))
  }
  return [...out]
}

for (const url of pages) {
  const h = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'en' } }).then((r) => r.text())
  const assets = extractAssets(h)
  console.log('\n', url.replace('https://finance.hermes.com', ''), 'len', h.length, 'assets', assets.length)
  for (const a of assets) console.log('  ', decodeURIComponent(a).split('/').pop()?.slice(0, 80))
}

// Try half-year results slug guess
for (const slug of ['2025-half-year-results', 'half-year-results-2025', '2025-annual-results', 'publishing-2025-results']) {
  const r = await fetch(`https://finance.hermes.com/en/publications/${slug}`, { headers: { 'User-Agent': UA } })
  if (r.status === 200) {
    const h = await r.text()
    console.log('FOUND', slug, 'assets', extractAssets(h).length)
  }
}
