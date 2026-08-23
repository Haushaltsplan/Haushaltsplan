/**
 * SEC XBRL Company Facts → Kapitalbasis-Jahresreihe.
 *
 * Gegenüber `sec-edgar-companyfacts-server.ts` behebt dieses Modul drei Fehlerklassen,
 * die reproduzierbar zu falschen oder fehlenden Kennzahlen geführt haben:
 *
 *  1. **Fiskaljahr-Zuordnung.** Das Feld `fy` in den Company Facts ist das Jahr des
 *     *Filings*, nicht der Berichtsperiode: im 10-K für 2025 tragen auch die
 *     Vorjahresvergleichswerte `fy: 2025`. Wer darauf gruppiert, verliert Jahre
 *     (SPGI: 2024 fehlte komplett). Das Kalenderjahr des Periodenendes ist ebenfalls
 *     unzuverlässig, weil Juni-/Januar-Bilanzierer unterschiedlich labeln (Microsoft
 *     nennt das per 30.06.2026 endende Jahr FY2026, Händler mit Januar-Ende FY des
 *     Vorjahres). Deshalb: Label = kleinstes `fy` über alle Einträge mit demselben
 *     Periodenende — das ist per Konstruktion das Filing, in dem die Periode die
 *     laufende war, also die Konvention des Unternehmens selbst.
 *  2. **Formulare.** Der Filter auf `10-K` verwarf 20-F-Filer komplett, obwohl ASML
 *     dort vollständige us-gaap-Daten in EUR liefert.
 *  3. **Tag-Ketten brachen ab.** Sobald ein Tag genug Jahre hatte, wurden die
 *     restlichen Tags nicht mehr gelesen. Felder, die das Unternehmen über die Jahre
 *     umbenannt hat, rissen dadurch Löcher (MSFT: D&A null über alle Jahre).
 */

import 'server-only'

import { leseAlsJson } from '@/lib/http/safe-json-response'
import { padCik, secFetch } from '@/lib/portfolio-analyse/sec-edgar-common-server'
import {
  leeresKapitalbasisJahr,
  type KapitalbasisJahr,
  type KapitalbasisRohfeld,
} from '@/lib/portfolio-analyse/kapitalbasis/kapitalbasis-typen'

const CACHE_MS = 24 * 60 * 60 * 1000
const cache = new Map<number, { at: number; data: SecKapitalbasisRoh | null }>()

const JAHRESFORMULARE = new Set(['10-K', '10-K/A', '20-F', '20-F/A', '40-F', '40-F/A'])

type FactsUnit = {
  start?: string
  end?: string
  val?: number
  fy?: number
  fp?: string
  form?: string
  filed?: string
}

type CompanyFactsJson = {
  facts?: Record<string, Record<string, { units?: Record<string, FactsUnit[]> }>>
}

export type SecKapitalbasisRoh = {
  waehrung: string
  jahre: KapitalbasisJahr[]
}

/** Stromgrößen brauchen eine Periode von ~1 Jahr, Bestandsgrößen sind Zeitpunkte. */
const STROMFELDER = new Set<KapitalbasisRohfeld>([
  'umsatzMio',
  'ebitMio',
  'pretaxMio',
  'steuerMio',
  'nettogewinnMio',
  'zinsaufwandMio',
  'ocfMio',
  'capexMio',
  'softwareCapexMio',
  'daMio',
  'akquisitionenMio',
  'aktienrueckkaufMio',
  'dividendenMio',
])

/**
 * Tag-Ketten in Prioritätsreihenfolge. Bewusst lang: Unternehmen wechseln Tags über
 * die Jahre, und jedes fehlende Jahr ist später eine Lücke in ΔNOPAT/ΔIC.
 * `ifrs-full`-Tags stehen mit drin, weil 20-F-Filer teils IFRS-Taxonomie nutzen.
 */
