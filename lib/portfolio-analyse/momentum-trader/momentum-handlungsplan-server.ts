import 'server-only'

import {
  GAP_MIN_PCT,
  MOMENTUM_DEFAULT_RISK_EUR,
  REWARD_RISK_RATIO,
} from '@/lib/portfolio-analyse/momentum-trader/momentum-constants'
import { momentumPlaybookLabel } from '@/lib/portfolio-analyse/momentum-trader/momentum-constants'
import type {
  MomentumHandlungsplan,
  MomentumPlaybook,
  MomentumRichtung,
  MomentumScanEintrag,
} from '@/lib/portfolio-analyse/momentum-trader/momentum-trader-types'

const HEBEL_STUFEN = [2, 3, 5, 8, 10, 15, 20] as const

function runde2(n: number): number {
  return Math.round(n * 100) / 100
}

function runde4(n: number): number {
  return Math.round(n * 10_000) / 10_000
}

function alsZahl(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback
}

function formatPreis(n: number, waehrung = 'USD'): string {
  if (waehrung === 'EUR') return n.toFixed(2) + ' €'
  return n.toFixed(2) + ' $'
}

function berechneCfdHebelMargin(
  entry: number,
  stop: number,
  riskEur: number,
): { hebel: number; marginEur: number; exposureEur: number } {
  const stopDist = Math.abs(entry - stop)
  if (stopDist <= 0 || entry <= 0) return { hebel: 5, marginEur: 20, exposureEur: 100 }

  let hebel: number = 5
  let marginEur = 20
  for (const L of HEBEL_STUFEN) {
    const m = (riskEur * entry) / (L * stopDist)
    if (m >= 8 && m <= 100) {
      hebel = L
      marginEur = m
      break
    }
    if (L === HEBEL_STUFEN[HEBEL_STUFEN.length - 1]) {
      hebel = L
      marginEur = Math.min(100, m)
    }
  }
  return { hebel, marginEur: runde2(marginEur), exposureEur: runde2(marginEur * hebel) }
}

function baueNiveaus(
  entry: number,
  stop: number,
  target: number,
  richtung: MomentumRichtung,
  riskEur: number,
): Pick<
  MomentumHandlungsplan,
  | 'entryPreis'
  | 'stopLoss'
  | 'takeProfit'
  | 'stopAbstandPct'
  | 'zielAbstandPct'
  | 'riskEur'
  | 'hebelEmpfohlen'
  | 'marginEur'
  | 'exposureEur'
  | 'stueckzahl'
  | 'gewinnZielEur'
> {
  const stopDist = Math.abs(entry - stop)
  const zielDist = Math.abs(entry - target)
  const stopAbstandPct = entry > 0 ? runde2((stopDist / entry) * 100) : 0
  const zielAbstandPct = entry > 0 ? runde2((zielDist / entry) * 100) : 0
  const cfd = berechneCfdHebelMargin(entry, stop, riskEur)
  const stueckzahl = stopDist > 0 ? Math.max(1, Math.floor(riskEur / stopDist)) : null

  return {
    entryPreis: runde4(entry),
    stopLoss: runde4(stop),
    takeProfit: runde4(target),
    stopAbstandPct,
    zielAbstandPct,
    riskEur,
    hebelEmpfohlen: cfd.hebel,
    marginEur: cfd.marginEur,
    exposureEur: cfd.exposureEur,
    stueckzahl,
    gewinnZielEur: riskEur * REWARD_RISK_RATIO,
  }
}

