const url =
  'https://www.amundietf.de/de/privatanleger/products/equity/amundi-nasdaq100-swap-ucits-etf-eur-acc/lu1681038243'
const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0', 'Accept-Language': 'de-DE' } })
const html = await r.text()
console.log('status', r.status, 'len', html.length)

for (const term of [
  'holdings',
  'Holdings',
  'Top',
  'allocation',
  'composition',
  'Gewicht',
  'NVIDIA',
  'Microsoft',
  'Apple',
  'Alphabet',
  'api',
  '__NEXT_DATA__',
  'sector',
  'country',
  'constituent',
  'json',
]) {
  let pos = 0
  let c = 0
  while ((pos = html.indexOf(term, pos)) >= 0 && c < 2) {
    console.log('\n', term, pos, html.slice(pos, pos + 200).replace(/\s+/g, ' '))
    pos += term.length
    c++
  }
}

const next = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/)
if (next) {
  const j = JSON.parse(next[1])
  console.log('\nNEXT keys', Object.keys(j))
  const s = JSON.stringify(j)
  for (const term of ['holding', 'allocation', 'composition', 'sector', 'country', 'weight']) {
    const i = s.toLowerCase().indexOf(term)
    if (i >= 0) console.log(' in NEXT', term, s.slice(Math.max(0, i - 50), i + 150))
  }
}

for (const m of html.matchAll(/https?:[^\"'\s]+/g)) {
  const u = m[0]
  if (/api|holding|alloc|compos|fund|product/i.test(u) && u.length < 200) console.log('URL', u)
}
