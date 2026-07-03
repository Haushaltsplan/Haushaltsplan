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
  isin: r.isin,
}))

const div = await import(pathToFileURL(resolve('lib/portfolio-analyse/dividenden-buchung.ts')).href)

const sbRows = buchungen.filter(
  (b) => div.istGezahlteBardividende(b) && /smart\s*broker|smartbroker/i.test(b.wertpapierName ?? ''),
)
console.log('smartbroker div', sbRows.length, sbRows.reduce((s, b) => s + b.betragEur, 0))
console.log('sample', sbRows.slice(0, 5).map((b) => ({ d: b.datum, eur: b.betragEur, isin: b.isin, st: b.steuerEur })))

// pdf without steuer
const pdfNo = buchungen.filter((b) => div.istGezahlteBardividende(b) && b.quelle === 'pdf' && !(b.steuerEur > 0))
console.log('pdf no steuer', pdfNo.length, pdfNo.reduce((s, b) => s + b.betragEur, 0))
for (const p of pdfNo) console.log(' ', p.datum, p.betragEur, p.wertpapierName)

// Try model: csv gross, sb net, pdf explicit+net
const RATE = 399.03 / 2091.9
function model(opts) {
  let b = 0
  let n = 0
  for (const row of buchungen) {
    if (!div.istGezahlteBardividende(row)) continue
    const net = row.betragEur
    n += net
    const st = row.steuerEur ?? 0
    const isSb = /smart\s*broker|smartbroker/i.test(row.wertpapierName ?? '')
    if (st > 0) b += net + st
    else if (isSb && opts.sbNet) b += net
    else if (row.quelle === 'pdf' && opts.pdfNet) b += net
    else b += net / (1 - (opts.rate ?? RATE))
  }
  return { brutto: b, steuer: b - n }
}
console.log('csv gross sb net pdf rules', model({ sbNet: true, pdfNet: true, rate: RATE }))
console.log('tune rate', model({ sbNet: true, pdfNet: true, rate: 0.17959 }))

// csv only gross, sb+pdf net
console.log('csv only gross', model({ sbNet: true, pdfNet: true, rate: RATE, csvOnly: true }))
