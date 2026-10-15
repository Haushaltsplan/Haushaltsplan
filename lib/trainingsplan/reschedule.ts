import { addDaysIso, heuteIsoLocal } from '@/lib/trainingsplan/date-utils'
import {
  applyFlexMode,
  exercisesForKind,
  istRennrad,
  istSchwereKraft,
} from '@/lib/trainingsplan/weekly-plan'
import type { DaySession, FlexDayMode, SessionKind } from '@/lib/trainingsplan/types'

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
  return hatNachbarKonflikt(days, istSchwereKraft)
}

export function hatRennradKonflikt(days: DaySession[]): boolean {
  return hatNachbarKonflikt(days, istRennrad)
}

function hatNachbarKonflikt(
  days: DaySession[],
  pred: (k: SessionKind) => boolean,
): boolean {
  const sorted = [...days].sort((a, b) => a.dateIso.localeCompare(b.dateIso))
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i]!
    const b = sorted[i + 1]!
    if (!pred(a.kind) || !pred(b.kind)) continue
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
    subtitle: 'Coach hat Erholung eingefügt — Abstand zu Rad/Kraft gesichert.',
    durationMin: 0,
    completed: false,
  }
}

function swapSessionBodies(a: DaySession, b: DaySession): [DaySession, DaySession] {
  const pick = (s: DaySession) => ({
    kind: s.kind,
    title: s.title,
    subtitle: s.subtitle,
    durationMin: s.durationMin,
    rennradFokus: s.rennradFokus,
    exercises: s.exercises,
    completed: s.completed,
    postponedFrom: s.postponedFrom,
    isFlexDay: s.isFlexDay,
  })
  const aBody = pick(a)
  const bBody = pick(b)
  return [
    { ...a, ...bBody, dateIso: a.dateIso, stravaRides: a.stravaRides },
    { ...b, ...aBody, dateIso: b.dateIso, stravaRides: b.stravaRides },
  ]
}

/** Flex-Tag (Sa) zwischen Extra-Ruhe und Kurz-Kraft umschalten. */
export function setzeFlexTag(days: DaySession[], mode: FlexDayMode): RescheduleResult {
  const sorted = cloneDays(days)
  const idx = sorted.findIndex((d) => d.isFlexDay)
  if (idx < 0) {
    return { days, note: 'Kein Flex-Tag in dieser Woche gefunden.', ok: false }
  }
  const flex = sorted[idx]!
  if (flex.completed) {
    return { days, note: 'Flex-Tag ist schon erledigt — Modus nicht mehr änderbar.', ok: false }
  }
  if (flex.kind === mode) {
    return {
      days,
      note: mode === 'aktiv' ? 'Flex-Tag ist bereits Kurz-Kraft.' : 'Flex-Tag ist bereits Extra-Ruhe.',
      ok: false,
    }
  }
  sorted[idx] = applyFlexMode(flex, mode)
  return {
    days: rebuildIds(sorted),
    note:
      mode === 'aktiv'
        ? 'Flex-Tag: Kurz-Kraft gewählt — leicht & kurz, kein schwerer Oberkörper.'
        : 'Flex-Tag: Extra-Ruhe gewählt — zwei Erholungstage diese Woche.',
    ok: true,
  }
}

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
  next = enforceSpacing(next, heute)

  const dirLabel = direction === 'vor' ? 'nach vorne' : 'nach hinten'
  const kindHint = moving.isFlexDay
    ? 'Flex-Tag'
    : moving.kind === 'ruhe'
      ? 'Ruhetag'
      : moving.kind === 'aktiv'
        ? 'Kurz-Kraft'
        : 'Einheit'

  return {
    days: next,
    note: `${kindHint} ${dirLabel} geschoben — keine zwei Rad- oder schweren Krafttage hintereinander.`,
    ok: true,
  }
}

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
  if (moving.kind === 'ruhe' || moving.kind === 'aktiv' || moving.isFlexDay) {
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
      isFlexDay: false,
    }
    const next = rebuildIds([...sorted, rolled].sort((a, b) => a.dateIso.localeCompare(b.dateIso)))
    return {
      days: enforceSpacing(next, heute),
      note: 'Kein Stress! Einheit auf morgen gelegt — Rad- und Kraft-Abstand gesichert.',
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
  next = enforceSpacing(next, heute)

  return {
    days: next,
    note: 'Kein Stress! Plan umgebaut — keine zwei Rad- oder schweren Krafttage hintereinander.',
    ok: true,
  }
}

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

  // Prüfe Nachbarn: kein zweiter Radtag direkt daneben (außer schon completed-Konflikt historisch)
  const prev = sorted.find((x) => x.dateIso === addDaysIso(dateIso, -1))
  const nextD = sorted.find((x) => x.dateIso === addDaysIso(dateIso, 1))
  if (prev?.kind === 'rennrad' || nextD?.kind === 'rennrad') {
    return {
      days,
      note: 'Zwei Rennradtage hintereinander sind tabu. Schiebe einen Radtag erst um, dann werten.',
      ok: false,
    }
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
    isFlexDay: false,
  }
  return {
    days: rebuildIds(sorted),
    note: `Stark! ${km.toFixed(1)} km aus Strava als Rad-Einheit gespeichert.`,
    ok: true,
  }
}

