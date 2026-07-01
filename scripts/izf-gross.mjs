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
  stueck: r.stueck,
  kursEur: r.kurs_eur,
  steuerEur: r.steuer_eur,
  wertpapierName: r.wertpapier_name,
  quelle: r.quelle,
  assetKlasse: r.asset_klasse ?? 'aktie',
  buchungsHash: r.buchungs_hash,
}))

const div = await import(pathToFileURL(resolve('lib/portfolio-analyse/dividenden-buchung.ts')).href)
const xirr = await import(pathToFileURL(resolve('lib/portfolio-analyse/parqet-xirr.ts')).href)
const T = 94943.53
const asOf = new Date(`${new Date().toISOString().slice(0, 10)}T12:00:00`)
const { berechneIrrAnnualizedPercent } = await import(
  pathToFileURL(resolve('lib/portfolio-analyse/parqet-core/math-utils.ts')).href
)

// Gross dividend on bardiv: betrag + steuer
function flowsGrossBarNetAktien() {
  const flows = []
  for (const b of [...buchungen].sort((a, b) => a.datum.localeCompare(b.datum))) {
    const d = new Date(`${b.datum}T12:00:00`)
    if (b.typ === 'kauf') {
      if (div.istAktiendividendeAlsKauf(b)) {
        const gross = div.dividendenZuflussEur(b)
        const net = xirr.irrBetragFuerKauf(b)
        if (gross > 0) flows.push({ date: d, amount: gross })
        flows.push({ date: d, amount: -net })
        continue
      }
      flows.push({ date: d, amount: -xirr.irrBetragFuerKauf(b) })
    } else if (b.typ === 'verkauf') flows.push({ date: d, amount: Math.abs(b.betragEur) })
    else if (b.typ === 'dividende' || b.typ === 'zins')
      flows.push({ date: d, amount: Math.abs(b.betragEur) + (b.steuerEur ?? 0) })
  }
  return flows
}
console.log('gross=net aktiendiv (same):', berechneIrrAnnualizedPercent(flowsGrossBarNetAktien(), T, asOf))

// Try: bardiv gross, aktiendiv only negative (no synthetic positive)
function flowsDivAllGrossBar() {
  const flows = []
  for (const b of [...buchungen].sort((a, b) => a.datum.localeCompare(b.datum))) {
    const d = new Date(`${b.datum}T12:00:00`)
    if (b.typ === 'kauf') flows.push({ date: d, amount: -xirr.irrBetragFuerKauf(b) })
    else if (b.typ === 'verkauf') flows.push({ date: d, amount: Math.abs(b.betragEur) })
    else if (b.typ === 'dividende' || b.typ === 'zins')
      flows.push({ date: d, amount: Math.abs(b.betragEur) + (b.steuerEur ?? 0) })
  }
  return flows
}
console.log('divAll gross bar:', berechneIrrAnnualizedPercent(flowsDivAllGrossBar(), T, asOf))

// verkauf brutto (before tax) - add back steuer
function flowsVerkaufBrutto() {
  const flows = []
  for (const b of [...buchungen].sort((a, b) => a.datum.localeCompare(b.datum))) {
    const d = new Date(`${b.datum}T12:00:00`)
    if (b.typ === 'kauf') flows.push({ date: d, amount: -xirr.irrBetragFuerKauf(b) })
    else if (b.typ === 'verkauf')
      flows.push({ date: d, amount: Math.abs(b.betragEur) + (b.steuerEur ?? 0) })
    else if (b.typ === 'dividende' || b.typ === 'zins') flows.push({ date: d, amount: Math.abs(b.betragEur) })
  }
  return flows
}
console.log('divAll verkauf brutto:', berechneIrrAnnualizedPercent(flowsVerkaufBrutto(), T, asOf))
