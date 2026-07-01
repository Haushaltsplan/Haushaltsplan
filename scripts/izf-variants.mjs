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

const div = await import(pathToFileURL(resolve('lib/portfolio-analyse/dividenden-buchung.ts')).href)
const xirr = await import(pathToFileURL(resolve('lib/portfolio-analyse/parqet-xirr.ts')).href)

const byPt = new Map()
for (const b of buchungen) {
  if (!div.istAktiendividendeAlsKauf(b)) continue
  const pt = (b.parqetTyp ?? '(null)').trim()
  byPt.set(pt, (byPt.get(pt) ?? 0) + xirr.irrBetragFuerKauf(b))
}
console.log('Aktiendiv by parqetTyp:', [...byPt.entries()].sort((a, b) => b[1] - a[1]))

const T = 94943.53
const asOf = new Date(`${new Date().toISOString().slice(0, 10)}T12:00:00`)
const { berechneIrrAnnualizedPercent } = await import(
  pathToFileURL(resolve('lib/portfolio-analyse/parqet-core/math-utils.ts')).href
)

function test(name, skipFn) {
  const flows = []
  for (const b of [...buchungen].sort((a, b) => a.datum.localeCompare(b.datum))) {
    const d = new Date(`${b.datum}T12:00:00`)
    if (b.typ === 'kauf') {
      if (skipFn(b)) continue
      flows.push({ date: d, amount: -xirr.irrBetragFuerKauf(b) })
    } else if (b.typ === 'verkauf') flows.push({ date: d, amount: Math.abs(b.betragEur) })
    else if (b.typ === 'dividende' || b.typ === 'zins') flows.push({ date: d, amount: Math.abs(b.betragEur) })
  }
  const v = berechneIrrAnnualizedPercent(flows, T, asOf)
  const ok = v != null && Math.abs(v - 6.43) <= 0.1 ? ' ***' : ''
  console.log(name.padEnd(30), v?.toFixed(4), '%' + ok)
}

test('skip TransferIn aktiendiv', (b) => div.istAktiendividendeAlsKauf(b) && /^transferin$/i.test((b.parqetTyp ?? '').trim()))
test('skip HRMS only', (b) => b.isin?.toUpperCase() === 'DE0006580806' && div.istAktiendividendeAlsKauf(b))
test('skip quelle=parqet aktiendiv', (b) => div.istAktiendividendeAlsKauf(b) && b.quelle === 'parqet')
test('skip quelle!=parqet aktiendiv', (b) => div.istAktiendividendeAlsKauf(b) && b.quelle !== 'parqet')

// Parqet model: kauf negative + dividend positive for aktiendiv (same day aggregate)
function parqetNetAktiendiv() {
  const roh = []
  for (const b of [...buchungen].sort((a, b) => a.datum.localeCompare(b.datum))) {
    const d = new Date(`${b.datum}T12:00:00`)
    if (b.typ === 'kauf') {
      roh.push({ date: d, amount: -xirr.irrBetragFuerKauf(b) })
      if (div.istAktiendividendeAlsKauf(b)) {
        const z = div.dividendenZuflussEur(b)
        if (z > 0) roh.push({ date: d, amount: z })
      }
    } else if (b.typ === 'verkauf') roh.push({ date: d, amount: Math.abs(b.betragEur) })
    else if (b.typ === 'dividende' || b.typ === 'zins') roh.push({ date: d, amount: Math.abs(b.betragEur) })
  }
  const map = new Map()
  for (const f of roh) {
    const k = f.date.toISOString().slice(0, 10)
    const cur = map.get(k)
    if (cur) cur.amount = Math.round((cur.amount + f.amount) * 100) / 100
    else map.set(k, { ...f })
  }
  return [...map.values()]
}
console.log('parqetNetAktiendiv', berechneIrrAnnualizedPercent(parqetNetAktiendiv(), T, asOf)?.toFixed(4))

// Exclude aktiendiv from kauf, add as dividend only (not typ dividende duplicate)
function aktiendivAsDivOnly() {
  const flows = []
  for (const b of [...buchungen].sort((a, b) => a.datum.localeCompare(b.datum))) {
    const d = new Date(`${b.datum}T12:00:00`)
    if (b.typ === 'kauf' && !div.istAktiendividendeAlsKauf(b))
      flows.push({ date: d, amount: -xirr.irrBetragFuerKauf(b) })
    else if (b.typ === 'verkauf') flows.push({ date: d, amount: Math.abs(b.betragEur) })
    else if (b.typ === 'dividende' || b.typ === 'zins') flows.push({ date: d, amount: Math.abs(b.betragEur) })
    if (div.istAktiendividendeAlsKauf(b)) {
      const z = div.dividendenZuflussEur(b)
      if (z > 0) flows.push({ date: d, amount: z })
    }
  }
  return flows
}
console.log('aktiendivAsDivOnly', berechneIrrAnnualizedPercent(aktiendivAsDivOnly(), T, asOf)?.toFixed(4))
