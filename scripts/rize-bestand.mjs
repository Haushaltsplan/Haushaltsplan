import fs from 'fs'

const ISIN = 'IE00BJXRZJ40'
const text = fs.readFileSync('c:/Users/dassd/Downloads/Aktien Portfolio-20260601-150039.csv', 'utf8')
const lines = text.split(/\r?\n/).filter(Boolean)

function split(line) {
  const o = []
  let c = ''
  let q = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      q = !q
      continue
    }
    if (ch === ';' && !q) {
      o.push(c.trim().replace(/^"|"$/g, ''))
      c = ''
      continue
    }
    c += ch
  }
  o.push(c.trim().replace(/^"|"$/g, ''))
  return o
}

function parseNum(s) {
  if (!s) return 0
  return Number.parseFloat(s.replace(/\./g, '').replace(',', '.')) || 0
}

let stueck = 0
let kosten = 0
for (let i = 1; i < lines.length; i++) {
  const c = split(lines[i])
  if (c[12] !== ISIN) continue
  const typ = c[9]
  const shares = parseNum(c[4])
  const amount = parseNum(c[5])
  if (typ === 'Buy' || typ === 'TransferIn') {
    stueck += shares
    kosten += amount
  } else if (typ === 'Sell' || typ === 'TransferOut') {
    const anteil = stueck > 0 ? Math.min(1, shares / stueck) : 0
    kosten *= 1 - anteil
    stueck -= shares
  }
}
console.log({ stueck, kosten, einstand: stueck > 0 ? kosten / stueck : 0 })
