/**
 * Validiert IZF nach parqet-xirr-Fix gegen Parqet-Ziel (~6,43 %).
 */
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
const target = 6.43
const asOf = new Date(`${new Date().toISOString().slice(0, 10)}T12:00:00`)

const { irrAusBuchungen } = await import(
  pathToFileURL(resolve('lib/portfolio-analyse/depot-berechnung.ts')).href
)
const { parqetIrrCashflowsAusBuchungen } = await import(
  pathToFileURL(resolve('lib/portfolio-analyse/parqet-xirr.ts')).href
)

const izf = irrAusBuchungen(buchungen, T, asOf)
const flows = parqetIrrCashflowsAusBuchungen(buchungen)
const diff = izf != null ? izf - target : null
const ok = diff != null && Math.abs(diff) <= 0.1

console.log('Buchungen:', buchungen.length)
console.log('Terminal:', T)
console.log('IZF:', izf, '%')
console.log('Parqet-Ziel:', target, '%')
console.log('Abweichung:', diff?.toFixed(4), '%')
console.log('Flows:', flows.length)
console.log(ok ? 'OK (≤0,1 %)' : 'FEHLER')

if (!ok) process.exit(1)
