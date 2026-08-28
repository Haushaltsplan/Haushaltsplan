/** Schlüssel in `omnia_client_state` — fest, nicht umbenennen (Cloud-Zeilen). */
export const CLIENT_STATE_KEYS = {
  navOrder: 'nav-order',
  theme: 'theme',
  modeberater: 'modeberater',
  modeberaterFotos: 'modeberater-fotos',
  einkaufsliste: 'einkaufsliste',
  researchPrompts: 'research-prompts',
  fitnessProfil: 'fitness-profil',
  fitnessDaily: 'fitness-daily',
  terminReminder: 'termin-reminder',
  watchlist: 'watchlist',
  kalenderMeta: 'kalender-meta',
} as const

export type ClientStateKey = (typeof CLIENT_STATE_KEYS)[keyof typeof CLIENT_STATE_KEYS]

export const CLIENT_STATE_APPLIED_EVENT = 'omnia-client-state-applied'
export const CLIENT_STATE_READY_EVENT = 'omnia-client-state-ready'

export const RESEARCH_PROMPTS_STORAGE_KEY = 'mein-haushalt.investments.research-prompts.v3'
export const EINKAUFSLISTE_PERSIST_KEY = 'mein-haushalt:einkaufsliste-v1'
export const EINKAUF_MERKER_IDS_KEY = 'mein-haushalt:einkauf-merker-v1'
export const EINKAUF_MERKER_NAMEN_KEY = 'mein-haushalt:einkauf-merker-namen-v1'
export const EINKAUF_MERKER_EVENT = 'einkauf-merker-geaendert'

export type ClientStateEintrag = {
  schluessel: string
  payload: unknown
  aktualisiertAm: string
}

export type KalenderMetaPayload = {
  anzahl: number
}

export type EinkaufslistePayload = {
  hidden: string[]
  mengen: Record<string, number>
  merkerIds: string[]
  merkerNamen: string[]
}

export type ModeberaterPayload = {
  stand: unknown
  chat: unknown
}

export type TerminReminderPayload = {
  stunde: number
  enabled: boolean
}
