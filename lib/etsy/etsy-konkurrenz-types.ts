/** Client-sichere Typen für den Konkurrenz-Verkaufschart. */

export type EtsyKonkurrenzShop = {
  shopId: number
  name: string
  url: string | null
  iconUrl: string | null
  /** Anzahl passender Schalen-Listings in der DE-Suche (Relevanz für die Nische). */
  treffer: number
  /** Median-Preis der Holzschalen im Sortiment. */
  preisMedian: number | null
  /** Anteil gedrechselter Holzschalen am aktiven Sortiment (0–1). */
  schalenAnteil: number | null
  /** Häufigste Tags im Schalen-Sortiment (wöchentlich aktualisiert). */
  topTags: string[]
  eigener: boolean
  /** Vom Nutzer hinzugefügt — bleibt immer im Chart. */
  manuell: boolean
  verkaeufeGesamt: number | null
  bewertungen: number | null
  bewertungSchnitt: number | null
  aktiveListings: number | null
  /** Verkäufe in den letzten 7/30 Tagen (null = noch zu wenig Historie). */
  plus7: number | null
  plus30: number | null
  /** Verkäufe seit dem ersten Snapshot im Zeitraum (null bei nur einer Messung). */
  seitStart: number | null
  /** Ø Verkäufe pro Tag über den gesamten Messzeitraum. */
  proTag: number | null
  messTage: number
}

/** Ein Punkt pro Tag; Schlüssel = shopId als String → Verkäufe gesamt. */
export type EtsyKonkurrenzVerlaufPunkt = { tag: string } & Record<string, number | string | null>

export type EtsyKonkurrenzErgebnis = {
  shops: EtsyKonkurrenzShop[]
  verlauf: EtsyKonkurrenzVerlaufPunkt[]
  letzterSnapshot: string | null
  entdecktAm: string | null
  suchbegriffe: string[]
  minSchalenAnteil: number
}
