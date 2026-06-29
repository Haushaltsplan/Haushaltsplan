/**
 * Pre-Earnings-Katalysator — Vorbereitung vor den Zahlen (kein Richtungs-Trade).
 * Nutzt historische Gap-Volatilität, Regime und ATR-Anstieg.
 */

import { tageZwischenIso } from '@/lib/portfolio-analyse/dividenden-datum-hilfen'
import {
  EARNINGS_BEOBACHTUNG_MAX_TAGE,
  EARNINGS_VORLAUF_MAX,
  EARNINGS_VORLAUF_MIN,
  PRE_EVENT_ATR_ELEVATION_MIN,
  PRE_EVENT_GAP_MEDIAN_MIN,
  PRE_EVENT_GAP_MEDIAN_STARK,
  momentumPlaybookLabel,
} from '@/lib/portfolio-analyse/momentum-trader/momentum-constants'
import { berechneAtr } from '@/lib/portfolio-analyse/momentum-trader/momentum-indicators'
import type { MomentumEarningsHistorieStatistik } from '@/lib/portfolio-analyse/momentum-trader/momentum-earnings-analytics-server'
import { berechneEarningsHistorieStatistik } from '@/lib/portfolio-analyse/momentum-trader/momentum-earnings-analytics-server'
import type {
  MomentumAmpel,
  MomentumBarDaily,
  MomentumEarningsEvent,
  MomentumEarningsZeit,
  MomentumRegimeGates,
  MomentumScanEintrag,
} from '@/lib/portfolio-analyse/momentum-trader/momentum-trader-types'

function zeitLabel(z: MomentumEarningsZeit): string {
  if (z === 'bmo') return 'vor Börseneröffnung (BMO)'
  if (z === 'amc') return 'nach Handelsschluss (AMC)'
  if (z === 'dmh') return 'während Handel'
  return 'Zeit noch unbekannt'
}

function baueSzenarioPlan(opts: {
  medianGap: number | null
  longBias: boolean
  shortBias: boolean
  timeBmoAmc: MomentumEarningsZeit
  beatRatePct: number | null
  avgSurprisePct: number | null
  laufVorEarningsPct: number | null
}): string[] {
  const med = opts.medianGap != null ? opts.medianGap.toFixed(1) : '—'
  const s: string[] = [
    '① Nach Zahlen: Kurse syncen + Scan — erst dann Journal (max. 10 €).',
  ]

  if (opts.beatRatePct != null) {
    s.push(
      '② Historie: ' +
        opts.beatRatePct +
        '% Beats' +
        (opts.avgSurprisePct != null ? ' (Ø Surprise ' + opts.avgSurprisePct + '%)' : '') +
        ' — bei Beat eher Gap-Up-Szenario prüfen.',
    )
  }

  if (opts.laufVorEarningsPct != null && Math.abs(opts.laufVorEarningsPct) >= 3) {
    s.push(
      '③ Lauf in Earnings (' +
        opts.laufVorEarningsPct.toFixed(1) +
        '% / 20 Tage): ' +
        (opts.laufVorEarningsPct > 5
          ? 'Extension vor Event — nach Beat eher Fade-Kandidat'
          : 'moderate Vorlauf-Bewegung') +
        '.',
    )
  }

  s.push(
    '④ Beat + Gap-Up ≥5% (Median ' +
      med +
      '%): Gap-Fade Short prüfen' +
      (opts.shortBias ? ' — Regime Short-Bias passt' : ' — Short-Bias fehlt') +
      '.',
  )
  s.push(
    '⑤ Miss + Gap-Down: Gap-Fade Long prüfen' +
      (opts.longBias ? ' — Regime Long-Bias passt' : ' — Long-Bias fehlt') +
      '.',
  )
  s.push('⑥ Beat + Tag-1-Stärke + RS vs. S&P: Earnings-Momentum Long prüfen.')
  s.push('⑦ Kleine Surprise / kein Gap: kein Setup — nicht erzwingen.')

  if (opts.timeBmoAmc === 'amc') {
    s.push('⑧ AMC: Reaktion oft am Folgetag — nicht am Earnings-Abend handeln.')
  } else if (opts.timeBmoAmc === 'bmo') {
    s.push('⑧ BMO: Gap direkt zur Eröffnung — Reaktionsbar am Earnings-Tag.')
  }
  return s
}

function laufVorEarningsPct(bars: MomentumBarDaily[], tage = 20): number | null {
  if (bars.length < tage + 2) return null
  const last = bars[bars.length - 1].close
  const basis = bars[bars.length - 1 - tage].close
  if (basis <= 0) return null
  return Math.round(((last - basis) / basis) * 1000) / 10
}

