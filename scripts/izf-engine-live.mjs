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
const asOf = new Date(`${new Date().toISOString().slice(0, 10)}T12:00:00`)
const { berechneIrrAnnualizedPercent } = await import(
  pathToFileURL(resolve('lib/portfolio-analyse/parqet-core/math-utils.ts')).href
)
const xirr = await import(pathToFileURL(resolve('lib/portfolio-analyse/parqet-xirr.ts')).href)
const div = await import(pathToFileURL(resolve('lib/portfolio-analyse/dividenden-buchung.ts')).href)
const { bestandAusBuchungen } = await import(pathToFileURL(resolve('lib/portfolio-analyse/bestand.ts')).href)

// Build live positions with T distributed by einstand weights (simulate correct market values)
const pos = bestandAusBuchungen(buchungen)
const einstandSum = pos.reduce((s, p) => s + p.wertEur, 0)
const positionen = pos.map((p) => ({
  isin: p.isin,
  anzeigeName: p.name,
  name: p.name,
  stueck: p.stueck,
  einstandEur: p.wertEur,
  wertLiveEur: einstandSum > 0 ? Math.round((p.wertEur / einstandSum) * T * 100) / 100 : 0,
  assetKlasse: p.assetKlasse,
}))

const { portfolioDataAusBuchungen } = await import(
  pathToFileURL(resolve('lib/portfolio-analyse/parqet-adapter.ts')).href
)
const { ParqetCoreAnalyticsEngine } = await import(
  pathToFileURL(resolve('lib/portfolio-analyse/parqet-core/index.ts')).href
)

const data = portfolioDataAusBuchungen(buchungen, positionen, T, 0)
const eng = new ParqetCoreAnalyticsEngine(data, asOf)
const irrEngine = eng.generateUltimateReport().consolidated.performance.irrAnnualizedPercent
console.log('Engine IZF with positions T=', T, ':', irrEngine)

// Manual engine-style flows from adapter data
function engineFlowsFromData(data) {
  const assets = data.portfolios[0].assets
  const PORTFOLIO_CASH_ID = '__portfolio_cash__'
  const cashAsset = assets.find((a) => a.assetId === PORTFOLIO_CASH_ID)
  const hatExtern = cashAsset?.cashflows.some((cf) => cf.type === 'IN' || cf.type === 'OUT')
  const out = []
  for (const a of assets) {
    const isCash = a.assetId === PORTFOLIO_CASH_ID
    for (const cf of a.cashflows) {
      if (cf.type === 'DIVIDEND') out.push({ date: cf.timestamp, amount: Math.abs(cf.amountEUR) })
      else if (hatExtern) {
        if (!isCash) continue
        if (cf.type === 'OUT') out.push({ date: cf.timestamp, amount: -Math.abs(cf.amountEUR) })
        if (cf.type === 'IN') out.push({ date: cf.timestamp, amount: Math.abs(cf.amountEUR) })
      } else if (!isCash) {
        if (cf.type === 'OUT') out.push({ date: cf.timestamp, amount: -Math.abs(cf.amountEUR) })
        if (cf.type === 'IN') out.push({ date: cf.timestamp, amount: Math.abs(cf.amountEUR) })
      }
    }
  }
  return out.sort((a, b) => a.date.getTime() - b.date.getTime())
}

const ef = engineFlowsFromData(data)
console.log('Engine flows IRR manual:', berechneIrrAnnualizedPercent(ef, T, asOf))

// Count aktiendiv OUT in adapter
let aktienOut = 0
for (const a of data.portfolios[0].assets) {
  for (const cf of a.cashflows) {
    if (cf.type === 'OUT') {
      // check if matching aktiendiv - rough count
    }
  }
}
