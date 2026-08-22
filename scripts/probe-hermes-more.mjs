import { writeFileSync } from 'fs'
const PDF_URL =
  'https://assets-finance.hermes.com/s3fs-public/node/pdf_file/2026-04/1777391712/260320_hermes_urd2025_en.pdf'

async function pdfText(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
  const buf = Buffer.from(await res.arrayBuffer())
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf), useSystemFonts: true }).promise
  let text = ''
  for (let i = 1; i <= Math.min(doc.numPages, 450); i++) {
    const page = await doc.getPage(i)
    const content = await page.getTextContent()
    text += content.items.map((it) => ('str' in it ? it.str : '')).join(' ') + '\n'
  }
  return text
}

function snips(text, re, n = 12) {
  const out = []
  const t = text.replace(/\s+/g, ' ')
  const r = new RegExp(re, 'gi')
  let m
  while ((m = r.exec(t)) !== null && out.length < n) {
    out.push(t.slice(Math.max(0, m.index - 80), m.index + 240))
  }
  return out
}

const text = await pdfText(PDF_URL)
const result = {
  customer: snips(text, 'customer|clients|concentration|wholesal|B2B|distribution network|no one|does not depend'),
  rd: snips(text, 'research|development expenditure|R&D|capitalis|expensed|intangible'),
  note10: snips(text, 'NOTE 10|Note 10|borrowings and financial liabilities'),
  note83: snips(text, 'NOTE 8\\.3|Note 8\\.3|lease liabilit'),
  contractual: snips(text, 'contractual|undiscounted|payment schedule|by maturity'),
}
writeFileSync('scripts/_hermes-more.json', JSON.stringify(result, null, 2))
process.stderr.write('done\n')
