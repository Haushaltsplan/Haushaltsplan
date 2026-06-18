/** Quick test EU IR scraper logic (mirrors eu-portfolio-ir-server) */
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

async function pdfLen(url, referer) {
  const res = await fetch(url, { headers: { 'User-Agent': UA, Referer: referer } })
  if (!res.ok) return `HTTP ${res.status}`
  const buf = Buffer.from(await res.arrayBuffer())
  return `bytes ${buf.length} ct ${res.headers.get('content-type')}`
}

const tests = {
  MUM: ['https://www.mum.de/-/media/mum/downloads/investor-relations/pdf/gb2025_english-group.pdf', 'https://www.mum.de/unternehmen/investor-relations/finanzberichte'],
  HLMA: ['https://www.halma.com/~/media/Files/H/Halma/Corp-V2/reports-and-presentations/reports/2025/Halma-ara-2425.pdf', 'https://www.halma.com/investors/results-centre'],
  ATD: ['https://corporate.couche-tard.com/download/COTA086_ACT_Annual+Report_PRINT_EN_20250626_v2.pdf', 'https://corporate.couche-tard.com/investors'],
  SIKA: null,
}

const sikaJson = 'https://www.sika.com/en/investors/reports-publications/presentations/_jcr_content/content/layoutcontainer_550841723/first/container/accordionitem_1531742667/content/downloads.listing.json'
const sj = await (await fetch(sikaJson, { headers: { 'User-Agent': UA } })).json()
const sikaUrl = sj.items?.[0]?.url
if (sikaUrl) tests.SIKA = [`https://www.sika.com${sikaUrl}`, 'https://www.sika.com/en/investors/reports-publications/presentations.html']

for (const [name, [url, ref]] of Object.entries(tests)) {
  if (!url) continue
  console.log(name, await pdfLen(url, ref))
}
