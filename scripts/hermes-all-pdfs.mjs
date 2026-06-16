const UA = 'Mozilla/5.0 Chrome/131'

function extractPdfUrls(html) {
  const out = new Set()
  for (const m of html.matchAll(/value="(https:\/\/assets-finance\.hermes\.com\/s3fs-public\/[^"]+\.pdf[^"]*)"/gi)) {
    out.add(m[1].replace(/&amp;/g, '&'))
  }
  return [...out]
}

const home = await fetch('https://finance.hermes.com/en/', { headers: { 'User-Agent': UA } }).then((r) => r.text())
const slugs = [...new Set([...home.matchAll(/\/en\/publications\/([a-z0-9-]+)/gi)].map((m) => m[1]))]
console.log('Home slugs:', slugs)

const allPdfs = new Map()
for (const base of ['https://finance.hermes.com/en/', 'https://finance.hermes.com/en/publications/']) {
  const h = await fetch(base, { headers: { 'User-Agent': UA } }).then((r) => r.text())
  for (const u of extractPdfUrls(h)) allPdfs.set(u, base)
}

for (const slug of slugs) {
  const h = await fetch(`https://finance.hermes.com/en/publications/${slug}`, { headers: { 'User-Agent': UA } }).then((r) => r.text())
  for (const u of extractPdfUrls(h)) allPdfs.set(u, slug)
}

console.log('\nAll PDFs', allPdfs.size)
for (const [u, src] of allPdfs) {
  const name = u.split('/').pop()?.split('?')[0] ?? ''
  console.log(name, '<-', src)
}

// FR site
const fr = await fetch('https://finance.hermes.com/fr/publications/', { headers: { 'User-Agent': UA } }).then((r) => r.text())
const frPdfs = extractPdfUrls(fr)
console.log('\nFR PDFs', frPdfs.length)
for (const u of frPdfs) console.log(' ', u.split('/').pop()?.split('?')[0])
