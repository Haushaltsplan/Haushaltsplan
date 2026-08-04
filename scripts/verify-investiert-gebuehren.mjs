/**
 * Standalone-Verify der Heilungs-/Gebühren-Logik + Live-DB-Kennzahlen.
 * node scripts/verify-investiert-gebuehren.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const r2 = (n) => Math.round(n * 100) / 100
const r4 = (n) => Math.round(n * 10000) / 10000

function normalisiereHandelsBuchung(b) {
  const stueck = Math.abs(b.stueck ?? 0)
  let kursEur = b.kursEur != null && b.kursEur > 0 ? b.kursEur : null
  let betragEur = r2(Math.abs(b.betragEur))
  let geheilt = false
  if ((b.typ === 'kauf' || b.typ === 'verkauf') && stueck > 0 && kursEur != null && betragEur > 0) {
    if (stueck > 1.01 && Math.abs(betragEur - kursEur) <= 0.05) {
      betragEur = r2(stueck * kursEur)
      geheilt = true
    } else if (stueck < 0.999 && Math.abs(betragEur - kursEur) <= 0.05) {
      kursEur = r4(betragEur / stueck)
      geheilt = true
    }
  }
  const handelswertEur = stueck > 0 && kursEur != null && kursEur > 0 ? r2(stueck * kursEur) : null
  return { stueck, kursEur, betragEur, handelswertEur, geheilt }
}

function eingebetteteOrdergebuehrEur(b) {
  if (b.typ !== 'kauf' && b.typ !== 'verkauf') return 0
  const n = normalisiereHandelsBuchung(b)
  if (n.stueck <= 0 || n.handelswertEur == null || n.handelswertEur <= 0) return 0
  let gap =
    b.typ === 'kauf' ? r2(n.betragEur - n.handelswertEur) : r2(n.handelswertEur - n.betragEur)
  if (gap <= 0.01) return 0
  if (b.typ === 'verkauf' && b.steuerEur != null && b.steuerEur > 0) {
    gap = r2(Math.max(0, gap - b.steuerEur))
    if (gap <= 0.01) return 0
  }
  if (gap > 25 && gap > n.handelswertEur * 0.15) return 0
  if (gap > 80) return 0
  return gap
}

function summeGebuehren(buchungen) {
  const feeIndex = new Map()
  for (const b of buchungen) {
    if (b.typ !== 'gebuehr' || !b.isin) continue
    const k = `${b.datum}|${b.isin.toUpperCase()}`
    feeIndex.set(k, r2((feeIndex.get(k) || 0) + b.betragEur))
  }
  let sum = 0
  for (const b of buchungen) {
    if (b.typ === 'gebuehr') {
      sum += b.betragEur
      continue
    }
    if (b.typ !== 'kauf' && b.typ !== 'verkauf') continue
    const spread = eingebetteteOrdergebuehrEur(b)
    if (spread <= 0) continue
    const schon = b.isin ? feeIndex.get(`${b.datum}|${b.isin.toUpperCase()}`) || 0 : 0
    sum += Math.max(0, r2(spread - schon))
  }
  return r2(sum)
}

function summeGebuehrenAlt(buchungen) {
  let sum = 0
  for (const b of buchungen) {
    if (b.typ === 'gebuehr') sum += b.betragEur
    else if (b.typ === 'kauf' || b.typ === 'verkauf') {
      const stk = Math.abs(b.stueck ?? 0)
      if (stk <= 0 || !(b.kursEur > 0)) continue
      const hw = r2(stk * b.kursEur)
      if (b.typ === 'kauf' && b.betragEur > hw + 0.01) sum += b.betragEur - hw
      if (b.typ === 'verkauf' && hw > b.betragEur + 0.01) sum += hw - b.betragEur
    }
  }
  return r2(sum)
}

function kaufEinstand(b, feeIndex) {
  const n = normalisiereHandelsBuchung(b)
  if (n.handelswertEur != null && n.handelswertEur > 0) {
    if (n.handelswertEur < n.betragEur - 0.02) return n.handelswertEur
    if (Math.abs(n.handelswertEur - n.betragEur) <= 0.02) return n.handelswertEur
  }
  const isin = b.isin?.toUpperCase()
  if (isin && n.handelswertEur == null) {
    const fees = feeIndex.get(`${b.datum}|${isin}`) || 0
    if (fees > 0 && n.betragEur > fees) return r2(n.betragEur - fees)
  }
  return n.betragEur
}

function investiertAmStichtag(buchungen, stichtag) {
  const feeIndex = new Map()
  for (const b of buchungen) {
    if (b.typ !== 'gebuehr' || !b.isin) continue
    const k = `${b.datum}|${b.isin.toUpperCase()}`
    feeIndex.set(k, r2((feeIndex.get(k) || 0) + b.betragEur))
  }
  const map = new Map()
  let cash = 0
  const sortiert = [...buchungen].filter((b) => b.datum <= stichtag).sort((a, b) => a.datum.localeCompare(b.datum))
  for (const b of sortiert) {
    if (b.typ === 'einzahlung') cash += Math.abs(b.betragEur)
    else if (b.typ === 'auszahlung') cash -= Math.abs(b.betragEur)
    else if (b.typ === 'kauf') {
      const n = normalisiereHandelsBuchung(b)
      cash -= n.betragEur
      if (b.isin) {
        const isin = b.isin.toUpperCase()
        const cur = map.get(isin) || { stueck: 0, kosten: 0 }
        const stk = n.stueck || (b.kursEur > 0 ? n.betragEur / b.kursEur : 0)
        if (stk > 0) {
          cur.stueck += stk
          cur.kosten += kaufEinstand(b, feeIndex)
        }
        map.set(isin, cur)
      }
    } else if (b.typ === 'verkauf') {
      const n = normalisiereHandelsBuchung(b)
      cash += n.betragEur
      if (b.isin) {
        const isin = b.isin.toUpperCase()
        const cur = map.get(isin)
        if (cur && cur.stueck > 0) {
          const stk = n.stueck
          if (stk > 0) {
            const anteil = Math.min(1, stk / cur.stueck)
            cur.kosten = r2(cur.kosten * (1 - anteil))
            cur.stueck = Math.max(0, cur.stueck - stk)
          }
        }
      }
    } else if (b.typ === 'dividende' || b.typ === 'zins') cash += Math.abs(b.betragEur)
    else if (b.typ === 'steuer' || b.typ === 'gebuehr') cash -= Math.abs(b.betragEur)
  }
  let einstand = 0
  for (const v of map.values()) einstand += v.kosten
  return { einstand: r2(einstand), cash: r2(cash), investiert: r2(einstand + Math.max(0, cash)) }
}

// —— Unit asserts ——
const fakeBadSell = { typ: 'verkauf', stueck: -10, kursEur: 178.92, betragEur: 178.92, steuerEur: null }
const healed = normalisiereHandelsBuchung(fakeBadSell)
if (!healed.geheilt || Math.abs(healed.betragEur - 1789.2) > 0.01) {
  console.error('FAIL heal', healed)
  process.exit(1)
}
if (eingebetteteOrdergebuehrEur(fakeBadSell) !== 0) {
  console.error('FAIL fee should be 0', eingebetteteOrdergebuehrEur(fakeBadSell))
  process.exit(1)
}
const realFeeBuy = { typ: 'kauf', stueck: 5, kursEur: 100, betragEur: 501, steuerEur: null }
if (eingebetteteOrdergebuehrEur(realFeeBuy) !== 1) {
  console.error('FAIL 1€ fee', eingebetteteOrdergebuehrEur(realFeeBuy))
  process.exit(1)
}
const nettoPlusGebuehr = [
  { typ: 'kauf', datum: '2024-01-01', isin: 'US1', stueck: 1, kursEur: 100, betragEur: 100 },
  { typ: 'gebuehr', datum: '2024-01-01', isin: 'US1', stueck: null, kursEur: null, betragEur: 1 },
]
if (summeGebuehren(nettoPlusGebuehr) !== 1) {
  console.error('FAIL no double fee', summeGebuehren(nettoPlusGebuehr))
  process.exit(1)
}
console.log('unit asserts ok')

const envRaw = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8')
const env = {}
for (const line of envRaw.split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m) env[m[1]] = m[2].replace(/^"|"$/g, '')
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
let rows = []
let offset = 0
while (true) {
  const { data, error } = await sb
    .from('portfolio_analyse_buchung')
    .select('datum,typ,isin,stueck,kurs_eur,betrag_eur,steuer_eur')
    .order('datum')
    .range(offset, offset + 999)
  if (error) throw error
  if (!data?.length) break
  rows.push(...data)
  if (data.length < 1000) break
  offset += 1000
}
const buchungen = rows.map((r) => ({
  datum: r.datum,
  typ: r.typ,
  isin: r.isin,
  stueck: r.stueck,
  kursEur: r.kurs_eur,
  betragEur: r.betrag_eur,
  steuerEur: r.steuer_eur,
}))
const heute = new Date().toISOString().slice(0, 10)
const neu = investiertAmStichtag(buchungen, heute)
const gebNeu = summeGebuehren(buchungen)
const gebAlt = summeGebuehrenAlt(buchungen)
console.log(
  JSON.stringify(
    {
      buchungen: buchungen.length,
      investiert: neu.investiert,
      einstand: neu.einstand,
      cash: neu.cash,
      gebuehrenNeu: gebNeu,
      gebuehrenAlt: gebAlt,
      gebuehrenDelta: r2(gebAlt - gebNeu),
    },
    null,
    2,
  ),
)
