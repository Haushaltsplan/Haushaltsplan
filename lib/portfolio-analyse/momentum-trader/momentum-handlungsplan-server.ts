import 'server-only'

import {
  GAP_MIN_PCT,
  MOMENTUM_DEFAULT_RISK_EUR,
  REWARD_RISK_RATIO,
} from '@/lib/portfolio-analyse/momentum-trader/momentum-constants'
import { momentumPlaybookLabel } from '@/lib/portfolio-analyse/momentum-trader/momentum-constants'
import type {
  MomentumEarningsZeit,
  MomentumHandlungsplan,
  MomentumHandlungsschritt,
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

function formatPreis(n: number): string {
  return n.toFixed(2) + ' $'
}

function earningsZeitfenster(timeBmo: MomentumEarningsZeit | undefined, tage: number): string {
  if (timeBmo === 'bmo') {
    return tage === 0
      ? 'Heute vor US-Eröffnung (BMO) — Reaktion ab 15:30 MEZ'
      : 'BMO: Einstieg nach Zahlen zur US-Eröffnung (15:30 MEZ)'
  }
  if (timeBmo === 'amc') {
    return tage === 0
      ? 'Heute nach US-Schluss (AMC) — Reaktion morgen zur Eröffnung'
      : 'AMC: Reaktion am Folgetag zur US-Eröffnung (15:30 MEZ)'
  }
  return 'Nach Bekanntgabe der Zahlen — erst Sync + Scan, dann handeln'
}

function schritteZuLegacy(schritte: MomentumHandlungsschritt[]): {
  jetzt: string[]
  nach: string[]
} {
  const jetzt: string[] = []
  const nach: string[] = []
  for (const s of schritte) {
    const line = s.detail ? s.nr + '. ' + s.titel + ' — ' + s.detail : s.nr + '. ' + s.titel
    if (s.phase === 'nach_event') nach.push(line)
    else jetzt.push(line)
  }
  return { jetzt, nach }
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

function planBasis(
  partial: Omit<
    MomentumHandlungsplan,
    'schritteJetzt' | 'schritteNachEarnings'
  > & { schritte: MomentumHandlungsschritt[] },
): MomentumHandlungsplan {
  const legacy = schritteZuLegacy(partial.schritte)
  return {
    ...partial,
    schritteJetzt: legacy.jetzt,
    schritteNachEarnings: legacy.nach,
  }
}

/** Konkreter Trade-Plan aus aktivem Scan-Setup. */
export function baueHandlungsplanAusScan(
  e: MomentumScanEintrag,
  richtung: MomentumRichtung,
): MomentumHandlungsplan | null {
  const entry = alsZahl(e.indikatoren.entryPrice, 0) || alsZahl(e.indikatoren.letzterKurs, 0)
  const stop = alsZahl(e.indikatoren.stopPrice, 0)
  const target = alsZahl(e.indikatoren.targetPrice, 0)
  const atrOk =
    alsZahl(e.indikatoren.atr, 0) > 0 ||
    alsZahl(e.indikatoren.atr14, 0) > 0 ||
    alsZahl(e.indikatoren.atrImpliedMovePct, 0) > 0
  if (entry <= 0 || stop <= 0 || target <= 0 || !atrOk) return null

  const riskEur = alsZahl(e.indikatoren.riskEur, MOMENTUM_DEFAULT_RISK_EUR)
  const niveaus = baueNiveaus(entry, stop, target, riskEur)
  const sym = e.symbol
  const rLabel = richtung === 'long' ? 'Long' : 'Short'
  const exitBis = typeof e.indikatoren.exitBis === 'string' ? e.indikatoren.exitBis : null
  const tage = alsZahl(e.indikatoren.tageBisEarnings, -1)
  const timeBmo = e.indikatoren.timeBmoAmc as MomentumEarningsZeit | undefined
  const zeitfenster =
    e.playbook === 'earnings_pre_run'
      ? 'Jetzt bis spätestens vor Earnings schließen' + (exitBis ? ' (' + exitBis + ')' : '')
      : earningsZeitfenster(timeBmo, 0)

  const schritte: MomentumHandlungsschritt[] = []
  const nichtTun: string[] = [
    'Kein Nachkaufen oder Stop nachziehen ohne neuen Scan',
    'Max. ' + riskEur + ' € Verlust — nicht erhöhen',
  ]

  if (e.playbook === 'earnings_pre_run') {
    schritte.push(
      { nr: 1, phase: 'jetzt', titel: rLabel + ' eröffnen (' + sym + ')', detail: 'Market ~' + formatPreis(entry) },
      {
        nr: 2,
        phase: 'jetzt',
        titel: 'Stop-Loss sofort setzen',
        detail: formatPreis(stop) + ' (−' + niveaus.stopAbstandPct + '% = ' + riskEur + ' €)',
      },
      {
        nr: 3,
        phase: 'jetzt',
        titel: 'Take-Profit setzen',
        detail: formatPreis(target) + ' (+' + niveaus.zielAbstandPct + '%, ~' + niveaus.gewinnZielEur + ' €)',
      },
      {
        nr: 4,
        phase: 'jetzt',
        titel: 'CFD: Hebel ' + niveaus.hebelEmpfohlen + '×',
        detail: 'Einsatz ~' + niveaus.marginEur + ' €, Exposure ~' + niveaus.exposureEur + ' €',
      },
      {
        nr: 5,
        phase: 'risiko',
        titel: 'Pflicht-Exit vor Earnings',
        detail:
          (tage >= 0 ? 'In ' + tage + ' Tag(en) ' : '') +
          'Position schließen — nicht über die Zahlen halten',
      },
      {
        nr: 6,
        phase: 'nach_event',
        titel: 'Nach Earnings: Sync + Scan',
        detail: 'Separates Gap-Fade/Momentum-Setup prüfen',
      },
    )
    nichtTun.push('Position nicht über Earnings halten — Event-Risiko')
  } else {
    schritte.push(
      {
        nr: 1,
        phase: 'jetzt',
        titel: rLabel + ' — ' + momentumPlaybookLabel(e.playbook),
        detail: sym + ' · Market ~' + formatPreis(entry),
      },
      {
        nr: 2,
        phase: 'jetzt',
        titel: 'Stop-Loss setzen',
        detail: formatPreis(stop) + ' — Verlust am Stop = ' + riskEur + ' €',
      },
      {
        nr: 3,
        phase: 'jetzt',
        titel: 'Take-Profit setzen',
        detail: formatPreis(target) + ' (~' + niveaus.gewinnZielEur + ' € bei 2:1)',
      },
      {
        nr: 4,
        phase: 'jetzt',
        titel: 'CFD Hebel ' + niveaus.hebelEmpfohlen + '×',
        detail: 'Einsatz ~' + niveaus.marginEur + ' €',
      },
      {
        nr: 5,
        phase: 'risiko',
        titel: 'Bei Ampel Rot oder Gate-Bruch',
        detail: 'Sofort schließen — Setup ungültig',
      },
    )
    nichtTun.push('Nicht gegen Regime handeln (Scan-Gates prüfen)')
  }

  return planBasis({
    modus: 'aktiv',
    instrumentLabel: 'CFD ' + sym + (sym.includes('.') ? ' — US-Ticker für Earnings-Session' : ''),
    richtung,
    entryHinweis: 'Market jetzt',
    triggerBedingungen: [],
    schritte,
    nichtTun,
    zeitfenster,
    exitBis,
    ...niveaus,
  })
}

/** Vorbereitungs-Plan — noch kein Einstieg, klare IF-THEN-Trigger. */
export function baueHandlungsplanNachEarnings(
  e: MomentumScanEintrag,
  richtung: MomentumRichtung,
  playbook: MomentumPlaybook,
): MomentumHandlungsplan | null {
  const kurs = alsZahl(e.indikatoren.letzterKurs, 0)
  const atrMove = alsZahl(e.indikatoren.atrImpliedMovePct, 0)
  if (kurs <= 0 || atrMove <= 0) return null

  const median = Math.max(alsZahl(e.indikatoren.medianGapPct, 0), 0.5)
  const erwartet = alsZahl(e.indikatoren.erwarteteBewegungPct, Math.max(median, 3))
  const atrPct = Math.max(atrMove, 1.5) / 100
  const beat = alsZahl(e.indikatoren.beatRatePct, 50)
  const gapUp = alsZahl(e.indikatoren.gapUpRatePct, 50)
  const tage = alsZahl(e.indikatoren.tageBisEarnings, -1)
  const timeBmo = e.indikatoren.timeBmoAmc as MomentumEarningsZeit | undefined
  const riskEur = MOMENTUM_DEFAULT_RISK_EUR
  const rLabel = richtung === 'long' ? 'Long' : 'Short'

  const gapSchwelle = runde2(Math.max(GAP_MIN_PCT, Math.min(12, Math.max(median * 2, erwartet * 0.6, 3))))
  const triggerBedingungen: string[] = []

  let entry: number
  let stop: number
  let target: number

  if (richtung === 'short' && playbook === 'earnings_gap_fade') {
    triggerBedingungen.push('EPS Beat (Surprise > 0%)')
    triggerBedingungen.push('Gap-Up ≥ ' + gapSchwelle + '% an der Eröffnung')
    triggerBedingungen.push('RVOL ≥ 1,5× (nach Sync im Scan)')
    entry = runde4(kurs * (1 + gapSchwelle / 100))
    const stopDist = kurs * atrPct * 1.35
    stop = runde4(entry + stopDist)
    target = runde4(entry - stopDist * REWARD_RISK_RATIO)
  } else if (richtung === 'long' && playbook === 'earnings_gap_fade') {
    triggerBedingungen.push('EPS Miss (Surprise < 0%)')
    triggerBedingungen.push('Gap-Down ≤ −' + gapSchwelle + '%')
    triggerBedingungen.push('RVOL ≥ 1,5× (nach Sync im Scan)')
    entry = runde4(kurs * (1 - gapSchwelle / 100))
    const stopDist = kurs * atrPct * 1.35
    stop = runde4(entry - stopDist)
    target = runde4(entry + stopDist * REWARD_RISK_RATIO)
  } else {
    triggerBedingungen.push('EPS Beat + Kurs hält Gap (Tag 1 bullisch)')
    triggerBedingungen.push('RS vs. S&P positiv (im Scan)')
    entry = runde4(kurs * (1 + gapSchwelle * 0.6 / 100))
    const stopDist = kurs * atrPct * 1.2
    stop = runde4(entry - stopDist)
    target = runde4(entry + stopDist * REWARD_RISK_RATIO)
  }

  const niveaus = baueNiveaus(entry, stop, target, riskEur)
  const sym = e.symbol
  const zeitfenster = earningsZeitfenster(timeBmo, tage)

  const schritte: MomentumHandlungsschritt[] = [
    {
      nr: 1,
      phase: 'jetzt',
      titel: 'Jetzt: kein Trade',
      detail:
        'Earnings' +
        (tage >= 0 ? ' in ' + tage + ' Tag(en)' : ' stehen bevor') +
        ' — nur vorbereiten',
    },
    {
      nr: 2,
      phase: 'jetzt',
      titel: 'Alarm setzen',
      detail: sym + ' am Earnings-Tag · Beat-Rate ' + beat + '%, Gap-Up ' + gapUp + '%',
    },
    {
      nr: 3,
      phase: 'trigger',
      titel: 'Trigger merken',
      detail: 'Nur handeln wenn ALLE Bedingungen erfüllt (siehe unten)',
    },
    ...triggerBedingungen.map((t, i) => ({
      nr: 4 + i,
      phase: 'trigger' as const,
      titel: t,
      detail: 'Pflicht — sonst kein Trade',
    })),
    {
      nr: 4 + triggerBedingungen.length,
      phase: 'nach_event',
      titel: 'Nach Zahlen: Sync + Scan',
      detail: '„Alles aktualisieren“ — Gap, RVOL, Surprise frisch prüfen',
    },
    {
      nr: 5 + triggerBedingungen.length,
      phase: 'nach_event',
      titel: rLabel + ' eröffnen wenn Trigger grün',
      detail: 'Einstieg ~' + formatPreis(entry) + ' · ' + zeitfenster,
    },
    {
      nr: 6 + triggerBedingungen.length,
      phase: 'nach_event',
      titel: 'Stop + Take-Profit sofort',
      detail:
        'SL ' +
        formatPreis(stop) +
        ' · TP ' +
        formatPreis(target) +
        ' · Hebel ' +
        niveaus.hebelEmpfohlen +
        '× (~' +
        niveaus.marginEur +
        ' €)',
    },
  ]

  const nichtTun = [
    'Vor den Zahlen blind ' + rLabel + ' eröffnen',
    'Trade erzwingen wenn Gap oder Surprise nicht passt',
    'Mehr als ' + riskEur + ' € riskieren',
    'Ohne frischen Scan nach Earnings handeln',
  ]

  if (tage <= 7 && tage >= 1) {
    schritte.splice(2, 0, {
      nr: 3,
      phase: 'jetzt',
      titel: 'Optional: Pre-Run prüfen',
      detail: 'Scan-Filter „Pre-Event“ — nur mit Exit vor Earnings',
    })
  }

  return planBasis({
    modus: 'vorbereitung',
    instrumentLabel: 'CFD ' + sym,
    richtung,
    entryHinweis: 'Nach Trigger ~' + formatPreis(entry),
    triggerBedingungen,
    schritte: schritte.map((s, i) => ({ ...s, nr: i + 1 })),
    nichtTun,
    zeitfenster,
    exitBis: null,
    ...niveaus,
  })
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
