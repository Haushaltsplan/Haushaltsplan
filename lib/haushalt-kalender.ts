import { istSupabaseClientKonfiguriert } from '@/lib/supabase'

/**
 * Einfache Kalender-Einträge; Standard: lokal. Mit Supabase zusätzlich geräteübergreifend.
 */
export const KALENDER_STORAGE_KEY = 'mein-haushalt.kalender.v1' as const
export const KALENDER_SYNC_EVENT = 'mein-haushalt:kalender' as const

/** Feste Kategorien mit konsistenten Farben in der UI */
export const KALENDER_KATEGORIEN = [
  {
    id: 'geburtstag',
    label: 'Geburtstag',
    dot: 'bg-emerald-400 shadow-[0_0_0_1px_rgba(16,185,129,0.35)]',
    leftBar: 'bg-emerald-500',
    listBorder: 'border-emerald-500/50',
    listBg: 'bg-emerald-950/25',
    badge: 'bg-emerald-900/60 text-emerald-100',
  },
  {
    id: 'termin',
    label: 'Termin',
    dot: 'bg-rose-400 shadow-[0_0_0_1px_rgba(251,113,133,0.35)]',
    leftBar: 'bg-rose-500',
    listBorder: 'border-rose-500/50',
    listBg: 'bg-rose-950/20',
    badge: 'bg-rose-900/55 text-rose-100',
  },
  {
    id: 'urlaub',
    label: 'Urlaub',
    dot: 'bg-violet-400 shadow-[0_0_0_1px_rgba(167,139,250,0.35)]',
    leftBar: 'bg-violet-500',
    listBorder: 'border-violet-500/50',
    listBg: 'bg-violet-950/25',
    badge: 'bg-violet-900/55 text-violet-100',
  },
  {
    id: 'feiertag',
    label: 'Feiertag',
    dot: 'bg-amber-400 shadow-[0_0_0_1px_rgba(251,191,36,0.35)]',
    leftBar: 'bg-amber-500',
    listBorder: 'border-amber-500/50',
    listBg: 'bg-amber-950/25',
    badge: 'bg-amber-900/50 text-amber-100',
  },
  {
    id: 'erinnerung',
    label: 'Erinnerung',
    dot: 'bg-sky-400 shadow-[0_0_0_1px_rgba(56,189,248,0.35)]',
    leftBar: 'bg-sky-500',
    listBorder: 'border-sky-500/50',
    listBg: 'bg-sky-950/25',
    badge: 'bg-sky-900/55 text-sky-100',
  },
  {
    id: 'sonstiges',
    label: 'Sonstiges',
    dot: 'bg-slate-400 shadow-[0_0_0_1px_rgba(148,163,184,0.4)]',
    leftBar: 'bg-slate-500',
    listBorder: 'border-slate-500/50',
    listBg: 'bg-slate-800/40',
    badge: 'bg-slate-800/80 text-slate-200',
  },
] as const

export type KalenderKategorieId = (typeof KALENDER_KATEGORIEN)[number]['id']

const KATEGORIE_IDS = new Set<string>(KALENDER_KATEGORIEN.map((k) => k.id))

export function normalisiereKalenderKategorie(ro: unknown): KalenderKategorieId {
  const s = typeof ro === 'string' ? ro : ''
  if (KATEGORIE_IDS.has(s)) return s as KalenderKategorieId
  return 'sonstiges'
}

export function kalenderKategorieMeta(id: KalenderKategorieId) {
  return KALENDER_KATEGORIEN.find((k) => k.id === id) ?? KALENDER_KATEGORIEN[KALENDER_KATEGORIEN.length - 1]
}

export type KalenderEintrag = {
  id: string
  /** YYYY-MM-DD */
  datum: string
  titel: string
  notiz: string
  /** Optional, Format HH:MM (24h) */
  uhrzeit: string
  kategorie: KalenderKategorieId
}

function istKalenderEintrag(x: unknown): x is KalenderEintrag {
  if (!x || typeof x !== 'object') return false
  const o = x as Record<string, unknown>
  return (
    typeof o.id === 'string' &&
    typeof o.datum === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(o.datum) &&
    typeof o.titel === 'string' &&
    typeof o.notiz === 'string' &&
    typeof o.uhrzeit === 'string' &&
    (o.kategorie == null || typeof o.kategorie === 'string')
  )
}

export function ladeKalenderEintraege(): KalenderEintrag[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(KALENDER_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    const out: KalenderEintrag[] = []
    for (const item of parsed) {
      if (!istKalenderEintrag(item)) continue
      out.push({
        id: item.id,
        datum: item.datum,
        titel: item.titel.trim() || 'Ohne Titel',
        notiz: item.notiz,
        uhrzeit: item.uhrzeit,
        kategorie: normalisiereKalenderKategorie((item as Record<string, unknown>).kategorie),
      })
    }
    return out
  } catch {
    return []
  }
}

export function speichereKalenderEintraege(eintraege: KalenderEintrag[]) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(KALENDER_STORAGE_KEY, JSON.stringify(eintraege))
    try {
      window.dispatchEvent(new CustomEvent(KALENDER_SYNC_EVENT))
    } catch {
      // ignore
    }
  } catch {
    // Speicher voll o.ä.
  }
}

