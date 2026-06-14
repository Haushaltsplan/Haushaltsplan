import 'server-only'

import type { EtfBreakdown } from '@/lib/portfolio-analyse/parqet-core/types'
import { ladeAmundiEtfBreakdown } from '@/lib/portfolio-analyse/etf-scraper/amundi-breakdown-server'
import { etfBenchmarkFuerIsin } from '@/lib/portfolio-analyse/etf-scraper/etf-benchmark-mapping'
import { ladeNasdaq100Breakdown } from '@/lib/portfolio-analyse/etf-scraper/nasdaq100-holdings-server'
import {
  ladeSp500CapBreakdown,
  ladeSp500EqualBreakdown,
} from '@/lib/portfolio-analyse/etf-scraper/ssga-holdings-server'

function mergeSektorLaender(
  basis: EtfBreakdown,
  zusaetzlich: EtfBreakdown | null,
): EtfBreakdown {
  if (!zusaetzlich) return basis
  return {
    topHoldings: basis.topHoldings,
    sectors: zusaetzlich.sectors.length ? zusaetzlich.sectors : basis.sectors,
    countries: zusaetzlich.countries.length ? zusaetzlich.countries : basis.countries,
  }
}

/** Vollständige Index-Look-through-Daten für bekannte Benchmark-ETFs. */
export async function ladeIndexEtfBreakdown(isin: string): Promise<EtfBreakdown | null> {
  const benchmark = etfBenchmarkFuerIsin(isin)
  if (!benchmark) return null

  let basis: EtfBreakdown | null = null
  switch (benchmark) {
    case 'SP500_CAP':
      basis = await ladeSp500CapBreakdown()
      break
    case 'SP500_EQUAL':
      basis = await ladeSp500EqualBreakdown()
      break
    case 'NASDAQ100':
      basis = await ladeNasdaq100Breakdown()
      break
  }

  if (!basis || basis.topHoldings.length < 50) return null

  const amundi = await ladeAmundiEtfBreakdown(isin)
  return mergeSektorLaender(basis, amundi)
}
