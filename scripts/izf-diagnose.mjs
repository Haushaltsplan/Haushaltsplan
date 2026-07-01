/**
 * IZF-Diagnose gegen Parqet-Ziel (~6,43 %).
 * node scripts/izf-diagnose.mjs
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

function mapRow(r) {
  return {
    datum: r.datum,
    typ: r.typ,
    isin: r.isin,
    wertpapierName: r.wertpapier_name,
    stueck: r.stueck,
    kursEur: r.kurs_eur,
    betragEur: r.betrag_eur,
    parqetTyp: r.parqet_typ,
    quelle: r.quelle,
  }
}

const env = loadEnv()
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

let rows = []
let offset = 0
while (true) {
  const { data, error } = await supabase
    .from('portfolio_analyse_buchung')
    .select('*')
    .order('datum')
    .range(offset, offset + 999)
  if (error) throw error
  if (!data?.length) break
  rows.push(...data.map(mapRow))
  if (data.length < 1000) break
  offset += 1000
}

const { data: snap } = await supabase
  .from('portfolio_analyse_snapshot')
  .select('depotwert_eur, positionen')
  .order('erfasst_am', { ascending: false })
  .limit(1)
  .maybeSingle()

const buchungen = rows

let terminal = Number(snap?.depotwert_eur ?? 0)
if (terminal <= 0 && Array.isArray(snap?.positionen)) {
  terminal = snap.positionen.reduce((s, p) => s + Number(p.wertEur ?? 0), 0)
}

const { berechneIrrAnnualizedPercent } = await import(
  pathToFileURL(resolve('lib/portfolio-analyse/parqet-core/math-utils.ts')).href
)
const xirr = await import(pathToFileURL(resolve('lib/portfolio-analyse/parqet-xirr.ts')).href)
const div = await import(pathToFileURL(resolve('lib/portfolio-analyse/dividenden-buchung.ts')).href)
const { parqetInvestiertAmStichtag } = await import(
  pathToFileURL(resolve('lib/portfolio-analyse/parqet-period-kennzahlen.ts')).href
)
const einstand = await import(pathToFileURL(resolve('lib/portfolio-analyse/parqet-einstand.ts')).href)

const asOf = new Date()

// Terminal per Live-Kurse schätzen (wie App)
try {
  const { berechneLivePortfolio } = await import(
    pathToFileURL(resolve('lib/portfolio-analyse/live-bewertung.ts')).href
  )
  const live = await berechneLivePortfolio(buchungen, snap ? { ...snap, positionen: snap.positionen ?? [] } : null)
  if (live.kennzahlen.depotwertEur > 0) {
    terminal = live.kennzahlen.depotwertEur
    console.log('Live depotwertEur:', terminal.toFixed(2))
  }
} catch (e) {
  console.warn('Live-Bewertung fehlgeschlagen:', e.message)
}

if (terminal <= 0) {
  const inv = parqetInvestiertAmStichtag(buchungen, '2026-07-01')
  terminal = inv * 1.092
  console.log('Terminal-Schätzung (inv*1.092):', terminal.toFixed(2))
}

let divSum = 0
for (const b of buchungen) {
  if (b.typ === 'dividende' || b.typ === 'zins') divSum += b.betragEur
}
console.log('Summe Bardividenden:', divSum.toFixed(2))

function irrWith(flowFn) {
  const flows = flowFn(buchungen)
  return berechneIrrAnnualizedPercent(flows, terminal, asOf)
}

console.log('Buchungen:', buchungen.length, 'Terminal:', terminal.toFixed(2))
console.log('Modus:', xirr.parqetIrrModus(buchungen))

const current = irrWith(xirr.parqetIrrCashflowsAusBuchungen)
console.log('\nAktuell:', current, '%')

// Variante: Käufe ohne Aktiendividende
function flowsOhneAktienDiv(bs) {
  const sortiert = [...bs].sort((a, b) => a.datum.localeCompare(b.datum))
  const flows = []
  for (const b of sortiert) {
    const d = new Date(`${b.datum}T12:00:00`)
    if (b.typ === 'kauf' && !div.istAktiendividendeAlsKauf(b)) {
      flows.push({ date: d, amount: -xirr.irrBetragFuerKauf(b) })
    } else if (b.typ === 'verkauf') {
      flows.push({ date: d, amount: Math.abs(b.betragEur) })
    }
  }
  return flows
}
console.log('Ohne Aktiendividende-Käufe:', irrWith(flowsOhneAktienDiv), '%')

// Variante: voller betragEur bei Kauf
function flowsVollerBetrag(bs) {
  const sortiert = [...bs].sort((a, b) => a.datum.localeCompare(b.datum))
  const flows = []
  for (const b of sortiert) {
    const d = new Date(`${b.datum}T12:00:00`)
    if (b.typ === 'kauf' && !div.istAktiendividendeAlsKauf(b)) {
      flows.push({ date: d, amount: -Math.abs(b.betragEur) })
    } else if (b.typ === 'verkauf') {
      flows.push({ date: d, amount: Math.abs(b.betragEur) })
    }
  }
  return flows
}
console.log('Voller betragEur (ohne Aktiendiv):', irrWith(flowsVollerBetrag), '%')

// Variante: kaufEinstandBetragEur
const feeIndex = einstand.gebuehrSteuerIndex(buchungen)
function flowsEinstand(bs) {
  const sortiert = [...bs].sort((a, b) => a.datum.localeCompare(b.datum))
  const flows = []
  for (const b of sortiert) {
    const d = new Date(`${b.datum}T12:00:00`)
    if (b.typ === 'kauf' && !div.istAktiendividendeAlsKauf(b)) {
      flows.push({ date: d, amount: -einstand.kaufEinstandBetragEur(b, feeIndex) })
    } else if (b.typ === 'verkauf') {
      flows.push({ date: d, amount: Math.abs(b.betragEur) })
    }
  }
  return flows
}
console.log('kaufEinstandBetragEur (ohne Aktiendiv):', irrWith(flowsEinstand), '%')

// Bardividenden, Aktiendividende-Käufe bleiben drin
function flowsDivMitAktienDivKauf(bs) {
  const sortiert = [...bs].sort((a, b) => a.datum.localeCompare(b.datum))
  const flows = []
  for (const b of sortiert) {
    const d = new Date(`${b.datum}T12:00:00`)
    if (b.typ === 'kauf') {
      flows.push({ date: d, amount: -xirr.irrBetragFuerKauf(b) })
    } else if (b.typ === 'verkauf') {
      flows.push({ date: d, amount: Math.abs(b.betragEur) })
    } else if (b.typ === 'dividende' || b.typ === 'zins') {
      flows.push({ date: d, amount: Math.abs(b.betragEur) })
    }
  }
  return flows
}

// Nur positive Dividenden-Zuflüsse (inkl. Aktiendividende-Wert als positiv statt Kauf negativ)
function flowsParqetEngineStyle(bs) {
  const sortiert = [...bs].sort((a, b) => a.datum.localeCompare(b.datum))
  const flows = []
  for (const b of sortiert) {
    const d = new Date(`${b.datum}T12:00:00`)
    if (b.typ === 'kauf' && !div.istAktiendividendeAlsKauf(b)) {
      flows.push({ date: d, amount: -Math.abs(b.betragEur) })
    } else if (b.typ === 'verkauf') {
      flows.push({ date: d, amount: Math.abs(b.betragEur) })
    } else if (b.typ === 'dividende' || b.typ === 'zins') {
      flows.push({ date: d, amount: Math.abs(b.betragEur) })
    } else if (div.istAktiendividendeAlsKauf(b)) {
      const v = b.betragEur > 0 ? b.betragEur : (b.stueck && b.kursEur ? b.stueck * b.kursEur : 0)
      if (v > 0) flows.push({ date: d, amount: Math.abs(v) })
    }
  }
  return flows
}

function flowsMitDividenden(bs) {
  const sortiert = [...bs].sort((a, b) => a.datum.localeCompare(b.datum))
  const flows = []
  for (const b of sortiert) {
    const d = new Date(`${b.datum}T12:00:00`)
    if (b.typ === 'kauf' && !div.istAktiendividendeAlsKauf(b)) {
      flows.push({ date: d, amount: -xirr.irrBetragFuerKauf(b) })
    } else if (b.typ === 'verkauf') {
      flows.push({ date: d, amount: Math.abs(b.betragEur) })
    } else if (b.typ === 'dividende' || b.typ === 'zins') {
      flows.push({ date: d, amount: Math.abs(b.betragEur) })
    }
  }
  return flows
}
console.log('+ Bardividenden (ohne Aktiendiv-Kauf):', irrWith(flowsMitDividenden), '%')
console.log('+ Bardividenden (mit Aktiendiv-Kauf neg):', irrWith(flowsDivMitAktienDivKauf), '%')
console.log('Parqet-Engine-Stil:', irrWith(flowsParqetEngineStyle), '%')

let aktienDivZero = 0
let aktienDivPos = 0
for (const b of buchungen) {
  if (!div.istAktiendividendeAlsKauf(b)) continue
  if (b.betragEur <= 0.01) aktienDivZero++
  else aktienDivPos++
}
console.log('Aktiendiv betrag=0:', aktienDivZero, 'betrag>0:', aktienDivPos)

function flowsDivAktienDivZeroPositiv(bs) {
  const sortiert = [...bs].sort((a, b) => a.datum.localeCompare(b.datum))
  const flows = []
  for (const b of sortiert) {
    const d = new Date(`${b.datum}T12:00:00`)
    if (b.typ === 'kauf') {
      if (div.istAktiendividendeAlsKauf(b) && b.betragEur <= 0.01) {
        const v = div.dividendenZuflussEur(b)
        if (v > 0) flows.push({ date: d, amount: v })
        continue
      }
      flows.push({ date: d, amount: -xirr.irrBetragFuerKauf(b) })
    } else if (b.typ === 'verkauf') {
      flows.push({ date: d, amount: Math.abs(b.betragEur) })
    } else if (b.typ === 'dividende' || b.typ === 'zins') {
      flows.push({ date: d, amount: Math.abs(b.betragEur) })
    }
  }
  return flows
}
function flowsInvestiertDelta(bs) {
  const tage = [...new Set(bs.map((b) => b.datum))].sort()
  let prev = 0
  const flows = []
  for (const tag of tage) {
    const inv = parqetInvestiertAmStichtag(bs, tag)
    const delta = round2(inv - prev)
    if (Math.abs(delta) > 0.01) {
      flows.push({ date: new Date(`${tag}T12:00:00`), amount: -delta })
    }
    prev = inv
  }
  return flows
}
console.log('Investiert-Delta-Flows:', irrWith(flowsInvestiertDelta), '%')

// Netto: nur Verkäufe - Käufe aggregiert pro Tag als investiert curve changes?
let aktienDivSum = 0
let aktienDivCount = 0
for (const b of buchungen) {
  if (div.istAktiendividendeAlsKauf(b)) {
    aktienDivCount++
    aktienDivSum += xirr.irrBetragFuerKauf(b)
  }
}
console.log('\nAktiendividende in Flows:', aktienDivCount, 'Summe negativ:', aktienDivSum.toFixed(2))

function findTerminalForTargetIrr(flowFn, target) {
  let lo = 70000
  let hi = 120000
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2
    const irr = berechneIrrAnnualizedPercent(flowFn(buchungen), mid, asOf)
    if (irr == null) return null
    if (irr < target) lo = mid
    else hi = mid
  }
  return round2((lo + hi) / 2)
}

function round2(n) {
  return Math.round(n * 100) / 100
}

const t476 = findTerminalForTargetIrr(xirr.parqetIrrCashflowsAusBuchungen, 4.76)
console.log('\nTerminal für 4,76% (aktuell):', t476)
if (t476) {
  const atT = (fn) => berechneIrrAnnualizedPercent(fn(buchungen), t476, asOf)
  console.log('Bei T', t476, '— ohne Aktiendiv:', atT(flowsOhneAktienDiv), '%')
  console.log('Bei T', t476, '— +Div ohne Aktiendiv:', atT(flowsMitDividenden), '%')
  console.log('Bei T', t476, '— Div+AktienDiv0+:', atT(flowsDivAktienDivZeroPositiv), '%')
  console.log('Bei T', t476, '— Div mit Aktiendiv-Kauf:', atT(flowsDivMitAktienDivKauf), '%')
  console.log('Bei T', t476, '— Investiert-Delta:', atT(flowsInvestiertDelta), '%')
}

console.log('Terminal für 6,43% (aktuell):', findTerminalForTargetIrr(xirr.parqetIrrCashflowsAusBuchungen, 6.43))
console.log('Terminal für 6,43% (+Div, ohne Aktiendiv):', findTerminalForTargetIrr(flowsMitDividenden, 6.43))
try {
  const { portfolioDataAusBuchungen, parqetReportAusDepot } = await import(
    pathToFileURL(resolve('lib/portfolio-analyse/parqet-adapter.ts')).href
  )
  const { parqetInvestiertAmStichtag } = await import(
    pathToFileURL(resolve('lib/portfolio-analyse/parqet-period-kennzahlen.ts')).href
  )
  const inv = parqetInvestiertAmStichtag(buchungen, '2026-07-01')
  // Terminal-Schätzung: Investiert + 8,5 % Kursgewinn (wird durch Live-Wert ersetzt wenn verfügbar)
  if (terminal <= 0) terminal = inv * 1.09

  const { ParqetCoreAnalyticsEngine } = await import(
    pathToFileURL(resolve('lib/portfolio-analyse/parqet-core/index.ts')).href
  )
  const data = portfolioDataAusBuchungen(buchungen, [], terminal, 0)
  const engine = new ParqetCoreAnalyticsEngine(data)
  const rep = engine.generateUltimateReport().consolidated
  console.log('Engine IZF (ohne Positionen):', rep.performance.irrAnnualizedPercent, '%')

  const rep2 = parqetReportAusDepot(buchungen, [], terminal)
  console.log('parqetReport irrAusBuchungen override:', rep2.performance.irrAnnualizedPercent, '%')
} catch (e) {
  console.warn('Engine:', e.message)
}
