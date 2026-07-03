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
  steuerEur: r.steuer_eur,
  stueck: r.stueck,
  kursEur: r.kurs_eur,
  wertpapierName: r.wertpapier_name,
}))

// verkauf tax estimate: handelswert - betrag (positive = tax+fee taken from proceeds)
let verkTaxEst = 0
let verkGeb = 0
for (const b of buchungen) {
  if (b.typ !== 'verkauf') continue
  const stk = Math.abs(b.stueck ?? 0)
  if (stk <= 0 || !b.kursEur) continue
  const hw = Math.round(stk * b.kursEur * 100) / 100
  const diff = hw - b.betragEur
  if (diff > 0.01) verkGeb += diff // includes tax + fee
}
console.log('verkauf hw-betrag diff sum', verkGeb)

// split: we know verkauf geb ~80.36 from earlier
console.log('implied verkauf tax', verkGeb - 80.36)

const div = await import(pathToFileURL(resolve('lib/portfolio-analyse/dividenden-buchung.ts')).href)
const RATE = 399.03 / 2091.9

function divBruttoSteuer(r) {
  let brutto = 0
  let netto = 0
  for (const b of buchungen) {
    if (!div.istGezahlteBardividende(b)) continue
    const net = b.betragEur
    netto += net
    const st = b.steuerEur ?? 0
    if (st > 0) brutto += net + st
    else if (b.quelle === 'pdf') brutto += net
    else brutto += net / (1 - r)
  }
  return { brutto, steuer: brutto - netto, netto }
}

// find r for brutto target
for (let i = 0; i <= 50000; i++) {
  const r = i / 100000
  const d = divBruttoSteuer(r)
  if (Math.abs(d.brutto - 2091.9) < 0.05) {
    console.log('r for brutto', r, d)
    break
  }
}

// div steuer at RATE + verkauf tax
const d = divBruttoSteuer(RATE)
console.log('at PARQET RATE', d)
console.log('div steuer + verk tax guess', d.steuer + (verkGeb - 80.36))

// Try: steuer rendite = all dividend brutto - net with rate solving steuer target
// brutto free, steuer = 399.03 => need brutto = net + 399.03 = 2118.54 if net=1719.51
console.log('if steuer=399 and net=1719.51 brutto=', 1719.51 + 399.03)
