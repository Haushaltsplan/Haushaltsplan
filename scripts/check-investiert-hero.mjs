/**
 * Rechnet Hero-„Investiert“ (MAX) mit App-Logik nach.
 * node scripts/check-investiert-hero.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)

// Dynamisch per relativem Pfad die kompilierten Gedanken spiegeln — reine JS-Kopie der Kernformel
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
  const { data, error } = await sb.from('portfolio_analyse_buchung').select('*').order('datum').range(offset, offset + 999)
  if (error) throw error
  if (!data?.length) break
  rows.push(...data)
  if (data.length < 1000) break
  offset += 1000
}

const r2 = (n) => Math.round(n * 100) / 100
function normalisiere(b) {
  const stueck = Math.abs(b.stueck ?? 0)
  let kursEur = b.kurs_eur > 0 ? b.kurs_eur : null
  let betragEur = r2(Math.abs(b.betrag_eur))
  let geheilt = false
  if ((b.typ === 'kauf' || b.typ === 'verkauf') && stueck > 0 && kursEur != null) {
    if (stueck > 1.01 && Math.abs(betragEur - kursEur) <= 0.05) {
      betragEur = r2(stueck * kursEur)
      geheilt = true
    }
  }
  const hw = stueck > 0 && kursEur ? r2(stueck * kursEur) : null
  return { stueck, kursEur, betragEur, hw, geheilt }
}

function kaufEinstand(b, feeIndex) {
  const n = normalisiere(b)
  if (n.hw != null && n.hw > 0) {
    if (n.hw < n.betragEur - 0.02) return n.hw
    if (Math.abs(n.hw - n.betragEur) <= 0.02) return n.hw
  }
  return n.betragEur
}

const feeIndex = new Map()
for (const b of rows) {
  if (b.typ !== 'gebuehr' || !b.isin) continue
  const k = `${b.datum}|${b.isin.toUpperCase()}`
  feeIndex.set(k, r2((feeIndex.get(k) || 0) + b.betrag_eur))
}

const map = new Map()
let cash = 0
let geheiltCashDelta = 0
for (const b of rows) {
  const n = normalisiere(b)
  if (n.geheilt) geheiltCashDelta += n.betragEur - Math.abs(b.betrag_eur)

  if (b.typ === 'einzahlung') cash += Math.abs(b.betrag_eur)
  else if (b.typ === 'auszahlung') cash -= Math.abs(b.betrag_eur)
  else if (b.typ === 'kauf') {
    cash -= n.betragEur
    if (b.isin) {
      const isin = b.isin.toUpperCase()
      const cur = map.get(isin) || { stueck: 0, kosten: 0 }
      if (n.stueck > 0) {
        cur.stueck += n.stueck
        cur.kosten += kaufEinstand(b, feeIndex)
      }
      map.set(isin, cur)
    }
  } else if (b.typ === 'verkauf') {
    cash += n.betragEur
    if (b.isin) {
      const isin = b.isin.toUpperCase()
      const cur = map.get(isin)
      if (cur && cur.stueck > 0 && n.stueck > 0) {
        const anteil = Math.min(1, n.stueck / cur.stueck)
        cur.kosten = r2(cur.kosten * (1 - anteil))
        cur.stueck = Math.max(0, cur.stueck - n.stueck)
      }
    }
  } else if (b.typ === 'dividende' || b.typ === 'zins') cash += Math.abs(b.betrag_eur)
  else if (b.typ === 'steuer' || b.typ === 'gebuehr') cash -= Math.abs(b.betrag_eur)
}

let einstand = 0
for (const v of map.values()) if (v.stueck > 1e-8) einstand += v.kosten
einstand = r2(einstand)
const cashClamped = Math.max(0, r2(cash))
const investiert = r2(einstand + cashClamped)

console.log(
  JSON.stringify(
    {
      uiScreenshot: 80167.27,
      einstandOhneSpinOffs: einstand,
      cashRoh: r2(cash),
      cashClamped,
      investiertHeroFormel: investiert,
      geheiltCashMehr: r2(geheiltCashDelta),
      hinweis:
        'Hero Investiert = Einstand offener Positionen + max(0,Cash). Bei negativem Cash ändert die Gebühren-/Cash-Heilung Investiert nicht.',
    },
    null,
    2,
  ),
)
