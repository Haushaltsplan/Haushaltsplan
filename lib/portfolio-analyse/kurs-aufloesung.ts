import type { YahooKursZeile } from '@/lib/portfolio-analyse/yahoo-kurse-server'
import { kursFuerSymbol } from '@/lib/portfolio-analyse/yahoo-kurse-server'

const PLAUSIBEL_RATIO_MIN = 0.15
const PLAUSIBEL_RATIO_MAX = 5

/** Fallback wenn Yahoo EURUSD=X fehlt (1 EUR ≈ X USD). */
export const FALLBACK_EUR_USD = 1.08
export const FALLBACK_EUR_GBP = 0.86
export const FALLBACK_EUR_CHF = 0.95
export const FALLBACK_EUR_CAD = 1.47
export const FALLBACK_EUR_SGD = 1.45

export type FxKurse = {
  /** Yahoo EURUSD=X: USD pro 1 EUR → USD→EUR: preis / eurUsd */
  eurUsd: number
  /** Yahoo EURGBP=X: GBP pro 1 EUR → GBP→EUR: preis / eurGbp */
  eurGbp: number
  /** Yahoo EURCHF=X: CHF pro 1 EUR → CHF→EUR: preis / eurChf */
  eurChf: number
  /** Yahoo EURCAD=X: CAD pro 1 EUR → CAD→EUR: preis / eurCad */
  eurCad: number
  /** Yahoo EURSGD=X: SGD pro 1 EUR → SGD→EUR: preis / eurSgd */
  eurSgd: number
}

export const FX_SYMBOLE = ['EURUSD=X', 'EURGBP=X', 'EURCHF=X', 'EURCAD=X', 'EURSGD=X'] as const

export function fxKurseAusYahooMap(kurse: Map<string, YahooKursZeile>): FxKurse {
  const usd = kurse.get('EURUSD=X')?.preis
  const gbp = kurse.get('EURGBP=X')?.preis
  const chf = kurse.get('EURCHF=X')?.preis
  const cad = kurse.get('EURCAD=X')?.preis
  const sgd = kurse.get('EURSGD=X')?.preis
  return {
    eurUsd: usd != null && usd > 0 ? usd : FALLBACK_EUR_USD,
    eurGbp: gbp != null && gbp > 0 ? gbp : FALLBACK_EUR_GBP,
    eurChf: chf != null && chf > 0 ? chf : FALLBACK_EUR_CHF,
    eurCad: cad != null && cad > 0 ? cad : FALLBACK_EUR_CAD,
    eurSgd: sgd != null && sgd > 0 ? sgd : FALLBACK_EUR_SGD,
  }
}

export type BoersenWaehrung = 'EUR' | 'USD' | 'GBP' | 'CHF' | 'CAD' | 'SGD' | 'SONST'

export function boersenWaehrung(
  symbol: string,
  override?: BoersenWaehrung | null,
): BoersenWaehrung {
  if (override) return override
  const s = symbol.trim().toUpperCase()
  if (
    s.endsWith('.DE') ||
    s.endsWith('.F') ||
    s.endsWith('.PA') ||
    s.endsWith('.AS') ||
    s.endsWith('.MI') ||
    s.endsWith('.HE') ||
    s.endsWith('.BR') ||
    s.endsWith('.MC') ||
    s.endsWith('.MU')
  ) {
    return 'EUR'
  }
  if (s.endsWith('.SW')) return 'CHF'
  if (s.endsWith('.TO')) return 'CAD'
  if (s.endsWith('.SG')) return 'SGD'
  if (s.endsWith('.L') || s.endsWith('.IL')) return 'GBP'
  if (!s.includes('.') || s.endsWith('.O') || s.endsWith('.N')) return 'USD'
  return 'SONST'
}

export function istEurGelistet(symbol: string): boolean {
  return boersenWaehrung(symbol) === 'EUR'
}

/** Rohkurs → EUR; null wenn Währung unbekannt oder kein FX. */
export function preisInEur(
  preis: number,
  symbol: string,
  fx: FxKurse,
  waehrungOverride?: BoersenWaehrung | null,
): number | null {
  if (!Number.isFinite(preis) || preis <= 0) return null
  switch (boersenWaehrung(symbol, waehrungOverride)) {
    case 'EUR':
      return preis
    case 'USD':
      return preis / fx.eurUsd
    case 'GBP':
      return preis / fx.eurGbp
    case 'CHF':
      return preis / fx.eurChf
    case 'CAD':
      return preis / fx.eurCad
    case 'SGD':
      return preis / fx.eurSgd
    default:
      return null
  }
}

