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
  betragEur: r.betrag_eur,
  wertpapierName: r.wertpapier_name,
  quelle: r.quelle,
  steuerEur: r.steuer_eur,
  isin: r.isin,
}))

const div = await import(pathToFileURL(resolve('lib/portfolio-analyse/dividenden-buchung.ts')).href)

const cats = {
  explicit: { net: 0, steuer: 0, count: 0 },
  csvNoTax: { net: 0, count: 0 },
  pdfNoTax: { net: 0, count: 0 },
  smartNoTax: { net: 0, count: 0 },
  other: { net: 0, count: 0 },
}

for (const b of buchungen) {
  if (!div.istGezahlteBardividende(b)) continue
  const net = b.betragEur
  const st = b.steuerEur ?? 0
  const isSb = /smart\s*broker|smartbroker/i.test(b.wertpapierName ?? '')
  if (st > 0) {
    cats.explicit.net += net
    cats.explicit.steuer += st
    cats.explicit.count++
  } else if (isSb) {
    cats.smartNoTax.net += net
    cats.smartNoTax.count++
  } else if (b.quelle === 'pdf') {
    cats.pdfNoTax.net += net
    cats.pdfNoTax.count++
  } else if (b.quelle === 'csv') {
    cats.csvNoTax.net += net
    cats.csvNoTax.count++
  } else {
    cats.other.net += net
    cats.other.count++
  }
}
console.log('categories', cats)

// brutto = explicit.net + explicit.steuer + csvNoTax/(1-r) + pdf*(grossUp?) + smart*(grossUp?)
// Solve: for each combo of grossUp flags, find r that minimizes distance to target
const TARGET = { brutto: 2091.9, steuer: 399.03 }

function evalModel(r, grossCsv, grossPdf, grossSb) {
  const g = (net, up) => (up ? net / (1 - r) : net)
  const brutto =
    cats.explicit.net +
    cats.explicit.steuer +
    g(cats.csvNoTax.net, grossCsv) +
    g(cats.pdfNoTax.net, grossPdf) +
    g(cats.smartNoTax.net, grossSb) +
    g(cats.other.net, grossCsv)
  const steuer =
    cats.explicit.steuer +
    (g(cats.csvNoTax.net, grossCsv) - cats.csvNoTax.net) +
    (g(cats.pdfNoTax.net, grossPdf) - cats.pdfNoTax.net) +
    (g(cats.smartNoTax.net, grossSb) - cats.smartNoTax.net) +
    (g(cats.other.net, grossCsv) - cats.other.net)
  return { brutto, steuer, netto: brutto - steuer }
}

let best = null
for (const grossCsv of [true, false]) {
  for (const grossPdf of [true, false]) {
    for (const grossSb of [true, false]) {
      for (let i = 0; i <= 10000; i++) {
        const r = i / 100000
        const e = evalModel(r, grossCsv, grossPdf, grossSb)
        const err = Math.abs(e.brutto - TARGET.brutto) + Math.abs(e.steuer - TARGET.steuer)
        if (!best || err < best.err) best = { grossCsv, grossPdf, grossSb, r, ...e, err }
      }
    }
  }
}
console.log('best', best)

// Also check steuer from verkauf rows
let verkSteuer = 0
for (const b of buchungen) {
  if (b.typ === 'steuer') verkSteuer += b.betragEur
}
console.log('typ steuer sum', verkSteuer)

// steuer_eur on non-div
let steuerField = 0
let steuerFieldDiv = 0
for (const b of buchungen) {
  if (b.steuerEur > 0) {
    steuerField += b.steuerEur
    if (div.istGezahlteBardividende(b)) steuerFieldDiv += b.steuerEur
  }
}
console.log('steuer_eur total', steuerField, 'on div', steuerFieldDiv)
