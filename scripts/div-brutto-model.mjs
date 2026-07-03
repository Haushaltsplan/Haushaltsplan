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

function parqetBruttoSteuer() {
  let brutto = 0
  let steuer = 0
  let netto = 0
  for (const b of buchungen) {
    if (!div.istGezahlteBardividende(b)) continue
    const net = b.betragEur
    netto += net
    const st = b.steuerEur ?? 0
    if (st > 0) {
      brutto += net + st
      steuer += st
    } else if (b.quelle === 'csv') {
      const g = net / (1 - TAX)
      brutto += g
      steuer += g - net
    } else {
      brutto += net
    }
  }
  return { brutto, steuer, netto }
}

const r = parqetBruttoSteuer()
console.log('parqet model', r, 'target', { brutto: 2091.9, steuer: 399.03, netto: 1692.87 })

// fees
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
console.log('geb', Math.round(geb * 100) / 100, 'target', 316.75)

// netto display = brutto - steuer
console.log('implied netto', r.brutto - r.steuer)
