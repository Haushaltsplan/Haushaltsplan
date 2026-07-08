/**
 * Corporate Actions: Aktiensplits und Spin-offs.
 * Splits: Stück × faktor, Einstandsgesamt bleibt gleich.
 * Spin-offs: Kind-Aktien zuführen, Einstand Eltern/Kind anteilig splitten.
 */

import { rundePositionStueck } from '@/lib/portfolio-analyse/berechnung'
import type { AssetKlasse, PortfolioBuchung } from '@/lib/portfolio-analyse/types'

export type AktienSplit = {
  isin: string
  datum: string
  faktor: number
  /** Yahoo, manuell oder Parqet-Hinweis */
  quelle?: 'yahoo' | 'manuell' | 'parqet'
}

export type SpinOff = {
  parentIsin: string
  childIsin: string
  childName: string
  /** Wirksamkeit / Ex-Datum */
  datum: string
  /** Stichtag für Stückzahl (falls abweichend) */
  recordDatum?: string
  /** Kind-Aktien pro Eltern-Aktie */
  ratio: number
  /** Fallback wenn keine Kurse — Anteil Kind am Gesamteinstand (0–1) */
  childKostenAnteil?: number
}

/** Bekannte Splits — ergänzt durch Yahoo beim Import. */
export const AKTIEN_SPLITS: AktienSplit[] = [
  { isin: 'US81762P1021', datum: '2025-12-18', faktor: 5, quelle: 'manuell' },
]

/** Spin-offs — Yahoo liefert diese selten; Katalog + FMV-Fallback. */
export const SPIN_OFFS: SpinOff[] = [
  {
    parentIsin: 'US78409V1044',
    childIsin: 'US60744M1062',
    childName: 'Mobility Global',
    datum: '2026-07-01',
    recordDatum: '2026-06-15',
    ratio: 1,
    childKostenAnteil: 0.05,
  },
]

type StandMap = Map<
  string,
  { stueck: number; kosten: number; name: string; assetKlasse: AssetKlasse }
>

const DYN_SPLITS_STORAGE_KEY = 'mein-haushalt:portfolio-dynamische-splits'

const dynamischeSplits: AktienSplit[] = []

function ladeDynamischeSplitsAusStorage(): void {
  if (typeof window === 'undefined') return
  try {
    const raw = localStorage.getItem(DYN_SPLITS_STORAGE_KEY)
    if (!raw) return
    const parsed = JSON.parse(raw) as AktienSplit[]
    if (!Array.isArray(parsed)) return
    for (const s of parsed) {
      if (!splitSchluessel(s)) continue
      if (dynamischeSplits.some((x) => x.isin === s.isin && x.datum === s.datum)) continue
      dynamischeSplits.push(s)
    }
  } catch {
    /* ignore */
  }
}

function speichereDynamischeSplitsInStorage(): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(DYN_SPLITS_STORAGE_KEY, JSON.stringify(dynamischeSplits))
  } catch {
    /* ignore */
  }
}

if (typeof window !== 'undefined') {
  ladeDynamischeSplitsAusStorage()
}

export function registriereDynamischeSplits(splits: AktienSplit[]): number {
  let neu = 0
  for (const s of splits) {
    if (!splitSchluessel(s)) continue
    const dup = [...AKTIEN_SPLITS, ...dynamischeSplits].some(
      (x) => x.isin === s.isin && x.datum === s.datum,
    )
    if (dup) continue
    dynamischeSplits.push(s)
    neu++
  }
  if (neu > 0) speichereDynamischeSplitsInStorage()
  return neu
}

export function alleSplits(): AktienSplit[] {
  return [...AKTIEN_SPLITS, ...dynamischeSplits]
}

function splitSchluessel(s: AktienSplit): boolean {
  return (
    /^[A-Z]{2}[A-Z0-9]{10}$/.test(s.isin) &&
    /^\d{4}-\d{2}-\d{2}$/.test(s.datum) &&
    s.faktor > 0 &&
    Number.isFinite(s.faktor) &&
    Math.abs(s.faktor - 1) > 1e-8
  )
}

export function splitsAmDatum(datumIso: string): AktienSplit[] {
  return alleSplits().filter((s) => s.datum === datumIso && splitSchluessel(s))
}

/** Stückzahl × faktor, Einstandsgesamt (kosten) bleibt gleich. */
export function wendeAktienSplitsAufMap(map: StandMap, datumIso: string): void {
  for (const split of splitsAmDatum(datumIso)) {
    const cur = map.get(split.isin.toUpperCase())
    if (!cur || cur.stueck < 1e-8 || split.faktor <= 0 || !Number.isFinite(split.faktor)) continue
    cur.stueck = rundePositionStueck(cur.stueck * split.faktor)
  }
}

const SPIN_OFFS_BY_DATE = new Map<string, SpinOff[]>()

for (const s of SPIN_OFFS) {
  const list = SPIN_OFFS_BY_DATE.get(s.datum) ?? []
  list.push(s)
  SPIN_OFFS_BY_DATE.set(s.datum, list)
}

export function spinOffsAmDatum(datumIso: string): SpinOff[] {
  return SPIN_OFFS_BY_DATE.get(datumIso) ?? []
}

export function spinOffBereitsGebucht(buchungen: PortfolioBuchung[], spin: SpinOff): boolean {
  const child = spin.childIsin.toUpperCase()
  return buchungen.some(
    (b) =>
      b.datum === spin.datum &&
      b.isin?.toUpperCase() === child &&
      (b.parqetTyp === 'SpinOff' || b.parqetTyp === 'Spinoff'),
  )
}

/**
 * Fallback ohne synthetische Buchungen: Kind-Anteil direkt im Bestand.
 * Nur wenn noch keine SpinOff-Buchung existiert.
 */
export function wendeSpinOffsAufMap(
  map: StandMap,
  datumIso: string,
  buchungen: PortfolioBuchung[],
): void {
  for (const spin of spinOffsAmDatum(datumIso)) {
    if (spinOffBereitsGebucht(buchungen, spin)) continue

    const parentIsin = spin.parentIsin.toUpperCase()
    const parent = map.get(parentIsin)
    if (!parent || parent.stueck < 1e-8) continue

    const childStueck = rundePositionStueck(parent.stueck * spin.ratio)
    if (childStueck < 1e-8) continue

    const anteil = Math.min(0.95, Math.max(0.01, spin.childKostenAnteil ?? 0.05))
    const childKosten = Math.round(parent.kosten * anteil * 100) / 100
    parent.kosten = Math.round(Math.max(0, parent.kosten - childKosten) * 100) / 100

    const childIsin = spin.childIsin.toUpperCase()
    const child = map.get(childIsin) ?? {
      stueck: 0,
      kosten: 0,
      name: spin.childName,
      assetKlasse: parent.assetKlasse,
    }
    child.stueck += childStueck
    child.kosten += childKosten
    child.name = spin.childName
    map.set(childIsin, child)
  }
}

export function istCorporateActionOhneCash(b: PortfolioBuchung): boolean {
  return b.parqetTyp === 'SpinOff' || b.parqetTyp === 'Spinoff' || b.parqetTyp === 'SpinOffCost'
}
