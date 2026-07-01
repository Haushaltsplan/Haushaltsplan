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

const T = 94943.53
const asOf = new Date('2026-07-01T12:00:00')
const { berechneIrrAnnualizedPercent } = await import(
  pathToFileURL(resolve('lib/portfolio-analyse/parqet-core/math-utils.ts')).href
)
const xirr = await import(pathToFileURL(resolve('lib/portfolio-analyse/parqet-xirr.ts')).href)
const div = await import(pathToFileURL(resolve('lib/portfolio-analyse/dividenden-buchung.ts')).href)

function irr(fn) {
  const flows = []
  for (const b of [...buchungen].sort((a, b) => a.datum.localeCompare(b.datum))) {
    fn(b, new Date(`${b.datum}T12:00:00`), flows)
  }
  return berechneIrrAnnualizedPercent(flows, T, asOf)
}

console.log('skip aktiendiv only (no div):', irr((b, d, f) => {
  if (b.typ === 'kauf' && !div.istAktiendividendeAlsKauf(b)) f.push({ date: d, amount: -xirr.irrBetragFuerKauf(b) })
  else if (b.typ === 'verkauf') f.push({ date: d, amount: Math.abs(b.betragEur) })
}))

console.log('skip aktiendiv + bar div:', irr((b, d, f) => {
  if (b.typ === 'kauf' && !div.istAktiendividendeAlsKauf(b)) f.push({ date: d, amount: -xirr.irrBetragFuerKauf(b) })
  else if (b.typ === 'verkauf') f.push({ date: d, amount: Math.abs(b.betragEur) })
  else if (b.typ === 'dividende' || b.typ === 'zins') f.push({ date: d, amount: Math.abs(b.betragEur) })
}))

console.log('all kauf + bar div (divAll):', irr((b, d, f) => {
  if (b.typ === 'kauf') f.push({ date: d, amount: -xirr.irrBetragFuerKauf(b) })
  else if (b.typ === 'verkauf') f.push({ date: d, amount: Math.abs(b.betragEur) })
  else if (b.typ === 'dividende' || b.typ === 'zins') f.push({ date: d, amount: Math.abs(b.betragEur) })
}))
