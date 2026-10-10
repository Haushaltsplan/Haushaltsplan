/**
 * Self-check: gStart aus Forecast, nicht Hist-CAGR.
 *
 *   npx tsx lib/portfolio-analyse/dcf/dcf-inputs-aus-paket.test.ts
 */
import { dcfInputsAusPaket } from '@/lib/portfolio-analyse/dcf/dcf-inputs-aus-paket'
import { fuelleFehlendeFcfAusUmsatzWachstum } from '@/lib/portfolio-analyse/stockanalysis-forecast-fcf-fill'
import type { FundamentaldatenPaket } from '@/lib/portfolio-analyse/fundamentaldaten-types'
import { FUNDAMENTAL_FY0E_KEY, FUNDAMENTAL_FY1E_KEY, FUNDAMENTAL_TTM_KEY } from '@/lib/portfolio-analyse/fundamentaldaten-types'

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg)
}

function mockPaket(opts: {
  ttmFcfMio: number
  fy0FcfMio: number | null
  fy1FcfMio: number | null
  fy0UmsatzWachstum: number | null
  fy1UmsatzWachstum: number | null
  fy0EpsWachstum?: number | null
  fy1EpsWachstum?: number | null
  histFcfMio: number[]
}): FundamentaldatenPaket {
  const perioden = opts.histFcfMio.map((_, i) => ({
    iso: `${2019 + i}-12-31`,
    label: String(2019 + i),
  }))
  const histWerte: Record<string, number | null> = {}
  opts.histFcfMio.forEach((v, i) => {
    histWerte[perioden[i]!.iso] = v
  })
  histWerte[FUNDAMENTAL_TTM_KEY] = opts.ttmFcfMio

  return {
    ok: true,
    ticker: 'MA',
    slug: 'ma',
    firmenname: 'Mastercard',
    branche: null,
    sektor: null,
    website: null,
    beschreibung: null,
    waehrung: 'USD',
    perioden,
    zeilen: [
      {
        id: 'fcf',
        label: 'FCF',
        gruppe: 'cashflow',
        einheit: 'waehrung_usd_mio',
        werte: histWerte,
      },
      {
        id: 'fcf_schaetzung',
        label: 'FCF Schätzung',
        gruppe: 'schaetzungen',
        einheit: 'waehrung_usd_mio',
        werte: {
          [FUNDAMENTAL_FY0E_KEY]: opts.fy0FcfMio,
          [FUNDAMENTAL_FY1E_KEY]: opts.fy1FcfMio,
        },
        istSchaetzung: true,
      },
      {
        id: 'umsatz_wachstum_schaetzung',
        label: 'Umsatzwachstum',
        gruppe: 'schaetzungen',
        einheit: 'prozent',
        werte: {
          [FUNDAMENTAL_FY0E_KEY]: opts.fy0UmsatzWachstum,
          [FUNDAMENTAL_FY1E_KEY]: opts.fy1UmsatzWachstum,
        },
        istSchaetzung: true,
      },
      {
        id: 'eps_wachstum_schaetzung',
        label: 'EPS-Wachstum',
        gruppe: 'schaetzungen',
        einheit: 'prozent',
        werte: {
          [FUNDAMENTAL_FY0E_KEY]: opts.fy0EpsWachstum ?? null,
          [FUNDAMENTAL_FY1E_KEY]: opts.fy1EpsWachstum ?? null,
        },
        istSchaetzung: true,
      },
      {
        id: 'aktien',
        label: 'Aktien',
        gruppe: 'bilanz',
        einheit: 'aktien_mio',
        werte: { [perioden[perioden.length - 1]!.iso]: 900 },
      },
    ],
    keyMetrics: [
      { id: 'kurs_aktuell', label: 'Kurs', wert: '500,00 $', gruppe: 'marktdaten' },
      { id: 'beta', label: 'Beta', wert: '1,00', gruppe: 'marktdaten' },
    ],
    mantra: {
      sektorMantraId: null,
      sektorMantraTitel: null,
      sektorMantraIntro: null,
      standard: [],
      sektor: [],
      zusammenfassung: {
        erfuellt: 0,
        nichtErfuellt: 0,
        keineDaten: 0,
        qualitativ: 0,
        bewertbar: 0,
        nichtAnwendbar: 0,
      },
      anker: '',
      frameworkTitel: '',
      frameworkUntertitel: '',
      moatCheck: [],
      moatPlattformZusatz: '',
      sellTriggers: [],
      ampel: 'gelb',
      ampelHinweis: '',
    } as unknown as FundamentaldatenPaket['mantra'],
    mantraMeta: {
      beta: 1,
      marketCapUsd: 400_000_000_000,
      totalDebtUsd: 10_000_000_000,
      totalCashUsd: 5_000_000_000,
      yahooFinanz: null,
    },
    news: [],
    symbolYahoo: 'MA',
    geladenAm: new Date().toISOString(),
    quelle: 'sec',
  }
}

