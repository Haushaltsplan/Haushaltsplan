import { findeProduktIdNachLagerZuordnung } from '@/lib/lager-artikel-kanonisch'
import type { RezeptGericht, RezeptZutatZeile } from '@/lib/rezept-coach-types'

export type RezeptLagerArtikel = { id?: string; name: string; menge: number; einheit: string }

function artikelMitId(artikel: RezeptLagerArtikel[]): Array<{ id: string; name: string; menge: number; einheit: string }> {
  return artikel.filter(
    (a): a is { id: string; name: string; menge: number; einheit: string } =>
      typeof a.id === 'string' && a.id.trim().length > 0,
  )
}

export type ZutatLagerStatus = {
  produktId: string | null
  produktName: string | null
  bestand: number
  benoetigt: number
  einheit: string
  /** Passender Artikel im Lager und Menge reicht aus. */
  ausreichend: boolean
  /** Im Lager gefunden (ggf. zu wenig). */
  gematcht: boolean
}

function artikelZeile(artikel: RezeptLagerArtikel[], produktId: string | null): RezeptLagerArtikel | null {
  if (!produktId) return null
  return artikelMitId(artikel).find((a) => a.id === produktId) ?? null
}

function produktIdFuerZutat(z: RezeptZutatZeile, artikel: RezeptLagerArtikel[]): string | null {
  const mitId = artikelMitId(artikel)
  const pid = typeof z.produkt_id === 'string' ? z.produkt_id.trim() : ''
  if (pid && mitId.some((a) => a.id === pid)) return pid
  const kandidaten = mitId.map((a) => ({ id: a.id, name: a.name }))
  return findeProduktIdNachLagerZuordnung(kandidaten, z.name)
}

/** Abgleich einer Rezept-Zutat mit dem aktuellen Speisekammer-Bestand. */
export function zutatLagerStatus(z: RezeptZutatZeile, artikel: RezeptLagerArtikel[]): ZutatLagerStatus {
  const produktId = produktIdFuerZutat(z, artikel)
  const row = artikelZeile(artikel, produktId)
  const bestand = row?.menge ?? 0
  const benoetigt = z.menge
  const ausreichend = produktId != null && bestand + 1e-6 >= benoetigt
  return {
    produktId,
    produktName: row?.name ?? null,
    bestand,
    benoetigt,
    einheit: z.einheit,
    ausreichend,
    gematcht: produktId != null,
  }
}

export type FehlendFuerEinkauf = {
  /** Bekannte Produkte (Merker per ID). */
  produktIds: string[]
  /** Noch kein Lager-Artikel — Merker per Name. */
  namen: string[]
}

/** Zutaten, die für das Rezept fehlen oder nicht ausreichen — für die Einkaufsliste. */
export function fehlendeFuerEinkauf(gericht: RezeptGericht, artikel: RezeptLagerArtikel[]): FehlendFuerEinkauf {
  const ids = new Set<string>()
  const namen = new Set<string>()
  for (const z of gericht.zutaten || []) {
    const st = zutatLagerStatus(z, artikel)
    if (st.ausreichend) continue
    if (st.produktId) ids.add(st.produktId)
    else namen.add(z.name.trim())
  }
  return { produktIds: [...ids], namen: [...namen].filter(Boolean) }
}

/** Alle im Lager gefundenen Zutaten mit ausreichendem Bestand — zum Ausbuchen. */
export function zutatenZumAusbuchen(
  gericht: RezeptGericht,
  artikel: RezeptLagerArtikel[],
): Array<{ produkt_id: string; menge: number; name: string }> {
  const out: Array<{ produkt_id: string; menge: number; name: string }> = []
  for (const z of gericht.zutaten || []) {
    const st = zutatLagerStatus(z, artikel)
    if (!st.gematcht || !st.produktId || !st.ausreichend) continue
    out.push({ produkt_id: st.produktId, menge: z.menge, name: z.name })
  }
  return out
}

/** Alle Zutaten reichen (Name-Abgleich inklusive). */
export function gerichtAlleZutatenImBestand(gericht: RezeptGericht | null, artikel: RezeptLagerArtikel[]): boolean {
  if (!gericht?.zutaten?.length) return false
  for (const z of gericht.zutaten) {
    if (!zutatLagerStatus(z, artikel).ausreichend) return false
  }
  return true
}