export type LadeKalenderVonQuelleMeta = {
  eintraege: KalenderEintrag[]
  /** z. B. Tabelle in Supabase fehlt, oder erster Cloud-Upload schlägt fehl */
  warnung: string | null
}

/**
 * Lädt bevorzugt aus Supabase (gleiche Daten auf Handy + PC) und spiegelt in localStorage.
 * Wenn die Cloud leer ist, lokalen Stand einmal hochladen. Bei Cloud-Fehler: nur localStorage.
 */
export async function ladeKalenderEintraegeVonQuelleMitMeta(): Promise<LadeKalenderVonQuelleMeta> {
  const local = ladeKalenderEintraege()
  if (!istSupabaseClientKonfiguriert()) {
    return { eintraege: local, warnung: null }
  }
  const { ladeKalenderAusCloud, speichereKalenderInCloud } = await import('@/lib/haushalt-kalender-cloud')
  const res = await ladeKalenderAusCloud()
  if (!res.ok) {
    return { eintraege: local, warnung: res.message }
  }
  const cloud = res.rows
  if (cloud.length === 0 && local.length > 0) {
    const r = await speichereKalenderInCloud(local)
    if (r.ok) {
      speichereKalenderEintraege(local)
      return { eintraege: local, warnung: null }
    }
    return { eintraege: local, warnung: r.message }
  }
  speichereKalenderEintraege(cloud)
  return { eintraege: cloud, warnung: null }
}

export async function ladeKalenderEintraegeVonQuelle(): Promise<KalenderEintrag[]> {
  const m = await ladeKalenderEintraegeVonQuelleMitMeta()
  return m.eintraege
}

/** Lokalen Stand speichern und bei konfigurierter Supabase mit der Cloud abgleichen. */
export async function speichereKalenderEintraegeMitCloud(
  eintraege: KalenderEintrag[],
): Promise<{ cloudOk: boolean; message?: string }> {
  speichereKalenderEintraege(eintraege)
  if (!istSupabaseClientKonfiguriert()) return { cloudOk: true }
  const { speichereKalenderInCloud } = await import('@/lib/haushalt-kalender-cloud')
  const r = await speichereKalenderInCloud(eintraege)
  if (r.ok) return { cloudOk: true }
  return { cloudOk: false, message: r.message }
}

export function heuteAlsIsoDatum(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Wochentag 0=So..6=Sa → Spalte 0=Mo..6=So */
export function wochenSpalteMontagZuerst(tagJS: number): number {
  return (tagJS + 6) % 7
}

export type KalenderMonatKopf = { jahr: number; monat: number } // 1-12

export function parseIsoDatum(d: string): { jahr: number; monat: number; tag: number } | null {
  const m = String(d).match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return null
  const jahr = Number(m[1])
  const monat = Number(m[2])
  const tag = Number(m[3])
  if (!Number.isFinite(jahr) || !Number.isFinite(monat) || !Number.isFinite(tag)) return null
  if (monat < 1 || monat > 12) return null
  const last = new Date(jahr, monat, 0).getDate()
  if (tag < 1 || tag > last) return null
  return { jahr, monat, tag }
}

export function tageImMonat(jahr: number, monat: number): number {
  return new Date(jahr, monat, 0).getDate()
}

/** Zellen für Monatsraster: null = Platzhalter, Zahl = Tag des Monats */
export function baueMonatsZellen(jahr: number, monat: number): (number | null)[] {
  const erste = new Date(jahr, monat - 1, 1)
  const führendeLeer = wochenSpalteMontagZuerst(erste.getDay())
  const tage = tageImMonat(jahr, monat)
  const zellen: (number | null)[] = []
  for (let i = 0; i < führendeLeer; i++) zellen.push(null)
  for (let t = 1; t <= tage; t++) zellen.push(t)
  while (zellen.length % 7 !== 0) zellen.push(null)
  return zellen
}

export function isoDatumAusJahrMonatTag(jahr: number, monat: number, tag: number): string {
  return `${jahr}-${String(monat).padStart(2, '0')}-${String(tag).padStart(2, '0')}`
}

export function monatPlusDelta(m: KalenderMonatKopf, delta: number): KalenderMonatKopf {
  const d = new Date(m.jahr, m.monat - 1 + delta, 1)
  return { jahr: d.getFullYear(), monat: d.getMonth() + 1 }
}

export function formatMonatTitelDe(m: KalenderMonatKopf): string {
  try {
    return new Date(m.jahr, m.monat - 1, 1).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })
  } catch {
    return `${m.monat}/${m.jahr}`
  }
}

export function filterEintraegeFuerTag(eintraege: KalenderEintrag[], iso: string): KalenderEintrag[] {
  return eintraege.filter((e) => e.datum === iso)
}

export function sortiereEintraegeNachUhrzeitDannTitel(a: KalenderEintrag, b: KalenderEintrag): number {
  const ta = a.uhrzeit.trim()
  const tb = b.uhrzeit.trim()
  if (ta && !tb) return -1
  if (!ta && tb) return 1
  if (ta && tb) {
    const c = ta.localeCompare(tb, 'de')
    if (c !== 0) return c
  }
  return a.titel.localeCompare(b.titel, 'de', { sensitivity: 'base' })
}
