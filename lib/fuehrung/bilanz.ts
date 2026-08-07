/**
 * Text für das Chef-Gespräch / Wochenbilanz.
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
  challengeEndeIso,
  mitarbeiterFragenStats,
  summeMitarbeiterFragenAmTag,
  summeMitarbeiterFragenSplit,
  summeMetriken,
  type FuehrungState,
} from '@/lib/fuehrung/store'
import { wochenStartIso } from '@/lib/fuehrung/wochen-review'

function formatDe(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  return new Date(y, m - 1, d).toLocaleDateString('de-DE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export function baueFuehrungBilanz(state: FuehrungState, heute: string): string {
  const slot = aktuelleWochenNr(state.challengeStart, heute, FUEHRUNG_PLAN_SLOTS)
  const lernNr = FUEHRUNG_WOCHEN.find((w) => w.nr === slot)?.lernNr
  const ende = challengeEndeIso(state.challengeStart, state.challengeTage)
  const m = summeMetriken(state.tage, state.situationen)
  const fokusOk = state.fokusBloecke.filter((f) => f.abgeschlossen).length
  const fokusMin = state.fokusBloecke
    .filter((f) => f.abgeschlossen)
    .reduce((s, f) => s + f.dauerMin, 0)
  const abendTage = Object.values(state.tage).filter((t) => t.abendCheckErledigt).length
  const streak = berechneAbendCheckStreak(state.tage, heute)
  const maVon = wochenStartIso(heute)
  const maWoche = mitarbeiterFragenStats(state.mitarbeiter, state.mitarbeiterTage, maVon, heute)
  const maSplit = summeMitarbeiterFragenSplit(state.mitarbeiterTage, maVon, heute)
  const maFragenWoche = maSplit.gesamt
  const maFragenHeute = summeMitarbeiterFragenAmTag(state.mitarbeiterTage, heute)
  const maHeuteSplit = summeMitarbeiterFragenSplit(state.mitarbeiterTage, heute, heute)

  const typCounts = new Map<string, number>()
  const reakCounts = new Map<string, number>()
  const personCounts = new Map<string, number>()
  for (const s of state.situationen) {
    typCounts.set(s.typ, (typCounts.get(s.typ) ?? 0) + 1)
    reakCounts.set(s.reaktion, (reakCounts.get(s.reaktion) ?? 0) + 1)
    const key = s.personName.trim() || 'ohne Name'
    personCounts.set(key, (personCounts.get(key) ?? 0) + 1)
  }

  const wins = Object.values(state.tage)
    .filter((t) => t.win.trim())
    .sort((a, b) => b.datum.localeCompare(a.datum))
    .slice(0, 8)

  const wocheDef = FUEHRUNG_WOCHEN.find((w) => w.nr === slot)
  const done = new Set(state.wochenFortschritt[String(slot)] ?? [])
  const aufgabenStand = wocheDef
    ? `${done.size}/${wocheDef.aufgaben.length} Aufgaben${
        wocheDef.lernNr != null ? ` Lernwoche ${wocheDef.lernNr}` : ' (Pause)'
      }`
    : '—'

  const lines: string[] = [
    'FÜHRUNGS-BILANZ — Stellv. Leiter Hartware',
    `Stand: ${formatDe(heute)} · Challenge bis ${formatDe(ende)} · ${
      lernNr != null ? `Lernwoche ${lernNr}/6` : 'Pause (Urlaub)'
    }`,
    '',
    'KENNZAHLEN',
    `· Redirects / Gegenfragen: ${m.redirects}`,
    `· Nein / Später: ${m.neins}`,
    `· Situationen geloggt: ${m.situationen}`,
    `· Davon „wieder ausgenutzt“: ${m.ausgenutzt}`,
    `· Fokusblöcke abgeschlossen: ${fokusOk} (${fokusMin} Min)`,
    `· Tage mit Abend-Check: ${abendTage}`,
    `· Abend-Check-Streak: ${streak} Tag(e)`,
    `· Mitarbeiter-Fragen heute / Woche: ${maFragenHeute} / ${maFragenWoche}`,
    `· Davon wichtig / unnötig (Woche): ${maSplit.wichtig} / ${maSplit.unnoetig}`,
    `· Davon wichtig / unnötig (heute): ${maHeuteSplit.wichtig} / ${maHeuteSplit.unnoetig}`,
    `· Aktiver Slot: ${aufgabenStand}${wocheDef ? ` — ${wocheDef.titel}` : ''}`,
    '',
  ]

  if (maWoche.some((x) => x.anzahl > 0)) {
    lines.push('MITARBEITER-RANKING (Woche)')
    for (const row of maWoche.filter((x) => x.anzahl > 0).slice(0, 8)) {
      lines.push(
        `· ${row.name}: ${row.anzahl}× (wichtig ${row.anzahlWichtig} · unnötig ${row.anzahlUnnoetig})`,
      )
    }
    lines.push('')
  }

  if (typCounts.size) {
    lines.push('SITUATIONSTYPEN')
    for (const t of FUEHRUNG_SITUATION_TYPEN) {
      const n = typCounts.get(t.id) ?? 0
      if (n) lines.push(`· ${t.label}: ${n}`)
    }
    lines.push('')
  }

  if (reakCounts.size) {
    lines.push('REAKTIONEN')
    for (const r of FUEHRUNG_REAKTIONEN) {
      const n = reakCounts.get(r.id) ?? 0
      if (n) lines.push(`· ${r.label}: ${n}`)
    }
    lines.push('')
  }

  const topPersonen = [...personCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)
  if (topPersonen.length) {
    lines.push('HÄUFIGSTE PERSONEN / KONTEXTE')
    for (const [name, n] of topPersonen) lines.push(`· ${name}: ${n}×`)
    lines.push('')
  }

  if (wins.length) {
    lines.push('WINS (Auszug)')
    for (const w of wins) lines.push(`· ${formatDe(w.datum)}: ${w.win.trim()}`)
    lines.push('')
  }

  if (state.personen.length) {
    lines.push('TEAM-MUSTER (Kurz)')
    for (const p of state.personen.slice(0, 6)) {
      lines.push(`· ${p.name}: ${p.strategie.trim() || p.muster.trim() || '—'}`)
    }
    lines.push('')
  }

  lines.push(
    'SPRECHPUNKTE FÜRS GESPRÄCH',
    '1. Was ich geändert habe (Redirects, Fokus, Nein/Später).',
    '2. Wo das Team jetzt selbst trägt.',
    '3. Wo ich noch übe — und was ich als Nächstes festziehe.',
    '',
    'Nett bleiben. Nicht der einfachste Weg für alle anderen sein.',
  )

  return lines.join('\n')
}
