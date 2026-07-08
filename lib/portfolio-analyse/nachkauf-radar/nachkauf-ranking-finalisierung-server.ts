/**
 * Nachkauf-Radar — Score-Finalisierung nach Depot-Anreicherung.
 */

import 'server-only'

import type { FundamentaldatenPaket } from '@/lib/portfolio-analyse/fundamentaldaten-types'
import { NACHKAUF_RADAR_WHITELIST, type WhitelistSektor } from './nachkauf-radar-whitelist'
import type { NachkaufAmpel, NachkaufScanEintrag, NachkaufScoreDetail } from './nachkauf-radar-types'
import {
  berechneDeepResearchMalus,
  berechneKombiniertRang,
  berechneKlumpenMalus,
  berechneQualitaetsRang,
  berechneSektorDiversitaetsMalus,
  berechneTimingRang,
  gruenSchwelle,
  segmentQualitaetVonQuelle,
  type NachkaufBatchKontext,
} from './nachkauf-ranking-optimierung'
import { leiteNachkaufAmpelAb } from './nachkauf-radar-score'

function sektorVon(isin: string): WhitelistSektor | undefined {
  return NACHKAUF_RADAR_WHITELIST.find((p) => p.isin === isin)?.sektor
}

function summeScore(d: NachkaufScoreDetail): number {
  return Math.max(
    0,
    Math.min(
      100,
      d.mantraScore +
        d.sellTriggerPenalty +
        d.bewertungsScore +
        d.historischerBewertungsBonus +
        d.momentumPunkte +
        d.strukturPunkte +
        d.drawdownBonus +
        d.insiderPunkte +
        d.kauftriggerBonus +
        d.regimeDelta +
        d.earningsMalus +
        d.deepResearchMalus +
        d.klumpenMalus +
        d.sektorMalus +
        d.scoreKalibrierung,
    ),
  )
}

function ampelNachFinalisierung(
  eintrag: NachkaufScanEintrag,
  batch: NachkaufBatchKontext | null,
): NachkaufAmpel {
  if (!eintrag.sellTriggerOk || eintrag.mantraAmpel === 'rot') return 'rot'

  const fakePaket = {
    mantra: {
      ampel: eintrag.mantraAmpel ?? 'grau',
      sellTriggerWatch: [],
      zusammenfassung: { bewertbar: 1 },
    },
  } as unknown as FundamentaldatenPaket

  return leiteNachkaufAmpelAb(fakePaket, eintrag.scoreDetail, eintrag.bewertung, {
    kaufTriggerAusgeloest: eintrag.kaufTriggerAusgeloest,
    regime: batch?.regime ?? null,
  })
}

export function finalisiereNachkaufRanking(
  eintraege: NachkaufScanEintrag[],
  batch: NachkaufBatchKontext | null,
): void {
  for (const e of eintraege) {
    e.scoreDetail.segmentDatenQualitaet = segmentQualitaetVonQuelle(
      e.datenSignale?.segmentQuelle ?? null,
    )
    e.scoreDetail.deepResearchMalus = berechneDeepResearchMalus(e.tiefenAnalyse?.memo ?? null)
    e.scoreDetail.klumpenMalus = berechneKlumpenMalus(e.klumpenrisiko, e.depotGewichtPct)
    e.scoreDetail.sektorMalus = 0

    if (e.datenSignale && batch) {
      const tage = batch.tageBisEarningsMap.get(e.ticker.toUpperCase())
      if (tage != null) e.datenSignale.tageBisEarnings = tage
    }

    e.scoreDetail.gesamt = summeScore(e.scoreDetail)
    e.score = e.scoreDetail.gesamt
    e.scoreDetail.qualitaetsRang = berechneQualitaetsRang(e.scoreDetail)
    e.scoreDetail.timingRang = berechneTimingRang(e.scoreDetail, e.bewertung)
    e.scoreDetail.kombiniertRang = berechneKombiniertRang(
      e.scoreDetail.qualitaetsRang,
      e.scoreDetail.timingRang,
    )
  }

  const grueneSektoren = new Map<WhitelistSektor, number>()
  for (const e of eintraege) {
    if (e.scoreDetail.gesamt >= gruenSchwelle(e.kaufTriggerAusgeloest)) {
      const sek = sektorVon(e.isin)
      if (sek) grueneSektoren.set(sek, (grueneSektoren.get(sek) ?? 0) + 1)
    }
  }

  for (const e of eintraege) {
    e.scoreDetail.sektorMalus = berechneSektorDiversitaetsMalus(sektorVon(e.isin), grueneSektoren)
    e.scoreDetail.gesamt = summeScore(e.scoreDetail)
    e.score = e.scoreDetail.gesamt
    e.scoreDetail.timingRang = berechneTimingRang(e.scoreDetail, e.bewertung)
    e.scoreDetail.kombiniertRang = berechneKombiniertRang(
      e.scoreDetail.qualitaetsRang,
      e.scoreDetail.timingRang,
    )
    e.ampel = ampelNachFinalisierung(e, batch)
  }

  eintraege.sort(
    (a, b) => (b.scoreDetail.kombiniertRang ?? b.score) - (a.scoreDetail.kombiniertRang ?? a.score),
  )
}
