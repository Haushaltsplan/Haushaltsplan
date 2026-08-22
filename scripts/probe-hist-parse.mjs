import { writeFileSync } from 'fs'

const PDF_URL =
  'https://assets-finance.hermes.com/s3fs-public/node/pdf_file/2026-04/1777391712/260320_hermes_urd2025_en.pdf'

async function pdfText(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
  const buf = Buffer.from(await res.arrayBuffer())
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf), useSystemFonts: true }).promise
  let text = ''
  for (let i = 1; i <= Math.min(doc.numPages, 100); i++) {
    const page = await doc.getPage(i)
    const content = await page.getTextContent()
    text += content.items.map((it) => ('str' in it ? it.str : '')).join(' ') + '\n'
  }
  return text
}

const text = await pdfText(PDF_URL)
// Pure duplicate of parser for node without TS
function parse(text) {
  const t = text.replace(/\s+/g, ' ')
  const header = t.match(
    /In millions of euros\s+(20[12]\d)\s+(20[12]\d)\s+(20[12]\d)(?:\s+(20[12]\d))?(?:\s+(20[12]\d))?/i,
  )
  if (!header) return null
  const jahre = [header[1], header[2], header[3], header[4], header[5]].filter(Boolean).map(Number)
  const block = t.slice(header.index, header.index + 1800)
  const parseZahlenreihe = (raw) =>
    [...raw.matchAll(/-?[\d]{1,3}(?:,\d{3})*(?:\.\d+)?|-?\d+(?:\.\d+)?/g)]
      .map((m) => Number(m[0].replace(/,/g, '')))
      .filter((n) => Number.isFinite(n))
  const rows = [
    ['umsatz', /\bRevenue\b([^%]{0,80}?)(?=Growth|Recurring|Operating income|Net income|$)/i],
    [
      'ebit',
      /\bRecurring Operating income\b(?:\s+\d)?([^%]{0,80}?)(?=in % of revenue|Operating income|Net income|$)/i,
    ],
    [
      'nettogewinn',
      /Net income attributable to owners of the parent([^%]{0,80}?)(?=in % of revenue|Operating cash|$)/i,
    ],
    [
      'fcf',
      /Adjusted free cash flows?(?:\s+\d)?([^A-Za-z]{0,80}?)(?=Equity|Net cash|Headcount|$)/i,
    ],
    [
      'eigenkapital',
      /Equity attributable to owners of the parent([^A-Za-z]{0,80}?)(?=Net cash|Restated|Headcount|$)/i,
    ],
  ]
  const out = {}
  for (const [id, re] of rows) {
    const m = block.match(re)
    let vals = m ? parseZahlenreihe(m[1]) : []
    if (vals.length > jahre.length && vals[0] < 20 && vals[1] > 100) vals = vals.slice(1)
    out[id] = vals.slice(0, jahre.length)
  }
  return { jahre, out, sample: block.slice(0, 400) }
}

const result = parse(text)
writeFileSync('scripts/_hist-parse.json', JSON.stringify(result, null, 2))
process.stderr.write(JSON.stringify({ jahre: result?.jahre, umsatz: result?.out?.umsatz, fcf: result?.out?.fcf }) + '\n')
