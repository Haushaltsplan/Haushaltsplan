/**
 * Normalisierung von Kauf-/Lagereinheiten für vergleichbare Preise & Bestände.
 * Basis-Einheit pro Artikel: kg | Liter | Stück
 */

export type LagerBasisEinheit = 'kg' | 'Liter' | 'Stück'

const BASIS_SET = new Set<LagerBasisEinheit>(['kg', 'Liter', 'Stück'])

/** Erlaubte Eingaben auf dem Bon / im Formular → kanonische Kauf-Einheit. */
export type LagerKaufEinheit = 'g' | 'kg' | 'ml' | 'Liter' | 'Stück'

export function istLagerBasisEinheit(s: string): s is LagerBasisEinheit {
  return BASIS_SET.has(s as LagerBasisEinheit)
}

/** Map UI / DB / Bon-Text auf eine der Kauf-Einheiten. */
export function normalisiereKaufEinheit(raw: string | null | undefined): LagerKaufEinheit | null {
  const s = (raw || '').trim().toLowerCase().replace(/\s+/g, '')
  if (!s) return null
  if (s === 'stück' || s === 'stk' || s === 'st' || s === 'stck') return 'Stück'
  if (s === 'g' || s === 'gr' || s === 'gramm') return 'g'
  if (s === 'kg' || s === 'kilogramm') return 'kg'
  if (s === 'ml' || s === 'milliliter' || s === 'millilitre') return 'ml'
  if (s === 'l' || s === 'liter' || s === 'litre') return 'Liter'
  return null
}

/** Produkt-Einheit aus alter DB → Basis. */
export function produktEinheitZuBasis(einheitRaw: string | null | undefined): LagerBasisEinheit {
  const k = normalisiereKaufEinheit(einheitRaw)
  if (k === 'kg' || k === 'g') return 'kg'
  if (k === 'ml' || k === 'Liter') return 'Liter'
  return 'Stück'
}

/** Default-Basis für neuen Artikel aus erstem Kauf. */
export function defaultBasisEinheitAusKauf(kauf: LagerKaufEinheit): LagerBasisEinheit {
  if (kauf === 'g' || kauf === 'kg') return 'kg'
  if (kauf === 'ml' || kauf === 'Liter') return 'Liter'
  return 'Stück'
}

/** Menge in Kauf-Einheit → Menge in Basis-Einheit (rein numerisch). */
export function mengeInBasisEinheit(
  menge: number,
  kaufEinheit: LagerKaufEinheit,
  basis: LagerBasisEinheit,
): number {
  if (!Number.isFinite(menge) || menge <= 0) throw new Error('Menge muss eine positive Zahl sein.')
  if (basis === 'Stück') {
    if (kaufEinheit !== 'Stück') {
      throw new Error('Für Basis „Stück“ ist nur die Kauf-Einheit „Stück“ erlaubt.')
    }
    return menge
  }
  if (basis === 'kg') {
    if (kaufEinheit === 'kg') return menge
    if (kaufEinheit === 'g') return menge / 1000
    throw new Error(`Kauf-Einheit „${kaufEinheit}“ passt nicht zur Basis „kg“.`)
  }
  if (basis === 'Liter') {
    if (kaufEinheit === 'Liter') return menge
    if (kaufEinheit === 'ml') return menge / 1000
    throw new Error(`Kauf-Einheit „${kaufEinheit}“ passt nicht zur Basis „Liter“.`)
  }
  throw new Error('Unbekannte Basis-Einheit.')
}

/** Preis je Basiseinheit (z. B. €/kg). */
export function preisJeBasiseinheit(gesamtpreis: number, basisMenge: number): number {
  if (!Number.isFinite(gesamtpreis) || gesamtpreis < 0) throw new Error('Gesamtpreis ungültig.')
  if (!Number.isFinite(basisMenge) || basisMenge <= 0) throw new Error('Basis-Menge muss positiv sein.')
  return Math.round((gesamtpreis / basisMenge) * 1000000) / 1000000
}

export function basisEinheitKurzlabel(b: LagerBasisEinheit): string {
  if (b === 'kg') return 'kg'
  if (b === 'Liter') return 'l'
  return 'Stk.'
}

export function basisEinheitFuerPreisanzeige(b: string): string {
  if (b === 'kg') return 'kg'
  if (b === 'Liter') return 'l'
  return 'Stück'
}

/** DB-Speicherstring für kauf_einheit (klein, außer Liter). */
export function kaufEinheitFuerDb(k: LagerKaufEinheit): string {
  if (k === 'Liter') return 'Liter'
  return k
}

export function kaufEinheitAusDb(s: string): LagerKaufEinheit | null {
  return normalisiereKaufEinheit(s)
}
