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
const TAX = 399.03 / 2091.9

function sumNet(fn) {
  let s = 0
  for (const b of buchungen) {
    if (!div.istGezahlteBardividende(b)) continue
    if (!fn(b)) continue
    s += b.betragEur
  }
  return s
}

const filters = {
  all: () => true,
  tradeRep: (b) => /trade\s*republic/i.test(b.wertpapierName ?? ''),
  noSmart: (b) => !/smart\s*broker|smartbroker/i.test(b.wertpapierName ?? ''),
  csv: (b) => b.quelle === 'csv',
  csvTr: (b) => b.quelle === 'csv' && /trade\s*republic/i.test(b.wertpapierName ?? ''),
  hasSteuer: (b) => (b.steuerEur ?? 0) > 0,
  parqetDivTyp: (b) => /^dividend$/i.test(b.parqetTyp ?? ''),
}

for (const [name, fn] of Object.entries(filters)) {
  const net = sumNet(fn)
  const bruttoEst = net / (1 - TAX)
  console.log(
    name.padEnd(14),
    'net',
    net.toFixed(2),
    'brutto~',
    bruttoEst.toFixed(2),
    'diff brutto',
    (bruttoEst - 2091.9).toFixed(2),
  )
}

// brutto = net + steuerEur + estimated for missing
let bruttoMixed = 0
let steuerMixed = 0
for (const b of buchungen) {
  if (!div.istGezahlteBardividende(b)) continue
  const net = b.betragEur
  const st = b.steuerEur ?? 0
  if (st > 0) {
    bruttoMixed += net + st
    steuerMixed += st
  } else {
    // estimate gross from net using portfolio avg rate
    const gross = net / (1 - TAX)
    bruttoMixed += gross
    steuerMixed += gross - net
  }
}
console.log('\nmixed brutto', bruttoMixed.toFixed(2), 'steuer', steuerMixed.toFixed(2))

// only estimate for csv without steuer
let b2 = 0
let s2 = 0
for (const b of buchungen) {
  if (!div.istGezahlteBardividende(b)) continue
  const net = b.betragEur
  const st = b.steuerEur ?? 0
  bruttoMixed = 0
}
let brutto2 = 0
let steuer2 = 0
for (const b of buchungen) {
  if (!div.istGezahlteBardividende(b)) continue
  const net = b.betragEur
  const st = b.steuerEur ?? 0
  if (st > 0) {
    brutto2 += net + st
    steuer2 += st
  } else if (b.quelle === 'csv') {
    const g = net / (1 - TAX)
    brutto2 += g
    steuer2 += g - net
  } else {
    brutto2 += net
    // pdf without tax estimate
  }
}
console.log('csv estimate brutto', brutto2.toFixed(2), 'steuer', steuer2.toFixed(2))
