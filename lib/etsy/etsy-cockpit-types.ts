/** Etsy-Cockpit: gemeinsame Typen für Regel-Engine, API und UI. */

export type EtsyCockpitModul = 'agent' | 'seo' | 'keywords' | 'konkurrenz'

export type EtsyTagTausch = {
  listingId: number
  listingTitle: string
  /** null = freier Tag-Platz (weniger als 13 Tags) */
  alt: string | null
  altGrund: string
  neu: string
}

export type EtsyCockpitAktion =
  | { art: 'tag_tausch'; tausch: EtsyTagTausch[]; listingOptionen?: Array<{ listingId: number; title: string }> }
  | { art: 'vorschlag'; listingId: number }
  | { art: 'audit'; listingId: number }
  | { art: 'batch_audit'; anzahl: number }
  | { art: 'tags_reparieren'; anzahl: number }
  | { art: 'oeffnen'; modul: EtsyCockpitModul; listingId?: number }
  | { art: 'merken'; keyword: string }

export type EtsyAufgabeTyp =
  | 'views_einbruch'
  | 'rank_verlust'
  | 'vorschlag'
  | 'hauptbegriff'
  | 'saison'
  | 'saison_ende'
  | 'keyword'
  | 'tag_luecke'
  | 'schwach'
  | 'kein_audit'
  | 'keine_favoriten'
  | 'konkurrenz'
  | 'tags_unvollstaendig'

export type EtsyCockpitAufgabe = {
  /** Stabiler Schlüssel — für „Ausblenden“ (etsy_aufgabe_status) */
  key: string
  typ: EtsyAufgabeTyp
  prioritaet: number
  titel: string
  detail: string
  listingId?: number
  listingTitle?: string
  aktion: EtsyCockpitAktion
  /** Sekundär-Aktion (z. B. Listing öffnen, Keyword merken) */
  zweitAktion?: EtsyCockpitAktion
  /** Vorschau für KI-Vorschläge: Tag-Diff + neuer Titel */
  diff?: { plus: string[]; minus: string[]; titelNeu?: string; titelAlt?: string }
}

export type EtsyCockpitKpis = {
  aktiveListings: number
  views7: number | null
  views7Vorher: number | null
  favoriten7: number | null
  favoriten7Vorher: number | null
  verkaeufe30: number | null
  umsatz30: number | null
  verkaeufe30Vorher: number | null
  scoreSchnitt: number | null
  auditiert: number
  /** Rang nach Verkäufen (30 Tage) unter Konkurrenz + eigenem Shop, 1 = bester */
  konkurrenzRang: number | null
  konkurrenzAnzahl: number
  eigeneVerkaeufeGesamt: number | null
  messTage: number
}

export type EtsyWirkung = {
  id: string
  listingId: number
  listingTitle: string
  quelle: 'vorschlag' | 'aufgabe' | 'manuell'
  beschreibung: string
  am: string
  tageSeither: number
  viewsProTagVorher: number | null
  viewsProTagNachher: number | null
  favProTagVorher: number | null
  favProTagNachher: number | null
  verkaeufeVorher: number
  verkaeufeNachher: number
  /** 'besser' | 'schlechter' | 'gleich' | 'messung' (zu früh / keine Daten) */
  urteil: 'besser' | 'schlechter' | 'gleich' | 'messung'
}

export type EtsyTopListing = {
  listingId: number
  title: string
  url: string | null
  views7: number | null
  favoriten7: number | null
  verkaeufe30: number
  score: number | null
}

export type EtsyCockpitErgebnis = {
  kpis: EtsyCockpitKpis
  aufgaben: EtsyCockpitAufgabe[]
  ausgeblendet: number
  wirkung: EtsyWirkung[]
  topListings: EtsyTopListing[]
  hinweise: string[]
  stand: string
}
