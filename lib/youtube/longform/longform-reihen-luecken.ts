/**
 * Kalenderjahre, die in der gespeicherten JSON zwischen dem ersten und dem letzten
 * Wert fehlen, für jede Zeile nachziehen. Zuerst Yahoo, danach StockAnalysis.
 * Vorhandene Zahlen bleiben. Margen und ROIC der Lückenjahre werden daraus gerechnet.
 * Liegt nirgends eine Zahl, bleibt das Jahr leer. Nichts wird geschätzt.
 */
import type { FundamentaldatenPaket, FundamentalMetrikZeile, FundamentalPeriode } from '@/lib/portfolio-analyse/fundamentaldaten-types'
import { ergaenzeMargenZeilen } from '@/lib/portfolio-analyse/fundamentaldaten-margen-zeilen'
import { ladeYahooJahresGuV } from '@/lib/portfolio-analyse/fundamentaldaten-yahoo-guv-server'
import { ladeStockanalysisStatementsRoh } from '@/lib/portfolio-analyse/stockanalysis-statements-server'

const STEUER = 0.21
const MAX_ROIC = 80

function jahrAusIso(iso: string): number | null {
  const m = iso.match(/^(\d{4})-\d{2}-\d{2}/)
  return m ? Number(m[1]) : null
}

function jahreMitZahl(z: FundamentalMetrikZeile | undefined): number[] {
  if (!z) return []
  const jahre = new Set<number>()
  for (const [iso, wert] of Object.entries(z.werte)) {
    if (wert == null || !Number.isFinite(wert)) continue
    const jahr = jahrAusIso(iso)
    if (jahr != null) jahre.add(jahr)
  }
  return [...jahre].sort((a, b) => a - b)
}

function luecken(jahre: number[]): number[] {
  if (jahre.length < 2) return []
  const gesetzt = new Set(jahre)
  const von = jahre[0]!
  const bis = jahre[jahre.length - 1]!
  const fehlend: number[] = []
  for (let y = von; y <= bis; y++) if (!gesetzt.has(y)) fehlend.push(y)
  return fehlend
}

function wertDesJahres(z: FundamentalMetrikZeile | undefined, jahr: number): { iso: string; wert: number } | null {
  if (!z) return null
  let best: { iso: string; wert: number } | null = null
  for (const [iso, wert] of Object.entries(z.werte)) {
    if (wert == null || !Number.isFinite(wert)) continue
    if (jahrAusIso(iso) !== jahr) continue
    if (!best || iso > best.iso) best = { iso, wert }
  }
  return best
}

function naechsterWert(jahre: number[], jahr: number, z: FundamentalMetrikZeile): number | null {
  let best: number | null = null
  let dist = Infinity
  for (const y of jahre) {
    const d = Math.abs(y - jahr)
    if (d === 0 || d >= dist) continue
    const fund = wertDesJahres(z, y)
    if (!fund || fund.wert === 0) continue
    dist = d
    best = fund.wert
  }
  return best
}

/** Nur Einheiten-Fehler ablehnen (Dollar statt Millionen). Ein Verlustjahr bleibt. */
function plausibel(wert: number, referenz: number | null): boolean {
  if (referenz == null) return true
  const ratio = Math.abs(wert) / Math.abs(referenz)
  return ratio > 1 / 2000 && ratio < 2000
}

function zeile(paket: FundamentaldatenPaket, id: string): FundamentalMetrikZeile | undefined {
  return paket.zeilen.find((z) => z.id === id)
}

type Quelle = { zeilen: FundamentalMetrikZeile[]; perioden: FundamentalPeriode[] }

const ABGELEITET = new Set(['bruttomarge', 'ebit_marge', 'ebitda_marge', 'nettomarge', 'roi', 'roi_ex_goodwill', 'roe'])

function nochOffen(paket: FundamentaldatenPaket): boolean {
  return paket.zeilen.some((z) => luecken(jahreMitZahl(z)).length > 0)
}

function basisOffen(paket: FundamentaldatenPaket): boolean {
  return paket.zeilen.some((z) => !ABGELEITET.has(z.id) && luecken(jahreMitZahl(z)).length > 0)
}

