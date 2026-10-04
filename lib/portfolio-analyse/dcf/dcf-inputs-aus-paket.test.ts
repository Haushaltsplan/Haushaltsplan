/**
 * Self-check: gStart-Default darf nicht FY0≈TTM als High-Growth nehmen.
 *
 *   npx tsx lib/portfolio-analyse/dcf/dcf-inputs-aus-paket.test.ts
 */
import { dcfInputsAusPaket } from '@/lib/portfolio-analyse/dcf/dcf-inputs-aus-paket'
import type { FundamentaldatenPaket } from '@/lib/portfolio-analyse/fundamentaldaten-types'
import { FUNDAMENTAL_FY0E_KEY, FUNDAMENTAL_FY1E_KEY, FUNDAMENTAL_TTM_KEY } from '@/lib/portfolio-analyse/fundamentaldaten-types'

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg)
}

function mockPaket(opts: {
  ttmFcfMio: number
  fy0Mio: number
  fy1Mio: number
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
          [FUNDAMENTAL_FY0E_KEY]: opts.fy0Mio,
          [FUNDAMENTAL_FY1E_KEY]: opts.fy1Mio,
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
      score: 0,
      maxScore: 0,
      ampel: 'gelb',
      ampelHinweis: '',
      ergebnisse: [],
    } as FundamentaldatenPaket['mantra'],
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
  // MA-Fall: FY0 ≈ TTM, FY1 deutlich höher → früher Bug ~1,7 %, jetzt FY1/FY0
  const ma = mockPaket({
    ttmFcfMio: 12_000,
    fy0Mio: 12_200,
    fy1Mio: 13_800,
    histFcfMio: [7_000, 8_000, 9_000, 10_500, 12_000],
  })
  const inp = dcfInputsAusPaket(ma)
  assert(inp.gStartQuelle === 'schaetzung', `erwartete schaetzung, got ${inp.gStartQuelle}`)
  assert(Math.abs(inp.gStartPct - 13.1) < 0.2, `FY1/FY0 ≈ 13,1 %, got ${inp.gStartPct}`)
  assert(inp.gStartPct > 5, 'darf kein Restjahr-Scheinwachstum sein')

  // Nur FY0≈TTM, kein brauchbares FY1-Wachstum → CAGR 5J
  const ohneFwd = mockPaket({
    ttmFcfMio: 12_000,
    fy0Mio: 12_200,
    fy1Mio: 12_400, // ~1,6 % — zu schwach
    histFcfMio: [7_000, 8_000, 9_000, 10_500, 12_000],
  })
  const inp2 = dcfInputsAusPaket(ohneFwd)
  assert(inp2.gStartQuelle === 'cagr5', `erwartete cagr5, got ${inp2.gStartQuelle}`)
  assert(inp2.gStartPct > 8, `CAGR sollte Compounder-Niveau sein, got ${inp2.gStartPct}`)

  console.log('OK dcf-inputs', { ma: inp.gStartPct, cagrFallback: inp2.gStartPct })
}

main()
