import 'server-only'

import { momentumPlaybookLabel } from '@/lib/portfolio-analyse/momentum-trader/momentum-constants'
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

function alsText(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null
}

function baereFakten(e: MomentumScanEintrag): string[] {
  const out: string[] = []
  const push = (label: string, v: unknown, suffix = '') => {
    if (typeof v === 'number' && Number.isFinite(v)) out.push(label + ' ' + v + suffix)
  }
  push('Gap', e.indikatoren.gapPct, '%')
  push('Median-Gap', e.indikatoren.medianGapPct, '%')
  push('Erw. Bewegung', e.indikatoren.erwarteteBewegungPct, '%')
  push('RVOL', e.indikatoren.rvol, '×')
  push('Surprise', e.indikatoren.surpriseEpsPct, '%')
  push('Beats', e.indikatoren.beatRatePct, '%')
  push('20T-Lauf', e.indikatoren.laufVorEarningsPct, '%')
  push('5T-Drift hist.', e.indikatoren.preDrift5dPct, '%')
  push('Gap-Up-Rate', e.indikatoren.gapUpRatePct, '%')
  push('RS vs. S&P', e.indikatoren.rsVsSpy20d, '%')
  const tage = e.indikatoren.tageBisEarnings
  if (typeof tage === 'number') out.push('Earnings in ' + tage + ' Tagen')
  return out.slice(0, 6)
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
      label: 'Gap-Fade Short nach Beat+Gap-Up',
    },
    {
      richtung: 'long' as const,
      wahrscheinlichkeitPct: klemmeWahrscheinlichkeit((wLongMom / sum) * 100),
      label: 'Momentum Long nach Beat',
    },
    {
      richtung: 'long' as const,
      wahrscheinlichkeitPct: klemmeWahrscheinlichkeit((wLongFade / sum) * 100),
      label: 'Gap-Fade Long nach Miss',
    },
  ].sort((a, b) => b.wahrscheinlichkeitPct - a.wahrscheinlichkeitPct)
}

