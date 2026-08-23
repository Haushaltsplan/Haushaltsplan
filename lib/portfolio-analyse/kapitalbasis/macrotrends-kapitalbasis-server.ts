/**
 * Macrotrends → Kapitalbasis.
 *
 * Zweck ist die **Historienlänge**. Yahoo liefert bei Nicht-US-Titeln nur vier
 * Geschäftsjahre, StockAnalysis gibt international fünf frei — für ein Fünf-Jahres-Fenster
 * mit Ein-Jahres-Lag braucht ROIIC aber sieben. Macrotrends stellt pro Statement-Seite
 * zehn und mehr Jahre bereit und ist damit die einzige Quelle, die das Fenster für
 * Hermès, Sika, Straumann, Halma, Wolters Kluwer und Couche-Tard überhaupt füllt.
 *
 * Werte kommen bereits in Mio. Berichtswährung.
 */

import 'server-only'

import {
  ladeMacrotrendsStatementSerien,
  loeseMacrotrendsIdent,
  macrotrendsTickerAusSymbol,
  type MacrotrendsIdent,
} from '@/lib/portfolio-analyse/macrotrends-scraper-server'
import { isinKenntnis } from '@/lib/portfolio-analyse/isin-kenntnisse'
import {
  leeresKapitalbasisJahr,
  type KapitalbasisJahr,
  type KapitalbasisRohfeld,
} from '@/lib/portfolio-analyse/kapitalbasis/kapitalbasis-typen'

const CACHE_MS = 12 * 60 * 60 * 1000
const cache = new Map<string, { at: number; data: MacrotrendsKapitalbasisRoh | null }>()

export type MacrotrendsKapitalbasisRoh = {
  jahre: KapitalbasisJahr[]
  ident: MacrotrendsIdent
}

/**
 * Feld → Macrotrends-Slugs (erster Treffer gewinnt) und Vorzeichenbehandlung.
 *
 * `abfluss` erzwingt ein negatives Vorzeichen: Macrotrends führt CapEx und Rückkäufe je
 * nach Titel mit wechselndem Vorzeichen, die Ableitung erwartet Abflüsse konsistent negativ.
 */
const FELD_SLUGS: Array<{
  feld: KapitalbasisRohfeld
  statement: 'income-statement' | 'balance-sheet' | 'cash-flow-statement'
  slugs: string[]
  modus?: 'abfluss'
}> = [
  { feld: 'umsatzMio', statement: 'income-statement', slugs: ['revenue'] },
  { feld: 'ebitMio', statement: 'income-statement', slugs: ['operating-income'] },
  {
    feld: 'pretaxMio',
    statement: 'income-statement',
    slugs: ['pre-tax-income', 'income-before-taxes'],
  },
  {
    feld: 'steuerMio',
    statement: 'income-statement',
    slugs: ['total-provision-income-taxes', 'income-taxes'],
  },
  { feld: 'nettogewinnMio', statement: 'income-statement', slugs: ['net-income'] },
  {
    feld: 'zinsaufwandMio',
    statement: 'income-statement',
    slugs: ['total-non-operating-income-expense'],
  },

  {
    feld: 'eigenkapitalParentMio',
    statement: 'balance-sheet',
    slugs: ['total-share-holder-equity', 'total-stockholder-equity', 'total-stockholders-equity'],
  },
  { feld: 'minderheitenMio', statement: 'balance-sheet', slugs: ['minority-interest'] },
  {
    feld: 'langfristigeSchuldenMio',
    statement: 'balance-sheet',
    slugs: ['long-term-debt'],
  },
  { feld: 'bargeldMio', statement: 'balance-sheet', slugs: ['cash-on-hand'] },
  { feld: 'goodwillMio', statement: 'balance-sheet', slugs: ['goodwill'] },
  {
    feld: 'intangiblesMio',
    statement: 'balance-sheet',
    slugs: ['other-intangible-assets', 'intangible-assets'],
  },
  { feld: 'gesamtvermoegenMio', statement: 'balance-sheet', slugs: ['total-assets'] },
  { feld: 'umlaufvermoegenMio', statement: 'balance-sheet', slugs: ['total-current-assets'] },
  {
    feld: 'kurzfristigeVerbindlichkeitenMio',
    statement: 'balance-sheet',
    slugs: ['total-current-liabilities'],
  },

  {
    feld: 'ocfMio',
    statement: 'cash-flow-statement',
    slugs: ['cash-flow-from-operating-activities'],
  },
  {
    feld: 'capexMio',
    statement: 'cash-flow-statement',
    slugs: ['net-change-in-property-plant-equipment'],
    modus: 'abfluss',
  },
  {
    feld: 'daMio',
    statement: 'cash-flow-statement',
    slugs: ['depreciation-amortization', 'total-depreciation-amortization-cash-flow'],
  },
  {
    feld: 'akquisitionenMio',
    statement: 'cash-flow-statement',
    slugs: ['net-acquisitions-divestitures'],
    modus: 'abfluss',
  },
  {
    feld: 'aktienrueckkaufMio',
    statement: 'cash-flow-statement',
    slugs: ['common-stock-repurchased', 'net-common-equity-issued-repurchased'],
    modus: 'abfluss',
  },
  {
    feld: 'dividendenMio',
    statement: 'cash-flow-statement',
    slugs: ['common-stock-dividends-paid'],
    modus: 'abfluss',
  },
]

