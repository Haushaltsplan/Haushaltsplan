/**
 * npx tsx --conditions=react-server --require ./scripts/mock-server-only.cjs scripts/test-roic-berechnung.ts
 */
import { ergaenzeRoicAusBilanz } from '../lib/portfolio-analyse/fundamentaldaten-roic-berechnung'
import { FUNDAMENTAL_TTM_KEY } from '../lib/portfolio-analyse/fundamentaldaten-types'
import type { FundamentalMetrikZeile, FundamentalPeriode } from '../lib/portfolio-analyse/fundamentaldaten-types'

function z(
  id: string,
  gruppe: FundamentalMetrikZeile['gruppe'],
  einheit: FundamentalMetrikZeile['einheit'],
  werte: Record<string, number | null>,
): FundamentalMetrikZeile {
  return { id, label: id, gruppe, einheit, werte }
}

function main() {
  const perioden: FundamentalPeriode[] = [
    { iso: '2024-12-31', label: '2024' },
    { iso: '2025-12-31', label: '2025' },
    { iso: FUNDAMENTAL_TTM_KEY, label: 'TTM', istLtm: true },
  ]
  // ASML-ähnlich: viel Cash, moderater Goodwill — alter Nenner (EK+Debt−Cash−GW) → ~130 %.
  const zeilen: FundamentalMetrikZeile[] = [
    z('ebit', 'finanzdaten', 'waehrung_usd_mio', {
      '2024-12-31': 9000,
      '2025-12-31': 11300,
      [FUNDAMENTAL_TTM_KEY]: 11300,
    }),
    z('eigenkapital', 'bilanz', 'waehrung_usd_mio', {
      '2024-12-31': 18000,
      '2025-12-31': 19600,
      [FUNDAMENTAL_TTM_KEY]: 19600,
    }),
    z('gesamtverschuldung', 'bilanz', 'waehrung_usd_mio', {
      '2024-12-31': 4000,
      '2025-12-31': 4400,
      [FUNDAMENTAL_TTM_KEY]: 4400,
    }),
    z('bargeld', 'bilanz', 'waehrung_usd_mio', {
      '2024-12-31': 11000,
      '2025-12-31': 12900,
      [FUNDAMENTAL_TTM_KEY]: 12900,
    }),
    z('goodwill', 'bilanz', 'waehrung_usd_mio', {
      '2024-12-31': 4500,
      '2025-12-31': 4600,
      [FUNDAMENTAL_TTM_KEY]: 4600,
    }),
  ]

  ergaenzeRoicAusBilanz(perioden, zeilen)
  const roi = zeilen.find((r) => r.id === 'roi')!.werte['2025-12-31']!
  const ex = zeilen.find((r) => r.id === 'roi_ex_goodwill')!.werte['2025-12-31']!

  if (!(roi > 20 && roi < 55)) {
    throw new Error(`ROIC ${roi} sollte ~35 % (Brutto-IC) sein, nicht Cash-stripped`)
  }
  if (!(ex > 25 && ex < 70)) {
    throw new Error(`ROIC ex GW ${ex} sollte nicht >100 % sein`)
  }
  console.log(`ok ASML-ähnlich ROIC=${roi} exGW=${ex}`)
}

main()