export type KursWahl = {
  symbol: string
  kurs: number
  zeile: YahooKursZeile
  /** true = Kurs direkt in EUR-notierter Börse */
  direktEur: boolean
}

/** Bester Live-Kurs in EUR (EUR-Börse bevorzugt, sonst USD/GBP/CHF umgerechnet). */
export function waehleBesterKurs(
  kandidaten: string[],
  kurse: Map<string, YahooKursZeile>,
  einstandKurs: number,
  fallbackKurs: number | null,
  opts?: {
    isin?: string
    fx?: FxKurse
    usBasisTicker?: string | null
    symbolWaehrung?: Record<string, BoersenWaehrung>
  },
): KursWahl | null {
  const isin = opts?.isin?.toUpperCase() ?? ''
  const fx =
    opts?.fx ??
    ({
      eurUsd: FALLBACK_EUR_USD,
      eurGbp: FALLBACK_EUR_GBP,
      eurChf: FALLBACK_EUR_CHF,
      eurCad: FALLBACK_EUR_CAD,
      eurSgd: FALLBACK_EUR_SGD,
    } satisfies FxKurse)
  const symbolWaehrung = opts?.symbolWaehrung ?? {}
  const usBasis = opts?.usBasisTicker?.toUpperCase() ?? null
  const uniq = [...new Set(kandidaten.map((s) => s.trim().toUpperCase()).filter(Boolean))]
  if (uniq.length === 0) return null

  const hits: KursWahl[] = []
  for (const symbol of uniq) {
    const zeile = kursFuerSymbol(kurse, symbol)
    if (!zeile) continue
    const preis = zeile.preis
    if (preis == null || !Number.isFinite(preis) || preis <= 0) continue
    const waehrungOverride = symbolWaehrung[symbol] ?? symbolWaehrung[symbol.toUpperCase()] ?? null
    const kursEur = preisInEur(preis, symbol, fx, waehrungOverride)
    if (kursEur == null) continue
    const direktEur = boersenWaehrung(symbol, waehrungOverride) === 'EUR'
    hits.push({
      symbol,
      kurs: kursEur,
      direktEur,
      zeile: { ...zeile, preis: kursEur },
    })
  }
  if (hits.length === 0) return null

  const referenz =
    einstandKurs > 0 ? einstandKurs : fallbackKurs != null && fallbackKurs > 0 ? fallbackKurs : null

  const plausibel =
    referenz != null && referenz > 0
      ? hits.filter((h) => {
          const r = h.kurs / referenz
          return r >= PLAUSIBEL_RATIO_MIN && r <= PLAUSIBEL_RATIO_MAX
        })
      : hits

  const plausibelEur = plausibel.filter((h) => h.direktEur)
  const plausibelFx = plausibel.filter((h) => !h.direktEur)
  const pool =
    plausibelEur.length > 0
      ? plausibelEur
      : plausibelFx.length > 0
        ? plausibelFx
        : plausibel.length > 0
          ? plausibel
          : hits.filter((h) => h.direktEur).length > 0
            ? hits.filter((h) => h.direktEur)
            : hits

  const score = (h: KursWahl): number => {
    let s = 0
    const sym = h.symbol.toUpperCase()
    const base = sym.includes('.') ? sym.split('.')[0] : sym
    if (h.direktEur) s += 100
    if (isin.startsWith('FR') && sym.endsWith('.PA')) s += 45
    else if (sym.endsWith('.DE') || sym.endsWith('.F')) s += 40
    else if (sym.endsWith('.PA') || sym.endsWith('.AS')) s += 35
    else if (boersenWaehrung(sym) === 'USD' && !sym.includes('.')) s += 5
    else if (sym.endsWith('.L')) s += 3
    if (usBasis && (sym.endsWith('.DE') || sym.endsWith('.F')) && base !== usBasis) s -= 80
    if (referenz != null && referenz > 0) {
      const diff = Math.abs(Math.log(h.kurs / referenz))
      s += Math.max(0, 30 - diff * 20)
    }
    return s
  }

  pool.sort((a, b) => score(b) - score(a))
  return pool[0] ?? null
}

export function kandidatenMitDeFallback(symbole: string[]): string[] {
  const out = new Set<string>()
  for (const raw of symbole) {
    const s = raw.trim().toUpperCase()
    if (!s) continue
    out.add(s)
    if (!s.includes('.')) {
      out.add(`${s}.DE`)
      out.add(`${s}.F`)
    }
  }
  return [...out]
}
