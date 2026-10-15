import { addDaysIso, heuteIsoLocal } from '@/lib/trainingsplan/date-utils'
import { exercisesForKind, istSchwereKraft } from '@/lib/trainingsplan/weekly-plan'
import type { DaySession, SessionKind } from '@/lib/trainingsplan/types'

export type RescheduleResult = {
  days: DaySession[]
  note: string
  ok: boolean
}

function cloneDays(days: DaySession[]): DaySession[] {
  return days.map((d) => ({
    ...d,
    exercises: d.exercises?.map((e) => ({ ...e })),
    stravaRides: d.stravaRides?.map((r) => ({ ...r })),
  }))
}

function rebuildIds(days: DaySession[]): DaySession[] {
  return days.map((d) => ({
    ...d,
    id: `${d.dateIso}-${d.kind}`,
    weekday: (() => {
      const [y, m, day] = d.dateIso.split('-').map(Number)
      return new Date(y!, m! - 1, day!, 12).getDay()
    })(),
    exercises: d.exercises ?? exercisesForKind(d.kind),
  }))
}

export function hatKraftKonflikt(days: DaySession[]): boolean {
  const sorted = [...days].sort((a, b) => a.dateIso.localeCompare(b.dateIso))
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i]!
    const b = sorted[i + 1]!
    if (!istSchwereKraft(a.kind) || !istSchwereKraft(b.kind)) continue
    if (addDaysIso(a.dateIso, 1) === b.dateIso) return true
  }
  return false
}

function makeRuhe(dateIso: string, title = 'Ruhetag (angepasst)'): DaySession {
  return {
    id: `${dateIso}-ruhe`,
    dateIso,
    weekday: new Date(dateIso + 'T12:00:00').getDay(),
    kind: 'ruhe',
    title,
    subtitle: 'Coach hat Erholung eingefügt — Schultern & Nervensystem danken es dir.',
    durationMin: 0,
    completed: false,
  }
}

function swapSessionBodies(a: DaySession, b: DaySession): [DaySession, DaySession] {
  const aBody = {
    kind: a.kind,
    title: a.title,
    subtitle: a.subtitle,
    durationMin: a.durationMin,
    rennradFokus: a.rennradFokus,
    exercises: a.exercises,
    completed: a.completed,
    postponedFrom: a.postponedFrom,
  }
  const bBody = {
    kind: b.kind,
    title: b.title,
    subtitle: b.subtitle,
    durationMin: b.durationMin,
    rennradFokus: b.rennradFokus,
    exercises: b.exercises,
    completed: b.completed,
    postponedFrom: b.postponedFrom,
  }
  return [
    { ...a, ...bBody, dateIso: a.dateIso, stravaRides: a.stravaRides },
    { ...b, ...aBody, dateIso: b.dateIso, stravaRides: b.stravaRides },
  ]
}

/**
 * Verschiebt einen Tag (Ruhe, Aktiv, Kraft, Rad) um einen Slot vor/zurück
 * durch Tausch mit dem Nachbarn. Kraft-Abstand wird danach erzwungen.
 */
export function verschiebeTag(
  days: DaySession[],
  dateIso: string,
  direction: 'vor' | 'zurueck',
  heute: string = heuteIsoLocal(),
): RescheduleResult {
  const sorted = cloneDays(days).sort((a, b) => a.dateIso.localeCompare(b.dateIso))
  const idx = sorted.findIndex((d) => d.dateIso === dateIso)
  if (idx < 0) return { days, note: 'Tag nicht gefunden.', ok: false }

  const moving = sorted[idx]!
  if (moving.completed) {
    return { days, note: 'Erledigte Tage lassen sich nicht mehr verschieben.', ok: false }
  }
  if (dateIso < heute) {
    return { days, note: 'Vergangene Tage lassen sich nicht mehr verschieben.', ok: false }
  }

  const neighborIdx = direction === 'vor' ? idx - 1 : idx + 1
  if (neighborIdx < 0 || neighborIdx >= sorted.length) {
    return {
      days,
      note: direction === 'vor' ? 'Kein früherer Tag in dieser Woche.' : 'Kein späterer Tag in dieser Woche.',
      ok: false,
    }
  }

  const neighbor = sorted[neighborIdx]!
  if (neighbor.completed) {
    return { days, note: 'Nachbar-Tag ist schon erledigt — Tausch nicht möglich.', ok: false }
  }
  if (neighbor.dateIso < heute && direction === 'vor') {
    return { days, note: 'Kann nicht auf einen vergangenen Tag tauschen.', ok: false }
  }

  const [a, b] = swapSessionBodies(moving, neighbor)
  sorted[idx] = a
  sorted[neighborIdx] = b

  let next = rebuildIds(sorted)
  next = enforceKraftSpacing(next, heute)

  const dirLabel = direction === 'vor' ? 'nach vorne' : 'nach hinten'
  const kindHint =
    moving.kind === 'ruhe'
      ? 'Ruhetag'
      : moving.kind === 'aktiv'
        ? 'Aktiv-Tag'
        : 'Einheit'

  return {
    days: next,
    note: `Erledigt: ${kindHint} ${dirLabel} geschoben — Erholung und Kraft bleiben sinnvoll getrennt.`,
    ok: true,
  }
}

