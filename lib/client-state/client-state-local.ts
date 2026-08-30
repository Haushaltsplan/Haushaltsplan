/**
 * Lesen/Schreiben der lokalen Spiegel für den Geräte-Abgleich.
 * Apply schreibt denselben Speicher wie die Fachmodule — ohne erneuten Cloud-Push
 * (`mitCloudApply` in den Save-Funktionen).
 */
import {
  CLIENT_STATE_APPLIED_EVENT,
  CLIENT_STATE_KEYS,
  EINKAUF_MERKER_EVENT,
  EINKAUF_MERKER_IDS_KEY,
  EINKAUF_MERKER_NAMEN_KEY,
  EINKAUFSLISTE_PERSIST_KEY,
  RESEARCH_PROMPTS_STORAGE_KEY,
  type ClientStateEintrag,
  type ClientStateKey,
  type EinkaufslistePayload,
  type ModeberaterPayload,
  type TerminReminderPayload,
} from '@/lib/client-state/client-state-keys'
import { mergeFitnessDailyStores } from '@/lib/client-state/fitness-daily-merge'
import { mitCloudApply } from '@/lib/client-state/client-state-guard'
import { leseClientStateRev } from '@/lib/client-state/client-state-rev'
import { ladeDailyStore, speichereDailyStore, type WhoopDailyStore } from '@/lib/fitnessdaten/daily-records'
import { ladeFitnessProfil, speichereFitnessProfil, type FitnessUserProfile } from '@/lib/fitnessdaten/user-profile'
import {
  bundleAusStand,
  ladeModeChat,
  ladeModeStandVollstaendig,
  parseModeStand,
  speichereModeChat,
  speichereModeStand,
  standOhneFotoBytes,
  type ModeChatTurn,
  type ModeBeraterStand,
} from '@/lib/modeberater/mode-profil'
import { speichereModeFotoBundle, type ModeFotoBundle } from '@/lib/modeberater/mode-fotos-idb'
import { NAV_ORDER_CHANGED_EVENT, NAV_ORDER_KEY, mergePersistedWithKnown } from '@/lib/nav-model'
import { ladeWatchlist, speichereWatchlist, type WatchlistEintrag } from '@/lib/portfolio-analyse/watchlist-client'
import { TERMIN_REMINDER_EVENT, ladeTerminReminderEinstellungen, speichereTerminReminderEinstellungen } from '@/lib/termin-morgen-reminder'

const THEME_KEY = 'omnia-theme'

function meldApplied(schluessel: string) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(CLIENT_STATE_APPLIED_EVENT, { detail: { schluessel } }))
}

function jsonArrayStrings(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw.filter((x): x is string => typeof x === 'string')
}

export function leseEinkaufslisteLokal(): EinkaufslistePayload {
  if (typeof window === 'undefined') return { hidden: [], mengen: {}, merkerIds: [], merkerNamen: [] }
  let hidden: string[] = []
  let mengen: Record<string, number> = {}
  try {
    const raw = window.localStorage.getItem(EINKAUFSLISTE_PERSIST_KEY)
    if (raw) {
      const o = JSON.parse(raw) as Record<string, unknown>
      hidden = jsonArrayStrings(o.hidden)
      if (o.mengen && typeof o.mengen === 'object') {
        for (const [k, v] of Object.entries(o.mengen as Record<string, unknown>)) {
          const n = Number(v)
          if (k && Number.isFinite(n) && n > 0) mengen[k] = n
        }
      }
    }
  } catch {
    /* ignore */
  }
  let merkerIds: string[] = []
  let merkerNamen: string[] = []
  try {
    merkerIds = jsonArrayStrings(JSON.parse(window.localStorage.getItem(EINKAUF_MERKER_IDS_KEY) || '[]'))
    merkerNamen = jsonArrayStrings(JSON.parse(window.localStorage.getItem(EINKAUF_MERKER_NAMEN_KEY) || '[]'))
  } catch {
    /* ignore */
  }
  return { hidden, mengen, merkerIds, merkerNamen }
}

export function schreibeEinkaufslisteLokal(p: EinkaufslistePayload): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(
      EINKAUFSLISTE_PERSIST_KEY,
      JSON.stringify({ hidden: p.hidden ?? [], mengen: p.mengen ?? {} }),
    )
    window.localStorage.setItem(EINKAUF_MERKER_IDS_KEY, JSON.stringify(p.merkerIds ?? []))
    window.localStorage.setItem(EINKAUF_MERKER_NAMEN_KEY, JSON.stringify(p.merkerNamen ?? []))
    window.dispatchEvent(new CustomEvent(EINKAUF_MERKER_EVENT))
  } catch {
    /* ignore */
  }
}

