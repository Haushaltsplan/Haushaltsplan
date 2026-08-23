/**
 * Yahoo Fundamentals-Timeseries → Kapitalbasis-Jahresreihe.
 *
 * Eigener Loader statt Wiederverwendung von `ladeYahooMantraFinanzdaten`: dort werden nur
 * 13 Jahresfelder abgefragt, es fehlen Intangibles, Working Capital, der Schulden-Split
 * und Minderheitenanteile. Genau die braucht die Kapitalbasis, und für die Titel ohne
 * SEC-Registrierung (Hermès, Sika, Straumann, Halma, Wolters Kluwer, Couche-Tard) ist
 * Yahoo die primäre Quelle — dort darf nichts fehlen.
 *
 * Historie ab 2005 statt 2015, damit auch 5-Jahres-ROIIC mit Lag über längere Zeiträume
 * rechenbar bleibt.
 */

import 'server-only'

import {
  holeYahooFinanceAuth,
  YAHOO_FINANCE_FETCH_HEADERS,
} from '@/lib/portfolio-analyse/yahoo-finance-auth-server'
import {
  leeresKapitalbasisJahr,
  type KapitalbasisJahr,
  type KapitalbasisRohfeld,
} from '@/lib/portfolio-analyse/kapitalbasis/kapitalbasis-typen'

const CACHE_MS = 12 * 60 * 60 * 1000
const cache = new Map<string, { at: number; data: YahooKapitalbasisRoh | null }>()

/** Mehrere Yahoo-Typen je Feld: erster mit Wert gewinnt (Yahoo benennt uneinheitlich). */
const FELD_TYPEN: Record<KapitalbasisRohfeld, string[]> = {
  umsatzMio: ['annualTotalRevenue', 'annualOperatingRevenue'],
  ebitMio: ['annualOperatingIncome', 'annualEBIT'],
  pretaxMio: ['annualPretaxIncome'],
  steuerMio: ['annualTaxProvision'],
  nettogewinnMio: ['annualNetIncome', 'annualNetIncomeCommonStockholders'],
  zinsaufwandMio: ['annualInterestExpense', 'annualInterestExpenseNonOperating'],

  eigenkapitalParentMio: ['annualStockholdersEquity'],
  eigenkapitalInklMinderheitenMio: ['annualTotalEquityGrossMinorityInterest'],
  minderheitenMio: ['annualMinorityInterest'],
  rueckkaufbareMinderheitenMio: [],
  langfristigeSchuldenMio: [
    'annualLongTermDebtAndCapitalLeaseObligation',
    'annualLongTermDebt',
  ],
  kurzfristigeSchuldenMio: [
    'annualCurrentDebtAndCapitalLeaseObligation',
    'annualCurrentDebt',
  ],
  leasingverbindlichkeitenMio: ['annualLongTermCapitalLeaseObligation'],

  bargeldMio: ['annualCashAndCashEquivalents'],
  kurzfristigeAnlagenMio: ['annualOtherShortTermInvestments'],
  goodwillMio: ['annualGoodwill'],
  intangiblesMio: ['annualOtherIntangibleAssets'],
  gesamtvermoegenMio: ['annualTotalAssets'],
  umlaufvermoegenMio: ['annualCurrentAssets'],
  kurzfristigeVerbindlichkeitenMio: ['annualCurrentLiabilities'],

  ocfMio: ['annualOperatingCashFlow'],
  capexMio: ['annualCapitalExpenditure'],
  softwareCapexMio: [],
  daMio: [
    'annualDepreciationAmortizationInIncomeStatement',
    'annualDepreciationAndAmortization',
  ],
  akquisitionenMio: ['annualPurchaseOfBusiness'],
  aktienrueckkaufMio: ['annualRepurchaseOfCapitalStock'],
  dividendenMio: ['annualCashDividendsPaid'],
}

/**
 * Yahoo liefert die Gesamtverschuldung teils nur aggregiert. Der Wert wird nachrangig
 * verwendet, wenn der Split fehlt — sonst wäre das investierte Kapital zu niedrig.
 */
const TYP_GESAMTSCHULDEN = 'annualTotalDebt'

type TimeseriesPunkt = { asOfDate?: string; reportedValue?: { raw?: number } }
type TimeseriesBlock = { meta?: { type?: string[] }; [key: string]: unknown }

export type YahooKapitalbasisRoh = {
  waehrung: string | null
  jahre: KapitalbasisJahr[]
}

function punkteFuerTyp(result: TimeseriesBlock[], typ: string): TimeseriesPunkt[] {
  const block = result.find((b) => b.meta?.type?.[0] === typ)
  const key = block?.meta?.type?.[0]
  if (!block || !key) return []
  const arr = block[key]
  return Array.isArray(arr) ? (arr as TimeseriesPunkt[]) : []
}

function alleTypen(): string[] {
  const out = new Set<string>([TYP_GESAMTSCHULDEN])
  for (const typen of Object.values(FELD_TYPEN)) for (const t of typen) out.add(t)
  return [...out]
}

