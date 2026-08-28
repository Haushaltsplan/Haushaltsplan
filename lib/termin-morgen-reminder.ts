import { filterEintraegeFuerTag, kalenderKategorieMeta, type KalenderEintrag } from '@/lib/haushalt-kalender'

export const TERMIN_REMINDER_SETTINGS_KEY = 'mein-haushalt.termin-reminder.v1' as const
export const TERMIN_REMINDER_EVENT = 'mein-haushalt:termin-reminder' as const

export type TerminReminderSettings = {
  /** Tägliche Uhrzeit (lokale Systemzeit) */
  stunde: number
  /** Erinnerung aktiv */
  enabled: boolean
  /** YYYY-MM-DD: an diesem Tag wurde der Hinweis um die eingestellte Uhr schon gezeigt */
  letzterHinweisTag: string | null
}

const DEFAULTS: TerminReminderSettings = {
  stunde: 7,
  enabled: false,
  letzterHinweisTag: null,
}

function klemmeStunde(n: number): number {
  if (!Number.isFinite(n)) return DEFAULTS.stunde
  return Math.min(23, Math.max(0, Math.floor(n)))
}

export function ladeTerminReminderEinstellungen(): TerminReminderSettings {
  if (typeof window === 'undefined') return { ...DEFAULTS }
  try {
    const raw = window.localStorage.getItem(TERMIN_REMINDER_SETTINGS_KEY)
    if (!raw) return { ...DEFAULTS }
    const o = JSON.parse(raw) as Record<string, unknown>
    const tag =
      typeof o.letzterHinweisTag === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(o.letzterHinweisTag) ? o.letzterHinweisTag : null
    return {
      stunde: klemmeStunde(typeof o.stunde === 'number' ? o.stunde : Number(o.stunde)),
      enabled: o.enabled === true,
      letzterHinweisTag: tag,
    }
  } catch {
    return { ...DEFAULTS }
  }
}

export function speichereTerminReminderEinstellungen(s: TerminReminderSettings) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(TERMIN_REMINDER_SETTINGS_KEY, JSON.stringify(s))
    window.dispatchEvent(new CustomEvent(TERMIN_REMINDER_EVENT))
    void import('@/lib/client-state/client-state-sync').then(({ pushClientState }) => {
      pushClientState('termin-reminder', { stunde: s.stunde, enabled: s.enabled })
    })
  } catch {
    // ignore
  }
}

export function heuteAlsIsoDatumLocal(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Alle Einträge an einem Tag, als Lesetext „Kategorielabel: Titel“ (für die Benachrichtigung). */
export function sammleKalenderHinweisZeilenFuerTag(eintraege: KalenderEintrag[], iso: string): string[] {
  const rows: { k: string; t: string; line: string }[] = []
  for (const e of filterEintraegeFuerTag(eintraege, iso)) {
    const title = (e.titel || '').trim() || 'Ohne Titel'
    const label = kalenderKategorieMeta(e.kategorie).label
    rows.push({ k: e.kategorie, t: title, line: `${label}: ${title}` })
  }
  rows.sort((a, b) => a.k.localeCompare(b.k) || a.t.localeCompare(b.t, 'de', { sensitivity: 'base' }))
  return rows.map((r) => r.line)
}

/** Wie lange ab Start der Zielstunde (z. B. 7:00) nach Terminen gesucht wird. */
export const HINWEIS_FENSTER_MINUTEN = 20

export function feuertHinweisFenster(jetzt: Date, zielStunde: number, fensterMinuten: number): boolean {
  const h = jetzt.getHours()
  const m = jetzt.getMinutes()
  if (h !== klemmeStunde(zielStunde)) return false
  return m < Math.max(1, fensterMinuten)
}

/**
 * Soll der Hinweis einmalig am Tag um die Zielstunde erscheinen
 * (innerhalb der ersten `fensterMinuten` Minuten ab voller Stunde, z. B. 7:00–7:19).
 */
export function sollTerminHinweisZuenden(
  eintraege: KalenderEintrag[],
  einst: TerminReminderSettings,
  jetzt: Date,
  fensterMinuten: number,
):
  | { zuenden: false }
  | { zuenden: true; zeilen: string[]; heuteIso: string } {
  if (!einst.enabled) return { zuenden: false }
  if (!feuertHinweisFenster(jetzt, einst.stunde, fensterMinuten)) return { zuenden: false }
  const heuteIso = heuteAlsIsoDatumFor(jetzt)
  if (einst.letzterHinweisTag === heuteIso) return { zuenden: false }
  const zeilen = sammleKalenderHinweisZeilenFuerTag(eintraege, heuteIso)
  if (zeilen.length === 0) return { zuenden: false }
  return { zuenden: true, zeilen, heuteIso }
}

function heuteAlsIsoDatumFor(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function bauHinweisText(zeilen: string[]): { uberschrift: string; text: string } {
  if (zeilen.length === 0) return { uberschrift: 'Heute im Kalender', text: 'Öffne den Kalender für Details.' }
  if (zeilen.length === 1) {
    return { uberschrift: 'Heute im Kalender', text: zeilen[0]! }
  }
  return {
    uberschrift: `Heute: ${zeilen.length} Kalendereinträge`,
    text: zeilen.join(' · '),
  }
}
