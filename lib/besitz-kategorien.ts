/** Feste Warengruppen für „Besitz“ (Kleidung, Elektronik, …). */

export const BESITZ_KATEGORIEN = [
  'Kleidung',
  'Schuhe',
  'Elektronik',
  'Haushalt & Wohnen',
  'Sport & Freizeit',
  'Accessoires',
  'Sonstiges',
] as const

export type BesitzKategorie = (typeof BESITZ_KATEGORIEN)[number]

const ALIAS: Record<string, BesitzKategorie> = {
  kleidung: 'Kleidung',
  schuhe: 'Schuhe',
  elektronik: 'Elektronik',
  tech: 'Elektronik',
  computer: 'Elektronik',
  handy: 'Elektronik',
  haushalt: 'Haushalt & Wohnen',
  wohnen: 'Haushalt & Wohnen',
  möbel: 'Haushalt & Wohnen',
  moebel: 'Haushalt & Wohnen',
  sport: 'Sport & Freizeit',
  freizeit: 'Sport & Freizeit',
  accessoire: 'Accessoires',
  accessoires: 'Accessoires',
  sonstiges: 'Sonstiges',
}

export function normalisiereBesitzKategorie(raw: unknown): BesitzKategorie {
  if (raw == null) return 'Sonstiges'
  const s = String(raw).trim()
  if (!s) return 'Sonstiges'
  const lower = s.toLowerCase()
  if (ALIAS[lower]) return ALIAS[lower]
  const hit = BESITZ_KATEGORIEN.find((k) => k.toLowerCase() === lower)
  if (hit) return hit
  return 'Sonstiges'
}
