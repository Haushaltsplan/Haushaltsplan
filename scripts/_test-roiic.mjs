/** Schnelltest: Incremental ROIC aus Nasdaq (GuruFocus ΔNOPAT/ΔIC). */
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131 Safari/537.36'

function roiic(snaps) {
  if (snaps.length < 2) return null
  const last = snaps[snaps.length - 1]
  const basis = snaps.find((s) => s.jahr === last.jahr - 5)
  if (!basis) return null
  const dN = last.nopatMio - basis.nopatMio
  const dI = last.icMio - basis.icMio
  if (Math.abs(dI) < 5) return null
  return Math.round((dN / dI) * 1000) / 10
}

async function nasdaqSnaps(sym) {
  const url = `https://api.nasdaq.com/api/company/${sym}/financials?frequency=1`
  const r = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: 'application/json', Origin: 'https://www.nasdaq.com' },
  })
  const j = await r.json()
  const inc = j.data?.incomeStatementTable
  const bal = j.data?.balanceSheetTable
  const headers = inc?.headers ?? {}
  const jahre = new Map()
  for (const [k, v] of Object.entries(headers)) {
    if (k === 'value1') continue
    const m = String(v).match(/(\d{4})/)
    if (m) jahre.set(k, +m[1])
  }
  const row = (rows, ...labels) =>
    rows?.find((r) => labels.some((l) => (r.value1 ?? '').toLowerCase() === l.toLowerCase()))
  const oi = row(inc?.rows, 'Operating Income')
  const pretax = row(inc?.rows, 'Income Before Tax')
  const tax = row(inc?.rows, 'Income Tax', 'Provision for Income Taxes')
  const eq = row(bal?.rows, 'Total Equity', 'Total Stockholders Equity')
  const debt = row(bal?.rows, 'Long-Term Debt')
  const cash = row(bal?.rows, 'Cash and Cash Equivalents', 'Cash')
  const parse = (s) => (s && s !== '--' ? Number(String(s).replace(/[$,\s]/g, '')) / 1000 : null)
  const snaps = []
  for (const [col, jahr] of jahre) {
    const oiV = parse(oi?.[col])
    const eqV = parse(eq?.[col])
    if (oiV == null || eqV == null) continue
    const pt = parse(pretax?.[col])
    const tx = parse(tax?.[col])
    const t = pt > 0 && tx >= 0 ? Math.min(0.5, tx / pt) : 0.21
    snaps.push({
      jahr,
      nopatMio: oiV * (1 - t),
      icMio: eqV + (parse(debt?.[col]) ?? 0) - (parse(cash?.[col]) ?? 0),
    })
  }
  return snaps.sort((a, b) => a.jahr - b.jahr)
}

const syms = process.argv.slice(2)
if (syms.length === 0) syms.push('SPGI', 'NOW', 'TMO', 'MSFT', 'AAPL')

for (const sym of syms) {
  const snaps = await nasdaqSnaps(sym)
  console.log(sym, 'ROIIC 5J', roiic(snaps) + '%', '| Jahre', snaps.map((s) => s.jahr).join(','))
}