function parseWatchlistPayload(raw: unknown): WatchlistEintrag[] {
  if (!Array.isArray(raw)) return []
  const out: WatchlistEintrag[] = []
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue
    const r = row as Record<string, unknown>
    const name = typeof r.name === 'string' ? r.name.trim() : ''
    const isin = typeof r.isin === 'string' && r.isin.trim() ? r.isin.trim().toUpperCase() : null
    const symbolYahoo = typeof r.symbolYahoo === 'string' && r.symbolYahoo.trim() ? r.symbolYahoo.trim() : null
    if (!name && !isin && !symbolYahoo) continue
    out.push({
      isin,
      name: name || isin || symbolYahoo || 'Unbekannt',
      symbolYahoo,
      symbolCandidates: Array.isArray(r.symbolCandidates)
        ? r.symbolCandidates.filter((s): s is string => typeof s === 'string')
        : [],
      hinzugefuegtAm: typeof r.hinzugefuegtAm === 'string' ? r.hinzugefuegtAm : new Date().toISOString(),
    })
  }
  return out
}

function parseTheme(raw: unknown): 'light' | 'dark' | null {
  if (raw === 'light' || raw === 'dark') return raw
  if (raw && typeof raw === 'object' && 'theme' in raw) {
    const t = (raw as { theme?: unknown }).theme
    if (t === 'light' || t === 'dark') return t
  }
  return null
}

export async function leseLocalPayload(schluessel: ClientStateKey): Promise<unknown | null> {
  if (typeof window === 'undefined') return null
  switch (schluessel) {
    case CLIENT_STATE_KEYS.navOrder: {
      const raw = window.localStorage.getItem(NAV_ORDER_KEY)
      if (!raw) return null
      try {
        const parsed = JSON.parse(raw) as unknown
        return Array.isArray(parsed) ? mergePersistedWithKnown(parsed as string[]) : mergePersistedWithKnown(null)
      } catch {
        return null
      }
    }
    case CLIENT_STATE_KEYS.theme: {
      const t = window.localStorage.getItem(THEME_KEY)
      return t === 'light' || t === 'dark' ? t : null
    }
    case CLIENT_STATE_KEYS.modeberater: {
      const stand = await ladeModeStandVollstaendig()
      const chat = ladeModeChat()
      const leer =
        !stand.profil ||
        (Object.values(stand.profil).every((v) => (Array.isArray(v) ? v.length === 0 : !String(v || '').trim())) &&
          stand.personFotos.length === 0 &&
          stand.kleidung.length === 0 &&
          chat.length === 0)
      if (leer) return null
      const payload: ModeberaterPayload = { stand: standOhneFotoBytes(stand), chat }
      return payload
    }
    case CLIENT_STATE_KEYS.modeberaterFotos: {
      const stand = await ladeModeStandVollstaendig()
      const bundle = bundleAusStand(stand)
      if (bundle.person.length === 0 && Object.keys(bundle.kleidung).length === 0) return null
      return bundle
    }
    case CLIENT_STATE_KEYS.einkaufsliste: {
      const p = leseEinkaufslisteLokal()
      const leer =
        p.hidden.length === 0 &&
        Object.keys(p.mengen).length === 0 &&
        p.merkerIds.length === 0 &&
        p.merkerNamen.length === 0
      if (leer && !leseClientStateRev(CLIENT_STATE_KEYS.einkaufsliste)) return null
      return p
    }
    case CLIENT_STATE_KEYS.researchPrompts: {
      const raw = window.localStorage.getItem(RESEARCH_PROMPTS_STORAGE_KEY)
      if (!raw) return null
      try {
        return JSON.parse(raw) as unknown
      } catch {
        return null
      }
    }
    case CLIENT_STATE_KEYS.fitnessProfil: {
      const p = ladeFitnessProfil()
      if (p.birthYear == null && p.gender == null && p.heightCm == null && p.weightKg == null && p.maxHrOverride == null) {
        return null
      }
      return p
    }
    case CLIENT_STATE_KEYS.fitnessDaily: {
      const s = ladeDailyStore()
      if ((s.days?.length ?? 0) === 0 && (s.activities?.length ?? 0) === 0 && (s.logbuch?.length ?? 0) === 0) return null
      return s
    }
    case CLIENT_STATE_KEYS.terminReminder: {
      const s = ladeTerminReminderEinstellungen()
      if (!s.enabled && s.stunde === 7) return null
      return { stunde: s.stunde, enabled: s.enabled } satisfies TerminReminderPayload
    }
    case CLIENT_STATE_KEYS.watchlist: {
      const w = ladeWatchlist()
      if (w.length === 0 && !leseClientStateRev(CLIENT_STATE_KEYS.watchlist)) return null
      return w
    }
    case CLIENT_STATE_KEYS.chartAnalyse: {
      const { leseChartAnalyseKarte } = await import('@/lib/portfolio-analyse/chart-analyse-store')
      const k = leseChartAnalyseKarte()
      if (Object.keys(k).length === 0 && !leseClientStateRev(CLIENT_STATE_KEYS.chartAnalyse)) return null
      return k
    }
    case CLIENT_STATE_KEYS.kalenderMeta:
      return null
    default:
      return null
  }
}

