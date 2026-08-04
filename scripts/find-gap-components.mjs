/**
 * Finde Buchungen/Positionen die exakt die Lücke 1528.36 erklären.
 * node scripts/find-gap-components.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const GAP = 1528.36
const APP = 80332.14
const PARQET = 78803.78
const r2 = (n) => Math.round(n * 100) / 100
const rundeStueck = (n) => Math.round(n * 1e8) / 1e8

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

function hw(b) {
  const stk = Math.abs(b.stueck ?? 0)
  let betrag = Math.abs(b.betrag_eur)
  const kurs = b.kurs_eur
  if (stk > 1.01 && kurs > 0 && Math.abs(betrag - kurs) <= 0.05) betrag = r2(stk * kurs)
  if (stk > 0 && kurs > 0) {
    const h = r2(stk * kurs)
    if (h < betrag - 0.02 || Math.abs(h - betrag) <= 0.02) return h
  }
  return r2(betrag)
}

// 1) Single bookings near gap
const near = rows
  .filter((b) => Math.abs(Math.abs(b.betrag_eur) - GAP) < 5 || Math.abs(hw(b) - GAP) < 5)
  .map((b) => ({
    d: b.datum,
    typ: b.typ,
    p: b.parqet_typ,
    isin: b.isin,
    betrag: b.betrag_eur,
    hw: hw(b),
    name: (b.wertpapier_name || '').slice(0, 40),
  }))
console.log('near gap bookings', near)

// 2) Sum of fees / taxes
let feeSum = 0
let taxSum = 0
let feeTaxRows = 0
for (const b of rows) {
  if (b.typ === 'gebuehr' || b.parqet_typ === 'Fee') {
    feeSum += Math.abs(b.betrag_eur)
    feeTaxRows++
  }
  if (b.typ === 'steuer' || b.parqet_typ === 'Taxes') {
    taxSum += Math.abs(b.betrag_eur)
    feeTaxRows++
  }
}
console.log({ feeSum: r2(feeSum), taxSum: r2(taxSum), feeTax: r2(feeSum + taxSum) })

// 3) Embedded fees on buys (betrag - hw) for open lots still held — approx via avg cost sim
const map = new Map()
const byDay = new Map()
for (const b of rows) {
  const list = byDay.get(b.datum) ?? []
  list.push(b)
  byDay.set(b.datum, list)
}
for (const [tag, dayRows] of [...byDay.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
  for (const b of dayRows) {
    const isin = b.isin?.toUpperCase()
    if (b.typ === 'kauf' && isin) {
      const cur = map.get(isin) ?? { stk: 0, cost: 0, embeddedFee: 0 }
      let stk = rundeStueck(Math.abs(b.stueck ?? 0))
      const h = hw(b)
      const betrag = r2(Math.abs(b.betrag_eur))
      const emb = Math.max(0, betrag - h)
      if (stk <= 0 && b.kurs_eur > 0) stk = rundeStueck(h / b.kurs_eur)
      cur.stk += stk
      cur.cost += h
      cur.embeddedFee += emb
      map.set(isin, cur)
    } else if (b.parqet_typ === 'SpinOffCost' && isin) {
      const cur = map.get(isin)
      if (cur) cur.cost = r2(Math.max(0, cur.cost - b.betrag_eur))
    } else if (b.typ === 'verkauf' && isin) {
      const cur = map.get(isin)
      if (!cur || cur.stk <= 0) continue
      let stk = rundeStueck(Math.abs(b.stueck ?? 0))
      const anteil = Math.min(1, stk / cur.stk)
      cur.cost = r2(cur.cost * (1 - anteil))
      cur.embeddedFee = r2(cur.embeddedFee * (1 - anteil))
      cur.stk = Math.max(0, cur.stk - stk)
    }
  }
  if (tag === '2026-07-01') {
    const p = map.get('US78409V1044')
    if (p?.stk > 0) {
      const c = map.get('US60744M1062') ?? { stk: 0, cost: 0, embeddedFee: 0 }
      c.stk += p.stk
      c.cost += 184.16
      map.set('US60744M1062', c)
    }
  }
  if (tag === '2025-12-18') {
    const p = map.get('US81762P1021')
    if (p) p.stk = rundeStueck(p.stk * 5)
  }
}

const open = [...map.entries()]
  .map(([isin, v]) => ({ isin, ...v, cost: r2(v.cost), emb: r2(v.embeddedFee) }))
  .filter((p) => p.stk > 1e-8)
const embOpen = r2(open.reduce((s, p) => s + p.emb, 0))
const totalCost = r2(open.reduce((s, p) => s + p.cost, 0))
console.log({ totalCost, embOpen, APP, gapToParqet: r2(totalCost - PARQET) })

// 4) Sum of ALL TransferIn that were later fully sold (TI cost removed) vs remaining
// Find sets of open TI lots totaling GAP
const tiOpenCosts = []
for (const b of rows) {
  if (!/^transferin$/i.test((b.parqet_typ ?? '').trim())) continue
  // check if that exact amount (or residual) still in open — skip, use lot tracker instead
}

// Re-run lot TI residual
const lots = new Map()
function ens(isin) {
  if (!lots.has(isin)) lots.set(isin, [])
  return lots.get(isin)
}
for (const b of rows) {
  const isin = b.isin?.toUpperCase()
  if (!isin) continue
  if (b.typ === 'kauf') {
    let stk = rundeStueck(Math.abs(b.stueck ?? 0))
    const cost = hw(b)
    if (stk <= 0 && b.kurs_eur > 0) stk = rundeStueck(cost / b.kurs_eur)
    if (stk <= 0) continue
    ens(isin).push({
      stk,
      cost,
      ti: /^transferin$/i.test((b.parqet_typ ?? '').trim()),
      d: b.datum,
      name: b.wertpapier_name,
    })
  } else if (b.parqet_typ === 'SpinOffCost') {
    const L = ens(isin)
    const tot = L.reduce((s, l) => s + l.cost, 0)
    if (tot <= 0) continue
    const cut = Math.min(b.betrag_eur, tot)
    for (const l of L) l.cost = r2(l.cost - cut * (l.cost / tot))
  } else if (b.typ === 'verkauf') {
    let stk = rundeStueck(Math.abs(b.stueck ?? 0))
    const L = ens(isin)
    while (stk > 1e-10 && L.length) {
      const lot = L[0]
      const take = Math.min(stk, lot.stk)
      const frac = take / lot.stk
      lot.stk = rundeStueck(lot.stk - take)
      lot.cost = r2(lot.cost * (1 - frac))
      stk = rundeStueck(stk - take)
      if (lot.stk < 1e-8) L.shift()
    }
  }
}
// spin child
{
  const pLots = lots.get('US78409V1044') ?? []
  const pStk = pLots.reduce((s, l) => s + l.stk, 0)
  if (pStk > 0) ens('US60744M1062').push({ stk: pStk, cost: 184.16, ti: false, d: '2026-07-01', name: 'Mobility' })
}

const openTiLots = []
for (const [isin, L] of lots) {
  for (const l of L) {
    if (l.stk > 1e-8 && l.ti && l.cost > 0.01) openTiLots.push({ isin, ...l, cost: r2(l.cost) })
  }
}
openTiLots.sort((a, b) => b.cost - a.cost)
console.log('open TI lots', openTiLots.length, 'sum', r2(openTiLots.reduce((s, l) => s + l.cost, 0)))

// subset sum for GAP among TI lots (small n)
function findSubset(items, target, tol = 0.51) {
  const n = items.length
  if (n > 22) return null // too big
  const results = []
  const limit = 1 << n
  for (let mask = 1; mask < limit; mask++) {
    let s = 0
    const pick = []
    for (let i = 0; i < n; i++) {
      if (mask & (1 << i)) {
        s += items[i].cost
        pick.push(items[i])
      }
    }
    if (Math.abs(s - target) <= tol) results.push({ s: r2(s), pick })
    if (results.length >= 5) break
  }
  return results
}
const subset = findSubset(openTiLots, GAP)
console.log('TI subset = GAP', subset)

// Also: all open position costs near GAP
for (const p of open) {
  if (Math.abs(p.cost - GAP) < 2) console.log('pos=gap', p)
}

// Sum of sold Mobility proceeds vs cost?
const mob = rows.filter((b) => b.isin === 'US60744M1062')
console.log(
  'mobility bookings',
  mob.map((b) => ({
    d: b.datum,
    typ: b.typ,
    p: b.parqet_typ,
    stk: b.stueck,
    betrag: b.betrag_eur,
    kurs: b.kurs_eur,
    hw: hw(b),
    q: b.quelle,
  })),
)

// SPGI spin cost 184.16 — remaining?
const spgi = open.find((p) => p.isin === 'US78409V1044')
console.log('SPGI open', spgi)

// What if Parqet never added child cost AND still reduced parent (net -184.16 vs our +0 after sell child)?
// After Mobility sold: our cost basis: parent -184 + child +184 - child sold = parent-184, child 0. Same as never spinning for Investiert total.
// Unless child sold proceeds removed wrong cost...

// Check: sum of ALL kauf betrag - verkauf original cost style with betrag for sells incorrectly?
console.log({ APP, PARQET, GAP, check: r2(APP - GAP) })
