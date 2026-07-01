/**
 * Zentrale Depot-Kennzahlen und Zeitreihen — korrigierte Cashflow-Logik.
 */

import { berechneIrrAnnualizedPercent } from '@/lib/portfolio-analyse/parqet-core/math-utils'
import {
  parqetIrrCashflowsAusBuchungen,
  parqetIrrDiagnose,
} from '@/lib/portfolio-analyse/parqet-xirr'
import { gebuehrSteuerIndex, kaufEinstandBetragEur } from '@/lib/portfolio-analyse/parqet-einstand'
import { summeParqetRealisiertAusBuchungen } from '@/lib/portfolio-analyse/parqet-realisiert'
import type { PortfolioBuchung } from '@/lib/portfolio-analyse/types'
import { heuteIso } from '@/lib/portfolio-analyse/wertentwicklung-tage'

export type MonatsPunkt = { label: string; wert: number; monat: string }

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/** Einstand je ISIN (proportional bei Verkäufen) — gleiche Logik wie bestand.ts. */
function einstandJeIsin(buchungen: PortfolioBuchung[]): Map<string, { stueck: number; kosten: number }> {
  const map = new Map<string, { stueck: number; kosten: number }>()
  const sortiert = [...buchungen].sort((a, b) => a.datum.localeCompare(b.datum))
  const feeIndex = gebuehrSteuerIndex(buchungen)

  for (const b of sortiert) {
    if (!b.isin) continue
    const isin = b.isin.toUpperCase()
    const cur = map.get(isin) ?? { stueck: 0, kosten: 0 }

    if (b.typ === 'kauf') {
      let stk = b.stueck != null ? Math.abs(b.stueck) : 0
      if (stk <= 0 && b.kursEur != null && b.kursEur > 0) stk = b.betragEur / b.kursEur
      if (stk > 0) {
        cur.stueck += stk
        cur.kosten += kaufEinstandBetragEur(b, feeIndex)
      }
    } else if (b.typ === 'verkauf') {
      let stk = b.stueck != null ? Math.abs(b.stueck) : 0
      if (stk <= 0 && b.kursEur != null && b.kursEur > 0) stk = b.betragEur / b.kursEur
      if (cur.stueck > 0 && stk > 0) {
        const anteil = Math.min(1, stk / cur.stueck)
        cur.kosten = round2(cur.kosten * (1 - anteil))
        cur.stueck = Math.max(0, cur.stueck - stk)
      }
    }
    map.set(isin, cur)
  }
  return map
}

/** Monatliche Depotwerte (Einstand + Cash), letzter Punkt = Live-Depotwert, Lücken aufgefüllt. */
export function baueMonatsVerlauf(
  buchungen: PortfolioBuchung[],
  depotwertHeute: number,
): MonatsPunkt[] {
  const sortiert = [...buchungen].sort((a, b) => a.datum.localeCompare(b.datum))
  if (sortiert.length === 0) return []

  const byMonth = new Map<string, number>()
  let cash = 0
  const feeIndex = gebuehrSteuerIndex(buchungen)
  const wp = einstandJeIsin(buchungen)

  const wpKosten = () => {
    let s = 0
    for (const v of wp.values()) s += v.kosten
    return s
  }

  for (const b of sortiert) {
    const isin = b.isin?.toUpperCase()
    switch (b.typ) {
      case 'einzahlung':
        cash += b.betragEur
        break
      case 'auszahlung':
        cash -= b.betragEur
        break
      case 'kauf':
        cash -= b.betragEur
        if (isin) {
          const cur = wp.get(isin) ?? { stueck: 0, kosten: 0 }
          let stk = b.stueck != null ? Math.abs(b.stueck) : 0
          if (stk <= 0 && b.kursEur != null && b.kursEur > 0) stk = b.betragEur / b.kursEur
          if (stk > 0) {
            cur.stueck += stk
            cur.kosten += kaufEinstandBetragEur(b, feeIndex)
            wp.set(isin, cur)
          }
        }
        break
      case 'verkauf':
        cash += b.betragEur
        if (isin) {
          const cur = wp.get(isin)
          if (cur && cur.stueck > 0) {
            let stk = b.stueck != null ? Math.abs(b.stueck) : 0
            if (stk <= 0 && b.kursEur != null && b.kursEur > 0) stk = b.betragEur / b.kursEur
            if (stk > 0) {
              const anteil = Math.min(1, stk / cur.stueck)
              cur.kosten = round2(cur.kosten * (1 - anteil))
              cur.stueck = Math.max(0, cur.stueck - stk)
            }
          }
        }
        break
      case 'dividende':
      case 'zins':
        cash += b.betragEur
        break
      case 'steuer':
      case 'gebuehr':
        cash -= b.betragEur
        break
      default:
        break
    }
    const k = b.datum.slice(0, 7)
    byMonth.set(k, round2(cash + wpKosten()))
  }

  if (byMonth.size === 0) return []

  const firstKey = [...byMonth.keys()].sort()[0]
  const lastKey = [...byMonth.keys()].sort().at(-1)!
  const [y0, m0] = firstKey.split('-').map(Number)
  const [y1, m1] = lastKey.split('-').map(Number)

  const filled: MonatsPunkt[] = []
  let y = y0
  let m = m0
  let lastVal = byMonth.get(firstKey) ?? 0

  while (y < y1 || (y === y1 && m <= m1)) {
    const key = `${y}-${String(m).padStart(2, '0')}`
    if (byMonth.has(key)) lastVal = byMonth.get(key)!
    const d = new Date(y, m - 1, 1)
    filled.push({
      monat: key,
      label: d.toLocaleDateString('de-DE', { month: 'short', year: '2-digit' }),
      wert: lastVal,
    })
    m++
    if (m > 12) {
      m = 1
      y++
    }
  }

  if (filled.length > 0) {
    const lastBook = filled[filled.length - 1].wert
    const scale = lastBook > 0 ? depotwertHeute / lastBook : 1
    for (const p of filled) {
      p.wert = round2(p.wert * scale)
    }
    filled[filled.length - 1].wert = depotwertHeute
  }

  return filled
}

