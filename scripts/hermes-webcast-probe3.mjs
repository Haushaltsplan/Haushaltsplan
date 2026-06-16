const UA = 'Mozilla/5.0 Chrome/131'

async function inspect(url) {
  const h = await fetch(url, { headers: { 'User-Agent': UA } }).then((r) => r.text())
  console.log('\n===', url.split('/').slice(-2).join('/'), 'len', h.length, '===')
  
  // PDF links
  const pdfs = [...h.matchAll(/https?:\/\/[^"'\s]+\.pdf[^"'\s]*/gi)].map((m) => m[0])
  console.log('PDF URLs:', [...new Set(pdfs)].slice(0, 10))
  
  // assets-finance
  const assets = [...h.matchAll(/https:\/\/assets-finance\.hermes\.com[^"'\s]+/gi)].map((m) => m[0])
  console.log('assets-finance:', [...new Set(assets)].slice(0, 10))
  
  // Drupal JSON or field data
  const drupal = h.match(/"field_[^"]+":\{[^}]{0,200}/g)?.slice(0, 3)
  if (drupal) console.log('drupal fields sample', drupal)
  
  // download / webcast buttons
  for (const pat of [/webcast[^"']{0,80}/gi, /download[^"']{0,80}/gi, /presentation[^"']{0,80}/gi]) {
    const m = h.match(pat)
    if (m) console.log('match', m[0].slice(0, 100))
  }
  
  // __NEXT or application/json
  const scripts = [...h.matchAll(/<script[^>]*type="application\/json"[^>]*>([\s\S]*?)<\/script>/gi)]
  console.log('json scripts', scripts.length)
  for (const s of scripts.slice(0, 2)) {
    if (/pdf|webcast|document/i.test(s[1])) console.log(' json snippet', s[1].slice(0, 400))
  }
  
  // link text around pdf
  const linkBlocks = [...h.matchAll(/<a[^>]+href="([^"]+)"[^>]*>([\s\S]{0,200}?)<\/a>/gi)]
  for (const m of linkBlocks) {
    const href = m[1]
    const text = m[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    if (/pdf|download|webcast|presentation|transcript|replay|access/i.test(`${text} ${href}`)) {
      console.log(` LINK: "${text.slice(0, 60)}" -> ${href.slice(0, 100)}`)
    }
  }
}

await inspect('https://finance.hermes.com/en/publications/first-quarter-2026-revenue')
await inspect('https://finance.hermes.com/en/publications/message-executive-management-2025')

// publications filtered
const pub = await fetch('https://finance.hermes.com/en/publications?type=financial', { headers: { 'User-Agent': UA } }).then((r) => r.text())
const finSlugs = [...new Set([...pub.matchAll(/\/en\/publications\/([a-z0-9-]+)/gi)].map((m) => m[1]))]
console.log('\nFinancial publication slugs:', finSlugs.slice(0, 25))
for (const slug of finSlugs.filter((s) => /result|revenue|message|half|annual|webcast|publishing/i.test(s)).slice(0, 5)) {
  await inspect(`https://finance.hermes.com/en/publications/${slug}`)
}
