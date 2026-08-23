/** TMO ROIIC — Live-Daten + Methoden-Breakdown. */
import {
  berechneRoiicAusSnaps,
  paketAusSnaps,
  roiicBookPct,
  roiicOrganicPct,
  roiicTangiblePct,
} from '../lib/portfolio-analyse/incremental-roic.ts'

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131 Safari/537.36'

function parse(s) {
  if (!s || s === '--' || s === '-') return null
  const n = Number(String(s).replace(/[$,\s]/g, ''))
  return Number.isFinite(n) ? n / 1000 : null
}

function row(rows, ...labels) {
  return rows?.find((r) => labels.some((l) => (r.value1 ?? '').toLowerCase() === l.toLowerCase()))
}

async function nasdaqSnaps(sym) {
  const r = await fetch(`https://api.nasdaq.com/api/company/${sym}/financials?frequency=1`, {
    headers: { 'User-Agent': UA, Accept: 'application/json', Origin: 'https://www.nasdaq.com' },
  })
  const j = await r.json()
  const inc = j.data?.incomeStatementTable
  const bal = j.data?.balanceSheetTable
  const cf = j.data?.cashFlowTable
  const jahre = new Map()
  for (const [k, v] of Object.entries(inc?.headers ?? {})) {
    if (k === 'value1') continue
    const m = String(v).match(/(\d{4})/)
    if (m) jahre.set(k, +m[1])
  }
  const oi = row(inc?.rows, 'Operating Income')
  const pretax = row(inc?.rows, 'Income Before Tax')
  const tax = row(inc?.rows, 'Income Tax', 'Provision for Income Taxes')
  const eq = row(bal?.rows, 'Total Equity', 'Total Stockholders Equity')
  const debt = row(bal?.rows, 'Long-Term Debt')
  const cash = row(bal?.rows, 'Cash and Cash Equivalents', 'Cash')
  const gw = row(bal?.rows, 'Goodwill')
  const inta = row(bal?.rows, 'Intangible Assets')
  const capex = row(cf?.rows, 'Capital Expenditures', 'Capital Expenditure')

  const snaps = []
  for (const [col, jahr] of jahre) {
    const oiV = parse(oi?.[col])
    const eqV = parse(eq?.[col])
    if (oiV == null || eqV == null) continue
    const pt = parse(pretax?.[col])
    const tx = parse(tax?.[col])
    const t = pt != null && pt > 0 && tx != null && tx >= 0 ? Math.min(0.5, tx / pt) : 0.21
    snaps.push({
      jahr,
      nopatMio: Math.round(oiV * (1 - t) * 10) / 10,
      icMio: Math.round((eqV + (parse(debt?.[col]) ?? 0) - (parse(cash?.[col]) ?? 0)) * 10) / 10,
      goodwillMio: parse(gw?.[col]),
      intangiblesMio: parse(inta?.[col]),
      capexMio: (() => {
        const v = parse(capex?.[col])
        return v != null ? Math.abs(v) : null
      })(),
      daMio: null,
    })
  }
  return snaps.sort((a, b) => a.jahr - b.jahr)
}

function roicPct(nopat, ic) {
  return ic > 0 ? Math.round((nopat / ic) * 1000) / 10 : null
}

const snaps = await nasdaqSnaps('TMO')
console.log('\n=== TMO Thermo Fisher — Nasdaq-Daten (Mio. USD) ===\n')
console.log(
  'Jahr'.padEnd(6),
  'NOPAT'.padStart(8),
  'IC'.padStart(10),
  'Goodwill'.padStart(10),
  'CapEx'.padStart(8),
  'ROIC'.padStart(8),
)
for (const s of snaps) {
  console.log(
    String(s.jahr).padEnd(6),
    String(s.nopatMio.toFixed(0)).padStart(8),
    String(s.icMio.toFixed(0)).padStart(10),
    String((s.goodwillMio ?? 0).toFixed(0)).padStart(10),
    String((s.capexMio ?? 0).toFixed(0)).padStart(8),
    String((roicPct(s.nopatMio, s.icMio) ?? '–') + '%').padStart(8),
  )
}

const paket = berechneRoiicAusSnaps(snaps, 'nasdaq')

// Debug: goodwill-Sprünge
for (let i = 1; i < snaps.length; i++) {
  const dGw = (snaps[i].goodwillMio ?? 0) - (snaps[i - 1].goodwillMio ?? 0)
  console.log(`GW-Sprung ${snaps[i - 1].jahr}→${snaps[i].jahr}: +${Math.round(dGw)} Mio.`)
}
console.log('\n=== Ergebnis (App-Logik) ===')
console.log('Incremental ROIC:', paket.incrementalRoicPct != null ? paket.incrementalRoicPct + '%' : '–')
console.log('Methode:', paket.methode ?? '–')
console.log('Fenster:', paket.fensterJahre != null ? paket.fensterJahre + ' Jahre' : '–')
console.log('1J:', paket.incrementalRoic1yPct, '| 5J:', paket.incrementalRoic5yPct)

const last = snaps[snaps.length - 1]
console.log('\n=== Methoden-Vergleich (letztes verfügbares Fenster) ===')
for (const span of [1, 2, 3]) {
  const basis = snaps.find((s) => s.jahr === last.jahr - span)
  if (!basis) continue
  const dazw = snaps.filter((s) => s.jahr >= basis.jahr && s.jahr <= last.jahr)
  console.log(`\n${basis.jahr}→${last.jahr} (${span}J):`)
  console.log('  ΔNOPAT:', Math.round(last.nopatMio - basis.nopatMio), 'Mio.')
  console.log('  ΔIC:', Math.round(last.icMio - basis.icMio), 'Mio.')
  console.log('  Book:', roiicBookPct(last, basis), '%')
  console.log('  Tangible:', roiicTangiblePct(last, basis), '%')
  console.log('  Organic:', roiicOrganicPct(last, basis, dazw), '%')
}
