/**
 * Historische Bewertungs-Multiples, wenn Macrotrends-Kurscharts leer sind.
 *
 * Typisch EU/CH/UK: GuV, Bilanz und Dividende stehen, KGV/KUV/KBV/Kurs-FCF und
 * historische EV-Multiples aber nicht — Macrotrends liefert dort 0 bzw. keine
 * price-ratio-Charts. Forward-Spalten (Kurs ÷ Schätzung) waren schon da, weil sie
 * den aktuellen Kurs nutzen.
 *
 * Rechnung: heutige Marktkap skaliert mit Kurs- und Aktienzahl-Veränderung.
 * So fallen ADR-Ratio und Listungswährung aus dem Quotienten; der Nenner kommt
 * aus denselben GuV-/Bilanzzeilen wie der Rest der Tabelle.
 */
import 'server-only'

import { ergaenzeEvMultiplesZeilen } from '@/lib/portfolio-analyse/fundamentaldaten-ev-multiples-zeilen'
import type { YahooFundamentalKennzahlen } from '@/lib/portfolio-analyse/fundamentaldaten-key-metrics'
import {
  FUNDAMENTAL_TTM_KEY,
  type FundamentalMetrikZeile,
  type FundamentalPeriode,
} from '@/lib/portfolio-analyse/fundamentaldaten-types'
import { wertAusMapFuerIso } from '@/lib/portfolio-analyse/fundamentaldaten-wert-fuer-iso'
import {
  kursNaheDatum,
  ladeYahooMonatsRohkurse,
  type YahooKursPunkt,
} from '@/lib/portfolio-analyse/yahoo-historie-server'
import { yahooKennzahlenSymbolKandidaten } from '@/lib/portfolio-analyse/yahoo-kennzahlen-fallback-server'

function wert(zeilen: FundamentalMetrikZeile[], id: string, key: string): number | null {
  return wertAusMapFuerIso(zeilen.find((z) => z.id === id)?.werte, key)
}

function safeDiv(a: number | null, b: number | null): number | null {
  if (a == null || b == null || !(b > 0)) return null
  const r = a / b
  return Number.isFinite(r) && r > 0 ? r : null
}

function histKeys(perioden: FundamentalPeriode[]): string[] {
  return perioden
    .filter((p) => !p.istLtm && !p.istNtm && !p.istSchaetzung && /^\d{4}-\d{2}-\d{2}$/.test(p.iso))
    .map((p) => p.iso)
}

function zaehleGefuellt(zeilen: FundamentalMetrikZeile[], id: string, keys: string[]): number {
  const z = zeilen.find((r) => r.id === id)
  if (!z) return 0
  return keys.filter((k) => {
    const v = z.werte[k]
    return v != null && Number.isFinite(v) && v > 0
  }).length
}

function brauchtAuffuellung(zeilen: FundamentalMetrikZeile[], keys: string[]): boolean {
  if (keys.length === 0) return false
  const ids = ['kgv', 'ps', 'pb', 'pfcf', 'marktkapitalisierung', 'ev_rev', 'ev_ebitda'] as const
  return ids.some((id) => zaehleGefuellt(zeilen, id, keys) < Math.min(3, keys.length))
}

function upsertZeile(
  zeilen: FundamentalMetrikZeile[],
  id: string,
  label: string,
  gruppe: FundamentalMetrikZeile['gruppe'],
  einheit: FundamentalMetrikZeile['einheit'],
  patch: Record<string, number | null>,
): void {
  let z = zeilen.find((r) => r.id === id)
  if (!z) {
    z = { id, label, gruppe, einheit, werte: { ...patch } }
    zeilen.push(z)
    return
  }
  for (const [k, v] of Object.entries(patch)) {
    if (v == null) {
      if (!(k in z.werte)) z.werte[k] = null
      continue
    }
    const alt = z.werte[k]
    if (alt == null || !Number.isFinite(alt) || alt <= 0) z.werte[k] = v
  }
}

