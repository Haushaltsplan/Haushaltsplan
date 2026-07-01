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
const asOf = new Date(`${new Date().toISOString().slice(0, 10)}T12:00:00`)
const { berechneIrrAnnualizedPercent } = await import(
  pathToFileURL(resolve('lib/portfolio-analyse/parqet-core/math-utils.ts')).href
)
const xirr = await import(pathToFileURL(resolve('lib/portfolio-analyse/parqet-xirr.ts')).href)
const div = await import(pathToFileURL(resolve('lib/portfolio-analyse/dividenden-buchung.ts')).href)

function flows(fn) {
  const out = []
  for (const b of [...buchungen].sort((a, b) => a.datum.localeCompare(b.datum))) {
    const d = new Date(`${b.datum}T12:00:00`)
    fn(b, d, out)
  }
  return berechneIrrAnnualizedPercent(out, T, asOf)
}

const tests = {
  current: (b, d, f) => {
    if (b.typ === 'kauf') f.push({ date: d, amount: -xirr.irrBetragFuerKauf(b) })
    else if (b.typ === 'verkauf') f.push({ date: d, amount: Math.abs(b.betragEur) })
  },
  divAll: (b, d, f) => {
    if (b.typ === 'kauf') f.push({ date: d, amount: -xirr.irrBetragFuerKauf(b) })
    else if (b.typ === 'verkauf') f.push({ date: d, amount: Math.abs(b.betragEur) })
    else if (b.typ === 'dividende' || b.typ === 'zins') f.push({ date: d, amount: Math.abs(b.betragEur) })
  },
  divAllPlusAktienZufluss: (b, d, f) => {
    if (b.typ === 'kauf') f.push({ date: d, amount: -xirr.irrBetragFuerKauf(b) })
    else if (b.typ === 'verkauf') f.push({ date: d, amount: Math.abs(b.betragEur) })
    else if (b.typ === 'dividende' || b.typ === 'zins') f.push({ date: d, amount: Math.abs(b.betragEur) })
    if (div.istAktiendividendeAlsKauf(b)) {
      const z = div.dividendenZuflussEur(b)
      if (z > 0) f.push({ date: d, amount: z })
    }
  },
  skipAktienAddBarDiv: (b, d, f) => {
    if (b.typ === 'kauf' && !div.istAktiendividendeAlsKauf(b))
      f.push({ date: d, amount: -xirr.irrBetragFuerKauf(b) })
    else if (b.typ === 'verkauf') f.push({ date: d, amount: Math.abs(b.betragEur) })
    else if (b.typ === 'dividende' || b.typ === 'zins') f.push({ date: d, amount: Math.abs(b.betragEur) })
  },
  skipAktienAddAllZufluss: (b, d, f) => {
    if (b.typ === 'kauf' && !div.istAktiendividendeAlsKauf(b))
      f.push({ date: d, amount: -xirr.irrBetragFuerKauf(b) })
    else if (b.typ === 'verkauf') f.push({ date: d, amount: Math.abs(b.betragEur) })
    const z = div.dividendenZuflussEur(b)
    if (z > 0) f.push({ date: d, amount: z })
  },
}

for (const [k, fn] of Object.entries(tests)) {
  const v = flows(fn)
  const ok = v != null && Math.abs(v - 6.43) <= 0.1 ? ' ***' : ''
  console.log(k.padEnd(24), v, '%' + ok)
}
