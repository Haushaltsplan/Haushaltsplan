const UA = 'Mozilla/5.0 Chrome/131'
const h = await fetch('https://finance.hermes.com/en/publications/', { headers: { 'User-Agent': UA } }).then((r) => r.text())
console.log('page', /page=\d|pagination|load more|next page/i.test(h))
const fin = [...h.matchAll(/revenue|webcast|message|half-year|annual|results|presentation|publishing/gi)]
console.log('financial keyword count', fin.length)
// older slugs
const slugs = [...new Set([...h.matchAll(/\/en\/publications\/([a-z0-9-]+)/gi)].map((m) => m[1]))]
console.log('slugs on pub list', slugs.length, slugs.filter((s) => /revenue|message|half|annual|webcast|result|publishing/i.test(s)))

await runProbe('message-executive-management-2025')

async function runProbe(slug) {
  const html = await fetch(`https://finance.hermes.com/en/publications/${slug}`, { headers: { 'User-Agent': UA } }).then((r) => r.text())
  console.log(slug, 'pdf_file', (html.match(/pdf_file/g) ?? []).length)
}
