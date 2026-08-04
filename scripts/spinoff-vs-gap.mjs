/**
 * Spin-off-Effekt vs. Parqet-Lücke 1528 €
 * node scripts/spinoff-vs-gap.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const PARQET = 78803.78
const APP = 80332.14
const GAP = 1528.36
const SPIN_COST = 184.16
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

function einstand(opts) {
  const { useSpinCost = true, synthChild = true, doublePct = false, excludePdfBuys = false } = opts
  const map = new Map()
  const byDay = new Map()
  for (const b of rows) {
    if (excludePdfBuys && b.quelle === 'pdf' && b.typ === 'kauf') continue
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
      } else if (b.parqet_typ === 'SpinOffCost' && useSpinCost && isin) {
        const cur = map.get(isin)
        if (cur) cur.cost = r2(Math.max(0, cur.cost - b.betrag_eur))
      } else if (b.typ === 'verkauf' && isin) {
        const cur = map.get(isin)
        if (!cur || cur.stk <= 0) continue
        let stk = rundeStueck(Math.abs(b.stueck ?? 0))
        // wrong: subtract proceeds instead of cost share
        if (opts.sellSubtractProceeds && isin === 'US60744M1062') {
          cur.cost = r2(Math.max(0, cur.cost - hw(b)))
          cur.stk = Math.max(0, cur.stk - stk)
        } else {
          const anteil = Math.min(1, stk / cur.stk)
          cur.cost = r2(cur.cost * (1 - anteil))
          cur.stk = Math.max(0, cur.stk - stk)
        }
      }
    }
    if (tag === '2026-07-01' && synthChild) {
      const p = map.get('US78409V1044')
      if (p?.stk > 0) {
        let childKosten = SPIN_COST
        if (doublePct) {
          // alter Bug: SpinOffCost + 5% zusätzlich
          const extra = r2(p.cost * 0.05)
          p.cost = r2(Math.max(0, p.cost - extra))
          childKosten = SPIN_COST // cost already cut by booking; still add child
        }
        if (!useSpinCost) {
          childKosten = r2(p.cost * 0.05)
          p.cost = r2(p.cost - childKosten)
        }
        const c = map.get('US60744M1062') ?? { stk: 0, cost: 0 }
        c.stk += p.stk
        c.cost += childKosten
        map.set('US60744M1062', c)
      }
    }
    if (tag === '2025-12-18') {
      const p = map.get('US81762P1021')
      if (p) p.stk = rundeStueck(p.stk * 5)
    }
  }
  return r2([...map.values()].reduce((s, v) => s + (v.stk > 1e-8 ? v.cost : 0), 0))
}

const variants = {
  app_korrekt: einstand({}),
  ohne_spin_komplett: einstand({ useSpinCost: false, synthChild: false }),
  nur_spinoffcost_kein_kind: einstand({ useSpinCost: true, synthChild: false }),
  alter_doppelbug: einstand({ doublePct: true }),
  parqet_zieht_erloes_ab: einstand({ sellSubtractProceeds: true }),
  ohne_pdf_kaeufe: einstand({ excludePdfBuys: true }),
}

const mobProceeds = r2(
  rows.filter((b) => b.isin === 'US60744M1062' && b.typ === 'verkauf').reduce((s, b) => s + hw(b), 0),
)

console.log(
  JSON.stringify(
    {
      PARQET,
      APP,
      GAP,
      SPIN_COST,
      mobProceeds,
      maxSpinEffekt_wenn_Kind_verkauft:
        'Nach Verkauf des Kindes ist korrekter Spin-off netto 0 auf Gesamt-Investiert (Parent−Cost, Kind+Cost, Sell−Cost). Fehler max ≈ SpinCost 184 € (Doppelkürzung) oder Erlöse−Cost ≈ ' +
        r2(mobProceeds - SPIN_COST) +
        ' € — beides ≠ 1528 €.',
      variants: Object.fromEntries(
        Object.entries(variants).map(([k, v]) => [k, { einstand: v, deltaParqet: r2(v - PARQET) }]),
      ),
    },
    null,
    2,
  ),
)
