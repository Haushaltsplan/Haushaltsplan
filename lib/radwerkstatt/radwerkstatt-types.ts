export type RadwerkstattListe = 'bestand' | 'bedarf'
export type RadwerkstattArt = 'werkzeug' | 'verbrauch'

export type RadwerkstattArtikel = {
  id: string
  liste: RadwerkstattListe
  art: RadwerkstattArt
  name: string
  einsatzbereich: string
  /** Einkaufspreis in Euro, falls erkennbar. */
  preisEur: number | null
  /** Preis, wie er auf der Produktseite steht (z. B. „24,99 €“). */
  preisText: string
  zusammenfassung: string
  produktUrl: string
  bildUrl: string
  /** Verbrauch: wie lange eine Einheit hält bzw. wie oft man sie verwenden kann. */
  haltbarkeit: string
  /** Verbrauch: wie oft man es benutzen muss. */
  verwendungsrhythmus: string
  anzahl: number
  notiz: string
  gekauftAm: string
  erstelltAm: string
}

/** Antwort der Link-Auswertung, bevor etwas gespeichert wird. */
export type RadwerkstattEntwurf = {
  name: string
  einsatzbereich: string
  preisEur: number | null
  preisText: string
  zusammenfassung: string
  art: RadwerkstattArt
  haltbarkeit: string
  verwendungsrhythmus: string
  bildUrl: string
  produktUrl: string
  hinweis: string
}
