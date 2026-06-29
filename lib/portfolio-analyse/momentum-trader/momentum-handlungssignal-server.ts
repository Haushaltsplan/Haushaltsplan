import 'server-only'

import { momentumPlaybookLabel } from '@/lib/portfolio-analyse/momentum-trader/momentum-constants'
import { baueHandlungsplanFuerScan } from '@/lib/portfolio-analyse/momentum-trader/momentum-handlungsplan-server'
import type {
  MomentumHandlungssignal,
  MomentumPlaybook,
  MomentumRegimeGates,
  MomentumRichtung,
  MomentumScanEintrag,
} from '@/lib/portfolio-analyse/momentum-trader/momentum-trader-types'

const TRADE_PLAYBOOKS = new Set<MomentumPlaybook>([
  'earnings_gap_fade',
  'earnings_momentum',
  'earnings_pre_run',
  'ipo_fade',
])
const PRE_EVENT_PLAYBOOKS = new Set<MomentumPlaybook>(['earnings_pre_event', 'earnings_vorlauf'])

function klemmeWahrscheinlichkeit(n: number): number {
  return Math.min(92, Math.max(28, Math.round(n)))
}

function alsZahl(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback
}

function richtungWort(r: MomentumRichtung): string {
  return r === 'long' ? 'LONG' : 'SHORT'
}

function baereFakten(e: MomentumScanEintrag): string[] {
  const out: string[] = []
  const push = (label: string, v: unknown, suffix = '') => {
    if (typeof v === 'number' && Number.isFinite(v)) out.push(label + ' ' + v + suffix)
  }
  push('Gap', e.indikatoren.gapPct, '%')
  push('Median', e.indikatoren.medianGapPct, '%')
  push('Erw.', e.indikatoren.erwarteteBewegungPct, '%')
  push('RVOL', e.indikatoren.rvol, '×')
  push('Surprise', e.indikatoren.surpriseEpsPct, '%')
  push('Beat', e.indikatoren.beatRatePct, '%')
  push('20T', e.indikatoren.laufVorEarningsPct, '%')
  push('RS S&P', e.indikatoren.rsVsSpy20d, '%')
  const tage = e.indikatoren.tageBisEarnings
  if (typeof tage === 'number') out.push('Earnings ' + tage + 'T')
  return out.slice(0, 8)
}

function baueAlternativenPreEvent(
  beat: number,
  median: number,
  lauf: number,
  gates: MomentumRegimeGates | null,
): MomentumHandlungssignal['alternativen'] {
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
      wahrscheinlichkeitPct: klemmeWahrscheinlichkeit((wShort / sum) * 100),
      label: 'Gap-Fade Short (Beat + Gap-Up)',
    },
    {
      richtung: 'long' as const,
      wahrscheinlichkeitPct: klemmeWahrscheinlichkeit((wLongMom / sum) * 100),
      label: 'Momentum Long (Beat + Stärke)',
    },
    {
      richtung: 'long' as const,
      wahrscheinlichkeitPct: klemmeWahrscheinlichkeit((wLongFade / sum) * 100),
      label: 'Gap-Fade Long (Miss + Gap-Down)',
    },
  ].sort((a, b) => b.wahrscheinlichkeitPct - a.wahrscheinlichkeitPct)
}

