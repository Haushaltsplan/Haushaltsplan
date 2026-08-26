import 'server-only'

import type { EtfBreakdown } from '@/lib/portfolio-analyse/parqet-core/types'
import { ladeAmundiEtfBreakdown } from '@/lib/portfolio-analyse/etf-scraper/amundi-breakdown-server'
import { etfBenchmarkFuerIsin, type EtfBenchmark } from '@/lib/portfolio-analyse/etf-scraper/etf-benchmark-mapping'
import { ladeNasdaq100Breakdown } from '@/lib/portfolio-analyse/etf-scraper/nasdaq100-holdings-server'
import { ladeRizeCybersecurityBreakdown } from '@/lib/portfolio-analyse/etf-scraper/rize-cybersecurity-holdings-server'
import {
  ladeSp500CapBreakdown,
  ladeSp500EqualBreakdown,
} from '@/lib/portfolio-analyse/etf-scraper/ssga-holdings-server'

const MIN_HOLDINGS: Record<EtfBenchmark, number> = {
  SP500_CAP: 400,
  SP500_EQUAL: 400,
  NASDAQ100: 80,
  RIZE_CYBER: 20,
}

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
    case 'RIZE_CYBER':
      basis = await ladeRizeCybersecurityBreakdown()
      break
  }

  if (!basis || basis.topHoldings.length < MIN_HOLDINGS[benchmark]) return null

  if (benchmark === 'RIZE_CYBER') return basis

  const amundi = await ladeAmundiEtfBreakdown(isin)
  return mergeSektorLaender(basis, amundi)
}
