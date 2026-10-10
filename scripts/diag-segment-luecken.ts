/**
 * Findet Jahre mit stark unterzähltem Segmentumsatz (Chart-Schrumpfung).
 * npx tsx --conditions=react-server --require ./scripts/mock-server-only.cjs scripts/diag-segment-luecken.ts
 */
import { ladeSecSegmentHistorie } from '../lib/portfolio-analyse/sec-edgar-segment-historie-server'
import { ladeGescrapteSegmentStruktur } from '../lib/portfolio-analyse/segment-struktur-scraper-server'

const TICKERS = [
  { ticker: 'ISRG', name: 'Intuitive Surgical' },
  { ticker: 'TMO', name: 'Thermo Fisher' },
  { ticker: 'DHR', name: 'Danaher' },
  { ticker: 'A', name: 'Agilent' },
  { ticker: 'RMD', name: 'ResMed' },
  { ticker: 'BSX', name: 'Boston Scientific' },
  { ticker: 'SYK', name: 'Stryker' },
  { ticker: 'MDT', name: 'Medtronic' },
  { ticker: 'ABT', name: 'Abbott' },
  { ticker: 'GOOGL', name: 'Alphabet' },
  { ticker: 'MSFT', name: 'Microsoft' },
  { ticker: 'AMZN', name: 'Amazon' },
  { ticker: 'SPGI', name: 'S&P Global' },
]

function analyseHist(
  label: string,
  hist: { jahre: { jahr: number; segmente: { name: string; umsatzMio: number | null }[] }[] } | null | undefined,
) {
  if (!hist?.jahre?.length) {
    console.log(label, 'keine Historie')
    return
  }
  const sums = hist.jahre.map((j) => ({
    jahr: j.jahr,
    sum: j.segmente.reduce((s, x) => s + (x.umsatzMio ?? 0), 0),
    n: j.segmente.filter((s) => (s.umsatzMio ?? 0) > 0).length,
    names: j.segmente.map((s) => s.name).join('/'),
  }))
  const maxSum = Math.max(...sums.map((s) => s.sum), 1)
  console.log(label, 'segmente', hist.jahre.at(-1)?.segmente.map((s) => s.name).join(' | '))
  for (const s of sums) {
    const pct = Math.round((s.sum / maxSum) * 100)
    const flag = pct < 70 ? ' *** LOW' : ''
    console.log(
      `  ${s.jahr}: sum=${Math.round(s.sum)} (${pct}% of peak) n=${s.n}${flag}`,
    )
  }
}

async function main() {
  for (const t of TICKERS) {
    console.log('\n====', t.ticker, '====')
    try {
      const sec = await ladeSecSegmentHistorie(t.ticker)
      analyseHist('SEC produkt', sec?.produkt)
      analyseHist('SEC geo', sec?.geo)
    } catch (e) {
      console.log('SEC err', e)
    }
    try {
      const live = await ladeGescrapteSegmentStruktur({
        ticker: t.ticker,
        name: t.name,
        refresh: true,
      })
      analyseHist('LIVE produkt', live?.produkt)
      analyseHist('LIVE geo', live?.geo)
      console.log('quelle', live?.quelle)
    } catch (e) {
      console.log('LIVE err', String(e).slice(0, 100))
    }
    await new Promise((r) => setTimeout(r, 500))
  }
}
main()
