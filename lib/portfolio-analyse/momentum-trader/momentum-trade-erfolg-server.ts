import 'server-only'

import {
  BACKTEST_LOW_CONFIDENCE_CAP_PCT,
  BACKTEST_MIN_SAMPLES_GLOBAL,
  BACKTEST_MIN_SAMPLES_SYMBOL,
  PLANUNG_HANDELN_MIN_SCORE,
  momentumPlaybookLabel,
} from '@/lib/portfolio-analyse/momentum-trader/momentum-constants'
import {
  findePlaybookStat,
  type MomentumPlaybookStatsLookup,
} from '@/lib/portfolio-analyse/momentum-trader/momentum-playbook-stats-server'
import { berechnePlanungsScore } from '@/lib/portfolio-analyse/momentum-trader/momentum-planungs-score-server'
import { bewerteTradeQualitaet } from '@/lib/portfolio-analyse/momentum-trader/momentum-trade-qualitaet-server'
import {
  MOMENTUM_PRE_EVENT_PLAYBOOKS,
  MOMENTUM_TRADE_PLAYBOOKS,
} from '@/lib/portfolio-analyse/momentum-trader/momentum-playbook-registry'
import type {
  MomentumRegimeGates,
  MomentumRichtung,
  MomentumScanEintrag,
} from '@/lib/portfolio-analyse/momentum-trader/momentum-trader-types'

const TRADE_PLAYBOOKS = new Set(MOMENTUM_TRADE_PLAYBOOKS)
const PRE_EVENT_PLAYBOOKS = new Set(MOMENTUM_PRE_EVENT_PLAYBOOKS)

/** Nur mathematische Prozent-Grenze (0–100), keine künstliche Deckelung. */
export function rundeTrefferPct(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.round(Math.max(0, Math.min(100, n)))
}

/** @deprecated Alias — keine Min/Max-Klemme mehr. */
export function klemmeErfolgWahrscheinlichkeit(n: number): number {
  return rundeTrefferPct(n)
}

/** Neutrale Prior-Quote ohne nachgewiesenen Edge (Shrinkage). */
const PRIOR_TREFFER_PCT = 50

function shrinkageGewicht(sampleSize: number, zielStichprobe: number): number {
  if (sampleSize <= 0 || zielStichprobe <= 0) return 0
  return Math.min(1, sampleSize / zielStichprobe)
}

function alsZahl(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback
}

function richtungWort(r: MomentumRichtung): string {
  return r === 'long' ? 'LONG' : 'SHORT'
}

function erfolgLabel(pct: number): string {
  if (pct >= 58) return 'Hoch'
  if (pct >= 48) return 'Mittel'
  return 'Niedrig'
}

export type MomentumErfolgSzenario = {
  richtung: MomentumRichtung
  wahrscheinlichkeitPct: number
  label: string
}

/** Historische Szenario-Gewichte für Pre-Event (Beat, Gap, Lauf). */
export function baueErfolgSzenarienPreEvent(
  beat: number,
  median: number,
  lauf: number,
  gates: MomentumRegimeGates | null,
): MomentumErfolgSzenario[] {
  let wShort =
    beat * Math.min(0.9, 0.32 + median * 0.055) * (lauf >= 6 ? 1.28 : lauf >= 3 ? 1.1 : 1)
  let wLongFade = (1 - beat) * Math.min(0.85, 0.28 + median * 0.05)
  let wLongMom = beat * 0.38 * (lauf < 6 && lauf > -3 ? 1.2 : 0.65)
  if (gates?.shortBias) wShort *= 1.12
  if (gates?.longBias) {
    wLongFade *= 1.1
    wLongMom *= 1.15
  }
  const sum = wShort + wLongFade + wLongMom || 1
  return [
    {
      richtung: 'short' as const,
      wahrscheinlichkeitPct: rundeTrefferPct((wShort / sum) * 100),
      label: 'Gap-Fade Short (Beat + Gap-Up)',
    },
    {
      richtung: 'long' as const,
      wahrscheinlichkeitPct: rundeTrefferPct((wLongMom / sum) * 100),
      label: 'Momentum Long (Beat + Stärke)',
    },
    {
      richtung: 'long' as const,
      wahrscheinlichkeitPct: rundeTrefferPct((wLongFade / sum) * 100),
      label: 'Gap-Fade Long (Miss + Gap-Down)',
    },
  ].sort((a, b) => b.wahrscheinlichkeitPct - a.wahrscheinlichkeitPct)
}

