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

const asOf = new Date(`${new Date().toISOString().slice(0, 10)}T12:00:00`)
const { berechneIrrAnnualizedPercent } = await import(
  pathToFileURL(resolve('lib/portfolio-analyse/parqet-core/math-utils.ts')).href
)
const xirr = await import(pathToFileURL(resolve('lib/portfolio-analyse/parqet-xirr.ts')).href)
const div = await import(pathToFileURL(resolve('lib/portfolio-analyse/dividenden-buchung.ts')).href)

function engineStyleFlows() {
  const flows = []
  for (const b of [...buchungen].sort((a, b) => a.datum.localeCompare(b.datum))) {
    const d = new Date(`${b.datum}T12:00:00`)
    if (b.typ === 'kauf') flows.push({ date: d, amount: -Math.abs(b.betragEur) })
    else if (b.typ === 'verkauf') flows.push({ date: d, amount: Math.abs(b.betragEur) })
    else if (b.typ === 'dividende' || b.typ === 'zins') flows.push({ date: d, amount: Math.abs(b.betragEur) })
  }
  return flows
}

function irrStyleFlows() {
  const flows = []
  for (const b of [...buchungen].sort((a, b) => a.datum.localeCompare(b.datum))) {
    const d = new Date(`${b.datum}T12:00:00`)
    if (b.typ === 'kauf') flows.push({ date: d, amount: -xirr.irrBetragFuerKauf(b) })
    else if (b.typ === 'verkauf') flows.push({ date: d, amount: Math.abs(b.betragEur) })
    else if (b.typ === 'dividende' || b.typ === 'zins') flows.push({ date: d, amount: Math.abs(b.betragEur) })
  }
  return flows
}

const engineF = engineStyleFlows()
const irrF = irrStyleFlows()

function findT(flows, target) {
  let lo = 90000, hi = 100000
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2
    const v = berechneIrrAnnualizedPercent(flows, mid, asOf)
    if (v < target) lo = mid
    else hi = mid
  }
  return Math.round((lo + hi) / 2)
}

const T = 94943.53
console.log('engine @ T', T, berechneIrrAnnualizedPercent(engineF, T, asOf))
console.log('irrBetrag @ T', T, berechneIrrAnnualizedPercent(irrF, T, asOf))
console.log('T for 6.43 engine:', findT(engineF, 6.43))
console.log('T for 6.43 irr:', findT(irrF, 6.43))

// engine + skip aktiendiv OUT
function engineSkipAktien() {
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
const skipF = engineSkipAktien()
console.log('engine skip aktiendiv @ T', T, berechneIrrAnnualizedPercent(skipF, T, asOf))
console.log('T for 6.43 engine skip aktiendiv:', findT(skipF, 6.43))

// engine + aktiendiv as DIVIDEND only (no OUT)
function engineAktienDivOnly() {
  const flows = []
  for (const b of [...buchungen].sort((a, b) => a.datum.localeCompare(b.datum))) {
    const d = new Date(`${b.datum}T12:00:00`)
    if (b.typ === 'kauf' && !div.istAktiendividendeAlsKauf(b))
      flows.push({ date: d, amount: -Math.abs(b.betragEur) })
    else if (b.typ === 'verkauf') flows.push({ date: d, amount: Math.abs(b.betragEur) })
    else if (b.typ === 'dividende' || b.typ === 'zins') flows.push({ date: d, amount: Math.abs(b.betragEur) })
    if (div.istAktiendividendeAlsKauf(b)) {
      const z = div.dividendenZuflussEur(b)
      if (z > 0) flows.push({ date: d, amount: z })
    }
  }
  return flows
}
console.log('aktien div only @ T', T, berechneIrrAnnualizedPercent(engineAktienDivOnly(), T, asOf))
