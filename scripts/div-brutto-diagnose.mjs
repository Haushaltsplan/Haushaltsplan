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
  steuerEur: r.steuer_eur,
  gebuehrEur: r.gebuehr_eur,
  assetKlasse: r.asset_klasse ?? 'aktie',
  buchungsHash: r.buchungs_hash,
}))

const div = await import(pathToFileURL(resolve('lib/portfolio-analyse/dividenden-buchung.ts')).href)
const rendite = await import(pathToFileURL(resolve('lib/portfolio-analyse/parqet-rendite-kennzahlen.ts')).href)

console.log('summeDividendenBruttoParqet', rendite.summeDividendenBruttoParqet(buchungen))
console.log('summeGezahlteDividenden', div.summeGezahlteDividenden(buchungen))
console.log('summeSteuernParqet', rendite.summeSteuernParqet(buchungen))
console.log('summeGebuehrenParqet', rendite.summeGebuehrenParqet(buchungen))

let barTyp = 0
let zins = 0
let aktien = 0
let steuerZeilen = 0
let steuerEurField = 0
let gebZeilen = 0
let gebEurField = 0

for (const b of buchungen) {
  if (b.typ === 'dividende') barTyp += b.betragEur
  if (b.typ === 'zins') zins += b.betragEur
  if (div.istAktiendividendeAlsKauf(b)) aktien += div.dividendenZuflussEur(b)
  if (b.typ === 'steuer') steuerZeilen += b.betragEur
  if (b.steuerEur > 0) steuerEurField += b.steuerEur
  if (b.typ === 'gebuehr') gebZeilen += b.betragEur
  if (b.gebuehrEur > 0) gebEurField += b.gebuehrEur
}

console.log('\nbar typ dividende', barTyp)
console.log('zins', zins)
console.log('aktiendiv', aktien)
console.log('bar + steuer on div', barTyp + steuerEurField)
console.log('steuer zeilen', steuerZeilen, 'steuerEur field', steuerEurField)
console.log('geb zeilen', gebZeilen, 'gebuehrEur field', gebEurField)

// brutto = netto + steuer on dividends only?
const barNet = div.summeGezahlteDividenden(buchungen)
console.log('\nbar net (gezahlt)', barNet)
console.log('bar net + steuer field div', barNet + steuerEurField)

// sample dividende with steuer
const samples = buchungen.filter((b) => b.typ === 'dividende' && (b.steuerEur > 0 || b.betragEur > 0)).slice(0, 5)
console.log('\nSamples:', samples.map((b) => ({ d: b.datum, betrag: b.betragEur, steuer: b.steuerEur, name: b.wertpapierName?.slice(0, 20) })))

// brutto per dividende: betrag + steuerEur
let bruttoBarOnly = 0
for (const b of buchungen) {
  if (!div.istGezahlteBardividende(b)) continue
  bruttoBarOnly += b.betragEur + (b.steuerEur ?? 0)
}
console.log('\nbrutto bar only (betrag+steuerEur)', bruttoBarOnly)
