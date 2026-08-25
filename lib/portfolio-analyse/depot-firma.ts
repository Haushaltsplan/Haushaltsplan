/**
 * Aktien-Depot als eine synthetische Firma (Look-through).
 * ETFs/Anleihen/Crypto gehören nicht hierher — nur assetKlasse aktie.
 */

import { cagrProzent, formatFundamentalWert } from '@/lib/portfolio-analyse/fundamentaldaten-format'
import { letzterVerfuegbarerWert } from '@/lib/portfolio-analyse/fundamentaldaten-roic-hilfen'
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

const STEUER = 0.21
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

function sharesOut(paket: FundamentaldatenPaket): number | null {
  const mio = snapshotMio(paket, 'aktien')
  if (mio != null && mio > 0) return mio * 1_000_000
  const km = paket.keyMetrics.find((m) => m.id === 'shares_out')
  const parsed = parseDeZahl(km?.wert)
  return parsed != null && parsed > 0 ? parsed : null
}

function jahrVonIso(iso: string): number | null {
  const y = Number(iso.slice(0, 4))
  return Number.isFinite(y) && y >= 1990 && y <= 2100 ? y : null
}

type HistPunkt = { umsatz: number | null; gewinn: number | null; fcf: number | null }

function historieNachJahr(paket: FundamentaldatenPaket): Map<number, HistPunkt> {
  const map = new Map<number, HistPunkt>()
  const perioden = paket.perioden.filter((p) => !p.istLtm && !p.istNtm && !p.istSchaetzung && !p.iso.startsWith('__'))
  const u = zeile(paket, 'umsatz')
  const ni = zeile(paket, 'nettogewinn')
  const fcf = zeile(paket, 'fcf')
  for (const p of perioden) {
    const jahr = jahrVonIso(p.iso)
    if (jahr == null) continue
    const punkt: HistPunkt = {
      umsatz: u?.werte[p.iso] ?? null,
      gewinn: ni?.werte[p.iso] ?? null,
      fcf: fcf?.werte[p.iso] ?? null,
    }
    const prev = map.get(jahr)
    if (!prev) {
      map.set(jahr, punkt)
      continue
    }
    // Späteres GJ-Ende im selben Kalenderjahr gewinnt.
    map.set(jahr, punkt)
  }
  return map
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
  histUmsatz: Map<number, { sum: number; w: number }>
  histGewinn: Map<number, { sum: number; w: number }>
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
    histUmsatz: new Map(),
    histGewinn: new Map(),
  }
}

