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

function parqetFlows() {
  const roh = []
  for (const b of [...buchungen].sort((a, b) => a.datum.localeCompare(b.datum))) {
    const d = new Date(`${b.datum}T12:00:00`)
    if (b.typ === 'kauf') {
      const amt = xirr.irrBetragFuerKauf(b)
      roh.push({ date: d, amount: -amt })
      if (div.istAktiendividendeAlsKauf(b) && amt > 0) {
        roh.push({ date: d, amount: amt })
      }
    } else if (b.typ === 'verkauf') {
      roh.push({ date: d, amount: Math.abs(b.betragEur) })
    } else if (b.typ === 'dividende' || b.typ === 'zins') {
      roh.push({ date: d, amount: Math.abs(b.betragEur) })
    }
  }
  // aggregiere wie parqet-xirr
  const map = new Map()
  for (const f of roh) {
    const k = f.date.toISOString().slice(0, 10)
    const cur = map.get(k)
    if (cur) cur.amount = Math.round((cur.amount + f.amount) * 100) / 100
    else map.set(k, { date: f.date, amount: Math.round(f.amount * 100) / 100 })
  }
  return [...map.values()].sort((a, b) => a.date.getTime() - b.date.getTime())
}

const flows = parqetFlows()
const irr = berechneIrrAnnualizedPercent(flows, T, asOf)
console.log('Parqet-Modell (Aktiendiv +/- netto 0, Bardiv extra):', irr, '%')
console.log('Ziel 6,43%, Abweichung:', irr != null ? (irr - 6.43).toFixed(4) : 'n/a')

const current = berechneIrrAnnualizedPercent(xirr.parqetIrrCashflowsAusBuchungen(buchungen), T, asOf)
console.log('Aktuell:', current, '%')
