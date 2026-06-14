import { readFileSync } from 'fs'
import { unzipSync } from 'fflate'

const buf = readFileSync('scripts/tmp-spy.xlsx')
const files = unzipSync(new Uint8Array(buf))
const shared = new TextDecoder().decode(files['xl/sharedStrings.xml'])
const strings = [...shared.matchAll(/<t[^>]*>([^<]*)<\/t>/g)].map((m) => m[1].replace(/&amp;/g, '&'))
console.log('strings', strings.length, strings.indexOf('Weight'), strings.indexOf('NVDA'))

const sheet = new TextDecoder().decode(files['xl/worksheets/sheet1.xml'])
const rows = [...sheet.matchAll(/<row[^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)]
console.log('rows', rows.length)

const data = []
for (const row of rows) {
  const cells = [...row[2].matchAll(/<c r="([A-Z]+)(\d+)"[^>]*(?: t="s")?[^>]*><v>([^<]*)<\/v>/g)]
  const map = {}
  for (const c of cells) {
    const col = c[1]
    const val = c[3]
    map[col] = c[0].includes(' t="s"') ? strings[Number(val)] : val
  }
  if (map.B === 'NVDA' || map.A === 'NVIDIA CORP') console.log('sample', map)
  if (map.B && map.E && map.A && map.A !== 'Ticker' && map.A !== 'Name' && !map.A.includes('Fund Name')) {
    const pct = parseFloat(map.E)
    if (!Number.isNaN(pct) && pct > 0) data.push({ name: map.A, symbol: map.B, pct })
  }
}
console.log('holdings', data.length, 'sum', data.reduce((s, h) => s + h.pct, 0).toFixed(2))
console.log(data.slice(0, 3))
