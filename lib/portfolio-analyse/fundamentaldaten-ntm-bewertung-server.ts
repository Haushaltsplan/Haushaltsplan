/**
 * Forward-Bewertung (NTM + FY-Schätzungen) — wird in die normalen
 * Trailing-Bewertungszeilen (KGV, P/S, …) geschrieben. Keine separate NTM-Tabelle.
 *
 * NTM = Kurs ÷ Konsens-EPS der nächsten ~12 Monate (Blend aus den zwei
 * nächsten FY-Schätzungen), dieselbe EPS-Quelle wie die FY26E/FY27E-Spalten.
 * Yahoo-forwardPE nur als letzter Fallback — der weicht oft stark ab.
 */
import 'server-only'

import type { YahooFundamentalKennzahlen } from '@/lib/portfolio-analyse/fundamentaldaten-key-metrics'
import {
  FUNDAMENTAL_NTM_KEY,
  istFundamentalQuartalSchaetzungIso,
  type FundamentalMetrikZeile,
  type FundamentalPeriode,
} from '@/lib/portfolio-analyse/fundamentaldaten-types'

function wert(zeilen: FundamentalMetrikZeile[], id: string, key: string): number | null {
  const z = zeilen.find((r) => r.id === id)
  const v = z?.werte[key]
  return v != null && Number.isFinite(v) ? v : null
}

function epsAusZeilen(
  zeilen: FundamentalMetrikZeile[],
  key: string,
  sharesMio: number | null,
): number | null {
  const eps = wert(zeilen, 'eps', key)
  if (eps != null && eps > 0) return eps
  const niMio = wert(zeilen, 'nettogewinn', key)
  if (niMio != null && sharesMio != null && sharesMio > 0) return niMio / sharesMio
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
  const ebitda = wert(zeilen, 'ebitda', key)
  if (ebitda != null && ebitda > 0) return ebitda
  const ebit = wert(zeilen, 'ebit', key)
  return ebit != null && ebit > 0 ? ebit : null
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
  return a / b
}

/** Anteil des laufenden FY, der noch in den nächsten 12 Monaten liegt (Kalender-Näherung). */
function anteilRestLaufendesFy(): number {
  const month = new Date().getUTCMonth() + 1 // 1–12
  return Math.max(0.15, Math.min(0.85, (12 - month + 1) / 12))
}

/**
 * NTM-Größe aus den nächsten FY-Schätzungen (gleiche Quelle wie FY26E/FY27E-Spalten).
 * Bei zwei Jahren: zeitgewichteter Blend; sonst erstes verfügbares Jahr.
 */
function ntmAusSchaetzJahren(
  pick: (schKey: string) => number | null,
  schKeys: string[],
  fallback: number | null = null,
): number | null {
  const werte = schKeys.map(pick).filter((v): v is number => v != null && v > 0)
  if (werte.length >= 2) {
    const w0 = anteilRestLaufendesFy()
    return werte[0]! * w0 + werte[1]! * (1 - w0)
  }
  if (werte.length === 1) return werte[0]!
  return fallback != null && fallback > 0 ? fallback : null
}

/** Forward-Multiples für eine Schätzungs-Spalte (aktueller Kurs ÷ Konsens). */
function forwardMultiplesFuerSchaetzSpalte(
  schaetzKey: string,
  aktuellerKurs: number | null,
  zeilen: FundamentalMetrikZeile[],
  sharesMio: number | null,
  yahoo: YahooFundamentalKennzahlen | null,
): {
  pe: number | null
  ps: number | null
  pfcf: number | null
  evRev: number | null
  evEbitda: number | null
} {
  const eps = epsAusZeilen(zeilen, schaetzKey, sharesMio)
  const rev = wert(zeilen, 'umsatz', schaetzKey)
  const fcf = wert(zeilen, 'fcf', schaetzKey)
  const ebitda = ebitdaAusZeilen(zeilen, schaetzKey)
  const mcMio = marktCapMio(aktuellerKurs, sharesMio, yahoo)
  const evMio = enterpriseValueMio(yahoo, mcMio)

  return {
    pe: safeDiv(aktuellerKurs, eps),
    ps: safeDiv(mcMio, rev),
    pfcf: safeDiv(mcMio, fcf),
    evRev: safeDiv(evMio, rev),
    evEbitda: safeDiv(evMio, ebitda),
  }
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
  periodenPatch: FundamentalPeriode | null
  /**
   * Nur NTM + FY-Schätz-ISOs — werden in bestehende Trailing-Zeilen (kgv/ps/pfcf) gemerged.
   * Historische Jahre bleiben unverändert (Macrotrends-Trailing).
   */
  trailingPatches: Partial<Record<'kgv' | 'ps' | 'pfcf', Record<string, number | null>>>
  /** Zusätzliche Zeilen (EV), die es in Macrotrends-Trailing nicht gibt. */
  neueZeilen: FundamentalMetrikZeile[]
}

/**
 * Berechnet NTM + FY-Forward-Multiples und liefert Patches für die normale Bewertungstabelle.
 * @deprecated Name beibehalten für bestehende Imports — liefert keine separaten ntm_*-Zeilen mehr.
 */
