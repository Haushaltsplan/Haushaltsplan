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
}))

const div = await import(pathToFileURL(resolve('lib/portfolio-analyse/dividenden-buchung.ts')).href)
const rendite = await import(pathToFileURL(resolve('lib/portfolio-analyse/parqet-rendite-kennzahlen.ts')).href)

const gez = buchungen.filter((b) => div.istGezahlteBardividende(b))
const sumGez = gez.reduce((s, b) => s + b.betragEur, 0)
console.log('gezahlte count', gez.length, 'sum', sumGez)
console.log('current brutto', rendite.summeDividendenBruttoParqet(buchungen))
console.log('current steuer', rendite.summeSteuernParqet(buchungen))
console.log('current geb', rendite.summeGebuehrenParqet(buchungen))

// zins sum
const zins = buchungen.filter((b) => b.typ === 'zins').reduce((s, b) => s + b.betragEur, 0)
console.log('zins', zins)

// aktiendiv via dividendenZufluss
let akt = 0
for (const b of buchungen) {
  const z = div.dividendenZuflussEur(b)
  if (div.istGezahlteBardividende(b)) continue
  if (z > 0 && !div.istKlassischeDividende(b)) akt += z
}
console.log('aktiendiv zufluss', akt)

// Try: net target 1692.87 — exclude pdf?
const noPdf = gez.filter((b) => b.quelle !== 'pdf').reduce((s, b) => s + b.betragEur, 0)
console.log('no pdf', noPdf)

// Try exclude smartbroker
const noSb = gez.filter((b) => !/smart\s*broker|smartbroker/i.test(b.wertpapierName ?? '')).reduce((s, b) => s + b.betragEur, 0)
console.log('no smartbroker', noSb)

// Parqet tax rate
const RATE = 399.03 / 2091.9
function model(opts) {
  const { grossUpPdf, grossUpSmartbroker, includeZins } = opts
  let brutto = 0
  let steuer = 0
  let netto = 0
  for (const b of buchungen) {
    if (includeZins && b.typ === 'zins') {
      const net = b.betragEur
      netto += net
      brutto += net / (1 - RATE)
      steuer += net / (1 - RATE) - net
      continue
    }
    if (!div.istGezahlteBardividende(b)) continue
    const net = b.betragEur
    const isSb = /smart\s*broker|smartbroker/i.test(b.wertpapierName ?? '')
    const isPdf = b.quelle === 'pdf'
    netto += net
    const st = b.steuerEur ?? 0
    if (st > 0) {
      brutto += net + st
      steuer += st
    } else if (isPdf && !grossUpPdf) {
      brutto += net
    } else if (isSb && !grossUpSmartbroker) {
      brutto += net
    } else if (b.quelle === 'csv' || (isPdf && grossUpPdf) || (isSb && grossUpSmartbroker)) {
      const g = net / (1 - RATE)
      brutto += g
      steuer += g - net
    } else {
      brutto += net
    }
  }
  return { brutto: Math.round(brutto * 100) / 100, steuer: Math.round(steuer * 100) / 100, netto: Math.round(netto * 100) / 100 }
}

for (const grossUpPdf of [false, true]) {
  for (const grossUpSmartbroker of [false, true]) {
    for (const includeZins of [false, true]) {
      const r = model({ grossUpPdf, grossUpSmartbroker, includeZins })
      const dB = Math.abs(r.brutto - 2091.9)
      const dS = Math.abs(r.steuer - 399.03)
      if (dB < 30 && dS < 30) {
        console.log({ grossUpPdf, grossUpSmartbroker, includeZins, ...r, dB, dS })
      }
    }
  }
}

// Find rate that gives exact brutto from net 1719.51 with all csv grossed
const netAll = sumGez
const rate2 = 1 - netAll / 2091.9
console.log('rate for netAll->brutto', rate2, 'steuer', netAll * rate2 / (1 - rate2))

// net 1692.87 — what gross-up base?
const netTarget = 1692.87
const rate3 = 1 - netTarget / 2091.9
console.log('rate from parqet targets', rate3, 'steuer implied', 2091.9 - netTarget)