function main() {
  // SA-Fill: PRO-Jahr mit Umsatzwachstum
  const roh = [
    {
      jahr: 2025,
      periodenEnde: '2025-12-31',
      umsatzUsd: 32e9,
      operatingIncomeUsd: null,
      ebitdaUsd: null,
      netIncomeUsd: null,
      freeCashFlowUsd: 16.433e9,
      grossProfitUsd: null,
      eps: 17,
      gaapEps: 17,
      adjustedEps: 17,
      grossMarginPct: null,
      revenueGrowthPct: 16.4,
      epsGrowthPct: 18.9,
      istSchätzung: false,
    },
    {
      jahr: 2026,
      periodenEnde: '2026-12-31',
      umsatzUsd: 37e9,
      operatingIncomeUsd: null,
      ebitdaUsd: null,
      netIncomeUsd: null,
      freeCashFlowUsd: 16.983e9,
      grossProfitUsd: null,
      eps: 19.9,
      gaapEps: 19.9,
      adjustedEps: 19.9,
      grossMarginPct: null,
      revenueGrowthPct: 13.63,
      epsGrowthPct: 18.35,
      istSchätzung: true,
    },
    {
      jahr: 2027,
      periodenEnde: '2027-12-31',
      umsatzUsd: 42e9,
      operatingIncomeUsd: null,
      ebitdaUsd: null,
      netIncomeUsd: null,
      freeCashFlowUsd: null,
      grossProfitUsd: null,
      eps: 23,
      gaapEps: 23,
      adjustedEps: 23,
      grossMarginPct: null,
      revenueGrowthPct: 12.61,
      epsGrowthPct: 15.53,
      istSchätzung: true,
    },
  ]
  const filled = fuelleFehlendeFcfAusUmsatzWachstum(roh)
  const fcf27 = filled.find((e) => e.jahr === 2027)?.freeCashFlowUsd
  assert(fcf27 != null && fcf27 > 16.983e9, `FCF 2027 sollte gefüllt sein, got ${fcf27}`)
  const expect = 16.983e9 * (1 + 0.1261)
  assert(Math.abs(fcf27! - expect) / expect < 0.01, `FCF 2027 ≈ ${expect}, got ${fcf27}`)

  // MA: FCF FY0+FY1 nach Fill → Forecast-CAGR ~12.6%
  const ma = mockPaket({
    ttmFcfMio: 16_433,
    fy0FcfMio: 16_983,
    fy1FcfMio: 16_983 * 1.1261,
    fy0UmsatzWachstum: 13.63,
    fy1UmsatzWachstum: 12.61,
    histFcfMio: [7_000, 8_000, 9_000, 10_500, 12_000],
  })
  const inp = dcfInputsAusPaket(ma)
  assert(inp.gStartQuelle === 'fcf_forecast', `erwartete fcf_forecast, got ${inp.gStartQuelle}`)
  assert(inp.gStartPct > 10 && inp.gStartPct < 15, `MA gStart ~12.6, got ${inp.gStartPct}`)

  // Nur Umsatz-Consensus (kein brauchbares FCF-Paar)
  const nurUmsatz = mockPaket({
    ttmFcfMio: 12_000,
    fy0FcfMio: 12_200,
    fy1FcfMio: null,
    fy0UmsatzWachstum: 13.6,
    fy1UmsatzWachstum: 12.6,
    histFcfMio: [7_000, 8_000, 9_000, 10_500, 12_000],
  })
  const inp2 = dcfInputsAusPaket(nurUmsatz)
  assert(inp2.gStartQuelle === 'umsatz_consensus', `erwartete umsatz_consensus, got ${inp2.gStartQuelle}`)
  assert(Math.abs(inp2.gStartPct - 13.1) < 0.5, `Umsatz-Mittel ~13.1, got ${inp2.gStartPct}`)

  // Hist-CAGR darf NICHT gewinnen, wenn Consensus da ist
  assert(inp2.gStartQuelle !== 'cagr5' as string, 'kein Hist-CAGR mehr')

  console.log('OK dcf-inputs-forecast', {
    fillFcf27: Math.round(fcf27! / 1e6),
    maG: inp.gStartPct,
    umsatzG: inp2.gStartPct,
  })
}

main()