function atrElevationsFaktor(bars: MomentumBarDaily[]): number | null {
  if (bars.length < 25) return null
  const lastIdx = bars.length - 1
  const atrNow = berechneAtr(bars, lastIdx)
  if (atrNow == null || atrNow <= 0) return null

  const atrs: number[] = []
  for (let i = Math.max(14, lastIdx - 19); i <= lastIdx; i++) {
    const a = berechneAtr(bars, i)
    if (a != null && a > 0) atrs.push(a)
  }
  if (atrs.length < 5) return null
  const avg = atrs.reduce((x, y) => x + y, 0) / atrs.length
  return avg > 0 ? atrNow / avg : null
}

/**
 * Pre-Event-Score: hohe historische Gap-Volatilität + Earnings nahe + optionale ATR-Spannung.
 * Ampel nie grün — Vorbereitung, kein Einstieg vor den Zahlen.
 */
export function bewerteEarningsPreEvent(
  symbol: string,
  scanDate: string,
  earningsDate: string,
  timeBmoAmc: MomentumEarningsZeit,
  regimeGates: MomentumRegimeGates,
  medianGap: number | null,
  bars: MomentumBarDaily[],
  events: MomentumEarningsEvent[] = [],
  historieIn?: MomentumEarningsHistorieStatistik,
): MomentumScanEintrag {
  const historie = historieIn ?? berechneEarningsHistorieStatistik(events, bars)
  const tageBis = tageZwischenIso(scanDate, earningsDate)
  const gatesPassed: string[] = []
  const gatesFailed: string[] = []

  if (tageBis < 0) {
    gatesFailed.push('Earnings-Termin liegt in der Vergangenheit')
  } else if (tageBis > EARNINGS_BEOBACHTUNG_MAX_TAGE) {
    gatesFailed.push('Earnings zu weit entfernt (>' + EARNINGS_BEOBACHTUNG_MAX_TAGE + ' Tage)')
  } else if (tageBis > EARNINGS_VORLAUF_MAX) {
    gatesPassed.push(
      'Earnings in ' + tageBis + ' Tagen — Beobachtung (Katalysator-Fenster ab ' + EARNINGS_VORLAUF_MIN + ' Tage)',
    )
  } else if (tageBis < EARNINGS_VORLAUF_MIN) {
    gatesPassed.push(
      'Earnings in ' + tageBis + ' Tagen — unmittelbar bevorstehend, Szenario-Plan aktiv',
    )
  } else {
    gatesPassed.push(
      'Earnings in ' +
        tageBis +
        ' Tagen — Katalysator-Fenster (' +
        EARNINGS_VORLAUF_MIN +
        '–' +
        EARNINGS_VORLAUF_MAX +
        ' Tage)',
    )
  }

  if (medianGap != null && medianGap >= PRE_EVENT_GAP_MEDIAN_MIN) {
    gatesPassed.push('Historisch volatil: Median-Gap ' + medianGap.toFixed(1) + '%')
    if (medianGap >= PRE_EVENT_GAP_MEDIAN_STARK) {
      gatesPassed.push('Starkes Gap-Profil (≥ ' + PRE_EVENT_GAP_MEDIAN_STARK + '% Median)')
    }
  } else if (historie.eventsMitGap >= 1 && historie.medianGapPct != null) {
    gatesPassed.push(
      'Gap-Historie: ' +
        historie.eventsMitGap +
        ' Event(s), Median ' +
        historie.medianGapPct.toFixed(1) +
        '%',
    )
  } else if (medianGap != null) {
    gatesFailed.push('Median-Gap nur ' + medianGap.toFixed(1) + '% — wenig Earnings-Reaktion historisch')
  } else {
    gatesFailed.push('Keine Gap-Historie — „Alles aktualisieren“ für Backfill (MarketBeat + Bars)')
  }

  const atrFaktor = atrElevationsFaktor(bars)
  if (atrFaktor != null) {
    if (atrFaktor >= PRE_EVENT_ATR_ELEVATION_MIN) {
      gatesPassed.push(
        'ATR erhöht (' + (atrFaktor * 100 - 100).toFixed(0) + '% über 20-Tage-Schnitt) — Spannung vor Event',
      )
    } else {
      gatesFailed.push('ATR noch nicht deutlich erhöht — weniger Pre-Event-Spannung')
    }
  }

  const laufPct = laufVorEarningsPct(bars)
  const surprises = events
    .map((e) => e.surpriseEpsPct)
    .filter((s): s is number => s != null && Number.isFinite(s))
  const beatRatePct =
    surprises.length > 0
      ? Math.round((surprises.filter((s) => s > 0).length / surprises.length) * 100)
      : null
  const avgSurprisePct =
    surprises.length > 0
      ? Math.round((surprises.reduce((a, b) => a + b, 0) / surprises.length) * 10) / 10
      : null

  if (laufPct != null && Math.abs(laufPct) >= 4) {
    gatesPassed.push('20-Tage-Lauf vor Earnings: ' + laufPct + '%')
    if (laufPct >= 8) gatesPassed.push('Starke Extension — erhöht Fade-Potenzial nach Beat+Gap')
  }

  if (beatRatePct != null && events.length >= 2) {
    gatesPassed.push(
      'EPS-Historie: ' + beatRatePct + '% Beats (' + events.length + ' Events)' +
        (avgSurprisePct != null ? ', Ø Surprise ' + avgSurprisePct + '%' : ''),
    )
  } else if (events.length === 1 && beatRatePct != null) {
    gatesPassed.push('Nur 1 Event in Historie — Backfill für robustere Schätzung')
  }

  gatesFailed.push('Kein Einstieg vor den Zahlen — nur Vorbereitung (Hochrisiko bei Richtungs-Wette)')

  let score = 30
  if (tageBis >= 0 && tageBis <= EARNINGS_VORLAUF_MAX) {
    if (tageBis >= EARNINGS_VORLAUF_MIN) score += 20
    else score += 12
    if (tageBis <= 7) score += 10
  } else if (tageBis > EARNINGS_VORLAUF_MAX && tageBis <= EARNINGS_BEOBACHTUNG_MAX_TAGE) {
    score += 8
  }

  if (medianGap != null) {
    score += Math.min(20, medianGap * 2.5)
    if (medianGap >= PRE_EVENT_GAP_MEDIAN_STARK) score += 10
  }

  if (atrFaktor != null && atrFaktor >= PRE_EVENT_ATR_ELEVATION_MIN) {
    score += Math.min(12, (atrFaktor - 1) * 30)
  }

  gatesPassed.push(
    'Bericht: ' +
      zeitLabel(timeBmoAmc) +
      ' · Regime Long ' +
      (regimeGates.longBias ? '✓' : '—') +
      ' / Short ' +
      (regimeGates.shortBias ? '✓' : '—'),
  )

  if (regimeGates.longBias || regimeGates.shortBias) score += 5
  if (laufPct != null && Math.abs(laufPct) >= 5) score += Math.min(8, Math.abs(laufPct) * 0.4)
  if (beatRatePct != null && beatRatePct >= 70) score += 5
  score = Math.min(92, Math.round(score))

  let ampel: MomentumAmpel = 'grau'
  const imKatalysatorFenster = tageBis >= 0 && tageBis <= EARNINGS_VORLAUF_MAX
  const hatVolatilitaetsProfil =
    medianGap != null && medianGap >= PRE_EVENT_GAP_MEDIAN_MIN

  if (imKatalysatorFenster && hatVolatilitaetsProfil && score >= 50) {
    ampel = 'gelb'
  } else if (tageBis >= 0 && tageBis <= EARNINGS_BEOBACHTUNG_MAX_TAGE && score >= 40) {
    ampel = 'gelb'
  }

  const szenarien = baueSzenarioPlan({
    medianGap,
    longBias: regimeGates.longBias,
    shortBias: regimeGates.shortBias,
    timeBmoAmc,
    beatRatePct,
    avgSurprisePct,
    laufVorEarningsPct: laufPct,
  })

  let vorbereitungStufe: 'hoch' | 'mittel' | 'niedrig' = 'niedrig'
  if (imKatalysatorFenster && hatVolatilitaetsProfil && score >= 65) vorbereitungStufe = 'hoch'
  else if (score >= 45 && medianGap != null) vorbereitungStufe = 'mittel'

  return {
    scanDate,
    symbol,
    playbook: 'earnings_pre_event',
    score,
    ampel,
    gatesPassed,
    gatesFailed,
    indikatoren: {
      playbookLabel: momentumPlaybookLabel('earnings_pre_event'),
      earningsDate,
      tageBisEarnings: tageBis,
      timeBmoAmc,
      medianGapPct: medianGap,
      laufVorEarningsPct: laufPct,
      beatRatePct,
      avgSurprisePct,
      earningsEventsAnzahl: events.length,
      eventsMitGap: historie.eventsMitGap,
      gapUpRatePct: historie.gapUpRatePct,
      gapDownRatePct: historie.gapDownRatePct,
      erwarteteBewegungPct: historie.erwarteteBewegungPct,
      preDrift5dPct: historie.preDrift5dPct,
      atrImpliedMovePct: historie.atrImpliedMovePct,
      atrElevationsFaktor: atrFaktor != null ? Math.round(atrFaktor * 100) / 100 : null,
      vorbereitungStufe,
      szenarioPlan: szenarien.join('\n'),
      hinweis:
        vorbereitungStufe === 'hoch'
          ? 'Hohes Pre-Event-Potenzial — Szenarien studieren, Trade erst nach Reaktion'
          : 'Beobachten — nach Earnings erneut scannen',
    },
  }
}