function sharesMio(
  zeilen: FundamentalMetrikZeile[],
  key: string,
  yahoo: YahooFundamentalKennzahlen | null,
): number | null {
  const direkt = wert(zeilen, 'aktien', key)
  if (direkt != null && direkt > 0) return direkt
  const ni = wert(zeilen, 'nettogewinn', key)
  const eps = wert(zeilen, 'eps', key)
  if (ni != null && eps != null && Math.abs(eps) > 0.001) {
    const s = ni / eps
    if (Number.isFinite(s) && s > 0) return s
  }
  if (key === FUNDAMENTAL_TTM_KEY && yahoo?.sharesOutstanding != null && yahoo.sharesOutstanding > 0) {
    return yahoo.sharesOutstanding / 1_000_000
  }
  return null
}

function marktkapDannMio(
  mcJetztMio: number,
  kursJetzt: number,
  kursDann: number,
  sharesJetzt: number | null,
  sharesDann: number | null,
): number {
  let mc = mcJetztMio * (kursDann / kursJetzt)
  if (sharesJetzt != null && sharesJetzt > 0 && sharesDann != null && sharesDann > 0) {
    mc *= sharesDann / sharesJetzt
  }
  return mc
}

async function ladeErsteKursreihe(symbole: string[], von: string, bis: string): Promise<{
  symbol: string
  serie: YahooKursPunkt[]
} | null> {
  for (const sym of symbole) {
    const serie = await ladeYahooMonatsRohkurse(sym, von, bis)
    if (serie.length >= 4) return { symbol: sym, serie }
  }
  return null
}

