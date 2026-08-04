/**
 * Kosten der „Zombie“-Positionen (nicht in den Top-40 / Turbos / Mini-Reste)
 * node scripts/parqet-zombie-cost.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const PARQET = 78803.78
const APP = 80332.14
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

function kaufwert(b) {
  const stk = Math.abs(b.stueck ?? 0)
  const betrag = Math.abs(b.betrag_eur)
  if (stk > 1.01 && b.kurs_eur > 0 && Math.abs(betrag - b.kurs_eur) <= 0.05) return r2(stk * b.kurs_eur)
  if (stk > 0 && b.kurs_eur > 0) {
    const hw = r2(stk * b.kurs_eur)
    if (hw < betrag - 0.02 || Math.abs(hw - betrag) <= 0.02) return hw
  }
  return r2(betrag)
}

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
      const cur = map.get(isin) ?? { stk: 0, cost: 0, name: b.wertpapier_name || isin }
      let stk = rundeStueck(Math.abs(b.stueck ?? 0))
      const cost = kaufwert(b)
      if (stk <= 0 && b.kurs_eur > 0) stk = rundeStueck(cost / b.kurs_eur)
      cur.stk += stk
      cur.cost += cost
      if (b.wertpapier_name) cur.name = b.wertpapier_name
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
    if (p?.stk > 0) {
      const c = map.get('US60744M1062') ?? { stk: 0, cost: 0, name: 'Mobility' }
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

const pos = [...map.entries()]
  .map(([isin, v]) => ({
    isin,
    name: (v.name || '').slice(0, 40),
    stk: rundeStueck(v.stk),
    cost: r2(v.cost),
  }))
  .filter((p) => p.stk > 1e-8)
  .sort((a, b) => b.cost - a.cost)

const total = r2(pos.reduce((s, p) => s + p.cost, 0))
const top40 = pos.slice(0, 40)
const rest = pos.slice(40)
const top40cost = r2(top40.reduce((s, p) => s + p.cost, 0))
const restCost = r2(rest.reduce((s, p) => s + p.cost, 0))

// suspicious: tiny stk or turbo-like or no name
const suspicious = pos.filter(
  (p) =>
    p.stk < 0.5 ||
    /turbo|mini|knock|hebel|warrant/i.test(p.name) ||
    p.name === p.isin ||
    p.isin.startsWith('DE000K') ||
    p.isin.startsWith('DE000H'),
)
const susCost = r2(suspicious.reduce((s, p) => s + p.cost, 0))

console.log(
  JSON.stringify(
    {
      total,
      n: pos.length,
      top40cost,
      rest8: rest,
      restCost,
      totalMinusRest: r2(total - restCost),
      deltaTop40ToParqet: r2(top40cost - PARQET),
      suspicious,
      susCost,
      totalMinusSus: r2(total - susCost),
      deltaSusToParqet: r2(total - susCost - PARQET),
      gapAppParqet: r2(APP - PARQET),
    },
    null,
    2,
  ),
)
