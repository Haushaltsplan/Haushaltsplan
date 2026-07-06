import { NACHKAUF_RADAR_WHITELIST } from '../lib/portfolio-analyse/nachkauf-radar/nachkauf-radar-whitelist'
import { ISIN_KENNTNISSE } from '../lib/portfolio-analyse/isin-kenntnisse'

const UA = 'Omnia Haushalt test@example.com'

async function main() {
  const tickers = await (await fetch('https://www.sec.gov/files/company_tickers.json', {
    headers: { 'User-Agent': UA },
  })).json()
  const byTicker = new Map<string, number>()
  for (const r of Object.values(tickers) as { ticker: string; cik_str: number }[]) {
    byTicker.set(r.ticker.toUpperCase(), r.cik_str)
  }

  const fehler: string[] = []
  for (const pos of NACHKAUF_RADAR_WHITELIST.filter((p) => p.cik)) {
    const sym = ISIN_KENNTNISSE[pos.isin]?.symbolYahoo?.split('.')[0]?.toUpperCase()
    if (!sym) continue
    const secCik = byTicker.get(sym)
    const wlCik = parseInt(pos.cik!, 10)
    if (!secCik) {
      fehler.push(`${sym}: kein SEC-Ticker`)
      continue
    }
    if (secCik !== wlCik) {
      fehler.push(`${sym}: whitelist ${pos.cik} (${wlCik}) ≠ SEC ${secCik} (000${secCik}?)`)
    }
  }
  if (fehler.length === 0) console.log('Alle CIKs OK')
  else fehler.forEach((f) => console.log(f))
}

main().catch(console.error)
