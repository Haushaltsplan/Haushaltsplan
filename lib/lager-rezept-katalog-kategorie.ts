/** Feste Kategorien für Rezeptkatalog (Filter + KI). */

export const REZEPT_KATALOG_KATEGORIEN = [
  'Vegetarisch',
  'Vegan',
  'Nudelgericht',
  'Fleischgericht',
  'Fischgericht',
  'Suppe / Eintopf',
  'Beilage / Salat',
  'Dessert / Backen',
  'Sonstiges',
] as const

export type RezeptKatalogKategorie = (typeof REZEPT_KATALOG_KATEGORIEN)[number]

const ALIAS: Record<string, RezeptKatalogKategorie> = {
  vegetarisch: 'Vegetarisch',
  vegan: 'Vegan',
  pasta: 'Nudelgericht',
  nudeln: 'Nudelgericht',
  nudelgericht: 'Nudelgericht',
  fleisch: 'Fleischgericht',
  fleischgericht: 'Fleischgericht',
  fisch: 'Fischgericht',
  fischgericht: 'Fischgericht',
  suppe: 'Suppe / Eintopf',
  eintopf: 'Suppe / Eintopf',
  beilage: 'Beilage / Salat',
  salat: 'Beilage / Salat',
  dessert: 'Dessert / Backen',
  backen: 'Dessert / Backen',
  kuchen: 'Dessert / Backen',
  sonstiges: 'Sonstiges',
}

/** Normalisiert KI-/Nutzer-Text auf eine Katalog-Kategorie oder `null` (= unkategorisiert). */
export function normalisiereRezeptKategorie(raw: unknown): string | null {
  if (raw == null) return null
  const s = String(raw).trim()
  if (!s) return null
  const lower = s.toLowerCase()
  if (ALIAS[lower]) return ALIAS[lower]
  const hit = REZEPT_KATALOG_KATEGORIEN.find((k) => k.toLowerCase() === lower)
  if (hit) return hit
  return 'Sonstiges'
}
