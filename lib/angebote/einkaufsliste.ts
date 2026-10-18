import type { Angebot, HaendlerId } from '@/lib/angebote/types'
import { HAENDLER_LABELS } from '@/lib/angebote/types'

export const EINKAUFSLISTE_KEY = 'pa-angebote-einkaufsliste-v2'

export type ListenEintrag = {
  key: string
  /** Suchbegriff / Anzeigename in der Liste (z. B. „Butter“) */
  suchbegriff: string
  menge: number
  /** Optional: aus Angebot übernommen */
  bildUrl: string | null
  typ: 'freitext' | 'angebot'
}

export function produktKey(a: Pick<Angebot, 'name' | 'marke'>): string {
  const marke = (a.marke || '').trim().toLowerCase()
  const name = a.name.trim().toLowerCase().replace(/\s+/g, ' ')
  return `a:${marke}|${name}`
}

export function suchKey(suchbegriff: string): string {
  return `q:${suchbegriff.trim().toLowerCase().replace(/\s+/g, ' ')}`
}

/** „2x Butter“, „2 Butter“, „Butter x2“, „Butter“ */
export function parseListenEingabe(raw: string): { menge: number; suchbegriff: string } | null {
  const t = raw.trim().replace(/\s+/g, ' ')
  if (!t) return null

  let m = t.match(/^(\d+)\s*[x×*]\s*(.+)$/i)
  if (m) return { menge: Math.max(1, Number(m[1])), suchbegriff: m[2]!.trim() }

  m = t.match(/^(.+?)\s*[x×*]\s*(\d+)$/i)
  if (m) return { menge: Math.max(1, Number(m[2])), suchbegriff: m[1]!.trim() }

  m = t.match(/^(\d+)\s+(.+)$/)
  if (m && m[2]!.trim().length >= 2) {
    return { menge: Math.max(1, Number(m[1])), suchbegriff: m[2]!.trim() }
  }

  return { menge: 1, suchbegriff: t }
}

function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function tokenize(text: string): string[] {
  return normalizeText(text)
    .split(/\s+/)
    .filter((t) => t.length >= 2)
}

/** Volle Bezeichnung zum Finden im Markt. */
export function volleBezeichnung(a: Angebot): string {
  const teile = [a.marke?.trim(), a.name.trim()].filter(Boolean)
  let s = teile.join(' · ')
  if (a.packungText?.trim()) s += ` (${a.packungText.trim()})`
  return s
}

/**
 * Alle Treffer zu einem Suchbegriff bei einem Händler, günstigstes zuerst.
 * z. B. „Butter“ → alle Butter-Produkte, dann min(preis).
 */
export function findeGuenstigstesAngebot(
  suchbegriff: string,
  angebote: Angebot[],
  haendler: HaendlerId,
): Angebot | null {
  const terms = tokenize(suchbegriff)
  if (!terms.length) return null
  const kandidaten = angebote.filter((a) => a.haendler === haendler)
  if (!kandidaten.length) return null

  const treffer: Angebot[] = []
  for (const a of kandidaten) {
    const hay = normalizeText(`${a.marke ?? ''} ${a.name} ${a.kategorie ?? ''} ${a.packungText ?? ''}`)
    const ok = terms.every((t) => hay.includes(t))
    if (ok) treffer.push(a)
  }
  if (!treffer.length) {
    // lockerer: mindestens ein Term trifft
    for (const a of kandidaten) {
      const hay = normalizeText(`${a.marke ?? ''} ${a.name} ${a.kategorie ?? ''}`)
      if (terms.some((t) => hay.includes(t))) treffer.push(a)
    }
  }
  if (!treffer.length) return null
  treffer.sort((a, b) => a.preisEur - b.preisEur)
  return treffer[0] ?? null
}

export function findeBestesAngebot(
  eintrag: ListenEintrag,
  angebote: Angebot[],
  haendler: HaendlerId,
): Angebot | null {
  return findeGuenstigstesAngebot(eintrag.suchbegriff, angebote, haendler)
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
    suchbegriff: string
    bezeichnung: string | null
    marke: string | null
    menge: number
    preisEur: number | null
    einzelpreisEur: number | null
    bildUrl: string | null
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
  if (haendlerFilter?.length) {
    for (const h of haendlerFilter) haendlerSet.add(h)
    for (const h of [...haendlerSet]) {
      if (!haendlerFilter.includes(h)) haendlerSet.delete(h)
    }
  }

  const rows: HaendlerSumme[] = []
  for (const h of haendlerSet) {
    const positionen = liste.map((e) => {
      const angebot = findeGuenstigstesAngebot(e.suchbegriff, angebote, h)
      return {
        key: e.key,
        suchbegriff: e.suchbegriff,
        bezeichnung: angebot ? volleBezeichnung(angebot) : null,
        marke: angebot?.marke ?? null,
        menge: e.menge,
        preisEur: angebot ? angebot.preisEur * e.menge : null,
        einzelpreisEur: angebot?.preisEur ?? null,
        bildUrl: angebot?.bildUrl ?? e.bildUrl,
        angebot,
      }
    })
    const treffer = positionen.filter((p) => p.preisEur != null).length
    const vollstaendig = treffer === liste.length && liste.length > 0
    const summeEur =
      treffer > 0 ? positionen.reduce((s, p) => s + (p.preisEur ?? 0), 0) : null
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
    if (!raw) {
      // Migration v1 → v2
      const alt = localStorage.getItem('pa-angebote-einkaufsliste-v1')
      if (!alt) return []
      const parsed = JSON.parse(alt) as Array<{
        key?: string
        name?: string
        marke?: string | null
        bildUrl?: string | null
        menge?: number
      }>
      if (!Array.isArray(parsed)) return []
      return parsed
        .filter((x) => x?.name)
        .map((x) => ({
          key: suchKey(x.name!),
          suchbegriff: x.name!,
          menge: Math.max(1, x.menge ?? 1),
          bildUrl: x.bildUrl ?? null,
          typ: 'freitext' as const,
        }))
    }
    const parsed = JSON.parse(raw) as ListenEintrag[]
    return Array.isArray(parsed)
      ? parsed.filter((x) => x && x.key && x.suchbegriff && x.menge > 0)
      : []
  } catch {
    return []
  }
}

export function speichereListeInStorage(liste: ListenEintrag[]) {
  if (typeof window === 'undefined') return
  localStorage.setItem(EINKAUFSLISTE_KEY, JSON.stringify(liste))
}
