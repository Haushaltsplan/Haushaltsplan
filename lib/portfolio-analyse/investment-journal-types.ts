export type JournalStatus = 'aktiv' | 'geschlossen'

export type JournalGegenpruefungStatus = 'intakt' | 'unter_beobachtung' | 'beschaedigt'

export type JournalEintrag = {
  id: string
  isin: string | null
  ticker: string
  name: string
  these: string
  kaufgrund: string
  watchpoints: string
  status: JournalStatus
  reviewAm: string | null
  letzteGegenpruefungAm: string | null
  letzteGegenpruefungStatus: JournalGegenpruefungStatus | null
  erstelltAm: string
  aktualisiertAm: string
}

export type JournalGegenpruefung = {
  id: string
  journalId: string | null
  ticker: string
  isin: string | null
  quartalLabel: string
  status: JournalGegenpruefungStatus
  fazit: string
  details: Record<string, unknown>
  kiModell: string | null
  erstelltAm: string
}

export type JournalAutoFillErgebnis = {
  ticker: string
  name: string
  status: 'befuellt' | 'uebersprungen' | 'fehler'
  message?: string
  eintrag?: JournalEintrag
}

export type JournalGegenpruefungBatchErgebnis = {
  ticker: string
  name: string
  status: 'geprueft' | 'uebersprungen' | 'fehler'
  message?: string
  gegenpruefung?: JournalGegenpruefung
}