/**
 * Schätzung ohne Backtest: konservativ um ~45–58 % — Score/Gates verschieben nur moderat.
 */
function berechneHeuristikTrefferPct(e: MomentumScanEintrag): number {
  const total = e.gatesPassed.length + e.gatesFailed.length
  const gateRatio = total > 0 ? e.gatesPassed.length / total : 0.5
  let pct = 40 + gateRatio * 12 + (e.score - 50) * 0.2
  if (e.ampel === 'gruen') pct += 2
  else if (e.ampel === 'gelb') pct -= 1
  else pct -= 8
  if (e.gatesFailed.length > 0) pct -= e.gatesFailed.length * 3
  return rundeTrefferPct(pct)
}

/** Setup vs. Durchschnitt — max. ±8 Punkte, nur bei guter Datenlage wirksam. */
function berechneSetupQualitaetBonus(e: MomentumScanEintrag): number {
  const total = e.gatesPassed.length + e.gatesFailed.length
  const gateRatio = total > 0 ? e.gatesPassed.length / total : 0.5
  let bonus = (gateRatio - 0.9) * 18
  if (e.ampel === 'gruen') bonus += 3
  else if (e.ampel === 'gelb') bonus -= 2
  else bonus -= 8
  bonus += (e.score - 62) * 0.1
  if (e.gatesFailed.length > 0) bonus -= e.gatesFailed.length * 3

  const entry = alsZahl(e.indikatoren.entryPrice, 0)
  const stop = alsZahl(e.indikatoren.stopPrice, 0)
  const target = alsZahl(e.indikatoren.targetPrice, 0)
  if (entry > 0 && stop > 0 && target > 0) {
    const risk = Math.abs(entry - stop)
    const reward = Math.abs(target - entry)
    if (risk > 0) {
      const rr = reward / risk
      if (rr >= 2) bonus += 2
      else if (rr < 1.2) bonus -= 4
    }
  }

  return Math.max(-8, Math.min(8, Math.round(bonus)))
}

function berechnePreEvent(
  e: MomentumScanEintrag,
  gates: MomentumRegimeGates | null,
): { pct: number; richtung: MomentumRichtung | null; szenario: string } {
  const beat = alsZahl(e.indikatoren.beatRatePct, 50) / 100
  const median = alsZahl(e.indikatoren.medianGapPct, 4)
  const lauf = alsZahl(e.indikatoren.laufVorEarningsPct, 0)
  const szenarien = baueErfolgSzenarienPreEvent(beat, median, lauf, gates)
  const top = szenarien[0]
  if (!top) return { pct: 0, richtung: null, szenario: '' }

  const datenQualitaet = 0.35 + Math.min(0.25, e.score / 280)
  let pct = top.wahrscheinlichkeitPct * datenQualitaet + e.score * 0.06

  if (e.playbook === 'earnings_pre_run' && e.ampel !== 'grau') {
    pct = pct * 0.55 + berechneHeuristikTrefferPct(e) * 0.45
  }

  const tage = alsZahl(e.indikatoren.tageBisEarnings, -1)
  if (tage === 0) pct += 4
  else if (tage > 7) pct -= 4

  return {
    pct: rundeTrefferPct(pct),
    richtung: top.richtung,
    szenario: top.label,
  }
}

