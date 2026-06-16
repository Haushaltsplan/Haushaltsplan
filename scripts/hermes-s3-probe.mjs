const h = await fetch('https://finance.hermes.com/en/publications/', {
  headers: { 'User-Agent': 'Mozilla/5.0 Chrome/131' },
}).then((r) => r.text())
const idx = h.indexOf('s3fs-public')
console.log('s3fs-public count', (h.match(/s3fs-public/g) ?? []).length)
if (idx >= 0) console.log(h.slice(idx - 80, idx + 200))

const pdfIdx = h.indexOf('.pdf')
console.log('pdf count', (h.match(/\.pdf/gi) ?? []).length)
if (pdfIdx >= 0) console.log('first pdf ctx', h.slice(pdfIdx - 100, pdfIdx + 100))
