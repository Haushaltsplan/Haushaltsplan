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

const T = 94943.53
const target = 6.43
const asOf = new Date(`${new Date().toISOString().slice(0, 10)}T12:00:00`)
const { berechneIrrAnnualizedPercent } = await import(
  pathToFileURL(resolve('lib/portfolio-analyse/parqet-core/math-utils.ts')).href
)
const xirr = await import(pathToFileURL(resolve('lib/portfolio-analyse/parqet-xirr.ts')).href)
const div = await import(pathToFileURL(resolve('lib/portfolio-analyse/dividenden-buchung.ts')).href)

let aktien = 0
let bar = 0
for (const b of buchungen) {
  if (div.istAktiendividendeAlsKauf(b)) aktien += div.dividendenZuflussEur(b)
  if (b.typ === 'dividende' || b.typ === 'zins') bar += b.betragEur
}

function irrWithK(K) {
  const roh = []
  const paarQuote = bar / (bar + aktien * K)
  for (const b of [...buchungen].sort((a, b) => a.datum.localeCompare(b.datum))) {
    const d = new Date(`${b.datum}T12:00:00`)
    if (b.typ === 'kauf') {
      const amt = xirr.irrBetragFuerKauf(b)
      roh.push({ date: d, amount: -amt })
      if (div.istAktiendividendeAlsKauf(b)) {
        const z = div.dividendenZuflussEur(b)
        if (z > 0) roh.push({ date: d, amount: round2(z * paarQuote) })
      }
    } else if (b.typ === 'verkauf') roh.push({ date: d, amount: Math.abs(b.betragEur) })
    else if (b.typ === 'dividende' || b.typ === 'zins') roh.push({ date: d, amount: Math.abs(b.betragEur) })
  }
  const map = new Map()
  for (const f of roh) {
    const k = f.date.toISOString().slice(0, 10)
    const cur = map.get(k)
    if (cur) cur.amount = round2(cur.amount + f.amount)
    else map.set(k, { date: f.date, amount: round2(f.amount) })
  }
  return berechneIrrAnnualizedPercent([...map.values()], T, asOf)
}

function round2(n) {
  return Math.round(n * 100) / 100
}

for (const K of [1.35, 1.4, 1.45, 1.48, 1.5, 1.52, 1.55]) {
  const pq = bar / (bar + aktien * K)
  const v = irrWithK(K)
  console.log('K', K, 'pq', pq.toFixed(6), 'irr', v?.toFixed(4), 'diff', v != null ? (v - target).toFixed(4) : 'n/a')
}
