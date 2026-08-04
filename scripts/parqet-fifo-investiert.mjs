/**
 * FIFO-Einstand offener Positionen — Abgleich Parqet 78.803,78 €
 * node scripts/parqet-fifo-investiert.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve } from 'path'

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

function istTI(b) {
  return /^transferin$/i.test((b.parqet_typ ?? '').trim())
}

function kaufwert(b) {
  const stk = Math.abs(b.stueck ?? 0)
  const betrag = Math.abs(b.betrag_eur)
  if (stk > 1.01 && b.kurs_eur > 0 && Math.abs(betrag - b.kurs_eur) <= 0.05) {
    return r2(stk * b.kurs_eur)
  }
  if (stk > 0 && b.kurs_eur > 0) {
    const hw = r2(stk * b.kurs_eur)
    // Parqet amount oft = Handelswert; fee separat — nimm HW wenn nahe
    if (Math.abs(hw - betrag) <= 0.05) return hw
    // Brutto mit Fee: Parqet Investiert = Kaufwert ohne Ordergebühr?
    if (hw < betrag - 0.02) return hw
  }
  return r2(betrag)
}

/** lots: {stk, costPerUnit, costTotal} FIFO */
const books = new Map()

function book(isin) {
  if (!books.has(isin)) books.set(isin, [])
  return books.get(isin)
}

function addLot(isin, stk, costTotal) {
  stk = rundeStueck(stk)
  if (stk <= 0) return
  const cpu = costTotal / stk
  book(isin).push({ stk, cpu, cost: r2(costTotal) })
}

function reduceCost(isin, amount) {
  const lots = book(isin)
  let total = lots.reduce((s, l) => s + l.cost, 0)
  if (total <= 0 || amount <= 0) return
  const cut = Math.min(amount, total)
  for (const l of lots) {
    const share = l.cost / total
    l.cost = r2(l.cost - cut * share)
    if (l.stk > 0) l.cpu = l.cost / l.stk
  }
}

function sellFifo(isin, stk) {
  stk = rundeStueck(stk)
  const lots = book(isin)
  while (stk > 1e-10 && lots.length) {
    const lot = lots[0]
    const take = Math.min(stk, lot.stk)
    const frac = take / lot.stk
    lot.stk = rundeStueck(lot.stk - take)
    lot.cost = r2(lot.cost * (1 - frac))
    stk = rundeStueck(stk - take)
    if (lot.stk < 1e-8) lots.shift()
  }
}

function totalCost() {
  let s = 0
  for (const lots of books.values()) {
    for (const l of lots) if (l.stk > 1e-8) s += l.cost
  }
  return r2(s)
}

const heute = new Date().toISOString().slice(0, 10)
const sortiert = rows.filter((b) => b.datum <= heute).sort((a, b) => {
  const c = a.datum.localeCompare(b.datum)
  if (c !== 0) return c
  // Käufe vor Verkäufen am selben Tag
  const rank = (t) => (t === 'kauf' ? 0 : t === 'sonstiges' ? 1 : t === 'verkauf' ? 2 : 3)
  return rank(a.typ) - rank(b.typ)
})

for (const b of sortiert) {
  const isin = b.isin?.toUpperCase()
  if (b.typ === 'kauf' && isin) {
    let stk = rundeStueck(Math.abs(b.stueck ?? 0))
    const cost = kaufwert(b)
    if (stk <= 0 && b.kurs_eur > 0) stk = rundeStueck(cost / b.kurs_eur)
    if (stk > 0) addLot(isin, stk, cost)
  } else if (b.parqet_typ === 'SpinOffCost' && isin) {
    reduceCost(isin, b.betrag_eur)
  } else if (b.typ === 'verkauf' && isin) {
    let stk = rundeStueck(Math.abs(b.stueck ?? 0))
    if (stk <= 0 && b.kurs_eur > 0) stk = rundeStueck(Math.abs(b.betrag_eur) / b.kurs_eur)
    if (stk > 0) sellFifo(isin, stk)
  }

  // Spin-off after day's SpinOffCost — handle when we see the date change... do at end of 2026-07-01
}

// Re-process with day boundary for spin
books.clear()
const byDay = new Map()
for (const b of sortiert) {
  const list = byDay.get(b.datum) ?? []
  list.push(b)
  byDay.set(b.datum, list)
}

