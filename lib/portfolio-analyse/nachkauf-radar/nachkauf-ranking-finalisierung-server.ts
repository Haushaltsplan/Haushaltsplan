/**
 * Nachkauf-Radar — Score-Finalisierung nach Depot-Anreicherung.
 * Geometrisches Kern-Modell + Relativ-Filter + Cap.
 * Markt-ATH blockiert keine titelbezogenen Einzelchancen (G2/G3 sind pro Aktie).
 */

import 'server-only'

import type { FundamentaldatenPaket } from '@/lib/portfolio-analyse/fundamentaldaten-types'
import { NACHKAUF_RADAR_WHITELIST, type WhitelistSektor } from './nachkauf-radar-whitelist'
import type { NachkaufAmpel, NachkaufScanEintrag } from './nachkauf-radar-types'
import {
  berechneGeometrischenKern,
  berechneGesamtAusKern,
  berechneKlumpenMalus,
  berechneQualitaetsAchse,
  berechneQualitaetsTextMalus,
  berechneRegimeDelta,
  berechneSektorDiversitaetsMalus,
  berechneStrukturMultiplikator,
  berechneTimingAchse,
  maxGruenKandidaten,
  medianZahl,
  pruefGateG1,
  pruefGateG2,
  pruefGateG3Teuer,
  RELATIV_FILTER_MIN_KANDIDATEN,
  RELATIV_KERN_MEDIAN_DELTA,
  RELATIV_TOP_ANTEIL,
  segmentQualitaetVonQuelle,
  type NachkaufBatchKontext,
} from './nachkauf-ranking-optimierung'
import { leiteNachkaufAmpelAb } from './nachkauf-radar-score'

function sektorVon(isin: string): WhitelistSektor | undefined {
  return NACHKAUF_RADAR_WHITELIST.find((p) => p.isin === isin)?.sektor
}

