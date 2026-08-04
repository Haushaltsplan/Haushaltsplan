/**
 * Nach Fix: SpinOffCost + Kind ohne zweiten %-Abzug.
 * node scripts/verify-investiert-spinfix.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve } from 'path'

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

const UI_ALT = 80167.27
const r2 = (n) => Math.round(n * 100) / 100
const r4 = (n) => Math.round(n * 1e4) / 1e4
function rundeStueck(n) {
  return Math.round(n * 1e8) / 1e8
}
function istAktiendividendeAlsKauf(b) {
  if (!b.isin || b.typ !== 'kauf') return false
  const parqet = (b.parqet_typ ?? '').trim()
  const stk = Math.abs(b.stueck ?? 0)
  if (/^transferin$/i.test(parqet) && stk > 0 && b.betrag_eur > 0) return true
  const t = `${b.wertpapier_name ?? ''} ${parqet}`.toLowerCase()
  if (/wahl[\s-]?dividend|aktiendividend|stock[\s_-]?dividend/.test(t)) return stk > 0
  return false
}
function normalisiere(b) {
  const stueck = Math.abs(b.stueck ?? 0)
  let kursEur = b.kurs_eur > 0 ? b.kurs_eur : null
  let betragEur = r2(Math.abs(b.betrag_eur))
  if ((b.typ === 'kauf' || b.typ === 'verkauf') && stueck > 0 && kursEur != null) {
    if (stueck > 1.01 && Math.abs(betragEur - kursEur) <= 0.05) betragEur = r2(stueck * kursEur)
    else if (stueck < 0.999 && Math.abs(betragEur - kursEur) <= 0.05) kursEur = r4(betragEur / stueck)
  }
  const hw = stueck > 0 && kursEur ? r2(stueck * kursEur) : null
  return { stueck, kursEur, betragEur, hw }
}
function kaufEinstand(b) {
  if (istAktiendividendeAlsKauf(b)) {
    if (b.betrag_eur > 0) return r2(b.betrag_eur)
    const stk = Math.abs(b.stueck ?? 0)
    if (stk > 0 && b.kurs_eur > 0) return r2(stk * b.kurs_eur)
    return 0
  }
  const n = normalisiere(b)
  if (n.hw != null && n.hw > 0) {
    if (n.hw < n.betragEur - 0.02 || Math.abs(n.hw - n.betragEur) <= 0.02) return n.hw
  }
  return n.betragEur
}

const SPIN = {
  parentIsin: 'US78409V1044',
  childIsin: 'US60744M1062',
  datum: '2026-07-01',
  ratio: 1,
  childKostenAnteil: 0.05,
}

const heute = new Date().toISOString().slice(0, 10)
const sortiert = rows.filter((b) => b.datum <= heute).sort((a, b) => a.datum.localeCompare(b.datum))
const byTag = new Map()
for (const b of sortiert) {
  const list = byTag.get(b.datum) ?? []
  list.push(b)
  byTag.set(b.datum, list)
}
const tage = []
{
  const d = new Date(sortiert[0].datum + 'T12:00:00Z')
  const end = new Date(heute + 'T12:00:00Z')
  while (d <= end) {
    tage.push(d.toISOString().slice(0, 10))
    d.setUTCDate(d.getUTCDate() + 1)
  }
}

const map = new Map()
let cash = 0
for (const tag of tage) {
  for (const b of byTag.get(tag) ?? []) {
    const n = normalisiere(b)
    if (b.typ === 'einzahlung') cash += n.betragEur
    else if (b.typ === 'auszahlung') cash -= n.betragEur
    else if (b.typ === 'kauf') {
      if (!istAktiendividendeAlsKauf(b) && b.parqet_typ !== 'SpinOffCost') cash -= n.betragEur
    } else if (b.typ === 'verkauf') cash += n.betragEur
    else if (b.typ === 'dividende' || b.typ === 'zins') cash += n.betragEur
    else if (b.typ === 'steuer' || b.typ === 'gebuehr') cash -= n.betragEur

    if (!b.isin) continue
    const isin = b.isin.toUpperCase()
    const cur = map.get(isin) ?? { stueck: 0, kosten: 0, name: b.wertpapier_name || isin }
    if (b.typ === 'kauf') {
      let stk = rundeStueck(n.stueck)
      if (stk <= 0 && n.kursEur) stk = rundeStueck(n.betragEur / n.kursEur)
      if (stk > 0) {
        cur.stueck += stk
        cur.kosten += kaufEinstand(b)
      }
    } else if (b.parqet_typ === 'SpinOffCost' && b.betrag_eur > 0) {
      cur.kosten = r2(Math.max(0, cur.kosten - b.betrag_eur))
    } else if (b.typ === 'verkauf') {
      let stk = rundeStueck(n.stueck)
      if (cur.stueck > 0 && stk > 0) {
        const anteil = Math.min(1, stk / cur.stueck)
        cur.kosten = r2(cur.kosten * (1 - anteil))
        cur.stueck = Math.max(0, cur.stueck - stk)
      }
    }
    map.set(isin, cur)
  }

  if (tag === SPIN.datum) {
    const parent = map.get(SPIN.parentIsin)
    if (parent && parent.stueck > 0) {
      const childStueck = rundeStueck(parent.stueck * SPIN.ratio)
      const costFromBooking = 184.16 // SpinOffCost
      const childKosten = costFromBooking // FIX: kein zweiter %
      const child = map.get(SPIN.childIsin) ?? { stueck: 0, kosten: 0, name: 'Mobility Global' }
      child.stueck += childStueck
      child.kosten += childKosten
      map.set(SPIN.childIsin, child)
    }
  }
  if (tag === '2025-12-18') {
    const cur = map.get('US81762P1021')
    if (cur) cur.stueck = rundeStueck(cur.stueck * 5)
  }
}

let einstand = 0
let n = 0
for (const v of map.values()) {
  if (v.stueck < 1e-8) continue
  n++
  einstand += r2(v.kosten)
}
einstand = r2(einstand)
const investiert = r2(einstand + Math.max(0, cash))
console.log(
  JSON.stringify(
    {
      uiBisherFalsch: UI_ALT,
      investiertKorrekt: investiert,
      einstand,
      cash: r2(cash),
      positionen: n,
      differenzUiZuKorrekt: r2(investiert - UI_ALT),
      spgi: map.get('US78409V1044'),
      mobility: map.get('US60744M1062'),
    },
    null,
    2,
  ),
)
