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
  assetKlasse: r.asset_klasse ?? 'aktie',
  buchungsHash: r.buchungs_hash,
}))

const div = await import(pathToFileURL(resolve('lib/portfolio-analyse/dividenden-buchung.ts')).href)
const xirr = await import(pathToFileURL(resolve('lib/portfolio-analyse/parqet-xirr.ts')).href)

let aktien = []
for (const b of buchungen) {
  if (!div.istAktiendividendeAlsKauf(b)) continue
  aktien.push({
    datum: b.datum,
    isin: b.isin,
    betrag: b.betragEur,
    steuer: b.steuerEur ?? 0,
    irr: xirr.irrBetragFuerKauf(b),
    name: b.wertpapierName,
    parqetTyp: b.parqetTyp,
  })
}
console.log('Aktiendiv count', aktien.length)
console.log('sum betrag', aktien.reduce((s, a) => s + a.betrag, 0))
console.log('sum steuer', aktien.reduce((s, a) => s + a.steuer, 0))
console.log('sum betrag-steuer', aktien.reduce((s, a) => s + a.betrag - a.steuer, 0))
console.log('ratio (betrag-steuer)/betrag', aktien.reduce((s, a) => s + a.betrag - a.steuer, 0) / aktien.reduce((s, a) => s + a.betrag, 0))

// snapshot depotwert
const { data: snap } = await sb
  .from('portfolio_analyse_snapshot')
  .select('depotwert_eur, erstellt_am')
  .order('erstellt_am', { ascending: false })
  .limit(3)
console.log('\nSnapshots:', snap)

// cash saldo
const { cashSaldoAusBuchungen } = await import(
  pathToFileURL(resolve('lib/portfolio-analyse/live-bewertung.ts')).href
).catch(() => ({}))
// cash might not export - grep
