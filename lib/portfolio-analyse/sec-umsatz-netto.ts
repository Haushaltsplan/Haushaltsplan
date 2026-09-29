/**
 * Nettoumsatz vs. ASC-606-Brutto (Incentives/Rebates).
 *
 * Klasse: alle SEC-Filer, besonders Plattformen und Zahlungsnetze.
 * `RevenueFromContractWithCustomerExcludingAssessedTax` kann vor Contra-Revenue
 * liegen, während `Revenues` / `SalesRevenueNet` die 10-K-Nettzahl ist.
 * Keine Ticker-Sonderlocken.
 */

export const UMSATZ_NETTO_TAGS = [
  'Revenues',
  'SalesRevenueNet',
  'SalesRevenueServicesNet',
  'Revenue',
] as const

export const UMSATZ_ASC_TAGS = [
  'RevenueFromContractWithCustomerExcludingAssessedTax',
  'RevenueFromContractWithCustomerIncludingAssessedTax',
] as const

/** Priorität: Netto zuerst, ASC nur als Lückenfüller. */
export const UMSATZ_TAG_KETTE: string[] = [...UMSATZ_NETTO_TAGS, ...UMSATZ_ASC_TAGS]

const GROSS_NET_FAKTOR = 1.18
const UMSATZ_SPRUNG_PCT = 18
const EBIT_STABIL_PCT = 12
const MARGE_EINBRUCH = 0.06
const SCHRUMPF_FAKTOR = 0.92

const NETTO_TAG = /^(Revenues|SalesRevenueNet|SalesRevenueServicesNet|Revenue)$/i

export function istUmsatzNettoTag(tag: string): boolean {
  return NETTO_TAG.test(tag.replace(/^[^:]+:/, ''))
}

/** Bei klarem Gross-vs-Net-Konflikt die kleinere (Netto-)Zahl. */
export function waehleNettoUmsatz(...kandidaten: Array<number | null | undefined>): number | null {
  const vals = kandidaten.filter((v): v is number => v != null && Number.isFinite(v) && v > 0)
  if (vals.length === 0) return null
  if (vals.length === 1) return vals[0]!
  const min = Math.min(...vals)
  const max = Math.max(...vals)
  if (max / min >= GROSS_NET_FAKTOR) return min
  return vals[0]!
}

export function merkeBesserenUmsatz(
  prev: { val: number; tag: string } | undefined,
  next: { val: number; tag: string },
): { val: number; tag: string } {
  if (!prev) return next
  const prevNet = istUmsatzNettoTag(prev.tag)
  const nextNet = istUmsatzNettoTag(next.tag)
  if (nextNet && !prevNet) return next
  if (!nextNet && prevNet) return prev
  const gewaehlt = waehleNettoUmsatz(prev.val, next.val)
  if (gewaehlt != null && gewaehlt === next.val && next.val !== prev.val) return next
  return prev
}

export type UmsatzEbitPunkt = {
  umsatz: number | null
  ebit: number | null
}

function hatWerte(p: UmsatzEbitPunkt): p is { umsatz: number; ebit: number } {
  return (
    p.umsatz != null &&
    p.ebit != null &&
    Number.isFinite(p.umsatz) &&
    Number.isFinite(p.ebit) &&
    p.umsatz > 0 &&
    p.ebit > 0
  )
}

function rekonstruierenWennBrutto(basis: UmsatzEbitPunkt, ziel: UmsatzEbitPunkt): number | null {
  if (!hatWerte(basis) || !hatWerte(ziel)) return null
  const uYoy = (ziel.umsatz / basis.umsatz - 1) * 100
  const eYoy = (ziel.ebit / basis.ebit - 1) * 100
  const mBasis = basis.ebit / basis.umsatz
  const mZiel = ziel.ebit / ziel.umsatz
  if (!(uYoy >= UMSATZ_SPRUNG_PCT && Math.abs(eYoy) <= EBIT_STABIL_PCT && mBasis - mZiel >= MARGE_EINBRUCH)) {
    return null
  }
  const neu = ziel.ebit / mBasis
  if (!(neu > 0 && neu < ziel.umsatz * SCHRUMPF_FAKTOR)) return null
  return neu
}

/**
 * Jahre, in denen der Umsatz springt, EBIT aber nicht — typisch Gross-vs-Net.
 * Rekonstruiert Umsatz als EBIT / Nachbar-EBIT-Marge (vorwärts und rückwärts, kaskadiert).
 */
export function bereinigeUmsatzGrossVsNet(punkte: UmsatzEbitPunkt[]): UmsatzEbitPunkt[] {
  const out = punkte.map((p) => ({ umsatz: p.umsatz, ebit: p.ebit }))
  let changed = true
  let guard = 0
  while (changed && guard++ < out.length + 2) {
    changed = false
    for (let i = 1; i < out.length; i++) {
      const neu = rekonstruierenWennBrutto(out[i - 1]!, out[i]!)
      if (neu != null) {
        out[i] = { ...out[i]!, umsatz: neu }
        changed = true
      }
    }
    for (let i = out.length - 1; i >= 1; i--) {
      const neu = rekonstruierenWennBrutto(out[i]!, out[i - 1]!)
      if (neu != null) {
        out[i - 1] = { ...out[i - 1]!, umsatz: neu }
        changed = true
      }
    }
  }
  return out
}

function sortiereSchluessel<K>(keys: K[]): K[] {
  return [...keys].sort((a, b) => {
    if (typeof a === 'number' && typeof b === 'number') return a - b
    return String(a).localeCompare(String(b))
  })
}

/** In-place: Jahresmappe (Zahl) an EBIT-stabile Gross-Sprünge anpassen. */
export function wendeUmsatzGrossVsNetAufMappe<K>(umsatz: Map<K, number>, ebit: Map<K, number>): void {
  const keys = sortiereSchluessel([...new Set([...umsatz.keys(), ...ebit.keys()])])
  const punkte = keys.map((k) => ({
    umsatz: umsatz.get(k) ?? null,
    ebit: ebit.get(k) ?? null,
  }))
  const clean = bereinigeUmsatzGrossVsNet(punkte)
  keys.forEach((k, i) => {
    const neu = clean[i]!.umsatz
    if (neu != null) umsatz.set(k, neu)
  })
}

/** In-place: Treffer-Reihe (wert) analog. */
export function wendeUmsatzGrossVsNetAufTreffer<K>(
  umsatz: Map<K, { wert: number }>,
  ebit: Map<K, { wert: number }>,
): void {
  const keys = sortiereSchluessel([...new Set([...umsatz.keys(), ...ebit.keys()])])
  const punkte = keys.map((k) => ({
    umsatz: umsatz.get(k)?.wert ?? null,
    ebit: ebit.get(k)?.wert ?? null,
  }))
  const clean = bereinigeUmsatzGrossVsNet(punkte)
  keys.forEach((k, i) => {
    const t = umsatz.get(k)
    const neu = clean[i]!.umsatz
    if (t && neu != null) t.wert = neu
  })
}
