/**
 * Selbsttest Kapital-Profil — npx tsx scripts/test-kapital-profil.ts
 */
import {
  erkenneKapitalProfil,
  istBuchRenditeUnbrauchbar,
  netDebtEbitdaMalus,
  type KapitalProfil,
} from '../lib/portfolio-analyse/kapital-profil'

function eq(name: string, got: unknown, exp: unknown) {
  if (JSON.stringify(got) !== JSON.stringify(exp)) {
    throw new Error(`${name}: erwartet ${JSON.stringify(exp)}, bekommen ${JSON.stringify(got)}`)
  }
}

function profil(name: string, input: Parameters<typeof erkenneKapitalProfil>[0], exp: KapitalProfil) {
  const e = erkenneKapitalProfil(input)
  eq(name, e.profil, exp)
}

profil('MCD negativ EK', {
  stockholdersEquityUsd: -5_000_000_000,
  roePct: -160,
  fcfConversionPct: 105,
  fcfMargePct: 22,
  aktienSinkend: true,
  capexSalesPct: 4,
  roicPct: 90,
}, 'capital_return')

profil('HD extremes ROE + FCF', {
  stockholdersEquityUsd: 800_000_000,
  roePct: 220,
  fcfConversionPct: 95,
  fcfMargePct: 14,
  aktienSinkend: true,
  capexSalesPct: 3,
  roicPct: 45,
}, 'capital_return')

eq(
  'ROE ohne starken FCF nicht unbrauchbar',
  istBuchRenditeUnbrauchbar({ roePct: 90, fcfConversionPct: 40, fcfMargePct: 4 }),
  false,
)

profil('UNP asset heavy', {
  capexSalesPct: 16,
  roicPct: 14,
  assetTurnover: 0.35,
  industrie: 'Railroads',
  fcfConversionPct: 72,
}, 'asset_heavy')

profil('NOW via NRR', {
  nrrPct: 118,
  bruttoMargePct: 78,
  capexSalesPct: 3,
  roicPct: 8,
}, 'software')

profil('DDOG via SaaS-Proxy', {
  bruttoMargePct: 80,
  revGrowthPct: 24,
  istWachstumsfirma: true,
  sbcVsFcfPct: 22,
  capexSalesPct: 2,
  roicPct: -5,
}, 'software')

profil('KNSL Versicherung', {
  industrie: 'Insurance - Property & Casualty',
  roePct: 28,
  capexSalesPct: 1,
  roicPct: 18,
}, 'float_finance')

profil('MA Plattform', {
  capexSalesPct: 2,
  roicPct: 48,
  nrrPct: null,
  istWachstumsfirma: false,
  fcfConversionPct: 100,
  stockholdersEquityUsd: 7_000_000_000,
  roePct: 55,
}, 'platform')

profil('GOOGL hohes CapEx + hoher ROIC = default', {
  capexSalesPct: 15,
  roicPct: 28,
  assetTurnover: 0.7,
  nrrPct: null,
  stockholdersEquityUsd: 250_000_000_000,
  fcfConversionPct: 85,
}, 'quality_default')

profil('SPGI kapitalleicht bleibt Plattform', {
  capexSalesPct: 1.5,
  roicPct: 32,
  incrementalRoicRegime: 'kapitalleicht',
  stockholdersEquityUsd: 12_000_000_000,
  roePct: 18,
  fcfConversionPct: 90,
  istWachstumsfirma: false,
}, 'platform')

eq('MCD 3.0× bei Coverage 8 = kein Malus', netDebtEbitdaMalus(3.0, 'capital_return', 8), 0)
eq('Default 3.0× = −2', netDebtEbitdaMalus(3.0, 'quality_default', 10), -2)
eq('Float 4.0× = 0', netDebtEbitdaMalus(4.0, 'float_finance', 3), 0)
eq('Asset-heavy 3.2× = 0', netDebtEbitdaMalus(3.2, 'asset_heavy', 7), 0)
eq('Capital-return Coverage <4 = −3', netDebtEbitdaMalus(3.0, 'capital_return', 3), -3)

