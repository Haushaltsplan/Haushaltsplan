/**
 * Nachkauf-Radar — zentrale Datenanreicherung.
 *
 * Scan, Deep Research und Kaufempfehlung nutzen dieselben Projektquellen:
 * Depot (Dashboard), Buchungen, Insider, Notizen, Score-Verlauf, Ranking.
 */

import 'server-only'

import {
  ergaenzeDepotGewichte,
  ergaenzeKaufhistorieUndNotizen,
} from './nachkauf-radar-db-server'
import { ergaenzeScoreVerlauf } from './nachkauf-radar-verlauf-server'
import { ergaenzeInsiderKaeufe } from './insider-kaeufe-server'
import { berechneTrimSignale } from './nachkauf-trim-signal'
import { wendeNachkaufDisziplinAn } from './nachkauf-disziplin-server'
import { finalisiereNachkaufRanking } from './nachkauf-ranking-finalisierung-server'
import { ladeNachkaufBatchKontext } from './nachkauf-ranking-kontext-server'
import { ladeNachkaufPerformance } from './nachkauf-performance-server'
import { ladeNachkaufKandidaten } from './nachkauf-watchlist-cloud-server'
import type { NachkaufScanEintrag } from './nachkauf-radar-types'

/** Depot, Historie, Notizen, Insider, Score-Verlauf — für Deep Research pro Ticker. */
export async function reichereNachkaufTickerKontext(eintraege: NachkaufScanEintrag[]): Promise<void> {
  if (eintraege.length === 0) return
  // Whitelist + Watchlist, damit Insider-Käufe auch für Watchlist-Titel aufgelöst werden
  const kandidaten = await ladeNachkaufKandidaten()
  await Promise.allSettled([
    ergaenzeDepotGewichte(eintraege),
    ergaenzeScoreVerlauf(eintraege),
    ergaenzeKaufhistorieUndNotizen(eintraege),
    ergaenzeInsiderKaeufe(eintraege, kandidaten),
  ])
}

/**
 * Volle Anreicherung wie Ergebnisse-API / Dashboard-Kontext.
 * Für Kaufempfehlung und Scan-Abschluss.
 */
export async function reichereNachkaufEintraegeVoll(eintraege: NachkaufScanEintrag[]): Promise<void> {
  if (eintraege.length === 0) return

  await reichereNachkaufTickerKontext(eintraege)

  const perf = await ladeNachkaufPerformance().catch(() => null)
  const kandidaten = await ladeNachkaufKandidaten()
  const batchKontext = await ladeNachkaufBatchKontext(
    kandidaten.map((p) => p.isin),
    perf?.scoreBucketsSignal ?? [],
  )

  wendeNachkaufDisziplinAn(eintraege)
  berechneTrimSignale(eintraege)
  finalisiereNachkaufRanking(eintraege, batchKontext)
}