/** Aktives Trade-Setup — klare Jetzt-Anweisung. */
export function handlungssignalAusTradeSetup(e: MomentumScanEintrag): MomentumHandlungssignal | null {
  if (!TRADE_PLAYBOOKS.has(e.playbook) || e.ampel === 'grau' || e.ampel === 'rot') return null
  const r = e.indikatoren.richtung
  if (r !== 'long' && r !== 'short') return null

  let w = e.score
  if (e.ampel === 'gelb') w *= 0.88

  const phase = e.playbook === 'earnings_pre_run' ? 'vor_earnings' : 'jetzt'
  const pbLabel = momentumPlaybookLabel(e.playbook)
  const plan = baueHandlungsplanFuerScan(e, r, e.playbook, true)
  const entry = plan?.entryPreis
  const stop = plan?.stopLoss
  const target = plan?.takeProfit

  let aktionJetzt =
    richtungWort(r) +
    ' eröffnen — ' +
    e.symbol +
    ' (' +
    pbLabel +
    ', Score ' +
    e.score +
    ')'
  if (entry != null && stop != null) {
    aktionJetzt += '. Stop ' + stop.toFixed(2) + ', Ziel ' + (target?.toFixed(2) ?? '—') + ', max. 10 € Risiko'
  }

  const checkliste = [
    'Scan-Ampel grün oder gelb',
    'Regime-Gate passt zur Richtung',
    'Stop-Loss direkt nach Einstieg setzen',
    e.playbook === 'earnings_pre_run' ? 'Exit vor Earnings planen' : 'Max. 10 € Verlust am Stop',
  ]

  const warnungen =
    e.playbook === 'earnings_pre_run'
      ? ['Nicht über Earnings halten', 'Nach Exit: separates Gap-Setup abwarten']
      : ['Kein Nachkaufen', 'Bei Gate-Bruch sofort schließen']

  const detailText =
    pbLabel +
    ': Setup erfüllt ' +
    e.gatesPassed.length +
    ' von ' +
    (e.gatesPassed.length + e.gatesFailed.length) +
    ' Gates. ' +
    (e.playbook === 'earnings_pre_run'
      ? 'Trade auf Lauf in die Zahlen — nicht auf Gap-Reaktion.'
      : 'Trade auf gemessene Earnings-Reaktion (Gap, Volumen, Surprise).')

  return {
    symbol: e.symbol,
    richtung: r,
    wahrscheinlichkeitPct: klemmeWahrscheinlichkeit(w),
    playbook: e.playbook,
    phase,
    istAktiv: true,
    prioritaet: e.score + (e.playbook === 'earnings_pre_run' ? 38 : 40),
    kurztext: richtungWort(r) + ' · ' + pbLabel,
    aktionJetzt,
    detailText,
    risikoHinweis: warnungen.join(' · '),
    timing: plan?.zeitfenster ?? (phase === 'vor_earnings' ? 'Jetzt bis vor Earnings' : 'Jetzt — Reaktionsfenster'),
    checkliste,
    warnungen,
    fakten: baereFakten(e),
    alternativen: [],
    plan,
  }
}

