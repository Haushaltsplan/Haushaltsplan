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

const { cashSaldoAusBuchungen } = await import(pathToFileURL(resolve('lib/portfolio-analyse/bestand.ts')).href)
const { parqetInvestiertAmStichtag } = await import(
  pathToFileURL(resolve('lib/portfolio-analyse/parqet-period-kennzahlen.ts')).href
)
const { summeDividendenBruttoParqet, summeGebuehrenParqet, summeSteuernParqet } = await import(
  pathToFileURL(resolve('lib/portfolio-analyse/parqet-rendite-kennzahlen.ts')).href
)
const { realisierterGewinnAusVerkaeufen } = await import(
  pathToFileURL(resolve('lib/portfolio-analyse/depot-berechnung.ts')).href
)
const { positionenFuerBewertung } = await import(pathToFileURL(resolve('lib/portfolio-analyse/bestand.ts')).href)

const heute = new Date().toISOString().slice(0, 10)
const cash = cashSaldoAusBuchungen(buchungen)
const inv = parqetInvestiertAmStichtag(buchungen, heute)
const pos = positionenFuerBewertung(buchungen, null)
const einstandSum = pos.reduce((s, p) => s + p.wertEur, 0)
const divBrutto = summeDividendenBruttoParqet(buchungen)
const real = realisierterGewinnAusVerkaeufen(buchungen)
const geb = summeGebuehrenParqet(buchungen)
const steu = summeSteuernParqet(buchungen)

console.log('cashSaldo', cash)
console.log('investiert', inv)
console.log('einstand offen (pos)', einstandSum)
console.log('divBrutto', divBrutto)
console.log('realisiert', real)
console.log('gebuehren', geb, 'steuern', steu)
console.log('inv + (div+real-geb-steu)?', inv + divBrutto + real - geb - steu)
console.log('einstand + cash', einstandSum + Math.max(0, cash))

const T = 94943.53
console.log('\nT', T, 'vs einstand+cash', einstandSum + Math.max(0, cash))
console.log('T - einstand', T - einstandSum, '(cash part?)', cash)
