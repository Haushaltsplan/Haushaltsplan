import 'server-only'

import { heuteIsoUtc } from '@/lib/portfolio-analyse/dividenden-datum-hilfen'
import { ladeMomentumEarningsEventsFuerSymbole } from '@/lib/portfolio-analyse/momentum-trader/momentum-db-server'
import { ladeMomentumScanVerlaufRoh } from '@/lib/portfolio-analyse/momentum-trader/momentum-scan-verlauf-server'
import type {
  MomentumAmpel,
  MomentumKatalysatorTracking,
  MomentumKatalysatorTrackingEintrag,
  MomentumPlaybook,
  MomentumScoreVerlaufPunkt,
} from '@/lib/portfolio-analyse/momentum-trader/momentum-trader-types'

const FENSTER_TAGE = 365
const POST_PLAYBOOKS: MomentumPlaybook[] = ['earnings_gap_fade', 'earnings_momentum']
const PRE_PLAYBOOKS: MomentumPlaybook[] = ['earnings_pre_event', 'earnings_vorlauf']

function addDaysIso(iso: string, tage: number): string {
  const d = new Date(iso + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + tage)
  return d.toISOString().slice(0, 10)
}

function istInFenster(datum: string, von: string, bis: string): boolean {
  return datum >= von && datum <= bis
}

const AMPEL_PRIO: Record<MomentumAmpel, number> = {
  gruen: 3,
  gelb: 2,
  rot: 1,
  grau: 0,
}

function bestesPreEvent(punkte: MomentumScoreVerlaufPunkt[], von: string, bis: string) {
  return (
    punkte
      .filter(
        (p) =>
          PRE_PLAYBOOKS.includes(p.playbook) &&
          istInFenster(p.datum, von, bis) &&
          p.ampel === 'gelb' &&
          p.score >= 45,
      )
      .sort((a, b) => b.score - a.score)[0] ?? null
  )
}

function bestesPostSetup(punkte: MomentumScoreVerlaufPunkt[], von: string, bis: string) {
  return (
    punkte
      .filter(
        (p) =>
          POST_PLAYBOOKS.includes(p.playbook) &&
          istInFenster(p.datum, von, bis) &&
          (p.ampel === 'gruen' || p.ampel === 'gelb'),
      )
      .sort((a, b) => AMPEL_PRIO[b.ampel] - AMPEL_PRIO[a.ampel] || b.score - a.score)[0] ?? null
  )
}

/** Vergleicht Pre-Event-Scans mit Post-Earnings-Trade-Setups (Scan-Verlauf). */
export async function berechneKatalysatorTracking(symbole: string[]): Promise<MomentumKatalysatorTracking> {
  const heute = heuteIsoUtc()
  const seitIso = addDaysIso(heute, -FENSTER_TAGE)

  const [verlauf, events] = await Promise.all([
    ladeMomentumScanVerlaufRoh(symbole, seitIso),
    ladeMomentumEarningsEventsFuerSymbole(symbole, { seitIso }),
  ])

  const eintraege: MomentumKatalysatorTrackingEintrag[] = []

  for (const ev of events) {
    if (ev.earningsDate >= heute) continue
    const sym = ev.symbol.trim().toUpperCase()
    const punkte = verlauf.get(sym) ?? []

    const preVon = addDaysIso(ev.earningsDate, -14)
    const preBis = addDaysIso(ev.earningsDate, -1)
    const bestPre = bestesPreEvent(punkte, preVon, preBis)
    if (!bestPre) continue

    const postVon = ev.earningsDate
    const postBis = addDaysIso(ev.earningsDate, 3)
    const bestPost = bestesPostSetup(punkte, postVon, postBis)

    eintraege.push({
      symbol: sym,
      earningsDate: ev.earningsDate,
      preEventScore: bestPre.score,
      preEventAmpel: bestPre.ampel,
      postTradeSetup: bestPost != null,
      postPlaybook: bestPost?.playbook ?? null,
      postAmpel: bestPost?.ampel ?? null,
      gapPct: ev.gapPct,
      treffer: bestPost != null,
    })
  }

  eintraege.sort((a, b) => b.earningsDate.localeCompare(a.earningsDate))

  const katalysatoren = eintraege.length
  const mitTradeSetup = eintraege.filter((e) => e.postTradeSetup).length
  const trefferquotePct =
    katalysatoren > 0 ? Math.round((mitTradeSetup / katalysatoren) * 100) : null

  return {
    fensterTage: FENSTER_TAGE,
    katalysatoren,
    mitTradeSetup,
    trefferquotePct,
    eintraege: eintraege.slice(0, 30),
  }
}
