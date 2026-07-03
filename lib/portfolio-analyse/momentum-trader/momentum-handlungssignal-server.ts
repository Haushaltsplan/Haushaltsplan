import 'server-only'

import { momentumPlaybookLabel } from '@/lib/portfolio-analyse/momentum-trader/momentum-constants'
import {
  MOMENTUM_PRE_EVENT_PLAYBOOKS,
  MOMENTUM_TRADE_PLAYBOOKS,
} from '@/lib/portfolio-analyse/momentum-trader/momentum-playbook-registry'
import { baueHandlungsplanFuerScan } from '@/lib/portfolio-analyse/momentum-trader/momentum-handlungsplan-server'
import {
  baueErfolgSzenarienPreEvent,
  berechneTradeErfolg,
} from '@/lib/portfolio-analyse/momentum-trader/momentum-trade-erfolg-server'
import type {
  MomentumHandlungssignal,
  MomentumPlaybook,
  MomentumRegimeGates,
  MomentumRichtung,
  MomentumScanEintrag,
} from '@/lib/portfolio-analyse/momentum-trader/momentum-trader-types'

const TRADE_PLAYBOOKS = new Set<MomentumPlaybook>(MOMENTUM_TRADE_PLAYBOOKS)
const PRE_EVENT_PLAYBOOKS = new Set<MomentumPlaybook>(MOMENTUM_PRE_EVENT_PLAYBOOKS)

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

/** Aktives Trade-Setup — nur wenn Qualitätsfilter grün. */
export function handlungssignalAusTradeSetup(
  e: MomentumScanEintrag,
  gates: MomentumRegimeGates | null = null,
): MomentumHandlungssignal | null {
  if (!TRADE_PLAYBOOKS.has(e.playbook) || e.ampel === 'grau' || e.ampel === 'rot') return null
  if (e.indikatoren.erfolgIstAktiv !== true) return null
  const r = e.indikatoren.richtung ?? e.indikatoren.erfolgRichtung
  if (r !== 'long' && r !== 'short') return null

  const wahrscheinlichkeitPct =
    typeof e.indikatoren.erfolgWahrscheinlichkeitPct === 'number'
      ? e.indikatoren.erfolgWahrscheinlichkeitPct
      : berechneTradeErfolg(e, gates).pct
  const basisText =
    typeof e.indikatoren.erfolgBasisText === 'string'
      ? e.indikatoren.erfolgBasisText
      : berechneTradeErfolg(e, gates).erfolgBasisText

  const phase = 'jetzt'
  const pbLabel = momentumPlaybookLabel(e.playbook)
  const plan = baueHandlungsplanFuerScan(e, r, e.playbook, true)
  const entry = plan?.entryPreis
  const stop = plan?.stopLoss
  const target = plan?.takeProfit

  let aktionJetzt =
    '1) ' +
    richtungWort(r) +
    ' eröffnen (Market) · 2) Stop sofort auf ' +
    (stop?.toFixed(2) ?? '—') +
    ' · 3) Take-Profit ' +
    (target?.toFixed(2) ?? '—') +
    ' · Max. 10 € Verlust'
  if (entry != null) {
    aktionJetzt = aktionJetzt + ' · Einstieg ~' + entry.toFixed(2)
  }

  const checkliste = [
    'Nur handeln wenn Badge „Jetzt“ + Erfolgs-% ≥ ' + String(wahrscheinlichkeitPct) + '%',
    richtungWort(r) + ' Market eröffnen',
    'Stop-Loss SOFORT auf ' + (stop?.toFixed(2) ?? 'vom Scan') + ' setzen — nicht verschieben',
    'Take-Profit auf ' + (target?.toFixed(2) ?? 'vom Scan') + ' setzen',
    'CFD: Hebel ' + (plan?.hebelEmpfohlen ?? '5') + '× · Einsatz ~' + (plan?.marginEur ?? '20') + ' €',
    'Bei Ampel rot oder Gate-Bruch: Position sofort schließen',
  ]

  const warnungen = ['Kein Nachkaufen', 'Stop nicht weiten', 'Nicht ohne Stop handeln', 'Max. 10 € Risiko']

  const detailText =
    pbLabel +
    ' · Tages-Signal (nicht Quartalszahlen). ' +
    (basisText ?? '') +
    '. Gates: ' +
    e.gatesPassed.length +
    '/' +
    (e.gatesPassed.length + e.gatesFailed.length) +
    ' erfüllt.'

  return {
    symbol: e.symbol,
    richtung: r,
    wahrscheinlichkeitPct,
    playbook: e.playbook,
    phase,
    istAktiv: true,
    prioritaet: Math.round(wahrscheinlichkeitPct + e.score * 0.2),
    kurztext: richtungWort(r) + ' · ' + pbLabel,
    aktionJetzt,
    detailText,
    risikoHinweis: warnungen.join(' · '),
    timing: plan?.zeitfenster ?? 'Jetzt — aktives Tages-Setup',
    checkliste,
    warnungen,
    fakten: baereFakten(e).filter((f) => !f.startsWith('Earnings')),
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

  const alternativen = baueErfolgSzenarienPreEvent(beat, median, lauf, gates)
  const top = alternativen[0]
  if (!top) return null

  const richtung = top.richtung
  if (richtung !== 'long' && richtung !== 'short') return null
  const playbook: MomentumPlaybook =
    top.label.includes('Momentum') ? 'earnings_momentum' : 'earnings_gap_fade'
  const wahrscheinlichkeitPct = berechneTradeErfolg(e, gates).pct

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
  const out: MomentumHandlungssignal[] = []

  for (const e of ergebnisse) {
    const trade = handlungssignalAusTradeSetup(e, gates)
    if (trade) out.push(trade)
  }

  return out.sort((a, b) => b.wahrscheinlichkeitPct - a.wahrscheinlichkeitPct || b.prioritaet - a.prioritaet)
}