export async function ergaenzeHistorischeMultiplesZeilen(opts: {
  perioden: FundamentalPeriode[]
  zeilen: FundamentalMetrikZeile[]
  yahoo: YahooFundamentalKennzahlen | null
  symbolYahoo?: string | null
  isin?: string | null
  ticker?: string | null
}): Promise<void> {
  const { perioden, zeilen, yahoo } = opts
  const keys = histKeys(perioden)
  if (keys.length === 0) return
  if (!brauchtAuffuellung(zeilen, keys) && wert(zeilen, 'kgv', FUNDAMENTAL_TTM_KEY) != null) {
    return
  }

  const letztesKey = keys[keys.length - 1]!
  const sharesJetzt =
    sharesMio(zeilen, FUNDAMENTAL_TTM_KEY, yahoo) ?? sharesMio(zeilen, letztesKey, yahoo)
  const kursJetzt =
    yahoo?.currentPrice != null && yahoo.currentPrice > 0 ? yahoo.currentPrice : null
  const mcJetztMio =
    yahoo?.marketCap != null && yahoo.marketCap > 0
      ? yahoo.marketCap / 1_000_000
      : kursJetzt != null && sharesJetzt != null
        ? kursJetzt * sharesJetzt
        : null

  const ttmRev =
    wert(zeilen, 'umsatz', FUNDAMENTAL_TTM_KEY) ?? wert(zeilen, 'umsatz', letztesKey)
  const ttmFcf = wert(zeilen, 'fcf', FUNDAMENTAL_TTM_KEY) ?? wert(zeilen, 'fcf', letztesKey)
  const ttmEk =
    wert(zeilen, 'eigenkapital', FUNDAMENTAL_TTM_KEY) ?? wert(zeilen, 'eigenkapital', letztesKey)

  const ttmPatch = (id: 'kgv' | 'ps' | 'pb' | 'pfcf' | 'marktkapitalisierung') => {
    const out: Record<string, number | null> = { [FUNDAMENTAL_TTM_KEY]: null }
    if (id === 'kgv') out[FUNDAMENTAL_TTM_KEY] = yahoo?.trailingPE != null && yahoo.trailingPE > 0 ? yahoo.trailingPE : null
    if (id === 'pb') out[FUNDAMENTAL_TTM_KEY] = yahoo?.priceToBook != null && yahoo.priceToBook > 0 ? yahoo.priceToBook : null
    if (id === 'ps') out[FUNDAMENTAL_TTM_KEY] = safeDiv(mcJetztMio, ttmRev)
    if (id === 'pfcf') out[FUNDAMENTAL_TTM_KEY] = safeDiv(mcJetztMio, ttmFcf)
    if (id === 'marktkapitalisierung') out[FUNDAMENTAL_TTM_KEY] = mcJetztMio
    return out
  }

  upsertZeile(zeilen, 'kgv', 'KGV (P/E)', 'bewertung_trailing', 'multiple', ttmPatch('kgv'))
  upsertZeile(zeilen, 'ps', 'KUV (P/S)', 'bewertung_trailing', 'multiple', ttmPatch('ps'))
  upsertZeile(zeilen, 'pb', 'KBV (P/B)', 'bewertung_trailing', 'multiple', ttmPatch('pb'))
  upsertZeile(zeilen, 'pfcf', 'Kurs / FCF', 'bewertung_trailing', 'multiple', ttmPatch('pfcf'))
  if (mcJetztMio != null) {
    upsertZeile(
      zeilen,
      'marktkapitalisierung',
      'Marktkapitalisierung',
      'bilanz',
      'waehrung_usd_mio',
      ttmPatch('marktkapitalisierung'),
    )
  }

  if (mcJetztMio == null || !(mcJetztMio > 0)) {
    ergaenzeEvMultiplesZeilen(perioden, zeilen)
    return
  }

  const von = keys[0]!.slice(0, 4) + '-01-01'
  const bis = new Date().toISOString().slice(0, 10)
  const kandidaten = yahooKennzahlenSymbolKandidaten({
    symbolYahoo: opts.symbolYahoo,
    isin: opts.isin,
    macrotrendsTicker: opts.ticker,
  })
  const kurse = await ladeErsteKursreihe(kandidaten, von, bis)
  if (!kurse) {
    ergaenzeEvMultiplesZeilen(perioden, zeilen)
    return
  }

  const kursAnker =
    kursJetzt ??
    kursNaheDatum(kurse.serie, bis, 60) ??
    kurse.serie[kurse.serie.length - 1]?.kurs ??
    null
  if (kursAnker == null || !(kursAnker > 0)) {
    ergaenzeEvMultiplesZeilen(perioden, zeilen)
    return
  }

  const kgv: Record<string, number | null> = {}
  const ps: Record<string, number | null> = {}
  const pb: Record<string, number | null> = {}
  const pfcf: Record<string, number | null> = {}
  const mc: Record<string, number | null> = {}

  for (const iso of keys) {
    const kursDann = kursNaheDatum(kurse.serie, iso, 45)
    if (kursDann == null) continue
    const sharesDann = sharesMio(zeilen, iso, yahoo)
    const mcDann = marktkapDannMio(mcJetztMio, kursAnker, kursDann, sharesJetzt, sharesDann)
    if (!(mcDann > 0)) continue

    const ni = wert(zeilen, 'nettogewinn', iso)
    const eps = wert(zeilen, 'eps', iso)
    const rev = wert(zeilen, 'umsatz', iso)
    const ek = wert(zeilen, 'eigenkapital', iso)
    const fcf = wert(zeilen, 'fcf', iso)

    mc[iso] = Math.round(mcDann * 10) / 10
    kgv[iso] = safeDiv(mcDann, ni) ?? (eps != null && eps > 0 ? safeDiv(kursDann, eps) : null)
    ps[iso] = safeDiv(mcDann, rev)
    pb[iso] = safeDiv(mcDann, ek)
    pfcf[iso] = safeDiv(mcDann, fcf)
  }

  upsertZeile(zeilen, 'kgv', 'KGV (P/E)', 'bewertung_trailing', 'multiple', kgv)
  upsertZeile(zeilen, 'ps', 'KUV (P/S)', 'bewertung_trailing', 'multiple', ps)
  upsertZeile(zeilen, 'pb', 'KBV (P/B)', 'bewertung_trailing', 'multiple', pb)
  upsertZeile(zeilen, 'pfcf', 'Kurs / FCF', 'bewertung_trailing', 'multiple', pfcf)
  upsertZeile(zeilen, 'marktkapitalisierung', 'Marktkapitalisierung', 'bilanz', 'waehrung_usd_mio', mc)

  if (wert(zeilen, 'pb', FUNDAMENTAL_TTM_KEY) == null && ttmEk != null) {
    upsertZeile(zeilen, 'pb', 'KBV (P/B)', 'bewertung_trailing', 'multiple', {
      [FUNDAMENTAL_TTM_KEY]: safeDiv(mcJetztMio, ttmEk),
    })
  }

  ergaenzeEvMultiplesZeilen(perioden, zeilen)
}