/**
 * Smart Rescheduling: verschiebt die Einheit von `dateIso` auf den nächsten Tag
 * und baut die restliche Woche um. Sicherheitsregel: nie zwei schwere
 * Oberkörper-Krafttage hintereinander.
 */
export function verschiebeAufMorgen(
  days: DaySession[],
  dateIso: string,
  heute: string = heuteIsoLocal(),
): RescheduleResult {
  const sorted = cloneDays(days).sort((a, b) => a.dateIso.localeCompare(b.dateIso))
  const idx = sorted.findIndex((d) => d.dateIso === dateIso)
  if (idx < 0) {
    return { days, note: 'Tag nicht gefunden.', ok: false }
  }

  const moving = sorted[idx]!
  if (moving.completed) {
    return { days, note: 'Diese Einheit ist schon erledigt — nichts zu verschieben.', ok: false }
  }
  if (moving.kind === 'ruhe' || moving.kind === 'aktiv') {
    return verschiebeTag(days, dateIso, 'zurueck', heute)
  }
  if (dateIso < heute) {
    return { days, note: 'Vergangene Tage lassen sich nicht mehr verschieben.', ok: false }
  }

  const tomorrow = addDaysIso(dateIso, 1)
  const weekEnd = sorted[sorted.length - 1]?.dateIso
  if (weekEnd && tomorrow > weekEnd) {
    sorted[idx] = makeRuhe(dateIso, 'Ruhetag (verschoben)')
    const rolled: DaySession = {
      ...moving,
      dateIso: tomorrow,
      postponedFrom: dateIso,
      title: `${moving.title} (von ${dateIso.slice(5)} verschoben)`,
      completed: false,
    }
    const next = rebuildIds([...sorted, rolled].sort((a, b) => a.dateIso.localeCompare(b.dateIso)))
    const fixed = enforceKraftSpacing(next, heute)
    return {
      days: fixed,
      note: 'Kein Stress! Ich habe deine Einheit auf morgen gelegt und die Erholung angepasst.',
      ok: true,
    }
  }

  const payload: { kind: SessionKind; session: DaySession }[] = []
  for (let i = idx; i < sorted.length; i++) {
    const d = sorted[i]!
    if (d.completed) continue
    if ((d.kind === 'ruhe' || d.kind === 'aktiv') && i !== idx) continue
    payload.push({ kind: d.kind, session: { ...d } })
  }

  const targets: string[] = []
  for (let i = 0; i < payload.length; i++) {
    targets.push(addDaysIso(tomorrow, i))
  }

  for (let i = idx; i < sorted.length; i++) {
    if (sorted[i]!.completed) continue
    sorted[i] = makeRuhe(sorted[i]!.dateIso)
  }

  const extras: DaySession[] = []
  for (let i = 0; i < payload.length; i++) {
    const target = targets[i]!
    const src = payload[i]!.session
    const nextSession: DaySession = {
      ...src,
      dateIso: target,
      postponedFrom: i === 0 ? dateIso : src.postponedFrom,
      completed: false,
      title: i === 0 ? `${src.title.replace(/ \(von .*\)/, '')}` : src.title,
    }
    const existingIdx = sorted.findIndex((d) => d.dateIso === target)
    if (existingIdx >= 0) {
      if (sorted[existingIdx]!.completed) {
        extras.push(nextSession)
      } else {
        sorted[existingIdx] = nextSession
      }
    } else {
      extras.push(nextSession)
    }
  }

  let next = rebuildIds([...sorted, ...extras].sort((a, b) => a.dateIso.localeCompare(b.dateIso)))
  next = enforceKraftSpacing(next, heute)

  return {
    days: next,
    note: 'Kein Stress! Ich habe deinen Plan umgebaut, damit deine Erholung passt.',
    ok: true,
  }
}