const TAG_KETTEN: Record<KapitalbasisRohfeld, string[]> = {
  umsatzMio: [
    'RevenueFromContractWithCustomerExcludingAssessedTax',
    'RevenueFromContractWithCustomerIncludingAssessedTax',
    'Revenues',
    'SalesRevenueNet',
    'SalesRevenueServicesNet',
    'Revenue',
  ],
  ebitMio: ['OperatingIncomeLoss', 'ProfitLossFromOperatingActivities'],
  // Kein `...BeforeIncomeTaxesDomestic`: das ist die US-Teilmenge aus der Steuerfußnote,
  // nicht das Konzernergebnis. Bei McDonald's lieferte der Tag 3.291 Mio. gegen einen
  // Nettogewinn von 8.563 Mio. — der daraus errechnete Steuersatz von 71 % fiel aus dem
  // Plausibilitätsband und ließ NOPAT auf einen Ersatzsatz zurückfallen.
  pretaxMio: [
    'IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest',
    'IncomeLossFromContinuingOperationsBeforeIncomeTaxesMinorityInterestAndIncomeLossFromEquityMethodInvestments',
    'IncomeLossFromContinuingOperationsBeforeIncomeTaxesNoncontrollingInterest',
    'ProfitLossBeforeTax',
  ],
  steuerMio: [
    'IncomeTaxExpenseBenefit',
    'IncomeTaxExpenseBenefitContinuingOperations',
    'IncomeTaxExpenseContinuingOperations',
  ],
  nettogewinnMio: ['NetIncomeLoss', 'ProfitLoss', 'NetIncomeLossAvailableToCommonStockholdersBasic'],
  zinsaufwandMio: [
    'InterestExpense',
    'InterestExpenseDebt',
    'InterestExpenseNonoperating',
    'InterestAndDebtExpense',
    'InterestIncomeExpenseNet',
    'FinanceCosts',
  ],

  eigenkapitalParentMio: ['StockholdersEquity', 'EquityAttributableToOwnersOfParent'],
  eigenkapitalInklMinderheitenMio: [
    'StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest',
    'Equity',
  ],
  minderheitenMio: ['MinorityInterest', 'NoncontrollingInterests'],
  rueckkaufbareMinderheitenMio: [
    'RedeemableNoncontrollingInterestEquityCarryingAmount',
    'RedeemableNoncontrollingInterestEquityFairValue',
    'TemporaryEquityCarryingAmountAttributableToParent',
  ],
  langfristigeSchuldenMio: [
    'LongTermDebtNoncurrent',
    'LongTermDebtAndCapitalLeaseObligations',
    'LongTermDebt',
    'LongTermBorrowings',
  ],
  kurzfristigeSchuldenMio: [
    'LongTermDebtCurrent',
    'LongTermDebtAndCapitalLeaseObligationsCurrent',
    'DebtCurrent',
    'ShortTermBorrowings',
    'CommercialPaper',
    'OtherShortTermBorrowings',
    'ShorttermBorrowings',
  ],
  leasingverbindlichkeitenMio: [
    'OperatingLeaseLiabilityNoncurrent',
    'OperatingLeaseLiability',
    'FinanceLeaseLiabilityNoncurrent',
  ],

  bargeldMio: [
    'CashAndCashEquivalentsAtCarryingValue',
    'CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents',
    'CashAndCashEquivalents',
  ],
  kurzfristigeAnlagenMio: [
    'ShortTermInvestments',
    'AvailableForSaleSecuritiesDebtSecuritiesCurrent',
    'MarketableSecuritiesCurrent',
    'OtherShortTermInvestments',
  ],
  goodwillMio: ['Goodwill'],
  intangiblesMio: [
    'IntangibleAssetsNetExcludingGoodwill',
    'FiniteLivedIntangibleAssetsNet',
    'IndefiniteLivedIntangibleAssetsExcludingGoodwill',
  ],
  gesamtvermoegenMio: ['Assets'],
  umlaufvermoegenMio: ['AssetsCurrent'],
  kurzfristigeVerbindlichkeitenMio: ['LiabilitiesCurrent'],

  ocfMio: [
    'NetCashProvidedByUsedInOperatingActivities',
    'NetCashProvidedByUsedInOperatingActivitiesContinuingOperations',
  ],
  capexMio: [
    'PaymentsToAcquirePropertyPlantAndEquipment',
    'PaymentsToAcquireProductiveAssets',
    'PaymentsForCapitalImprovements',
    'PaymentsToAcquireOtherPropertyPlantAndEquipment',
    'PurchaseOfPropertyPlantAndEquipment',
  ],
  // `PaymentsForSoftware` nutzen MSCI und Veeva; ohne das Tag fehlte deren kapitalisierte
  // Software (MSCI 2025: 91 Mio.) im Nenner der Brutto-Reinvestition und der ROIIC lief
  // dadurch zu hoch in den Deckel.
  softwareCapexMio: [
    'PaymentsToDevelopSoftware',
    'PaymentsForSoftware',
    'PaymentsToAcquireIntangibleAssets',
    'PaymentsToAcquireSoftware',
  ],
  daMio: [
    'DepreciationDepletionAndAmortization',
    'DepreciationAmortizationAndAccretionNet',
    'DepreciationAndAmortization',
    'DepreciationDepletionAndAmortizationExcludingAmortizationOfDeferredSalesCommissions',
    'Depreciation',
  ],
  akquisitionenMio: [
    'PaymentsToAcquireBusinessesNetOfCashAcquired',
    'PaymentsToAcquireBusinessesAndInterestInAffiliates',
    'PaymentsToAcquireBusinessesGross',
    'PaymentsToAcquireBusinessTwoNetOfCashAcquired',
  ],
  aktienrueckkaufMio: [
    'PaymentsForRepurchaseOfCommonStock',
    'PaymentsForRepurchaseOfEquity',
    'TreasuryStockValueAcquiredCostMethod',
  ],
  dividendenMio: [
    'PaymentsOfDividends',
    'PaymentsOfDividendsCommonStock',
    'PaymentsOfOrdinaryDividends',
    'DividendsPaid',
  ],
}

