import 'server-only'

import {
  FX_SYMBOLE,
  fxKurseAusYahooMap,
  type FxKurse,
  boersenWaehrung,
  betragWaehrungInEur,
} from '@/lib/portfolio-analyse/kurs-aufloesung'
import { ladeYahooKurse } from '@/lib/portfolio-analyse/yahoo-kurse-server'

let fxCache: { at: number; fx: FxKurse } | null = null
const FX_CACHE_MS = 5 * 60 * 1000

/** Live-FX für Dividenden-Umrechnung (kurz gecacht). */
export async function ladeDividendenFxKurse(): Promise<FxKurse> {
  if (fxCache && Date.now() - fxCache.at < FX_CACHE_MS) return fxCache.fx
  try {
    const map = await ladeYahooKurse([...FX_SYMBOLE])
    const fx = fxKurseAusYahooMap(map)
    fxCache = { at: Date.now(), fx }
    return fx
  } catch {
    const fx = fxKurseAusYahooMap(new Map())
    fxCache = { at: Date.now(), fx }
    return fx
  }
}

/** Fallback wenn DivvyDiary keine currency liefert. */
export function dividendenWaehrungAusIsin(isin: string | null | undefined): string {
  const p = (isin ?? '').trim().toUpperCase().slice(0, 2)
  if (p === 'US') return 'USD'
  if (p === 'GB' || p === 'JE' || p === 'GG' || p === 'IM') return 'GBP'
  if (p === 'CH' || p === 'LI') return 'CHF'
  if (p === 'CA') return 'CAD'
  if (p === 'SG') return 'SGD'
  if (
    [
      'DE',
      'FR',
      'NL',
      'BE',
      'AT',
      'ES',
      'IT',
      'IE',
      'FI',
      'PT',
      'LU',
      'GR',
      'EE',
      'LV',
      'LT',
      'SK',
      'SI',
      'MT',
      'CY',
    ].includes(p)
  ) {
    return 'EUR'
  }
  return 'USD'
}

export function dividendenWaehrungAusSymbol(symbol: string | null | undefined): string {
  const w = boersenWaehrung(symbol ?? '')
  return w === 'SONST' ? 'USD' : w
}

export function dividendeInEur(
  betrag: number,
  waehrung: string | null | undefined,
  fx: FxKurse,
): number {
  return Math.round(betragWaehrungInEur(betrag, waehrung, fx) * 10000) / 10000
}
