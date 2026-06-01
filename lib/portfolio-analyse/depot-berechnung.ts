/**
 * Zentrale Depot-Kennzahlen und Zeitreihen — korrigierte Cashflow-Logik.
 */

import { berechneIrrAnnualizedPercent } from '@/lib/portfolio-analyse/parqet-core/math-utils'
import { parqetIrrCashflowsAusBuchungen } from '@/lib/portfolio-analyse/parqet-xirr'
import type { PortfolioBuchung } from '@/lib/portfolio-analyse/types'

export type MonatsPunkt = { label: string; wert: number; monat: string }

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/** Einstand je ISIN (proportional bei Verkäufen) — gleiche Logik wie bestand.ts. */
function einstandJeIsin(buchungen: PortfolioBuchung[]): Map<string, { stueck: number; kosten: number }> {
  const map = new Map<string, { stueck: number; kosten: number }>()
  const sortiert = [...buchungen].sort((a, b) => a.datum.localeCompare(b.datum))

  for (const b of sortiert) {
    if (!b.isin) continue
    const isin = b.isin.toUpperCase()
    const cur = map.get(isin) ?? { stueck: 0, kosten: 0 }

    if (b.typ === 'kauf') {
      let stk = b.stueck != null ? Math.abs(b.stueck) : 0
      if (stk <= 0 && b.kursEur != null && b.kursEur > 0) stk = b.betragEur / b.kursEur
      if (stk > 0) {
        cur.stueck += stk
        cur.kosten += b.betragEur
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
            cur.kosten += b.betragEur
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

/** IZF (XIRR) wie Parqet — siehe parqet-xirr.ts */
export function irrAusBuchungen(
  buchungen: PortfolioBuchung[],
  terminalValueEUR: number,
  asOf: Date = new Date(),
): number | null {
  return berechneIrrAnnualizedPercent(
    parqetIrrCashflowsAusBuchungen(buchungen),
    terminalValueEUR,
    asOf,
  )
}

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
