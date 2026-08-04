/**
 * Suche Beträge nahe Teil-Lücken; Mobility-/PDF-Hypothesen.
 * node scripts/gap-search-amounts.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const GAP = 1528.36
const MOB_HEAL_DELTA = 1610.28 // 1789.2 - 178.92
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

const targets = [
  GAP,
  r2(GAP - 184.16),
  r2(MOB_HEAL_DELTA - GAP),
  r2(MOB_HEAL_DELTA),
  184.16,
  1789.2,
  178.92,
  260.84,
  535.66,
  587.76,
  635.96,
  822.91,
  216.72,
  81.92,
]

for (const t of targets) {
  const hits = rows.filter((b) => Math.abs(Math.abs(b.betrag_eur) - t) < 0.02)
  if (hits.length) {
    console.log(
      `\n=== ${t} (${hits.length}) ===`,
      hits.slice(0, 8).map((b) => ({
        d: b.datum,
        typ: b.typ,
        p: b.parqet_typ,
        isin: b.isin,
        betrag: b.betrag_eur,
        stk: b.stueck,
        name: (b.wertpapier_name || '').slice(0, 30),
      })),
    )
  } else {
    console.log(`no hit for ${t}`)
  }
}

// Hypothesis: Parqet Investiert lower because it still uses UNHEALED mobility sale
// somehow affecting cost? Unlikely.
// Alternative: App includes PDF gebuehr/sales that Parqet CSV doesn't have.

const pdfOnly = rows.filter((b) => b.quelle === 'pdf')
console.log('\npdf bookings', pdfOnly.length)
console.log(
  pdfOnly.map((b) => ({
    d: b.datum,
    typ: b.typ,
    isin: b.isin,
    betrag: b.betrag_eur,
    kurs: b.kurs_eur,
    stk: b.stueck,
    name: b.wertpapier_name,
  })),
)

// CSV rows for same ISIN/date as PDF?
const csvMob = rows.filter((b) => b.isin === 'US60744M1062' || (b.parqet_typ === 'SpinOffCost' && b.isin === 'US78409V1044'))
console.log('\nmob+spin', csvMob)

// Sum of ALL buy handelswerte open vs sum of holding purchase values if we ZERO cost for PDF-only remaining effects
// After Mobility fully sold, PDF sales shouldn't remain in Investiert.

// Check: are there buys only in PDF not in CSV?
const byKey = new Map()
for (const b of rows) {
  if (b.typ !== 'kauf' && b.typ !== 'verkauf') continue
  const k = `${b.datum}|${b.isin}|${b.typ}|${Math.abs(b.stueck ?? 0).toFixed(6)}`
  const cur = byKey.get(k) ?? { csv: 0, pdf: 0, betrag: [] }
  if (b.quelle === 'pdf') cur.pdf++
  else cur.csv++
  cur.betrag.push(b.betrag_eur)
  byKey.set(k, cur)
}
const pdfUnique = [...byKey.entries()].filter(([, v]) => v.pdf > 0 && v.csv === 0)
console.log('\npdf-unique trade keys', pdfUnique.length, pdfUnique.slice(0, 20))

// What if Parqet has SpinOffCost + TransferIn for Mobility with higher cost, and we don't have Mobility TransferIn?
const spinRelated = rows.filter(
  (b) =>
    b.isin === 'US60744M1062' ||
    b.isin === 'US78409V1044' ||
    /spin/i.test(b.parqet_typ || '') ||
    /spin|mobility|s&p global/i.test(b.wertpapier_name || ''),
)
console.log(
  '\nspin related count',
  spinRelated.length,
  spinRelated.map((b) => ({
    d: b.datum,
    typ: b.typ,
    p: b.parqet_typ,
    isin: b.isin,
    betrag: b.betrag_eur,
    stk: b.stueck,
    q: b.quelle,
  })),
)

console.log({
  GAP,
  healDelta: MOB_HEAL_DELTA,
  healMinusGap: r2(MOB_HEAL_DELTA - GAP),
  note: 'Wenn Parqet Verkaufserlös statt Einstand abzieht: Extra-Lücke ~1605, nicht 1528',
})
