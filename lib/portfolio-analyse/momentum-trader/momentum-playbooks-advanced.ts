/**
 * Erweiterte Playbooks — Insider-Cluster, Short-Squeeze.
 */

import 'server-only'

import { tageZwischenIso } from '@/lib/portfolio-analyse/dividenden-datum-hilfen'
import { findeInsiderCluster } from '@/lib/portfolio-analyse/momentum-trader/momentum-insider-server'
import {
  DAILY_RVOL_MIN,
  EARNINGS_GAP_EXCLUDE_TAGE,
  RS_MIN_LONG_PCT,
  SHORT_SQUEEZE_MAX_RSI,
  SHORT_SQUEEZE_MIN_FLOAT_PCT,
  SHORT_SQUEEZE_MIN_GAP_PCT,
  SHORT_SQUEEZE_MIN_RVOL,
} from '@/lib/portfolio-analyse/momentum-trader/momentum-constants'
import {
  baueScanEintrag,
  pruefeRegimeRichtung,
  scoreAusGates,
} from '@/lib/portfolio-analyse/momentum-trader/momentum-playbook-hilfen'
import type {
  MomentumBarDaily,
  MomentumEarningsKalenderEintrag,
  MomentumInsiderKauf,
  MomentumRegimeGates,
  MomentumRichtung,
  MomentumScanEintrag,
  MomentumTechSnapshot,
} from '@/lib/portfolio-analyse/momentum-trader/momentum-trader-types'

function hatEarningsInNaehe(
  symbol: string,
  handelstag: string,
  kalender: MomentumEarningsKalenderEintrag[],
): boolean {
  return kalender.some((k) => {
    if (k.symbol !== symbol) return false
    return Math.abs(tageZwischenIso(k.earningsDate, handelstag)) <= EARNINGS_GAP_EXCLUDE_TAGE
  })
}

export function bewerteInsiderCluster(
  tech: MomentumTechSnapshot,
  bars: MomentumBarDaily[],
  regimeGates: MomentumRegimeGates,
  kalender: MomentumEarningsKalenderEintrag[],
  kauefe: MomentumInsiderKauf[],
): MomentumScanEintrag | null {
  if (hatEarningsInNaehe(tech.symbol, tech.handelstag, kalender)) return null

  const cluster = findeInsiderCluster(kauefe)
  if (!cluster) return null

  const gatesPassed: string[] = []
  const gatesFailed: string[] = []

  gatesPassed.push(
    cluster.kaufAnzahl +
      ' Käufe von ' +
      cluster.insiderAnzahl +
      ' Insidern (' +
      cluster.fensterTage +
      'T)',
  )
  if (cluster.gesamtWertUsd != null) {
    gatesPassed.push('Gesamtwert ~$' + Math.round(cluster.gesamtWertUsd / 1000) + 'k')
  }
  gatesPassed.push('Letzter Kauf: ' + cluster.letzterKauf)

  if (tech.aboveMa20) gatesPassed.push('Kurs über MA20')
  else gatesFailed.push('Unter MA20 — schwache Bestätigung')

  if (tech.rsVsSpy20d != null && tech.rsVsSpy20d >= RS_MIN_LONG_PCT) {
    gatesPassed.push('RS vs. S&P ' + tech.rsVsSpy20d + '%')
  } else {
    gatesFailed.push('RS vs. S&P schwach')
  }

  if (tech.rvol != null && tech.rvol >= DAILY_RVOL_MIN) {
    gatesPassed.push('RVOL ' + tech.rvol + '×')
  } else {
    gatesFailed.push('RVOL zu niedrig')
  }

  const richtung: MomentumRichtung = 'long'
  pruefeRegimeRichtung(richtung, regimeGates, gatesPassed, gatesFailed)

  let basis = 38
  if (cluster.insiderAnzahl >= 3) basis += 10
  if (cluster.kaufAnzahl >= 4) basis += 6
  const score = scoreAusGates(basis, gatesPassed, gatesFailed)
  if (score < 42) return null

  return baueScanEintrag({
    scanDate: tech.scanDate,
    symbol: tech.symbol,
    playbook: 'insider_cluster',
    score,
    gatesPassed,
    gatesFailed,
    bars,
    bar: bars[bars.length - 1],
    tech,
    atr: tech.atr,
    richtung,
    indikatoren: {
      insiderKaufAnzahl: cluster.kaufAnzahl,
      insiderAnzahl: cluster.insiderAnzahl,
      insiderGesamtWertUsd: cluster.gesamtWertUsd,
      insiderLetzterKauf: cluster.letzterKauf,
      rsVsSpy20d: tech.rsVsSpy20d,
      rvol: tech.rvol,
      katalysator: 'insider',
      setupPhase: 'jetzt',
    },
  })
}

