/** Steuern-Auswertung — angelehnt an Parqet (Steuern pro Jahr + Quellensteuer). */

import { istGezahlteBardividende } from '@/lib/portfolio-analyse/dividenden-buchung'
import type { PortfolioBuchung } from '@/lib/portfolio-analyse/types'

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export type SteuerAktivitaetKategorie = 'kauf' | 'verkauf' | 'dividende' | 'sonstige'

export type SteuerJahrZeile = {
  jahr: number
  kaufEur: number
  verkaufEur: number
  dividendeEur: number
  sonstigeEur: number
  summeEur: number
}

export type QuellensteuerLandZeile = {
  landCode: string
  landName: string
  flag: string
  dividendenBruttoEur: number
  steuernGezahltEur: number
  rueckerstattungEur: number
  rueckerstattungProzent: number | null
}

/** Erwartete Quellensteuer-Rückerstattung (DBA, DE) — Anteil der Brutto-Dividende. */
const RUECKERSTATTUNG_ANTEIL: Record<string, number> = {
  US: 0.15,
  NL: 0,
  FR: 0.172,
  CH: 0.2,
  CA: 0,
  IE: 0.25,
  GB: 0,
  LU: 0,
  SE: 0,
  DK: 0,
  NO: 0,
  FI: 0,
  BE: 0,
  AT: 0,
  IT: 0.15,
  ES: 0.15,
  PT: 0,
  HK: 0,
  SG: 0,
  JP: 0,
  AU: 0,
  TW: 0,
  KR: 0,
}

const landNamen = new Intl.DisplayNames('de', { type: 'region' })

function landAusIsin(isin: string | null): string | null {
  if (!isin || isin.length < 2) return null
  const code = isin.slice(0, 2).toUpperCase()
  return /^[A-Z]{2}$/.test(code) ? code : null
}

export function landFlagEmoji(landCode: string): string {
  if (landCode.length !== 2) return ''
  const u = landCode.toUpperCase()
  return String.fromCodePoint(...[...u].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65))
}

export function landNameDe(landCode: string): string {
  try {
    return landNamen.of(landCode) ?? landCode
  } catch {
    return landCode
  }
}

function kategorieAusAktivitaet(b: PortfolioBuchung): SteuerAktivitaetKategorie | null {
  const pt = (b.parqetTyp ?? '').trim().toLowerCase()
  if (b.typ === 'kauf' || pt === 'buy') return 'kauf'
  if (b.typ === 'verkauf' || pt === 'sell') return 'verkauf'
  if (b.typ === 'dividende' || b.typ === 'zins' || pt === 'dividend') return 'dividende'
  return null
}

function steuerAufParent(b: PortfolioBuchung): number {
  if (b.steuerEur != null && b.steuerEur > 0) return round2(b.steuerEur)
  return 0
}

function kategorieFuerSteuerZeile(
  steuer: PortfolioBuchung,
  byDatum: Map<string, PortfolioBuchung[]>,
): SteuerAktivitaetKategorie {
  const peers = (byDatum.get(steuer.datum) ?? []).filter(
    (p) => p.typ !== 'steuer' && p.typ !== 'gebuehr',
  )
  const isin = steuer.isin?.toUpperCase() ?? null
  const kandidaten = isin ? peers.filter((p) => p.isin?.toUpperCase() === isin) : peers

  const pick = (list: PortfolioBuchung[]): SteuerAktivitaetKategorie | null => {
    const div = list.find((p) => p.typ === 'dividende' || p.typ === 'zins')
    if (div) return 'dividende'
    const verk = list.find((p) => p.typ === 'verkauf')
    if (verk) return 'verkauf'
    const kauf = list.find((p) => p.typ === 'kauf')
    if (kauf) return 'kauf'
    return null
  }

  if (kandidaten.length > 0) {
    const kat = pick(kandidaten)
    if (kat) return kat
  }
  const kat = pick(peers)
  if (kat) return kat
  return 'sonstige'
}

function leereJahrZeile(jahr: number): SteuerJahrZeile {
  return {
    jahr,
    kaufEur: 0,
    verkaufEur: 0,
    dividendeEur: 0,
    sonstigeEur: 0,
    summeEur: 0,
  }
}

function addSteuer(zeile: SteuerJahrZeile, kat: SteuerAktivitaetKategorie, betrag: number) {
  if (betrag <= 0) return
  switch (kat) {
    case 'kauf':
      zeile.kaufEur = round2(zeile.kaufEur + betrag)
      break
    case 'verkauf':
      zeile.verkaufEur = round2(zeile.verkaufEur + betrag)
      break
    case 'dividende':
      zeile.dividendeEur = round2(zeile.dividendeEur + betrag)
      break
    default:
      zeile.sonstigeEur = round2(zeile.sonstigeEur + betrag)
  }
  zeile.summeEur = round2(zeile.summeEur + betrag)
}

