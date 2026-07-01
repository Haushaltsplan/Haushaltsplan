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

const div = await import(pathToFileURL(resolve('lib/portfolio-analyse/dividenden-buchung.ts')).href)

const divByDayIsin = new Set()
for (const b of buchungen) {
  if (b.typ === 'dividende' || b.typ === 'zins') {
    divByDayIsin.add(`${b.datum}|${b.isin?.toUpperCase() ?? ''}`)
  }
}

let overlap = 0
for (const b of buchungen) {
  if (!div.istAktiendividendeAlsKauf(b)) continue
  const k = `${b.datum}|${b.isin?.toUpperCase() ?? ''}`
  if (divByDayIsin.has(k)) overlap++
}
console.log('Aktiendiv kauf mit dividende-Zeile selber Tag/ISIN:', overlap, '/ 34')

const { summeDividendenBruttoParqet } = await import(
  pathToFileURL(resolve('lib/portfolio-analyse/parqet-rendite-kennzahlen.ts')).href
)
console.log('summeDividendenBruttoParqet:', summeDividendenBruttoParqet(buchungen))
