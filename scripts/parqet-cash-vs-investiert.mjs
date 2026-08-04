/**
 * Prüft: Parqet Investiert = Einstand + Cash (auch negativ)?
 * node scripts/parqet-cash-vs-investiert.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)

// Inline minimal cash/einstand mirroring bestand.ts logic via ts-node is hard;
// use the existing nachrechnen script pattern from verify.

const PARQET = 78803.78
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

const r2 = (n) => Math.round(n * 100) / 100
const rundeStueck = (n) => Math.round(n * 1e8) / 1e8

function istTI(b) {
  return /^transferin$/i.test((b.parqet_typ ?? '').trim())
}
function istAktiendiv(b) {
  if (b.typ !== 'kauf') return false
  if (istTI(b) && b.betrag_eur > 0 && Math.abs(b.stueck ?? 0) > 0) return true
  const t = `${b.wertpapier_name ?? ''} ${b.parqet_typ ?? ''}`.toLowerCase()
  return /wahl[\s-]?dividend|aktiendividend|stock[\s_-]?dividend/.test(t)
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
function cashBetrag(b) {
  // healed cash for buy/sell
  if (b.typ === 'kauf' || b.typ === 'verkauf') return hw(b)
  return r2(Math.abs(b.betrag_eur))
}

const map = new Map()
let cash = 0
const feeByDay = new Map()

for (const b of rows) {
  if (b.typ === 'gebuehr' || b.parqet_typ === 'Fee' || b.parqet_typ === 'Taxes') {
    const list = feeByDay.get(b.datum) ?? []
    list.push(b)
    feeByDay.set(b.datum, list)
  }
}

const byDay = new Map()
for (const b of rows) {
  const list = byDay.get(b.datum) ?? []
  list.push(b)
  byDay.set(b.datum, list)
}

for (const [tag, dayRows] of [...byDay.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
  for (const b of dayRows) {
    const isin = b.isin?.toUpperCase()
    const typ = b.typ
    const ptyp = b.parqet_typ

    if (typ === 'einzahlung') {
      cash += Math.abs(b.betrag_eur)
      continue
    }
    if (typ === 'auszahlung') {
      cash -= Math.abs(b.betrag_eur)
      continue
    }
    if (typ === 'dividende' || ptyp === 'Dividend' || ptyp === 'Interest') {
      cash += Math.abs(b.betrag_eur)
      continue
    }
    if (typ === 'gebuehr' || ptyp === 'Fee' || ptyp === 'Taxes') {
      cash -= Math.abs(b.betrag_eur)
      continue
    }
    if (ptyp === 'SpinOffCost') {
      if (isin) {
        const cur = map.get(isin)
        if (cur) cur.kosten = r2(Math.max(0, cur.kosten - b.betrag_eur))
      }
      continue
    }
    if (typ === 'kauf' && isin) {
      const cur = map.get(isin) ?? { stueck: 0, kosten: 0 }
      let stk = rundeStueck(Math.abs(b.stueck ?? 0))
      const kost = hw(b)
      if (stk <= 0 && b.kurs_eur > 0) stk = rundeStueck(kost / b.kurs_eur)
      cur.stueck += stk
      cur.kosten += kost
      map.set(isin, cur)
      // TransferIn / Aktiendiv: no cash out
      if (!istTI(b) && !istAktiendiv(b)) cash -= cashBetrag(b)
      continue
    }
    if (typ === 'verkauf' && isin) {
      const cur = map.get(isin)
      const stk = rundeStueck(Math.abs(b.stueck ?? 0))
      if (cur && cur.stueck > 0) {
        const anteil = Math.min(1, stk / cur.stueck)
        cur.kosten = r2(cur.kosten * (1 - anteil))
        cur.stueck = Math.max(0, cur.stueck - stk)
      }
      cash += cashBetrag(b)
      continue
    }
  }
  // synthetic spin child
  if (tag === '2026-07-01') {
    const p = map.get('US78409V1044')
    if (p?.stueck > 0) {
      const c = map.get('US60744M1062') ?? { stueck: 0, kosten: 0 }
      c.stueck += p.stueck
      c.kosten += 184.16
      map.set('US60744M1062', c)
    }
  }
  if (tag === '2025-12-18') {
    const p = map.get('US81762P1021')
    if (p) p.stueck = rundeStueck(p.stueck * 5)
  }
}

const einstand = r2([...map.values()].reduce((s, v) => s + (v.stueck > 1e-8 ? v.kosten : 0), 0))
cash = r2(cash)
const appInvestiert = r2(einstand + Math.max(0, cash))
const parqetStyleNegCash = r2(einstand + cash)
const gap = r2(appInvestiert - PARQET)

console.log(
  JSON.stringify(
    {
      einstand,
      cash,
      appInvestiert_max0cash: appInvestiert,
      einstandPlusCash_allowNeg: parqetStyleNegCash,
      PARQET,
      delta_app: gap,
      delta_allowNeg: r2(parqetStyleNegCash - PARQET),
      cashNeededForExactMatch: r2(PARQET - einstand),
      note:
        Math.abs(parqetStyleNegCash - PARQET) < 5
          ? 'MATCH: Parqet scheint Einstand+Cash (negativ) zu zeigen'
          : 'kein Cash-Match',
    },
    null,
    2,
  ),
)

// Also search bookings whose amount equals gap
const hits = rows.filter((b) => Math.abs(Math.abs(b.betrag_eur) - gap) < 0.5)
console.log(
  'bookings ≈ gap',
  hits.map((b) => ({
    d: b.datum,
    typ: b.typ,
    p: b.parqet_typ,
    isin: b.isin,
    betrag: b.betrag_eur,
    name: b.wertpapier_name,
  })),
)
