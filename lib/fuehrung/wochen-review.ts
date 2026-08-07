/**
 * Sonntags-Wochenreview aus lokalen Führungsdaten.
 */

import {
  FUEHRUNG_PLAN_SLOTS,
  FUEHRUNG_REAKTIONEN,
  FUEHRUNG_SITUATION_TYPEN,
  FUEHRUNG_WOCHEN,
} from '@/lib/fuehrung/content'
import { berechneAbendCheckStreak } from '@/lib/fuehrung/streak'
import {
  aktuelleWochenNr,
  heuteIso,
  summeMetriken,
  type FuehrungState,
} from '@/lib/fuehrung/store'

export function isoWochenKey(d = new Date()): string {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const dayNum = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  const weekNo = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`
}

/** Montag 00:00 der aktuellen ISO-Woche (lokal). */
export function wochenStartIso(heute = heuteIso()): string {
  const d = new Date(`${heute}T12:00:00`)
  const day = d.getDay() // 0 So … 6 Sa
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const da = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${da}`
}

export function istSonntag(d = new Date()): boolean {
  return d.getDay() === 0
}

export type FuehrungWochenReview = {
  wochenKey: string
  von: string
  bis: string
  challengeWoche: number
  redirects: number
  neins: number
  situationen: number
  ausgenutzt: number
  fokusBloecke: number
  fokusMin: number
  abendChecks: number
  streak: number
  topPersonen: { name: string; n: number }[]
  typen: { label: string; n: number }[]
  wins: { datum: string; text: string }[]
  text: string
}

export function baueWochenReview(state: FuehrungState, heute = heuteIso()): FuehrungWochenReview {
  const von = wochenStartIso(heute)
  const bis = heute
  const inWoche = (iso: string) => iso >= von && iso <= bis

  const tageWoche = Object.values(state.tage).filter((t) => inWoche(t.datum))
  const sits = state.situationen.filter((s) => inWoche(s.datum))
  const fokus = state.fokusBloecke.filter((f) => inWoche(f.datum) && f.abgeschlossen)

  const tageMap: Record<string, (typeof tageWoche)[0]> = {}
  for (const t of tageWoche) tageMap[t.datum] = t
  const m = summeMetriken(tageMap, sits)

  const personCounts = new Map<string, number>()
  const typCounts = new Map<string, number>()
  for (const s of sits) {
    const name = s.personName.trim() || 'ohne Name'
    personCounts.set(name, (personCounts.get(name) ?? 0) + 1)
    typCounts.set(s.typ, (typCounts.get(s.typ) ?? 0) + 1)
  }

  const topPersonen = [...personCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, n]) => ({ name, n }))

  const typen = FUEHRUNG_SITUATION_TYPEN.map((t) => ({
    label: t.label,
    n: typCounts.get(t.id) ?? 0,
  })).filter((t) => t.n > 0)

  const wins = tageWoche
    .filter((t) => t.win.trim())
    .sort((a, b) => b.datum.localeCompare(a.datum))
    .map((t) => ({ datum: t.datum, text: t.win.trim() }))

  const abendChecks = tageWoche.filter((t) => t.abendCheckErledigt).length
  const fokusMin = fokus.reduce((s, f) => s + f.dauerMin, 0)
  const challengeWoche = aktuelleWochenNr(state.challengeStart, heute, FUEHRUNG_PLAN_SLOTS)
  const streak = berechneAbendCheckStreak(state.tage, heute)
  const wocheDef = FUEHRUNG_WOCHEN.find((w) => w.nr === challengeWoche)
  const lernLabel =
    wocheDef?.lernNr != null ? `Lernwoche ${wocheDef.lernNr}/6` : 'Pause (Urlaub)'

  const reakLines = FUEHRUNG_REAKTIONEN.map((r) => {
    const n = sits.filter((s) => s.reaktion === r.id).length
    return n ? `· ${r.label}: ${n}` : null
  }).filter((line): line is string => Boolean(line))

  const lines = [
    `WOCHEN-REVIEW ${isoWochenKey(new Date(`${heute}T12:00:00`))}`,
    `${von} → ${bis} · ${lernLabel}${wocheDef ? ` — ${wocheDef.titel}` : ''}`,
    '',
    `Redirects: ${m.redirects} · Nein/Später: ${m.neins}`,
    `Situationen: ${m.situationen} · davon ausgenutzt: ${m.ausgenutzt}`,
    `Fokusblöcke: ${fokus.length} (${fokusMin} Min) · Abend-Checks: ${abendChecks}`,
    `Aktueller Streak: ${streak} Tage`,
    '',
  ]
  if (reakLines.length) {
    lines.push('Reaktionen', ...reakLines, '')
  }
  if (topPersonen.length) {
    lines.push('Top Personen')
    for (const p of topPersonen) lines.push(`· ${p.name}: ${p.n}×`)
    lines.push('')
  }
  if (wins.length) {
    lines.push('Wins')
    for (const w of wins.slice(0, 6)) lines.push(`· ${w.datum}: ${w.text}`)
    lines.push('')
  }
  lines.push(
    'Nächste Woche: Denken zurückgeben, Fokus schützen, Bilanz für den Chef füttern.',
  )

  return {
    wochenKey: isoWochenKey(new Date(`${heute}T12:00:00`)),
    von,
    bis,
    challengeWoche,
    redirects: m.redirects,
    neins: m.neins,
    situationen: m.situationen,
    ausgenutzt: m.ausgenutzt,
    fokusBloecke: fokus.length,
    fokusMin,
    abendChecks,
    streak,
    topPersonen,
    typen,
    wins,
    text: lines.join('\n'),
  }
}
