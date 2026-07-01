/**
 * Diagnose: Parqet „Investiert“ vs. Einstand-Logik.
 * node scripts/investiert-diagnose.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve } from 'path'

function loadEnv() {
  const p = resolve(process.cwd(), '.env.local')
  const raw = readFileSync(p, 'utf8')
  const env = {}
  for (const line of raw.split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (!m) continue
    env[m[1]] = m[2].replace(/^"|"$/g, '')
  }
  return env
}

const env = loadEnv()
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

function round2(n) {
  return Math.round(n * 100) / 100
}

function istAktiendividendeAlsKauf(b) {
  if (!b.isin || b.typ !== 'kauf') return false
  const parqet = (b.parqet_typ ?? '').trim()
  const t = `${b.wertpapier_name ?? ''} ${parqet}`.toLowerCase()
  const stk = Math.abs(b.stueck ?? 0)
  if (/wahl[\s-]?dividend|aktiendividend|stock[\s_-]?dividend|dividende\s+in\s+aktien|ausschüttung\s+aktie/.test(t))
    return stk > 0
  if (/^transferin$/i.test(parqet) && stk > 0 && b.betrag_eur > 0) return true
  if (b.isin.toUpperCase() === 'DE0006580806' && stk > 0) {
    if (b.betrag_eur <= 0.01 && b.kurs_eur > 0) return true
    if (/ertrag|dividend|ausschütt|wahl/i.test(t)) return true
  }
  return false
}

function gebuehrSteuerIndex(rows) {
  const map = new Map()
  for (const b of rows) {
    if (b.typ !== 'gebuehr' && b.typ !== 'steuer') continue
    const isin = b.isin?.toUpperCase()
    if (!isin) continue
    const key = `${b.datum}|${isin}`
    map.set(key, round2((map.get(key) ?? 0) + b.betrag_eur))
  }
  return map
}

function kaufEinstandBetragEur(b, feeIndex) {
  if (istAktiendividendeAlsKauf(b)) {
    if (b.betrag_eur > 0) return round2(b.betrag_eur)
    const stk = Math.abs(b.stueck ?? 0)
    if (stk > 0 && b.kurs_eur > 0) return round2(stk * b.kurs_eur)
    return 0
  }
  const stk = Math.abs(b.stueck ?? 0)
  const handelFromKurs =
    stk > 0 && b.kurs_eur > 0 ? round2(stk * b.kurs_eur) : null
  if (handelFromKurs != null && handelFromKurs > 0 && handelFromKurs < b.betrag_eur - 0.02) {
    return handelFromKurs
  }
  const isin = b.isin?.toUpperCase()
  if (isin) {
    const fees = feeIndex.get(`${b.datum}|${isin}`) ?? 0
    if (fees > 0 && b.betrag_eur > fees) return round2(b.betrag_eur - fees)
  }
  return round2(b.betrag_eur)
}

function kaufEinstandAlt(b) {
  if (istAktiendividendeAlsKauf(b)) return 0
  return round2(b.betrag_eur)
}

function depotStand(rows, useEinstand, skipAktienDivCash = false) {
  const feeIndex = gebuehrSteuerIndex(rows)
  const map = new Map()
  let cash = 0
  const sortiert = [...rows].sort((a, b) => a.datum.localeCompare(b.datum))
  for (const b of sortiert) {
    if (b.typ === 'einzahlung') cash += b.betrag_eur
    else if (b.typ === 'auszahlung') cash -= b.betrag_eur
    else if (b.typ === 'kauf') {
      if (!(skipAktienDivCash && istAktiendividendeAlsKauf(b))) cash -= b.betrag_eur
      if (b.isin) {
        const isin = b.isin.toUpperCase()
        const cur = map.get(isin) ?? { stueck: 0, kosten: 0 }
        let stk = Math.abs(b.stueck ?? 0)
        if (stk <= 0 && b.kurs_eur > 0) stk = b.betrag_eur / b.kurs_eur
        if (stk > 0) {
          cur.stueck += stk
          cur.kosten += useEinstand(b, feeIndex)
        }
        map.set(isin, cur)
      }
    } else if (b.typ === 'verkauf') {
      cash += b.betrag_eur
      if (b.isin) {
        const isin = b.isin.toUpperCase()
        const cur = map.get(isin)
        if (cur && cur.stueck > 0) {
          let stk = Math.abs(b.stueck ?? 0)
          if (stk <= 0 && b.kurs_eur > 0) stk = b.betrag_eur / b.kurs_eur
          if (stk > 0) {
            const anteil = Math.min(1, stk / cur.stueck)
            cur.kosten = round2(cur.kosten * (1 - anteil))
            cur.stueck = Math.max(0, cur.stueck - stk)
          }
        }
      }
    } else if (b.typ === 'dividende' || b.typ === 'zins') cash += b.betrag_eur
    else if (b.typ === 'steuer' || b.typ === 'gebuehr') cash -= b.betrag_eur
  }
  let einstand = 0
  for (const v of map.values()) einstand += v.kosten
  return { einstand: round2(einstand), cash: round2(Math.max(0, cash)), investiert: round2(einstand + Math.max(0, cash)) }
}

let rows = []
let offset = 0
const page = 1000
while (true) {
  const { data: chunk, error } = await supabase
    .from('portfolio_analyse_buchung')
    .select('*')
    .order('datum')
    .range(offset, offset + page - 1)
  if (error) {
    console.error(error.message)
    process.exit(1)
  }
  if (!chunk?.length) break
  rows.push(...chunk)
  if (chunk.length < page) break
  offset += page
}
console.log('Buchungen:', rows.length)

const neu = depotStand(rows, kaufEinstandBetragEur, true)
const alt = depotStand(rows, kaufEinstandAlt)
const fix = depotStand(rows, kaufEinstandBetragEur, true)

console.log('Investiert (aktuell kaufEinstandBetragEur):', neu.investiert)
console.log('Investiert (alt betragEur):', alt.investiert)
console.log('Investiert (fix aktiendividende):', fix.investiert)
console.log('Einstand / Cash (aktuell):', neu.einstand, '/', neu.cash)

let aktienDivCash = 0
let aktienDivEinstandVerlust = 0
const feeIndex = gebuehrSteuerIndex(rows)
for (const b of rows) {
  if (!istAktiendividendeAlsKauf(b)) continue
  aktienDivCash += b.betrag_eur
  aktienDivEinstandVerlust += kaufEinstandBetragEur(b, feeIndex)
}

console.log('Aktiendividende-Käufe:', rows.filter(istAktiendividendeAlsKauf).length)
console.log('Aktiendividende betrag summe:', round2(aktienDivCash))

let handelKursDiff = 0
for (const b of rows) {
  if (b.typ !== 'kauf' || istAktiendividendeAlsKauf(b)) continue
  const stk = Math.abs(b.stueck ?? 0)
  if (stk <= 0 || !b.kurs_eur) continue
  const h = round2(stk * b.kurs_eur)
  const e = kaufEinstandBetragEur(b, feeIndex)
  if (Math.abs(h - e) > 0.02 || Math.abs(b.betrag_eur - e) > 0.02) {
    handelKursDiff += b.betrag_eur - e
  }
}
console.log('Einstand-Reduktion vs betrag (Käufe):', round2(handelKursDiff))

const typCount = {}
for (const b of rows) typCount[b.typ] = (typCount[b.typ] ?? 0) + 1
console.log('Typen:', typCount)
