/**
 * Forward-Bewertung (FY-Schätzungen) + TTM-EV aus Yahoo.
 * Historische EV-Multiples kommen aus ergaenzeEvMultiplesZeilen
 * (Marktkap-Chart + Schulden − Cash).
 */
import 'server-only'

import { ergaenzeEvMultiplesZeilen } from '@/lib/portfolio-analyse/fundamentaldaten-ev-multiples-zeilen'
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

function mergeWerteInZeile(
  zeilen: FundamentalMetrikZeile[],
  id: string,
  label: string,
  patch: Record<string, number | null>,
): FundamentalMetrikZeile | null {
  if (!Object.values(patch).some((v) => v != null)) return null
  const existing = zeilen.find((z) => z.id === id)
  if (existing) {
    for (const [k, v] of Object.entries(patch)) {
      if (v != null) existing.werte[k] = v
      else if (!(k in existing.werte)) existing.werte[k] = null
    }
    return null
  }
  return zeileTrailing(id, label, { ...patch })
}

export type ForwardBewertungErgebnis = {
  periodenPatch: null
  trailingPatches: Partial<Record<'kgv' | 'ps' | 'pfcf', Record<string, number | null>>>
  neueZeilen: FundamentalMetrikZeile[]
  zeilen: FundamentalMetrikZeile[]
}

/**
 * FY-Forward-Multiples + Yahoo-TTM für EV; Historie via ergaenzeEvMultiplesZeilen.
 */
export async function baueNtmBewertungsZeilen(
  _symbolYahoo: string | null,
  perioden: FundamentalPeriode[],
  zeilen: FundamentalMetrikZeile[],
  yahoo: YahooFundamentalKennzahlen | null,
): Promise<ForwardBewertungErgebnis> {
  // Historie zuerst (Marktkap-Chart + LTD − Cash)
  ergaenzeEvMultiplesZeilen(perioden, zeilen)

  const fyKeys = historischeFyKeys(perioden)
  const schKeys = schaetzungsPeriodenKeys(perioden)

  const letztesHistKey = fyKeys[fyKeys.length - 1] ?? null
  const sharesMio =
    wert(zeilen, 'aktien', FUNDAMENTAL_TTM_KEY) ??
    (letztesHistKey ? wert(zeilen, 'aktien', letztesHistKey) : null) ??
    (yahoo?.sharesOutstanding != null ? yahoo.sharesOutstanding / 1_000_000 : null)

  const aktuellerKurs = aktuellerKursAusQuellen(zeilen, yahoo, sharesMio)
  const mcMio = marktCapMio(aktuellerKurs, sharesMio, yahoo)
  const evMioAktuell = enterpriseValueMio(yahoo, mcMio)

  const pePatch = leereWerteFuerKeys(schKeys)
  const psPatch = leereWerteFuerKeys(schKeys)
  const pfcfPatch = leereWerteFuerKeys(schKeys)
  const evRevPatch: Record<string, number | null> = {}
  const evEbitdaPatch: Record<string, number | null> = {}

  // TTM: Yahoo-Multiples bevorzugen (gleiche Definition wie Key Metrics)
  if (yahoo?.enterpriseToRevenue != null && yahoo.enterpriseToRevenue > 0) {
    evRevPatch[FUNDAMENTAL_TTM_KEY] = yahoo.enterpriseToRevenue
  } else {
    const ttmRev =
      umsatzAusZeilen(zeilen, FUNDAMENTAL_TTM_KEY) ??
      (letztesHistKey ? umsatzAusZeilen(zeilen, letztesHistKey) : null)
    evRevPatch[FUNDAMENTAL_TTM_KEY] = safeDiv(evMioAktuell, ttmRev)
  }
  if (yahoo?.enterpriseToEbitda != null && yahoo.enterpriseToEbitda > 0) {
    evEbitdaPatch[FUNDAMENTAL_TTM_KEY] = yahoo.enterpriseToEbitda
  } else {
    const ttmEbitda =
      ebitdaAusZeilen(zeilen, FUNDAMENTAL_TTM_KEY) ??
      (letztesHistKey ? ebitdaAusZeilen(zeilen, letztesHistKey) : null)
    evEbitdaPatch[FUNDAMENTAL_TTM_KEY] = safeDiv(evMioAktuell, ttmEbitda)
  }

  for (const sk of schKeys) {
    const eps = epsFuerSpalte(zeilen, sk, sharesMio)
    const rev = umsatzAusZeilen(zeilen, sk)
    const fcf = fcfAusZeilen(zeilen, sk)
    const ebitda = ebitdaAusZeilen(zeilen, sk)

    pePatch[sk] = safeDiv(aktuellerKurs, eps)
    psPatch[sk] = safeDiv(mcMio, rev)
    pfcfPatch[sk] = safeDiv(mcMio, fcf)
    evRevPatch[sk] = safeDiv(evMioAktuell, rev)
    evEbitdaPatch[sk] = safeDiv(evMioAktuell, ebitda)
  }

  const hatForward = schKeys.some(
    (sk) =>
      pePatch[sk] != null ||
      psPatch[sk] != null ||
      pfcfPatch[sk] != null ||
      evRevPatch[sk] != null ||
      evEbitdaPatch[sk] != null,
  )

  const neueZeilen: FundamentalMetrikZeile[] = []
  const evRevNeu = mergeWerteInZeile(zeilen, 'ev_rev', 'EV / Umsatz', evRevPatch)
  if (evRevNeu) neueZeilen.push(evRevNeu)
  const evEbitdaNeu = mergeWerteInZeile(zeilen, 'ev_ebitda', 'EV / EBITDA', evEbitdaPatch)
  if (evEbitdaNeu) neueZeilen.push(evEbitdaNeu)

  if (!hatForward && neueZeilen.length === 0) {
    // Historie kann bereits in zeilen stehen — kein Fehler
    return { periodenPatch: null, trailingPatches: {}, neueZeilen: [], zeilen: [] }
  }

  return {
    periodenPatch: null,
    trailingPatches: hatForward
      ? {
          kgv: pePatch,
          ps: psPatch,
          pfcf: pfcfPatch,
        }
      : {},
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