/** Konkreter Trade-Plan aus aktivem Scan-Setup (Pre-Run, Gap-Fade, …). */
export function baueHandlungsplanAusScan(
  e: MomentumScanEintrag,
  richtung: MomentumRichtung,
): MomentumHandlungsplan | null {
  const entry = alsZahl(e.indikatoren.entryPrice, 0) || alsZahl(e.indikatoren.letzterKurs, 0)
  const stop = alsZahl(e.indikatoren.stopPrice, 0)
  const target = alsZahl(e.indikatoren.targetPrice, 0)
  if (entry <= 0 || stop <= 0 || target <= 0) return null

  const riskEur = alsZahl(e.indikatoren.riskEur, MOMENTUM_DEFAULT_RISK_EUR)
  const niveaus = baueNiveaus(entry, stop, target, richtung, riskEur)
  const pb = momentumPlaybookLabel(e.playbook)
  const sym = e.symbol
  const exitBis = typeof e.indikatoren.exitBis === 'string' ? e.indikatoren.exitBis : null
  const tage = alsZahl(e.indikatoren.tageBisEarnings, -1)

  const schritte: string[] = []
  if (e.playbook === 'earnings_pre_run') {
    schritte.push(
      '1. Jetzt ' +
        (richtung === 'long' ? 'Long' : 'Short') +
        ' eröffnen (CFD ' +
        sym +
        ' oder US-Ticker NKE bei EU-Listing).',
    )
    schritte.push('2. Einstieg: Market um ' + formatPreis(entry) + ' (letzter Kurs).')
    schritte.push('3. Stop-Loss sofort setzen: ' + formatPreis(stop) + ' (' + niveaus.stopAbstandPct + '%).')
    schritte.push('4. Take-Profit: ' + formatPreis(target) + ' (Ziel +' + niveaus.zielAbstandPct + '%, ~' + niveaus.gewinnZielEur + ' €).')
    schritte.push(
      '5. CFD: Hebel ' +
        niveaus.hebelEmpfohlen +
        '×, Einsatz ca. ' +
        niveaus.marginEur +
        ' € → Exposure ~' +
        niveaus.exposureEur +
        ' €. Verlust am Stop = ' +
        riskEur +
        ' €.',
    )
    schritte.push(
      '6. Pflicht-Exit spätestens vor Earnings' +
        (tage >= 0 ? ' (in ' + tage + ' Tag(en))' : '') +
        (exitBis ? ', Datum ' + exitBis : '') +
        ' — Position nicht über die Zahlen halten.',
    )
    schritte.push('7. Nach Earnings: Sync + Scan für separates Gap-Fade/Momentum-Setup.')
  } else {
    schritte.push('1. ' + (richtung === 'long' ? 'Long' : 'Short') + ' eröffnen — ' + pb + ' (' + sym + ').')
    schritte.push('2. Einstieg: ' + formatPreis(entry) + ' (Reaktionsbar / aktueller Kurs).')
    schritte.push('3. Stop-Loss: ' + formatPreis(stop) + ' — bei Erreichen genau ' + riskEur + ' € Verlust.')
    schritte.push('4. Take-Profit: ' + formatPreis(target) + ' (~' + niveaus.gewinnZielEur + ' € Gewinn bei 2:1).')
    schritte.push(
      '5. CFD Hebel ' +
        niveaus.hebelEmpfohlen +
        '×, Einsatz ~' +
        niveaus.marginEur +
        ' € (Exposure ~' +
        niveaus.exposureEur +
        ' €).',
    )
    schritte.push('6. Kein Nachkaufen. Bei Ampel-Rot oder Gate-Bruch: Trade schließen.')
  }

  return {
    modus: 'aktiv',
    instrumentLabel: 'CFD / Turbo (' + sym + ' — bei EU-Listing US-Session für Earnings)',
    richtung,
    entryHinweis: 'Market jetzt',
    triggerBedingungen: [],
    schritteJetzt: schritte,
    schritteNachEarnings: [],
    exitBis,
    ...niveaus,
  }
}

