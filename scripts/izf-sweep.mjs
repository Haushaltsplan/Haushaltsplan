/**
 * IZF Flow-Varianten bei festem Terminal (Parqet-Kalibrierung).
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { pathToFileURL } from 'url'

function loadEnv() {
  const raw = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8')
  const env = {}
  for (const line of raw.split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (m) env[m[1]] = m[2].replace(/^"|"$/g, '')
  }
  return env
}

const env = loadEnv()
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
let rows = []
let offset = 0
while (true) {
  const { data } = await supabase.from('portfolio_analyse_buchung').select('*').order('datum').range(offset, offset + 999)
  if (!data?.length) break
  rows.push(...data)
  if (data.length < 1000) break
  offset += 1000
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

const { berechneIrrAnnualizedPercent } = await import(
  pathToFileURL(resolve('lib/portfolio-analyse/parqet-core/math-utils.ts')).href
)
const xirr = await import(pathToFileURL(resolve('lib/portfolio-analyse/parqet-xirr.ts')).href)
const div = await import(pathToFileURL(resolve('lib/portfolio-analyse/dividenden-buchung.ts')).href)
const einstand = await import(pathToFileURL(resolve('lib/portfolio-analyse/parqet-einstand.ts')).href)
const { portfolioDataAusBuchungen } = await import(
  pathToFileURL(resolve('lib/portfolio-analyse/parqet-adapter.ts')).href
)
const { ParqetCoreAnalyticsEngine } = await import(
  pathToFileURL(resolve('lib/portfolio-analyse/parqet-core/index.ts')).href
)

const T = 94943.53
const asOf = new Date()

function irr(flows) {
  return berechneIrrAnnualizedPercent(flows, T, asOf)
}

const feeIndex = einstand.gebuehrSteuerIndex(buchungen)

function build(fn) {
  const sortiert = [...buchungen].sort((a, b) => a.datum.localeCompare(b.datum))
  const flows = []
  for (const b of sortiert) {
    const d = new Date(`${b.datum}T12:00:00`)
    fn(b, d, flows)
  }
  return flows
}

const variants = {
  current: () => xirr.parqetIrrCashflowsAusBuchungen(buchungen),
  divAllKauf: () =>
    build((b, d, flows) => {
      if (b.typ === 'kauf') flows.push({ date: d, amount: -xirr.irrBetragFuerKauf(b) })
      else if (b.typ === 'verkauf') flows.push({ date: d, amount: Math.abs(b.betragEur) })
      else if (b.typ === 'dividende' || b.typ === 'zins') flows.push({ date: d, amount: Math.abs(b.betragEur) })
    }),
  divNoAktienKauf: () =>
    build((b, d, flows) => {
      if (b.typ === 'kauf' && !div.istAktiendividendeAlsKauf(b))
        flows.push({ date: d, amount: -xirr.irrBetragFuerKauf(b) })
      else if (b.typ === 'verkauf') flows.push({ date: d, amount: Math.abs(b.betragEur) })
      else if (b.typ === 'dividende' || b.typ === 'zins') flows.push({ date: d, amount: Math.abs(b.betragEur) })
    }),
  divBetragKauf: () =>
    build((b, d, flows) => {
      if (b.typ === 'kauf') flows.push({ date: d, amount: -Math.abs(b.betragEur) })
      else if (b.typ === 'verkauf') flows.push({ date: d, amount: Math.abs(b.betragEur) })
      else if (b.typ === 'dividende' || b.typ === 'zins') flows.push({ date: d, amount: Math.abs(b.betragEur) })
    }),
  divEinstandKauf: () =>
    build((b, d, flows) => {
      if (b.typ === 'kauf') flows.push({ date: d, amount: -einstand.kaufEinstandBetragEur(b, feeIndex) })
      else if (b.typ === 'verkauf') flows.push({ date: d, amount: Math.abs(b.betragEur) })
      else if (b.typ === 'dividende' || b.typ === 'zins') flows.push({ date: d, amount: Math.abs(b.betragEur) })
    }),
  divNoAktienEinstand: () =>
    build((b, d, flows) => {
      if (b.typ === 'kauf' && !div.istAktiendividendeAlsKauf(b))
        flows.push({ date: d, amount: -einstand.kaufEinstandBetragEur(b, feeIndex) })
      else if (b.typ === 'verkauf') flows.push({ date: d, amount: Math.abs(b.betragEur) })
      else if (b.typ === 'dividende' || b.typ === 'zins') flows.push({ date: d, amount: Math.abs(b.betragEur) })
    }),
  divAllKaufSkipAktien: () =>
    build((b, d, flows) => {
      if (b.typ === 'kauf' && !div.istAktiendividendeAlsKauf(b))
        flows.push({ date: d, amount: -xirr.irrBetragFuerKauf(b) })
      else if (b.typ === 'verkauf') flows.push({ date: d, amount: Math.abs(b.betragEur) })
    }),
  divAllKaufHalfAktien: () =>
    build((b, d, flows) => {
      if (b.typ === 'kauf') {
        const amt = xirr.irrBetragFuerKauf(b)
        const neg = div.istAktiendividendeAlsKauf(b) ? amt * 0.5 : amt
        flows.push({ date: d, amount: -neg })
      } else if (b.typ === 'verkauf') flows.push({ date: d, amount: Math.abs(b.betragEur) })
      else if (b.typ === 'dividende' || b.typ === 'zins') flows.push({ date: d, amount: Math.abs(b.betragEur) })
    }),
}

console.log('Terminal', T, 'Ziel Parqet ~6.43%\n')
for (const [name, fn] of Object.entries(variants)) {
  const v = irr(fn())
  const mark = v != null && Math.abs(v - 6.43) <= 0.1 ? ' <-- TREFFER' : ''
  console.log(name.padEnd(22), v, '%' + mark)
}

console.log('\nBei T=98064.69 (6,43% für current):')
const T2 = 98064.69
function irrT2(flows) {
  return berechneIrrAnnualizedPercent(flows, T2, asOf)
}
console.log('current', irrT2(variants.current()))
console.log('divAllKauf', irrT2(variants.divAllKauf()))
console.log('divEinstandKauf', irrT2(variants.divEinstandKauf()))

const data = portfolioDataAusBuchungen(buchungen, [], T, 0)
const byIsin = new Map()
for (const b of buchungen) {
  if (!div.istAktiendividendeAlsKauf(b)) continue
  const k = b.isin?.toUpperCase() ?? '?'
  byIsin.set(k, (byIsin.get(k) ?? 0) + xirr.irrBetragFuerKauf(b))
}
console.log('\nAktiendividende je ISIN:', [...byIsin.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10))

function divAllKaufSkipAktienIsins(skipIsins) {
  return build((b, d, flows) => {
    if (b.typ === 'kauf') {
      if (div.istAktiendividendeAlsKauf(b) && skipIsins.has(b.isin?.toUpperCase() ?? '')) return
      flows.push({ date: d, amount: -xirr.irrBetragFuerKauf(b) })
    } else if (b.typ === 'verkauf') flows.push({ date: d, amount: Math.abs(b.betragEur) })
    else if (b.typ === 'dividende' || b.typ === 'zins') flows.push({ date: d, amount: Math.abs(b.betragEur) })
  })
}

for (const isin of ['DE0006580806']) {
  const s = new Set([isin])
  console.log('divAll skip Aktiendiv', isin, irr(divAllKaufSkipAktienIsins(s)), '%')
}

// XIRR mit 365.25 Tage
function irr36525(flows) {
  const sorted = [...flows].sort((a, b) => a.date.getTime() - b.date.getTime())
  const d1 = sorted[0].date.getTime()
  let r = 0.1
  for (let iter = 0; iter < 100; iter++) {
    let npv = 0
    let der = 0
    for (const cf of sorted) {
      const t = (cf.date.getTime() - d1) / (1000 * 60 * 60 * 24 * 365.25)
      const exp = Math.pow(1 + r, t)
      npv += cf.amount / exp
      if (t > 0) der -= (t * cf.amount) / Math.pow(1 + r, t + 1)
    }
    const next = r - npv / der
    if (!Number.isFinite(next)) break
    if (Math.abs(next - r) < 1e-6) {
      sorted.push({ date: asOf, amount: T })
      // recompute with terminal - sloppy
      return Math.round(next * 10000) / 100
    }
    r = next
  }
  return null
}

const divFlows = variants.divAllKauf()
divFlows.push({ date: asOf, amount: T })
console.log('divAllKauf XIRR 365.25 (rough):', irr36525(divFlows.slice(0, -1)), '%')
const engine = new ParqetCoreAnalyticsEngine(data, asOf)
const rep = engine.generateUltimateReport().consolidated
console.log('Engine (adapter cashflows):', rep.performance.irrAnnualizedPercent, '%')
