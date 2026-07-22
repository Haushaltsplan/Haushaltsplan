/**
 * Forward-Bewertung (FY-Schätzungen) — wird in die normalen Trailing-Zeilen
 * (KGV, P/S, Kurs/FCF, EV/…) geschrieben. Kein NTM.
 *
 * Forward-KGV = aktueller Kurs ÷ geschätztes EPS des jeweiligen FY.
 * EPS-Quellen (in dieser Reihenfolge): eps-Zeile, eps_schaetzung, Nettogewinn÷Aktien.
 */
import 'server-only'

import type { YahooFundamentalKennzahlen } from '@/lib/portfolio-analyse/fundamentaldaten-key-metrics'
import {
  FUNDAMENTAL_TTM_KEY,
  istFundamentalQuartalSchaetzungIso,
  type FundamentalMetrikZeile,
  type FundamentalPeriode,
} from '@/lib/portfolio-analyse/fundamentaldaten-types'

function wert(zeilen: FundamentalMetrikZeile[], id: string, key: string): number | null {
  const z = zeilen.find((r) => r.id === id)
  const v = z?.werte[key]
  return v != null && Number.isFinite(v) ? v : null
}

/** Aktueller Kurs für Forward-Multiples (Kurs ÷ EPS). */
function aktuellerKursAusQuellen(
  zeilen: FundamentalMetrikZeile[],
  yahoo: YahooFundamentalKennzahlen | null,
  sharesMio: number | null,
): number | null {
  if (yahoo?.currentPrice != null && yahoo.currentPrice > 0) return yahoo.currentPrice

  // Stabilster Fallback: TTM-KGV × TTM-EPS (beide aus derselben Tabelle)
  const ttmPe = wert(zeilen, 'kgv', FUNDAMENTAL_TTM_KEY)
  const ttmEps = wert(zeilen, 'eps', FUNDAMENTAL_TTM_KEY)
  if (ttmPe != null && ttmPe > 0 && ttmEps != null && ttmEps > 0) return ttmPe * ttmEps

  if (yahoo?.trailingPE != null && yahoo.trailingPE > 0 && yahoo.trailingEps != null && yahoo.trailingEps > 0) {
    return yahoo.trailingPE * yahoo.trailingEps
  }

  if (yahoo?.marketCap != null && yahoo.sharesOutstanding != null && yahoo.sharesOutstanding > 0) {
    return yahoo.marketCap / yahoo.sharesOutstanding
  }
  if (yahoo?.marketCap != null && sharesMio != null && sharesMio > 0) {
    return yahoo.marketCap / (sharesMio * 1_000_000)
  }
  return null
}

/** EPS für eine Spalte — inkl. Schätzungs-Zeile, falls Macrotrends keine eps-Zeile hat. */
function epsFuerSpalte(
  zeilen: FundamentalMetrikZeile[],
  key: string,
  sharesMio: number | null,
): number | null {
  const direkt = wert(zeilen, 'eps', key)
  if (direkt != null && direkt > 0) return direkt
  const schaetz = wert(zeilen, 'eps_schaetzung', key)
  if (schaetz != null && schaetz > 0) return schaetz
  const niMio = wert(zeilen, 'nettogewinn', key) ?? wert(zeilen, 'nettogewinn_schaetzung', key)
  if (niMio != null && sharesMio != null && sharesMio > 0) {
    const eps = niMio / sharesMio
    return eps > 0 ? eps : null
  }
  return null
}

function marktCapMio(
  price: number | null,
  sharesMio: number | null,
  yahoo: YahooFundamentalKennzahlen | null,
): number | null {
  if (yahoo?.marketCap != null && yahoo.marketCap > 0) return yahoo.marketCap / 1_000_000
  if (price != null && sharesMio != null && sharesMio > 0) return price * sharesMio
  return null
}

function enterpriseValueMio(
  yahoo: YahooFundamentalKennzahlen | null,
  marktCapMioVal: number | null,
): number | null {
  if (yahoo?.enterpriseValue != null && yahoo.enterpriseValue > 0) {
    return yahoo.enterpriseValue / 1_000_000
  }
  return marktCapMioVal
}

function ebitdaAusZeilen(zeilen: FundamentalMetrikZeile[], key: string): number | null {
  const ebitda = wert(zeilen, 'ebitda', key) ?? wert(zeilen, 'ebit_schaetzung', key)
  if (ebitda != null && ebitda > 0) return ebitda
  const ebit = wert(zeilen, 'ebit', key)
  return ebit != null && ebit > 0 ? ebit : null
}

function umsatzAusZeilen(zeilen: FundamentalMetrikZeile[], key: string): number | null {
  return wert(zeilen, 'umsatz', key) ?? wert(zeilen, 'umsatz_schaetzung', key)
}

function fcfAusZeilen(zeilen: FundamentalMetrikZeile[], key: string): number | null {
  return wert(zeilen, 'fcf', key) ?? wert(zeilen, 'fcf_schaetzung', key)
}

function historischeFyKeys(perioden: FundamentalPeriode[]): string[] {
  return perioden
    .filter((p) => !p.istLtm && !p.istNtm && !p.istSchaetzung && /^\d{4}-\d{2}-\d{2}$/.test(p.iso))
    .map((p) => p.iso)
}

function schaetzungsPeriodenKeys(perioden: FundamentalPeriode[]): string[] {
  return perioden
    .filter((p) => p.istSchaetzung && !istFundamentalQuartalSchaetzungIso(p.iso))
    .map((p) => p.iso)
}

