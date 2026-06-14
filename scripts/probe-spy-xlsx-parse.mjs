import { unzipSync } from 'zlib'
import { inflateRawSync } from 'zlib'

// minimal: use dynamic import of node built-in for zip - actually use DecompressionStream or adm-zip
// Node 22 has no built-in zip - use child process or manual parse
import { readFileSync, writeFileSync } from 'fs'
import { execSync } from 'child_process'

const url = 'https://www.ssga.com/library-content/products/fund-data/etfs/us/holdings-daily-us-en-spy.xlsx'
const buf = Buffer.from(await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }).then((r) => r.arrayBuffer()))
writeFileSync('scripts/tmp-spy.xlsx', buf)

// use powershell Expand-Archive won't work on xlsx easily
// try parsing with sheetjs npx without installing
const out = execSync('npx --yes xlsx-cli scripts/tmp-spy.xlsx --sheet 0 --output scripts/tmp-spy.csv', {
  encoding: 'utf8',
  maxBuffer: 10 * 1024 * 1024,
})
console.log('cli out', out.slice(0, 200))
const csv = readFileSync('scripts/tmp-spy.csv', 'utf8')
const lines = csv.split('\n').slice(0, 8)
console.log(lines.join('\n'))
console.log('lines', csv.split('\n').length)
