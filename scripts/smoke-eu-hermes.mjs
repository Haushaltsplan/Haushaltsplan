/**
 * Smoke: Hermès URD debt/RD/Kunden + AMF Insider (ohne Next-Server).
 */
import { readFileSync, writeFileSync } from 'fs'

const PDF_URL =
  'https://assets-finance.hermes.com/s3fs-public/node/pdf_file/2026-04/1777391712/260320_hermes_urd2025_en.pdf'

function parseMio(raw) {
  const cleaned = raw.replace(/\u00a0/g, ' ').replace(/\s/g, '').replace(/,/g, '')
  const n = Number(cleaned)
  if (!Number.isFinite(n)) return null
  if (n >= 50_000) return Math.round(n / 1_000_000)
  return Math.round(n * 10) / 10
}

function parseHermesDebt(text) {
  const t = text.replace(/\s+/g, ' ')
  const re =
    /(?:Borrowings(?:\s+and\s+financial\s+liabilities)?|Lease liabilities)\s+due in (less|more) than one year\s+(\d+(?:\.\d+)?)\s+([\d,]+(?:\.\d+)?)\s+([\d,]+(?:\.\d+)?)/gi
  let shortMio = 0
  let longMio = 0
  let hits = 0
  let m
  while ((m = re.exec(t)) !== null) {
    const current = parseMio(m[3])
    if (current == null || current < 0) continue
    if (m[1].toLowerCase() === 'less') shortMio += current
    else longMio += current
    hits++
  }
  if (hits < 2) return null
  const y2 = Math.round(longMio * 0.2 * 10) / 10
  const due12 = Math.round(shortMio * 10) / 10
  const gesamt = Math.round((shortMio + longMio) * 10) / 10
  const due24 = Math.round((due12 + y2) * 10) / 10
  return {
    due12mMio: due12,
    dueYear2Mio: y2,
    dueAfter5yMio: Math.round((longMio - y2) * 10) / 10,
    due24mMio: due24,
    gesamtSchuldenMio: gesamt,
    refiAnteil24mPct: gesamt > 0 ? Math.round((due24 / gesamt) * 1000) / 10 : null,
    hits,
  }
}

function parseRd(text) {
  const t = text.replace(/\s+/g, ' ')
  if (/non[‑\-]?capitalisable costs relating to research and development/i.test(t)) {
    return { aktivierungsquotePct: 0, quelle: 'eu_urd' }
  }
  return null
}

function parseKunden(text) {
  const t = text.replace(/\s+/g, ' ')
  if (/no significant concentration of credit risk/i.test(t)) {
    return [{ name: 'Keine wesentliche Kreditrisiko-Konzentration', anteilPct: 5 }]
  }
  return []
}

function parseAmf(html, isin) {
  const out = []
  const rowRe = /<tr>([\s\S]*?)<\/tr>/gi
  let rowM
  while ((rowM = rowRe.exec(html)) !== null) {
    const row = rowM[1]
    if (/class="collapse"|<th\b/i.test(row)) continue
    const cells = [...row.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((c) =>
      c[1].replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim(),
    )
    if (!cells.some((c) => c.includes(isin))) continue
    const nature = cells.find((c) => /Acquisition|Cession/i.test(c))
    if (!nature) continue
    const daten = cells
      .map((c) => {
        const m = c.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
        return m ? `${m[3]}-${m[2]}-${m[1]}` : null
      })
      .filter(Boolean)
    out.push({ nature, datum: daten.sort()[0], cells: cells.slice(0, 9) })
  }
  return out
}

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

const text = await pdfText(PDF_URL)
const debt = parseHermesDebt(text)
const rd = parseRd(text)
const cust = parseKunden(text)

const amfBody = new URLSearchParams({
  f_page: '1',
  f_societes: 'HERMES INTERNATIONAL',
  f_isin: 'FR0000052292',
})
const amfRes = await fetch('https://transactions-amf.swaoo.com/', {
  method: 'POST',
  headers: {
    'User-Agent': 'Mozilla/5.0',
    'Content-Type': 'application/x-www-form-urlencoded',
  },
  body: amfBody,
})
const amfHtml = await amfRes.text()
const amfTx = parseAmf(amfHtml, 'FR0000052292')

const result = {
  ok: Boolean(debt && rd && cust.length && amfTx.length >= 3),
  debt,
  rd,
  cust,
  amfCount: amfTx.length,
  amfSample: amfTx.slice(0, 3),
}
writeFileSync('scripts/_smoke-eu-hermes.json', JSON.stringify(result, null, 2))
process.stderr.write(JSON.stringify({ ok: result.ok, debt12: debt?.due12mMio, rd: rd?.aktivierungsquotePct, cust: cust.length, amf: amfTx.length }) + '\n')
