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
  id: r.id,
  datum: r.datum,
  typ: r.typ,
  betragEur: r.betrag_eur,
  wertpapierName: r.wertpapier_name,
  quelle: r.quelle,
  steuerEur: r.steuer_eur,
}))

const div = await import(pathToFileURL(resolve('lib/portfolio-analyse/dividenden-buchung.ts')).href)
const RATE = 399.03 / 2091.9
const TARGET_B = 2091.9
const TARGET_S = 399.03

const items = buchungen.filter((b) => div.istGezahlteBardividende(b)).map((b, i) => {
  const net = b.betragEur
  const st = b.steuerEur ?? 0
  let bruttoGross = 0
  let bruttoNet = 0
  if (st > 0) {
    bruttoGross = net + st
    bruttoNet = net
  } else if (b.quelle === 'pdf') {
    bruttoGross = net / (1 - RATE)
    bruttoNet = net
  } else {
    bruttoGross = net / (1 - RATE)
    bruttoNet = net
  }
  return { i, net, st, quelle: b.quelle, grossUp: bruttoGross - bruttoNet, bruttoGross, bruttoNet, name: b.wertpapierName }
})

// baseline: explicit steuer, pdf net, csv+sb gross
function calc(excludeIdx) {
  let brutto = 0
  let netto = 0
  for (const it of items) {
    netto += it.net
    if (it.st > 0) brutto += it.bruttoGross - it.grossUp // explicit
    else if (it.quelle === 'pdf') brutto += excludeIdx.has(it.i) ? it.bruttoGross : it.bruttoNet
    else brutto += excludeIdx.has(it.i) ? it.bruttoNet : it.bruttoGross
  }
  return { brutto, steuer: brutto - netto }
}

const base = calc(new Set())
console.log('baseline explicit+pdfNet+csvSbGross', base)

// try exclude all pdf from gross (already net) - try gross pdf
function calc2(pdfGross) {
  let brutto = 0
  let netto = 0
  for (const it of items) {
    netto += it.net
    if (it.st > 0) brutto += it.net + it.st
    else if (it.quelle === 'pdf') brutto += pdfGross ? it.net / (1 - RATE) : it.net
    else brutto += it.net / (1 - RATE)
  }
  return { brutto, steuer: brutto - netto }
}
console.log('pdfGross false', calc2(false))
console.log('pdfGross true', calc2(true))

// try exclude smartbroker from gross
function calc3(sbGross) {
  let brutto = 0
  let netto = 0
  for (const b of buchungen) {
    if (!div.istGezahlteBardividende(b)) continue
    const net = b.betragEur
    netto += net
    const st = b.steuerEur ?? 0
    const sb = /smart\s*broker|smartbroker/i.test(b.wertpapierName ?? '')
    if (st > 0) brutto += net + st
    else if (b.quelle === 'pdf') brutto += net
    else if (sb) brutto += sbGross ? net / (1 - RATE) : net
    else brutto += net / (1 - RATE)
  }
  return { brutto, steuer: brutto - netto }
}
console.log('sbGross false', calc3(false))
console.log('sbGross true', calc3(true))

// explicit rows: gross up instead of net+steuer?
function calc4(explicitGross) {
  let brutto = 0
  let netto = 0
  for (const b of buchungen) {
    if (!div.istGezahlteBardividende(b)) continue
    const net = b.betragEur
    netto += net
    const st = b.steuerEur ?? 0
    if (st > 0) brutto += explicitGross ? net / (1 - RATE) : net + st
    else if (b.quelle === 'pdf') brutto += net
    else brutto += net / (1 - RATE)
  }
  return { brutto, steuer: brutto - netto }
}
console.log('explicitGross false', calc4(false))
console.log('explicitGross true', calc4(true))

// combo search
let best = null
for (const pdfGross of [false, true]) {
  for (const sbGross of [false, true]) {
    for (const explicitGross of [false, true]) {
      let brutto = 0
      let netto = 0
      for (const b of buchungen) {
        if (!div.istGezahlteBardividende(b)) continue
        const net = b.betragEur
        netto += net
        const st = b.steuerEur ?? 0
        const sb = /smart\s*broker|smartbroker/i.test(b.wertpapierName ?? '')
        if (st > 0) brutto += explicitGross ? net / (1 - RATE) : net + st
        else if (b.quelle === 'pdf') brutto += pdfGross ? net / (1 - RATE) : net
        else if (sb) brutto += sbGross ? net / (1 - RATE) : net
        else brutto += net / (1 - RATE)
      }
      const steuer = brutto - netto
      const err = Math.abs(brutto - TARGET_B) + Math.abs(steuer - TARGET_S)
      if (!best || err < best.err) best = { pdfGross, sbGross, explicitGross, brutto, steuer, err }
    }
  }
}
console.log('best combo', best)

// fine-tune rate with best combo pdfGross true sbGross true explicitGross false
for (let i = 17000; i <= 20000; i++) {
  const r = i / 100000
  let brutto = 0
  let netto = 0
  for (const b of buchungen) {
    if (!div.istGezahlteBardividende(b)) continue
    const net = b.betragEur
    netto += net
    const st = b.steuerEur ?? 0
    if (st > 0) brutto += net + st
    else if (b.quelle === 'pdf') brutto += net
    else brutto += net / (1 - r)
  }
  const steuer = brutto - netto
  if (Math.abs(brutto - TARGET_B) < 0.1) console.log('fine r', r, { brutto, steuer })
}