/** Pre-Event — wahrscheinlichster Pfad nach Earnings. */
export function handlungssignalAusPreEvent(
  e: MomentumScanEintrag,
  gates: MomentumRegimeGates | null,
): MomentumHandlungssignal | null {
  if (!PRE_EVENT_PLAYBOOKS.has(e.playbook) || e.ampel === 'grau') return null

  const beat = alsZahl(e.indikatoren.beatRatePct, 50) / 100
  const median = alsZahl(e.indikatoren.medianGapPct, 4)
  const lauf = alsZahl(e.indikatoren.laufVorEarningsPct, 0)
  const tage = alsZahl(e.indikatoren.tageBisEarnings, -1)
  const erwartet = alsZahl(e.indikatoren.erwarteteBewegungPct, median)
  const gapUp = alsZahl(e.indikatoren.gapUpRatePct, 50)

  const alternativen = baueAlternativenPreEvent(beat, median, lauf, gates)
  const top = alternativen[0]
  if (!top) return null

  const richtung = top.richtung
  if (richtung !== 'long' && richtung !== 'short') return null
  const playbook: MomentumPlaybook =
    top.label.includes('Momentum') ? 'earnings_momentum' : 'earnings_gap_fade'
  const datenQualitaet = 0.45 + Math.min(0.35, e.score / 220)
  const wahrscheinlichkeitPct = klemmeWahrscheinlichkeit(
    top.wahrscheinlichkeitPct * datenQualitaet + e.score * 0.12,
  )

  const plan = baueHandlungsplanFuerScan(e, richtung, playbook, false)
  const gapSchwelle = Math.max(3, Math.min(12, median * 2))

  let aktionJetzt =
    'NOCH NICHT handeln. Nach Earnings: voraussichtlich ' +
    richtungWort(richtung) +
    ' (' +
    top.label +
    ', ~' +
    wahrscheinlichkeitPct +
    '%)'
  if (tage === 0) {
    aktionJetzt =
      'HEUTE Earnings — nach Zahlen Sync + Scan. Bei Trigger: ' +
      richtungWort(richtung) +
      ' (~' +
      wahrscheinlichkeitPct +
      '%)'
  } else if (tage > 0 && tage <= 3) {
    aktionJetzt =
      'In ' +
      tage +
      ' Tag(en) Earnings — Alarm setzen. Danach ' +
      richtungWort(richtung) +
      ' wenn Trigger erfüllt'
  }

  const checkliste = [
    'Jetzt: kein Einstieg vor den Zahlen',
    'Alarm für ' + e.symbol + ' am Earnings-Tag',
    'Nach Zahlen: „Alles aktualisieren“ + Scan',
    richtung === 'short'
      ? 'Trigger: Beat + Gap-Up ≥ ' + gapSchwelle.toFixed(1) + '%'
      : 'Trigger: Surprise + Gap in Richtung',
    'Nur handeln wenn ALLE Trigger grün',
  ]

  const warnungen = [
    'Blind vor Earnings einsteigen',
    'Trade ohne frischen Scan nach Zahlen',
    'Mehr als 10 € riskieren',
  ]

  const kurztext =
    (tage === 0 ? 'Heute Earnings · ' : tage > 0 ? 'In ' + tage + 'T · ' : '') +
    'Danach ' +
    richtungWort(richtung) +
    ' — ' +
    top.label

  const detailText =
    Math.round(beat * 100) +
    '% historische Beats · Median-Gap ' +
    median.toFixed(1) +
    '% · erwartet ~' +
    erwartet.toFixed(1) +
    '%. Gap-Up-Rate ' +
    gapUp +
    '%. Wahrscheinlichstes Szenario: ' +
    top.label +
    '.'

  return {
    symbol: e.symbol,
    richtung,
    wahrscheinlichkeitPct,
    playbook,
    phase: 'nach_earnings',
    istAktiv: false,
    prioritaet: e.score + (tage >= 0 && tage <= 3 ? 15 : 0),
    kurztext,
    aktionJetzt,
    detailText,
    risikoHinweis: 'Vor den Zahlen nur Szenario — kein Trade ohne Trigger nach Earnings.',
    timing: plan?.zeitfenster ?? (tage === 0 ? 'Heute nach AMC/BMO' : 'Nach Earnings in ' + tage + ' Tag(en)'),
    checkliste,
    warnungen,
    fakten: baereFakten(e),
    alternativen: alternativen.slice(1),
    plan,
  }
}

export function sammleHandlungssignale(
  ergebnisse: MomentumScanEintrag[],
  gates: MomentumRegimeGates | null,
): MomentumHandlungssignal[] {
  const bySymbol = new Map<string, MomentumHandlungssignal[]>()

  for (const e of ergebnisse) {
    const trade = handlungssignalAusTradeSetup(e)
    const sig = trade ?? handlungssignalAusPreEvent(e, gates)
    if (!sig) continue
    const arr = bySymbol.get(e.symbol) ?? []
    arr.push(sig)
    bySymbol.set(e.symbol, arr)
  }

  const out: MomentumHandlungssignal[] = []
  for (const arr of bySymbol.values()) {
    arr.sort((a, b) => b.prioritaet - a.prioritaet)
    out.push(arr[0])
  }
  return out.sort((a, b) => b.prioritaet - a.prioritaet)
}
