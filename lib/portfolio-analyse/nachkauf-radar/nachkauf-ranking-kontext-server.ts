/**
 * Nachkauf-Radar — Ranking-Kontext laden (Backtest-Kalibrierung).
 */

import 'server-only'

import type { NachkaufScoreBucketStat } from './nachkauf-radar-types'
import type { NachkaufBatchKontext } from './nachkauf-ranking-optimierung'

export type { NachkaufBatchKontext }

export async function ladeNachkaufBatchKontext(
  _isins: string[],
  scoreBuckets: NachkaufScoreBucketStat[] = [],
): Promise<NachkaufBatchKontext> {
  return {
    regime: null,
    tageBisEarningsMap: new Map(),
    scoreBuckets,
  }
}
