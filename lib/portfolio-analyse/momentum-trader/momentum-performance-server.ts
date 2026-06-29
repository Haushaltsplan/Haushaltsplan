import 'server-only'

import type {
  MomentumPerformance,
  MomentumPerformancePlaybook,
  MomentumPlaybook,
  MomentumTrade,
} from '@/lib/portfolio-analyse/momentum-trader/momentum-trader-types'

const PLAYBOOKS: MomentumPlaybook[] = [
  'earnings_gap_fade',
  'earnings_vorlauf',
  'earnings_momentum',
  'ipo_fade',
]

function leeresPlaybookStats(): MomentumPerformancePlaybook {
  return { trades: 0, geschlossen: 0, pnlEur: 0, winRatePct: null }
}

function winRate(wins: number, geschlossen: number): number | null {
  if (geschlossen === 0) return null
  return Math.round((wins / geschlossen) * 1000) / 10
}

/** Journal-Performance aus abgeschlossenen Trades (regelbasiert, kein KI-Bias). */
export function berechneMomentumPerformance(trades: MomentumTrade[]): MomentumPerformance {
  const nachPlaybook = Object.fromEntries(
    PLAYBOOKS.map((p) => [p, leeresPlaybookStats()]),
  ) as Record<MomentumPlaybook, MomentumPerformancePlaybook>

  let tradesGeschlossen = 0
  let tradesOffen = 0
  let wins = 0
  let losses = 0
  let grossWin = 0
  let grossLoss = 0
  let pnlGesamt = 0
  let ruleOk = 0

  const pbWins = new Map<MomentumPlaybook, number>()

  for (const t of trades) {
    if (t.ruleCompliance) ruleOk++

    const pb = nachPlaybook[t.playbook] ?? leeresPlaybookStats()
    pb.trades++
    nachPlaybook[t.playbook] = pb

    const geschlossen = t.exitPrice != null && t.pnlEur != null
    if (!geschlossen) {
      tradesOffen++
      continue
    }

    tradesGeschlossen++
    pb.geschlossen++
    pnlGesamt += t.pnlEur!
    pb.pnlEur = Math.round((pb.pnlEur + t.pnlEur!) * 100) / 100

    if (t.pnlEur! > 0) {
      wins++
      grossWin += t.pnlEur!
      pbWins.set(t.playbook, (pbWins.get(t.playbook) ?? 0) + 1)
    } else if (t.pnlEur! < 0) {
      losses++
      grossLoss += Math.abs(t.pnlEur!)
    }
  }

  for (const p of PLAYBOOKS) {
    const pb = nachPlaybook[p]
    pb.winRatePct = winRate(pbWins.get(p) ?? 0, pb.geschlossen)
  }

  const profitFactor =
    grossLoss > 0
      ? Math.round((grossWin / grossLoss) * 100) / 100
      : grossWin > 0 && losses === 0
        ? null
        : null

  return {
    tradesGesamt: trades.length,
    tradesGeschlossen,
    tradesOffen,
    winRatePct: winRate(wins, tradesGeschlossen),
    profitFactor,
    pnlGesamtEur: Math.round(pnlGesamt * 100) / 100,
    pnlDurchschnittEur:
      tradesGeschlossen > 0 ? Math.round((pnlGesamt / tradesGeschlossen) * 100) / 100 : null,
    ruleCompliancePct:
      trades.length > 0 ? Math.round((ruleOk / trades.length) * 1000) / 10 : null,
    nachPlaybook,
  }
}
