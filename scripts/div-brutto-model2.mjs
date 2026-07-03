import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { pathToFileURL } from 'url'

const raw = readFileSync(resolve('.env.local'), 'utf8')
const env = {}
for (const line of raw.split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m) env[m[1]] = m[2].replace(/^"|"$/g, '')
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
let rows = []
for (let o = 0; ; o += 1000) {
  const { data } = await sb.from('portfolio_analyse_buchung').select('*').order('datum').range(o, o + 999)
  if (!data?.length) break
  rows.push(...data)
  if (data.length < 1000) break
}
const buchungen = rows.map((r) => ({
  datum: r.datum,
  typ: r.typ,
  betragEur: r.betrag_eur,
  wertpapierName: r.wertpapier_name,
  quelle: r.quelle,
  steuerEur: r.steuer_eur,
  parqetTyp: r.parqet_typ,
}))

const div = await import(pathToFileURL(resolve('lib/portfolio-analyse/dividenden-buchung.ts')).href)
const TAX = 399.03 / 2091.9

let sbCsv = 0
let trCsv = 0
for (const b of buchungen) {
  if (!div.istGezahlteBardividende(b) || b.quelle !== 'csv') continue
  if (/smart\s*broker|smartbroker/i.test(b.wertpapierName ?? '')) sbCsv += b.betragEur
  else trCsv += b.betragEur
}
console.log('csv smartbroker', sbCsv, 'csv other', trCsv, 'sum', sbCsv + trCsv)

// Model: gross up trCsv only + sbCsv at net + pdf at net
let pdf = 0
for (const b of buchungen) {
  if (!div.istGezahlteBardividende(b) || b.quelle !== 'pdf') continue
  pdf += b.betragEur
}
const brutto = trCsv / (1 - TAX) + sbCsv + pdf
const steuer = brutto - (trCsv + sbCsv + pdf)
console.log('model2 brutto', brutto.toFixed(2), 'steuer', steuer.toFixed(2), 'net', (trCsv + sbCsv + pdf).toFixed(2))

// gross up all csv except smartbroker at net
const brutto3 = trCsv / (1 - TAX) + sbCsv + pdf
console.log('same as model2')

// find rate that gives brutto 2091.9 from net 1719.51
const rate = 1 - 1719.51 / 2091.9
console.log('rate from targets', rate, 'steuer', 1719.51 * rate / (1 - rate))

// net target 1692.87 - what to exclude from 1719.51
console.log('exclude amount', 1719.51 - 1692.87)

// list pdf divs
const pdfs = buchungen.filter((b) => div.istGezahlteBardividende(b) && b.quelle === 'pdf')
console.log('pdf count', pdfs.length, 'sum', pdf)
