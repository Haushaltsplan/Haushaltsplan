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
  stueck: r.stueck,
  kursEur: r.kurs_eur,
}))

const div = await import(pathToFileURL(resolve('lib/portfolio-analyse/dividenden-buchung.ts')).href)
const RATE = 399.03 / 2091.9

function isSb(b) {
  return /smart\s*broker|smartbroker/i.test(b.wertpapierName ?? '')
}

function bruttoRow(b, mode) {
  const net = b.betragEur
  const st = b.steuerEur ?? 0
  if (mode === 'A') {
    if (st > 0) return net + st
    if (b.quelle === 'pdf') return net
    return net / (1 - RATE)
  }
  if (mode === 'B') {
    if (st > 0) return net + st
    if (b.quelle === 'pdf' && st <= 0) return net
    return net / (1 - RATE)
  }
  if (mode === 'C') {
    if (st > 0) return net / (1 - RATE)
    if (b.quelle === 'pdf') return net
    return net / (1 - RATE)
  }
  if (mode === 'D') {
    // gross up csv+sb only; explicit steuer rows use net+steuer; pdf net only
    if (st > 0) return net + st
    if (b.quelle === 'pdf' || isSb(b)) return isSb(b) ? net / (1 - RATE) : net
    return net / (1 - RATE)
  }
}

for (const mode of ['A', 'B', 'C', 'D']) {
  let brutto = 0
  let netto = 0
  for (const b of buchungen) {
    if (!div.istGezahlteBardividende(b)) continue
    netto += b.betragEur
    brutto += bruttoRow(b, mode)
  }
  const steuer = brutto - netto
  console.log(mode, {
    brutto: Math.round(brutto * 100) / 100,
    steuer: Math.round(steuer * 100) / 100,
    netto: Math.round(netto * 100) / 100,
    dB: Math.round((brutto - 2091.9) * 100) / 100,
    dS: Math.round((steuer - 399.03) * 100) / 100,
  })
}

// fees with verkauf
let geb = 0
for (const b of buchungen) {
  if (b.typ === 'gebuehr') geb += b.betragEur
  if (b.typ === 'kauf' || b.typ === 'verkauf') {
    const stk = Math.abs(b.stueck ?? 0)
    if (stk > 0 && b.kursEur > 0) {
      const hw = Math.round(stk * b.kursEur * 100) / 100
      if (b.typ === 'kauf' && b.betragEur > hw + 0.01) geb += b.betragEur - hw
      if (b.typ === 'verkauf' && hw > b.betragEur + 0.01) geb += hw - b.betragEur
    }
  }
}
console.log('geb', Math.round(geb * 100) / 100)
