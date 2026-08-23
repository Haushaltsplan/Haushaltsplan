/**
 * Leichte Prüfung: Yahoo/SA-Rohdaten + Multiple-Auffüller, ohne URD/News.
 */
import { baueFundamentalRohAusAlternativQuellen } from '../lib/portfolio-analyse/fundamentaldaten-yahoo-guv-server'
import { ergaenzeHistorischeMultiplesZeilen } from '../lib/portfolio-analyse/fundamentaldaten-historische-multiples-server'
import { ladeYahooFundamentalKennzahlenMitFallback } from '../lib/portfolio-analyse/yahoo-kennzahlen-fallback-server'
import { FUNDAMENTAL_TTM_KEY } from '../lib/portfolio-analyse/fundamentaldaten-types'

const TITEL = [
  { isin: 'FR0000052292', name: 'Hermès', symbolYahoo: 'RMS.PA', ticker: 'HESAY' },
  { isin: 'CH0418792922', name: 'Sika', symbolYahoo: 'SIKA.SW', ticker: 'SXYAY' },
  { isin: 'NL0010273215', name: 'ASML', symbolYahoo: 'ASML.AS', ticker: 'ASML' },
]

async function main() {
  for (const t of TITEL) {
    const roh = await baueFundamentalRohAusAlternativQuellen(
      { ticker: t.ticker, slug: '', firmenname: t.name },
      t.symbolYahoo,
      { isin: t.isin, firmenname: t.name, ticker: t.ticker },
    )
    const yahoo = await ladeYahooFundamentalKennzahlenMitFallback({
      symbolYahoo: t.symbolYahoo,
      isin: t.isin,
      macrotrendsTicker: t.ticker,
    })
    if (!roh) {
      console.log(`\n===== ${t.name}: keine Rohdaten =====`)
      continue
    }
    await ergaenzeHistorischeMultiplesZeilen({
      perioden: roh.perioden,
      zeilen: roh.zeilen,
      yahoo,
      symbolYahoo: t.symbolYahoo,
      isin: t.isin,
      ticker: t.ticker,
    })
    const keys = roh.perioden
      .filter((p) => !p.istSchaetzung)
      .map((p) => p.iso)
      .filter((iso) => /^\d{4}-\d{2}-\d{2}$/.test(iso) || iso === FUNDAMENTAL_TTM_KEY)
      .slice(-7)
    console.log(`\n===== ${t.name} perioden=${roh.perioden.length} =====`)
    for (const id of ['kgv', 'ps', 'pb', 'pfcf', 'ev_rev', 'ev_ebitda'] as const) {
      const z = roh.zeilen.find((r) => r.id === id)
      const teile = keys.map((k) => {
        const v = z?.werte[k]
        const label = k === FUNDAMENTAL_TTM_KEY ? 'TTM' : k.slice(0, 4)
        return `${label}:${v != null ? v.toFixed(1) : '–'}`
      })
      console.log(`  ${id.padEnd(12)} ${teile.join('  ')}`)
    }
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