/**
 * Geschäftsjahr aus dem Bilanzstichtag. Wie beim SEC-Pfad zählt ein Stichtag im ersten
 * Halbjahr zum Vorjahr, damit z. B. Halma (Ende März) nicht ein Jahr zu früh einsortiert wird.
 */
function fiskaljahr(iso: string): number | null {
  const m = /^(\d{4})-(\d{2})-\d{2}$/.exec(iso)
  if (!m) return null
  const jahr = Number(m[1])
  const monat = Number(m[2])
  if (!Number.isFinite(jahr)) return null
  return monat <= 6 ? jahr - 1 : jahr
}

async function loeseIdent(opts: {
  symbolYahoo?: string | null
  isin?: string | null
  firmenname?: string | null
}): Promise<MacrotrendsIdent | null> {
  const k = isinKenntnis(opts.isin?.trim().toUpperCase() ?? '')
  const ticker = k?.macrotrendsTicker ?? macrotrendsTickerAusSymbol(opts.symbolYahoo ?? '')
  if (!ticker) return null

  if (k?.macrotrendsSlug) {
    return { ticker, slug: k.macrotrendsSlug, firmenname: k.name ?? ticker }
  }

  return loeseMacrotrendsIdent(ticker, {
    firmenname: opts.firmenname ?? k?.name ?? undefined,
  })
}

export async function ladeMacrotrendsKapitalbasis(opts: {
  symbolYahoo?: string | null
  isin?: string | null
  firmenname?: string | null
}): Promise<MacrotrendsKapitalbasisRoh | null> {
  const schluessel = `${opts.isin ?? ''}|${opts.symbolYahoo ?? ''}`
  const hit = cache.get(schluessel)
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.data

  const merke = (data: MacrotrendsKapitalbasisRoh | null) => {
    cache.set(schluessel, { at: Date.now(), data })
    return data
  }

  try {
    const ident = await loeseIdent(opts)
    if (!ident) return merke(null)

    const [income, bilanz, cashflow] = await Promise.all([
      ladeMacrotrendsStatementSerien(ident, 'income-statement'),
      ladeMacrotrendsStatementSerien(ident, 'balance-sheet'),
      ladeMacrotrendsStatementSerien(ident, 'cash-flow-statement'),
    ])
    if (!income && !bilanz && !cashflow) return merke(null)

    const statements = {
      'income-statement': income,
      'balance-sheet': bilanz,
      'cash-flow-statement': cashflow,
    }

    const proJahr = new Map<number, KapitalbasisJahr>()
    const hole = (iso: string): KapitalbasisJahr | null => {
      const jahr = fiskaljahr(iso)
      if (jahr == null) return null
      let eintrag = proJahr.get(jahr)
      if (!eintrag) {
        eintrag = leeresKapitalbasisJahr(jahr, iso)
        proJahr.set(jahr, eintrag)
      } else if (eintrag.periodenEnde == null || iso > eintrag.periodenEnde) {
        eintrag.periodenEnde = iso
      }
      return eintrag
    }

    for (const def of FELD_SLUGS) {
      const serien = statements[def.statement]
      if (!serien) continue
      const serie = def.slugs.map((s) => serien.get(s)).find((s) => s != null && s.size > 0)
      if (!serie) continue

      for (const [iso, rohwert] of serie) {
        const eintrag = hole(iso)
        if (!eintrag || eintrag[def.feld] != null) continue
        const wert =
          def.modus === 'abfluss' ? (rohwert > 0 ? -rohwert : rohwert) : rohwert
        eintrag[def.feld] = wert
        eintrag.quellen[def.feld] = 'macrotrends'
      }
    }

    const jahre = [...proJahr.values()]
      .filter((j) => Object.keys(j.quellen).length > 0)
      .sort((a, b) => a.jahr - b.jahr)

    return jahre.length > 0 ? merke({ jahre, ident }) : merke(null)
  } catch {
    return merke(null)
  }
}
