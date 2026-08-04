/**
 * Diagnose Gebühren- und Einstand-Komponenten.
 * node scripts/diagnose-gebuehren.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve } from 'path'

function loadEnv() {
  const raw = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8')
  const env = {}
  for (const line of raw.split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (!m) continue
    env[m[1]] = m[2].replace(/^"|"$/g, '')
  }
  return env
}

const env = loadEnv()
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const r2 = (n) => Math.round(n * 100) / 100

let rows = []
let offset = 0
while (true) {
  const { data, error } = await sb
    .from('portfolio_analyse_buchung')
    .select('datum,typ,isin,stueck,kurs_eur,betrag_eur,steuer_eur,parqet_typ,wertpapier_name,quelle')
    .order('datum')
    .range(offset, offset + 999)
  if (error) throw error
  if (!data?.length) break
  rows.push(...data)
  if (data.length < 1000) break
  offset += 1000
}

let explizit = 0
let buySpread = 0
let sellSpread = 0
let sellTaxInSpread = 0
let buyNoise = 0
let buyViaFeeIndex = 0
const buyBig = []
const sellBig = []

const feeIndex = new Map()
const gebuehrOnly = new Map()
for (const b of rows) {
  if (b.typ !== 'gebuehr' && b.typ !== 'steuer') continue
  const k = `${b.datum}|${(b.isin || '').toUpperCase()}`
  feeIndex.set(k, r2((feeIndex.get(k) || 0) + b.betrag_eur))
  if (b.typ === 'gebuehr') gebuehrOnly.set(k, r2((gebuehrOnly.get(k) || 0) + b.betrag_eur))
}

for (const b of rows) {
  if (b.typ === 'gebuehr') {
    explizit += b.betrag_eur
    continue
  }
  const stk = Math.abs(b.stueck || 0)
  if (stk <= 0 || !(b.kurs_eur > 0)) continue
  const hw = r2(stk * b.kurs_eur)
  if (b.typ === 'kauf' && b.betrag_eur > hw + 0.01) {
    const s = r2(b.betrag_eur - hw)
    buySpread += s
    if (s <= 1) buyNoise += s
    if (s > 5) buyBig.push({ d: b.datum, isin: b.isin, s, betrag: b.betrag_eur, hw, kurs: b.kurs_eur, stk })
  } else if (b.typ === 'kauf') {
    const fees = feeIndex.get(`${b.datum}|${(b.isin || '').toUpperCase()}`) || 0
    if (fees > 0 && Math.abs(hw - b.betrag_eur) <= 0.02) {
      buyViaFeeIndex += Math.min(fees, Math.max(0, b.betrag_eur - (b.betrag_eur - fees)))
    }
  }
  if (b.typ === 'verkauf' && hw > b.betrag_eur + 0.01) {
    const s = r2(hw - b.betrag_eur)
    sellSpread += s
    const tax = b.steuer_eur || 0
    if (tax > 0) sellTaxInSpread += Math.min(s, tax)
    if (s > 5) {
      sellBig.push({
        d: b.datum,
        isin: b.isin,
        s,
        betrag: b.betrag_eur,
        hw,
        tax,
        stk,
        kurs: b.kurs_eur,
        name: (b.wertpapier_name || '').slice(0, 40),
      })
    }
  }
}

// Doppel: explizite Gebühr + Spread gleiches Datum/ISIN
let doubleCount = 0
for (const b of rows) {
  if (b.typ !== 'kauf' && b.typ !== 'verkauf') continue
  const stk = Math.abs(b.stueck || 0)
  if (stk <= 0 || !(b.kurs_eur > 0)) continue
  const hw = r2(stk * b.kurs_eur)
  const spread =
    b.typ === 'kauf' && b.betrag_eur > hw + 0.01
      ? r2(b.betrag_eur - hw)
      : b.typ === 'verkauf' && hw > b.betrag_eur + 0.01
        ? r2(hw - b.betrag_eur)
        : 0
  if (spread <= 0) continue
  const g = gebuehrOnly.get(`${b.datum}|${(b.isin || '').toUpperCase()}`) || 0
  if (g > 0) doubleCount += Math.min(g, spread)
}

// Falscher Einstand-Strip (netto Kauf − feeIndex)
let wrongStrip = 0
let wrongN = 0
for (const b of rows) {
  if (b.typ !== 'kauf') continue
  const stk = Math.abs(b.stueck || 0)
  if (!(stk > 0 && b.kurs_eur > 0)) continue
  const hw = r2(stk * b.kurs_eur)
  if (Math.abs(hw - b.betrag_eur) > 0.02) continue
  const fees = feeIndex.get(`${b.datum}|${(b.isin || '').toUpperCase()}`) || 0
  if (fees > 0) {
    wrongStrip += fees
    wrongN++
  }
}

console.log(
  JSON.stringify(
    {
      buchungen: rows.length,
      explizit: r2(explizit),
      buySpread: r2(buySpread),
      sellSpread: r2(sellSpread),
      sellTaxInSpread: r2(sellTaxInSpread),
      buyNoiseTiny: r2(buyNoise),
      doubleCountSpreadPlusGebuehr: r2(doubleCount),
      wrongEinstandStrip: r2(wrongStrip),
      wrongN,
      totalCurrentFees: r2(explizit + buySpread + sellSpread),
      feesWithoutSellTax: r2(explizit + buySpread + sellSpread - sellTaxInSpread),
      feesDeduped: r2(explizit + buySpread + sellSpread - doubleCount - sellTaxInSpread),
    },
    null,
    2,
  ),
)
console.log('top buy spreads', buyBig.sort((a, b) => b.s - a.s).slice(0, 12))
console.log('top sell spreads', sellBig.sort((a, b) => b.s - a.s).slice(0, 12))