/** Parqet: IZF erst ab ca. 90 Tagen Historie — sonst kein sinnvoller Wert. */
export function irrMindestHistorieTage(buchungen: PortfolioBuchung[], asOf: Date = new Date()): number | null {
  if (buchungen.length === 0) return null
  const min = [...buchungen].sort((a, b) => a.datum.localeCompare(b.datum))[0]?.datum
  if (!min) return null
  const start = new Date(`${min}T12:00:00`)
  if (!Number.isFinite(start.getTime())) return null
  return Math.floor((asOf.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
}

function irrStichtag(asOf: Date = new Date()): Date {
  const iso = asOf.toISOString().slice(0, 10)
  const heute = heuteIso()
  const tag = iso === heute || !Number.isFinite(asOf.getTime()) ? heute : iso
  return new Date(`${tag}T12:00:00`)
}

/** IZF (XIRR) wie Parqet — siehe parqet-xirr.ts */
export function irrAusBuchungen(
  buchungen: PortfolioBuchung[],
  terminalValueEUR: number,
  asOf: Date = new Date(),
): number | null {
  const stichtag = irrStichtag(asOf)
  const tage = irrMindestHistorieTage(buchungen, stichtag)
  if (tage != null && tage < 90) return null

  return berechneIrrAnnualizedPercent(
    parqetIrrCashflowsAusBuchungen(buchungen),
    terminalValueEUR,
    stichtag,
  )
}

export { parqetIrrDiagnose }

/** Zeitgewichtete Rendite aus Monatsverlauf, externe Zuflüsse pro Monat neutralisiert. */
export function twrAusMonatsVerlauf(
  verlauf: MonatsPunkt[],
  buchungen: PortfolioBuchung[],
): number | null {
  if (verlauf.length < 2) return null

  const extByMonth = new Map<string, number>()
  for (const b of buchungen) {
    const k = b.datum.slice(0, 7)
    if (!k) continue
    let delta = extByMonth.get(k) ?? 0
    if (b.typ === 'einzahlung') delta += b.betragEur
    if (b.typ === 'auszahlung') delta -= b.betragEur
    extByMonth.set(k, delta)
  }

  let produkt = 1
  for (let i = 1; i < verlauf.length; i++) {
    const v0 = verlauf[i - 1].wert
    const v1 = verlauf[i].wert
    if (v0 <= 0) continue
    const cf = extByMonth.get(verlauf[i].monat) ?? 0
    const r = (v1 - v0 - cf) / v0
    produkt *= 1 + r
  }

  return round2((produkt - 1) * 100)
}

/** Steuern nur in Monaten mit Dividenden/Zinsen (keine Kapitalertragsteuer auf Verkäufe). */
export function steuernAufDividendenMonate(buchungen: PortfolioBuchung[]): number {
  const divMonate = new Set<string>()
  const steuerMonate = new Map<string, number>()
  for (const b of buchungen) {
    const k = b.datum.slice(0, 7)
    if (!k) continue
    if (b.typ === 'dividende' || b.typ === 'zins') divMonate.add(k)
    if (b.typ === 'steuer') steuerMonate.set(k, (steuerMonate.get(k) ?? 0) + b.betragEur)
  }
  let s = 0
  for (const k of divMonate) {
    if (steuerMonate.has(k)) s += steuerMonate.get(k)!
  }
  return round2(s)
}

export function summenAusBuchungen(buchungen: PortfolioBuchung[]) {
  let dividenden = 0
  let zinsen = 0
  let steuern = 0
  let gebuehren = 0
  let einzahlungen = 0
  let auszahlungen = 0
  let kaeufe = 0
  let verkaeufe = 0

  for (const b of buchungen) {
    switch (b.typ) {
      case 'dividende':
        dividenden += b.betragEur
        break
      case 'zins':
        zinsen += b.betragEur
        break
      case 'steuer':
        steuern += b.betragEur
        break
      case 'gebuehr':
        gebuehren += b.betragEur
        break
      case 'einzahlung':
        einzahlungen += b.betragEur
        break
      case 'auszahlung':
        auszahlungen += b.betragEur
        break
      case 'kauf':
        kaeufe += b.betragEur
        break
      case 'verkauf':
        verkaeufe += b.betragEur
        break
      default:
        break
    }
  }

  return {
    dividenden: round2(dividenden),
    zinsen: round2(zinsen),
    steuern: round2(steuern),
    gebuehren: round2(gebuehren),
    einzahlungen: round2(einzahlungen),
    auszahlungen: round2(auszahlungen),
    kaeufe: round2(kaeufe),
    verkaeufe: round2(verkaeufe),
  }
}

type EinstandLot = { stueck: number; kosten: number }

function stueckAusBuchung(b: PortfolioBuchung, fallbackStueck?: number): number {
  let stk = b.stueck != null ? Math.abs(b.stueck) : 0
  if (stk <= 0 && b.kursEur != null && b.kursEur > 0 && b.betragEur > 0) {
    stk = b.betragEur / b.kursEur
  }
  if (stk <= 0 && fallbackStueck != null && fallbackStueck > 0) stk = fallbackStueck
  return stk
}

/**
 * Verkaufserlös wie Parqet: Stück × Kurs (Brutto „amount“), sonst Netto-Zufluss + Steuer am selben Tag.
 */
function verkaufErloesEur(
  b: PortfolioBuchung,
  stk: number,
  steuerZurueckEur: number,
): number {
  if (stk > 0 && b.kursEur != null && b.kursEur > 0) {
    const brutto = round2(stk * b.kursEur)
    if (brutto > b.betragEur * 1.001) return brutto
  }
  return round2(b.betragEur + steuerZurueckEur)
}

function fifoKosten(lots: EinstandLot[], stkVerk: number): number {
  let rest = stkVerk
  let kosten = 0
  while (rest > 1e-8 && lots.length > 0) {
    const lot = lots[0]
    const take = Math.min(rest, lot.stueck)
    if (lot.stueck <= 0) {
      lots.shift()
      continue
    }
    const anteil = take / lot.stueck
    kosten += lot.kosten * anteil
    lot.kosten = round2(lot.kosten * (1 - anteil))
    lot.stueck = Math.max(0, lot.stueck - take)
    rest -= take
    if (lot.stueck < 1e-8) lots.shift()
  }
  return round2(kosten)
}

/**
 * Kumulierter realisierter Gewinn/Verlust.
 * Parqet-CSV: Summe der importierten `realizedgains` (nur Sell-Zeilen).
 * Sonst: FIFO aus Buchungen (PDF / ältere Imports).
 */
export function realisierterGewinnAusVerkaeufen(buchungen: PortfolioBuchung[]): number {
  const parqetSumme = summeParqetRealisiertAusBuchungen(buchungen)
  if (parqetSumme != null) return parqetSumme

  const sortiert = [...buchungen].sort((a, b) => a.datum.localeCompare(b.datum))

  const steuerProTag = new Map<string, number>()
  const verkaeufeProTag = new Map<string, number>()
  for (const b of sortiert) {
    if (!b.isin) continue
    const key = `${b.datum}|${b.isin.toUpperCase()}`
    if (b.typ === 'steuer') {
      steuerProTag.set(key, round2((steuerProTag.get(key) ?? 0) + b.betragEur))
    }
    if (b.typ === 'verkauf') {
      verkaeufeProTag.set(key, (verkaeufeProTag.get(key) ?? 0) + 1)
    }
  }

  const lotsByIsin = new Map<string, EinstandLot[]>()
  let sum = 0

  for (const b of sortiert) {
    if (!b.isin) continue
    const isin = b.isin.toUpperCase()
    const tagKey = `${b.datum}|${isin}`

    if (b.typ === 'kauf') {
      const stk = stueckAusBuchung(b)
      if (stk <= 0) continue
      const lots = lotsByIsin.get(isin) ?? []
      lots.push({ stueck: stk, kosten: b.betragEur })
      lotsByIsin.set(isin, lots)
    } else if (b.typ === 'verkauf') {
      const lots = lotsByIsin.get(isin) ?? []
      const restStueck = lots.reduce((s, l) => s + l.stueck, 0)
      let stk = stueckAusBuchung(b, restStueck > 0 ? restStueck : undefined)
      if (stk <= 0 && b.betragEur > 0 && restStueck <= 0) {
        sum += b.betragEur
        continue
      }
      if (stk <= 0) continue

      const nVerk = verkaeufeProTag.get(tagKey) ?? 1
      const steuerAnteil = round2((steuerProTag.get(tagKey) ?? 0) / nVerk)
      const erloes = verkaufErloesEur(b, stk, steuerAnteil)
      const kosten = fifoKosten(lots, stk)
      sum += erloes - kosten
      lotsByIsin.set(isin, lots)
    }
  }

  return round2(sum)
}
