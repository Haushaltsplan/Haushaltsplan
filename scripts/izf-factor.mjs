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
const asOf = new Date(`${new Date().toISOString().slice(0, 10)}T12:00:00`)
const { berechneIrrAnnualizedPercent } = await import(
  pathToFileURL(resolve('lib/portfolio-analyse/parqet-core/math-utils.ts')).href
)
const xirr = await import(pathToFileURL(resolve('lib/portfolio-analyse/parqet-xirr.ts')).href)
const div = await import(pathToFileURL(resolve('lib/portfolio-analyse/dividenden-buchung.ts')).href)
const einstand = await import(pathToFileURL(resolve('lib/portfolio-analyse/parqet-einstand.ts')).href)
const feeIndex = einstand.gebuehrSteuerIndex(buchungen)

function irrWithAktienFactor(f, useEinstand = false) {
  const flows = []
  for (const b of [...buchungen].sort((a, b) => a.datum.localeCompare(b.datum))) {
    const d = new Date(`${b.datum}T12:00:00`)
    if (b.typ === 'kauf') {
      let amt = useEinstand ? einstand.kaufEinstandBetragEur(b, feeIndex) : xirr.irrBetragFuerKauf(b)
      if (div.istAktiendividendeAlsKauf(b)) amt *= f
      flows.push({ date: d, amount: -amt })
    } else if (b.typ === 'verkauf') flows.push({ date: d, amount: Math.abs(b.betragEur) })
    else if (b.typ === 'dividende' || b.typ === 'zins') flows.push({ date: d, amount: Math.abs(b.betragEur) })
  }
  return berechneIrrAnnualizedPercent(flows, T, asOf)
}

// binary search factor
let lo = 0
let hi = 1
for (let i = 0; i < 50; i++) {
  const mid = (lo + hi) / 2
  const v = irrWithAktienFactor(mid)
  if (v < 6.43) lo = mid
  else hi = mid
}
const factor = (lo + hi) / 2
console.log('Factor for aktiendiv negative (divAll):', factor.toFixed(6), '→', irrWithAktienFactor(factor), '%')

// compare aktiendiv irr vs betrag vs einstand
let sumIrr = 0
let sumBetrag = 0
let sumEinstand = 0
for (const b of buchungen) {
  if (!div.istAktiendividendeAlsKauf(b)) continue
  sumIrr += xirr.irrBetragFuerKauf(b)
  sumBetrag += Math.abs(b.betragEur)
  sumEinstand += einstand.kaufEinstandBetragEur(b, feeIndex)
}
console.log('Aktiendiv sums irr/betrag/einstand:', sumIrr, sumBetrag, sumEinstand)
console.log('einstand/irr:', (sumEinstand / sumIrr).toFixed(6))

// div with dividendenZuflussEur for all dividend types
function irrDivZufluss() {
  const flows = []
  for (const b of [...buchungen].sort((a, b) => a.datum.localeCompare(b.datum))) {
    const d = new Date(`${b.datum}T12:0:00`)
    if (b.typ === 'kauf' && !div.istAktiendividendeAlsKauf(b))
      flows.push({ date: d, amount: -xirr.irrBetragFuerKauf(b) })
    else if (b.typ === 'verkauf') flows.push({ date: d, amount: Math.abs(b.betragEur) })
    const z = div.dividendenZuflussEur(b)
    if (z > 0) flows.push({ date: d, amount: z })
  }
  return berechneIrrAnnualizedPercent(flows, T, asOf)
}
console.log('skip aktiendiv kauf + all dividendenZufluss:', irrDivZufluss(), '%')

// gross bardiv (betrag + steuer)
function irrGrossDiv() {
  const flows = []
  for (const b of [...buchungen].sort((a, b) => a.datum.localeCompare(b.datum))) {
    const d = new Date(`${b.datum}T12:00:00`)
    if (b.typ === 'kauf') flows.push({ date: d, amount: -xirr.irrBetragFuerKauf(b) })
    else if (b.typ === 'verkauf') flows.push({ date: d, amount: Math.abs(b.betragEur) })
    else if (b.typ === 'dividende' || b.typ === 'zins') {
      const gross = Math.abs(b.betragEur) + (b.steuerEur ?? 0)
      flows.push({ date: d, amount: gross })
    }
  }
  return berechneIrrAnnualizedPercent(flows, T, asOf)
}
console.log('divAll gross (net+steuer):', irrGrossDiv(), '%')