export function bewerteShortSqueezeSetup(
  tech: MomentumTechSnapshot,
  bars: MomentumBarDaily[],
  regimeGates: MomentumRegimeGates,
  kalender: MomentumEarningsKalenderEintrag[],
): MomentumScanEintrag | null {
  if (hatEarningsInNaehe(tech.symbol, tech.handelstag, kalender)) return null

  const gatesPassed: string[] = []
  const gatesFailed: string[] = []
  const sf = tech.shortFloatPct

  if (sf == null) {
    gatesFailed.push('Short Float unbekannt (Finviz)')
    return null
  }
  if (sf >= SHORT_SQUEEZE_MIN_FLOAT_PCT) {
    gatesPassed.push('Short Float ≥ ' + SHORT_SQUEEZE_MIN_FLOAT_PCT + '% (' + sf + '%)')
  } else {
    gatesFailed.push('Short Float zu niedrig (' + sf + '%)')
    return null
  }

  if (tech.rvol != null && tech.rvol >= SHORT_SQUEEZE_MIN_RVOL) {
    gatesPassed.push('RVOL ≥ ' + SHORT_SQUEEZE_MIN_RVOL + ' (' + tech.rvol + '×)')
  } else {
    gatesFailed.push('RVOL zu niedrig für Squeeze')
    return null
  }

  const gap = tech.gapPct
  const breakout =
    (gap != null && gap >= SHORT_SQUEEZE_MIN_GAP_PCT) ||
    (tech.aboveMa20 && tech.high20d != null && tech.close >= tech.high20d * 0.995)

  if (breakout) {
    if (gap != null && gap >= SHORT_SQUEEZE_MIN_GAP_PCT) {
      gatesPassed.push('Gap-Up ' + gap + '% (Short-Deckung unter Druck)')
    } else {
      gatesPassed.push('Ausbruch über 20T-Hoch / MA20')
    }
  } else {
    gatesFailed.push('Kein Volumen-Ausbruch sichtbar')
    return null
  }

  if (tech.rsi14 != null && tech.rsi14 <= SHORT_SQUEEZE_MAX_RSI) {
    gatesPassed.push('RSI ' + tech.rsi14 + ' (nicht überdehnt)')
  } else if (tech.rsi14 != null) {
    gatesFailed.push('RSI zu hoch (' + tech.rsi14 + ') — Squeeze evtl. ausgereizt')
  }

  if (tech.return20dPct != null && tech.return20dPct >= -8) {
    gatesPassed.push('20T-Lauf ' + tech.return20dPct + '%')
  } else {
    gatesFailed.push('Starker Abwärtstrend — Squeeze-Risiko')
  }

  const richtung: MomentumRichtung = 'long'
  pruefeRegimeRichtung(richtung, regimeGates, gatesPassed, gatesFailed)

  let basis = 36
  if (sf >= 20) basis += 8
  if (tech.rvol != null && tech.rvol >= 3) basis += 8
  if (gap != null && gap >= 3) basis += 6
  const score = scoreAusGates(basis, gatesPassed, gatesFailed)
  if (score < 44) return null

  return baueScanEintrag({
    scanDate: tech.scanDate,
    symbol: tech.symbol,
    playbook: 'short_squeeze_setup',
    score,
    gatesPassed,
    gatesFailed,
    bars,
    bar: bars[bars.length - 1],
    tech,
    atr: tech.atr,
    richtung,
    indikatoren: {
      shortFloatPct: sf,
      gapPct: gap,
      rvol: tech.rvol,
      rsi14: tech.rsi14,
      return20dPct: tech.return20dPct,
      katalysator: 'short_squeeze',
      setupPhase: 'jetzt',
    },
  })
}

export function bewerteErweitertePlaybooks(input: {
  tech: MomentumTechSnapshot
  bars: MomentumBarDaily[]
  regimeGates: MomentumRegimeGates
  kalender: MomentumEarningsKalenderEintrag[]
  insiderKauefe: MomentumInsiderKauf[]
}): MomentumScanEintrag[] {
  const out: MomentumScanEintrag[] = []
  for (const e of [
    bewerteInsiderCluster(
      input.tech,
      input.bars,
      input.regimeGates,
      input.kalender,
      input.insiderKauefe,
    ),
    bewerteShortSqueezeSetup(input.tech, input.bars, input.regimeGates, input.kalender),
  ]) {
    if (e && (e.ampel === 'gruen' || e.ampel === 'gelb')) out.push(e)
  }
  return out
}