/** Wenn du an einem Ruhe-/Aktiv-Tag doch Rad gefahren bist → Tag als Rennrad werten. */
export function werteAlsRennrad(
  days: DaySession[],
  dateIso: string,
): RescheduleResult {
  const sorted = cloneDays(days)
  const idx = sorted.findIndex((d) => d.dateIso === dateIso)
  if (idx < 0) return { days, note: 'Tag nicht gefunden.', ok: false }
  const d = sorted[idx]!
  if (d.kind === 'rennrad') {
    return { days, note: 'Ist bereits ein Radtag.', ok: false }
  }
  if (!d.stravaRides?.length) {
    return { days, note: 'Keine Strava-Fahrt an diesem Tag gefunden.', ok: false }
  }
  const km = d.stravaRides.reduce((s, r) => s + r.distanceKm, 0)
  sorted[idx] = {
    ...d,
    kind: 'rennrad',
    title: 'Rennrad (Strava)',
    subtitle: `Von Strava übernommen · ${km.toFixed(1)} km — Plan flexibel angepasst.`,
    durationMin: d.stravaRides.reduce((s, r) => s + r.movingTimeMin, 0),
    rennradFokus: km >= 70 ? 'longride' : km >= 40 ? 'tempo' : 'ausdauer',
    exercises: undefined,
    completed: true,
  }
  return {
    days: rebuildIds(sorted),
    note: `Stark! ${km.toFixed(1)} km aus Strava als Rad-Einheit gespeichert.`,
    ok: true,
  }
}

export function enforceKraftSpacing(days: DaySession[], heute: string): DaySession[] {
  let result = cloneDays(days).sort((a, b) => a.dateIso.localeCompare(b.dateIso))
  let guard = 0

  while (hatKraftKonflikt(result) && guard < 12) {
    guard++
    const sorted = [...result].sort((a, b) => a.dateIso.localeCompare(b.dateIso))
    let fixed = false

    for (let i = 0; i < sorted.length - 1; i++) {
      const a = sorted[i]!
      const b = sorted[i + 1]!
      if (!istSchwereKraft(a.kind) || !istSchwereKraft(b.kind)) continue
      if (addDaysIso(a.dateIso, 1) !== b.dateIso) continue
      if (b.completed || b.dateIso < heute) continue

      const swapIdx = sorted.findIndex(
        (d, j) =>
          j > i + 1 &&
          !d.completed &&
          d.dateIso >= heute &&
          !istSchwereKraft(d.kind),
      )

      if (swapIdx > 0) {
        const swap = sorted[swapIdx]!
        const bKind = b.kind
        const bTitle = b.title
        const bSub = b.subtitle
        const bDur = b.durationMin
        const bEx = b.exercises
        const bRad = b.rennradFokus

        sorted[i + 1] = {
          ...b,
          kind: swap.kind,
          title: swap.title,
          subtitle: swap.subtitle,
          durationMin: swap.durationMin,
          exercises: swap.exercises,
          rennradFokus: swap.rennradFokus,
        }
        sorted[swapIdx] = {
          ...swap,
          kind: bKind,
          title: bTitle,
          subtitle: bSub,
          durationMin: bDur,
          exercises: bEx,
          rennradFokus: bRad,
        }
        fixed = true
        break
      }

      const pushedDate = addDaysIso(b.dateIso, 1)
      sorted[i + 1] = makeRuhe(b.dateIso, 'Ruhetag (Kraft-Abstand)')
      const pushed: DaySession = {
        ...b,
        dateIso: pushedDate,
        title: b.title.replace(/ \(verschoben\)/, '') + ' (verschoben)',
      }
      const exist = sorted.findIndex((d) => d.dateIso === pushedDate)
      if (exist >= 0 && !sorted[exist]!.completed) {
        const victim = sorted[exist]!
        sorted[exist] = pushed
        if (!istSchwereKraft(victim.kind)) {
          sorted.push({ ...victim, dateIso: addDaysIso(pushedDate, 1) })
        }
      } else {
        sorted.push(pushed)
      }
      fixed = true
      break
    }

    if (!fixed) break
    result = rebuildIds(sorted)
  }

  return rebuildIds(result)
}
