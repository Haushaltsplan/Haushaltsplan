/**
 * Strenge Trade-Qualitätsfilter — nur Setups mit positivem Erwartungswert werden „aktiv“.
 */

import 'server-only'

import {
  PLAYBOOK_HARD_BLOCK_TREFFER_PCT,
  PLAYBOOK_MIN_BACKTEST_TREFFER_PCT,
  TRADE_AKTIV_MIN_GATE_RATIO,
  TRADE_AKTIV_MIN_PCT,
  TRADE_AKTIV_MIN_SCORE,
  TRADE_ERWARTUNGSWERT_MIN_R,
  TRADE_GELB_MIN_PCT,
  TRADE_MIN_REWARD_RISK,
} from '@/lib/portfolio-analyse/momentum-trader/momentum-constants'
import type {
  MomentumPlaybook,
  MomentumPlaybookStat,
  MomentumRegimeGates,
  MomentumRichtung,
  MomentumScanEintrag,
} from '@/lib/portfolio-analyse/momentum-trader/momentum-trader-types'

const MR_LONG_OHNE_REGIME = new Set<MomentumPlaybook>([
  'oversold_bounce',
  'capitulation_bounce',
  'vix_spike_fade',
  'range_fade',
])

const MR_SHORT_OHNE_REGIME = new Set<MomentumPlaybook>([
  'overbought_fade',
  'failed_breakout',
  'trend_exhaustion',
  'relative_weakness_fade',
  'revenue_beat_divergence',
])

function alsZahl(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback
}

/** Reward/Risk aus Entry/Stop/Ziel. */
export function berechneRewardRisk(e: MomentumScanEintrag): number | null {
  const entry = alsZahl(e.indikatoren.entryPrice, 0)
  const stop = alsZahl(e.indikatoren.stopPrice, 0)
  const target = alsZahl(e.indikatoren.targetPrice, 0)
  if (entry <= 0 || stop <= 0 || target <= 0) return null
  const risk = Math.abs(entry - stop)
  const reward = Math.abs(target - entry)
  if (risk <= 0) return null
  return Math.round((reward / risk) * 100) / 100
}

/** Erwartungswert in R-Einheiten: p×RR − (1−p). */
export function berechneErwartungswertR(trefferPct: number, rewardRisk: number): number {
  const p = trefferPct / 100
  return Math.round((p * rewardRisk - (1 - p)) * 1000) / 1000
}

export type MomentumTradeQualitaet = {
  qualifiziert: boolean
  erwartungswertR: number | null
  rewardRisk: number | null
  blockiertGruende: string[]
}

function regimePasst(
  richtung: MomentumRichtung,
  playbook: MomentumPlaybook,
  gates: MomentumRegimeGates | null,
  e: MomentumScanEintrag,
): boolean {
  if (!gates) return true
  if (richtung === 'long') {
    if (gates.longBias) return true
    if (MR_LONG_OHNE_REGIME.has(playbook)) {
      const rsi = alsZahl(e.indikatoren.rsi14, 50)
      return rsi <= 32
    }
    return false
  }
  if (gates.shortBias) return true
  return MR_SHORT_OHNE_REGIME.has(playbook)
}

/** Prüft ob ein Setup die strenge Handels-Qualitätsstufe erreicht. */
export function bewerteTradeQualitaet(
  e: MomentumScanEintrag,
  kalibriertPct: number,
  gates: MomentumRegimeGates | null,
  stat: MomentumPlaybookStat | null,
): MomentumTradeQualitaet {
  const blockiert: string[] = []

  if (e.indikatoren.playbookDeaktiviert === true) {
    blockiert.push('Playbook pausiert (Backtest)')
  }

  const r = e.indikatoren.richtung
  if (r !== 'long' && r !== 'short') {
    blockiert.push('Keine Richtung')
    return { qualifiziert: false, erwartungswertR: null, rewardRisk: null, blockiertGruende: blockiert }
  }

  if (e.ampel === 'rot' || e.ampel === 'grau') {
    blockiert.push('Ampel ' + e.ampel)
  }

  const minPct = e.ampel === 'gelb' ? TRADE_GELB_MIN_PCT : TRADE_AKTIV_MIN_PCT
  if (kalibriertPct < minPct) {
    blockiert.push('Erfolgschance ' + kalibriertPct + '% < ' + minPct + '%')
  }

  if (e.score < TRADE_AKTIV_MIN_SCORE) {
    blockiert.push('Score ' + e.score + ' < ' + TRADE_AKTIV_MIN_SCORE)
  }

  const total = e.gatesPassed.length + e.gatesFailed.length
  const gateRatio = total > 0 ? e.gatesPassed.length / total : 0
  if (e.gatesFailed.length > 0 && gateRatio < TRADE_AKTIV_MIN_GATE_RATIO) {
    blockiert.push('Gates unvollständig (' + e.gatesFailed.length + ' offen)')
  }

  const rr = berechneRewardRisk(e)
  if (rr != null && rr < TRADE_MIN_REWARD_RISK) {
    blockiert.push('R/R ' + rr + ' < ' + TRADE_MIN_REWARD_RISK)
  }

  if (!regimePasst(r, e.playbook, gates, e)) {
    blockiert.push('Regime widerspricht ' + r.toUpperCase())
  }

  const trefferFuerEv = stat?.trefferPct ?? kalibriertPct
  const evR = rr != null ? berechneErwartungswertR(trefferFuerEv, rr) : null
  if (evR != null && evR < TRADE_ERWARTUNGSWERT_MIN_R) {
    blockiert.push('Erwartungswert ' + evR + 'R zu niedrig')
  }

  if (stat && stat.sampleSize >= 10 && stat.trefferPct != null) {
    if (stat.trefferPct < PLAYBOOK_HARD_BLOCK_TREFFER_PCT) {
      blockiert.push('Backtest ' + stat.trefferPct + '% (hart blockiert)')
    } else if (stat.trefferPct < PLAYBOOK_MIN_BACKTEST_TREFFER_PCT) {
      blockiert.push('Backtest ' + stat.trefferPct + '% unter Minimum')
    }
  }

  return {
    qualifiziert: blockiert.length === 0,
    erwartungswertR: evR,
    rewardRisk: rr,
    blockiertGruende: blockiert,
  }
}
