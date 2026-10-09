/**
 * Feste Top-Suchbegriffe für Schalen-Rankings (Shop-Übersicht).
 * Exact Match in Titel/Tags/Intro — Tags ≤20 Zeichen.
 */

export const ETSY_RANK_FOKUS_KEYWORDS = [
  'gedrechselte schale',
  'holzschale',
  'obstschale aus holz',
  'holzschale deko',
  'gedrechselt',
] as const

export type EtsyRankFokusKeyword = (typeof ETSY_RANK_FOKUS_KEYWORDS)[number]

/** Kurze UI-Labels (Umbrüche in schmalen Spalten). */
export const ETSY_RANK_FOKUS_LABELS: Record<EtsyRankFokusKeyword, string> = {
  'gedrechselte schale': 'gedrechselte Schale',
  holzschale: 'Holzschale',
  'obstschale aus holz': 'Obstschale aus Holz',
  'holzschale deko': 'Holzschale Deko',
  gedrechselt: 'gedrechselt',
}

export const ETSY_RANK_SCHWACH_SEITE = 3
/** Weniger Treffer in der Probe = Messung unsicher (nicht als „Seite 10“ lesen). */
export const ETSY_RANK_MIN_PROBE = 24

export function normRankKeyword(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').trim()
}

export function istFokusKeyword(s: string): s is EtsyRankFokusKeyword {
  const k = normRankKeyword(s)
  return (ETSY_RANK_FOKUS_KEYWORDS as readonly string[]).includes(k)
}
