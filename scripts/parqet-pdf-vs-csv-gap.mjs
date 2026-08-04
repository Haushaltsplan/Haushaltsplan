/**
 * Erklärt 1528 € Lücke: PDF-Buchungen die Parqet (CSV/Broker) evtl. nicht hat?
 * node scripts/parqet-pdf-vs-csv-gap.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const PARQET = 78803.78
const APP = 80332.14
const GAP = 1528.36
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

function run(filter) {
  const map = new Map()
  const byDay = new Map()
  for (const b of rows) {
    if (!filter(b)) continue
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
    // synthetic spin only if parent bookings included
    if (tag === '2026-07-01' && filter({ datum: tag, typ: 'sonstiges', parqet_typ: 'SpinOffCost', isin: 'US78409V1044', quelle: 'csv' })) {
      const p = map.get('US78409V1044')
      // only add child if we have spin cost in this filter set — check rows
    }
    if (tag === '2025-12-18') {
      const p = map.get('US81762P1021')
      if (p) p.stk = rundeStueck(p.stk * 5)
    }
  }
  // add synth child if spin cost present in filtered set
  const hasSpin = rows.some((b) => filter(b) && b.parqet_typ === 'SpinOffCost' && b.isin === 'US78409V1044')
  const hasMobilityBuy = rows.some((b) => filter(b) && b.typ === 'kauf' && b.isin === 'US60744M1062')
  if (hasSpin && !hasMobilityBuy) {
    const p = map.get('US78409V1044')
    if (p?.stk > 0) {
      const c = map.get('US60744M1062') ?? { stk: 0, cost: 0 }
      c.stk += p.stk
      c.cost += 184.16
      map.set('US60744M1062', c)
      // re-apply mobility sales if in filter
      for (const b of rows) {
        if (!filter(b) || b.typ !== 'verkauf' || b.isin !== 'US60744M1062') continue
        const cur = map.get('US60744M1062')
        if (!cur || cur.stk <= 0) continue
        let stk = rundeStueck(Math.abs(b.stueck ?? 0))
        const anteil = Math.min(1, stk / cur.stk)
        cur.cost = r2(cur.cost * (1 - anteil))
        cur.stk = Math.max(0, cur.stk - stk)
      }
    }
  }
  const einstand = r2([...map.values()].reduce((s, v) => s + (v.stk > 1e-8 ? v.cost : 0), 0))
  const n = [...map.values()].filter((v) => v.stk > 1e-8).length
  return { einstand, n }
}

const all = run(() => true)
const csvOnly = run((b) => b.quelle !== 'pdf')
const csvPlusSpinSales = run((b) => b.quelle !== 'pdf' || b.isin === 'US60744M1062')

// Sum PDF buys (absolute)
const pdfBuys = rows.filter((b) => b.quelle === 'pdf' && b.typ === 'kauf')
const pdfBuySum = r2(pdfBuys.reduce((s, b) => s + hw(b), 0))
const pdfSells = rows.filter((b) => b.quelle === 'pdf' && b.typ === 'verkauf')

// Duplicate check: PDF buy that also exists as CSV same day/isin/approx stueck
function nearly(a, b) {
  return Math.abs(a - b) < 1e-4
}
const csvTrades = rows.filter((b) => b.quelle !== 'pdf' && (b.typ === 'kauf' || b.typ === 'verkauf'))
const pdfOnlyBuys = []
for (const b of pdfBuys) {
  const dup = csvTrades.some(
    (c) =>
      c.typ === 'kauf' &&
      c.isin === b.isin &&
      c.datum === b.datum &&
      nearly(Math.abs(c.stueck ?? 0), Math.abs(b.stueck ?? 0)),
  )
  if (!dup) pdfOnlyBuys.push(b)
}
const pdfOnlyBuySum = r2(pdfOnlyBuys.reduce((s, b) => s + hw(b), 0))

// Last CSV date vs last PDF
const lastCsv = rows.filter((b) => b.quelle !== 'pdf').reduce((m, b) => (b.datum > m ? b.datum : m), '')
const lastPdf = rows.filter((b) => b.quelle === 'pdf').reduce((m, b) => (b.datum > m ? b.datum : m), '')
const firstPdf = rows.filter((b) => b.quelle === 'pdf').reduce((m, b) => (b.datum < m || !m ? b.datum : m), '')

console.log(
  JSON.stringify(
    {
      PARQET,
      APP,
      GAP,
      all,
      csvOnly,
      deltaAllMinusCsv: r2(all.einstand - csvOnly.einstand),
      csvOnlyDeltaToParqet: r2(csvOnly.einstand - PARQET),
      pdfBuySum,
      pdfOnlyBuySum,
      pdfOnlyBuyCount: pdfOnlyBuys.length,
      lastCsv,
      firstPdf,
      lastPdf,
      matchHint:
        Math.abs(csvOnly.einstand - PARQET) < 50
          ? 'CSV-only ≈ Parqet → PDF-Importe erklären die Lücke'
          : Math.abs(r2(all.einstand - pdfOnlyBuySum) - PARQET) < 50
            ? 'App − PDF-only-Buys ≈ Parqet'
            : 'teilweise / andere Ursache',
      appMinusPdfOnlyBuys: r2(all.einstand - pdfOnlyBuySum),
    },
    null,
    2,
  ),
)

// If csvOnly still high, list PDF buys after lastCsv
const afterCsv = pdfOnlyBuys.filter((b) => b.datum > lastCsv)
console.log(
  'pdf-only buys after last CSV date',
  afterCsv.length,
  r2(afterCsv.reduce((s, b) => s + hw(b), 0)),
)

const beforeOrOn = pdfOnlyBuys.filter((b) => b.datum <= lastCsv)
console.log(
  'pdf-only buys on/before last CSV',
  beforeOrOn.length,
  r2(beforeOrOn.reduce((s, b) => s + hw(b), 0)),
  beforeOrOn.slice(0, 15).map((b) => ({ d: b.datum, isin: b.isin, hw: hw(b), stk: b.stueck })),
)

// Monthly pdf-only buy sums
const byMonth = new Map()
for (const b of pdfOnlyBuys) {
  const m = b.datum.slice(0, 7)
  byMonth.set(m, r2((byMonth.get(m) ?? 0) + hw(b)))
}
console.log('pdf-only by month', Object.fromEntries(byMonth))
