/** Strava — Regelbasierte Coach-Zusammenfassung aus allen Analytics-Daten. */

import { istRadAktivitaet } from '@/lib/strava/strava-auswertung'
import type { GoalProgress } from '@/lib/strava/strava-goals'
import type { ConsistencyStats, IntensityMix, YearCompare } from '@/lib/strava/strava-insights'
import type { TssAdherence, TssBudgetStats } from '@/lib/strava/strava-progress-analytics'
import { geschaetztesTss, type FormPoint } from '@/lib/strava/strava-training-load'
import type { StravaActivityRow, StravaAthleteProfile } from '@/lib/strava/strava-types'

export type CoachMood = 'excellent' | 'good' | 'neutral' | 'caution' | 'recovery'

export type CoachHighlight = {
  label: string
  value: string
  tone: 'positive' | 'neutral' | 'warning' | 'accent'
}

export type CoachTssGuide = {
  userTarget: number
  isUserDefined: boolean
  recommendedMin: number
  recommendedMax: number
  thisWeekTss: number
  lastWeekTss: number
  avgWeeklyTss: number | null
  ctl: number | null
  pctOfTarget: number | null
  status: 'under' | 'on_track' | 'high' | 'spike' | 'recovery_needed'
  statusLabel: string
  /** Was ist bei TSS „gut“ — allgemein für dein Niveau */
  rangeExplanation: string
  /** Konkrete Empfehlung für die nächsten 7 Tage */
  weekAdvice: string
}

export type CoachSummary = {
  headline: string
  mood: CoachMood
  /** Fließtext — 2–4 Sätze, ändert sich mit den Daten */
  narrative: string
  bullets: string[]
  tssGuide: CoachTssGuide
  highlights: CoachHighlight[]
  updatedLabel: string
}

type Input = {
  activities: StravaActivityRow[]
  athlete: StravaAthleteProfile | null
  currentForm: FormPoint | null
  consistency: ConsistencyStats
  intensityMix: IntensityMix
  yearCompare: YearCompare[]
  goals: GoalProgress[]
  tssBudget: TssBudgetStats
  tssAdherence: TssAdherence
  eftp: number | null
  monthlyEftpTrend: { recent: number | null; prior: number | null }
}

function startOfWeek(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  const day = x.getDay()
  x.setDate(x.getDate() + (day === 0 ? -6 : 1 - day))
  return x
}

function weeklyHours(activities: StravaActivityRow[], weeks: number, now = new Date()): number {
  const rides = activities.filter(istRadAktivitaet)
  const from = now.getTime() - weeks * 7 * 86_400_000
  const list = rides.filter((a) => Date.parse(a.start_date) >= from)
  const h = list.reduce((s, a) => s + a.moving_time_s, 0) / 3600
  return weeks > 0 ? h / weeks : 0
}

function weekTss(activities: StravaActivityRow[], weekOffset: number, ftp: number | null, now = new Date()): number {
  const rides = activities.filter(istRadAktivitaet)
  const ws = startOfWeek(now)
  ws.setDate(ws.getDate() - weekOffset * 7)
  const we = new Date(ws)
  we.setDate(we.getDate() + 6)
  we.setHours(23, 59, 59, 999)
  return Math.round(
    rides
      .filter((a) => {
        const t = Date.parse(a.start_date)
        return t >= ws.getTime() && t <= we.getTime()
      })
      .reduce((s, a) => s + geschaetztesTss(a, ftp), 0),
  )
}

/** Empfohlener TSS-Bereich aus Trainingsumfang (Stunden/Woche) und CTL. */
export function empfohlenerTssBereich(
  avgHoursWeek: number,
  ctl: number | null,
): { min: number; max: number; explanation: string } {
  let min: number
  let max: number
  let level: string

  if (avgHoursWeek < 3) {
    min = 80
    max = 180
    level = 'Einsteiger / wenig Zeit (unter 3 h/Woche)'
  } else if (avgHoursWeek < 6) {
    min = 150
    max = 280
    level = 'Hobby mit regelmäßigem Training (3–6 h/Woche)'
  } else if (avgHoursWeek < 10) {
    min = 250
    max = 450
    level = 'Ambitionierter Ausdauersportler (6–10 h/Woche)'
  } else if (avgHoursWeek < 14) {
    min = 400
    max = 650
    level = 'Hohes Volumen (10–14 h/Woche)'
  } else {
    min = 550
    max = 900
    level = 'Sehr hohes Volumen (14+ h/Woche)'
  }

  if (ctl != null && ctl > 20) {
    const ctlLow = Math.round(ctl * 0.85)
    const ctlHigh = Math.round(ctl * 1.15)
    min = Math.round((min + ctlLow) / 2)
    max = Math.round((max + ctlHigh) / 2)
  }

  const explanation =
    `Für ${level} gelten typischerweise ${min}–${max} TSS pro Woche. ` +
    'TSS misst die kumulative Belastung (Dauer × Intensität). ' +
    'Eine lockere Ausfahrt liegt oft bei 40–80 TSS, ein hartes Intervalltraining bei 100–150+, ein langes Tempo/Rennen bei 150–250+. ' +
    'Wichtiger als die absolute Zahl: gleichmäßige Steigerung (max. ~10 % pro Woche) und genug Erholung.'

  return { min, max, explanation }
}