import { baueKontextWerte } from '../lib/portfolio-analyse/fundamentaldaten-kontext-werte'
import { baueMantraAudit } from '../lib/portfolio-analyse/fundamentaldaten-mantra'
import type { FundamentalMetrikZeile } from '../lib/portfolio-analyse/fundamentaldaten-types'

function z(
  id: string,
  gruppe: FundamentalMetrikZeile['gruppe'],
  einheit: FundamentalMetrikZeile['einheit'],
  wert: number,
): FundamentalMetrikZeile {
  return { id, label: id, gruppe, einheit, werte: { '2024-12-31': wert } }
}

const mcdKontext = baueKontextWerte({
  yahoo: { returnOnEquity: -1.6, industry: 'Restaurants' },
  roh: {
    perioden: [{ iso: '2024-12-31', label: '2024' }],
    zeilen: [
      z('eigenkapital', 'bilanz', 'waehrung_usd_mio', -4800),
      z('fcf', 'cashflow', 'waehrung_usd_mio', 8400),
      z('nettogewinn', 'finanzdaten', 'waehrung_usd_mio', 8200),
      z('umsatz', 'finanzdaten', 'waehrung_usd_mio', 26000),
      z('capex', 'cashflow', 'waehrung_usd_mio', -900),
      z('roe', 'rentabilitaet', 'prozent', -155),
      z('aktien', 'finanzdaten', 'aktien_mio', 720),
    ],
  },
  schaetzungen: { perioden: [], zeilen: [] },
  yahooFinanz: {
    stockBasedCompensationUsd: null,
    interestExpenseUsd: 1_200_000_000,
    researchDevelopmentUsd: null,
    sgaUsd: null,
    freeCashFlowUsd: 8_400_000_000,
    operatingIncomeUsd: 11_000_000_000,
    revenueUsd: 26_000_000_000,
    netIncomeUsd: 8_200_000_000,
    pretaxIncomeUsd: 10_000_000_000,
    taxProvisionUsd: 1_800_000_000,
    operatingCashFlowUsd: 9_400_000_000,
    annualHistorie: [
      {
        datum: '2024-12-31',
        operatingIncomeUsd: 11_000_000_000,
        pretaxIncomeUsd: 10_000_000_000,
        taxProvisionUsd: 1_800_000_000,
        totalDebtUsd: 50_000_000_000,
        stockholdersEquityUsd: -4_800_000_000,
        netIncomeUsd: 8_200_000_000,
        capitalExpenditureUsd: -900_000_000,
        changeInWorkingCapitalUsd: 0,
        purchaseOfBusinessUsd: 0,
        operatingCashFlowUsd: 9_400_000_000,
        goodwillUsd: 3_000_000_000,
        depreciationAmortizationUsd: 2_000_000_000,
        cashAndEquivalentsUsd: 2_000_000_000,
      },
    ],
  },
  sektor: 'Konsumgüter',
  branche: 'Restaurants',
})

eq('MCD-Kontext Profil', mcdKontext.kapitalProfil, 'capital_return')

const mantra = baueMantraAudit(
  'Konsumgüter',
  'Restaurants',
  { returnOnEquity: -1.6, industry: 'Restaurants' },
  null,
  { perioden: [], zeilen: [] },
  null,
  mcdKontext,
)
const roicZeile = mantra.standard.find((s) => s.kennzahl === 'ROIC')
if (!roicZeile) throw new Error('ROIC-Zeile fehlt')
if (roicZeile.status === 'nicht_erfuellt') {
  throw new Error(`MCD-ROIC darf nicht Fail sein: ${roicZeile.hinweis} / ${roicZeile.istWert}`)
}
eq('MCD Mantra Profil', mantra.kapitalProfil, 'capital_return')
if ((mantra.zusammenfassung.nichtAnwendbar ?? 0) < 1) {
  throw new Error('MCD sollte mindestens eine nicht-anwendbare Kennzahl haben (LTV)')
}

console.log('kapital-profil: alle Fälle ok')
