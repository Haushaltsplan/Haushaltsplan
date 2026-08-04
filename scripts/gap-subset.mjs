/**
 * Subset-Suche: welche Beträge ergeben exakt 1528.36?
 * node scripts/gap-subset.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const GAP = 1528.36
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

const ti = rows
  .filter((b) => /^transferin$/i.test((b.parqet_typ ?? '').trim()))
  .map((b) => ({
    d: b.datum,
    isin: b.isin,
    betrag: r2(Math.abs(b.betrag_eur)),
    stk: b.stueck,
    name: (b.wertpapier_name || '').slice(0, 36),
    q: b.quelle,
  }))
  .sort((a, b) => b.betrag - a.betrag)

console.log('all TI', ti.length, 'sum', r2(ti.reduce((s, t) => s + t.betrag, 0)))
console.log(ti)

// pairs / triples of TI = GAP
for (let i = 0; i < ti.length; i++) {
  if (Math.abs(ti[i].betrag - GAP) < 0.02) console.log('SINGLE', ti[i])
  for (let j = i + 1; j < ti.length; j++) {
    const s2 = r2(ti[i].betrag + ti[j].betrag)
    if (Math.abs(s2 - GAP) < 0.02) console.log('PAIR', s2, ti[i], ti[j])
    for (let k = j + 1; k < ti.length; k++) {
      const s3 = r2(ti[i].betrag + ti[j].betrag + ti[k].betrag)
      if (Math.abs(s3 - GAP) < 0.02) console.log('TRIPLE', s3, ti[i].isin, ti[j].isin, ti[k].isin, ti[i].betrag, ti[j].betrag, ti[k].betrag)
    }
  }
}

// Any two open position costs = GAP? (from earlier list we need costs)
// Also: Mobility healed proceeds 1789.2 - something
console.log('1789.2 - 184.16 =', r2(1789.2 - 184.16))
console.log('1789.2 - 260.84 =', r2(1789.2 - 260.84))
console.log('GAP - 184.16 =', r2(GAP - 184.16))

// Sales with wrong (unhealed) betrag that Parqet might still have correct
const suspiciousSales = rows.filter(
  (b) =>
    b.typ === 'verkauf' &&
    b.stueck != null &&
    Math.abs(b.stueck) > 1.01 &&
    b.kurs_eur > 0 &&
    Math.abs(Math.abs(b.betrag_eur) - b.kurs_eur) <= 0.05,
)
console.log(
  'unhealed sales',
  suspiciousSales.map((b) => ({
    d: b.datum,
    isin: b.isin,
    stk: b.stueck,
    betrag: b.betrag_eur,
    kurs: b.kurs_eur,
    healed: r2(Math.abs(b.stueck) * b.kurs_eur),
    delta: r2(Math.abs(b.stueck) * b.kurs_eur - Math.abs(b.betrag_eur)),
    name: b.wertpapier_name,
  })),
)

// If Parqet removed SALE PROCEEDS instead of cost basis for Mobility:
// Investiert would drop by proceeds not by 184.16
// drop_extra = proceeds - cost = 1789.2 - 184.16 = 1605 — close to 1528 but not exact

// What if Parqet cost basis for Mobility was higher?
// If drop_extra = 1528.36, then Parqet removed 1528.36 too much vs us
// We remove cost C on sell; they remove proceeds P → gap = P - C
// 1528.36 = P - C → if P = 1789.2, C = 260.84
console.log('implied Parqet mobility cost if they subtract proceeds', r2(1789.2 - GAP))

// Or both sales: 1789.2 + 5.99 = 1795.19
console.log('both sales proceeds', r2(1789.2 + 5.99), 'minus gap cost', r2(1789.2 + 5.99 - GAP))
