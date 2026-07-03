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
  isin: r.isin,
  betragEur: r.betrag_eur,
  parqetTyp: r.parqet_typ,
  wertpapierName: r.wertpapier_name,
  quelle: r.quelle,
  steuerEur: r.steuer_eur,
  stueck: r.stueck,
  kursEur: r.kurs_eur,
}))

const div = await import(pathToFileURL(resolve('lib/portfolio-analyse/dividenden-buchung.ts')).href)

const TARGET_NET = 1692.87
const TAX_RATE = 399.03 / 2091.9 // 0.19075

// only csv quelle (parqet export path)
let csvNet = 0
for (const b of buchungen) {
  if (!div.istGezahlteBardividende(b)) continue
  if (b.quelle === 'csv') csvNet += b.betragEur
}
console.log('csv only net', csvNet, 'brutto est', csvNet / (1 - TAX_RATE))

// csv + pdf
let csvPdf = 0
for (const b of buchungen) {
  if (!div.istGezahlteBardividende(b)) continue
  if (b.quelle === 'csv' || b.quelle === 'pdf') csvPdf += b.betragEur
}
console.log('csv+pdf net', csvPdf)

// exclude smartbroker
let exSb = 0
for (const b of buchungen) {
  if (!div.istGezahlteBardividende(b)) continue
  if (/smart\s*broker|smartbroker/i.test(b.wertpapierName ?? '')) continue
  exSb += b.betragEur
}
console.log('excl smartbroker net', exSb, 'brutto est', exSb / (1 - TAX_RATE))

// betrag + steuerEur brutto per row
let brutto1 = 0
for (const b of buchungen) {
  if (!div.istGezahlteBardividende(b)) continue
  brutto1 += b.betragEur + (b.steuerEur ?? 0)
}
console.log('net+steuerEur brutto', brutto1)

// net / (1-rate) for gezahlte
let netAll = 0
for (const b of buchungen) {
  if (!div.istGezahlteBardividende(b)) continue
  netAll += b.betragEur
}
console.log('all gezahlt net', netAll, 'implied brutto', netAll / (1 - TAX_RATE))

// find rows to exclude to hit 1692.87 - smallest smartbroker?
const divs = buchungen.filter((b) => div.istGezahlteBardividende(b)).map((b) => ({
  d: b.datum,
  n: b.wertpapierName?.slice(0, 30),
  e: b.betragEur,
  q: b.quelle,
}))
const sorted = [...divs].sort((a, b) => a.e - b.e)
let run = 0
for (const d of sorted) {
  run += d.e
  if (Math.abs(run - TARGET_NET) < 1) console.log('hit target with small divs', run)
}
console.log('smallest 10', sorted.slice(0, 10))
console.log('sum smallest until 26.64', sorted.slice(0, 20).reduce((s, x) => s + x.e, 0))

// parqet csv only (quelle csv) brutto with tax rate
console.log('\nTARGET', { brutto: 2091.9, net: TARGET_NET, steuer: 399.03 })
console.log('csvNet implied', (csvNet / (1 - TAX_RATE)).toFixed(2))