/** Steuern pro Jahr nach Aktivitätstyp (Parqet „Steuern pro Jahr“). */
export function steuernProJahr(buchungen: PortfolioBuchung[]): SteuerJahrZeile[] {
  const byDatum = new Map<string, PortfolioBuchung[]>()
  for (const b of buchungen) {
    const list = byDatum.get(b.datum) ?? []
    list.push(b)
    byDatum.set(b.datum, list)
  }

  const jahre = new Map<number, SteuerJahrZeile>()

  for (const b of buchungen) {
    const kat = kategorieAusAktivitaet(b)
    const steuer = steuerAufParent(b)
    if (!kat || steuer <= 0) continue
    const jahr = Number(b.datum.slice(0, 4))
    if (!Number.isFinite(jahr)) continue
    const zeile = jahre.get(jahr) ?? leereJahrZeile(jahr)
    addSteuer(zeile, kat, steuer)
    jahre.set(jahr, zeile)
  }

  for (const b of buchungen) {
    if (b.typ !== 'steuer') continue
    const betrag = round2(Math.abs(b.betragEur))
    if (betrag <= 0) continue
    const jahr = Number(b.datum.slice(0, 4))
    if (!Number.isFinite(jahr)) continue
    const zeile = jahre.get(jahr) ?? leereJahrZeile(jahr)
    addSteuer(zeile, kategorieFuerSteuerZeile(b, byDatum), betrag)
    jahre.set(jahr, zeile)
  }

  return [...jahre.values()].sort((a, b) => b.jahr - a.jahr)
}

function istQuellensteuerDividende(b: PortfolioBuchung): boolean {
  if (!istGezahlteBardividende(b)) return false
  const land = landAusIsin(b.isin)
  return land != null && land !== 'DE'
}

/** Quellensteuer nach Land und Jahr (Parqet „Quellensteuer“). */
export function quellensteuerProJahr(
  buchungen: PortfolioBuchung[],
  jahr: number,
): QuellensteuerLandZeile[] {
  const byDatum = new Map<string, PortfolioBuchung[]>()
  for (const b of buchungen) {
    if (!b.datum.startsWith(String(jahr))) continue
    const list = byDatum.get(b.datum) ?? []
    list.push(b)
    byDatum.set(b.datum, list)
  }

  const landMap = new Map<string, { brutto: number; steuer: number }>()

  for (const b of buchungen) {
    if (!b.datum.startsWith(String(jahr))) continue
    if (!istQuellensteuerDividende(b)) continue
    const land = landAusIsin(b.isin)!
    const steuer = steuerAufParent(b)
    const brutto = round2(b.betragEur + steuer)
    const cur = landMap.get(land) ?? { brutto: 0, steuer: 0 }
    cur.brutto = round2(cur.brutto + brutto)
    cur.steuer = round2(cur.steuer + steuer)
    landMap.set(land, cur)
  }

  for (const b of buchungen) {
    if (!b.datum.startsWith(String(jahr)) || b.typ !== 'steuer') continue
    const kat = kategorieFuerSteuerZeile(b, byDatum)
    if (kat !== 'dividende') continue
    const land = landAusIsin(b.isin)
    if (!land || land === 'DE') continue
    const betrag = round2(Math.abs(b.betragEur))
    if (betrag <= 0) continue
    const cur = landMap.get(land) ?? { brutto: 0, steuer: 0 }
    cur.steuer = round2(cur.steuer + betrag)
    landMap.set(land, cur)
  }

  return [...landMap.entries()]
    .map(([landCode, { brutto, steuer }]) => {
      const anteil = RUECKERSTATTUNG_ANTEIL[landCode]
      const rueckerstattungEur =
        anteil != null && brutto > 0 ? round2(brutto * anteil) : 0
      const rueckerstattungProzent =
        anteil != null && brutto > 0 ? round2(anteil * 100) : null
      return {
        landCode,
        landName: landNameDe(landCode),
        flag: landFlagEmoji(landCode),
        dividendenBruttoEur: brutto,
        steuernGezahltEur: steuer,
        rueckerstattungEur,
        rueckerstattungProzent,
      }
    })
    .filter((z) => z.dividendenBruttoEur > 0 || z.steuernGezahltEur > 0)
    .sort((a, b) => b.dividendenBruttoEur - a.dividendenBruttoEur)
}

export function verfuegbareSteuerJahre(buchungen: PortfolioBuchung[]): number[] {
  const set = new Set<number>()
  const jetzt = new Date().getFullYear()
  for (const b of buchungen) {
    const y = Number(b.datum.slice(0, 4))
    if (!Number.isFinite(y) || y > jetzt) continue
    const hatSteuer =
      (b.steuerEur != null && b.steuerEur > 0) ||
      b.typ === 'steuer' ||
      (kategorieAusAktivitaet(b) != null && steuerAufParent(b) > 0)
    if (hatSteuer || istQuellensteuerDividende(b)) set.add(y)
  }
  for (const z of steuernProJahr(buchungen)) set.add(z.jahr)
  return [...set].sort((a, b) => b - a)
}
