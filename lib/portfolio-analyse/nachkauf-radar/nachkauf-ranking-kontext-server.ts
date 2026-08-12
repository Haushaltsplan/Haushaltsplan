/**
 * Nachkauf-Radar — Ranking-Kontext laden (Regime + Backtest-Kalibrierung).
 */

import 'server-only'

import type { NachkaufScoreBucketStat } from './nachkauf-radar-types'
import type { NachkaufBatchKontext } from './nachkauf-ranking-optimierung'
import { ladeNachkaufMarktRegime } from './nachkauf-markt-regime-server'

export type { NachkaufBatchKontext }

export async function ladeNachkaufBatchKontext(
  _isins: string[],
  scoreBuckets: NachkaufScoreBucketStat[] = [],
): Promise<NachkaufBatchKontext> {
  const regime = await ladeNachkaufMarktRegime().catch(() => null)
  return {
    regime,
    tageBisEarningsMap: new Map(),
    scoreBuckets,
  }
}
