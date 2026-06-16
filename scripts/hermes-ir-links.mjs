const UA = 'Mozilla/5.0 Chrome/131'

// Simulate ir-financial-reports link scoring on Hermes IR
const BERICHT_MUSTER =
  /\b(annual report|geschäftsbericht|geschaeftsbericht|half[- ]year|halbjahr|interim report|quarterly report|quarterly results|financial report|financial statements|universal registration|registration document|rapport annuel|rapport financier|results presentation|investor presentation|q[1-4]\s*20\d{2}|fy20\d{2}|20\d{2}\s*(results|report|annual))\b/i
const SKIP_MUSTER =
  /\b(transcript|conference call|earnings call|webcast|press release|pressemitteilung|corporate governance|sustainability|esg|proxy|agm notice|share buyback notice)\b/i

function score(text, href) {
  const kombi = `${text} ${href}`
  if (SKIP_MUSTER.test(kombi)) return -10
  if (!BERICHT_MUSTER.test(kombi)) return 0
  return 5
}

const h = await fetch('https://finance.hermes.com/en/publications/', { headers: { 'User-Agent': UA } }).then((r) => r.text())

// extract links like linksAusHtml would
const links = [...h.matchAll(/<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)]
  .map((m) => ({
    href: m[1],
    text: m[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
  }))
  .filter((l) => l.text.length > 2 || l.href.includes('.pdf'))

const scored = links
  .map((l) => ({ ...l, score: score(l.text, l.href) }))
  .filter((l) => l.score > 0)
  .sort((a, b) => b.score - a.score)

console.log('Matching report links:', scored.length)
for (const l of scored.slice(0, 15)) {
  console.log(`  [${l.score}] ${l.text.slice(0, 60)} -> ${l.href.slice(0, 100)}`)
}

// publication detail pages
const pubPages = links.filter((l) => /\/publications\//.test(l.href) && !l.href.endsWith('/publications/')).slice(0, 10)
console.log('\nPublication pages:')
for (const p of pubPages) {
  const full = p.href.startsWith('http') ? p.href : `https://finance.hermes.com${p.href}`
  const ph = await fetch(full, { headers: { 'User-Agent': UA } }).then((r) => r.text())
  const pdfs = [...ph.matchAll(/href="([^"]+\.pdf[^"]*)"/gi)].map((m) => m[1])
  const tx = /transcript|webcast|conference call|audio/i.test(ph)
  console.log(`  ${p.text.slice(0, 50)} pdfs=${pdfs.length} transcript=${tx}`)
  for (const pdf of pdfs.slice(0, 3)) console.log(`    ${pdf.split('/').pop()?.slice(0, 60)}`)
}

// Check Macrotrends ident resolution via search
const search = await fetch('https://www.macrotrends.net/assets/php/all_pages_query.php?q=Herm%C3%A8s', { headers: { 'User-Agent': UA } }).then((r) => r.text())
console.log('\nMacrotrends search Hermès:', search.slice(0, 400))

const search2 = await fetch('https://www.macrotrends.net/assets/php/all_pages_query.php?q=HESAY', { headers: { 'User-Agent': UA } }).then((r) => r.text())
console.log('Macrotrends search HESAY:', search2.slice(0, 400))

// marketscreener slug for Hermes
const msSlug = 'HERMES-INTERNATIONAL-4635'
const ms = await fetch(`https://www.marketscreener.com/quote/stock/${msSlug}/finances-consensus/`, { headers: { 'User-Agent': UA } }).then((r) => r.text())
console.log('\nMS Hermes Net sales', ms.includes('Net sales'))
