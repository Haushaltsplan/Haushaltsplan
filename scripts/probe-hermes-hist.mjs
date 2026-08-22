/** Probe Hermès Yahoo + Macrotrends history depth. */
import { writeFileSync } from 'fs'

async function yahooChart(symbol) {
  const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${symbol}?modules=incomeStatementHistory,cashflowStatementHistory,balanceSheetHistory,defaultKeyStatistics,financialData`
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
  })
  if (!res.ok) return { ok: false, status: res.status }
  const j = await res.json()
  const r = j?.quoteSummary?.result?.[0]
  const inc = r?.incomeStatementHistory?.incomeStatementHistory ?? []
  const cf = r?.cashflowStatementHistory?.cashflowStatements ?? []
  return {
    ok: true,
    incomeYears: inc.map((x) => x.endDate?.fmt ?? x.endDate?.raw),
    cfYears: cf.map((x) => x.endDate?.fmt ?? x.endDate?.raw),
    incomeN: inc.length,
    cfN: cf.length,
  }
}

async function yahooTimeseries(symbol) {
  // newer timeseries endpoint used by app
  const url = `https://query1.finance.yahoo.com/ws/fundamentals-timeseries/v1/finance/timeseries/${symbol}?type=annualTotalRevenue,annualNetIncome,annualFreeCashFlow,trailingPE,annualReturnOnEquity&period1=946684800&period2=${Math.floor(Date.now()/1000)}`
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
  if (!res.ok) return { ok: false, status: res.status }
  const j = await res.json()
  const series = j?.timeseries?.result ?? []
  const summary = {}
  for (const s of series) {
    const key = s.meta?.type?.[0] ?? 'x'
    const pts = s[key] ?? s.annualTotalRevenue ?? s.annualFreeCashFlow ?? s.annualReturnOnEquity ?? []
    const vals = Array.isArray(pts) ? pts.filter((p) => p?.reportedValue?.raw != null) : []
    summary[key] = vals.length
  }
  return { ok: true, summary, keys: series.map((s) => s.meta?.type) }
}

const rms = await yahooChart('RMS.PA')
const hesay = await yahooChart('HESAY')
const tsRms = await yahooTimeseries('RMS.PA')
const tsH = await yahooTimeseries('HESAY')

const out = { rms, hesay, tsRms, tsH }
writeFileSync('scripts/_hermes-hist.json', JSON.stringify(out, null, 2))
process.stderr.write(JSON.stringify({ rmsN: rms.incomeN, hesayN: hesay.incomeN, tsRms: tsRms.summary, tsH: tsH.summary }) + '\n')
