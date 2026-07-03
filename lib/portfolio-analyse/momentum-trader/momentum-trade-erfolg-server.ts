import 'server-only'

import {
  BACKTEST_LOW_CONFIDENCE_CAP_PCT,
  BACKTEST_MIN_SAMPLES_GLOBAL,
  BACKTEST_MIN_SAMPLES_SYMBOL,
  PLAYBOOK_HARD_BLOCK_TREFFER_PCT,
  momentumPlaybookLabel,
} from '@/lib/portfolio-analyse/momentum-trader/momentum-constants'
import {
  findePlaybookStat,
  type MomentumPlaybookStatsLookup,
} from '@/lib/portfolio-analyse/momentum-trader/momentum-playbook-stats-server'
import { bewerteTradeQualitaet } from '@/lib/portfolio-analyse/momentum-trader/momentum-trade-qualitaet-server'
import {
  MOMENTUM_PRE_EVENT_PLAYBOOKS,
  MOMENTUM_TRADE_PLAYBOOKS,
} from '@/lib/portfolio-analyse/momentum-trader/momentum-playbook-registry'
import type {
  MomentumPlaybook,
  MomentumRegimeGates,
  MomentumRichtung,
  MomentumScanEintrag,
} from '@/lib/portfolio-analyse/momentum-trader/momentum-trader-types'

const TRADE_PLAYBOOKS = new Set<MomentumPlaybook>(MOMENTUM_TRADE_PLAYBOOKS)
const PRE_EVENT_PLAYBOOKS = new Set<MomentumPlaybook>(MOMENTUM_PRE_EVENT_PLAYBOOKS)

export function klemmeErfolgWahrscheinlichkeit(n: number): number {
  return Math.min(88, Math.max(30, Math.round(n)))
}

function alsZahl(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback
}

function richtungWort(r: MomentumRichtung): string {
  return r === 'long' ? 'LONG' : 'SHORT'
}

function erfolgLabel(pct: number): string {
  if (pct >= 70) return 'Hoch'
  if (pct >= 58) return 'Mittel'
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
      wahrscheinlichkeitPct: klemmeErfolgWahrscheinlichkeit((wShort / sum) * 100),
      label: 'Gap-Fade Short (Beat + Gap-Up)',
    },
    {
      richtung: 'long' as const,
      wahrscheinlichkeitPct: klemmeErfolgWahrscheinlichkeit((wLongMom / sum) * 100),
      label: 'Momentum Long (Beat + Stärke)',
    },
    {
      richtung: 'long' as const,
      wahrscheinlichkeitPct: klemmeErfolgWahrscheinlichkeit((wLongFade / sum) * 100),
      label: 'Gap-Fade Long (Miss + Gap-Down)',
    },
  ].sort((a, b) => b.wahrscheinlichkeitPct - a.wahrscheinlichkeitPct)
}