async function ladeResult(symbol: string, typen: string[]): Promise<TimeseriesBlock[]> {
  const auth = await holeYahooFinanceAuth()
  if (!auth) return []

  // Yahoo begrenzt die Zahl der Typen pro Anfrage — in Blöcken abfragen und zusammenführen.
  const bloecke: TimeseriesBlock[] = []
  const groesse = 25
  for (let i = 0; i < typen.length; i += groesse) {
    const teil = typen.slice(i, i + groesse)
    const u = new URL(
      `https://query1.finance.yahoo.com/ws/fundamentals-timeseries/v1/finance/timeseries/${encodeURIComponent(symbol)}`,
    )
    u.searchParams.set('symbol', symbol)
    u.searchParams.set('type', teil.join(','))
    u.searchParams.set('period1', String(Math.floor(Date.parse('2005-01-01') / 1000)))
    u.searchParams.set('period2', String(Math.floor(Date.now() / 1000)))
    u.searchParams.set('crumb', auth.crumb)

    const res = await fetch(u.toString(), {
      headers: { ...YAHOO_FINANCE_FETCH_HEADERS, Cookie: auth.cookie },
      cache: 'no-store',
      signal: AbortSignal.timeout(20_000),
    })
    if (!res.ok) continue
    const j = (await res.json()) as { timeseries?: { result?: TimeseriesBlock[] } }
    bloecke.push(...(j.timeseries?.result ?? []))
  }
  return bloecke
}

/**
 * Serie für ein konkretes Yahoo-Symbol. Mehrere Symbole werden bewusst **nicht** gemischt:
 * für Hermès, Sika, Straumann und Wolters Kluwer existieren neben der Heimatnotierung
 * ADR-Ticker, deren Zeitreihen teils in USD geführt werden. Ein Merge über Symbolgrenzen
 * würde Berichtswährungen vermengen.
 */
async function serieFuerSymbol(symbol: string): Promise<YahooKapitalbasisRoh | null> {
  const sym = symbol.trim().toUpperCase()
  if (!sym) return null

  const hit = cache.get(sym)
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.data

  const merke = (data: YahooKapitalbasisRoh | null) => {
    cache.set(sym, { at: Date.now(), data })
    return data
  }

  try {
    const result = await ladeResult(sym, alleTypen())
    if (result.length === 0) return merke(null)

    // Jahr → Feld → Wert. Yahoo datiert auf das Geschäftsjahresende.
    const proJahr = new Map<number, KapitalbasisJahr>()
    const hole = (jahr: number, ende: string): KapitalbasisJahr => {
      let eintrag = proJahr.get(jahr)
      if (!eintrag) {
        eintrag = leeresKapitalbasisJahr(jahr, ende)
        proJahr.set(jahr, eintrag)
      }
      return eintrag
    }

    for (const [feld, typen] of Object.entries(FELD_TYPEN) as Array<
      [KapitalbasisRohfeld, string[]]
    >) {
      for (const typ of typen) {
        for (const p of punkteFuerTyp(result, typ)) {
          const roh = p.reportedValue?.raw
          if (!p.asOfDate || roh == null || !Number.isFinite(roh)) continue
          const jahr = Number.parseInt(p.asOfDate.slice(0, 4), 10)
          if (!Number.isFinite(jahr)) continue
          const eintrag = hole(jahr, p.asOfDate)
          if (eintrag[feld] != null) continue
          eintrag[feld] = Math.round((roh / 1_000_000) * 10) / 10
          eintrag.quellen[feld] = 'yahoo'
        }
      }
    }

    // Fehlt der Schulden-Split, aus der Gesamtverschuldung ableiten.
    for (const p of punkteFuerTyp(result, TYP_GESAMTSCHULDEN)) {
      const roh = p.reportedValue?.raw
      if (!p.asOfDate || roh == null || !Number.isFinite(roh)) continue
      const jahr = Number.parseInt(p.asOfDate.slice(0, 4), 10)
      const eintrag = proJahr.get(jahr)
      if (!eintrag) continue
      if (eintrag.langfristigeSchuldenMio != null || eintrag.kurzfristigeSchuldenMio != null) continue
      eintrag.langfristigeSchuldenMio = Math.round((roh / 1_000_000) * 10) / 10
      eintrag.quellen.langfristigeSchuldenMio = 'yahoo'
    }

    const jahre = [...proJahr.values()]
      .filter((j) => j.ebitMio != null || j.eigenkapitalParentMio != null)
      .sort((a, b) => a.jahr - b.jahr)
    if (jahre.length < 2) return merke(null)

    return merke({ waehrung: null, jahre })
  } catch {
    return merke(null)
  }
}

/**
 * Probiert die Symbol-Kandidaten der Reihe nach und nimmt die Serie mit der längsten
 * Historie. Für Titel wie Halma zeigt das Depot-Symbol auf eine Regionalbörse
 * (`H11.SG`), an der Yahoo keine Fundamentaldaten führt — die Heimatnotierung liefert sie.
 */
export async function ladeYahooKapitalbasis(
  symbolKandidaten: string[],
): Promise<YahooKapitalbasisRoh | null> {
  let beste: YahooKapitalbasisRoh | null = null
  for (const symbol of symbolKandidaten.slice(0, 4)) {
    const serie = await serieFuerSymbol(symbol)
    if (!serie) continue
    if (beste == null || serie.jahre.length > beste.jahre.length) beste = serie
    if (beste.jahre.length >= 10) break
  }
  return beste
}
