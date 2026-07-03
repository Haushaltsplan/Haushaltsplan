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
  parqetTyp: r.parqet_typ,
  isin: r.isin,
}))

const div = await import(pathToFileURL(resolve('lib/portfolio-analyse/dividenden-buchung.ts')).href)
const RATE = 399.03 / 2091.9

const items = buchungen
  .filter((b) => div.istGezahlteBardividende(b))
  .map((b) => ({
    net: b.betragEur,
    st: b.steuerEur ?? 0,
    quelle: b.quelle,
    name: b.wertpapierName,
  }))

const target = 26.64
const nets = items.map((x, i) => ({ i, v: Math.round(x.net * 100) }))

function subset(targetCents, maxN = 20) {
  const found = []
  function go(idx, sum, picked) {
    if (found.length >= 5) return
    if (sum === targetCents) {
      found.push(picked.map((i) => items[i]))
      return
    }
    if (sum > targetCents || idx >= nets.length || picked.length > maxN) return
    go(idx + 1, sum, picked)
    go(idx + 1, sum + nets[idx].v, [...picked, nets[idx].i])
  }
  go(0, 0, [])
  return found
}

const hits = subset(Math.round(target * 100))
console.log('subset hits for 26.64', hits.length)
for (const h of hits.slice(0, 3)) {
  console.log(h.map((x) => ({ net: x.net, name: x.name, q: x.quelle })))
}

// Parqet taxable net = 1692.87 — exclude which group?
const parqetNet = 1692.87
const allNet = items.reduce((s, x) => s + x.net, 0)
console.log('allNet', allNet, 'exclude', allNet - parqetNet)

// model with parqetNet: distribute exclusion to pdf no-tax + smartbroker?
function calc(excludeFn) {
  let brutto = 0
  let netto = 0
  for (const b of buchungen) {
    if (!div.istGezahlteBardividende(b)) continue
    if (excludeFn(b)) continue
    const net = b.betragEur
    netto += net
    const st = b.steuerEur ?? 0
    if (st > 0) brutto += net + st
    else if (b.quelle === 'pdf') brutto += net
    else brutto += net / (1 - RATE)
  }
  return { brutto, steuer: brutto - netto, netto }
}

console.log('exclude pdf no steuer', calc((b) => b.quelle === 'pdf' && !(b.steuerEur > 0)))
console.log('exclude smartbroker', calc((b) => /smart/i.test(b.wertpapierName ?? '')))

// exclude pdf no steuer from gross-up only but keep in net? weird

// Final proposed: brutto/steuer with RATE on rows that need gross-up
function parqetDivBrutto(b) {
  const net = b.betragEur
  const st = b.steuerEur ?? 0
  if (st > 0) return net + st
  if (b.quelle === 'pdf') return net
  return net / (1 - RATE)
}

let brutto = 0
for (const b of buchungen) {
  if (div.istGezahlteBardividende(b)) brutto += parqetDivBrutto(b)
}
console.log('proposed brutto', Math.round(brutto * 100) / 100)
console.log('proposed steuer', Math.round((brutto - allNet) * 100) / 100)

// geb
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
