/** npx tsx scripts/probe-backlog-html.ts */
import { writeFileSync } from 'fs'

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

async function main() {
  // StockAnalysis metrics
  const sa = await fetch('https://stockanalysis.com/stocks/now/metrics/', {
    headers: { 'User-Agent': UA },
  }).then((r) => r.text())
  const rpoIdx = sa.indexOf('Remaining Performance Obligations')
  console.log('SA RPO idx', rpoIdx)
  if (rpoIdx >= 0) console.log(sa.slice(rpoIdx, rpoIdx + 2500))

  // MarketBeat
  const mb = await fetch('https://www.marketbeat.com/stocks/NYSE/NOW/financials/', {
    headers: { 'User-Agent': UA },
  }).then((r) => r.text())
  const defIdx = mb.indexOf('Deferred Revenue')
  console.log('\nMB Deferred idx', defIdx)
  if (defIdx >= 0) console.log(mb.slice(defIdx - 200, defIdx + 1500))

  // Extract SA JSON if any
  for (const m of sa.matchAll(/<script[^>]*type="application\/json"[^>]*>([\s\S]*?)<\/script>/gi)) {
    if (/remaining|backlog|deferred|rpo/i.test(m[1]!)) {
      console.log('\nSA JSON block len', m[1]!.length)
      console.log(m[1]!.slice(0, 500))
    }
  }
}

main()
