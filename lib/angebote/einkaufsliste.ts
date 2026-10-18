import {
  cleanMarke,
  findeGuenstigstesAngebot as matchGuenstigstes,
} from '@/lib/angebote/produkt-match'
import type { Angebot, HaendlerId } from '@/lib/angebote/types'
import { HAENDLER_LABELS } from '@/lib/angebote/types'

export { findeGuenstigstesAngebot, suchvarianten } from '@/lib/angebote/produkt-match'

export const EINKAUFSLISTE_KEY = 'pa-angebote-einkaufsliste-v3'

export type ListenEintrag = {
  key: string
  suchbegriff: string
  menge: number
  bildUrl: string | null
  typ: 'freitext' | 'angebot'
}

export function produktKey(a: Pick<Angebot, 'name' | 'marke'>): string {
  const marke = (cleanMarke(a.marke) || '').toLowerCase()
  const name = a.name.trim().toLowerCase().replace(/\s+/g, ' ')
  return `a:${marke}|${name}`
}

export function suchKey(suchbegriff: string): string {
  return `q:${suchbegriff.trim().toLowerCase().replace(/\s+/g, ' ')}`
}

/** „2x Butter“, „2 Butter“, „Butter x2“, „Butter“, auch „Butter, Milch, 2x Bananen“ einzeln */
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

/** Mehrere Positionen: „Butter, 2x Milch, Bananen“ */
export function parseMehrereEingaben(raw: string): Array<{ menge: number; suchbegriff: string }> {
  const parts = raw
    .split(/[,;\n]+/)
    .map((p) => p.trim())
    .filter(Boolean)
  const out: Array<{ menge: number; suchbegriff: string }> = []
  for (const p of parts) {
    const parsed = parseListenEingabe(p)
    if (parsed) out.push(parsed)
  }
  return out
}

export function volleBezeichnung(a: Angebot): string {
  const marke = cleanMarke(a.marke)
  const teile = [marke, a.name.trim()].filter(Boolean)
  let s = teile.join(' · ')
  if (a.packungText?.trim()) {
    const pack = a.packungText.trim().replace(/\s+/g, ' ')
    s += ` (${pack.length > 80 ? `${pack.slice(0, 77)}…` : pack})`
  }
  return s
}

export function findeBestesAngebot(
  eintrag: ListenEintrag,
  angebote: Angebot[],
  haendler: HaendlerId,
): Angebot | null {
  return matchGuenstigstes(eintrag.suchbegriff, angebote, haendler)
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
      const angebot = matchGuenstigstes(e.suchbegriff, angebote, h)
      const marke = angebot ? cleanMarke(angebot.marke) : null
      return {
        key: e.key,
        suchbegriff: e.suchbegriff,
        bezeichnung: angebot ? volleBezeichnung(angebot) : null,
        marke,
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
    for (const key of [EINKAUFSLISTE_KEY, 'pa-angebote-einkaufsliste-v2', 'pa-angebote-einkaufsliste-v1']) {
      const raw = localStorage.getItem(key)
      if (!raw) continue
      const parsed = JSON.parse(raw) as Array<Record<string, unknown>>
      if (!Array.isArray(parsed)) continue
      return parsed
        .map((x): ListenEintrag | null => {
          const suchbegriff =
            typeof x.suchbegriff === 'string'
              ? x.suchbegriff
              : typeof x.name === 'string'
                ? x.name
                : ''
          if (!suchbegriff) return null
          return {
            key: typeof x.key === 'string' ? x.key : suchKey(suchbegriff),
            suchbegriff,
            menge: Math.max(1, Number(x.menge) || 1),
            bildUrl: typeof x.bildUrl === 'string' ? x.bildUrl : null,
            typ: x.typ === 'angebot' ? 'angebot' : 'freitext',
          }
        })
        .filter((x): x is ListenEintrag => Boolean(x))
    }
    return []
  } catch {
    return []
  }
}

export function speichereListeInStorage(liste: ListenEintrag[]) {
  if (typeof window === 'undefined') return
  localStorage.setItem(EINKAUFSLISTE_KEY, JSON.stringify(liste))
}
