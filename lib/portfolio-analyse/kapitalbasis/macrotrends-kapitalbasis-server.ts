/**
 * Macrotrends-Kapitalbasis ist abgeschaltet (Cloudflare). Historie kommt über SEC / Yahoo / SA.
 */

import 'server-only'

import type { MacrotrendsIdent } from '@/lib/portfolio-analyse/macrotrends-scraper-server'
import type { KapitalbasisJahr } from '@/lib/portfolio-analyse/kapitalbasis/kapitalbasis-typen'

export type MacrotrendsKapitalbasisRoh = {
  jahre: KapitalbasisJahr[]
  ident: MacrotrendsIdent
}

export async function ladeMacrotrendsKapitalbasis(_opts: {
  symbolYahoo?: string | null
  isin?: string | null
  firmenname?: string | null
}): Promise<MacrotrendsKapitalbasisRoh | null> {
  return null
}
