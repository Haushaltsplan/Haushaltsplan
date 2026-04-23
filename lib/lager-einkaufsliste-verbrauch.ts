/** Roh-Verbrauch aus Supabase für Einkaufslisten-Kennzahlen. */

export type LagerVerbrauchHistorieZeile = {
  produkt_id: string
  menge: number
  erstellt_am: string
}

export type VerbrauchKennzahlen = {
  /** Summe Basismenge, letzte 7 Tage. */
  summe7Tage: number
  /** Summe Basismenge, letzte 28 Tage. */
  summe28Tage: number
  /** Summe Basismenge, letzte 90 Tage. */
  summe90Tage: number
  /** Summe(28 Tage) / 4 — interpretiert als Ø pro Woche im Vier-Wochen-Fenster. */
  durchschnittProWoche: number
  /** Summe(90 Tage) / 3 — grob Ø pro 30-Tage-Monat im Drei-Monats-Fenster. */
  durchschnittProMonat: number
}

function runde3(n: number) {
  return Math.round(n * 1000) / 1000
}

export function verbrauchKennzahlenFuerProdukt(
  rows: LagerVerbrauchHistorieZeile[],
  produktId: string,
  jetztMs = Date.now(),
): VerbrauchKennzahlen {
  const ms7 = jetztMs - 7 * 86_400_000
  const ms28 = jetztMs - 28 * 86_400_000
  const ms90 = jetztMs - 90 * 86_400_000
  let summe7Tage = 0
  let summe28Tage = 0
  let summe90Tage = 0
  for (const r of rows) {
    if (r.produkt_id !== produktId) continue
    const t = new Date(r.erstellt_am).getTime()
    if (!Number.isFinite(t)) continue
    const m = Number(r.menge)
    if (!Number.isFinite(m) || m <= 0) continue
    if (t >= ms90) summe90Tage += m
    if (t >= ms28) summe28Tage += m
    if (t >= ms7) summe7Tage += m
  }
  summe7Tage = runde3(summe7Tage)
  summe28Tage = runde3(summe28Tage)
  summe90Tage = runde3(summe90Tage)
  const durchschnittProWoche = runde3(summe28Tage / 4)
  const durchschnittProMonat = runde3(summe90Tage / 3)
  return { summe7Tage, summe28Tage, summe90Tage, durchschnittProWoche, durchschnittProMonat }
}

/** Vorschlagsmenge zum Einkaufen (Basiseinheit), falls keine manuelle Menge gesetzt ist. */
export function vorschlagsMengeEinkauf(kenn: VerbrauchKennzahlen): number {
  const basis = Math.max(kenn.durchschnittProWoche, kenn.durchschnittProMonat / 4.33, kenn.summe7Tage)
  if (!Number.isFinite(basis) || basis <= 0) return 1
  const gerundet = Math.max(1, Math.ceil(basis * 10) / 10)
  return Math.min(gerundet, 9999)
}