/** Achsen + Kern + Gate-Caps nach Update von DR/Klumpen/Regime neu berechnen. */
function aktualisiereAchsenUndGesamt(
  e: NachkaufScanEintrag,
  batch: NachkaufBatchKontext | null,
): void {
  const d = e.scoreDetail
  const regime = batch?.regime ?? null
  d.regimeDelta = berechneRegimeDelta(regime, e.bewertung)
  d.klumpenMalus = berechneKlumpenMalus(e.klumpenrisiko, e.depotGewichtPct)

  const sellWarnung = d.sellTriggerPenalty <= -25
  d.gateG1 = pruefGateG1(d.mantraScore, sellWarnung)
  d.gateG2 = pruefGateG2(e.kaufTriggerAusgeloest, e.bewertung)
  d.gateG3Teuer = pruefGateG3Teuer(e.kaufTriggerAusgeloest, e.bewertung)

  if (!d.gateG2) {
    d.momentumPunkte = 0
    d.insiderPunkte = 0
    d.drawdownBonus = 0
  }

  d.strukturMultiplikator =
    d.strukturMultiplikator ?? berechneStrukturMultiplikator(d.strukturPunkte)

  d.qualitaetsRang = Math.round(
    berechneQualitaetsAchse({
      mantraScore: d.mantraScore,
      sellTriggerPenalty: d.sellTriggerPenalty,
      deepResearchMalus: d.deepResearchMalus,
    }),
  )
  d.timingRang = Math.round(
    berechneTimingAchse({
      bewertungsScore: d.bewertungsScore,
      histFeintuningPct: d.historischerBewertungsBonus,
      strukturMultiplikator: d.strukturMultiplikator,
      kaufTriggerAusgeloest: e.kaufTriggerAusgeloest,
      regimeDelta: d.regimeDelta,
    }),
  )
  d.kombiniertRang = berechneGeometrischenKern(d.qualitaetsRang, d.timingRang)

  const neben = d.momentumPunkte + d.drawdownBonus + d.insiderPunkte
  d.gesamt = berechneGesamtAusKern({
    kern: d.kombiniertRang,
    gateG1: d.gateG1,
    gateG2: d.gateG2,
    nebenPunkte: neben,
    earningsMalus: d.earningsMalus,
    klumpenMalus: d.klumpenMalus,
    sektorMalus: d.sektorMalus,
    scoreKalibrierung: d.scoreKalibrierung,
  })
  e.score = d.gesamt
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

function stufeGruenAb(e: NachkaufScanEintrag): void {
  const premium = e.bewertung.premiumDiscountPct ?? 0
  e.ampel = premium >= 0 || (e.bewertung.drawdown52wPct ?? 0) < 10 ? 'teuer' : 'gelb'
}

/**
 * Relativ-Filter + Cap.
 *
 * Markt-ATH ≠ keine Chance: G2/G3 sind titelbezogen (Discount/DD der Aktie).
 * - Wenige absolute Grün-Kandidaten (<4): Einzelchancen behalten, nur Cap 5/3.
 * - Viele Kandidaten: Top 10% ∧ Kern ≥ Median+10, dann Cap.
 */
function wendeRelativGruenFilterAn(
  eintraege: NachkaufScanEintrag[],
  batch: NachkaufBatchKontext | null,
): void {
  const regime = batch?.regime ?? null
  const maxGruen = maxGruenKandidaten(regime)
  const kandidaten = eintraege
    .filter((e) => e.ampel === 'gruen')
    .sort(
      (a, b) =>
        (b.scoreDetail.kombiniertRang ?? b.score) - (a.scoreDetail.kombiniertRang ?? a.score),
    )

  // Einzelne Möglichkeiten (typisch ATH-Markt mit 1–3 Pullbacks)
  if (kandidaten.length < RELATIV_FILTER_MIN_KANDIDATEN) {
    for (let i = maxGruen; i < kandidaten.length; i++) stufeGruenAb(kandidaten[i]!)
    return
  }

  const kerne = eintraege.map((e) => e.scoreDetail.kombiniertRang ?? e.score)
  const medianKern = medianZahl(kerne)
  const topN = Math.max(1, Math.ceil(eintraege.length * RELATIV_TOP_ANTEIL))
  const nachKern = [...eintraege].sort(
    (a, b) =>
      (b.scoreDetail.kombiniertRang ?? b.score) - (a.scoreDetail.kombiniertRang ?? a.score),
  )
  const topTicker = new Set(nachKern.slice(0, topN).map((e) => e.ticker.toUpperCase()))

  for (const e of kandidaten) {
    const kern = e.scoreDetail.kombiniertRang ?? e.score
    const relativOk =
      topTicker.has(e.ticker.toUpperCase()) && kern >= medianKern + RELATIV_KERN_MEDIAN_DELTA
    if (!relativOk) stufeGruenAb(e)
  }

  const nochGruen = eintraege
    .filter((e) => e.ampel === 'gruen')
    .sort(
      (a, b) =>
        (b.scoreDetail.kombiniertRang ?? b.score) - (a.scoreDetail.kombiniertRang ?? a.score),
    )
  for (let i = maxGruen; i < nochGruen.length; i++) stufeGruenAb(nochGruen[i]!)
}

export function finalisiereNachkaufRanking(
  eintraege: NachkaufScanEintrag[],
  batch: NachkaufBatchKontext | null,
): void {
  for (const e of eintraege) {
    e.scoreDetail.segmentDatenQualitaet = segmentQualitaetVonQuelle(
      e.datenSignale?.segmentQuelle ?? null,
    )
    e.scoreDetail.deepResearchMalus = berechneQualitaetsTextMalus({
      deepResearchMemo: e.tiefenAnalyse?.memo ?? null,
      earningsZusammenfassung: e.datenSignale?.earningsKiZusammenfassung ?? null,
      secZusammenfassung: e.datenSignale?.secKiZusammenfassung ?? null,
    })
    e.scoreDetail.sektorMalus = 0

    if (e.datenSignale && batch) {
      const tage = batch.tageBisEarningsMap.get(e.ticker.toUpperCase())
      if (tage != null) e.datenSignale.tageBisEarnings = tage
    }

    aktualisiereAchsenUndGesamt(e, batch)
  }

  const grueneSektoren = new Map<WhitelistSektor, number>()
  const kernSchwelle = medianZahl(
    eintraege.map((e) => e.scoreDetail.kombiniertRang ?? e.score),
  )
  for (const e of eintraege) {
    if ((e.scoreDetail.kombiniertRang ?? 0) >= kernSchwelle + RELATIV_KERN_MEDIAN_DELTA) {
      const sek = sektorVon(e.isin)
      if (sek) grueneSektoren.set(sek, (grueneSektoren.get(sek) ?? 0) + 1)
    }
  }

  for (const e of eintraege) {
    e.scoreDetail.sektorMalus = berechneSektorDiversitaetsMalus(sektorVon(e.isin), grueneSektoren)
    aktualisiereAchsenUndGesamt(e, batch)
    e.ampel = ampelNachFinalisierung(e, batch)
  }

  wendeRelativGruenFilterAn(eintraege, batch)

  eintraege.sort(
    (a, b) =>
      (b.scoreDetail.kombiniertRang ?? b.score) - (a.scoreDetail.kombiniertRang ?? a.score),
  )
}
