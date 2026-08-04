/**
 * Welche Quellen haben Käufe ab Juni 2026?
 * node scripts/parqet-june-source.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const r2 = (n) => Math.round(n * 100) / 100
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

const from = rows.filter((b) => b.datum >= '2026-06-01')
const by = {}
for (const b of from) {
  const k = `${b.quelle || '?'}|${b.typ}|${b.parqet_typ || ''}`
  by[k] = (by[k] || 0) + 1
}
console.log('ab 2026-06', by)

const csvFromJune = from.filter((b) => b.quelle !== 'pdf')
console.log(
  'csv/non-pdf ab juni',
  csvFromJune.map((b) => ({
    d: b.datum,
    typ: b.typ,
    p: b.parqet_typ,
    isin: b.isin,
    betrag: b.betrag_eur,
    stk: b.stueck,
    q: b.quelle,
  })),
)

// Reconstruct: app einstand with FULL app logic via nachrechnen — compare
// Parqet-like = all except pdf buys (keep pdf sells for mobility + spin)
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

// App-like with spin fix (from abgleich script numbers we trust APP=80332.14)
// Variant: exclude PDF buys but keep PDF mobility sells + apply synth spin
const map = new Map()
const rundeStueck = (n) => Math.round(n * 1e8) / 1e8
const filtered = rows.filter((b) => {
  if (b.quelle === 'pdf' && b.typ === 'kauf') return false
  return true
})
const byDay = new Map()
for (const b of filtered) {
  const list = byDay.get(b.datum) ?? []
  list.push(b)
  byDay.set(b.datum, list)
}
for (const [tag, dayRows] of [...byDay.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
  for (const b of dayRows) {
    const isin = b.isin?.toUpperCase()
    if (b.typ === 'kauf' && isin) {
      const cur = map.get(isin) ?? { stk: 0, cost: 0 }
      let stk = rundeStueck(Math.abs(b.stueck ?? 0))
      const cost = hw(b)
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
    if (p?.stk > 0) {
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
// apply pdf mobility sells (already in filtered if we keep pdf sells)
const einstand = r2([...map.values()].reduce((s, v) => s + (v.stk > 1e-8 ? v.cost : 0), 0))
console.log({
  ohnePdfBuys_mitSpinUndPdfSells: einstand,
  PARQET: 78803.78,
  delta: r2(einstand - 78803.78),
  APP: 80332.14,
  pdfBuyContributionApprox: r2(80332.14 - einstand),
})