export type MomentumTradeErfolg = {
  pct: number
  label: string
  richtung: MomentumRichtung | null
  istAktiv: boolean
  handlungKurz: string
  erfolgBasisText: string | null
  backtestTrefferPct: number | null
  backtestStichprobe: number | null
  backtestHinweis: string | null
  planungsScore: number
  planungsLabel: string
  planungsErwartungEur: number | null
  planungsBasisText: string | null
}

function bauePlanung(
  e: MomentumScanEintrag,
  trefferPct: number,
  stat: ReturnType<typeof findePlaybookStat>,
  qualifiziert: boolean,
) {
  const planung = berechnePlanungsScore(e, trefferPct, stat, qualifiziert)
  const istAktiv = qualifiziert && planung.score >= PLANUNG_HANDELN_MIN_SCORE
  return { planung, istAktiv }
}

/**
 * Trefferwahrscheinlichkeit = gewichtete Backtest-Quote + kleine Setup-Anpassung.
 * Wenig Stichproben → Shrinkage Richtung 50 % + Deckelung.
 */
function berechneTrefferWahrscheinlichkeit(
  e: MomentumScanEintrag,
  lookup: MomentumPlaybookStatsLookup | null,
): { pct: number; stat: ReturnType<typeof findePlaybookStat>; basisText: string | null } {
  const stat = findePlaybookStat(lookup, e.playbook, e.symbol)
  const bonus = berechneSetupQualitaetBonus(e)
  const heuristik = berechneHeuristikTrefferPct(e)

  if (!stat || stat.trefferPct == null) {
    return {
      pct: heuristik,
      stat: null,
      basisText: 'Schätzung ohne Backtest: Gates/Score → ' + heuristik + '%',
    }
  }

  const hist = stat.trefferPct
  const n = stat.sampleSize
  const symbolStat = Boolean(stat.symbol && n >= BACKTEST_MIN_SAMPLES_SYMBOL)
  const zielN = symbolStat ? BACKTEST_MIN_SAMPLES_SYMBOL * 4 : BACKTEST_MIN_SAMPLES_GLOBAL * 3
  const w = shrinkageGewicht(n, zielN)
  const shrunkHist = PRIOR_TREFFER_PCT * (1 - w) + hist * w
  const adj = Math.round(bonus * w * 0.65)
  let pct = shrunkHist + adj

  let basisText: string

  if (symbolStat) {
    basisText =
      hist +
      '% historisch ' +
      e.symbol +
      ' (' +
      stat.wins +
      '/' +
      n +
      '), gewichtet ' +
      rundeTrefferPct(shrunkHist) +
      '%' +
      (adj !== 0 ? ', Setup ' + (adj >= 0 ? '+' : '') + adj + '%' : '') +
      ' = ' +
      rundeTrefferPct(pct) +
      '%'
  } else if (n >= BACKTEST_MIN_SAMPLES_GLOBAL) {
    basisText =
      hist +
      '% Playbook-Backtest (' +
      stat.wins +
      '/' +
      n +
      '), gewichtet ' +
      rundeTrefferPct(shrunkHist) +
      '%' +
      (adj !== 0 ? ', Setup ' + (adj >= 0 ? '+' : '') + adj + '%' : '') +
      ' = ' +
      rundeTrefferPct(pct) +
      '%'
  } else {
    pct = hist * w + heuristik * (1 - w) + adj * 0.5
    pct = Math.min(pct, BACKTEST_LOW_CONFIDENCE_CAP_PCT)
    basisText =
      'Wenig Daten (' +
      n +
      '×): Backtest ' +
      hist +
      '% + Schätzung ' +
      heuristik +
      '% (max. ' +
      BACKTEST_LOW_CONFIDENCE_CAP_PCT +
      '%)'
  }

  if (n < BACKTEST_MIN_SAMPLES_GLOBAL && n > 0) {
    pct = Math.min(pct, BACKTEST_LOW_CONFIDENCE_CAP_PCT)
  }

  return { pct: rundeTrefferPct(pct), stat, basisText }
}

