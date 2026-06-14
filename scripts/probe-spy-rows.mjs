import { readFileSync } from 'fs'
import { unzipSync } from 'fflate'

const buf = readFileSync('scripts/tmp-spy.xlsx')
const files = unzipSync(new Uint8Array(buf))
const shared = new TextDecoder().decode(files['xl/sharedStrings.xml'])
const strings = [...shared.matchAll(/<t[^>]*>([^<]*)<\/t>/g)].map((m) => m[1].replace(/&amp;/g, '&'))
const sheet = new TextDecoder().decode(files['xl/worksheets/sheet1.xml'])
const rows = [...sheet.matchAll(/<row[^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)]

function rowToMap(xml) {
  const map = {}
  for (const c of xml.matchAll(/<c r="([A-Z]+)(\d+)"([^>]*)><v>([^<]*)<\/v><\/c>/g)) {
    map[c[1]] = c[3].includes(' t="s"') ? strings[Number(c[4])] : c[4]
  }
  return map
}

for (const row of rows.slice(0, 15)) {
  console.log('row', row[1], rowToMap(row[2]))
}
