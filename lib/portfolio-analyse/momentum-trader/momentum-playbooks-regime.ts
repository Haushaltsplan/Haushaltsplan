/**
 * Regime-Playbooks — Sektor-Rotation, Market Regime Long/Short.
 */

import 'server-only'

import {
  REGIME_BREADTH_MIN_PCT,
  REGIME_LONG_VIX_MAX,
  REGIME_SHORT_VIX_MIN,
  RS_MIN_LONG_PCT,
  RS_MAX_SHORT_PCT,
  SECTOR_ROTATION_MIN_RETURN_5D,
  SECTOR_ROTATION_MIN_RS,
} from '@/lib/portfolio-analyse/momentum-trader/momentum-constants'
import {
  baueScanEintrag,
  pruefeRegimeRichtung,
  scoreAusGates,
} from '@/lib/portfolio-analyse/momentum-trader/momentum-playbook-hilfen'
import type {
  MomentumBarDaily,
  MomentumRegimeGates,
  MomentumRegimeKontext,
  MomentumRichtung,
  MomentumScanEintrag,
  MomentumTechSnapshot,
} from '@/lib/portfolio-analyse/momentum-trader/momentum-trader-types'

function bewerteSectorRotationLong(
  tech: MomentumTechSnapshot,
  bars: MomentumBarDaily[],
  regimeGates: MomentumRegimeGates,
  sectorEtf: string | null,
  rk: MomentumRegimeKontext,
): MomentumScanEintrag | null {
  if (!sectorEtf) return null

  const gatesPassed: string[] = []
  const gatesFailed: string[] = []

  const secRet = rk.sectorReturn5d[sectorEtf]
  if (secRet != null && secRet >= SECTOR_ROTATION_MIN_RETURN_5D) {
    gatesPassed.push('Sektor-ETF ' + sectorEtf + ' +5T ' + secRet + '%')
  } else {
    gatesFailed.push('Sektor schwach (' + sectorEtf + ': ' + secRet + '%)')
  }

  if (tech.rsVsSector20d != null && tech.rsVsSector20d >= SECTOR_ROTATION_MIN_RS) {
    gatesPassed.push('Führt im Sektor (RS ' + tech.rsVsSector20d + '%)')
  } else {
    gatesFailed.push('Kein Sektor-Leadership (' + tech.rsVsSector20d + '%)')
  }

  if (tech.aboveMa20) gatesPassed.push('Über MA20')
  else gatesFailed.push('Unter MA20')

  const richtung: MomentumRichtung = 'long'
  pruefeRegimeRichtung(richtung, regimeGates, gatesPassed, gatesFailed)

  let basis = 40
  if (secRet != null) basis += Math.min(15, secRet * 3)
  if (tech.rsVsSector20d != null) basis += Math.min(12, tech.rsVsSector20d * 2)
  const score = scoreAusGates(basis, gatesPassed, gatesFailed)
  if (score < 42) return null

  return baueScanEintrag({
    scanDate: tech.scanDate,
    symbol: tech.symbol,
    playbook: 'sector_rotation_long',
    score,
    gatesPassed,
    gatesFailed,
    bars,
    bar: bars[bars.length - 1],
    tech,
    atr: tech.atr,
    richtung,
    indikatoren: {
      sectorEtf,
      sectorReturn5dPct: secRet ?? null,
      rsVsSector20d: tech.rsVsSector20d,
      setupPhase: 'jetzt',
    },
  })
}

