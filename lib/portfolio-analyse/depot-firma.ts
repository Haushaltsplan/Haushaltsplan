/**
 * Aktien-Depot als eine synthetische Firma (Look-through).
 * ETFs/Anleihen/Crypto gehören nicht hierher — nur assetKlasse aktie.
 */

import { cagr3AusSerie, cagrProzent, formatFundamentalWert, werteOhneNiveauSprung } from '@/lib/portfolio-analyse/fundamentaldaten-format'
import { historischeWerteAusZeile, letzterVerfuegbarerWert } from '@/lib/portfolio-analyse/fundamentaldaten-roic-hilfen'
import type { FxKurse } from '@/lib/portfolio-analyse/kurs-aufloesung'
import type { FundamentaldatenPaket } from '@/lib/portfolio-analyse/fundamentaldaten-types'

export type DepotFirmaModus = 'depotgewicht' | 'gleichgewicht'

export type DepotFirmaPosition = {
  isin: string
  name: string
  stueck: number
  wertEur: number
}

export type DepotFirmaKennzahl = {
  id: string
  label: string
  wertText: string
  /** Wie viel Depotgewicht in die Zahl eingeflossen ist. */
  abdeckungPct: number
  n: number
}

export type DepotFirmaSektion = {
  id: string
  titel: string
  kennzahlen: DepotFirmaKennzahl[]
}

export type DepotFirmaModell = {
  modus: DepotFirmaModus
  aktienAnzahl: number
  mitLookthrough: number
  depotwertEur: number
  abdeckungPct: number
  sektionen: DepotFirmaSektion[]
  groesste: Array<{ name: string; isin: string; anteilPct: number }>
}

export type DepotFirmaAntwort = {
  ok: true
  eurUsd: number
  depotgewicht: DepotFirmaModell
  gleichgewicht: DepotFirmaModell
  fehlend: Array<{ isin: string; name: string }>
}

const MIN_ABDECKUNG = 0.45

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

function zeile(paket: FundamentaldatenPaket, id: string) {
  return paket.zeilen.find((z) => z.id === id)
}

function snapshotMio(paket: FundamentaldatenPaket, id: string): number | null {
  return letzterVerfuegbarerWert(zeile(paket, id), paket.perioden)
}

function parseDeZahl(raw: string | null | undefined): number | null {
  if (raw == null) return null
  const t = raw.trim()
  if (!t || t === '–' || t === '-') return null
  const negativ = /^\(.*\)$/.test(t)
  let s = t.replace(/[()]/g, '').replace(/\s/g, '')
  let faktor = 1
  if (/\bBio\./i.test(s)) faktor = 1e12
  else if (/\bMrd\./i.test(s)) faktor = 1e9
  else if (/\bMio\./i.test(s)) faktor = 1e6
  s = s.replace(/Bio\.|Mrd\.|Mio\.|Stück|Stk\.?|x|×|%|\$|€/gi, '').replace(/\./g, '').replace(',', '.')
  const v = Number.parseFloat(s)
  if (!Number.isFinite(v)) return null
  return (negativ ? -Math.abs(v) : v) * faktor
}

function listingWaehrung(paket: FundamentaldatenPaket): string {
  const kurs = paket.keyMetrics.find((m) => m.id === 'kurs_aktuell')?.wert ?? ''
  if (kurs.includes('€')) return 'EUR'
  if (kurs.includes('£')) return 'GBP'
  if (/\bCHF\b/.test(kurs)) return 'CHF'
  return 'USD'
}

/** GuV-Währung: Paket-Feld, sonst EU-Quelle + ISIN-Präfix (LVMH steht oft fälschlich auf USD). */
function reportingWaehrung(paket: FundamentaldatenPaket, isin: string): string {
  const w = (paket.waehrung ?? 'USD').trim().toUpperCase()
  if (w && w !== 'USD') return w
  const euSrc = paket.guvQuelle === 'eu' || paket.guvQuelle === 'yahoo'
  if (!euSrc) return 'USD'
  const iso = isin.slice(0, 2).toUpperCase()
  if (iso === 'CH') return 'CHF'
  if (iso === 'GB') return 'GBP'
  if (['FR', 'NL', 'DE', 'BE', 'AT', 'IT', 'ES', 'PT', 'FI', 'LU'].includes(iso)) return 'EUR'
  return 'USD'
}

