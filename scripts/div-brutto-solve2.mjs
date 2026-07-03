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
  parqetTyp: r.parqet_typ,
  stueck: r.stueck,
}))

const div = await import(pathToFileURL(resolve('lib/portfolio-analyse/dividenden-buchung.ts')).href)

// aktiendiv
let akt = 0
const aktRows = []
for (const b of buchungen) {
  if (div.istAktiendividendeAlsKauf(b)) {
    const v = div.dividendenZuflussEur(b)
    akt += v
    aktRows.push({ ...b, v })
  }
}
console.log('aktiendiv count', aktRows.length, 'sum', akt)

// subset sum for 26.64 from gezahlte
const gez = buchungen.filter((b) => div.istGezahlteBardividende(b)).map((b) => ({
  datum: b.datum,
  net: b.betragEur,
  name: b.wertpapierName,
  quelle: b.quelle,
}))

const target = 26.64
const amounts = [...new Set(gez.map((g) => Math.round(g.net * 100) / 100))].sort((a, b) => b - a)
console.log('unique amounts near 26', amounts.filter((a) => a > 20 && a < 35))

// pdf all
const pdfAll = buchungen.filter((b) => div.istGezahlteBardividende(b) && b.quelle === 'pdf')
console.log('pdf rows', pdfAll.length, 'sum', pdfAll.reduce((s, b) => s + b.betragEur, 0))
for (const p of pdfAll.slice(0, 8)) {
  console.log(' ', p.datum, p.betragEur, p.wertpapierName?.slice(0, 40), p.steuerEur)
}

// solve with net base 1692.87: which rows excluded from 1719.51?
const diff = 1719.51 - 1692.87
console.log('need exclude', diff)

// try exclude all pdf
const noPdf = gez.filter((g) => g.quelle !== 'pdf').reduce((s, g) => s + g.net, 0)
console.log('no pdf net', noPdf)

// Parqet model: brutto from net 1692.87 at rate 399.03/2091.9
const R = 399.03 / 2091.9
const impliedBrutto = 1692.87 / (1 - R)
console.log('if net=1692.87 gross up all at R', impliedBrutto, 'steuer', impliedBrutto - 1692.87)

// What net subset + gross up gives exact targets?
// explicit brutto 111.87, need rest = 1980.03 brutto from gross-up
// 1980.03 = X/(1-R) => X = 1980.03 * (1-R) = 1600.14 net to gross up
const X = 1980.03 * (1 - R)
console.log('net to gross up (with explicit separate)', X, 'vs csv+smart', 1089.09 + 499.18)

// pdf 131 vs 36 - list pdf with steuer
const pdfSteuer = buchungen.filter((b) => div.istGezahlteBardividende(b) && b.quelle === 'pdf' && (b.steuerEur ?? 0) > 0)
console.log('pdf with steuer', pdfSteuer.length, pdfSteuer.reduce((s, b) => s + b.betragEur, 0))
