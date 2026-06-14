import { readFileSync } from 'fs'
import { unzipSync } from 'fflate'

const buf = readFileSync('scripts/tmp-spy.xlsx')
const files = unzipSync(new Uint8Array(buf))
const shared = new TextDecoder().decode(files['xl/sharedStrings.xml'])
const strings = [...shared.matchAll(/<t[^>]*>([^<]*)<\/t>/g)].map((m) =>
  m[1].replace(/&amp;/g, '&').replace(/&quot;/g, '"'),
)

const sheet = new TextDecoder().decode(files['xl/worksheets/sheet1.xml'])
const rows = [...sheet.matchAll(/<row[^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)]

function rowToMap(xml) {
  const map = {}
  for (const c of xml.matchAll(/<c r="([A-Z]+)(\d+)"([^>]*)><v>([^<]*)<\/v><\/c>/g)) {
    const col = c[1]
    const attrs = c[3]
    const raw = c[4]
    map[col] = attrs.includes(' t="s"') ? strings[Number(raw)] : raw
  }
  return map
}

for (const row of rows.slice(8, 12)) {
  console.log('row', row[1], rowToMap(row[2]))
}

// find header row with Ticker
for (const row of rows) {
  const m = rowToMap(row[2])
  if (m.A === 'Name' && m.B === 'Ticker') {
    console.log('header row', row[1], m)
    break
  }
}

const holdings = []
let headerRow = 0
for (const row of rows) {
  const m = rowToMap(row[2])
  if (m.A === 'Name' && m.B === 'Ticker') {
    headerRow = Number(row[1])
    continue
  }
  if (Number(row[1]) <= headerRow) continue
  const name = m.A?.trim()
  const symbol = m.B?.trim()
  const weight = parseFloat(m.E ?? '')
  if (!name || !symbol || !Number.isFinite(weight) || weight <= 0) continue
  if (name === 'Name' || symbol === 'Ticker') continue
  holdings.push({ name, symbol, weight })
}
console.log('holdings', holdings.length, 'sum', holdings.reduce((s, h) => s + h.weight, 0).toFixed(2))
console.log(holdings.slice(0, 5))