function nachUsd(betrag: number, von: string, fx: FxKurse): number {
  const w = von.trim().toUpperCase()
  if (w === 'EUR') return betrag * fx.eurUsd
  if (w === 'GBP') return betrag * (fx.eurUsd / fx.eurGbp)
  if (w === 'CHF') return betrag * (fx.eurUsd / fx.eurChf)
  if (w === 'CAD') return betrag * (fx.eurUsd / fx.eurCad)
  return betrag
}

function marketCapUsd(paket: FundamentaldatenPaket, fx: FxKurse): number | null {
  const meta = paket.mantraMeta?.marketCapUsd
  let raw = meta != null && meta > 0 ? meta : null
  if (raw == null) {
    const km = paket.keyMetrics.find((m) => m.id === 'market_cap')
    if (km?.zahl != null && km.zahl > 0) raw = km.zahl
    else {
      const parsed = parseDeZahl(km?.wert)
      raw = parsed != null && parsed > 0 ? parsed : null
    }
  }
  if (raw == null || raw <= 0) {
    const preis = parseDeZahl(paket.keyMetrics.find((m) => m.id === 'kurs_aktuell')?.wert)
    const so = sharesOut(paket)
    if (preis != null && preis > 0 && so != null && so > 0) raw = preis * so
  }
  if (raw == null || raw <= 0) return null
  return nachUsd(raw, listingWaehrung(paket), fx)
}

/** Dieselbe ROIC-%-Quelle wie die Aktien-Übersicht (Zeile `roi` / Key Metric `ltm_roic`). */
function roicPctAusPaket(paket: FundamentaldatenPaket): number | null {
  for (const id of ['roi', 'roi_ex_goodwill'] as const) {
    const v = snapshotMio(paket, id)
    if (v != null && Number.isFinite(v) && Math.abs(v) < 400) return v
  }
  for (const id of ['ltm_roic', 'ltm_roic_ex_gw'] as const) {
    const km = paket.keyMetrics.find((m) => m.id === id)
    if (km?.zahl != null && Number.isFinite(km.zahl) && Math.abs(km.zahl) < 400) return km.zahl
    const parsed = parseDeZahl(km?.wert)
    if (parsed != null && Math.abs(parsed) < 400) return parsed
  }
  return null
}

function sharesOut(paket: FundamentaldatenPaket): number | null {
  const mio = snapshotMio(paket, 'aktien')
  if (mio != null && mio > 0) return mio * 1_000_000
  const km = paket.keyMetrics.find((m) => m.id === 'shares_out')
  const parsed = parseDeZahl(km?.wert)
  return parsed != null && parsed > 0 ? parsed : null
}

type Lookthrough = {
  umsatz: number
  gewinn: number
  ebit: number
  ebitda: number
  fcf: number
  div: number
  nd: number
  ek: number
  wUmsatz: number
  wGewinn: number
  wEbit: number
  wEbitda: number
  wFcf: number
  wDiv: number
  wNd: number
  wEk: number
  nUmsatz: number
  nGewinn: number
  nEbit: number
  nEbitda: number
  nFcf: number
  nDiv: number
  nNd: number
  nEk: number
}

function leerLt(): Lookthrough {
  return {
    umsatz: 0,
    gewinn: 0,
    ebit: 0,
    ebitda: 0,
    fcf: 0,
    div: 0,
    nd: 0,
    ek: 0,
    wUmsatz: 0,
    wGewinn: 0,
    wEbit: 0,
    wEbitda: 0,
    wFcf: 0,
    wDiv: 0,
    wNd: 0,
    wEk: 0,
    nUmsatz: 0,
    nGewinn: 0,
    nEbit: 0,
    nEbitda: 0,
    nFcf: 0,
    nDiv: 0,
    nNd: 0,
    nEk: 0,
  }
}

