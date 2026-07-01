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
  wertpapierName: r.wertpapier_name,
  stueck: r.stueck,
  kursEur: r.kurs_eur,
  betragEur: r.betrag_eur,
  parqetTyp: r.parqet_typ,
  quelle: r.quelle,
  assetKlasse: r.asset_klasse ?? 'aktie',
  buchungsHash: r.buchungs_hash,
}))

const asOf = new Date(`${new Date().toISOString().slice(0, 10)}T12:00:00`)
const { berechneIrrAnnualizedPercent } = await import(
  pathToFileURL(resolve('lib/portfolio-analyse/parqet-core/math-utils.ts')).href
)
const xirr = await import(pathToFileURL(resolve('lib/portfolio-analyse/parqet-xirr.ts')).href)

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
const current = xirr.parqetIrrCashflowsAusBuchungen(buchungen)

for (const T of [79837, 82000, 84000, 85000, 87000, 90000, 94943, 98064]) {
  const d = berechneIrrAnnualizedPercent(flows, T, asOf)
  const c = berechneIrrAnnualizedPercent(current, T, asOf)
  console.log('T', T, 'divAll', d?.toFixed(2), 'current', c?.toFixed(2))
}

function findT(flowFn, target) {
  let lo = 70000
  let hi = 110000
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2
    const v = berechneIrrAnnualizedPercent(flowFn, mid, asOf)
    if (v < target) lo = mid
    else hi = mid
  }
  return Math.round((lo + hi) / 2)
}

console.log('\nT for 6.43% divAll:', findT(flows, 6.43))
console.log('T for 6.43% current:', findT(current, 6.43))

const { parqetInvestiertAmStichtag } = await import(
  pathToFileURL(resolve('lib/portfolio-analyse/parqet-period-kennzahlen.ts')).href
)
const inv = parqetInvestiertAmStichtag(buchungen, asOf.toISOString().slice(0, 10))
const { portfolioDataAusBuchungen } = await import(
  pathToFileURL(resolve('lib/portfolio-analyse/parqet-adapter.ts')).href
)
const { ParqetCoreAnalyticsEngine } = await import(
  pathToFileURL(resolve('lib/portfolio-analyse/parqet-core/index.ts')).href
)
for (const T of [94943, 96226, 98064]) {
  const data = portfolioDataAusBuchungen(buchungen, [], T, 0)
  const eng = new ParqetCoreAnalyticsEngine(data, asOf)
  const r = eng.generateUltimateReport().consolidated
  console.log('Engine T', T, r.performance.irrAnnualizedPercent)
}
