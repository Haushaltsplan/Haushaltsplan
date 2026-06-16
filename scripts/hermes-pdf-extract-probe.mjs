const UA = 'Mozilla/5.0 Chrome/131'

function extractPdfUrls(html) {
  const out = new Set()
  for (const m of html.matchAll(/value="(https:\/\/assets-finance\.hermes\.com\/s3fs-public\/[^"]+\.pdf[^"]*)"/gi)) {
    out.add(m[1].replace(/&amp;/g, '&'))
  }
  for (const m of html.matchAll(/href="(https:\/\/assets-finance\.hermes\.com\/s3fs-public\/[^"]+\.pdf[^"]*)"/gi)) {
    out.add(m[1].replace(/&amp;/g, '&'))
  }
  return [...out]
}

function slugify(url) {
  return url.replace('https://finance.hermes.com', '')
}

const pages = [
  'https://finance.hermes.com/en/',
  'https://finance.hermes.com/en/publications/',
  'https://finance.hermes.com/en/publications/first-quarter-2026-revenue',
  'https://finance.hermes.com/en/publications/message-executive-management-2025',
]

for (const url of pages) {
  const h = await fetch(url, { headers: { 'User-Agent': UA } }).then((r) => r.text())
  const pdfs = extractPdfUrls(h)
  console.log('\n', slugify(url), pdfs.length)
  for (const p of pdfs) {
    const name = decodeURIComponent(p.split('/').pop()?.split('?')[0] ?? '')
    console.log('  ', name)
  }
}

// Find all publication slugs with financial keywords from home + publications list
const pubHtml = await fetch('https://finance.hermes.com/en/publications/', { headers: { 'User-Agent': UA } }).then((r) => r.text())
const slugs = [...new Set([...pubHtml.matchAll(/\/en\/publications\/([a-z0-9-]+)/gi)].map((m) => m[1]))]
const financial = slugs.filter((s) =>
  /revenue|result|half|annual|message|executive|webcast|publishing|financial|quarter|semest|conf/i.test(s),
)
console.log('\nFinancial slugs to crawl:', financial)

for (const slug of financial.slice(0, 15)) {
  const h = await fetch(`https://finance.hermes.com/en/publications/${slug}`, { headers: { 'User-Agent': UA } }).then((r) => r.text())
  const pdfs = extractPdfUrls(h)
  if (pdfs.length) {
    console.log(`\n${slug}:`, pdfs.map((p) => p.split('/').pop()?.split('?')[0]))
  }
}

// Download and check one webcast-like pdf text length
const testUrl = extractPdfUrls(await fetch('https://finance.hermes.com/en/publications/', { headers: { 'User-Agent': UA } }).then((r) => r.text())).find((u) =>
  /revenue|webcast|message|result|presentation/i.test(u),
)
if (testUrl) {
  const pdfParse = (await import('pdf-parse/lib/pdf-parse.js')).default
  const buf = Buffer.from(await fetch(testUrl, { headers: { 'User-Agent': UA } }).then((r) => r.arrayBuffer()))
  const t = await pdfParse(buf)
  console.log('\nTest PDF', testUrl.split('/').pop(), 'chars', t.text?.length, 'head', t.text?.slice(0, 200).replace(/\s+/g, ' '))
}