function kz(
  id: string,
  label: string,
  wertText: string,
  abdeckung: number,
  n: number,
): DepotFirmaKennzahl {
  return { id, label, wertText, abdeckungPct: round1(abdeckung * 100), n }
}

function pctText(v: number | null, mitVorzeichen = false): string {
  if (v == null || !Number.isFinite(v)) return '–'
  const vz = mitVorzeichen && v > 0 ? '+' : ''
  return `${vz}${v.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`
}

function multipleText(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return '–'
  return `${v.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}×`
}

type GewichtAcc = { gewichtet: number; w: number; n: number }

function leerAcc(): GewichtAcc {
  return { gewichtet: 0, w: 0, n: 0 }
}

function addMittel(acc: GewichtAcc, wert: number | null, w: number) {
  if (wert == null || !Number.isFinite(wert) || w <= 0) return
  acc.gewichtet += wert * w
  acc.w += w
  acc.n += 1
}

function mittel(acc: GewichtAcc): number | null {
  if (acc.n === 0 || acc.w < MIN_ABDECKUNG) return null
  return acc.gewichtet / acc.w
}

function kmZahl(paket: FundamentaldatenPaket, id: string): number | null {
  const km = paket.keyMetrics.find((m) => m.id === id)
  if (!km) return null
  if (km.zahl != null && Number.isFinite(km.zahl)) return km.zahl
  const t = km.wert?.trim()
  if (!t || t === '–' || t === '-' || t === 'NM') return null
  return parseDeZahl(t)
}

function kgvAusPaket(paket: FundamentaldatenPaket): number | null {
  const v = kmZahl(paket, 'ltm_pe')
  return v != null && v > 0 ? v : null
}

function kcvAusPaket(paket: FundamentaldatenPaket): number | null {
  const v = kmZahl(paket, 'ltm_pfcf')
  return v != null && v > 0 ? v : null
}

function kuvAusPaket(paket: FundamentaldatenPaket): number | null {
  const v = kmZahl(paket, 'ltm_ps')
  return v != null && v > 0 ? v : null
}

function fcfMargeAusPaket(paket: FundamentaldatenPaket): number | null {
  const z = snapshotMio(paket, 'fcf_marge')
  if (z != null && Number.isFinite(z)) return z
  const fcf = snapshotMio(paket, 'fcf')
  const umsatz = snapshotMio(paket, 'umsatz')
  if (fcf == null || umsatz == null || umsatz <= 0) return null
  return (fcf / umsatz) * 100
}

function nettoMargeAusPaket(paket: FundamentaldatenPaket): number | null {
  const z = snapshotMio(paket, 'nettomarge')
  if (z != null && Number.isFinite(z)) return z
  const ni = snapshotMio(paket, 'nettogewinn')
  const umsatz = snapshotMio(paket, 'umsatz')
  if (ni == null || umsatz == null || umsatz <= 0) return null
  return (ni / umsatz) * 100
}

/** Trailing-Yield; >12 % ist fast immer Payout/KGV-Einheitenfehler (z. B. USU 163 %). */
function divYieldAusPaket(paket: FundamentaldatenPaket): number | null {
  const v = kmZahl(paket, 'div_yield')
  if (v == null || v < 0) return null
  const pct = v > 0 && v < 0.2 ? v * 100 : v
  if (pct > 12) return null
  return pct
}