function buildTssGuide(input: Input, ftp: number | null, now = new Date()): CoachTssGuide {
  const { tssBudget, tssAdherence, currentForm, activities } = input
  const userTarget = tssBudget.weeklyTarget
  const isUserDefined = input.athlete?.goal_tss_week != null && input.athlete.goal_tss_week > 0
  const avgHours = weeklyHours(activities, 4, now)
  const ctl = currentForm?.ctl ?? null
  const { min, max, explanation } = empfohlenerTssBereich(avgHours, ctl)

  const thisWeekTss = weekTss(activities, 0, ftp, now)
  const lastWeekTss = weekTss(activities, 1, ftp, now)
  const avgWeeklyTss = tssAdherence.avgWeeklyTss

  let status: CoachTssGuide['status'] = 'on_track'
  let statusLabel = 'Im Zielkorridor'
  let weekAdvice = `Diese Woche strebst du ${userTarget} TSS an — verteile sie auf 3–5 Einheiten mit viel leichter Intensität (Zone 2) und wenig harten Anteilen.`

  const pctOfTarget = userTarget > 0 ? Math.round((thisWeekTss / userTarget) * 100) : null

  if (currentForm?.tsb != null && currentForm.tsb < -20) {
    status = 'recovery_needed'
    statusLabel = 'Erholung priorisieren'
    weekAdvice =
      `Form (TSB ${currentForm.tsb}) ist tief — diese Woche eher ${Math.round(userTarget * 0.5)}–${Math.round(userTarget * 0.7)} TSS in leichten Einheiten, keine langen harten Blöcke.`
  } else if (lastWeekTss > 0 && thisWeekTss > lastWeekTss * 1.45 && thisWeekTss > userTarget * 1.2) {
    status = 'spike'
    statusLabel = 'Belastungssprung'
    weekAdvice =
      'Deutlicher Anstieg gegenüber der Vorwoche — nächste Tage eher locker fahren, sonst steigt das Überlastungsrisiko.'
  } else if (thisWeekTss > userTarget * 1.2 || (avgWeeklyTss != null && avgWeeklyTss > max * 1.1)) {
    status = 'high'
    statusLabel = 'Hohe Belastung'
    weekAdvice = `Du liegst über dem Wochenziel (${thisWeekTss} vs. ${userTarget} TSS). Plane 1–2 Ruhtage oder sehr leichte Fahrten ein.`
  } else if (thisWeekTss < userTarget * 0.6 && lastWeekTss < userTarget * 0.85) {
    status = 'under'
    statusLabel = 'Unter Ziel'
    weekAdvice = `Noch ${Math.max(0, userTarget - thisWeekTss)} TSS bis zum Wochenziel — z. B. eine moderate Ausfahrt (60–90 TSS) oder längere Zone-2-Einheit.`
  } else if (pctOfTarget != null && pctOfTarget >= 85 && pctOfTarget <= 115) {
    status = 'on_track'
    statusLabel = 'Im Zielkorridor'
    weekAdvice = `Gut im Plan (${thisWeekTss}/${userTarget} TSS diese Woche). Halte das Volumen stabil, harte Tage gezielt setzen.`
  }

  if (!isUserDefined) {
    weekAdvice +=
      ` Du hast kein persönliches TSS-Wochenziel — unter „Saisonziele“ z. B. ${Math.round((min + max) / 2)} TSS eintragen oder wir nutzen ${userTarget} als Standard.`
  }

  return {
    userTarget,
    isUserDefined,
    recommendedMin: min,
    recommendedMax: max,
    thisWeekTss,
    lastWeekTss,
    avgWeeklyTss,
    ctl,
    pctOfTarget,
    status,
    statusLabel,
    rangeExplanation: explanation,
    weekAdvice,
  }
}

