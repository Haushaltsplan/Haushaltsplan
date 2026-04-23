import type { KalenderEintrag } from '@/lib/haushalt-kalender'

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
  } catch {
    // ignore
  }
}

export function heuteAlsIsoDatumLocal(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Echte Termine: Kategorie „Termin“ (rot), nicht Geburtstag/Urlaub usw. */
export function sammleTerminTitelFuerTag(eintraege: KalenderEintrag[], iso: string): string[] {
  const t: string[] = []
  for (const e of eintraege) {
    if (e.datum !== iso) continue
    if (e.kategorie !== 'termin') continue
    const x = (e.titel || '').trim()
    if (x) t.push(x)
  }
  t.sort((a, b) => a.localeCompare(b, 'de', { sensitivity: 'base' }))
  return t
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
  | { zuenden: true; titel: string[]; heuteIso: string } {
  if (!einst.enabled) return { zuenden: false }
  if (!feuertHinweisFenster(jetzt, einst.stunde, fensterMinuten)) return { zuenden: false }
  const heuteIso = heuteAlsIsoDatumFor(jetzt)
  if (einst.letzterHinweisTag === heuteIso) return { zuenden: false }
  const titel = sammleTerminTitelFuerTag(eintraege, heuteIso)
  if (titel.length === 0) return { zuenden: false }
  return { zuenden: true, titel, heuteIso }
}

function heuteAlsIsoDatumFor(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function bauHinweisText(titel: string[]): { uberschrift: string; text: string } {
  if (titel.length === 0) return { uberschrift: 'Heute stehen Termine an', text: 'Öffne den Kalender für Details.' }
  if (titel.length === 1) {
    return { uberschrift: 'Heute: Termin', text: titel[0] }
  }
  return {
    uberschrift: `Heute: ${titel.length} Termine`,
    text: titel.join(' · '),
  }
}