/** 3J wie Key Metric; 5J/10J nur mit voller Spanne, gleiche Serie wie die Einzelaktie. */
function cagrAusPaket(
  paket: FundamentaldatenPaket,
  zeileId: string,
  jahre: number,
  kmId?: string,
): number | null {
  if (jahre === 3 && kmId) {
    const fromKm = kmZahl(paket, kmId)
    if (fromKm != null) return fromKm
  }
  const hist = historischeWerteAusZeile(zeile(paket, zeileId), paket.perioden)
  if (jahre <= 3) return cagr3AusSerie(hist)
  const slice = werteOhneNiveauSprung(hist).slice(-(jahre + 1))
  if (slice.length < jahre + 1) return null
  return cagrProzent(slice, jahre)
}

export function baueDepotFirmaModell(opts: {
  modus: DepotFirmaModus
  positionen: DepotFirmaPosition[]
  pakete: Map<string, FundamentaldatenPaket>
  fx: FxKurse
}): DepotFirmaModell {
  const aktien = opts.positionen.filter((p) => p.wertEur > 0 && p.stueck > 0)
  const depotwertEur = aktien.reduce((s, p) => s + p.wertEur, 0)
  const n = aktien.length
  const fx = opts.fx
  const eurUsd = fx.eurUsd > 0 ? fx.eurUsd : 1.08
  const depotUsd = depotwertEur * eurUsd
  const lt = leerLt()
  let lookthroughGewicht = 0
  let mitLookthrough = 0
  const peAcc = leerAcc()
  const kcvAcc = leerAcc()
  const kuvAcc = leerAcc()
  const ebitMAcc = leerAcc()
  const nettoMAcc = leerAcc()
  const fcfMAcc = leerAcc()
  const roicAcc = leerAcc()
  const ndEbitdaAcc = leerAcc()
  const divYieldAcc = leerAcc()
  const umsatzCagr3Acc = leerAcc()
  const umsatzCagr5Acc = leerAcc()
  const umsatzCagr10Acc = leerAcc()
  const epsCagr3Acc = leerAcc()
  const epsCagr5Acc = leerAcc()
  const epsCagr10Acc = leerAcc()
  let indicatedDivMio = 0

  for (const p of aktien) {
    const paket = opts.pakete.get(p.isin.toUpperCase())
    const w = opts.modus === 'gleichgewicht' ? (n > 0 ? 1 / n : 0) : depotwertEur > 0 ? p.wertEur / depotwertEur : 0
    if (!paket?.ok || w <= 0) continue

    const positionUsd = opts.modus === 'gleichgewicht' ? depotUsd / n : p.wertEur * eurUsd
    const divY = divYieldAusPaket(paket)
    addMittel(umsatzCagr3Acc, cagrAusPaket(paket, 'umsatz', 3, 'rev_cagr_3y'), w)
    addMittel(umsatzCagr5Acc, cagrAusPaket(paket, 'umsatz', 5), w)
    addMittel(umsatzCagr10Acc, cagrAusPaket(paket, 'umsatz', 10), w)
    addMittel(epsCagr3Acc, cagrAusPaket(paket, 'eps', 3, 'eps_cagr_3y'), w)
    addMittel(epsCagr5Acc, cagrAusPaket(paket, 'eps', 5), w)
    addMittel(epsCagr10Acc, cagrAusPaket(paket, 'eps', 10), w)
    addMittel(peAcc, kgvAusPaket(paket), w)
    addMittel(kcvAcc, kcvAusPaket(paket), w)
    addMittel(kuvAcc, kuvAusPaket(paket), w)
    addMittel(ebitMAcc, kmZahl(paket, 'ltm_ebit') ?? snapshotMio(paket, 'ebit_marge'), w)
    addMittel(nettoMAcc, nettoMargeAusPaket(paket), w)
    addMittel(fcfMAcc, fcfMargeAusPaket(paket), w)
    addMittel(roicAcc, kmZahl(paket, 'ltm_roic') ?? roicPctAusPaket(paket), w)
    addMittel(ndEbitdaAcc, kmZahl(paket, 'net_debt_ebitda'), w)
    addMittel(divYieldAcc, divY, w)
    if (divY != null && divY > 0) indicatedDivMio += (positionUsd * divY) / 100 / 1_000_000

    const mcap = marketCapUsd(paket, fx)
    // Marktkapitalisierung (Listing-Währung → USD) ist robuster als Stückzahl:
    // Dual-Class, EUR-Titel und Macrotrends-Aktienzahl weichen oft um den Faktor 10 ab.
    let ownership: number | null = null
    if (mcap != null && mcap > 0) ownership = positionUsd / mcap
    if (ownership == null || !(ownership > 0) || ownership > 1.5) {
      const so = sharesOut(paket)
      ownership = so != null && so > 0 && opts.modus === 'depotgewicht' ? p.stueck / so : null
    }
    if (ownership == null || !(ownership > 0) || ownership > 1.5) continue

    mitLookthrough += 1
    lookthroughGewicht += w
    const repW = reportingWaehrung(paket, p.isin)

    const add = (
      id: string,
      target: keyof Pick<Lookthrough, 'umsatz' | 'gewinn' | 'ebit' | 'ebitda' | 'fcf' | 'div' | 'nd' | 'ek'>,
    ) => {
      let v = snapshotMio(paket, id)
      if (v == null || !Number.isFinite(v)) return false
      if (target === 'div') v = Math.abs(v)
      lt[target] += ownership! * nachUsd(v, repW, fx)
      return true
    }

    if (add('umsatz', 'umsatz')) {
      lt.wUmsatz += w
      lt.nUmsatz += 1
    }
    if (add('nettogewinn', 'gewinn')) {
      lt.wGewinn += w
      lt.nGewinn += 1
    }
    if (add('ebit', 'ebit')) {
      lt.wEbit += w
      lt.nEbit += 1
    }
    if (add('ebitda', 'ebitda')) {
      lt.wEbitda += w
      lt.nEbitda += 1
    }
    if (add('fcf', 'fcf')) {
      lt.wFcf += w
      lt.nFcf += 1
    }
    if (add('dividenden_gezahlt', 'div')) {
      lt.wDiv += w
      lt.nDiv += 1
    }
    if (add('nettoverschuldung', 'nd')) {
      lt.wNd += w
      lt.nNd += 1
    }
    if (add('eigenkapital', 'ek')) {
      lt.wEk += w
      lt.nEk += 1
    }
  }

  const kcvMittel = mittel(kcvAcc)
  const groesste = [...aktien]
    .map((p) => ({
      name: p.name,
      isin: p.isin,
      anteilPct: round1(opts.modus === 'gleichgewicht' ? (n > 0 ? 100 / n : 0) : depotwertEur > 0 ? (p.wertEur / depotwertEur) * 100 : 0),
    }))
    .sort((a, b) => b.anteilPct - a.anteilPct)
    .slice(0, 8)

  const sektionen: DepotFirmaSektion[] = [
    {
      id: 'groesse',
      titel: 'Diese Firma (dein Aktienbuch)',
      kennzahlen: [
        kz('depotwert', 'Marktwert', `${depotwertEur.toLocaleString('de-DE', { maximumFractionDigits: 0 })} €`, 1, n),
        kz(
          'umsatz',
          'Umsatz (Anteil)',
          formatFundamentalWert(lt.wUmsatz >= MIN_ABDECKUNG ? lt.umsatz : null, 'waehrung_usd_mio'),
          lt.wUmsatz,
          lt.nUmsatz,
        ),
        kz(
          'gewinn',
          'Nettogewinn (Anteil)',
          formatFundamentalWert(lt.wGewinn >= MIN_ABDECKUNG ? lt.gewinn : null, 'waehrung_usd_mio'),
          lt.wGewinn,
          lt.nGewinn,
        ),
        kz(
          'fcf',
          'FCF (Anteil)',
          formatFundamentalWert(lt.wFcf >= MIN_ABDECKUNG ? lt.fcf : null, 'waehrung_usd_mio'),
          lt.wFcf,
          lt.nFcf,
        ),
      ],
    },
    {
      id: 'bewertung',
      titel: 'Bewertung (Mittel der Aktien)',
      kennzahlen: [
        kz('pe', 'KGV', multipleText(mittel(peAcc)), peAcc.w, peAcc.n),
        kz('pfcf', 'KCV (Kurs/FCF)', multipleText(kcvMittel), kcvAcc.w, kcvAcc.n),
        kz('ps', 'KUV', multipleText(mittel(kuvAcc)), kuvAcc.w, kuvAcc.n),
        kz('fcf_yield', 'FCF-Rendite', pctText(kcvMittel != null && kcvMittel > 0 ? 100 / kcvMittel : null), kcvAcc.w, kcvAcc.n),
      ],
    },
    {
      id: 'wachstum',
      titel: 'Wachstum (Mittel der Aktien)',
      kennzahlen: [
        kz('u3', 'Umsatz-CAGR 3J', pctText(mittel(umsatzCagr3Acc), true), umsatzCagr3Acc.w, umsatzCagr3Acc.n),
        kz('u5', 'Umsatz-CAGR 5J', pctText(mittel(umsatzCagr5Acc), true), umsatzCagr5Acc.w, umsatzCagr5Acc.n),
        kz('u10', 'Umsatz-CAGR 10J', pctText(mittel(umsatzCagr10Acc), true), umsatzCagr10Acc.w, umsatzCagr10Acc.n),
        kz('e3', 'EPS-CAGR 3J', pctText(mittel(epsCagr3Acc), true), epsCagr3Acc.w, epsCagr3Acc.n),
        kz('e5', 'EPS-CAGR 5J', pctText(mittel(epsCagr5Acc), true), epsCagr5Acc.w, epsCagr5Acc.n),
        kz('e10', 'EPS-CAGR 10J', pctText(mittel(epsCagr10Acc), true), epsCagr10Acc.w, epsCagr10Acc.n),
      ],
    },
    {
      id: 'qualitaet',
      titel: 'Rentabilität (Mittel der Aktien)',
      kennzahlen: [
        kz('ebit_m', 'EBIT-Marge', pctText(mittel(ebitMAcc)), ebitMAcc.w, ebitMAcc.n),
        kz('netto_m', 'Nettomarge', pctText(mittel(nettoMAcc)), nettoMAcc.w, nettoMAcc.n),
        kz('fcf_m', 'FCF-Marge', pctText(mittel(fcfMAcc)), fcfMAcc.w, fcfMAcc.n),
        kz('roic', 'ROIC', pctText(mittel(roicAcc)), roicAcc.w, roicAcc.n),
      ],
    },
    {
      id: 'bilanz',
      titel: 'Bilanz',
      kennzahlen: [
        kz(
          'nd',
          'Nettoverschuldung (Anteil)',
          formatFundamentalWert(lt.wNd >= MIN_ABDECKUNG ? lt.nd : null, 'waehrung_usd_mio'),
          lt.wNd,
          lt.nNd,
        ),
        kz('nd_ebitda', 'Net Debt / EBITDA', multipleText(mittel(ndEbitdaAcc)), ndEbitdaAcc.w, ndEbitdaAcc.n),
      ],
    },
    {
      id: 'div',
      titel: 'Dividende',
      kennzahlen: [
        kz('div_yield', 'Dividendenrendite', pctText(mittel(divYieldAcc)), divYieldAcc.w, divYieldAcc.n),
        kz(
          'div_abs',
          'Dividenden (Anteil)',
          formatFundamentalWert(indicatedDivMio > 0 ? indicatedDivMio : 0, 'waehrung_usd_mio'),
          divYieldAcc.w,
          divYieldAcc.n,
        ),
      ],
    },
  ]

  return {
    modus: opts.modus,
    aktienAnzahl: n,
    mitLookthrough,
    depotwertEur,
    abdeckungPct: round1(lookthroughGewicht * 100),
    sektionen,
    groesste,
  }
}
