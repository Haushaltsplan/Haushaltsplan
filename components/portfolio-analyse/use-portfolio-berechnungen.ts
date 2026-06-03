'use client'

import { useMemo } from 'react'
import {
  berechnePortfolioDashboardBerechnungen,
  type PortfolioBerechnungenOptionen,
  type PortfolioDashboardBerechnungen,
} from '@/lib/portfolio-analyse/portfolio-berechnungen'
import type { PortfolioBuchung } from '@/lib/portfolio-analyse/types'
import type { WertentwicklungPunkt } from '@/lib/portfolio-analyse/wertentwicklung'

const LEER: PortfolioDashboardBerechnungen = {
  wertentwicklung: [],
  performance: [],
  performanceTtwror: [],
  drawdown: {
    serie: [],
    maxDrawdownProzent: 0,
    maxDrawdownTage: null,
    maxDrawdownPeriode: null,
  },
}

/**
 * Einheitliche Chart-Berechnungen (Wertentwicklung → TTWROR → Drawdown).
 */
export function usePortfolioBerechnungen(
  wertentwicklungRoh: WertentwicklungPunkt[],
  buchungen: PortfolioBuchung[],
  optionen: PortfolioBerechnungenOptionen = {},
): PortfolioDashboardBerechnungen {
  const mitDiv = optionen.mitDivUndRealisiert ?? true
  const metric = optionen.portfolioMetric ?? undefined

  return useMemo(
    () =>
      wertentwicklungRoh.length === 0
        ? LEER
        : berechnePortfolioDashboardBerechnungen(wertentwicklungRoh, buchungen, optionen),
    [buchungen, metric, mitDiv, wertentwicklungRoh],
  )
}