/** Nie zwei schwere Kraft- ODER zwei Rennrad-Tage hintereinander. */
export function enforceSpacing(days: DaySession[], heute: string): DaySession[] {
  let result = cloneDays(days).sort((a, b) => a.dateIso.localeCompare(b.dateIso))
  result = resolveNachbarKonflikte(result, heute, istSchwereKraft, 'Kraft-Abstand')
  result = resolveNachbarKonflikte(result, heute, istRennrad, 'Rad-Abstand')
  return rebuildIds(result)
}

/** @deprecated Alias — nutze enforceSpacing. */
export function enforceKraftSpacing(days: DaySession[], heute: string): DaySession[] {
  return enforceSpacing(days, heute)
}

function resolveNachbarKonflikte(
  days: DaySession[],
  heute: string,
  pred: (k: SessionKind) => boolean,
  label: string,
): DaySession[] {
  let result = cloneDays(days).sort((a, b) => a.dateIso.localeCompare(b.dateIso))
  let guard = 0

  while (hatNachbarKonflikt(result, pred) && guard < 12) {
    guard++
    const sorted = [...result].sort((a, b) => a.dateIso.localeCompare(b.dateIso))
    let fixed = false

    for (let i = 0; i < sorted.length - 1; i++) {
      const a = sorted[i]!
      const b = sorted[i + 1]!
      if (!pred(a.kind) || !pred(b.kind)) continue
      if (addDaysIso(a.dateIso, 1) !== b.dateIso) continue
      if (b.completed || b.dateIso < heute) continue

      const swapIdx = sorted.findIndex(
        (d, j) => j > i + 1 && !d.completed && d.dateIso >= heute && !pred(d.kind),
      )

      if (swapIdx > 0) {
        const [left, right] = swapSessionBodies(b, sorted[swapIdx]!)
        sorted[i + 1] = { ...left, dateIso: b.dateIso, stravaRides: b.stravaRides }
        sorted[swapIdx] = {
          ...right,
          dateIso: sorted[swapIdx]!.dateIso,
          stravaRides: sorted[swapIdx]!.stravaRides,
        }
        fixed = true
        break
      }

      const pushedDate = addDaysIso(b.dateIso, 1)
      sorted[i + 1] = makeRuhe(b.dateIso, `Ruhetag (${label})`)
      const pushed: DaySession = {
        ...b,
        dateIso: pushedDate,
        title: b.title.replace(/ \(verschoben\)/, '') + ' (verschoben)',
        isFlexDay: false,
      }
      const exist = sorted.findIndex((d) => d.dateIso === pushedDate)
      if (exist >= 0 && !sorted[exist]!.completed) {
        const victim = sorted[exist]!
        sorted[exist] = pushed
        if (!pred(victim.kind)) {
          sorted.push({ ...victim, dateIso: addDaysIso(pushedDate, 1), isFlexDay: false })
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

  return result
}
