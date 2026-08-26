/**
 * Zentrale Depot-Kennzahlen und Zeitreihen — korrigierte Cashflow-Logik.
 */

import { berechneIrrAnnualizedPercent } from '@/lib/portfolio-analyse/parqet-core/math-utils'
import {
  parqetIrrCashflowsAusBuchungen,
  parqetIrrDiagnose,
} from '@/lib/portfolio-analyse/parqet-xirr'
import { wendeCorporateActionsAufLots, type EinstandLot } from '@/lib/portfolio-analyse/corporate-actions'
import { gebuehrIndex, kaufEinstandBetragEur } from '@/lib/portfolio-analyse/parqet-einstand'
import { cashBetragEur, normalisiereHandelsBuchung } from '@/lib/portfolio-analyse/parqet-handelswerte'
import {
  buchungZaehltFuerParqetRealisiert,
  istParqetTransferUmbuchung,
} from '@/lib/portfolio-analyse/parqet-realisiert'
import type { PortfolioBuchung } from '@/lib/portfolio-analyse/types'
import { alleKalendertage, heuteIso } from '@/lib/portfolio-analyse/wertentwicklung-tage'

export type MonatsPunkt = { label: string; wert: number; monat: string }

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/** Einstand je ISIN (proportional bei Verkäufen) — gleiche Logik wie bestand.ts. */
function einstandJeIsin(buchungen: PortfolioBuchung[]): Map<string, { stueck: number; kosten: number }> {
  const map = new Map<string, { stueck: number; kosten: number }>()
  const sortiert = [...buchungen].sort((a, b) => a.datum.localeCompare(b.datum))
  const feeIndex = gebuehrIndex(buchungen)

  for (const b of sortiert) {
    if (!b.isin) continue
    const isin = b.isin.toUpperCase()
    const cur = map.get(isin) ?? { stueck: 0, kosten: 0 }
    const cash = cashBetragEur(b)

    if (b.typ === 'kauf') {
      let stk = b.stueck != null ? Math.abs(b.stueck) : 0
      if (stk <= 0 && b.kursEur != null && b.kursEur > 0) stk = cash / b.kursEur
      if (stk > 0) {
        cur.stueck += stk
        cur.kosten += kaufEinstandBetragEur(b, feeIndex)
      }
    } else if (b.typ === 'verkauf') {
      let stk = b.stueck != null ? Math.abs(b.stueck) : 0
      if (stk <= 0 && b.kursEur != null && b.kursEur > 0) stk = cash / b.kursEur
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
  const feeIndex = gebuehrIndex(buchungen)
  const wp = einstandJeIsin(buchungen)

  const wpKosten = () => {
    let s = 0
    for (const v of wp.values()) s += v.kosten
    return s
  }

  for (const b of sortiert) {
    const isin = b.isin?.toUpperCase()
    const cashAmt = cashBetragEur(b)
    switch (b.typ) {
      case 'einzahlung':
        cash += cashAmt
        break
      case 'auszahlung':
        cash -= cashAmt
        break
      case 'kauf':
        cash -= cashAmt
        if (isin) {
          const cur = wp.get(isin) ?? { stueck: 0, kosten: 0 }
          let stk = b.stueck != null ? Math.abs(b.stueck) : 0
          if (stk <= 0 && b.kursEur != null && b.kursEur > 0) stk = cashAmt / b.kursEur
          if (stk > 0) {
            cur.stueck += stk
            cur.kosten += kaufEinstandBetragEur(b, feeIndex)
            wp.set(isin, cur)
          }
        }
        break
      case 'verkauf':
        cash += cashAmt
        if (isin) {
          const cur = wp.get(isin)
          if (cur && cur.stueck > 0) {
            let stk = b.stueck != null ? Math.abs(b.stueck) : 0
            if (stk <= 0 && b.kursEur != null && b.kursEur > 0) stk = cashAmt / b.kursEur
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
        cash += cashAmt
        break
      case 'steuer':
      case 'gebuehr':
        cash -= cashAmt
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
        kaeufe += cashBetragEur(b)
        break
      case 'verkauf':
        verkaeufe += cashBetragEur(b)
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

function kuerzeLotsKosten(lots: EinstandLot[], betragEur: number): void {
  if (betragEur <= 0 || lots.length === 0) return
  const sum = lots.reduce((s, l) => s + l.kosten, 0)
  if (sum <= 0.005) return
  const take = Math.min(betragEur, sum)
  const f = 1 - take / sum
  for (const lot of lots) lot.kosten = round2(lot.kosten * f)
}

function stueckAusBuchung(b: PortfolioBuchung, fallbackStueck?: number): number {
  const n = normalisiereHandelsBuchung(b)
  let stk = n.stueck
  if (stk <= 0 && n.kursEur != null && n.kursEur > 0 && n.betragEur > 0) {
    stk = n.betragEur / n.kursEur
  }
  if (stk <= 0 && fallbackStueck != null && fallbackStueck > 0) stk = fallbackStueck
  return stk
}

/**
 * Verkaufserlös: Cash der Buchung, plus Steuer am selben Tag.
 * Stück×Kurs nur wenn es knapp über dem Cash liegt (Brutto vs. Netto) — nicht bei PDF
 * „Betrag = Kurs“-Fehlheilung (sonst 10× zu hoher Erlös).
 */
function verkaufErloesEur(
  b: PortfolioBuchung,
  stk: number,
  steuerZurueckEur: number,
): number {
  const n = normalisiereHandelsBuchung(b)
  const cash = round2(n.betragEur + steuerZurueckEur)
  if (stk > 0 && n.kursEur != null && n.kursEur > 0) {
    const brutto = round2(stk * n.kursEur)
    if (brutto > cash * 1.001 && brutto <= cash * 1.35) return brutto
  }
  return cash
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

export type RealisiertZeitraum = {
  /** Exclusive — analog Periodenfilter `datum > start`. */
  nachDatumExclusive?: string
  bisDatumInclusive?: string
}

/**
 * Realisierte Gewinne/Verluste je Verkaufstag.
 * Parqet-Sell mit `realizedgains` → importierter Wert; sonst FIFO (PDF/manuell).
 * TransferOut nur Lots verbrauchen, kein P/L (wie Parqet).
 * Spin-offs/Splits wie der Bestand — sonst zählen Kind-Verkäufe als 100 % Gewinn.
 */
export function realisiertPnlEreignisse(
  buchungen: PortfolioBuchung[],
): { datum: string; pnl: number }[] {
  const sortiert = [...buchungen].sort((a, b) => a.datum.localeCompare(b.datum))
  const feeIndex = gebuehrIndex(buchungen)

  const steuerProTag = new Map<string, number>()
  const verkaeufeProTag = new Map<string, number>()
  const byTag = new Map<string, PortfolioBuchung[]>()
  for (const b of sortiert) {
    const tagListe = byTag.get(b.datum) ?? []
    tagListe.push(b)
    byTag.set(b.datum, tagListe)
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
  const ereignisse: { datum: string; pnl: number; fifoPnl: number; parqetPnl: number | null; isin: string }[] = []
  const tage = [...byTag.keys()].sort()
  let vorigerTag: string | null = null

  for (const tag of tage) {
    if (vorigerTag) {
      for (const d of alleKalendertage(vorigerTag, tag)) {
        if (d === vorigerTag || d === tag) continue
        wendeCorporateActionsAufLots(lotsByIsin, d, buchungen)
      }
    }
    for (const b of byTag.get(tag) ?? []) {
      if (!b.isin) continue
      const isin = b.isin.toUpperCase()
      const tagKey = `${b.datum}|${isin}`

      if (b.typ === 'kauf') {
        const stk = stueckAusBuchung(b)
        if (stk <= 0) continue
        const lots = lotsByIsin.get(isin) ?? []
        lots.push({ stueck: stk, kosten: kaufEinstandBetragEur(b, feeIndex) })
        lotsByIsin.set(isin, lots)
        continue
      }

      if ((b.parqetTyp ?? '') === 'SpinOffCost' && b.betragEur > 0) {
        kuerzeLotsKosten(lotsByIsin.get(isin) ?? [], b.betragEur)
        continue
      }

      if (b.typ !== 'verkauf') continue

      const lots = lotsByIsin.get(isin) ?? []
      const restStueck = lots.reduce((s, l) => s + l.stueck, 0)
      const stk = stueckAusBuchung(b, restStueck > 0 ? restStueck : undefined)
      let fifoPnl = 0

      if (stk > 0) {
        const matched = Math.min(stk, restStueck)
        if (matched > 1e-8) {
          const nVerk = verkaeufeProTag.get(tagKey) ?? 1
          const steuerAnteil = round2((steuerProTag.get(tagKey) ?? 0) / nVerk)
          const erloes = verkaufErloesEur(b, stk, steuerAnteil)
          const kosten = fifoKosten(lots, matched)
          const erloesMatched = matched + 1e-8 < stk ? round2(erloes * (matched / stk)) : erloes
          fifoPnl = round2(erloesMatched - kosten)
          lotsByIsin.set(isin, lots)
        }
      }

      if (istParqetTransferUmbuchung(b)) continue

      const parqetPnl = buchungZaehltFuerParqetRealisiert(b) ? (b.realisierterGewinnEur ?? 0) : null
      const pnl = parqetPnl != null ? parqetPnl : fifoPnl
      if (pnl !== 0 || fifoPnl !== 0) {
        ereignisse.push({ datum: b.datum, pnl, fifoPnl, parqetPnl, isin })
      }
    }
    wendeCorporateActionsAufLots(lotsByIsin, tag, buchungen)
    vorigerTag = tag
  }

  return ereignisse
}

/**
 * Kumulierter realisierter Gewinn/Verlust.
 * Parqet-CSV-Sells: importierte `realizedgains`; PDF/manuelle Verkäufe: FIFO.
 */
export function realisierterGewinnAusVerkaeufen(
  buchungen: PortfolioBuchung[],
  zeitraum?: RealisiertZeitraum,
): number {
  let sum = 0
  for (const e of realisiertPnlEreignisse(buchungen)) {
    if (zeitraum?.nachDatumExclusive != null && e.datum <= zeitraum.nachDatumExclusive) continue
    if (zeitraum?.bisDatumInclusive != null && e.datum > zeitraum.bisDatumInclusive) continue
    sum += e.pnl
  }
  return round2(sum)
}
