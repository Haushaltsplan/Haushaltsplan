/**
 * Smoke: Hermès URD Key-Figures → GuV-Merge (ohne Next).
 */
import { readFileSync, writeFileSync } from 'fs'
import { createRequire } from 'module'

const PDF_URL =
  'https://assets-finance.hermes.com/s3fs-public/node/pdf_file/2026-04/1777391712/260320_hermes_urd2025_en.pdf'

function parseZahlenreihe(raw) {
  return [...raw.matchAll(/-?[\d]{1,3}(?:,\d{3})*(?:\.\d+)?|-?\d+(?:\.\d+)?/g)]
    .map((m) => Number(m[0].replace(/,/g, '')))
    .filter((n) => Number.isFinite(n))
}

function parseEuKeyFiguresHistorieAusText(text) {
  const t = text.replace(/\s+/g, ' ')
  const header = t.match(
    /(?:In millions of (?:euros?|CHF|pounds?)|in Mio\.?\s*€|EUR million|CHF million|£m|US\$ million)\s+(20[12]\d)\s+(20[12]\d)\s+(20[12]\d)(?:\s+(20[12]\d))?(?:\s+(20[12]\d))?/i,
  )
  if (!header) return null
  const jahre = [header[1], header[2], header[3], header[4], header[5]]
    .filter(Boolean)
    .map((y) => parseInt(y, 10))
  if (jahre.length < 3) return null
  const block = t.slice(header.index ?? 0, (header.index ?? 0) + 2200)
  const rows = [
    { id: 'umsatz', re: /\b(?:Revenue|Net sales|Umsatzerlöse|Umsatz|Sales)\b([^%]{0,100}?)(?=Growth|Recurring|Operating|Net income|Gross|EBIT|Kosten|$)/i },
    { id: 'ebit', re: /\b(?:(?:Recurring )?Operating (?:income|profit|result)|EBIT)\b(?:\s+\d)?([^%]{0,120}?)(?=in % of|Operating income|Net income|EBITDA|$)/i },
    { id: 'nettogewinn', re: /(?:Net income(?: attributable to owners of the parent)?|Ergebnis nach Steuern|Konzernergebnis)([^%]{0,100}?)(?=in % of|Operating cash|Equity|Dividende|$)/i },
    { id: 'fcf', re: /(?:(?:Adjusted )?free cash flows?|Free Cashflow|Cashflow aus laufender Geschäftstätigkeit abzüglich Investition)([^A-Za-z%]{0,120}?)(?=Equity|Net cash|Headcount|Eigenkapital|$)/i },
  ]
  const periodenIso = jahre.map((y) => `${y}-12-31`)
  const zeilen = []
  for (const row of rows) {
    const m = block.match(row.re)
    if (!m?.[1]) continue
    let vals = parseZahlenreihe(m[1])
    if (vals.length > jahre.length && vals[0] > 0 && vals[0] < 20 && vals[1] > 100) vals = vals.slice(1)
    if (vals.length < jahre.length) continue
    const werte = {}
    for (let i = 0; i < jahre.length; i++) werte[periodenIso[i]] = vals[i] ?? null
    zeilen.push({ id: row.id, werte })
  }
  return { periodenIso, zeilen }
}

function wertAusMapFuerIso(werte, iso, maxDiffTage = 45) {
  if (!werte) return null
  if (werte[iso] != null && Number.isFinite(werte[iso])) return werte[iso]
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null
  const ziel = new Date(`${iso}T12:00:00Z`).getTime()
  const maxMs = maxDiffTage * 24 * 3600 * 1000
  let best = null
  let bestDiff = Infinity
  for (const [k, v] of Object.entries(werte)) {
    if (v == null || !Number.isFinite(v) || !/^\d{4}-\d{2}-\d{2}$/.test(k)) continue
    const diff = Math.abs(new Date(`${k}T12:00:00Z`).getTime() - ziel)
    if (diff < bestDiff && diff <= maxMs) {
      bestDiff = diff
      best = v
    }
  }
  return best
}

async function main() {
  let text = ''
  try {
    text = readFileSync('scripts/_hermes-keyfigures-snip.txt', 'utf8')
  } catch {
    /* fall through */
  }
  if (text.length < 200) {
    const res = await fetch(PDF_URL, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      },
    })
    if (!res.ok) throw new Error(`PDF HTTP ${res.status}`)
    const buf = Buffer.from(await res.arrayBuffer())
    const require = createRequire(import.meta.url)
    const pdfParse = require('pdf-parse/lib/pdf-parse.js')
    const data = await pdfParse(buf)
    text = (data.text || '').replace(/\s+/g, ' ').trim()
  }

  const urd = parseEuKeyFiguresHistorieAusText(text)
  const out = {
    textLen: text.length,
    hasKeyFigures: /In millions of euros/i.test(text),
    urd,
    mergeSim: null,
  }

  if (urd) {
    const histIso = ['2021-12-31', '2022-12-31', '2023-12-31', '2024-12-31', '2025-12-31']
    const byId = Object.fromEntries(urd.zeilen.map((z) => [z.id, z.werte]))
    out.mergeSim = {}
    for (const id of ['umsatz', 'ebit', 'nettogewinn', 'fcf']) {
      out.mergeSim[id] = Object.fromEntries(histIso.map((iso) => [iso, wertAusMapFuerIso(byId[id], iso)]))
    }
  }

  writeFileSync('scripts/_smoke-hermes-guv.json', JSON.stringify(out, null, 2))
  console.log(JSON.stringify(out, null, 2))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