function safeDiv(a: number | null, b: number | null): number | null {
  if (a == null || b == null || b === 0) return null
  const r = a / b
  return Number.isFinite(r) ? r : null
}

function leereWerteFuerKeys(keys: string[]): Record<string, number | null> {
  const out: Record<string, number | null> = {}
  for (const k of keys) out[k] = null
  return out
}

function zeileTrailing(
  id: string,
  label: string,
  werte: Record<string, number | null>,
): FundamentalMetrikZeile {
  return {
    id,
    label,
    gruppe: 'bewertung_trailing',
    einheit: 'multiple',
    werte,
  }
}

export type ForwardBewertungErgebnis = {
  periodenPatch: null
  trailingPatches: Partial<Record<'kgv' | 'ps' | 'pfcf', Record<string, number | null>>>
  neueZeilen: FundamentalMetrikZeile[]
  zeilen: FundamentalMetrikZeile[]
}

/**
 * FY-Forward-Multiples für die Bewertungstabelle (ohne NTM).
 */
export async function baueNtmBewertungsZeilen(
  _symbolYahoo: string | null,
  perioden: FundamentalPeriode[],
  zeilen: FundamentalMetrikZeile[],
  yahoo: YahooFundamentalKennzahlen | null,
): Promise<ForwardBewertungErgebnis> {
  const fyKeys = historischeFyKeys(perioden)
  const schKeys = schaetzungsPeriodenKeys(perioden)
  if (schKeys.length === 0) {
    return { periodenPatch: null, trailingPatches: {}, neueZeilen: [], zeilen: [] }
  }

  const letztesHistKey = fyKeys[fyKeys.length - 1] ?? null
  const sharesMio =
    wert(zeilen, 'aktien', FUNDAMENTAL_TTM_KEY) ??
    (letztesHistKey ? wert(zeilen, 'aktien', letztesHistKey) : null) ??
    (yahoo?.sharesOutstanding != null ? yahoo.sharesOutstanding / 1_000_000 : null)

  const aktuellerKurs = aktuellerKursAusQuellen(zeilen, yahoo, sharesMio)

  const mcMio = marktCapMio(aktuellerKurs, sharesMio, yahoo)
  const evMio = enterpriseValueMio(yahoo, mcMio)

  const pePatch = leereWerteFuerKeys(schKeys)
  const psPatch = leereWerteFuerKeys(schKeys)
  const pfcfPatch = leereWerteFuerKeys(schKeys)
  const evRevWerte = leereWerteFuerKeys(schKeys)
  const evEbitdaWerte = leereWerteFuerKeys(schKeys)

  for (const sk of schKeys) {
    const eps = epsFuerSpalte(zeilen, sk, sharesMio)
    const rev = umsatzAusZeilen(zeilen, sk)
    const fcf = fcfAusZeilen(zeilen, sk)
    const ebitda = ebitdaAusZeilen(zeilen, sk)

    pePatch[sk] = safeDiv(aktuellerKurs, eps)
    psPatch[sk] = safeDiv(mcMio, rev)
    pfcfPatch[sk] = safeDiv(mcMio, fcf)
    evRevWerte[sk] = safeDiv(evMio, rev)
    evEbitdaWerte[sk] = safeDiv(evMio, ebitda)
  }

  const hatIrgendwas = schKeys.some(
    (sk) =>
      pePatch[sk] != null ||
      psPatch[sk] != null ||
      pfcfPatch[sk] != null ||
      evRevWerte[sk] != null ||
      evEbitdaWerte[sk] != null,
  )
  if (!hatIrgendwas) {
    return { periodenPatch: null, trailingPatches: {}, neueZeilen: [], zeilen: [] }
  }

  const neueZeilen: FundamentalMetrikZeile[] = []
  if (Object.values(evRevWerte).some((v) => v != null)) {
    neueZeilen.push(zeileTrailing('ev_rev', 'EV / Umsatz', evRevWerte))
  }
  if (Object.values(evEbitdaWerte).some((v) => v != null)) {
    neueZeilen.push(zeileTrailing('ev_ebitda', 'EV / EBITDA', evEbitdaWerte))
  }

  return {
    periodenPatch: null,
    trailingPatches: {
      kgv: pePatch,
      ps: psPatch,
      pfcf: pfcfPatch,
    },
    neueZeilen,
    zeilen: [],
  }
}

/** Forward-KGV = erstes FY-Schätz-Multiple (für Radar / Key-Metrics). */
export function berechneNtmPeAusSchaetzungen(
  aktuellerKurs: number | null,
  zeilen: FundamentalMetrikZeile[],
  perioden: FundamentalPeriode[],
  yahoo: YahooFundamentalKennzahlen | null,
): number | null {
  const fyKeys = historischeFyKeys(perioden)
  const schKeys = schaetzungsPeriodenKeys(perioden)
  const letztesHistKey = fyKeys[fyKeys.length - 1] ?? null
  const sharesMio =
    wert(zeilen, 'aktien', FUNDAMENTAL_TTM_KEY) ??
    (letztesHistKey ? wert(zeilen, 'aktien', letztesHistKey) : null) ??
    (yahoo?.sharesOutstanding != null ? yahoo.sharesOutstanding / 1_000_000 : null)
  const kurs = aktuellerKursAusQuellen(zeilen, yahoo, sharesMio) ?? aktuellerKurs

  for (const sk of schKeys) {
    const pe = safeDiv(kurs, epsFuerSpalte(zeilen, sk, sharesMio))
    if (pe != null) return pe
  }
  return yahoo?.forwardPE ?? null
}
