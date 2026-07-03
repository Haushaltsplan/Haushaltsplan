import 'server-only'

import { momentumPlaybookLabel, PLAYBOOK_MIN_BACKTEST_TREFFER_PCT } from '@/lib/portfolio-analyse/momentum-trader/momentum-constants'
import { MOMENTUM_TRADE_PLAYBOOKS } from '@/lib/portfolio-analyse/momentum-trader/momentum-playbook-registry'
import type {
  MomentumEarningsKalenderMonat,
  MomentumErinnerung,
  MomentumKatalysatorTracking,
  MomentumMarketRegime,
  MomentumPerformance,
  MomentumPlaybookStatsPaket,
  MomentumRegimeGates,
  MomentumScanEintrag,
  MomentumTrade,
  MomentumWatchlistEintragAngereichert,
} from '@/lib/portfolio-analyse/momentum-trader/momentum-trader-types'

export type MomentumBriefingInput = {
  scanDate: string
  regime: MomentumRegimeGates | MomentumMarketRegime | null
  ergebnisse: MomentumScanEintrag[]
  erinnerungen: MomentumErinnerung[]
  watchlist: MomentumWatchlistEintragAngereichert[]
  kalender: MomentumEarningsKalenderMonat
  trades: MomentumTrade[]
  performance: MomentumPerformance | null
  tracking?: MomentumKatalysatorTracking | null
  playbookStats?: MomentumPlaybookStatsPaket | null
}

