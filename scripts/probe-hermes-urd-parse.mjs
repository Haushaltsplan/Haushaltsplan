/** Pure-JS Hermès URD probe — no TS imports. */
import { writeFileSync } from 'fs'

const PDF_URL =
  'https://assets-finance.hermes.com/s3fs-public/node/pdf_file/2026-04/1777391712/260320_hermes_urd2025_en.pdf'

async function pdfText(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
  const buf = Buffer.from(await res.arrayBuffer())
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf), useSystemFonts: true }).promise
  let text = ''
  const max = Math.min(doc.numPages, 450)
  for (let i = 1; i <= max; i++) {
    const page = await doc.getPage(i)
    const content = await page.getTextContent()
    text += content.items.map((it) => ('str' in it ? it.str : '')).join(' ') + '\n'
  }
  return text
}

function snips(text, re, n = 10) {
  const out = []
  const t = text.replace(/\s+/g, ' ')
  const r = new RegExp(re, 'gi')
  let m
  while ((m = r.exec(t)) !== null && out.length < n) {
    out.push(t.slice(Math.max(0, m.index - 60), m.index + 200))
  }
  return out
}

const text = await pdfText(PDF_URL)
const t = text.replace(/\s+/g, ' ')

// Hermès-style: "Lease liabilities due in less than one year 325 332"
const hermesDebt = []
for (const m of t.matchAll(
  /(Borrowings|Lease liabilities)\s+due in (less|more) than one year[^0-9]{0,20}([\d\s.,]+)\s+([\d\s.,]+)/gi,
)) {
  hermesDebt.push({ label: m[1], due: m[2], y1: m[3], y0: m[4], full: m[0] })
}

const result = {
  textLen: text.length,
  hermesDebt,
  debtSnips: snips(text, 'due in (less|more) than one year|Borrowings|Lease liabilities due'),
  rdSnips: snips(text, 'research and development|expensed as incurred|development costs'),
  custSnips: snips(text, 'no (single )?customer|customer concentration|largest customer|clients? represent'),
  maturitySnips: snips(text, 'maturity|échéances|financial liabilities|contractual maturity'),
}

writeFileSync('scripts/_hermes-urd-probe.json', JSON.stringify(result, null, 2))
process.stderr.write(`ok len=${text.length} debtHits=${hermesDebt.length}\n`)
