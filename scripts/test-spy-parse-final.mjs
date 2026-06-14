import { readFileSync } from 'fs'
import { unzipSync } from 'fflate'

const TICKER_RE = /^[A-Z]{1,6}(?:\.[A-Z])?$/
const SKIP_NAME = new Set(['Name', 'Shares Held', 'Identifier', '-'])
const SKIP_SYMBOL = new Set(['Ticker', 'Local Currency', 'USD', 'SEDOL'])

const buf = readFileSync('scripts/tmp-spy.xlsx')
const files = unzipSync(new Uint8Array(buf))
const strings = [...new TextDecoder().decode(files['xl/sharedStrings.xml']).matchAll(/<t[^>]*>([^<]*)<\/t>/g)].map((m) => m[1].replace(/&amp;/g, '&'))
const sheet = new TextDecoder().decode(files['xl/worksheets/sheet1.xml'])
const rows = [...sheet.matchAll(/<row[^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)]

function rowToMap(xml) {
  const map = {}
  for (const c of xml.matchAll(/<c r="([A-Z]+)(\d+)"([^>]*)><v>([^<]*)<\/v><\/c>/g)) {
    map[c[1]] = c[3].includes(' t="s"') ? strings[Number(c[4])] : c[4]
  }
  return map
}

const out = []
for (const row of rows) {
  const m = rowToMap(row[2])
  let name = m.A?.trim()
  let symbol = m.B?.trim()
  let weight = parseFloat(m.E ?? '')
  if (!TICKER_RE.test(symbol ?? '') && TICKER_RE.test(m.D ?? '')) {
    name = m.C?.trim()
    symbol = m.D?.trim()
    weight = parseFloat(m.E ?? '')
  }
  if (!name || !symbol || !TICKER_RE.test(symbol) || !Number.isFinite(weight) || weight <= 0) continue
  if (SKIP_NAME.has(name) || SKIP_SYMBOL.has(symbol) || name.length < 4) continue
  out.push({ name, symbol, weight })
}

console.log('holdings', out.length, 'sum', out.reduce((s, h) => s + h.weight, 0).toFixed(2))
console.log(out.slice(0, 5))