function bewerteMarketRegimeLong(
  tech: MomentumTechSnapshot,
  bars: MomentumBarDaily[],
  regimeGates: MomentumRegimeGates,
  rk: MomentumRegimeKontext,
): MomentumScanEintrag | null {
  const gatesPassed: string[] = []
  const gatesFailed: string[] = []
  const regime = regimeGates.regime
  const vix = regime.vixClose ?? 99

  if (regime.spyAbove20Ma) gatesPassed.push('SPY über MA20')
  else gatesFailed.push('SPY unter MA20')

  if (vix < REGIME_LONG_VIX_MAX) gatesPassed.push('VIX < ' + REGIME_LONG_VIX_MAX + ' (' + vix + ')')
  else gatesFailed.push('VIX zu hoch für Regime-Long (' + vix + ')')

  if (rk.watchlistBreadthPct != null && rk.watchlistBreadthPct >= REGIME_BREADTH_MIN_PCT) {
    gatesPassed.push('Watchlist-Breadth ≥ ' + REGIME_BREADTH_MIN_PCT + '% (' + rk.watchlistBreadthPct + '%)')
  } else {
    gatesFailed.push('Breadth zu schwach (' + rk.watchlistBreadthPct + '%)')
  }

  if (tech.rsVsSpy20d != null && tech.rsVsSpy20d >= RS_MIN_LONG_PCT) {
    gatesPassed.push('RS vs. S&P positiv (' + tech.rsVsSpy20d + '%)')
  } else {
    gatesFailed.push('RS vs. S&P zu schwach')
  }

  const richtung: MomentumRichtung = 'long'
  pruefeRegimeRichtung(richtung, regimeGates, gatesPassed, gatesFailed)

  let basis = 42
  if (rk.watchlistBreadthPct != null) basis += Math.min(10, (rk.watchlistBreadthPct - 50) * 0.2)
  const score = scoreAusGates(basis, gatesPassed, gatesFailed)
  if (score < 45) return null

  return baueScanEintrag({
    scanDate: tech.scanDate,
    symbol: tech.symbol,
    playbook: 'market_regime_long',
    score,
    gatesPassed,
    gatesFailed,
    bars,
    bar: bars[bars.length - 1],
    tech,
    atr: tech.atr,
    richtung,
    indikatoren: {
      watchlistBreadthPct: rk.watchlistBreadthPct,
      rsVsSpy20d: tech.rsVsSpy20d,
      vixClose: vix,
      setupPhase: 'jetzt',
    },
  })
}

function bewerteMarketRegimeShort(
  tech: MomentumTechSnapshot,
  bars: MomentumBarDaily[],
  regimeGates: MomentumRegimeGates,
): MomentumScanEintrag | null {
  const gatesPassed: string[] = []
  const gatesFailed: string[] = []
  const regime = regimeGates.regime
  const vix = regime.vixClose ?? 0

  const riskOff = regime.spyAbove20Ma === false || vix >= REGIME_SHORT_VIX_MIN
  if (riskOff) {
    gatesPassed.push(
      regime.spyAbove20Ma === false
        ? 'SPY unter MA20 (Risk-off)'
        : 'VIX ≥ ' + REGIME_SHORT_VIX_MIN + ' (' + vix + ')',
    )
  } else {
    gatesFailed.push('Kein klares Risk-off-Regime')
  }

  if (tech.rsVsSpy20d != null && tech.rsVsSpy20d <= RS_MAX_SHORT_PCT - 2) {
    gatesPassed.push('RS vs. S&P schwach (' + tech.rsVsSpy20d + '%)')
  } else {
    gatesFailed.push('RS nicht schwach genug (' + tech.rsVsSpy20d + '%)')
  }

  if (!tech.aboveMa20) gatesPassed.push('Unter MA20')
  else gatesFailed.push('Noch über MA20 — Trend nicht bestätigt')

  const richtung: MomentumRichtung = 'short'
  pruefeRegimeRichtung(richtung, regimeGates, gatesPassed, gatesFailed)

  let basis = 40
  if (vix >= REGIME_SHORT_VIX_MIN) basis += Math.min(12, (vix - REGIME_SHORT_VIX_MIN) * 1.5)
  const score = scoreAusGates(basis, gatesPassed, gatesFailed)
  if (score < 42) return null

  return baueScanEintrag({
    scanDate: tech.scanDate,
    symbol: tech.symbol,
    playbook: 'market_regime_short',
    score,
    gatesPassed,
    gatesFailed,
    bars,
    bar: bars[bars.length - 1],
    tech,
    atr: tech.atr,
    richtung,
    indikatoren: {
      rsVsSpy20d: tech.rsVsSpy20d,
      vixClose: vix,
      spyAbove20Ma: regime.spyAbove20Ma,
      setupPhase: 'jetzt',
    },
  })
}

/** Regime-Playbooks für ein Symbol. */
export function bewerteRegimePlaybooks(
  tech: MomentumTechSnapshot,
  bars: MomentumBarDaily[],
  regimeGates: MomentumRegimeGates,
  sectorEtf: string | null,
  rk: MomentumRegimeKontext,
): MomentumScanEintrag[] {
  const out: MomentumScanEintrag[] = []
  for (const e of [
    bewerteSectorRotationLong(tech, bars, regimeGates, sectorEtf, rk),
    bewerteMarketRegimeLong(tech, bars, regimeGates, rk),
    bewerteMarketRegimeShort(tech, bars, regimeGates),
  ]) {
    if (e && (e.ampel === 'gruen' || e.ampel === 'gelb')) out.push(e)
  }
  return out
}
