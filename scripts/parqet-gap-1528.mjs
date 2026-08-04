/**
 * Was macht die 1.528,36 € Differenz zu Parqet 78.803,78?
 * node scripts/parqet-gap-1528.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const PARQET = 78803.78
const APP = 80332.14
const GAP = r2(APP - PARQET)

function r2(n) {
  return Math.round(n * 100) / 100
}
function rundeStueck(n) {
  return Math.round(n * 1e8) / 1e8
}

const env = {}
for (const line of readFileSync(resolve('.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m) env[m[1]] = m[2].replace(/^"|"$/g, '')
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
let rows = []
let offset = 0
while (true) {
  const { data } = await sb.from('portfolio_analyse_buchung').select('*').order('datum').range(offset, offset + 999)
  if (!data?.length) break
  rows.push(...data)
  if (data.length < 1000) break
  offset += 1000
}

function istTI(b) {
  return /^transferin$/i.test((b.parqet_typ ?? '').trim())
}
function hw(b) {
  const stk = Math.abs(b.stueck ?? 0)
  if (stk > 0 && b.kurs_eur > 0) {
    const h = r2(stk * b.kurs_eur)
    if (h < b.betrag_eur - 0.02) return h
    if (Math.abs(h - b.betrag_eur) <= 0.02) return h
  }
  // heal
  if (stk > 1.01 && b.kurs_eur > 0 && Math.abs(b.betrag_eur - b.kurs_eur) <= 0.05) return r2(stk * b.kurs_eur)
  return r2(Math.abs(b.betrag_eur))
}

// Per ISIN: track lots {stk, cost, fromTI}
const byIsin = new Map()

function ensure(isin) {
  if (!byIsin.has(isin)) byIsin.set(isin, { lots: [], name: '' })
  return byIsin.get(isin)
}

for (const b of rows) {
  if (!b.isin) continue
  const isin = b.isin.toUpperCase()
  const g = ensure(isin)
  if (b.wertpapier_name) g.name = b.wertpapier_name

  if (b.typ === 'kauf') {
    let stk = rundeStueck(Math.abs(b.stueck ?? 0))
    const cost = hw(b)
    if (stk <= 0 && b.kurs_eur > 0) stk = rundeStueck(cost / b.kurs_eur)
    if (stk <= 0) continue
    g.lots.push({ stk, cost, ti: istTI(b), datum: b.datum })
  } else if (b.parqet_typ === 'SpinOffCost') {
    // reduce cost proportionally across lots
    let total = g.lots.reduce((s, l) => s + l.cost, 0)
    if (total <= 0) continue
    const cut = Math.min(b.betrag_eur, total)
    for (const l of g.lots) {
      const share = l.cost / total
      l.cost = r2(l.cost - cut * share)
    }
  } else if (b.typ === 'verkauf') {
    let stk = rundeStueck(Math.abs(b.stueck ?? 0))
    // FIFO consume
    while (stk > 1e-10 && g.lots.length) {
      const lot = g.lots[0]
      const take = Math.min(stk, lot.stk)
      const frac = take / lot.stk
      lot.stk = rundeStueck(lot.stk - take)
      lot.cost = r2(lot.cost * (1 - frac))
      stk = rundeStueck(stk - take)
      if (lot.stk < 1e-8) g.lots.shift()
    }
  }
}

// Spin-off: add child lots from parent cost booking
const parent = byIsin.get('US78409V1044')
if (parent) {
  const parentStk = parent.lots.reduce((s, l) => s + l.stk, 0)
  const child = ensure('US60744M1062')
  child.lots.push({ stk: rundeStueck(parentStk), cost: 184.16, ti: false, datum: '2026-07-01' })
  // parent cost already reduced by SpinOffCost booking
}
// NOW split
const now = byIsin.get('US81762P1021')
if (now) {
  for (const l of now.lots) l.stk = rundeStueck(l.stk * 5)
}

let total = 0
let tiCost = 0
let buyCost = 0
const perIsin = []
for (const [isin, g] of byIsin) {
  let stk = 0
  let cost = 0
  let ti = 0
  for (const l of g.lots) {
    if (l.stk < 1e-8) continue
    stk += l.stk
    cost += l.cost
    if (l.ti) ti += l.cost
  }
  cost = r2(cost)
  ti = r2(ti)
  if (stk < 1e-8 && cost < 0.01) continue
  total += cost
  tiCost += ti
  buyCost += cost - ti
  perIsin.push({ isin, name: (g.name || '').slice(0, 36), cost, ti, buy: r2(cost - ti), stk: rundeStueck(stk) })
}
total = r2(total)
tiCost = r2(tiCost)

console.log({ APP_lot: total, PARQET, GAP: r2(total - PARQET), tiCostOpen: tiCost, buyCostOpen: r2(buyCost) })

// Find combination of open TI costs ≈ GAP
const tiOpen = perIsin.filter((p) => p.ti > 0.01).sort((a, b) => b.ti - a.ti)
console.log('Open TransferIn cost by ISIN:')
console.log(tiOpen)

// singles / pairs close to GAP
for (const a of tiOpen) {
  if (Math.abs(a.ti - GAP) < 2) console.log('SINGLE ≈ gap', a)
  for (const b of tiOpen) {
    if (a.isin >= b.isin) continue
    const s = r2(a.ti + b.ti)
    if (Math.abs(s - GAP) < 2) console.log('PAIR ≈ gap', a.isin, b.isin, s)
  }
}

// All TransferIn amounts (historical) that equal gap
for (const b of rows) {
  if (!istTI(b)) continue
  if (Math.abs(b.betrag_eur - GAP) < 1) {
    console.log('TI booking = gap', b.datum, b.isin, b.betrag_eur, b.wertpapier_name)
  }
}

// Sum TI for Mensch und Maschine / known stock div
let mum = 0
for (const b of rows) {
  if (b.isin === 'DE0006580806' && (istTI(b) || b.typ === 'kauf')) {
    // wahldividende style
  }
}

// Parqet might use "invested" = net buy cash for open positions using BETRAG including fees for buys but excluding TI
console.log('total - tiCostOpen', r2(total - tiCost), 'delta to parqet', r2(total - tiCost - PARQET))

// Maybe Parqet excludes taxes/fees from performance invested — sum of embedded fees still in open lots?
let feeInOpen = 0
// approximate: for each open buy lot, betrag-hw if any — skip

// Check: sum of ALL SpinOffCost + something
console.log('GAP detail', GAP)

// List largest TI open
console.log(
  'top TI open',
  tiOpen.slice(0, 15),
)

// What if Parqet Investiert includes cash from Parqet (not in our export)?
// If Parqet cash = -1528, Investiert = einstand + cash
console.log('If Parqet cash were negative:', r2(total + -GAP))

// Search any single position cost ≈ gap
for (const p of perIsin) {
  if (Math.abs(p.cost - GAP) < 2) console.log('position cost=gap', p)
}