/** Tages-Briefing als Markdown (Copy/PDF-Vorlage). */
export function generiereMomentumBriefing(input: MomentumBriefingInput): string {
  const lines: string[] = []
  lines.push('# Momentum Trader — Briefing ' + input.scanDate)
  lines.push('')

  const regime = input.regime && 'regime' in input.regime ? input.regime.regime : input.regime
  if (regime) {
    lines.push('## Markt-Regime')
    lines.push('- S&P 500: ' + (regime.spyClose?.toLocaleString('de-DE') ?? '—'))
    lines.push('- vs. MA20: ' + (regime.spyAbove20Ma ? 'darüber' : 'darunter'))
    if ('spyReturn5dPct' in regime && regime.spyReturn5dPct != null) {
      lines.push('- SPY 5T: ' + regime.spyReturn5dPct + '%')
    }
    lines.push('- VIX: ' + (regime.vixClose?.toFixed(2) ?? '—'))
    lines.push('')
  }

  if (input.erinnerungen.length > 0) {
    lines.push('## Hinweise')
    for (const e of input.erinnerungen) {
      lines.push('- ' + e.text)
    }
    lines.push('')
  }

  const preEventSetups = input.ergebnisse
    .filter(
      (e) =>
        (e.playbook === 'earnings_pre_event' || e.playbook === 'earnings_vorlauf') &&
        e.ampel !== 'grau',
    )
    .sort((a, b) => b.score - a.score)

  if (preEventSetups.length > 0) {
    lines.push('## Pre-Event-Katalysator')
    lines.push('_Vorbereitung vor Earnings — kein Einstieg vor den Zahlen._')
    lines.push('')
    for (const e of preEventSetups) {
      lines.push(
        '### ' +
          e.symbol +
          ' (Score ' +
          e.score +
          ', Stufe ' +
          String(e.indikatoren.vorbereitungStufe ?? '—') +
          ')',
      )
      if (e.indikatoren.tageBisEarnings != null) {
        lines.push('- Earnings in ' + String(e.indikatoren.tageBisEarnings) + ' Tagen')
      }
      if (e.indikatoren.medianGapPct != null) {
        lines.push('- Median-Gap: ' + String(e.indikatoren.medianGapPct) + '%')
      }
      if (e.indikatoren.laufVorEarningsPct != null) {
        lines.push('- 20-Tage-Lauf: ' + String(e.indikatoren.laufVorEarningsPct) + '%')
      }
      if (e.indikatoren.beatRatePct != null) {
        lines.push('- Beat-Rate: ' + String(e.indikatoren.beatRatePct) + '%')
      }
      const plan = e.indikatoren.szenarioPlan
      if (typeof plan === 'string' && plan.trim()) {
        lines.push('- Szenario-Plan:')
        for (const z of plan.split('\n')) lines.push('  ' + z)
      }
      if (e.indikatoren.kiBegruendung && typeof e.indikatoren.kiBegruendung === 'string') {
        lines.push('- KI: ' + e.indikatoren.kiBegruendung)
      }
      lines.push('')
    }
  }

  const tradeSetups = input.ergebnisse.filter(
    (e) =>
      MOMENTUM_TRADE_PLAYBOOKS.includes(e.playbook) &&
      (e.ampel === 'gruen' || e.ampel === 'gelb'),
  )

  if (tradeSetups.length > 0) {
    lines.push('## Trade-Setups')
    for (const e of tradeSetups.sort((a, b) => {
      const pa = typeof a.indikatoren.erfolgWahrscheinlichkeitPct === 'number' ? a.indikatoren.erfolgWahrscheinlichkeitPct : 0
      const pb = typeof b.indikatoren.erfolgWahrscheinlichkeitPct === 'number' ? b.indikatoren.erfolgWahrscheinlichkeitPct : 0
      return pb - pa || b.score - a.score
    })) {
      const r = e.indikatoren.richtung
      lines.push(
        '### ' +
          e.symbol +
          ' — ' +
          momentumPlaybookLabel(e.playbook) +
          ' (Score ' +
          e.score +
          ', ' +
          e.ampel +
          ')',
      )
      if (r) lines.push('- Richtung: **' + r + '**')
      if (e.indikatoren.gapPct != null) lines.push('- Gap: ' + e.indikatoren.gapPct + '%')
      if (e.indikatoren.surpriseEpsPct != null) {
        lines.push('- EPS-Surprise: ' + e.indikatoren.surpriseEpsPct + '%')
      }
      if (e.indikatoren.stopPrice != null) lines.push('- Stop: ' + e.indikatoren.stopPrice)
      if (e.indikatoren.targetPrice != null) lines.push('- Ziel: ' + e.indikatoren.targetPrice)
      if (e.indikatoren.kiBegruendung && typeof e.indikatoren.kiBegruendung === 'string') {
        lines.push('- KI: ' + e.indikatoren.kiBegruendung)
      }
      lines.push('')
    }
  } else {
    lines.push('## Trade-Setups')
    lines.push('_Keine grünen/gelben Setups heute._')
    lines.push('')
  }

  if (input.kalender.gesamt > 0) {
    lines.push('## Earnings-Kalender (nächste ' + input.kalender.tage.length + ' Termine)')
    for (const tag of input.kalender.tage.slice(0, 10)) {
      lines.push('### ' + tag.datum)
      for (const e of tag.eintraege) {
        lines.push(
          '- **' +
            e.symbol +
            '** (' +
            e.name +
            ') — in ' +
            e.tageBis +
            ' Tagen, ' +
            e.zeitLabel +
            (e.medianGapPct != null ? ', Median-Gap ' + e.medianGapPct.toFixed(1) + '%' : ''),
        )
      }
    }
    lines.push('')
  }

  const offen = input.trades.filter((t) => t.exitPrice == null)
  if (offen.length > 0) {
    lines.push('## Offene Trades')
    for (const t of offen) {
      lines.push(
        '- ' +
          t.symbol +
          ' ' +
          t.direction.toUpperCase() +
          ' @ ' +
          t.entryPrice +
          ' (' +
          t.playbook +
          ', ' +
          t.riskEur +
          ' € Risiko)',
      )
    }
    lines.push('')
  }

  if (input.performance && input.performance.tradesGesamt > 0) {
    const p = input.performance
    lines.push('## Journal-Performance')
    lines.push(
      '- PnL gesamt: ' +
        p.pnlGesamtEur.toFixed(2) +
        ' € · Win-Rate: ' +
        (p.winRatePct != null ? p.winRatePct + '%' : '—'),
    )
    lines.push('')
  }

  const tr = input.tracking
  if (tr && tr.katalysatoren > 0) {
    lines.push('## Pre-Event → Trade-Setup (letzte ' + tr.fensterTage + ' Tage)')
    lines.push(
      '- Trefferquote: ' +
        (tr.trefferquotePct != null ? tr.trefferquotePct + '%' : '—') +
        ' (' +
        tr.mitTradeSetup +
        '/' +
        tr.katalysatoren +
        ' Katalysatoren mit Post-Setup)',
    )
    for (const e of tr.eintraege.slice(0, 8)) {
      lines.push(
        '- ' +
          e.symbol +
          ' ' +
          e.earningsDate +
          ': Pre ' +
          (e.preEventScore ?? '—') +
          (e.postTradeSetup
            ? ' → ' + String(e.postPlaybook) + ' (' + String(e.postAmpel) + ')'
            : ' → kein Setup') +
          (e.gapPct != null ? ', Gap ' + e.gapPct.toFixed(1) + '%' : ''),
      )
    }
    lines.push('')
  }

  const pbStats = input.playbookStats?.stats.filter((s) => !s.symbol) ?? []
  if (pbStats.length > 0) {
    const fenster = input.playbookStats?.fensterTage ?? 504
    lines.push('## Backtest-Kalibrierung (' + Math.round(fenster / 252) + 'J Fenster)')
    for (const s of [...pbStats].sort((a, b) => (b.trefferPct ?? 0) - (a.trefferPct ?? 0)).slice(0, 15)) {
      const aktiv =
        s.sampleSize < 10 || (s.trefferPct != null && s.trefferPct >= PLAYBOOK_MIN_BACKTEST_TREFFER_PCT)
          ? 'aktiv'
          : 'pausiert'
      lines.push(
        '- ' +
          momentumPlaybookLabel(s.playbook) +
          ': ' +
          s.wins +
          '/' +
          s.sampleSize +
          ' (' +
          (s.trefferPct != null ? s.trefferPct + '%' : '—') +
          ') · ' +
          aktiv,
      )
    }
    lines.push('')
  }

  lines.push('---')
  lines.push('_Regelbasiert · max. 10 € Risiko/Trade · keine Anlageberatung._')
  return lines.join('\n')
}
