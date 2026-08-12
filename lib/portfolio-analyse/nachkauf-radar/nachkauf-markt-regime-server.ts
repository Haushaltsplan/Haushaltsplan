/**
 * Markt-Regime für Nachkauf-Radar: SPY vs. 20-Tage-MA + VIX.
 */
import 'server-only'

import { ladeYahooHistorieTaeglich } from '@/lib/portfolio-analyse/yahoo-historie-server'
import type { NachkaufMarktRegime } from './nachkauf-ranking-optimierung'

const CACHE_MS = 30 * 60 * 1000
let cache: { at: number; regime: NachkaufMarktRegime } | null = null

function isoVorTagen(tage: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - tage)
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function heuteIso(): string {
  const d = new Date()
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function sortierteSchlusskurse(serie: Map<string, number>): number[] {
  return [...serie.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([, v]) => v)
    .filter((v) => v > 0 && Number.isFinite(v))
}

/** SPY über 20-Tage-MA? + aktueller VIX-Schluss. */
export async function ladeNachkaufMarktRegime(): Promise<NachkaufMarktRegime> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.regime

  const von = isoVorTagen(45)
  const bis = heuteIso()
  let spyAbove20Ma: boolean | null = null
  let vixClose: number | null = null

  try {
    const [spySerie, vixSerie] = await Promise.all([
      ladeYahooHistorieTaeglich('SPY', von, bis),
      ladeYahooHistorieTaeglich('^VIX', von, bis),
    ])

    const spy = sortierteSchlusskurse(spySerie)
    if (spy.length >= 20) {
      const last20 = spy.slice(-20)
      const ma20 = last20.reduce((a, b) => a + b, 0) / last20.length
      const last = spy[spy.length - 1]!
      spyAbove20Ma = last >= ma20
    }

    const vix = sortierteSchlusskurse(vixSerie)
    if (vix.length > 0) vixClose = vix[vix.length - 1]!
  } catch (e) {
    console.warn('[nachkauf-regime] Laden fehlgeschlagen:', e)
  }

  const regime: NachkaufMarktRegime = { spyAbove20Ma, vixClose }
  cache = { at: Date.now(), regime }
  return regime
}