/** Feld darf negativ sein (Ergebnisgrößen, Eigenkapital bei MCD/HD, Cashflow-Posten). */
const NEGATIV_ERLAUBT = new Set<KapitalbasisRohfeld>([
  'ebitMio',
  'pretaxMio',
  'steuerMio',
  'nettogewinnMio',
  'eigenkapitalParentMio',
  'eigenkapitalInklMinderheitenMio',
  'minderheitenMio',
  'ocfMio',
  'capexMio',
  'daMio',
  'akquisitionenMio',
  'aktienrueckkaufMio',
  'dividendenMio',
  'zinsaufwandMio',
])

/**
 * Jahres-Label je Periodenende = Kalenderjahr des Periodenendes.
 *
 * Das Feld `fy` der Company Facts ist dafür unbrauchbar: bei S&P Global trägt das per
 * 31.12.2024 endende Geschäftsjahr `fy: 2025`, wodurch ein Jahr verrutscht und die
 * ROIIC-Fenster reißen. Auch die Jahresbezeichnung der Unternehmen selbst ist nicht
 * ableitbar — Microsoft nennt das per 30.06.2026 endende Jahr FY2026, ein Händler mit
 * Januar-Ende nennt es FY des Vorjahres, Veeva umgekehrt.
 *
 * Für ΔNOPAT/ΔIC zählt nur, dass die Reihe lückenlos und gleichmäßig ist — nicht das
 * Marketing-Label. Das Kalenderjahr des Abschlussdatums erfüllt das immer; einzige
 * Abweichung ist eine kosmetische Verschiebung im Anzeigelabel bei Titeln mit
 * Geschäftsjahresende im Januar/Februar.
 */
function baueJahresLabels(facts: CompanyFactsJson): Map<string, number> {
  // Nur Geldbeträge zählen. Die `dei`-Fakten tragen Deckblatt-Stichtage (Microsoft:
  // 2026-07-23) ebenfalls als `fp: 'FY'`; würden die mitgezählt, gälte bei
  // Juni-Bilanzierern der Deckblatt-Termin als Geschäftsjahresende und jede Kennzahl
  // liefe ins Leere.
  const enden: string[] = []
  for (const [namensraum, tags] of Object.entries(facts.facts ?? {})) {
    if (namensraum === 'dei') continue
    for (const tag of Object.values(tags)) {
      for (const [einheit, liste] of Object.entries(tag.units ?? {})) {
        if (!/^[A-Z]{3}$/.test(einheit)) continue
        for (const e of liste ?? []) {
          if (e.fp !== 'FY' || !e.end) continue
          if (!e.form || !JAHRESFORMULARE.has(e.form)) continue
          enden.push(e.end)
        }
      }
    }
  }
  if (enden.length === 0) return new Map()

  // Bilanzstichtag = häufigster Monat. 52/53-Wochen-Geschäftsjahre (Cintas, ODFL)
  // verschieben den Tag jährlich, daher Toleranz statt exaktem Datum.
  const monatsZaehler = new Map<number, number>()
  for (const ende of enden) {
    const monat = Number.parseInt(ende.slice(5, 7), 10)
    if (!Number.isFinite(monat)) continue
    monatsZaehler.set(monat, (monatsZaehler.get(monat) ?? 0) + 1)
  }
  let stichtagMonat = 12
  let max = 0
  for (const [monat, n] of monatsZaehler) {
    if (n > max) {
      max = n
      stichtagMonat = monat
    }
  }

  const passendZumStichtag = (ende: string): boolean => {
    const monat = Number.parseInt(ende.slice(5, 7), 10)
    const tag = Number.parseInt(ende.slice(8, 10), 10)
    if (!Number.isFinite(monat) || !Number.isFinite(tag)) return false
    // Ein 52/53-Wochen-Jahr kann in den Nachbarmonat rutschen (z. B. 31.05. → 03.06.).
    if (monat === stichtagMonat) return true
    if (monat === (stichtagMonat % 12) + 1 && tag <= 7) return true
    if (monat === ((stichtagMonat + 10) % 12) + 1 && tag >= 24) return true
    return false
  }

  const kandidaten = [...new Set(enden)].filter(passendZumStichtag)
  const besteEnde = new Map<number, string>()
  for (const ende of kandidaten) {
    const jahr = Number.parseInt(ende.slice(0, 4), 10)
    if (!Number.isFinite(jahr)) continue
    const alt = besteEnde.get(jahr)
    if (alt == null || ende > alt) besteEnde.set(jahr, ende)
  }

  const labels = new Map<string, number>()
  for (const [jahr, ende] of besteEnde) labels.set(ende, jahr)
  return labels
}

