import type { Angebot, HaendlerId } from '@/lib/angebote/types'
import { HAENDLER_LABELS } from '@/lib/angebote/types'

export const EINKAUFSLISTE_KEY = 'pa-angebote-einkaufsliste-v1'

export type ListenEintrag = {
  key: string
  name: string
  marke: string | null
  bildUrl: string | null
  menge: number
  /** Angebot, mit dem der Eintrag angelegt wurde */
  angebotId: string
  haendlerUrsprung: HaendlerId
  preisUrsprungEur: number
}

export function produktKey(a: Pick<Angebot, 'name' | 'marke'>): string {
  const marke = (a.marke || '').trim().toLowerCase()
  const name = a.name.trim().toLowerCase().replace(/\s+/g, ' ')
  return `${marke}|${name}`
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-zäöüß0-9\s]/gi, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 2)
}

/** Einfaches Matching für denselben Einkaufsposten über Händler hinweg. */
export function findeBestesAngebot(
  eintrag: ListenEintrag,
  angebote: Angebot[],
  haendler: HaendlerId,
): Angebot | null {
  const kandidaten = angebote.filter((a) => a.haendler === haendler)
  if (!kandidaten.length) return null

  const exact = kandidaten.find((a) => produktKey(a) === eintrag.key)
  if (exact) return exact

  const terms = tokenize(`${eintrag.marke ?? ''} ${eintrag.name}`)
  if (!terms.length) return null

  let best: Angebot | null = null
  let bestScore = 0
  for (const a of kandidaten) {
    const hay = tokenize(`${a.marke ?? ''} ${a.name}`)
    if (!hay.length) continue
    let hit = 0
    for (const t of terms) {
      if (hay.some((h) => h.includes(t) || t.includes(h))) hit += 1
    }
    const score = hit / terms.length
    if (score > bestScore || (score === bestScore && best && a.preisEur < best.preisEur)) {
      if (score >= 0.55) {
        bestScore = score
        best = a
      }
    }
  }
  return best
}

export type HaendlerSumme = {
  haendler: HaendlerId
  label: string
  summeEur: number | null
  treffer: number
  gesamt: number
  vollstaendig: boolean
  positionen: Array<{
    key: string
    name: string
    marke: string | null
    menge: number
    preisEur: number | null
    angebot: Angebot | null
  }>
}

export function berechneSummenProHaendler(
  liste: ListenEintrag[],
  angebote: Angebot[],
  haendlerFilter?: HaendlerId[],
): HaendlerSumme[] {
  if (!liste.length) return []

  const haendlerSet = new Set<HaendlerId>()
  for (const a of angebote) haendlerSet.add(a.haendler)
  for (const e of liste) haendlerSet.add(e.haendlerUrsprung)
  if (haendlerFilter?.length) {
    for (const h of [...haendlerSet]) {
      if (!haendlerFilter.includes(h)) haendlerSet.delete(h)
    }
  }

  const rows: HaendlerSumme[] = []
  for (const h of haendlerSet) {
    const positionen = liste.map((e) => {
      const angebot = findeBestesAngebot(e, angebote, h)
      return {
        key: e.key,
        name: e.name,
        marke: e.marke,
        menge: e.menge,
        preisEur: angebot ? angebot.preisEur * e.menge : null,
        angebot,
      }
    })
    const treffer = positionen.filter((p) => p.preisEur != null).length
    const vollstaendig = treffer === liste.length && liste.length > 0
    const summeEur = vollstaendig
      ? positionen.reduce((s, p) => s + (p.preisEur ?? 0), 0)
      : treffer > 0
        ? positionen.reduce((s, p) => s + (p.preisEur ?? 0), 0)
        : null
    rows.push({
      haendler: h,
      label: HAENDLER_LABELS[h] ?? h,
      summeEur: summeEur != null ? Math.round(summeEur * 100) / 100 : null,
      treffer,
      gesamt: liste.length,
      vollstaendig,
      positionen,
    })
  }

  return rows.sort((a, b) => {
    if (a.summeEur == null && b.summeEur == null) return a.label.localeCompare(b.label, 'de')
    if (a.summeEur == null) return 1
    if (b.summeEur == null) return -1
    if (a.vollstaendig !== b.vollstaendig) return a.vollstaendig ? -1 : 1
    return a.summeEur - b.summeEur
  })
}

export function ladeListeAusStorage(): ListenEintrag[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(EINKAUFSLISTE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as ListenEintrag[]
    return Array.isArray(parsed) ? parsed.filter((x) => x && x.key && x.name) : []
  } catch {
    return []
  }
}

export function speichereListeInStorage(liste: ListenEintrag[]) {
  if (typeof window === 'undefined') return
  localStorage.setItem(EINKAUFSLISTE_KEY, JSON.stringify(liste))
}
