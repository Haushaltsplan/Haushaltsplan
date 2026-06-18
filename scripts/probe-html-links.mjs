const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
const pages = {
  MUM: 'https://www.mum.de/unternehmen/investor-relations/finanzberichte',
  HLMA: 'https://www.halma.com/investors/results-centre',
  ATD: 'https://corporate.couche-tard.com/financial-reporting?cat=29',
}
for (const [n, url] of Object.entries(pages)) {
  const h = await (await fetch(url, { headers: { 'User-Agent': UA } })).text()
  const pdfs = [...h.matchAll(/href="([^"]+)"/gi)].map((m) => m[1]).filter((u) =>
    /pdf|download|media|dam|gb20|report|presentation|praesentation/i.test(u) && !/\.png|icon|logo/i.test(u),
  )
  console.log(n, pdfs.length, pdfs.slice(0, 4))
}
