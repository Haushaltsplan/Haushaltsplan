/**
 * Token-geschützter Live-Export: nur Portfolioanalyse-Kontext
 * (derselbe Baustein wie der Portfolio-Berater in der App).
 */
import 'server-only'

import { bauePortfolioBeraterKontext } from '@/lib/portfolio-analyse/portfolio-berater-kontext-server'
import { runWithPrimaeremOwner } from '@/lib/request-owner'

export type ExportDataOpts = {
  focusIsin?: string | null
  focusTicker?: string | null
}

export async function ladeExportData(opts?: ExportDataOpts) {
  return runWithPrimaeremOwner(() =>
    bauePortfolioBeraterKontext({
      focusIsin: opts?.focusIsin,
      focusTicker: opts?.focusTicker,
      seite: 'export-data',
    }),
  )
}
