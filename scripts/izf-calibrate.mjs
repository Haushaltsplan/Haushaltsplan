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
  steuerEur: r.steuer_eur,
}))

const T = 94943.53
const target = 6.43
const asOf = new Date(`${new Date().toISOString().slice(0, 10)}T12:00:00`)
const { berechneIrrAnnualizedPercent } = await import(
  pathToFileURL(resolve('lib/portfolio-analyse/parqet-core/math-utils.ts')).href
)
const xirr = await import(pathToFileURL(resolve('lib/portfolio-analyse/parqet-xirr.ts')).href)
const div = await import(pathToFileURL(resolve('lib/portfolio-analyse/dividenden-buchung.ts')).href)

function irrWithAktienFactor(f) {
  const flows = []
  for (const b of [...buchungen].sort((a, b) => a.datum.localeCompare(b.datum))) {
    const d = new Date(`${b.datum}T12:00:00`)
    if (b.typ === 'kauf') {
      let amt = xirr.irrBetragFuerKauf(b)
      if (div.istAktiendividendeAlsKauf(b)) amt *= f
      flows.push({ date: d, amount: -amt })
    } else if (b.typ === 'verkauf') flows.push({ date: d, amount: Math.abs(b.betragEur) })
    else if (b.typ === 'dividende' || b.typ === 'zins') flows.push({ date: d, amount: Math.abs(b.betragEur) })
  }
  return berechneIrrAnnualizedPercent(flows, T, asOf)
}

let lo = 0
let hi = 1
for (let i = 0; i < 60; i++) {
  const mid = (lo + hi) / 2
  const v = irrWithAktienFactor(mid)
  if (v == null) break
  if (v < target) hi = mid // less negative needed → lower factor
  else lo = mid
}
const factor = (lo + hi) / 2
console.log('divAll + aktiendiv factor', factor.toFixed(6), '→', irrWithAktienFactor(factor)?.toFixed(4), '%')

// divAll at what T?
function divAllFlows() {
  const flows = []
  for (const b of [...buchungen].sort((a, b) => a.datum.localeCompare(b.datum))) {
    const d = new Date(`${b.datum}T12:00:00`)
    if (b.typ === 'kauf') flows.push({ date: d, amount: -xirr.irrBetragFuerKauf(b) })
    else if (b.typ === 'verkauf') flows.push({ date: d, amount: Math.abs(b.betragEur) })
    else if (b.typ === 'dividende' || b.typ === 'zins') flows.push({ date: d, amount: Math.abs(b.betragEur) })
  }
  return flows
}
const flows = divAllFlows()

let loT = 90000
let hiT = 100000
for (let i = 0; i < 60; i++) {
  const mid = (loT + hiT) / 2
  const v = berechneIrrAnnualizedPercent(flows, mid, asOf)
  if (v < target) loT = mid
  else hiT = mid
}
console.log('divAll T for 6.43%:', Math.round((loT + hiT) / 2))

// Kennzahlen
const { parqetInvestiertAmStichtag } = await import(
  pathToFileURL(resolve('lib/portfolio-analyse/parqet-period-kennzahlen.ts')).href
)
const { summeDividendenBruttoParqet } = await import(
  pathToFileURL(resolve('lib/portfolio-analyse/parqet-rendite-kennzahlen.ts')).href
)
const inv = parqetInvestiertAmStichtag(buchungen, asOf.toISOString().slice(0, 10))
const divBrutto = summeDividendenBruttoParqet(buchungen)
console.log('investiert', inv, 'divBrutto', divBrutto, 'T', T, 'inv+div', inv + divBrutto)
console.log('T - inv', T - inv, 'T - (inv+divBrutto)', T - (inv + divBrutto))

// Try engine with live positions
try {
  const { berechneLivePortfolio } = await import(
    pathToFileURL(resolve('lib/portfolio-analyse/live-bewertung.ts')).href
  )
  const live = await berechneLivePortfolio(buchungen, new Map(), null)
  console.log('\nLive depotwert:', live.kennzahlen.depotwertEur)
  const izfDivAll = berechneIrrAnnualizedPercent(flows, live.kennzahlen.depotwertEur, asOf)
  const izfCur = berechneIrrAnnualizedPercent(
    xirr.parqetIrrCashflowsAusBuchungen(buchungen),
    live.kennzahlen.depotwertEur,
    asOf,
  )
  console.log('divAll @ live T:', izfDivAll, 'current @ live T:', izfCur)
} catch (e) {
  console.log('Live error:', e.message)
}