function backtestHinweisText(stat: ReturnType<typeof findePlaybookStat>): string | null {
  if (!stat || stat.trefferPct == null || stat.sampleSize < 3) return null
  const jahre = Math.round(stat.fensterTage / 252)
  const jahreLabel = jahre >= 2 ? jahre + 'J' : Math.round(stat.fensterTage / 30) + 'M'
  return stat.wins + '/' + stat.sampleSize + ' Treffer (' + jahreLabel + ', ' + stat.trefferPct + '%)'
}

/** Erfolgswahrscheinlichkeit: wie wahrscheinlich der empfohlene Trade aufgeht. */
export function berechneTradeErfolg(
  e: MomentumScanEintrag,
  gates: MomentumRegimeGates | null,
  statsLookup: MomentumPlaybookStatsLookup | null = null,
): MomentumTradeErfolg {
  const pbLabel = momentumPlaybookLabel(e.playbook)
  const leerBacktest = {
    erfolgBasisText: null as string | null,
    backtestTrefferPct: null as number | null,
    backtestStichprobe: null as number | null,
    backtestHinweis: null as string | null,
    planungsScore: 0,
    planungsLabel: '—',
    planungsErwartungEur: null as number | null,
    planungsBasisText: null as string | null,
  }

  if (e.playbook === 'ipo_fade' && e.ampel === 'grau') {
    return {
      pct: 0,
      label: '—',
      richtung: null,
      istAktiv: false,
      handlungKurz: 'IPO-Beobachtung — noch kein Trade',
      ...leerBacktest,
    }
  }

  if (PRE_EVENT_PLAYBOOKS.has(e.playbook) || (e.playbook === 'earnings_pre_run' && e.ampel === 'grau')) {
    const pe = berechnePreEvent(e, gates)
    const tage = alsZahl(e.indikatoren.tageBisEarnings, -1)
    const r = pe.richtung
    let handlungKurz = 'Vorbereiten — noch kein Einstieg'
    if (r) {
      handlungKurz =
        (tage === 0 ? 'Heute Earnings · ' : tage > 0 ? 'In ' + tage + 'T · ' : '') +
        'Danach ' +
        richtungWort(r) +
        ' — ' +
        pe.pct +
        '%'
    }
    return {
      pct: pe.pct,
      label: pe.pct > 0 ? erfolgLabel(pe.pct) : '—',
      richtung: pe.richtung,
      istAktiv: false,
      handlungKurz,
      ...leerBacktest,
    }
  }

  const r = e.indikatoren.richtung ?? e.indikatoren.erfolgRichtung
  const richtungOk = r === 'long' || r === 'short' ? r : null

  if (TRADE_PLAYBOOKS.has(e.playbook) && e.ampel !== 'grau' && e.ampel !== 'rot' && richtungOk) {
    const kal = berechneTrefferWahrscheinlichkeit(e, statsLookup)
    const hinweis = backtestHinweisText(kal.stat)
    const qual = bewerteTradeQualitaet(e, kal.pct, gates, kal.stat)
    const { planung, istAktiv } = bauePlanung(e, kal.pct, kal.stat, qual.qualifiziert)
    let handlungKurz: string
    if (istAktiv) {
      handlungKurz =
        'SCHRITT 1: ' +
        richtungWort(richtungOk) +
        ' Market · Stop ' +
        String(e.indikatoren.stopPrice ?? '—') +
        ' · Ziel ' +
        String(e.indikatoren.targetPrice ?? '—') +
        ' · Planung ' +
        planung.score +
        '/100' +
        (planung.erwartungEur != null
          ? ' (≈' + (planung.erwartungEur >= 0 ? '+' : '') + planung.erwartungEur + ' €)'
          : '')
    } else if (qual.blockiertGruende.length > 0) {
      handlungKurz = 'NICHT handeln — ' + qual.blockiertGruende[0]
    } else if (qual.qualifiziert && planung.score < PLANUNG_HANDELN_MIN_SCORE) {
      handlungKurz = 'NICHT handeln — Planungs-Score ' + planung.score + ' < ' + PLANUNG_HANDELN_MIN_SCORE
    } else {
      handlungKurz = 'NICHT handeln — Qualitätsfilter'
    }
    return {
      pct: kal.pct,
      label: erfolgLabel(kal.pct),
      richtung: richtungOk,
      istAktiv,
      handlungKurz,
      erfolgBasisText: kal.basisText,
      backtestTrefferPct: kal.stat?.trefferPct ?? null,
      backtestStichprobe: kal.stat?.sampleSize ?? null,
      backtestHinweis: hinweis,
      planungsScore: planung.score,
      planungsLabel: planung.label,
      planungsErwartungEur: planung.erwartungEur,
      planungsBasisText: planung.basisText,
    }
  }

  const kal = berechneTrefferWahrscheinlichkeit(e, statsLookup)
  const istSchwach = e.ampel === 'rot' || e.gatesFailed.length > e.gatesPassed.length
  const qual = bewerteTradeQualitaet(e, kal.pct, gates, kal.stat)
  const { planung, istAktiv } = bauePlanung(e, kal.pct, kal.stat, qual.qualifiziert && !istSchwach)
  let displayPct = kal.pct
  if (istSchwach) {
    if (kal.stat?.trefferPct != null) {
      displayPct = Math.min(displayPct, kal.stat.trefferPct)
    } else {
      displayPct = Math.min(displayPct, berechneHeuristikTrefferPct(e) - 4)
    }
  }
  return {
    pct: displayPct,
    label: istSchwach ? 'Niedrig' : erfolgLabel(displayPct),
    richtung: richtungOk,
    istAktiv: istAktiv && !istSchwach,
    handlungKurz: istSchwach
      ? 'NICHT handeln — Setup unvollständig'
      : 'NICHT handeln — ' + pbLabel + ' noch nicht aktiv',
    erfolgBasisText: kal.basisText,
    backtestTrefferPct: kal.stat?.trefferPct ?? null,
    backtestStichprobe: kal.stat?.sampleSize ?? null,
    backtestHinweis: backtestHinweisText(kal.stat),
    planungsScore: planung.score,
    planungsLabel: planung.label,
    planungsErwartungEur: planung.erwartungEur,
    planungsBasisText: planung.basisText,
  }
}