for (const [tag, dayRows] of [...byDay.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
  for (const b of dayRows) {
    const isin = b.isin?.toUpperCase()
    if (b.typ === 'kauf' && isin) {
      let stk = rundeStueck(Math.abs(b.stueck ?? 0))
      const cost = kaufwert(b)
      if (stk <= 0 && b.kurs_eur > 0) stk = rundeStueck(cost / b.kurs_eur)
      if (stk > 0) addLot(isin, stk, cost)
    } else if (b.parqet_typ === 'SpinOffCost' && isin) {
      reduceCost(isin, b.betrag_eur)
    } else if (b.typ === 'verkauf' && isin) {
      let stk = rundeStueck(Math.abs(b.stueck ?? 0))
      const betrag = Math.abs(b.betrag_eur)
      if (stk > 1.01 && b.kurs_eur > 0 && Math.abs(betrag - b.kurs_eur) <= 0.05) {
        // healed: still sell stk shares
      } else if (stk < 0.999 && b.kurs_eur > 0 && Math.abs(betrag - b.kurs_eur) <= 0.05) {
        // ok
      }
      if (stk <= 0 && b.kurs_eur > 0) stk = rundeStueck(betrag / b.kurs_eur)
      if (stk > 0) sellFifo(isin, stk)
    }
  }

  if (tag === '2026-07-01') {
    const parentLots = book('US78409V1044')
    const parentStk = parentLots.reduce((s, l) => s + l.stk, 0)
    if (parentStk > 0) {
      // Kind bekommt SpinOffCost als Einstand (Parent schon reduziert)
      addLot('US60744M1062', parentStk, 184.16)
    }
  }
  if (tag === '2025-12-18') {
    for (const l of book('US81762P1021')) {
      l.stk = rundeStueck(l.stk * 5)
      l.cpu = l.stk > 0 ? l.cost / l.stk : 0
    }
  }
}

const fifo = totalCost()

// Average-cost comparison (App)
function avgCost() {
  const map = new Map()
  for (const [tag, dayRows] of [...byDay.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    for (const b of dayRows) {
      const isin = b.isin?.toUpperCase()
      if (b.typ === 'kauf' && isin) {
        const cur = map.get(isin) ?? { stk: 0, cost: 0 }
        let stk = rundeStueck(Math.abs(b.stueck ?? 0))
        const cost = kaufwert(b)
        if (stk <= 0 && b.kurs_eur > 0) stk = rundeStueck(cost / b.kurs_eur)
        cur.stk += stk
        cur.cost += cost
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
        cur.stk = Math.max(0, cur.stk - stk)
      }
    }
    if (tag === '2026-07-01') {
      const p = map.get('US78409V1044')
      if (p && p.stk > 0) {
        const c = map.get('US60744M1062') ?? { stk: 0, cost: 0 }
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
  let s = 0
  for (const v of map.values()) if (v.stk > 1e-8) s += v.cost
  return r2(s)
}

const avg = avgCost()

// Variant: FIFO but Kaufwert = betrag (brutto inkl. Fee)
books.clear()
for (const [tag, dayRows] of [...byDay.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
  for (const b of dayRows) {
    const isin = b.isin?.toUpperCase()
    if (b.typ === 'kauf' && isin) {
      let stk = rundeStueck(Math.abs(b.stueck ?? 0))
      let cost = r2(Math.abs(b.betrag_eur))
      if (stk > 1.01 && b.kurs_eur > 0 && Math.abs(cost - b.kurs_eur) <= 0.05) cost = r2(stk * b.kurs_eur)
      if (stk <= 0 && b.kurs_eur > 0) stk = rundeStueck(cost / b.kurs_eur)
      if (stk > 0) addLot(isin, stk, cost)
    } else if (b.parqet_typ === 'SpinOffCost' && isin) {
      reduceCost(isin, b.betrag_eur)
    } else if (b.typ === 'verkauf' && isin) {
      let stk = rundeStueck(Math.abs(b.stueck ?? 0))
      if (stk > 0) sellFifo(isin, stk)
    }
  }
  if (tag === '2026-07-01') {
    const parentStk = book('US78409V1044').reduce((s, l) => s + l.stk, 0)
    if (parentStk > 0) addLot('US60744M1062', parentStk, 184.16)
  }
  if (tag === '2025-12-18') {
    for (const l of book('US81762P1021')) {
      l.stk = rundeStueck(l.stk * 5)
      l.cpu = l.stk > 0 ? l.cost / l.stk : 0
    }
  }
}
const fifoBetrag = totalCost()

console.log(
  JSON.stringify(
    {
      parqet: PARQET,
      fifo_handelswert: fifo,
      fifo_betrag: fifoBetrag,
      avg_handelswert: avg,
      delta_fifo_hw: r2(fifo - PARQET),
      delta_fifo_betrag: r2(fifoBetrag - PARQET),
      delta_avg: r2(avg - PARQET),
      avg_minus_fifo: r2(avg - fifo),
    },
    null,
    2,
  ),
)