function icDesJahres(paket: FundamentaldatenPaket, jahr: number): number | null {
  const ek = wertDesJahres(zeile(paket, 'eigenkapital'), jahr)
  if (!ek) return null
  const debt = wertDesJahres(zeile(paket, 'gesamtverschuldung'), jahr)
  const ic = ek.wert + (debt?.wert ?? 0)
  return ic > 0 ? ic : null
}

export async function fuelleJahresluecken(
  paket: FundamentaldatenPaket,
): Promise<{ paket: FundamentaldatenPaket; gefuellt: boolean; quelle: string | null }> {
  const symbol = paket.symbolYahoo?.trim()
  if (!symbol || !nochOffen(paket)) return { paket, gefuellt: false, quelle: null }

  const yahoo = await ladeYahooJahresGuV(symbol).catch(() => null)
  const kopie: FundamentaldatenPaket = {
    ...paket,
    perioden: paket.perioden.map((p) => ({ ...p })),
    zeilen: paket.zeilen.map((z) => ({ ...z, werte: { ...z.werte } })),
  }
  const periodenIso = new Set(kopie.perioden.map((p) => p.iso))
  let gefuellt = false
  const benutzte = new Set<string>()

  const setze = (id: string, iso: string, wert: number, periode: FundamentalPeriode | undefined) => {
    const z = zeile(kopie, id)
    if (!z) return false
    if (wertDesJahres(z, jahrAusIso(iso) ?? -1)) return false
    const alt = z.werte[iso]
    if (alt != null && Number.isFinite(alt)) return false
    z.werte[iso] = wert
    if (!periodenIso.has(iso)) {
      kopie.perioden.push(periode ?? { iso, label: String(jahrAusIso(iso) ?? iso) })
      periodenIso.add(iso)
    }
    gefuellt = true
    return true
  }

  const ausQuelle = (quelle: Quelle | null, name: string) => {
    if (!quelle) return
    for (const ziel of kopie.zeilen) {
      const fremd = quelle.zeilen.find((z) => z.id === ziel.id)
      if (!fremd) continue
      const vorhanden = jahreMitZahl(ziel)
      for (const jahr of luecken(vorhanden)) {
        const fund = wertDesJahres(fremd, jahr)
        if (!fund || !plausibel(fund.wert, naechsterWert(vorhanden, jahr, ziel))) continue
        const periode = quelle.perioden.find((p) => p.iso === fund.iso)
        if (setze(ziel.id, fund.iso, fund.wert, periode)) benutzte.add(name)
      }
    }
  }

  const ableiten = () => {
    const vorher = kopie.zeilen.reduce((n, z) => n + luecken(jahreMitZahl(z)).length, 0)
    ergaenzeMargenZeilen(kopie.perioden, kopie.zeilen)
    const roi = zeile(kopie, 'roi')
    if (roi) {
      for (const jahr of luecken(jahreMitZahl(roi))) {
        const ebit = wertDesJahres(zeile(kopie, 'ebit'), jahr)
        const ic = icDesJahres(kopie, jahr)
        if (!ebit || ic == null) continue
        const vor = icDesJahres(kopie, jahr - 1)
        const denom = vor != null ? (ic + vor) / 2 : ic
        if (!(denom > 0)) continue
        const pct = Math.round(((ebit.wert * (1 - STEUER)) / denom) * 1000) / 10
        if (!Number.isFinite(pct) || Math.abs(pct) > MAX_ROIC) continue
        if (setze('roi', ebit.iso, pct, kopie.perioden.find((p) => p.iso === ebit.iso))) benutzte.add('berechnet')
      }
    }
    const nachher = kopie.zeilen.reduce((n, z) => n + luecken(jahreMitZahl(z)).length, 0)
    if (nachher < vorher) gefuellt = true
  }

  ausQuelle(yahoo, 'Yahoo Finance')
  ableiten()

  if (basisOffen(kopie)) {
    const sa = await ladeStockanalysisStatementsRoh({
      symbolYahoo: symbol,
      ticker: paket.ticker,
      firmenname: paket.firmenname,
    }).catch(() => null)
    ausQuelle(sa, 'StockAnalysis')
    ableiten()
  }

  const quelle = benutzte.size ? [...benutzte].join(', ') : null
  return { paket: gefuellt ? kopie : paket, gefuellt, quelle }
}
