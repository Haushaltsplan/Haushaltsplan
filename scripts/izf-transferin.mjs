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
  gebuehrEur: r.gebuehr_eur,
  steuerEur: r.steuer_eur,
  quelle: r.quelle,
  assetKlasse: r.asset_klasse ?? 'aktie',
  buchungsHash: r.buchungs_hash,
}))

const div = await import(pathToFileURL(resolve('lib/portfolio-analyse/dividenden-buchung.ts')).href)
const xirr = await import(pathToFileURL(resolve('lib/portfolio-analyse/parqet-xirr.ts')).href)
const einstand = await import(pathToFileURL(resolve('lib/portfolio-analyse/parqet-einstand.ts')).href)
const feeIndex = einstand.gebuehrSteuerIndex(buchungen)

let gebSum = 0
for (const b of buchungen) {
  if (!div.istAktiendividendeAlsKauf(b)) continue
  const irr = xirr.irrBetragFuerKauf(b)
  const ein = einstand.kaufEinstandBetragEur(b, feeIndex)
  const geb = b.betragEur - ein
  gebSum += Math.max(0, geb)
}
console.log('embedded geb in aktiendiv kauf', gebSum)

const T = 94943.53
const asOf = new Date(`${new Date().toISOString().slice(0, 10)}T12:00:00`)
const { berechneIrrAnnualizedPercent } = await import(
  pathToFileURL(resolve('lib/portfolio-analyse/parqet-core/math-utils.ts')).href
)

// TransferIn: IZF nutzt nur Gebühr als Abfluss (Parqet-Hypothese)
function flowsTransferInGebuehrOnly() {
  const flows = []
  for (const b of [...buchungen].sort((a, b) => a.datum.localeCompare(b.datum))) {
    const d = new Date(`${b.datum}T12:00:00`)
    if (b.typ === 'kauf') {
      if (div.istAktiendividendeAlsKauf(b)) {
        const ein = einstand.kaufEinstandBetragEur(b, feeIndex)
        const geb = Math.max(0, b.betragEur - ein)
        if (geb > 0) flows.push({ date: d, amount: -geb })
        continue
      }
      flows.push({ date: d, amount: -xirr.irrBetragFuerKauf(b) })
    } else if (b.typ === 'verkauf') flows.push({ date: d, amount: Math.abs(b.betragEur) })
    else if (b.typ === 'dividende' || b.typ === 'zins') flows.push({ date: d, amount: Math.abs(b.betragEur) })
  }
  return flows
}
console.log('TransferIn geb only + div:', berechneIrrAnnualizedPercent(flowsTransferInGebuehrOnly(), T, asOf))

// TransferIn: skip + add dividendenZufluss as positive (Parqet Dividend+TransferIn)
function flowsSkipTransferInPlusDivZufluss() {
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
console.log('skip TransferIn + aktiendiv zufluss + bar div:', berechneIrrAnnualizedPercent(flowsSkipTransferInPlusDivZufluss(), T, asOf))

// Combined: regular + div + skip aktiendiv OUT but add synthetic DIVIDEND for aktiendiv ONLY on same day aggregated
function flowsParqetTransferInModel() {
  const roh = []
  for (const b of [...buchungen].sort((a, b) => a.datum.localeCompare(b.datum))) {
    const d = new Date(`${b.datum}T12:00:00`)
    if (b.typ === 'kauf') {
      const amt = xirr.irrBetragFuerKauf(b)
      if (div.istAktiendividendeAlsKauf(b)) {
        roh.push({ date: d, amount: -amt })
        roh.push({ date: d, amount: amt }) // synthetic dividend same day
        continue
      }
      roh.push({ date: d, amount: -amt })
    } else if (b.typ === 'verkauf') roh.push({ date: d, amount: Math.abs(b.betragEur) })
    else if (b.typ === 'dividende' || b.typ === 'zins') roh.push({ date: d, amount: Math.abs(b.betragEur) })
  }
  const map = new Map()
  for (const f of roh) {
    const k = f.date.toISOString().slice(0, 10) + '|' + f.amount // don't aggregate across different amounts same day?
    // actually aggregate by day only
  }
  // use xirr aggregation
  const map2 = new Map()
  for (const f of roh) {
    const k = f.date.toISOString().slice(0, 10)
    const cur = map2.get(k)
    if (cur) cur.amount = Math.round((cur.amount + f.amount) * 100) / 100
    else map2.set(k, { date: f.date, amount: Math.round(f.amount * 100) / 100 })
  }
  return [...map2.values()].filter((f) => Math.abs(f.amount) > 0.001)
}
console.log('net aktiendiv 0 + bar div:', berechneIrrAnnualizedPercent(flowsParqetTransferInModel(), T, asOf))
