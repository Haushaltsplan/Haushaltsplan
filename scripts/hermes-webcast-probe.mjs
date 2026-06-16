const UA = 'Mozilla/5.0 Chrome/131'

async function crawl(url, depth = 0) {
  const h = await fetch(url, { headers: { 'User-Agent': UA } }).then((r) => r.text())
  const pdfs = [...h.matchAll(/href="([^"]+\.pdf[^"]*)"/gi)].map((m) => ({
    url: m[1].startsWith('http') ? m[1] : new URL(m[1], url).href,
    ctx: h.slice(Math.max(0, m.index - 120), m.index + 80).replace(/\s+/g, ' '),
  }))
  const webcast = pdfs.filter((p) => /webcast|replay|results|conference|audio|video|transcript|presentation/i.test(`${p.url} ${p.ctx}`))
  console.log('\n', url, 'pdfs', pdfs.length, 'webcast-like', webcast.length)
  for (const p of webcast.slice(0, 8)) {
    console.log('  ', p.url.split('/').pop()?.slice(0, 70))
    console.log('   ctx:', p.ctx.slice(0, 120))
  }
  if (depth < 1) {
    const pubLinks = [...h.matchAll(/href="(\/en\/publications\/[^"]+)"/gi)]
      .map((m) => new URL(m[1], url).href)
      .filter((u) => !u.endsWith('/publications/'))
    const uniq = [...new Set(pubLinks)].slice(0, 6)
    for (const u of uniq) {
      if (/revenue|result|financial|webcast|half|annual|message|executive/i.test(u)) await crawl(u, 1)
    }
  }
}

await crawl('https://finance.hermes.com/en/')
await crawl('https://finance.hermes.com/en/publications/')

// search all pdf on home for webcast
const h = await fetch('https://finance.hermes.com/en/', { headers: { 'User-Agent': UA } }).then((r) => r.text())
const allPdfs = [...h.matchAll(/href="([^"]+\.pdf[^"]*)"/gi)].map((m) => m[1])
console.log('\nAll PDFs on home:', allPdfs.length)
for (const p of allPdfs) console.log(' ', p.split('/').pop()?.slice(0, 80))
