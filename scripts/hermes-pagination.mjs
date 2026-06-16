const UA = 'Mozilla/5.0 Chrome/131'
const h = await fetch('https://finance.hermes.com/en/publications/', { headers: { 'User-Agent': UA } }).then((r) => r.text())
const pages = [...new Set([...h.matchAll(/\/en\/publications\?[^"'\\s]+/g)].map((m) => m[0]))]
console.log('pagination urls', pages)
const pageLinks = [...h.matchAll(/href="(\/en\/publications\?page=\d+)"/g)].map((m) => m[1])
console.log('page links', [...new Set(pageLinks)])

function extractPdfUrls(html) {
  return [...html.matchAll(/value="(https:\/\/assets-finance\.hermes\.com\/s3fs-public\/[^"]+\.pdf[^"]*)"/gi)].map((m) => m[1])
}

for (let p = 0; p <= 5; p++) {
  const url = p === 0 ? 'https://finance.hermes.com/en/publications/' : `https://finance.hermes.com/en/publications?page=${p}`
  const html = await fetch(url, { headers: { 'User-Agent': UA } }).then((r) => r.text())
  const pdfs = extractPdfUrls(html)
  const fin = pdfs.filter((u) => /revenue|webcast|message|presentation|half|annual|result|urd|ca_t|ca_s|publishing|semest/i.test(u))
  if (fin.length || pdfs.length) console.log('page', p, 'total', pdfs.length, 'fin', fin.map((u) => u.split('/').pop()?.split('?')[0]))
}
