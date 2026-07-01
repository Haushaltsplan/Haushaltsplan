import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { pathToFileURL } from 'url'

const raw = readFileSync(resolve('.env.local'), 'utf8')
const env = {}
for (const line of raw.split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m) env[m[1]] = m[2].replace(/^"|"$/g, '')
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
let rows = []
for (let o = 0; ; o += 1000) {
  const { data } = await sb.from('portfolio_analyse_buchung').select('*').order('datum').range(o, o + 999)
  if (!data?.length) break
  rows.push(...data)
  if (data.length < 1000) break
}
const buchungen = rows.map((r) => ({
  datum: r.datum,
  typ: r.typ,
  isin: r.isin,
  betragEur: r.betrag_eur,
  parqetTyp: r.parqet_typ,
  wertpapierName: r.wertpapier_name,
  stueck: r.stueck,
  kursEur: r.kurs_eur,
  quelle: r.quelle,
  assetKlasse: r.asset_klasse ?? 'aktie',
  buchungsHash: r.buchungs_hash,
}))

const xirr = await import(pathToFileURL(resolve('lib/portfolio-analyse/parqet-xirr.ts')).href)
const div = await import(pathToFileURL(resolve('lib/portfolio-analyse/dividenden-buchung.ts')).href)

let diffIrrBetrag = 0
let diffCount = 0
for (const b of buchungen) {
  if (b.typ !== 'kauf' || div.istAktiendividendeAlsKauf(b)) continue
  const irr = xirr.irrBetragFuerKauf(b)
  const bet = Math.abs(b.betragEur)
  const d = bet - irr
  if (Math.abs(d) > 0.01) {
    diffCount++
    diffIrrBetrag += d
  }
}
console.log('kauf irr vs betrag diff count', diffCount, 'sum betrag-irr', diffIrrBetrag)

const T = 94943.53
const asOf = new Date(`${new Date().toISOString().slice(0, 10)}T12:00:00`)
const { berechneIrrAnnualizedPercent } = await import(
  pathToFileURL(resolve('lib/portfolio-analyse/parqet-core/math-utils.ts')).href
)

// Use betrag for all kauf + div (engine) — already 5.60%
// Use betrag for non-aktien, skip aktiendiv, +div
function hybrid1() {
  const flows = []
  for (const b of [...buchungen].sort((a, b) => a.datum.localeCompare(b.datum))) {
    const d = new Date(`${b.datum}T12:00:00`)
    if (b.typ === 'kauf' && !div.istAktiendividendeAlsKauf(b))
      flows.push({ date: d, amount: -Math.abs(b.betragEur) })
    else if (b.typ === 'verkauf') flows.push({ date: d, amount: Math.abs(b.betragEur) })
    else if (b.typ === 'dividende' || b.typ === 'zins') flows.push({ date: d, amount: Math.abs(b.betragEur) })
  }
  return flows
}
console.log('betrag skip aktiendiv + div', berechneIrrAnnualizedPercent(hybrid1(), T, asOf))

// betrag all kauf + div + add aktiendiv as positive dividend (engine parqet native)
function hybrid2() {
  const roh = []
  for (const b of [...buchungen].sort((a, b) => a.datum.localeCompare(b.datum))) {
    const d = new Date(`${b.datum}T12:00:00`)
    if (b.typ === 'kauf') {
      roh.push({ date: d, amount: -Math.abs(b.betragEur) })
      if (div.istAktiendividendeAlsKauf(b)) roh.push({ date: d, amount: Math.abs(b.betragEur) })
    } else if (b.typ === 'verkauf') roh.push({ date: d, amount: Math.abs(b.betragEur) })
    else if (b.typ === 'dividende' || b.typ === 'zins') roh.push({ date: d, amount: Math.abs(b.betragEur) })
  }
  const map = new Map()
  for (const f of roh) {
    const k = f.date.toISOString().slice(0, 10)
    const cur = map.get(k)
    if (cur) cur.amount = Math.round((cur.amount + f.amount) * 100) / 100
    else map.set(k, { date: f.date, amount: Math.round(f.amount * 100) / 100 })
  }
  return [...map.values()].filter((f) => Math.abs(f.amount) > 0.001)
}
console.log('betrag net aktiendiv + div', berechneIrrAnnualizedPercent(hybrid2(), T, asOf))

// irrBetrag + div + exclude TransferIn parqetTyp from OUT (kapitalfluss) but include in investiert terminal
// = skip aktiendiv = 15.45%

// What if verkauf uses net after tax?
let verkaufSum = 0
for (const b of buchungen) if (b.typ === 'verkauf') verkaufSum += b.betragEur
console.log('verkauf sum', verkaufSum)
