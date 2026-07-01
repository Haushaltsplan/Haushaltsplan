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
const xirr = await import(pathToFileURL(resolve('lib/portfolio-analyse/parqet-xirr.ts')).href)
const div = await import(pathToFileURL(resolve('lib/portfolio-analyse/dividenden-buchung.ts')).href)

function xirrCustom(flows, daysPerYear) {
  const sorted = [...flows].sort((a, b) => a.date.getTime() - b.date.getTime())
  sorted.push({ date: asOf, amount: T })
  const d1 = sorted[0].date.getTime()
  let r = 0.1
  for (let iter = 0; iter < 100; iter++) {
    let npv = 0
    let der = 0
    for (const cf of sorted) {
      const t = (cf.date.getTime() - d1) / (1000 * 60 * 60 * 24 * daysPerYear)
      const exp = Math.pow(1 + r, t)
      npv += cf.amount / exp
      if (t > 0) der -= (t * cf.amount) / Math.pow(1 + r, t + 1)
    }
    const next = r - npv / der
    if (!Number.isFinite(next)) break
    if (Math.abs(next - r) < 1e-6) return Math.round(next * 10000) / 100
    r = next
  }
  return null
}

const flows = []
for (const b of [...buchungen].sort((a, b) => a.datum.localeCompare(b.datum))) {
  const d = new Date(`${b.datum}T12:00:00`)
  if (b.typ === 'kauf') flows.push({ date: d, amount: -xirr.irrBetragFuerKauf(b) })
  else if (b.typ === 'verkauf') flows.push({ date: d, amount: Math.abs(b.betragEur) })
  else if (b.typ === 'dividende' || b.typ === 'zins') flows.push({ date: d, amount: Math.abs(b.betragEur) })
}

console.log('divAll 365d:', xirrCustom(flows, 365))
console.log('divAll 365.25d:', xirrCustom(flows, 365.25))

// aktiendiv: exclude from OUT if TransferIn (kapitalfluss rule) - already 15%

// Model: OUT only for zaehltAlsKaufVolumen + DIV for all dividendenZufluss
const flows2 = []
for (const b of [...buchungen].sort((a, b) => a.datum.localeCompare(b.datum))) {
  const d = new Date(`${b.datum}T12:00:00`)
  if (b.typ === 'kauf' && div.zaehltAlsKaufVolumen(b))
    flows2.push({ date: d, amount: -xirr.irrBetragFuerKauf(b) })
  else if (b.typ === 'verkauf') flows2.push({ date: d, amount: Math.abs(b.betragEur) })
  const z = div.dividendenZuflussEur(b)
  if (z > 0) flows2.push({ date: d, amount: z })
}
const { berechneIrrAnnualizedPercent } = await import(
  pathToFileURL(resolve('lib/portfolio-analyse/parqet-core/math-utils.ts')).href
)
console.log('realKauf + all dividendenZufluss:', berechneIrrAnnualizedPercent(flows2, T, asOf))

// Engine-aligned: OUT for all kauf, DIV for dividende typ only (not aktiendiv synthetic)
const flows3 = []
for (const b of [...buchungen].sort((a, b) => a.datum.localeCompare(b.datum))) {
  const d = new Date(`${b.datum}T12:00:00`)
  if (b.typ === 'kauf') flows3.push({ date: d, amount: -xirr.irrBetragFuerKauf(b) })
  else if (b.typ === 'verkauf') flows3.push({ date: d, amount: Math.abs(b.betragEur) })
  else if (b.typ === 'dividende' || b.typ === 'zins') flows3.push({ date: d, amount: Math.abs(b.betragEur) })
}
console.log('engine-aligned divAll:', berechneIrrAnnualizedPercent(flows3, T, asOf))

// T needed for 6.43 with engine-aligned
let lo = 94000, hi = 97000
for (let i = 0; i < 50; i++) {
  const mid = (lo + hi) / 2
  const v = berechneIrrAnnualizedPercent(flows3, mid, asOf)
  if (v < 6.43) lo = mid
  else hi = mid
}
console.log('T for 6.43 engine-aligned:', Math.round((lo + hi) / 2))