/** Aktives Trade-Setup — Richtung und Score direkt aus dem Scan. */
export function handlungssignalAusTradeSetup(e: MomentumScanEintrag): MomentumHandlungssignal | null {
  if (!TRADE_PLAYBOOKS.has(e.playbook) || e.ampel === 'grau' || e.ampel === 'rot') return null
  const r = e.indikatoren.richtung
  if (r !== 'long' && r !== 'short') return null

  let w = e.score
  if (e.ampel === 'gelb') w *= 0.88

  const phase = e.playbook === 'earnings_pre_run' ? 'vor_earnings' : 'jetzt'
  const pbLabel = momentumPlaybookLabel(e.playbook)
  const strategie = alsText(e.indikatoren.strategie)
  const stop = e.indikatoren.stopPrice
  const ziel = e.indikatoren.targetPrice

  let detailText =
    pbLabel +
    ' für ' +
    e.symbol +
    ': ' +
    (r === 'long' ? 'Long' : 'Short') +
    ' mit Scan-Score ' +
    e.score +
    '/100. '
  if (strategie) detailText += strategie + '. '
  if (e.playbook === 'earnings_pre_run') {
    detailText +=
      'Dies ist ein Pre-Earnings-Trade auf den Lauf in die Zahlen — nicht auf den Gap danach. ' +
      'Position spätestens vor dem Bericht schließen; die eigentliche Gap-Reaktion wird separat per Gap-Fade/Momentum gehandelt.'
  } else {
    detailText +=
      'Setup basiert auf der gemessenen Earnings-Reaktion (Gap, Volumen, Surprise) und passt zum aktuellen Markt-Regime.'
  }
  if (stop != null && ziel != null) {
    detailText += ' Vorschlag Stop ' + String(stop) + ', Ziel ' + String(ziel) + ' (ATR-basiert, 10 € Risiko).'
  }

  const risikoHinweis =
    e.playbook === 'earnings_pre_run'
      ? 'Event-Risiko: Kurs kann nach Zahlen gegen die Position springen — deshalb Exit vor Earnings Pflicht.'
      : 'Nur handeln wenn alle Gates grün/gelb — max. 10 € Risiko, kein Nachkaufen ohne neuen Scan.'

  const timing =
    e.playbook === 'earnings_pre_run'
      ? 'Jetzt einsteigen, Exit vor ' + String(e.indikatoren.exitBis ?? 'Earnings')
      : 'Jetzt — Reaktionsfenster nach Earnings'

  return {
    symbol: e.symbol,
    richtung: r,
    wahrscheinlichkeitPct: klemmeWahrscheinlichkeit(w),
    playbook: e.playbook,
    phase,
    istAktiv: true,
    prioritaet: e.score + (e.playbook === 'earnings_pre_run' ? 38 : 40),
    kurztext: (r === 'long' ? 'Long' : 'Short') + ' — ' + pbLabel,
    detailText,
    risikoHinweis,
    timing,
    fakten: baereFakten(e),
    alternativen: [],
  }
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
  const erwartet = alsZahl(e.indikatoren.erwarteteBewegungPct, median)
  const gapUp = alsZahl(e.indikatoren.gapUpRatePct, 50)
  const preDrift = e.indikatoren.preDrift5dPct

  const alternativen = baueAlternativenPreEvent(beat, median, lauf, gates)
  const top = alternativen[0]
  if (!top) return null

  const richtung = top.richtung
  const playbook: MomentumPlaybook =
    top.label.includes('Momentum') ? 'earnings_momentum' : 'earnings_gap_fade'
  const datenQualitaet = 0.45 + Math.min(0.35, e.score / 220)
  const wahrscheinlichkeitPct = klemmeWahrscheinlichkeit(
    top.wahrscheinlichkeitPct * datenQualitaet + e.score * 0.12,
  )

  let kurztext = 'Nach Earnings: ' + (richtung === 'long' ? 'Long' : 'Short') + ' — ' + top.label
  if (tage === 0) kurztext = 'Heute Earnings — danach ' + kurztext.replace('Nach Earnings: ', '')
  else if (tage > 0) kurztext = 'In ' + tage + ' Tagen — ' + kurztext

  const detailText =
    'Basierend auf ' +
    Math.round(beat * 100) +
    '% historischen Beats, Median-Gap ' +
    median.toFixed(1) +
    '% und erwarteter Reaktion ~' +
    erwartet.toFixed(1) +
    '% ist nach den Zahlen am wahrscheinlichsten: ' +
    top.label +
    ' (' +
    wahrscheinlichkeitPct +
    '% Daten-Konfidenz). ' +
    'Historisch Gap-Up in ' +
    gapUp +
    '% der Events' +
    (typeof preDrift === 'number' ? '; Ø 5-Tage-Drift vor Earnings: ' + preDrift + '%.' : '.') +
    ' Vor den Zahlen kann ein separater Pre-Run-Trade (Filter Scan) auf den Lauf in die Earnings aktiv sein — Exit vor dem Event.'

  return {
    symbol: e.symbol,
    richtung,
    wahrscheinlichkeitPct,
    playbook,
    phase: 'nach_earnings',
    istAktiv: false,
    prioritaet: e.score + (tage >= 0 && tage <= 3 ? 15 : 0),
    kurztext,
    detailText,
    risikoHinweis:
      'Vor den Zahlen ist die Richtung ein Wahrscheinlichkeitsszenario — kein blindes Vorab-Setzen auf den Gap. Pre-Run nur mit Stop und Exit vor Earnings.',
    timing: tage === 0 ? 'Heute: nach AMC/BMO Sync + Scan' : 'Nach Earnings in ' + tage + ' Tag(en)',
    fakten: baereFakten(e),
    alternativen: alternativen.slice(1),
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