export function berechneCoachSummary(input: Input, now = new Date()): CoachSummary {
  const ftp = input.athlete?.ftp ?? input.eftp ?? null
  const tssGuide = buildTssGuide(input, ftp, now)
  const bullets: string[] = []
  const highlights: CoachHighlight[] = []
  let mood: CoachMood = 'neutral'
  let headline = 'Dein Trainingsbild'

  const rides = input.activities.filter(istRadAktivitaet).sort((a, b) => Date.parse(b.start_date) - Date.parse(a.start_date))
  const tsb = input.currentForm?.tsb ?? null
  const ctl = input.currentForm?.ctl ?? null

  // —— Form / TSB ——
  if (tsb != null) {
    highlights.push({
      label: 'Form (TSB)',
      value: `${tsb > 0 ? '+' : ''}${tsb}`,
      tone: tsb > 10 ? 'positive' : tsb < -15 ? 'warning' : 'neutral',
    })
    if (tsb > 15) {
      mood = 'excellent'
      headline = 'Frisch und leistungsfähig'
      bullets.push(
        `Deine Form (TSB ${tsb}) ist hoch — guter Zeitpunkt für intensive Einheiten, längere Tempofahrten oder ein Wettkampf.`,
      )
    } else if (tsb > 0) {
      mood = mood === 'neutral' ? 'good' : mood
      headline = 'Solide Form'
      bullets.push(`TSB ${tsb}: ausgewogene Balance aus Fitness und Frische — planbare Belastung möglich.`)
    } else if (tsb > -15) {
      mood = 'caution'
      headline = 'Leicht ermüdet'
      bullets.push(
        `TSB ${tsb}: du baust Belastung auf (CTL ${ctl ?? '—'}). Achte auf Schlaf und lockere Tage zwischen harten Sessions.`,
      )
    } else {
      mood = 'recovery'
      headline = 'Erholung nötig'
      bullets.push(
        `TSB ${tsb} signalisiert Überreizung — reduziere Volumen und Intensität, bis die Form wieder positiv wird.`,
      )
    }
  }

  // —— TSS diese Woche ——
  highlights.push({
    label: 'TSS diese Woche',
    value: `${tssGuide.thisWeekTss} / ${tssGuide.userTarget}`,
    tone:
      tssGuide.status === 'on_track'
        ? 'positive'
        : tssGuide.status === 'under'
          ? 'neutral'
          : 'warning',
  })

  bullets.push(tssGuide.weekAdvice)

  // —— Konsistenz ——
  const { consistency } = input
  if (consistency.currentStreakWeeks >= 3) {
    highlights.push({
      label: 'Streak',
      value: `${consistency.currentStreakWeeks} Wo.`,
      tone: 'positive',
    })
    if (consistency.currentStreakWeeks >= 4) {
      bullets.push(
        `${consistency.currentStreakWeeks} Wochen in Folge mit mindestens einer Einheit — Konsistenz ist dein stärkster Hebel (${Math.round(consistency.consistencyPct)} % aktive Wochen im Jahr).`,
      )
      if (mood === 'neutral') mood = 'good'
    }
  } else if (consistency.weeksWithRide > 0 && consistency.currentStreakWeeks === 0) {
    bullets.push('Keine aktuelle Wochenserie — regelmäßige kurze Einheiten helfen mehr als seltene Extremwochen.')
  }

  // —— Intensität ——
  const { intensityMix } = input
  if (intensityMix.easyMin + intensityMix.moderateMin + intensityMix.hardMin > 0) {
    highlights.push({
      label: 'Hard (28 T)',
      value: `${Math.round(intensityMix.hardPct)} %`,
      tone: intensityMix.hardPct > 35 ? 'warning' : intensityMix.hardPct < 10 ? 'neutral' : 'accent',
    })
    if (intensityMix.hardPct > 35) {
      bullets.push(
        `${Math.round(intensityMix.hardPct)} % harte Intensität in den letzten 28 Tagen — für Ausdauer oft ideal: 75–85 % easy, 10–15 % hard (Polarisation).`,
      )
    } else if (intensityMix.hardPct < 8 && intensityMix.easyPct > 70) {
      bullets.push(
        'Überwiegend leichte Intensität — gut für Grundlage. Für Fortschritt gelegentlich Tempo- oder Intervallblöcke einplanen.',
      )
    }
  }

  // —— eFTP Trend ——
  const { recent, prior } = input.monthlyEftpTrend
  if (recent != null && prior != null && prior > 0) {
    const delta = recent - prior
    const pct = Math.round((delta / prior) * 100)
    if (Math.abs(pct) >= 3) {
      highlights.push({
        label: 'eFTP-Trend',
        value: `${delta > 0 ? '+' : ''}${pct} %`,
        tone: delta > 0 ? 'positive' : 'warning',
      })
      bullets.push(
        delta > 0
          ? `Geschätzte FTP stieg ~${pct} % im Monatsvergleich (${prior} → ${recent} W) — Leistungsentwicklung erkennbar.`
          : `eFTP leicht rückläufig (${prior} → ${recent} W) — kann Saisonpause, weniger Intensität oder Messrauschen sein.`,
      )
    }
  } else if (input.eftp != null) {
    highlights.push({ label: 'eFTP', value: `${input.eftp} W`, tone: 'accent' })
  }

  // —— YTD ——
  const kmCompare = input.yearCompare.find((y) => y.label.startsWith('km YTD'))
  if (kmCompare?.changePct != null && Math.abs(kmCompare.changePct) >= 8) {
    bullets.push(
      kmCompare.changePct > 0
        ? `Du liegst ${Math.round(kmCompare.changePct)} % vor dem Vorjahr (${kmCompare.current} vs. ${kmCompare.previous} km YTD).`
        : `${Math.abs(Math.round(kmCompare.changePct))} % weniger km als im Vorjahr — Saisonverlauf oder Fokus prüfen.`,
    )
  }

  // —— Saisonziele ——
  const offTrack = input.goals.filter((g) => !g.onTrack && g.pct < 90)
  const onTrack = input.goals.filter((g) => g.onTrack)
  if (onTrack.length > 0) {
    bullets.push(`Saisonziel im Plan: ${onTrack.map((g) => g.label).join(', ')}.`)
  }
  if (offTrack.length > 0) {
    bullets.push(`Hinter dem Soll: ${offTrack.map((g) => `${g.label} (${Math.round(g.pct)} %)`).join(', ')}.`)
  }

  // —— Letzte Fahrt ——
  if (rides.length > 0) {
    const last = rides[0]
    const daysSince = Math.floor((now.getTime() - Date.parse(last.start_date)) / 86_400_000)
    const lastTss = Math.round(geschaetztesTss(last, ftp))
    if (daysSince <= 2 && lastTss >= 100) {
      bullets.push(
        `Letzte Einheit „${last.name.slice(0, 40)}${last.name.length > 40 ? '…' : ''}" (${daysSince === 0 ? 'heute' : `vor ${daysSince} Tag(en)`}, ~${lastTss} TSS) — ggf. morgen lockerer Tag.`,
      )
    } else if (daysSince >= 4) {
      bullets.push(`Letzte Radfahrt vor ${daysSince} Tagen — für TSS und Konsistenz wäre bald wieder eine Einheit sinnvoll.`)
      if (mood === 'good' || mood === 'excellent') mood = 'neutral'
    }
  } else if (input.activities.length === 0) {
    headline = 'Noch keine Daten'
    mood = 'neutral'
    bullets.length = 0
    bullets.push('Synchronisiere Strava, damit Auswertung und TSS-Empfehlung auf deinen Fahrten basieren.')
  }

  // —— TSS Adherence ——
  if (input.tssAdherence.adherencePct != null && input.tssAdherence.weeksTracked >= 4) {
    if (input.tssAdherence.adherencePct >= 70) {
      highlights.push({
        label: 'TSS-Treffer',
        value: `${input.tssAdherence.adherencePct} %`,
        tone: 'positive',
      })
    } else if (input.tssAdherence.adherencePct < 50) {
      bullets.push(
        `Nur ${input.tssAdherence.adherencePct} % der Wochen am TSS-Ziel — realistisches Wochenziel (${tssGuide.recommendedMin}–${tssGuide.recommendedMax}) setzen oder Volumen schrittweise steigern.`,
      )
    }
  }

  const uniqueBullets = [...new Set(bullets)].slice(0, 5)
  const narrative =
    uniqueBullets.length >= 2
      ? `${uniqueBullets[0]} ${uniqueBullets[1]}`
      : uniqueBullets[0] ?? 'Auswertung läuft — mehr Fahrten und Sync verbessern die Genauigkeit.'

  return {
    headline,
    mood,
    narrative,
    bullets: uniqueBullets,
    tssGuide,
    highlights: highlights.slice(0, 5),
    updatedLabel: now.toLocaleDateString('de-DE', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit',
    }),
  }
}

/** eFTP aus den letzten zwei Monaten mit Daten (für Trend). */
export function monatlicherEftpTrend(
  monthly: { monthKey: string; eftp: number | null }[],
): { recent: number | null; prior: number | null } {
  const withEftp = monthly.filter((m) => m.eftp != null)
  if (withEftp.length < 2) return { recent: withEftp.at(-1)?.eftp ?? null, prior: null }
  return {
    recent: withEftp.at(-1)!.eftp,
    prior: withEftp.at(-2)!.eftp,
  }
}
