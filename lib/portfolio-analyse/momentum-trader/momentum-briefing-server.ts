import 'server-only'

import { momentumPlaybookLabel } from '@/lib/portfolio-analyse/momentum-trader/momentum-constants'
import type {
  MomentumEarningsKalenderMonat,
  MomentumErinnerung,
  MomentumMarketRegime,
  MomentumPerformance,
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

  const tradeSetups = input.ergebnisse.filter(
    (e) =>
      (e.playbook === 'earnings_gap_fade' ||
        e.playbook === 'earnings_momentum' ||
        e.playbook === 'ipo_fade') &&
      (e.ampel === 'gruen' || e.ampel === 'gelb'),
  )
  if (tradeSetups.length > 0) {
    lines.push('## Trade-Setups')
    for (const e of tradeSetups.sort((a, b) => b.score - a.score)) {
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

  lines.push('---')
  lines.push('_Regelbasiert · max. 10 € Risiko/Trade · keine Anlageberatung._')
  return lines.join('\n')
}
