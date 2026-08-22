import { writeFileSync } from 'fs'

async function pdfZuText(buffer) {
  const pdfParse = (await import('pdf-parse/lib/pdf-parse.js')).default
  const data = await pdfParse(buffer)
  return (data.text || '').replace(/\s+/g, ' ').trim()
}

const url =
  'https://assets-finance.hermes.com/s3fs-public/node/pdf_file/2026-04/1777391712/260320_hermes_urd2025_en.pdf'
const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
const text = await pdfZuText(Buffer.from(await res.arrayBuffer()))

const needles = [
  'Lease liabilities due',
  'Borrowings and financial',
  'financial liabilities',
  'Maturity',
  'no customer',
  'single customer',
  'accounted for more',
  'Research and development',
  'development costs',
  'expensed as incurred',
]
for (const n of needles) {
  let from = 0
  let c = 0
  while (c < 3) {
    const i = text.toLowerCase().indexOf(n.toLowerCase(), from)
    if (i < 0) break
    console.log('\n===', n, c, '===')
    console.log(text.slice(Math.max(0, i - 40), i + 280))
    from = i + n.length
    c++
  }
}

const amf = await fetch('https://transactions-amf.swaoo.com/?q=HERMES', {
  headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'text/html' },
})
const html = await amf.text()
writeFileSync('scripts/_amf-sample.html', html.slice(0, 80_000))
console.log('\nAMF saved, has HERMES?', /herm/i.test(html), 'tables', (html.match(/<table/gi) || []).length)
