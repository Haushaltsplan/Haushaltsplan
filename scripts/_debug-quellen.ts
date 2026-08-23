/**
 * Diagnose: Jahresabdeckung je Quelle für einen Titel.
 * Aufruf: npx tsx --conditions=react-server scripts/_debug-quellen.ts FR0000052292 RMS.PA
 */

import { yahooKennzahlenSymbolKandidaten } from '@/lib/portfolio-analyse/yahoo-kennzahlen-fallback-server'
import { ladeStockanalysisKapitalbasis } from '@/lib/portfolio-analyse/kapitalbasis/stockanalysis-kapitalbasis-server'
import { ladeYahooKapitalbasis } from '@/lib/portfolio-analyse/kapitalbasis/yahoo-kapitalbasis-server'
import {
  ladeStockanalysisAnnualBloecke,
  serieAusStockanalysisBlock,
} from '@/lib/portfolio-analyse/stockanalysis-statements-server'

async function main() {
  const [isin, symbol] = process.argv.slice(2)
  if (!symbol) {
    console.log('Aufruf: _debug-quellen.ts <ISIN> <SYMBOL>')
    return
  }

  const kandidaten = yahooKennzahlenSymbolKandidaten({ symbolYahoo: symbol, isin })
  console.log('Yahoo-Symbolkandidaten:', kandidaten.join(', '))

  const yahoo = await ladeYahooKapitalbasis(kandidaten)
  console.log(
    'Yahoo:',
    yahoo ? `${yahoo.jahre.length} Jahre ${yahoo.jahre[0]?.jahr}–${yahoo.jahre[yahoo.jahre.length - 1]?.jahr}` : 'null',
  )

  const sa = await ladeStockanalysisKapitalbasis({ symbolYahoo: symbol, isin })
  console.log(
    'StockAnalysis:',
    sa ? `${sa.jahre.length} Jahre ${sa.jahre[0]?.jahr}–${sa.jahre[sa.jahre.length - 1]?.jahr} (${sa.url})` : 'null',
  )

  const bloecke = await ladeStockanalysisAnnualBloecke({ symbolYahoo: symbol, isin })
  if (bloecke) {
    console.log('SA-URL:', bloecke.url)
    for (const teil of ['incomeStatement', 'balanceSheet', 'cashFlow'] as const) {
      const block = bloecke[teil]
      if (!block) {
        console.log(`  ${teil}: kein Block`)
        continue
      }
      const jahre = serieAusStockanalysisBlock(block, ['revenue', 'equity', 'ncfo'])
      const fy = block.match(/fiscalYear:\s*\[([^\]]*)\]/)?.[1] ?? '?'
      const fq = block.match(/fiscalQuarter:\s*\[([^\]]*)\]/)?.[1] ?? '?'
      console.log(`  ${teil}: fiscalYear=[${fy}]`)
      console.log(`    fiscalQuarter=[${fq}] geparste_Spalten=${jahre.size}`)
      for (const key of ['revenue', 'equity', 'debt', 'ncfo', 'capex', 'goodwill']) {
        const einzeln = serieAusStockanalysisBlock(block, [key])
        const arr = block.match(new RegExp(`${key}:\\[([^\\]]*)\\]`))?.[1]
        if (arr || einzeln.size > 0) {
          console.log(`    ${key}: parser=${einzeln.size} roh=[${(arr ?? '?').slice(0, 90)}]`)
        }
      }
    }
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
