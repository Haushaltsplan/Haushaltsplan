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

const einstand = await import(pathToFileURL(resolve('lib/portfolio-analyse/parqet-einstand.ts')).href)
const xirr = await import(pathToFileURL(resolve('lib/portfolio-analyse/parqet-xirr.ts')).href)
const div = await import(pathToFileURL(resolve('lib/portfolio-analyse/dividenden-buchung.ts')).href)
const feeIndex = einstand.gebuehrSteuerIndex(buchungen)

let irrSum = 0
let betragSum = 0
let einstandSum = 0
for (const b of buchungen) {
  if (!div.istAktiendividendeAlsKauf(b)) continue
  irrSum += xirr.irrBetragFuerKauf(b)
  betragSum += b.betragEur
  einstandSum += einstand.kaufEinstandBetragEur(b, feeIndex)
}
console.log('Aktiendiv sums irr', irrSum, 'betrag', betragSum, 'einstand', einstandSum)
console.log('Ratio einstand/irr', (einstandSum / irrSum).toFixed(4))
