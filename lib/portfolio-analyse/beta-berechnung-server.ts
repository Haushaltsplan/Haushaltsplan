/**
 * 5J-Beta selbst berechnen, wenn Yahoo `defaultKeyStatistics.beta` fehlt.
 * Methode: OLS auf monatlichen adj. Closes vs. S&P 500 (^GSPC), bei Nicht-USD
 * Preise zuvor in USD umrechnen (CAPM mit US-rf / ERP).
 */
import 'server-only'

import {
  BETA_PREIS_FENSTER_MONATE,
  berechneBetaAusMonatskursen,
  type BetaBerechnungErgebnis,
} from '@/lib/portfolio-analyse/beta-berechnung'
import {
  ladeYahooMonatsAdjKurse,
  type YahooKursPunkt,
} from '@/lib/portfolio-analyse/yahoo-historie-server'

const MARKT_KANDIDATEN = ['^GSPC', 'SPY'] as const

/** Lokalpreis × Faktor = USD. */
const FX_DIRECT: Record<string, string> = {
  EUR: 'EURUSD=X',
  GBP: 'GBPUSD=X',
  AUD: 'AUDUSD=X',
  NZD: 'NZDUSD=X',
}

/** USD × Quote = Lokal → Faktor = 1/Quote. */
const FX_INVERSE: Record<string, string> = {
  JPY: 'USDJPY=X',
  CHF: 'USDCHF=X',
  CAD: 'USDCAD=X',
  SEK: 'USDSEK=X',
  NOK: 'USDNOK=X',
  DKK: 'USDDKK=X',
  HKD: 'USDHKD=X',
  SGD: 'USDSGD=X',
}

function isoVorMonaten(monate: number): string {
  const d = new Date()
  d.setUTCDate(1)
  d.setUTCMonth(d.getUTCMonth() - monate)
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-01`
}

function isoHeute(): string {
  const d = new Date()
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
}

function inUsdUmrechnen(
  serie: YahooKursPunkt[],
  fx: YahooKursPunkt[],
  modus: 'direct' | 'inverse',
): YahooKursPunkt[] {
  const fxMap = new Map<string, number>()
  for (const p of fx) {
    if (p.kurs > 0) fxMap.set(p.datum.slice(0, 7), p.kurs)
  }
  const out: YahooKursPunkt[] = []
  for (const p of serie) {
    const q = fxMap.get(p.datum.slice(0, 7))
    if (q == null || !(q > 0)) continue
    const usd = modus === 'direct' ? p.kurs * q : p.kurs / q
    if (!(usd > 0)) continue
    out.push({ datum: p.datum, kurs: Math.round(usd * 10000) / 10000 })
  }
  return out
}

async function ladeAktieInUsd(
  symbol: string,
  currency: string | null | undefined,
  von: string,
  bis: string,
): Promise<YahooKursPunkt[]> {
  const serie = await ladeYahooMonatsAdjKurse(symbol, von, bis)
  if (serie.length === 0) return []

  const ccy = (currency ?? 'USD').trim().toUpperCase()
  if (!ccy || ccy === 'USD') return serie

  const direct = FX_DIRECT[ccy]
  if (direct) {
    const fx = await ladeYahooMonatsAdjKurse(direct, von, bis)
    return inUsdUmrechnen(serie, fx, 'direct')
  }
  const inverse = FX_INVERSE[ccy]
  if (inverse) {
    const fx = await ladeYahooMonatsAdjKurse(inverse, von, bis)
    return inUsdUmrechnen(serie, fx, 'inverse')
  }
  // Unbekannte Währung: Rohserie (besser als gar kein Beta)
  return serie
}

/**
 * Berechnet 5J-Monats-Beta vs. S&P 500. Probiert mehrere Listing-Symbole.
 */
export async function berechneBeta5JVsSp500(opts: {
  symbole: string[]
  currency?: string | null
}): Promise<BetaBerechnungErgebnis | null> {
  const von = isoVorMonaten(BETA_PREIS_FENSTER_MONATE)
  const bis = isoHeute()
  const uniq = [...new Set(opts.symbole.map((s) => s.trim().toUpperCase()).filter(Boolean))]
  if (uniq.length === 0) return null

  let marktSerie: YahooKursPunkt[] = []
  let marktSymbol = MARKT_KANDIDATEN[0]
  for (const m of MARKT_KANDIDATEN) {
    const s = await ladeYahooMonatsAdjKurse(m, von, bis)
    if (s.length >= 37) {
      marktSerie = s
      marktSymbol = m
      break
    }
  }
  if (marktSerie.length < 37) return null

  for (const sym of uniq) {
    const aktieUsd = await ladeAktieInUsd(sym, opts.currency, von, bis)
    const hit = berechneBetaAusMonatskursen(aktieUsd, marktSerie)
    if (hit) return { ...hit, marktSymbol }
  }
  return null
}