function berechneAktiv(e: MomentumScanEintrag): { pct: number; richtung: MomentumRichtung | null } {
  const r = e.indikatoren.richtung
  if (r !== 'long' && r !== 'short') return { pct: 35, richtung: null }

  const total = e.gatesPassed.length + e.gatesFailed.length
  const gateRatio = total > 0 ? e.gatesPassed.length / total : 0.5

  let pct = e.score * 0.42 + gateRatio * 100 * 0.38
  if (e.ampel === 'gruen') pct += 10
  else if (e.ampel === 'gelb') pct -= 4
  else if (e.ampel === 'rot') pct -= 28

  const entry = alsZahl(e.indikatoren.entryPrice, 0)
  const stop = alsZahl(e.indikatoren.stopPrice, 0)
  const target = alsZahl(e.indikatoren.targetPrice, 0)
  if (entry > 0 && stop > 0 && target > 0) {
    const risk = Math.abs(entry - stop)
    const reward = Math.abs(target - entry)
    if (risk > 0) {
      const rr = reward / risk
      if (rr >= 2) pct += 6
      else if (rr >= 1.5) pct += 3
      else if (rr < 1) pct -= 8
    }
  }

  const rvol = alsZahl(e.indikatoren.rvol, 0)
  if (rvol >= 2.5) pct += 5
  else if (rvol >= 1.8) pct += 2

  const surprise = alsZahl(e.indikatoren.surpriseEpsPct, NaN)
  if (Number.isFinite(surprise)) {
    if (r === 'long' && surprise > 0) pct += 3
    if (r === 'short' && surprise > 5) pct += 4
  }

  const rs = alsZahl(e.indikatoren.rsVsSpy20d, NaN)
  if (Number.isFinite(rs)) {
    if (r === 'long' && rs >= 2) pct += 3
    if (r === 'short' && rs <= -2) pct += 3
  }

  if (e.playbook === 'earnings_pre_run') pct -= 8
  if (e.playbook === 'gap_fade' || e.playbook === 'gap_and_go') {
    if (e.ampel === 'gruen') pct += 4
  }
  if (e.playbook === 'volume_spike_breakout' || e.playbook === 'trend_breakout') {
    const rs = alsZahl(e.indikatoren.rsVsSpy20d, NaN)
    if (Number.isFinite(rs) && rs >= 3) pct += 4
  }
  if (e.playbook === 'relative_strength_leader') {
    const rs = alsZahl(e.indikatoren.rsVsSpy20d, 0)
    if (rs >= 8) pct += 5
  }
  if (e.playbook === 'oversold_bounce' || e.playbook === 'range_fade') {
    if (e.ampel === 'gruen') pct += 3
  }
  if (e.playbook === 'overbought_fade') {
    const sf = alsZahl(e.indikatoren.shortFloatPct, 0)
    if (sf >= 15) pct -= 6
    else if (e.ampel === 'gruen') pct += 3
  }
  if (e.playbook === 'news_gap' || e.playbook === 'analyst_upgrade') {
    if (e.ampel === 'gruen') pct += 4
  }
  if (e.playbook === 'earnings_post_run' || e.playbook === 'guidance_shock') {
    if (e.ampel === 'gruen') pct += 5
  }
  if (e.playbook === 'revenue_beat_divergence') {
    const rev = alsZahl(e.indikatoren.surpriseRevPct, 0)
    if (rev <= -5) pct += 4
  }
  if (e.playbook === 'insider_cluster') {
    const insider = alsZahl(e.indikatoren.insiderAnzahl, 0)
    if (insider >= 3) pct += 5
    else if (e.ampel === 'gruen') pct += 3
  }
  if (e.playbook === 'short_squeeze_setup') {
    const sf = alsZahl(e.indikatoren.shortFloatPct, 0)
    if (sf >= 20) pct += 4
    if (e.ampel === 'gruen') pct += 4
  }
  if (
    e.playbook === 'nr7_breakout' ||
    e.playbook === 'inside_day_breakout' ||
    e.playbook === 'ma_cross_momentum'
  ) {
    if (e.ampel === 'gruen') pct += 3
  }
  if (e.playbook === 'failed_breakout' || e.playbook === 'trend_exhaustion') {
    if (e.ampel === 'gruen') pct += 3
  }
  if (e.playbook === 'capitulation_bounce' || e.playbook === 'vix_spike_fade') {
    if (e.ampel === 'gruen') pct += 4
  }
  if (e.playbook === 'sector_rotation_long' || e.playbook === 'market_regime_long') {
    const breadth = alsZahl(e.indikatoren.watchlistBreadthPct, NaN)
    if (Number.isFinite(breadth) && breadth >= 55) pct += 4
  }
  if (e.gatesFailed.length > 0) pct -= Math.min(22, e.gatesFailed.length * 6)

  return { pct: klemmeErfolgWahrscheinlichkeit(pct), richtung: r }
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
  if (!top) return { pct: 40, richtung: null, szenario: '' }

  const datenQualitaet = 0.45 + Math.min(0.35, e.score / 220)
  let pct = top.wahrscheinlichkeitPct * datenQualitaet + e.score * 0.12

  if (e.playbook === 'earnings_pre_run' && e.ampel !== 'grau') {
    const aktiv = berechneAktiv(e)
    pct = pct * 0.55 + aktiv.pct * 0.45
  }

  const tage = alsZahl(e.indikatoren.tageBisEarnings, -1)
  if (tage === 0) pct += 4
  else if (tage > 7) pct -= 4

  return {
    pct: klemmeErfolgWahrscheinlichkeit(Math.min(78, pct)),
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
  backtestTrefferPct: number | null
  backtestStichprobe: number | null
  backtestHinweis: string | null
}

function kalibriereMitBacktest(
  heuristikPct: number,
  playbook: MomentumPlaybook,
  symbol: string,
  lookup: MomentumPlaybookStatsLookup | null,
): { pct: number; stat: ReturnType<typeof findePlaybookStat> } {
  const stat = findePlaybookStat(lookup, playbook, symbol)
  if (!stat || stat.trefferPct == null) {
    return { pct: heuristikPct, stat: null }
  }

  const hist = stat.trefferPct
  let pct: number
  if (stat.symbol && stat.sampleSize >= BACKTEST_MIN_SAMPLES_SYMBOL) {
    pct = heuristikPct * 0.32 + hist * 0.68
  } else if (stat.sampleSize >= 15) {
    pct = heuristikPct * 0.28 + hist * 0.72
  } else if (stat.sampleSize >= BACKTEST_MIN_SAMPLES_GLOBAL) {
    pct = heuristikPct * 0.38 + hist * 0.62
  } else {
    pct = heuristikPct * 0.55 + hist * 0.45
  }

  if (stat.sampleSize >= 10 && hist < PLAYBOOK_HARD_BLOCK_TREFFER_PCT) {
    pct = Math.min(pct, 42)
  } else if (stat.sampleSize < BACKTEST_MIN_SAMPLES_GLOBAL) {
    pct = Math.min(pct, BACKTEST_LOW_CONFIDENCE_CAP_PCT)
  } else if (hist < heuristikPct - 12) {
    pct = pct * 0.92
  }

  return { pct: klemmeErfolgWahrscheinlichkeit(pct), stat }
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
    backtestTrefferPct: null as number | null,
    backtestStichprobe: null as number | null,
    backtestHinweis: null as string | null,
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
        '% Erfolgschance'
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

  if (TRADE_PLAYBOOKS.has(e.playbook) && e.ampel !== 'grau' && e.ampel !== 'rot') {
    const aktiv = berechneAktiv(e)
    if (aktiv.richtung) {
      const kal = kalibriereMitBacktest(aktiv.pct, e.playbook, e.symbol, statsLookup)
      const hinweis = backtestHinweisText(kal.stat)
      const qual = bewerteTradeQualitaet(e, kal.pct, gates, kal.stat)
      const istAktiv = qual.qualifiziert
      let handlungKurz: string
      if (istAktiv) {
        handlungKurz =
          richtungWort(aktiv.richtung) +
          ' jetzt — ' +
          kal.pct +
          '% Erfolgschance' +
          (qual.erwartungswertR != null ? ' · EV +' + qual.erwartungswertR + 'R' : '') +
          ' · ' +
          pbLabel
      } else if (qual.blockiertGruende.length > 0) {
        handlungKurz = 'Beobachten — ' + qual.blockiertGruende[0] + ' · ' + pbLabel
      } else {
        handlungKurz = 'Beobachten — Qualitätsfilter · ' + pbLabel
      }
      return {
        pct: kal.pct,
        label: erfolgLabel(kal.pct),
        richtung: aktiv.richtung,
        istAktiv,
        handlungKurz,
        backtestTrefferPct: kal.stat?.trefferPct ?? null,
        backtestStichprobe: kal.stat?.sampleSize ?? null,
        backtestHinweis: hinweis,
      }
    }
  }

  if (e.ampel === 'rot' || e.gatesFailed.length > e.gatesPassed.length) {
    const aktiv = klemmeErfolgWahrscheinlichkeit(32 + e.score * 0.15)
    const kal = kalibriereMitBacktest(aktiv, e.playbook, e.symbol, statsLookup)
    return {
      pct: kal.pct,
      label: 'Niedrig',
      richtung: (e.indikatoren.richtung as MomentumRichtung) ?? null,
      istAktiv: false,
      handlungKurz: 'Kein Trade — Setup noch nicht erfüllt',
      backtestTrefferPct: kal.stat?.trefferPct ?? null,
      backtestStichprobe: kal.stat?.sampleSize ?? null,
      backtestHinweis: backtestHinweisText(kal.stat),
    }
  }

  const aktiv = klemmeErfolgWahrscheinlichkeit(e.score * 0.65)
  const kal = kalibriereMitBacktest(aktiv, e.playbook, e.symbol, statsLookup)
  return {
    pct: kal.pct,
    label: erfolgLabel(kal.pct),
    richtung: (e.indikatoren.richtung as MomentumRichtung) ?? null,
    istAktiv: false,
    handlungKurz: 'Beobachten — ' + pbLabel,
    backtestTrefferPct: kal.stat?.trefferPct ?? null,
    backtestStichprobe: kal.stat?.sampleSize ?? null,
    backtestHinweis: backtestHinweisText(kal.stat),
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
        backtestTrefferPct: erfolg.backtestTrefferPct,
        backtestStichprobe: erfolg.backtestStichprobe,
        backtestHinweis: erfolg.backtestHinweis,
        tradeQualitaetOk: erfolg.istAktiv,
      },
    }
  })
}