export function ergaenzeScanMitErfolg(
  ergebnisse: MomentumScanEintrag[],
  gates: MomentumRegimeGates | null,
  statsLookup: MomentumPlaybookStatsLookup | null = null,
): MomentumScanEintrag[] {
  return ergebnisse.map((e) => {
    const erfolg = berechneTradeErfolg(e, gates, statsLookup)
    return {
      ...e,
      indikatoren: {
        ...e.indikatoren,
        erfolgWahrscheinlichkeitPct: erfolg.pct,
        erfolgLabel: erfolg.label,
        erfolgIstAktiv: erfolg.istAktiv,
        handlungKurz: erfolg.handlungKurz,
        erfolgRichtung: erfolg.richtung,
        erfolgBasisText: erfolg.erfolgBasisText,
        backtestTrefferPct: erfolg.backtestTrefferPct,
        backtestStichprobe: erfolg.backtestStichprobe,
        backtestHinweis: erfolg.backtestHinweis,
        planungsScore: erfolg.planungsScore,
        planungsLabel: erfolg.planungsLabel,
        planungsErwartungEur: erfolg.planungsErwartungEur,
        planungsBasisText: erfolg.planungsBasisText,
        tradeQualitaetOk: erfolg.istAktiv,
      },
    }
  })
}
