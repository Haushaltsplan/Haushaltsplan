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

const xirr = await import(pathToFileURL(resolve('lib/portfolio-analyse/parqet-xirr.ts')).href)
const div = await import(pathToFileURL(resolve('lib/portfolio-analyse/dividenden-buchung.ts')).href)

let kaufOhne = 0
let kaufAktien = 0
for (const b of buchungen) {
  if (b.typ !== 'kauf') continue
  const v = xirr.irrBetragFuerKauf(b)
  if (div.istAktiendividendeAlsKauf(b)) kaufAktien += v
  else kaufOhne += v
}
console.log('kauf ohne aktiendiv', kaufOhne, 'aktiendiv', kaufAktien, 'ratio', kaufOhne / (kaufOhne + kaufAktien))
console.log('1 - aktiendiv/(ohne+aktien)', 1 - kaufAktien / (kaufOhne + kaufAktien))

// Parqet: only zaehltAlsKaufVolumen as negative + all dividend zufluss as positive but NOT double bardiv
const T = 94943.53
const asOf = new Date(`${new Date().toISOString().slice(0, 10)}T12:00:00`)
const { berechneIrrAnnualizedPercent } = await import(
  pathToFileURL(resolve('lib/portfolio-analyse/parqet-core/math-utils.ts')).href
)

function parqetIrrFlows() {
  const flows = []
  for (const b of [...buchungen].sort((a, b) => a.datum.localeCompare(b.datum))) {
    const d = new Date(`${b.datum}T12:00:00`)
    if (b.typ === 'kauf' && div.zaehltAlsKaufVolumen(b))
      flows.push({ date: d, amount: -xirr.irrBetragFuerKauf(b) })
    else if (b.typ === 'verkauf') flows.push({ date: d, amount: Math.abs(b.betragEur) })
    else if (b.typ === 'dividende' || b.typ === 'zins')
      flows.push({ date: d, amount: Math.abs(b.betragEur) })
    else if (div.istAktiendividendeAlsKauf(b)) {
      // TransferIn: Dividend-Zufluss als positiver CF (Parqet Dividend-Zeile), kein Kauf-OUT
      const z = div.dividendenZuflussEur(b)
      if (z > 0) flows.push({ date: d, amount: z })
    }
  }
  return flows
}
console.log('zaehltAlsKauf + bar div + aktiendiv as div only:', berechneIrrAnnualizedPercent(parqetIrrFlows(), T, asOf))

// Same but WITHOUT adding aktiendiv positive (only skip)
function skipAktienOnly() {
  const flows = []
  for (const b of [...buchungen].sort((a, b) => a.datum.localeCompare(b.datum))) {
    const d = new Date(`${b.datum}T12:00:00`)
    if (b.typ === 'kauf' && div.zaehltAlsKaufVolumen(b))
      flows.push({ date: d, amount: -xirr.irrBetragFuerKauf(b) })
    else if (b.typ === 'verkauf') flows.push({ date: d, amount: Math.abs(b.betragEur) })
    else if (b.typ === 'dividende' || b.typ === 'zins') flows.push({ date: d, amount: Math.abs(b.betragEur) })
  }
  return flows
}
console.log('zaehltAlsKauf + bar div only:', berechneIrrAnnualizedPercent(skipAktienOnly(), T, asOf))
