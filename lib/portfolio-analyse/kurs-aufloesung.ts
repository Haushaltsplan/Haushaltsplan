import type { YahooKursZeile } from '@/lib/portfolio-analyse/yahoo-kurse-server'
import { kursFuerSymbol } from '@/lib/portfolio-analyse/yahoo-kurse-server'

const PLAUSIBEL_RATIO_MIN = 0.15
const PLAUSIBEL_RATIO_MAX = 5

export type KursWahl = {
  symbol: string
  kurs: number
  zeile: YahooKursZeile
}

function kursNachEur(preis: number, symbol: string, eurUsd: number | null): number {
  const sym = symbol.toUpperCase()
  const istEurNotiert =
    sym.endsWith('.DE') ||
    sym.endsWith('.F') ||
    sym.endsWith('.PA') ||
    sym.endsWith('.AS') ||
    sym.endsWith('.MI') ||
    sym.endsWith('.SW')
  if (istEurNotiert || eurUsd == null || eurUsd <= 0) return preis
  if (!sym.includes('.')) return preis / eurUsd
  return preis
}

/** Bester Live-Kurs aus mehreren Yahoo-Symbolen (EUR-Depot: .DE/.PA/.F bevorzugt). */
export function waehleBesterKurs(
  kandidaten: string[],
  kurse: Map<string, YahooKursZeile>,
  einstandKurs: number,
  fallbackKurs: number | null,
  opts?: { isin?: string; eurUsd?: number | null; usBasisTicker?: string | null },
): KursWahl | null {
  const isin = opts?.isin?.toUpperCase() ?? ''
  const eurUsd = opts?.eurUsd ?? null
  const usBasis = opts?.usBasisTicker?.toUpperCase() ?? null
  const uniq = [...new Set(kandidaten.map((s) => s.trim().toUpperCase()).filter(Boolean))]
  if (uniq.length === 0) return null

  const hits: KursWahl[] = []
  for (const symbol of uniq) {
    const zeile = kursFuerSymbol(kurse, symbol)
    if (!zeile) continue
    const preis = zeile.preis
    if (preis == null || !Number.isFinite(preis) || preis <= 0) continue
    const kursEur = kursNachEur(preis, symbol, eurUsd)
    hits.push({ symbol, kurs: kursEur, zeile: { ...zeile, preis: kursEur } })
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

  const pool = plausibel.length > 0 ? plausibel : hits

  const score = (h: KursWahl): number => {
    let s = 0
    const sym = h.symbol.toUpperCase()
    const base = sym.includes('.') ? sym.split('.')[0] : sym
    if (isin.startsWith('FR') && sym.endsWith('.PA')) s += 45
    else if (sym.endsWith('.DE') || sym.endsWith('.F')) s += 40
    else if (sym.endsWith('.PA') || sym.endsWith('.AS')) s += 35
    else if (sym.endsWith('.L')) s += 10
    else if (!sym.includes('.')) s += isin.startsWith('US') ? 20 : -15
    if (usBasis && (sym.endsWith('.DE') || sym.endsWith('.F')) && base !== usBasis) s -= 80
    if (usBasis && !sym.includes('.') && base === usBasis) s += 30
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