export async function wendeClientStateAn(eintrag: ClientStateEintrag): Promise<void> {
  if (typeof window === 'undefined') return
  const { schluessel, payload } = eintrag
  await mitCloudApply(async () => {
    switch (schluessel) {
      case CLIENT_STATE_KEYS.navOrder: {
        const order = mergePersistedWithKnown(Array.isArray(payload) ? (payload as string[]) : null)
        window.localStorage.setItem(NAV_ORDER_KEY, JSON.stringify(order))
        window.dispatchEvent(new Event(NAV_ORDER_CHANGED_EVENT))
        break
      }
      case CLIENT_STATE_KEYS.theme: {
        const t = parseTheme(payload)
        if (t) {
          window.localStorage.setItem(THEME_KEY, t)
          document.documentElement.classList.toggle('dark', t !== 'light')
        }
        break
      }
      case CLIENT_STATE_KEYS.modeberater: {
        const p = (payload ?? {}) as ModeberaterPayload
        const stand: ModeBeraterStand = parseModeStand(p.stand)
        speichereModeStand(stand)
        if (Array.isArray(p.chat)) speichereModeChat(p.chat as ModeChatTurn[])
        break
      }
      case CLIENT_STATE_KEYS.modeberaterFotos: {
        const bundle = payload as ModeFotoBundle | null
        if (bundle && typeof bundle === 'object') {
          await speichereModeFotoBundle({
            person: Array.isArray(bundle.person) ? bundle.person : [],
            kleidung: bundle.kleidung && typeof bundle.kleidung === 'object' ? bundle.kleidung : {},
          })
        }
        break
      }
      case CLIENT_STATE_KEYS.einkaufsliste: {
        const p = (payload ?? {}) as Partial<EinkaufslistePayload>
        schreibeEinkaufslisteLokal({
          hidden: jsonArrayStrings(p.hidden),
          mengen: p.mengen && typeof p.mengen === 'object' ? p.mengen : {},
          merkerIds: jsonArrayStrings(p.merkerIds),
          merkerNamen: jsonArrayStrings(p.merkerNamen),
        })
        break
      }
      case CLIENT_STATE_KEYS.researchPrompts: {
        if (payload && typeof payload === 'object') {
          window.localStorage.setItem(RESEARCH_PROMPTS_STORAGE_KEY, JSON.stringify(payload))
        }
        break
      }
      case CLIENT_STATE_KEYS.fitnessProfil: {
        if (payload && typeof payload === 'object') {
          speichereFitnessProfil(payload as FitnessUserProfile)
        }
        break
      }
      case CLIENT_STATE_KEYS.fitnessDaily: {
        if (payload && typeof payload === 'object') {
          const merged = mergeFitnessDailyStores(ladeDailyStore(), payload as WhoopDailyStore)
          speichereDailyStore(merged)
        }
        break
      }
      case CLIENT_STATE_KEYS.terminReminder: {
        const p = (payload ?? {}) as Partial<TerminReminderPayload>
        const aktuell = ladeTerminReminderEinstellungen()
        speichereTerminReminderEinstellungen({
          ...aktuell,
          stunde: typeof p.stunde === 'number' ? p.stunde : aktuell.stunde,
          enabled: p.enabled === true,
        })
        window.dispatchEvent(new CustomEvent(TERMIN_REMINDER_EVENT))
        break
      }
      case CLIENT_STATE_KEYS.watchlist: {
        speichereWatchlist(parseWatchlistPayload(payload))
        break
      }
      case CLIENT_STATE_KEYS.chartAnalyse: {
        const { parseChartAnalyseKarte, schreibeChartAnalyseKarte } = await import(
          '@/lib/portfolio-analyse/chart-analyse-store'
        )
        schreibeChartAnalyseKarte(parseChartAnalyseKarte(payload))
        break
      }
      default:
        break
    }
  })
  meldApplied(schluessel)
}

export const ALLE_UPLOAD_KEYS: ClientStateKey[] = [
  CLIENT_STATE_KEYS.navOrder,
  CLIENT_STATE_KEYS.theme,
  CLIENT_STATE_KEYS.modeberater,
  CLIENT_STATE_KEYS.modeberaterFotos,
  CLIENT_STATE_KEYS.einkaufsliste,
  CLIENT_STATE_KEYS.researchPrompts,
  CLIENT_STATE_KEYS.fitnessProfil,
  CLIENT_STATE_KEYS.fitnessDaily,
  CLIENT_STATE_KEYS.terminReminder,
  CLIENT_STATE_KEYS.watchlist,
  CLIENT_STATE_KEYS.chartAnalyse,
]
