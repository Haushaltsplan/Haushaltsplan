/**
 * Gemeinsame Hilfen für alle Playbook-Bewerter.
 */

import { momentumPlaybookLabel } from '@/lib/portfolio-analyse/momentum-trader/momentum-constants'
import { berechnePositionsVorschlag } from '@/lib/portfolio-analyse/momentum-trader/momentum-position-sizing'
import { cfdIndikatorenAusLevels } from '@/lib/portfolio-analyse/momentum-trader/momentum-cfd-planung-server'
import type {
  MomentumAmpel,
  MomentumBarDaily,
  MomentumPlaybook,
  MomentumRegimeGates,
  MomentumRichtung,
  MomentumScanEintrag,
} from '@/lib/portfolio-analyse/momentum-trader/momentum-trader-types'

export function ampelAusScore(score: number, gatesFailed: string[], kritisch = false): MomentumAmpel {
  if (kritisch || gatesFailed.some((g) => g.startsWith('Keine Kursdaten'))) return 'grau'
  if (score >= 72 && gatesFailed.length === 0) return 'gruen'
  if (score >= 48) return 'gelb'
  return 'rot'
}

export function pruefeRegimeRichtung(
  richtung: MomentumRichtung | null,
  regimeGates: MomentumRegimeGates,
  gatesPassed: string[],
  gatesFailed: string[],
): void {
  if (richtung === 'short') {
    if (regimeGates.shortBias) gatesPassed.push('Regime: Short-Bias')
    else gatesFailed.push('Regime: kein Short-Bias')
  } else if (richtung === 'long') {
    if (regimeGates.longBias) gatesPassed.push('Regime: Long-Bias')
    else gatesFailed.push('Regime: kein Long-Bias')
  }
}

export function baueScanEintrag(input: {
  scanDate: string
  symbol: string
  playbook: MomentumPlaybook
  score: number
  gatesPassed: string[]
  gatesFailed: string[]
  indikatoren: Record<string, number | string | boolean | null>
  bar?: MomentumBarDaily
  atr?: number | null
  richtung?: MomentumRichtung | null
  entryPrice?: number | null
  kritisch?: boolean
}): MomentumScanEintrag {
  const richtung = input.richtung ?? null
  const bar = input.bar
  const atr = input.atr ?? null
  const entry =
    input.entryPrice ??
    (bar != null ? (richtung === 'long' ? bar.close : bar.open) : null)
  const pos =
    richtung && atr != null && entry != null
      ? berechnePositionsVorschlag(entry, atr, richtung)
      : null
  const cfd =
    pos != null
      ? cfdIndikatorenAusLevels(pos.entryPrice, pos.stopPrice, pos.targetPrice)
      : cfdIndikatorenAusLevels(null, null, null)

  return {
    scanDate: input.scanDate,
    symbol: input.symbol,
    playbook: input.playbook,
    score: input.score,
    ampel: ampelAusScore(input.score, input.gatesFailed, input.kritisch),
    gatesPassed: input.gatesPassed,
    gatesFailed: input.gatesFailed,
    indikatoren: {
      playbookLabel: momentumPlaybookLabel(input.playbook),
      ...input.indikatoren,
      richtung,
      handelstag: bar?.handelstag ?? null,
      entryPrice: pos?.entryPrice ?? entry,
      stopPrice: pos?.stopPrice ?? null,
      targetPrice: pos?.targetPrice ?? null,
      stopAbstandPct: pos?.stopAbstandPct ?? null,
      ...cfd,
      atr,
    },
  }
}

export function scoreAusGates(
  basis: number,
  gatesPassed: string[],
  gatesFailed: string[],
  bonus = 20,
): number {
  let score = basis
  if (gatesFailed.length === 0) score += bonus
  score += Math.min(10, gatesPassed.length * 2)
  score -= Math.min(25, gatesFailed.length * 6)
  return Math.min(100, Math.max(0, Math.round(score)))
}
