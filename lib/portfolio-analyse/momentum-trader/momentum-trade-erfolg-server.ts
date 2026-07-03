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
import { bewerteTradeQualitaet, berechneRewardRisk } from '@/lib/portfolio-analyse/momentum-trader/momentum-trade-qualitaet-server'
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

/** Neutrale Prior-Quote ohne nachgewiesenen Edge (nur bei sehr wenig Daten). */
const PRIOR_TREFFER_PCT = 50

/** Setup-Anpassung: max. ±22 Punkte um Backtest/Schätzung. */
const SETUP_DELTA_MAX = 22

/** Unter dieser Stichprobe: starke Unsicherheit, keine hohen %-Versprechen. */
const TREFFER_UNSICHER_N = 3

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
  if (pct >= 62) return 'Hoch'
  if (pct >= 52) return 'Mittel'
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
 * Schätzung ohne Backtest — breite Spanne (~30–72 %), damit Setups unterscheidbar bleiben.
 */
function berechneHeuristikTrefferPct(e: MomentumScanEintrag): number {
  const total = e.gatesPassed.length + e.gatesFailed.length
  const gateRatio = total > 0 ? e.gatesPassed.length / total : 0.5
  let pct = 26 + gateRatio * 24 + (e.score - 42) * 0.62
  if (e.ampel === 'gruen') pct += 5
  else if (e.ampel === 'gelb') pct += 1
  else pct -= 10
  pct -= e.gatesFailed.length * 5
  const rr = berechneRewardRisk(e)
  if (rr != null) {
    if (rr >= 2.2) pct += 4
    else if (rr < 1.35) pct -= 7
  }
  return rundeTrefferPct(pct)
}

/**
 * Setup-spezifische Abweichung vom Playbook-Backtest (−22 … +22).
 * Score, Gates, Ampel, R/R, RVOL und Gap unterscheiden Signale desselben Playbooks.
 */
function berechneSetupTrefferDelta(e: MomentumScanEintrag): number {
  const total = e.gatesPassed.length + e.gatesFailed.length
  const gateRatio = total > 0 ? e.gatesPassed.length / total : 0.5
  let delta = (gateRatio - 1) * 28
  delta += (e.score - 62) * 0.42
  if (e.ampel === 'gruen') delta += 5
  else if (e.ampel === 'gelb') delta -= 2
  else delta -= 11
  delta -= e.gatesFailed.length * 4.5

  const rvol = alsZahl(e.indikatoren.rvol, -1)
  if (rvol >= 0) {
    if (rvol >= 2.5) delta += 4
    else if (rvol >= 1.8) delta += 2
    else if (rvol < 1.2) delta -= 5
  }

  const gap = alsZahl(e.indikatoren.gapPct, 0)
  if (gap !== 0) {
    const g = Math.abs(gap)
    if (g >= 8) delta += 4
    else if (g >= 5) delta += 2
    else if (g < 3) delta -= 3
  }

  const rr = berechneRewardRisk(e)
  if (rr != null) {
    if (rr >= 2.5) delta += 5
    else if (rr >= 2) delta += 2
    else if (rr < 1.35) delta -= 9
  }

  const rs = alsZahl(e.indikatoren.rsVsSpy20d, 0)
  const r = e.indikatoren.richtung
  if (r === 'long' && rs >= 8) delta += 3
  else if (r === 'short' && rs <= -8) delta += 3
  else if (r === 'long' && rs < 0) delta -= 4
  else if (r === 'short' && rs > 0) delta -= 4

  return Math.max(-SETUP_DELTA_MAX, Math.min(SETUP_DELTA_MAX, Math.round(delta)))
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
 * Trefferwahrscheinlichkeit = Playbook-Backtest (Anker) + setup-spezifische Anpassung.
 * Gleiches Playbook, unterschiedliche Gates/Score → unterschiedliche %.
 */
function berechneTrefferWahrscheinlichkeit(
  e: MomentumScanEintrag,
  lookup: MomentumPlaybookStatsLookup | null,
): { pct: number; stat: ReturnType<typeof findePlaybookStat>; basisText: string | null } {
  const stat = findePlaybookStat(lookup, e.playbook, e.symbol)
  const heuristik = berechneHeuristikTrefferPct(e)
  const delta = berechneSetupTrefferDelta(e)

  if (!stat || stat.trefferPct == null) {
    const pct = rundeTrefferPct(heuristik)
    return {
      pct,
      stat: null,
      basisText: 'Kein Backtest — Schätzung aus Gates/Score/RVOL/R/R → ' + pct + '%',
    }
  }

  const hist = stat.trefferPct
  const n = stat.sampleSize
  const symbolStat = Boolean(stat.symbol && n >= BACKTEST_MIN_SAMPLES_SYMBOL)
  const setupDelta = delta

  let pct: number
  let basisText: string

  if (n < TREFFER_UNSICHER_N) {
    pct = heuristik * 0.55 + hist * 0.45 + setupDelta * 0.5
    pct = Math.min(pct, BACKTEST_LOW_CONFIDENCE_CAP_PCT)
    basisText =
      'Sehr wenig Daten (' +
      n +
      '×): Backtest ' +
      hist +
      '% gemischt mit Schätzung ' +
      heuristik +
      '%'
  } else if (n < BACKTEST_MIN_SAMPLES_GLOBAL) {
    const w = shrinkageGewicht(n, BACKTEST_MIN_SAMPLES_GLOBAL * 2)
    const ank = PRIOR_TREFFER_PCT * (1 - w) + hist * w
    pct = ank + setupDelta * 0.85
    pct = Math.min(pct, BACKTEST_LOW_CONFIDENCE_CAP_PCT + 4)
    basisText =
      'Backtest ' +
      hist +
      '% (' +
      stat.wins +
      '/' +
      n +
      ') + Setup ' +
      (setupDelta >= 0 ? '+' : '') +
      setupDelta +
      '% → ' +
      rundeTrefferPct(pct) +
      '%'
  } else {
    pct = hist + setupDelta
    if (symbolStat) {
      basisText =
        hist +
        '% ' +
        e.symbol +
        ' (' +
        stat.wins +
        '/' +
        n +
        ') + Setup ' +
        (setupDelta >= 0 ? '+' : '') +
        setupDelta +
        '% = ' +
        rundeTrefferPct(pct) +
        '%'
    } else {
      basisText =
        hist +
        '% Playbook (' +
        stat.wins +
        '/' +
        n +
        ') + Setup ' +
        (setupDelta >= 0 ? '+' : '') +
        setupDelta +
        '% = ' +
        rundeTrefferPct(pct) +
        '%'
    }
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
