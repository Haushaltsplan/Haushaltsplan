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
  quelle: r.quelle,
  steuerEur: r.steuer_eur,
}))

// by quelle
const byQuelle = new Map()
for (const b of buchungen.filter((x) => x.typ === 'dividende')) {
  byQuelle.set(b.quelle, (byQuelle.get(b.quelle) ?? 0) + b.betragEur)
}
console.log('dividende by quelle', Object.fromEntries(byQuelle))

// parqet dividend rows with tax in parqet csv - check raw rows for tax column
const parqetDiv = rows.filter((r) => r.typ === 'dividende' || /^dividend$/i.test(r.parqet_typ ?? ''))
console.log('div count', parqetDiv.length, 'steuer_eur sum', parqetDiv.reduce((s, r) => s + (r.steuer_eur ?? 0), 0))

// all typ steuer and gebuehr
let st = 0, gb = 0
for (const r of rows) {
  if (r.typ === 'steuer') st += r.betrag_eur
  if (r.typ === 'gebuehr') gb += r.betrag_eur
}
console.log('typ steuer', st, 'typ gebuehr', gb)

// kauf embedded fees
const einstand = await import(pathToFileURL(resolve('lib/portfolio-analyse/parqet-einstand.ts')).href)
const feeIndex = einstand.gebuehrSteuerIndex(buchungen)
let embGeb = 0
for (const b of buchungen) {
  if (b.typ !== 'kauf') continue
  const ein = einstand.kaufEinstandBetragEur(b, feeIndex)
  if (b.betragEur > ein + 0.01) embGeb += b.betragEur - ein
}
console.log('embedded kauf geb', embGeb, 'feeIndex sum', [...feeIndex.values()].reduce((a, b) => a + b, 0))

// Parqet targets
const TARGET = { brutto: 2091.9, steuer: 399.03, geb: 316.75, netto: 2091.9 - 399.03 }
console.log('\nTarget netto', TARGET.netto)

// If brutto = netto_buchung + missing_steuer, missing_steuer = 399.03 - 16.77
console.log('missing steuer vs field', TARGET.steuer - parqetDiv.reduce((s, r) => s + (r.steuer_eur ?? 0), 0))

// geb missing
console.log('missing geb', TARGET.geb - (gb + embGeb))

// Try: brutto = sum(div betrag) * factor?
const barSum = buchungen.filter((b) => b.typ === 'dividende').reduce((s, b) => s + b.betragEur, 0)
console.log('factor brutto/bar', TARGET.brutto / barSum)

// steuer as % of brutto
console.log('steuer/brutto target', TARGET.steuer / TARGET.brutto)

// Maybe only TR dividends count for brutto panel?
let trDiv = 0
for (const b of buchungen) {
  if (b.typ !== 'dividende') continue
  if (b.quelle === 'trade_republic_pdf' || b.quelle === 'trade_republic_csv') trDiv += b.betragEur
}
console.log('TR only div net', trDiv)
