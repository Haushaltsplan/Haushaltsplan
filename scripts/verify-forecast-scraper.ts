/**
 * Verifiziert Forecast-Scraper (Jahres-Schätzungen bis 2028).
 * Ausführen: npx tsx scripts/verify-forecast-scraper.ts
 */
import { ladeFundamentalSchaetzungen } from '../lib/portfolio-analyse/fundamentaldaten-schaetzungen-server'
import { ladeMarketscreenerForecastReihe } from '../lib/portfolio-analyse/marketscreener-forecast-server'
import { ladeStockanalysisJahresForecast } from '../lib/portfolio-analyse/stockanalysis-forecast-server'

const TICKERS = [
  { sym: 'MSFT', isin: 'US5949181045', name: 'Microsoft' },
  { sym: 'GOOGL', isin: 'US02079K3059', name: 'Alphabet' },
  { sym: 'MA', isin: 'US57636Q1040', name: 'Mastercard' },
  { sym: 'SPGI', isin: 'US78409V1044', name: 'S&P Global' },
  { sym: 'NVDA', isin: 'US67066G1040', name: 'NVIDIA' },
]

let ok = 0
let fail = 0

async function main() {
for (const t of TICKERS) {
  console.log(`\n=== ${t.sym} ===`)

  const [ms, sa, fund] = await Promise.all([
    ladeMarketscreenerForecastReihe(t.isin, t.name, t.sym),
    ladeStockanalysisJahresForecast({ symbolYahoo: t.sym, isin: t.isin, firmenname: t.name }),
    ladeFundamentalSchaetzungen({ symbol: t.sym, isin: t.isin, name: t.name }),
  ])

  const msJahre = ms?.jahresreihe.map((e) => e.jahr) ?? []
  const saJahre = sa?.jahresreihe.filter((e) => e.istSchätzung).map((e) => e.jahr) ?? []
  const fundJahre = fund.perioden.map((p) => p.label)
  const maxJahr = Math.max(0, ...msJahre, ...saJahre)

  console.log('  MS Jahre:', msJahre.join(', ') || '—')
  console.log(
    '  MS Umsatz:',
    ms?.jahresreihe.map((e) => `${e.jahr}=${e.umsatzUsd ? (e.umsatzUsd / 1e9).toFixed(1) + 'B' : '?'}`).join(' | ') ?? '—',
  )
  console.log('  SA Schätz-Jahre:', saJahre.join(', ') || '—')
  console.log(
    '  SA EPS:',
    sa?.jahresreihe
      .filter((e) => e.istSchätzung)
      .map((e) => `${e.jahr}=${e.eps?.toFixed(2) ?? '?'}`)
      .join(' | ') ?? '—',
  )
  console.log('  Fund Perioden:', fundJahre.join(', ') || '—')
  console.log('  Fund Quelle:', fund.quelle ?? '—')

  const umsatzZeile = fund.zeilen.find((z) => z.id === 'umsatz_schaetzung')
  const epsZeile = fund.zeilen.find((z) => z.id === 'eps_schaetzung')
  if (umsatzZeile) {
    const vals = fund.perioden
      .map((p) => {
        const v = umsatzZeile.werte[p.iso]
        return v != null ? `${p.label}=${(v / 1000).toFixed(1)}B` : null
      })
      .filter(Boolean)
    console.log('  Fund Umsatz:', vals.join(' | ') || '—')
  }
  if (epsZeile) {
    const vals = fund.perioden
      .map((p) => {
        const v = epsZeile.werte[p.iso]
        return v != null ? `${p.label}=${v.toFixed(2)}` : null
      })
      .filter(Boolean)
    console.log('  Fund EPS:', vals.join(' | ') || '—')
  }

  if (maxJahr >= 2028) {
    console.log('  ✓ Erreicht 2028+')
    ok++
  } else if (maxJahr >= 2027) {
    console.log('  ~ Bis 2027 (2028 fehlt bei diesem Titel)')
    ok++
  } else {
    console.log('  ✗ Zu wenig Forward-Jahre')
    fail++
  }
}

console.log(`\n=== ERGEBNIS: ${ok} OK, ${fail} FAIL ===`)
process.exit(fail > 0 ? 1 : 0)
}

void main()