export async function baueNtmBewertungsZeilen(
  _symbolYahoo: string | null,
  perioden: FundamentalPeriode[],
  zeilen: FundamentalMetrikZeile[],
  yahoo: YahooFundamentalKennzahlen | null,
): Promise<ForwardBewertungErgebnis & { zeilen: FundamentalMetrikZeile[] }> {
  const fyKeys = historischeFyKeys(perioden)
  const schKeys = schaetzungsPeriodenKeys(perioden)
  if (fyKeys.length === 0 && schKeys.length === 0) {
    return { periodenPatch: null, trailingPatches: {}, neueZeilen: [], zeilen: [] }
  }

  const letztesHistKey = fyKeys[fyKeys.length - 1] ?? null
  const sharesMio =
    (letztesHistKey ? wert(zeilen, 'aktien', letztesHistKey) : null) ??
    (yahoo?.sharesOutstanding != null ? yahoo.sharesOutstanding / 1_000_000 : null)
  const aktuellerKurs = yahoo?.currentPrice ?? null
  const mcMio = marktCapMio(aktuellerKurs, sharesMio, yahoo)
  const evMio = enterpriseValueMio(yahoo, mcMio)

  const forwardKeys = [...schKeys, FUNDAMENTAL_NTM_KEY]
  const pePatch = leereWerteFuerKeys(forwardKeys)
  const psPatch = leereWerteFuerKeys(forwardKeys)
  const pfcfPatch = leereWerteFuerKeys(forwardKeys)
  const evRevWerte = leereWerteFuerKeys(forwardKeys)
  const evEbitdaWerte = leereWerteFuerKeys(forwardKeys)

  for (const sk of schKeys) {
    const m = forwardMultiplesFuerSchaetzSpalte(sk, aktuellerKurs, zeilen, sharesMio, yahoo)
    pePatch[sk] = m.pe
    psPatch[sk] = m.ps
    pfcfPatch[sk] = m.pfcf
    evRevWerte[sk] = m.evRev
    evEbitdaWerte[sk] = m.evEbitda
  }

  // NTM aus denselben Schätzungen wie die FY-Spalten (nicht Yahoo-forwardPE).
  const ntmEps = ntmAusSchaetzJahren(
    (sk) => epsAusZeilen(zeilen, sk, sharesMio),
    schKeys,
    yahoo?.fy1Eps ?? null,
  )
  const ntmRev = ntmAusSchaetzJahren(
    (sk) => wert(zeilen, 'umsatz', sk),
    schKeys,
    yahoo?.fy1RevenueUsd != null ? yahoo.fy1RevenueUsd / 1_000_000 : yahoo?.ntmRevenueUsd != null
      ? yahoo.ntmRevenueUsd / 1_000_000
      : null,
  )
  const ntmFcf = ntmAusSchaetzJahren((sk) => wert(zeilen, 'fcf', sk), schKeys, null)
  const ntmEbitda = ntmAusSchaetzJahren(
    (sk) => ebitdaAusZeilen(zeilen, sk),
    schKeys,
    yahoo?.fy1EbitdaUsd != null ? yahoo.fy1EbitdaUsd / 1_000_000 : null,
  )

  let ntmPe = safeDiv(aktuellerKurs, ntmEps)
  let ntmPs = safeDiv(mcMio, ntmRev)
  let ntmPfcf = safeDiv(mcMio, ntmFcf)
  let ntmEvRev = safeDiv(evMio, ntmRev)
  let ntmEvEbitda = safeDiv(evMio, ntmEbitda)

  // Fallback: erstes FY-Multiple (dann NTM ≈ FY26E — bewusst konsistent)
  if (ntmPe == null) ntmPe = schKeys.map((sk) => pePatch[sk]).find((v) => v != null) ?? yahoo?.forwardPE ?? null
  if (ntmPs == null) ntmPs = schKeys.map((sk) => psPatch[sk]).find((v) => v != null) ?? null
  if (ntmPfcf == null) ntmPfcf = schKeys.map((sk) => pfcfPatch[sk]).find((v) => v != null) ?? null
  if (ntmEvRev == null) ntmEvRev = schKeys.map((sk) => evRevWerte[sk]).find((v) => v != null) ?? null
  if (ntmEvEbitda == null) {
    ntmEvEbitda = schKeys.map((sk) => evEbitdaWerte[sk]).find((v) => v != null) ?? null
  }

  pePatch[FUNDAMENTAL_NTM_KEY] = ntmPe
  psPatch[FUNDAMENTAL_NTM_KEY] = ntmPs
  pfcfPatch[FUNDAMENTAL_NTM_KEY] = ntmPfcf
  evRevWerte[FUNDAMENTAL_NTM_KEY] = ntmEvRev
  evEbitdaWerte[FUNDAMENTAL_NTM_KEY] = ntmEvEbitda

  const hatIrgendwas =
    ntmPe != null ||
    ntmPs != null ||
    ntmPfcf != null ||
    ntmEvRev != null ||
    ntmEvEbitda != null ||
    schKeys.some((sk) => pePatch[sk] != null || psPatch[sk] != null)

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
    periodenPatch: { iso: FUNDAMENTAL_NTM_KEY, label: 'NTM', istNtm: true },
    trailingPatches: {
      kgv: pePatch,
      ps: psPatch,
      pfcf: pfcfPatch,
    },
    neueZeilen,
    // Legacy: leer — Server merged über trailingPatches
    zeilen: [],
  }
}

/** Für Key-Metrics / Radar: NTM-KGV aus Konsens-Schätzungen. */
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
    (letztesHistKey ? wert(zeilen, 'aktien', letztesHistKey) : null) ??
    (yahoo?.sharesOutstanding != null ? yahoo.sharesOutstanding / 1_000_000 : null)
  const ntmEps = ntmAusSchaetzJahren(
    (sk) => epsAusZeilen(zeilen, sk, sharesMio),
    schKeys,
    yahoo?.fy1Eps ?? null,
  )
  const ausKonsens = safeDiv(aktuellerKurs, ntmEps)
  if (ausKonsens != null) return ausKonsens
  if (schKeys.length > 0) {
    const m = forwardMultiplesFuerSchaetzSpalte(schKeys[0]!, aktuellerKurs, zeilen, sharesMio, yahoo)
    if (m.pe != null) return m.pe
  }
  return yahoo?.forwardPE ?? null
}
