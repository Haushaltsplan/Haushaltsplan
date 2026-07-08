/**
 * Nachkauf-Radar — Ranking-Kontext laden (Regime, Earnings, Backtest-Kalibrierung).
 */

import 'server-only'

import { isinKenntnis } from '@/lib/portfolio-analyse/isin-kenntnisse'
import {
  ladeMomentumEarningsKalenderFuerSymbole,
  ladeNeuestesMomentumRegime,
} from '@/lib/portfolio-analyse/momentum-trader/momentum-db-server'
import type { NachkaufScoreBucketStat } from './nachkauf-radar-types'
import type { NachkaufBatchKontext } from './nachkauf-ranking-optimierung'

export type { NachkaufBatchKontext }

function tageZwischen(heute: string, ziel: string): number {
  const a = new Date(heute + 'T12:00:00Z').getTime()
  const b = new Date(ziel + 'T12:00:00Z').getTime()
  return Math.round((b - a) / 86_400_000)
}

export async function ladeNachkaufBatchKontext(
  isins: string[],
  scoreBuckets: NachkaufScoreBucketStat[] = [],
): Promise<NachkaufBatchKontext> {
  const heute = new Date().toISOString().slice(0, 10)
  const symbole: string[] = []
  for (const isin of isins) {
    const k = isinKenntnis(isin)
    const sym = (k?.symbolYahoo ?? k?.logoSymbol ?? k?.macrotrendsTicker ?? '').split('.')[0]
    if (sym) symbole.push(sym.toUpperCase())
  }

  const [regime, kalender] = await Promise.all([
    ladeNeuestesMomentumRegime().catch(() => null),
    ladeMomentumEarningsKalenderFuerSymbole(symbole).catch(() => []),
  ])

  const tageBisEarningsMap = new Map<string, number>()
  for (const sym of symbole) {
    const naechstes = kalender
      .filter((k) => k.symbol.toUpperCase() === sym && k.earningsDate >= heute)
      .sort((a, b) => a.earningsDate.localeCompare(b.earningsDate))[0]
    if (naechstes) {
      tageBisEarningsMap.set(sym, tageZwischen(heute, naechstes.earningsDate))
    }
  }

  return { regime, tageBisEarningsMap, scoreBuckets }
}