/** Häufigste Geldeinheit über alle Fakten — 20-F-Filer berichten z. B. in EUR. */
function ermittleWaehrung(facts: CompanyFactsJson): string {
  const zaehler = new Map<string, number>()
  for (const namespace of Object.values(facts.facts ?? {})) {
    for (const tag of Object.values(namespace)) {
      for (const [unit, liste] of Object.entries(tag.units ?? {})) {
        if (!/^[A-Z]{3}$/.test(unit)) continue
        zaehler.set(unit, (zaehler.get(unit) ?? 0) + (liste?.length ?? 0))
      }
    }
  }
  let beste = 'USD'
  let max = 0
  for (const [unit, n] of zaehler) {
    if (n > max) {
      max = n
      beste = unit
    }
  }
  return beste
}

type Treffer = { wert: number; filed: string; periodenEnde: string }

/**
 * Eine Jahresreihe für ein Feld. Tags werden in Prioritätsreihenfolge abgearbeitet und
 * füllen jeweils nur die noch offenen Jahre — kein vorzeitiger Abbruch.
 */
function jahresreihe(
  facts: CompanyFactsJson,
  labels: Map<string, number>,
  waehrung: string,
  feld: KapitalbasisRohfeld,
): Map<number, Treffer> {
  const out = new Map<number, Treffer>()
  const strom = STROMFELDER.has(feld)
  const negOk = NEGATIV_ERLAUBT.has(feld)

  for (const tag of TAG_KETTEN[feld]) {
    const perTag = new Map<number, Treffer>()
    for (const namespace of Object.values(facts.facts ?? {})) {
      const liste = namespace[tag]?.units?.[waehrung]
      if (!liste) continue
      for (const e of liste) {
        if (!e.end || e.val == null || !Number.isFinite(e.val)) continue
        if (!e.form || !JAHRESFORMULARE.has(e.form)) continue

        if (strom) {
          if (!e.start) continue
          const tage = (Date.parse(e.end) - Date.parse(e.start)) / 86_400_000
          if (tage < 330 || tage > 400) continue
        } else if (e.start) {
          continue
        }

        const jahr = labels.get(e.end)
        if (jahr == null) continue
        if (!negOk && e.val < 0) continue

        const filed = e.filed ?? e.end
        const alt = perTag.get(jahr)
        if (!alt || filed > alt.filed) {
          perTag.set(jahr, { wert: e.val / 1_000_000, filed, periodenEnde: e.end })
        }
      }
    }
    for (const [jahr, treffer] of perTag) {
      if (!out.has(jahr)) out.set(jahr, treffer)
    }
  }
  return out
}

export async function ladeSecKapitalbasis(cik: number): Promise<SecKapitalbasisRoh | null> {
  const hit = cache.get(cik)
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.data

  const merke = (data: SecKapitalbasisRoh | null) => {
    cache.set(cik, { at: Date.now(), data })
    return data
  }

  try {
    const res = await secFetch(`https://data.sec.gov/api/xbrl/companyfacts/CIK${padCik(cik)}.json`)
    if (!res.ok) return merke(null)
    const facts = (await leseAlsJson<CompanyFactsJson>(res)) ?? {}
    if (!facts.facts) return merke(null)

    const waehrung = ermittleWaehrung(facts)
    const labels = baueJahresLabels(facts)
    if (labels.size === 0) return merke(null)

    const reihen = new Map<KapitalbasisRohfeld, Map<number, Treffer>>()
    for (const feld of Object.keys(TAG_KETTEN) as KapitalbasisRohfeld[]) {
      reihen.set(feld, jahresreihe(facts, labels, waehrung, feld))
    }

    const alleJahre = new Set<number>()
    for (const reihe of reihen.values()) for (const j of reihe.keys()) alleJahre.add(j)
    const jahreSortiert = [...alleJahre].sort((a, b) => a - b).slice(-20)
    if (jahreSortiert.length < 2) return merke(null)

    const jahre: KapitalbasisJahr[] = jahreSortiert.map((jahr) => {
      const eintrag = leeresKapitalbasisJahr(jahr)
      for (const [feld, reihe] of reihen) {
        const treffer = reihe.get(jahr)
        if (!treffer) continue
        eintrag[feld] = Math.round(treffer.wert * 10) / 10
        eintrag.quellen[feld] = 'sec_xbrl'
        eintrag.periodenEnde ??= treffer.periodenEnde
      }
      return eintrag
    })

    return merke({ waehrung, jahre })
  } catch {
    return merke(null)
  }
}
