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
import {
  behalteGastKandidatenInPlace,
  ladeNachkaufKandidaten,
  setzeKandidatenQuelle,
} from './nachkauf-watchlist-cloud-server'
import type { NachkaufScanEintrag } from './nachkauf-radar-types'

/** Depot, Historie, Notizen, Insider, Score-Verlauf — für Deep Research pro Ticker. */
export async function reichereNachkaufTickerKontext(eintraege: NachkaufScanEintrag[]): Promise<void> {
  if (eintraege.length === 0) return
  const kandidaten = await ladeNachkaufKandidaten()
  behalteGastKandidatenInPlace(eintraege, kandidaten)
  setzeKandidatenQuelle(eintraege, kandidaten)
  if (eintraege.length === 0) return
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
  if (eintraege.length === 0) return

  const perf = await ladeNachkaufPerformance(undefined, { mitLive: false }).catch(() => null)
  const kandidaten = await ladeNachkaufKandidaten()
  const batchKontext = await ladeNachkaufBatchKontext(
    kandidaten.map((p) => p.isin),
    perf?.scoreBucketsSignal ?? [],
  )

  finalisiereNachkaufRanking(eintraege, batchKontext)
  // Disziplin NACH Ampel-Finalisierung — sonst wird Grün→Gelb überschrieben
  wendeNachkaufDisziplinAn(eintraege)
  berechneTrimSignale(eintraege)
}
