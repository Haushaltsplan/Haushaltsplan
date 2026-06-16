const UA = 'Mozilla/5.0 Chrome/131'
const BERICHT_MUSTER =
  /\b(annual report|geschäftsbericht|geschaeftsbericht|half[- ]year|halbjahr|interim report|quarterly report|quarterly results|financial report|financial statements|universal registration|registration document|rapport annuel|rapport financier|results presentation|investor presentation|q[1-4]\s*20\d{2}|fy20\d{2}|20\d{2}\s*(results|report|annual))\b/i
const SKIP_MUSTER =
  /\b(transcript|conference call|earnings call|webcast|press release|pressemitteilung|corporate governance|sustainability|esg|proxy|agm notice|share buyback notice)\b/i

function score(text, href) {
  const kombi = `${text} ${href}`
  if (SKIP_MUSTER.test(kombi)) return -10
  if (!BERICHT_MUSTER.test(kombi)) return 0
  let s = 5
  if (/\.pdf/i.test(href)) s += 4
  return s
}

const h = await fetch('https://finance.hermes.com/en/', { headers: { 'User-Agent': UA } }).then((r) => r.text())
const links = [...h.matchAll(/<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)].map((m) => ({
  href: m[1],
  text: m[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
}))

console.log('All PDF links on IR home:')
for (const l of links.filter((x) => x.href.includes('.pdf') || x.text.toLowerCase().includes('registration') || x.text.toLowerCase().includes('urd'))) {
  console.log(`  [${score(l.text, l.href)}] "${l.text.slice(0, 70)}" -> ${l.href.slice(0, 90)}`)
}

console.log('\nTop scored report links on IR home:')
for (const l of links.map((x) => ({ ...x, s: score(x.text, x.href) })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s).slice(0, 10)) {
  console.log(`  [${l.s}] "${l.text.slice(0, 70)}"`)
}

// Wrong company: Federated Hermes on Macrotrends if search by name only
const wrong = await fetch('https://www.macrotrends.net/stocks/charts/FHI/federated-hermes/financial-ratios', { headers: { 'User-Agent': UA } }).then((r) => r.text())
console.log('\nWrong FHI Federated Hermes rows', (wrong.match(/field_name/g) ?? []).length)

// Investing.com transcripts for RMS
const inv = await fetch('https://www.investing.com/equities/hermes-international-rms-earnings', { headers: { 'User-Agent': UA, Referer: 'https://www.investing.com/' } }).then((r) => r.text())
console.log('\nInvesting earnings len', inv.length, 'transcript', /transcript/i.test(inv))

// MarketBeat RMS
const mb = await fetch('https://www.marketbeat.com/stocks/EPA/RMS/earnings/', { headers: { 'User-Agent': UA } }).then((r) => r.text())
console.log('MarketBeat RMS len', mb.length, 'transcript', /transcript/i.test(mb))
