import 'server-only'

import { momentumPlaybookLabel } from '@/lib/portfolio-analyse/momentum-trader/momentum-constants'
import type {
  MomentumHandlungssignal,
  MomentumPlaybook,
  MomentumRegimeGates,
  MomentumRichtung,
  MomentumScanEintrag,
} from '@/lib/portfolio-analyse/momentum-trader/momentum-trader-types'

const TRADE_PLAYBOOKS = new Set<MomentumPlaybook>(['earnings_gap_fade', 'earnings_momentum', 'ipo_fade'])
const PRE_EVENT_PLAYBOOKS = new Set<MomentumPlaybook>(['earnings_pre_event', 'earnings_vorlauf'])

function klemmeWahrscheinlichkeit(n: number): number {
  return Math.min(92, Math.max(28, Math.round(n)))
}

function faktenAusSetup(e: MomentumScanEintrag): string[] {
  const out: string[] = []
  const gap = e.indikatoren.gapPct
  const rvol = e.indikatoren.rvol
  const surprise = e.indikatoren.surpriseEpsPct
  const median = e.indikatoren.medianGapPct
  if (gap != null) out.push('Gap ' + gap + '%')
  if (rvol != null) out.push('RVOL ' + rvol + '×')
  if (surprise != null) out.push('Surprise ' + surprise + '%')
  if (median != null && gap == null) out.push('Median-Gap ' + median + '%')
  return out.slice(0, 3)
}

function faktenAusPreEvent(e: MomentumScanEintrag): string[] {
  const out: string[] = []
  const beat = e.indikatoren.beatRatePct
  const median = e.indikatoren.medianGapPct
  const lauf = e.indikatoren.laufVorEarningsPct
  const tage = e.indikatoren.tageBisEarnings
  if (beat != null) out.push(beat + '% historische Beats')
  if (median != null) out.push('Median-Gap ' + median + '%')
  if (lauf != null) out.push('20T-Lauf ' + lauf + '%')
  if (tage != null) out.push('Earnings in ' + tage + ' Tagen')
  return out.slice(0, 3)
}

/** Aktives Trade-Setup — Richtung und Score direkt aus dem Scan. */
export function handlungssignalAusTradeSetup(e: MomentumScanEintrag): MomentumHandlungssignal | null {
  if (!TRADE_PLAYBOOKS.has(e.playbook) || e.ampel === 'grau' || e.ampel === 'rot') return null
  const r = e.indikatoren.richtung
  if (r !== 'long' && r !== 'short') return null

  let w = e.score
  if (e.ampel === 'gelb') w *= 0.88

  return {
    symbol: e.symbol,
    richtung: r,
    wahrscheinlichkeitPct: klemmeWahrscheinlichkeit(w),
    playbook: e.playbook,
    phase: 'jetzt',
    istAktiv: true,
    prioritaet: e.score + 40,
    kurztext: (r === 'long' ? 'Long' : 'Short') + ' — ' + momentumPlaybookLabel(e.playbook),
    fakten: faktenAusSetup(e),
  }
}

function alsZahl(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback
}

/** Pre-Event — wahrscheinlichster Pfad nach Earnings aus Historie + Regime. */
export function handlungssignalAusPreEvent(
  e: MomentumScanEintrag,
  gates: MomentumRegimeGates | null,
): MomentumHandlungssignal | null {
  if (!PRE_EVENT_PLAYBOOKS.has(e.playbook) || e.ampel === 'grau') return null

  const beat = alsZahl(e.indikatoren.beatRatePct, 50) / 100
  const median = alsZahl(e.indikatoren.medianGapPct, 4)
  const lauf = alsZahl(e.indikatoren.laufVorEarningsPct, 0)
  const tage = alsZahl(e.indikatoren.tageBisEarnings, -1)

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
  const pShort = wShort / sum
  const pLongFade = wLongFade / sum
  const pLongMom = wLongMom / sum

  let richtung: MomentumRichtung | 'warten' = 'warten'
  let playbook: MomentumPlaybook = 'earnings_gap_fade'
  let rohProb = 0
  let kurztext = ''

  if (pShort >= pLongFade && pShort >= pLongMom) {
    richtung = 'short'
    rohProb = pShort
    playbook = 'earnings_gap_fade'
    kurztext = 'Nach Earnings: Short (Gap-Fade) wahrscheinlichster Pfad'
  } else if (pLongMom >= pLongFade) {
    richtung = 'long'
    rohProb = pLongMom
    playbook = 'earnings_momentum'
    kurztext = 'Nach Earnings: Long (Momentum) wahrscheinlichster Pfad'
  } else {
    richtung = 'long'
    rohProb = pLongFade
    playbook = 'earnings_gap_fade'
    kurztext = 'Nach Earnings: Long (Gap-Fade nach Miss) wahrscheinlichster Pfad'
  }

  const datenQualitaet = 0.45 + Math.min(0.35, e.score / 220)
  const wahrscheinlichkeitPct = klemmeWahrscheinlichkeit(rohProb * 100 * datenQualitaet + e.score * 0.15)

  if (tage === 0) {
    kurztext = 'Heute Earnings — ' + kurztext.replace('Nach Earnings: ', '') + ', danach Sync + Scan'
  } else if (tage > 0) {
    kurztext = 'In ' + tage + ' Tagen: ' + kurztext.replace('Nach Earnings: ', '')
  }

  return {
    symbol: e.symbol,
    richtung,
    wahrscheinlichkeitPct,
    playbook,
    phase: 'nach_earnings',
    istAktiv: false,
    prioritaet: e.score + (tage >= 0 && tage <= 3 ? 15 : 0),
    kurztext,
    fakten: faktenAusPreEvent(e),
  }
}

/** Signale aus Scan-Ergebnissen ranken. */
export function sammleHandlungssignale(
  ergebnisse: MomentumScanEintrag[],
  gates: MomentumRegimeGates | null,
): MomentumHandlungssignal[] {
  const out: MomentumHandlungssignal[] = []
  for (const e of ergebnisse) {
    const trade = handlungssignalAusTradeSetup(e)
    if (trade) out.push(trade)
    else {
      const pre = handlungssignalAusPreEvent(e, gates)
      if (pre) out.push(pre)
    }
  }
  return out.sort((a, b) => b.prioritaet - a.prioritaet)
}