function addHist(map: Map<number, { sum: number; w: number }>, jahr: number, add: number, w: number) {
  const cur = map.get(jahr) ?? { sum: 0, w: 0 }
  cur.sum += add
  cur.w += w
  map.set(jahr, cur)
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

function cagrAusLookthrough(hist: Map<number, { sum: number; w: number }>, jahre: number): number | null {
  const rows = [...hist.entries()]
    .filter(([, v]) => v.w >= MIN_ABDECKUNG && v.sum > 0)
    .sort((a, b) => a[0] - b[0])
  if (rows.length < 2) return null
  const last = rows[rows.length - 1]!
  const targetJahr = last[0] - jahre
  let start: (typeof rows)[number] | null = null
  let best = Infinity
  for (const r of rows) {
    const d = Math.abs(r[0] - targetJahr)
    if (d < best || (d === best && start != null && r[0] < start[0])) {
      best = d
      start = r
    }
  }
  if (!start || start[0] >= last[0] || best > 1) return null
  return cagrProzent([start[1].sum, last[1].sum], last[0] - start[0])
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

  for (const p of aktien) {
    const paket = opts.pakete.get(p.isin.toUpperCase())
    const w = opts.modus === 'gleichgewicht' ? (n > 0 ? 1 / n : 0) : depotwertEur > 0 ? p.wertEur / depotwertEur : 0
    if (!paket?.ok || w <= 0) continue

    const positionUsd = opts.modus === 'gleichgewicht' ? depotUsd / n : p.wertEur * eurUsd
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

    const hist = historieNachJahr(paket)
    for (const [jahr, punkt] of hist) {
      if (punkt.umsatz != null && punkt.umsatz > 0) {
        addHist(lt.histUmsatz, jahr, ownership * nachUsd(punkt.umsatz, repW, fx), w)
      }
      if (punkt.gewinn != null) {
        addHist(lt.histGewinn, jahr, ownership * nachUsd(punkt.gewinn, repW, fx), w)
      }
    }
  }

  const umsatzUsd = lt.umsatz * 1_000_000
  const gewinnUsd = lt.gewinn * 1_000_000
  const fcfUsd = lt.fcf * 1_000_000
  const divUsd = lt.div * 1_000_000
  const ebitUsd = lt.ebit * 1_000_000

  const pe =
    gewinnUsd > 0 && lt.wGewinn > 0 ? (depotUsd * lt.wGewinn) / gewinnUsd : null
  const pfcf = fcfUsd > 0 && lt.wFcf > 0 ? (depotUsd * lt.wFcf) / fcfUsd : null
  const ps = umsatzUsd > 0 && lt.wUmsatz > 0 ? (depotUsd * lt.wUmsatz) / umsatzUsd : null
  const ebitMarge = umsatzUsd > 0 ? (ebitUsd / umsatzUsd) * 100 : null
  const nettoMarge = umsatzUsd > 0 ? (gewinnUsd / umsatzUsd) * 100 : null
  const fcfMarge = umsatzUsd > 0 ? (fcfUsd / umsatzUsd) * 100 : null
  const divYield = depotUsd > 0 && lt.wDiv > 0 ? (divUsd / (depotUsd * lt.wDiv)) * 100 : lt.nDiv === 0 ? 0 : null
  const fcfYield = depotUsd > 0 && lt.wFcf > 0 ? (fcfUsd / (depotUsd * lt.wFcf)) * 100 : null
  const ndEbitda = lt.wEbitda >= MIN_ABDECKUNG && lt.ebitda !== 0 ? lt.nd / lt.ebitda : null
  const ic = lt.ek + lt.nd
  const nopat = lt.ebit * (1 - STEUER)
  const roic = ic > 0 && lt.wEk >= MIN_ABDECKUNG ? (nopat / ic) * 100 : null

  const umsatzCagr3 = cagrAusLookthrough(lt.histUmsatz, 3)
  const umsatzCagr5 = cagrAusLookthrough(lt.histUmsatz, 5)
  const umsatzCagr10 = cagrAusLookthrough(lt.histUmsatz, 10)
  const gewinnCagr3 = cagrAusLookthrough(lt.histGewinn, 3)
  const gewinnCagr5 = cagrAusLookthrough(lt.histGewinn, 5)

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
      titel: 'Bewertung',
      kennzahlen: [
        kz('pe', 'KGV', gewinnUsd > 0 ? multipleText(pe) : 'NM', lt.wGewinn, lt.nGewinn),
        kz('pfcf', 'KCV (Kurs/FCF)', fcfUsd > 0 ? multipleText(pfcf) : 'NM', lt.wFcf, lt.nFcf),
        kz('ps', 'KUV', umsatzUsd > 0 ? multipleText(ps) : '–', lt.wUmsatz, lt.nUmsatz),
        kz('fcf_yield', 'FCF-Rendite', pctText(fcfYield), lt.wFcf, lt.nFcf),
      ],
    },
    {
      id: 'wachstum',
      titel: 'Wachstum (aufsummierte Historie)',
      kennzahlen: [
        kz('u3', 'Umsatz-CAGR 3J', pctText(umsatzCagr3, true), lt.wUmsatz, lt.nUmsatz),
        kz('u5', 'Umsatz-CAGR 5J', pctText(umsatzCagr5, true), lt.wUmsatz, lt.nUmsatz),
        kz('u10', 'Umsatz-CAGR 10J', pctText(umsatzCagr10, true), lt.wUmsatz, lt.nUmsatz),
        kz('g3', 'Gewinn-CAGR 3J', pctText(gewinnCagr3, true), lt.wGewinn, lt.nGewinn),
        kz('g5', 'Gewinn-CAGR 5J', pctText(gewinnCagr5, true), lt.wGewinn, lt.nGewinn),
      ],
    },
    {
      id: 'qualitaet',
      titel: 'Rentabilität',
      kennzahlen: [
        kz('ebit_m', 'EBIT-Marge', pctText(ebitMarge), Math.min(lt.wEbit, lt.wUmsatz), Math.min(lt.nEbit, lt.nUmsatz)),
        kz('netto_m', 'Nettomarge', pctText(nettoMarge), Math.min(lt.wGewinn, lt.wUmsatz), Math.min(lt.nGewinn, lt.nUmsatz)),
        kz('fcf_m', 'FCF-Marge', pctText(fcfMarge), Math.min(lt.wFcf, lt.wUmsatz), Math.min(lt.nFcf, lt.nUmsatz)),
        kz('roic', 'ROIC (Look-through)', pctText(roic), Math.min(lt.wEbit, lt.wEk), Math.min(lt.nEbit, lt.nEk)),
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
        kz('nd_ebitda', 'Net Debt / EBITDA', multipleText(ndEbitda), Math.min(lt.wNd, lt.wEbitda), Math.min(lt.nNd, lt.nEbitda)),
      ],
    },
    {
      id: 'div',
      titel: 'Dividende',
      kennzahlen: [
        kz('div_yield', 'Dividendenrendite', pctText(divYield), lt.wDiv, lt.nDiv),
        kz(
          'div_abs',
          'Dividenden (Anteil)',
          formatFundamentalWert(lt.div > 0 ? lt.div : 0, 'waehrung_usd_mio'),
          lt.wDiv,
          lt.nDiv,
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
