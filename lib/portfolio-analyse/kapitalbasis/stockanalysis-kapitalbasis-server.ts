/**
 * StockAnalysis → Kapitalbasis-Jahresreihe.
 *
 * Wichtig für die Titel ohne SEC-Registrierung: StockAnalysis ist dort die einzige Quelle
 * mit Intangibles und kurzfristigen Verbindlichkeiten, ohne die weder ein
 * goodwill-bereinigtes Kapital noch Working Capital berechenbar sind.
 *
 * Im Unterschied zu `snapsFuerIncrementalRoic` wird hier kein pauschaler Steuersatz von
 * 21 % gesetzt — Vorsteuerergebnis und Steueraufwand werden mitgelesen, damit die
 * Normalisierung in `kapitalbasis-ableitung` mit echten Werten arbeiten kann.
 */

import 'server-only'

import {
  ladeStockanalysisAnnualBloecke,
  serieAusStockanalysisBlock,
} from '@/lib/portfolio-analyse/stockanalysis-statements-server'
import {
  leeresKapitalbasisJahr,
  type KapitalbasisJahr,
  type KapitalbasisRohfeld,
} from '@/lib/portfolio-analyse/kapitalbasis/kapitalbasis-typen'

const CACHE_MS = 6 * 60 * 60 * 1000
const cache = new Map<string, { at: number; data: StockanalysisKapitalbasisRoh | null }>()

export type StockanalysisKapitalbasisRoh = {
  waehrung: string | null
  jahre: KapitalbasisJahr[]
  url: string
}

type Statement = 'incomeStatement' | 'balanceSheet' | 'cashFlow'

type Zuordnung = {
  feld: KapitalbasisRohfeld
  statement: Statement
  keys: string[]
  modus?: 'raw' | 'abfluss'
}

const ZUORDNUNGEN: Zuordnung[] = [
  { feld: 'umsatzMio', statement: 'incomeStatement', keys: ['revenue'] },
  { feld: 'ebitMio', statement: 'incomeStatement', keys: ['opinc', 'ebit', 'operatingIncome'] },
  { feld: 'pretaxMio', statement: 'incomeStatement', keys: ['pretaxIncome', 'ebt'] },
  { feld: 'steuerMio', statement: 'incomeStatement', keys: ['taxExp', 'incomeTax'] },
  {
    feld: 'nettogewinnMio',
    statement: 'incomeStatement',
    keys: ['netinccmn', 'netinc', 'netIncome'],
  },
  { feld: 'zinsaufwandMio', statement: 'incomeStatement', keys: ['intexp', 'interestExpense'] },

  { feld: 'eigenkapitalParentMio', statement: 'balanceSheet', keys: ['equity', 'totalCommonEquity'] },
  { feld: 'minderheitenMio', statement: 'balanceSheet', keys: ['minorityInterest'] },
  { feld: 'langfristigeSchuldenMio', statement: 'balanceSheet', keys: ['debtnc', 'ltdebt'] },
  { feld: 'kurzfristigeSchuldenMio', statement: 'balanceSheet', keys: ['debtc', 'stdebt'] },
  { feld: 'bargeldMio', statement: 'balanceSheet', keys: ['cashneq'] },
  {
    feld: 'kurzfristigeAnlagenMio',
    statement: 'balanceSheet',
    keys: ['shortTermInvestments', 'investmentsc'],
  },
  { feld: 'goodwillMio', statement: 'balanceSheet', keys: ['goodwill'] },
  { feld: 'intangiblesMio', statement: 'balanceSheet', keys: ['otherIntangibles', 'intangibles'] },
  { feld: 'gesamtvermoegenMio', statement: 'balanceSheet', keys: ['assets', 'totalassets'] },
  { feld: 'umlaufvermoegenMio', statement: 'balanceSheet', keys: ['assetsc', 'totalcurrentassets'] },
  {
    feld: 'kurzfristigeVerbindlichkeitenMio',
    statement: 'balanceSheet',
    keys: ['liabilitiesc', 'totalcurrentliabilities'],
  },

  { feld: 'ocfMio', statement: 'cashFlow', keys: ['ncfo', 'operatingCashFlow'] },
  { feld: 'capexMio', statement: 'cashFlow', keys: ['capex'], modus: 'abfluss' },
  { feld: 'daMio', statement: 'cashFlow', keys: ['totalDepAmorCF', 'depAmor', 'depamor'] },
  { feld: 'akquisitionenMio', statement: 'cashFlow', keys: ['ncfbus', 'acquisitions'] },
  { feld: 'aktienrueckkaufMio', statement: 'cashFlow', keys: ['buyback', 'ncfcommon'] },
  { feld: 'dividendenMio', statement: 'cashFlow', keys: ['ncfdiv', 'dividends'] },
]

/**
 * Fällt der Schulden-Split aus, wird die Gesamtverschuldung als langfristiger Anteil
 * gebucht. Besser eine vollständige Kapitalbasis mit gröberer Aufteilung als ein
 * investiertes Kapital, dem die Schulden ganz fehlen.
 */
const GESAMTSCHULDEN_KEYS = ['debt', 'totaldebt']

export async function ladeStockanalysisKapitalbasis(opts: {
  symbolYahoo?: string | null
  ticker?: string | null
  isin?: string | null
  firmenname?: string | null
}): Promise<StockanalysisKapitalbasisRoh | null> {
  const schluessel = `${opts.isin ?? ''}|${opts.symbolYahoo ?? ''}|${opts.ticker ?? ''}`
  const hit = cache.get(schluessel)
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.data

  const merke = (data: StockanalysisKapitalbasisRoh | null) => {
    cache.set(schluessel, { at: Date.now(), data })
    return data
  }

  try {
    const bloecke = await ladeStockanalysisAnnualBloecke({
      ...opts,
      bevorzugeHeimatnotierung: true,
    })
    if (!bloecke) return merke(null)

    const proJahr = new Map<number, KapitalbasisJahr>()
    const hole = (iso: string): KapitalbasisJahr | null => {
      const jahr = Number.parseInt(iso.slice(0, 4), 10)
      if (!Number.isFinite(jahr)) return null
      let eintrag = proJahr.get(jahr)
      if (!eintrag) {
        eintrag = leeresKapitalbasisJahr(jahr, iso)
        proJahr.set(jahr, eintrag)
      }
      return eintrag
    }

    for (const z of ZUORDNUNGEN) {
      const serie = serieAusStockanalysisBlock(bloecke[z.statement], z.keys, z.modus)
      for (const [iso, wert] of serie) {
        const eintrag = hole(iso)
        if (!eintrag || eintrag[z.feld] != null) continue
        eintrag[z.feld] = Math.round(wert * 10) / 10
        eintrag.quellen[z.feld] = 'stockanalysis'
      }
    }

    const gesamt = serieAusStockanalysisBlock(bloecke.balanceSheet, GESAMTSCHULDEN_KEYS)
    for (const [iso, wert] of gesamt) {
      const eintrag = hole(iso)
      if (!eintrag) continue
      if (eintrag.langfristigeSchuldenMio != null || eintrag.kurzfristigeSchuldenMio != null) continue
      eintrag.langfristigeSchuldenMio = Math.round(wert * 10) / 10
      eintrag.quellen.langfristigeSchuldenMio = 'stockanalysis'
    }

    const jahre = [...proJahr.values()]
      .filter((j) => j.ebitMio != null || j.eigenkapitalParentMio != null)
      .sort((a, b) => a.jahr - b.jahr)
    if (jahre.length < 2) return merke(null)

    return merke({ waehrung: null, jahre, url: bloecke.url })
  } catch {
    return merke(null)
  }
}