/** Vorbereitungs-Plan für Post-Earnings (noch kein Einstieg). */
export function baueHandlungsplanNachEarnings(
  e: MomentumScanEintrag,
  richtung: MomentumRichtung,
  playbook: MomentumPlaybook,
): MomentumHandlungsplan | null {
  const kurs = alsZahl(e.indikatoren.letzterKurs, 0)
  if (kurs <= 0) return null

  const median = Math.max(alsZahl(e.indikatoren.medianGapPct, 0), 0.5)
  const erwartet = alsZahl(e.indikatoren.erwarteteBewegungPct, Math.max(median, 3))
  const atrPct = Math.max(alsZahl(e.indikatoren.atrImpliedMovePct, 2), 1.5) / 100
  const beat = alsZahl(e.indikatoren.beatRatePct, 50)
  const gapUp = alsZahl(e.indikatoren.gapUpRatePct, 50)
  const tage = alsZahl(e.indikatoren.tageBisEarnings, -1)
  const timeBmo = e.indikatoren.timeBmoAmc
  const riskEur = MOMENTUM_DEFAULT_RISK_EUR

  const gapSchwelle = Math.max(GAP_MIN_PCT, Math.min(12, Math.max(median * 2, erwartet * 0.6, 3)))
  const triggerBedingungen: string[] = []

  let entry: number
  let stop: number
  let target: number

  if (richtung === 'short' && playbook === 'earnings_gap_fade') {
    triggerBedingungen.push('EPS Beat (Surprise > 0%)')
    triggerBedingungen.push('Gap-Up ≥ ' + runde2(gapSchwelle) + '% zur Eröffnung nach Earnings')
    triggerBedingungen.push('Optional: RVOL ≥ 1,5× (im Scan nach Sync geprüft)')
    entry = runde4(kurs * (1 + gapSchwelle / 100))
    const stopDist = kurs * atrPct * 1.35
    stop = runde4(entry + stopDist)
    target = runde4(entry - stopDist * REWARD_RISK_RATIO)
  } else if (richtung === 'long' && playbook === 'earnings_gap_fade') {
    triggerBedingungen.push('EPS Miss (Surprise < 0%)')
    triggerBedingungen.push('Gap-Down ≤ -' + runde2(gapSchwelle) + '%')
    entry = runde4(kurs * (1 - gapSchwelle / 100))
    const stopDist = kurs * atrPct * 1.35
    stop = runde4(entry - stopDist)
    target = runde4(entry + stopDist * REWARD_RISK_RATIO)
  } else {
    triggerBedingungen.push('EPS Beat + Tag-1-Stärke (Kurs hält Gap)')
    triggerBedingungen.push('RS vs. S&P positiv (im Scan geprüft)')
    entry = runde4(kurs * (1 + gapSchwelle * 0.6 / 100))
    const stopDist = kurs * atrPct * 1.2
    stop = runde4(entry - stopDist)
    target = runde4(entry + stopDist * REWARD_RISK_RATIO)
  }

  const niveaus = baueNiveaus(entry, stop, target, richtung, riskEur)
  const sym = e.symbol

  const schritteJetzt: string[] = [
    '1. Jetzt KEIN Trade — Earnings' + (tage >= 0 ? ' in ' + tage + ' Tag(en)' : ' stehen bevor') + '.',
    '2. Alarm setzen für ' + sym + ' am Earnings-Tag.',
    '3. Watchlist: Beat-Rate ' + beat + '%, historisch Gap-Up ' + gapUp + '%, erwartete Reaktion ~' + erwartet + '%.',
  ]
  if (tage <= 1) {
    schritteJetzt.push('4. Optional heute: Pre-Run im Scan prüfen (Filter Pre-Event) — nur mit Exit vor Zahlen.')
  }

  const nachEarningsZeit =
    timeBmo === 'bmo'
      ? 'BMO: Reaktion direkt zur US-Eröffnung'
      : timeBmo === 'amc'
        ? 'AMC: Reaktion meist am nächsten Handelstag zur Eröffnung'
        : 'nach Bekanntgabe der Zahlen'

  const schritteNachEarnings: string[] = [
    '1. Nach Zahlen: „Alles aktualisieren“ + Scan (Gap, RVOL, Surprise frisch).',
    '2. Nur wenn ALLE Trigger erfüllt sind → ' + (richtung === 'long' ? 'Long' : 'Short') + ' eröffnen.',
    '3. Einstieg ca. ' + formatPreis(entry) + ' (' + nachEarningsZeit + ').',
    '4. Stop-Loss sofort: ' + formatPreis(stop) + ' (' + niveaus.stopAbstandPct + '% Abstand = ' + riskEur + ' € Risiko).',
    '5. Take-Profit: ' + formatPreis(target) + ' (Ziel ~' + niveaus.gewinnZielEur + ' €).',
    '6. CFD: Hebel ' +
      niveaus.hebelEmpfohlen +
      '×, Einsatz ~' +
      niveaus.marginEur +
      ' € (Exposure ~' +
      niveaus.exposureEur +
      ' €). Nicht über ' +
      riskEur +
      ' € verlieren.',
    '7. Wenn Trigger nicht erfüllt (kein Gap, falsches Surprise): Trade NICHT erzwingen.',
  ]

  return {
    modus: 'vorbereitung',
    instrumentLabel: 'CFD ' + sym + ' (Earnings-Reaktion: US-Ticker falls .DE gelistet)',
    richtung,
    entryHinweis: 'Market nach Trigger (geschätzt ' + formatPreis(entry) + ')',
    triggerBedingungen,
    schritteJetzt,
    schritteNachEarnings,
    exitBis: null,
    ...niveaus,
  }
}

export function baueHandlungsplanFuerScan(
  e: MomentumScanEintrag,
  richtung: MomentumRichtung | 'warten',
  playbook: MomentumPlaybook,
  istAktiv: boolean,
): MomentumHandlungsplan | null {
  if (richtung !== 'long' && richtung !== 'short') return null
  if (istAktiv) return baueHandlungsplanAusScan(e, richtung)
  return baueHandlungsplanNachEarnings(e, richtung, playbook)
}
