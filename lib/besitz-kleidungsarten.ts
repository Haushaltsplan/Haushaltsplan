import type { BesitzKategorie } from '@/lib/besitz-kategorien'

export type BesitzArtGruppe = {
  label: string
  arten: readonly string[]
}

/** Feine Kleidungsarten, gruppiert wie in einem Kleiderschrank. */
export const BESITZ_KLEIDUNGSART_GRUPPEN: readonly BesitzArtGruppe[] = [
  {
    label: 'Oberteile',
    arten: ['T-Shirt', 'Poloshirt', 'Hemd', 'Bluse', 'Top', 'Pullover', 'Hoodie', 'Strickjacke', 'Weste'],
  },
  {
    label: 'Jacken & Mäntel',
    arten: ['Jacke', 'Mantel', 'Parka', 'Blazer'],
  },
  {
    label: 'Hosen',
    arten: ['Jeans', 'Chino', 'Stoffhose', 'Shorts', 'Jogginghose', 'Leggings'],
  },
  {
    label: 'Röcke & Kleider',
    arten: ['Rock', 'Kleid'],
  },
  {
    label: 'Unterwäsche & Socken',
    arten: ['Unterwäsche', 'Socken', 'Strumpfhose'],
  },
  {
    label: 'Bademode',
    arten: ['Badehose', 'Bikini', 'Badeanzug'],
  },
  {
    label: 'Sonstiges',
    arten: ['Sonstiges'],
  },
] as const

export const BESITZ_SCHUHART_GRUPPEN: readonly BesitzArtGruppe[] = [
  {
    label: 'Alltag',
    arten: ['Sneaker', 'Halbschuh', 'Stiefel', 'Sandale', 'Pantoletten'],
  },
  {
    label: 'Sport',
    arten: ['Laufschuh', 'Trainingsschuh', 'Wanderschuhe'],
  },
  {
    label: 'Formal',
    arten: ['Schnürer', 'Loafer', 'Stiefelette'],
  },
  {
    label: 'Sonstiges',
    arten: ['Sonstiges'],
  },
] as const

const ALLE_KLEIDUNG = BESITZ_KLEIDUNGSART_GRUPPEN.flatMap((g) => g.arten)
const ALLE_SCHUHE = BESITZ_SCHUHART_GRUPPEN.flatMap((g) => g.arten)

const ART_ZU_GRUPPE = new Map<string, string>()
for (const g of BESITZ_KLEIDUNGSART_GRUPPEN) {
  for (const a of g.arten) ART_ZU_GRUPPE.set(a, g.label)
}
for (const g of BESITZ_SCHUHART_GRUPPEN) {
  for (const a of g.arten) ART_ZU_GRUPPE.set(a, g.label)
}

export function besitzArtGruppenFuerKategorie(kategorie: BesitzKategorie): readonly BesitzArtGruppe[] {
  if (kategorie === 'Schuhe') return BESITZ_SCHUHART_GRUPPEN
  if (kategorie === 'Kleidung') return BESITZ_KLEIDUNGSART_GRUPPEN
  return []
}

export function besitzHatFeinart(kategorie: BesitzKategorie): boolean {
  return kategorie === 'Kleidung' || kategorie === 'Schuhe'
}

export function besitzArtLabel(kategorie: BesitzKategorie): string {
  return kategorie === 'Schuhe' ? 'Schuhart' : 'Kleidungsart'
}

export function normalisiereBesitzKleidungsart(raw: unknown, kategorie: BesitzKategorie): string | null {
  if (!besitzHatFeinart(kategorie)) return null
  const s = raw == null ? '' : String(raw).trim()
  if (!s) return null
  const pool = kategorie === 'Schuhe' ? ALLE_SCHUHE : ALLE_KLEIDUNG
  const hit = pool.find((a) => a.toLowerCase() === s.toLowerCase())
  return hit ?? s
}

export function besitzArtGruppeLabel(art: string | null | undefined): string {
  if (!art) return 'Ohne Zuordnung'
  return ART_ZU_GRUPPE.get(art) ?? 'Sonstiges'
}

export function besitzArtGruppenReihenfolge(kategorie: BesitzKategorie): string[] {
  return besitzArtGruppenFuerKategorie(kategorie).map((g) => g.label)
}
