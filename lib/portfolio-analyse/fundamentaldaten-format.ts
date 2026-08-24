import type { FundamentalEinheit, FundamentalFrequenz } from '@/lib/portfolio-analyse/fundamentaldaten-types'

export function formatFundamentalPeriodeLabel(iso: string, frequenz?: FundamentalFrequenz): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return iso
  if (frequenz === 'quartal') {
    const month = Number(m[2])
    const q = month <= 3 ? 1 : month <= 6 ? 2 : month <= 9 ? 3 : 4
    return `Q${q} ${m[1].slice(2)}`
  }
  return `${m[3]}.${m[2]}.${m[1].slice(2)}`
}

export function formatFundamentalWert(
  wert: number | null | undefined,
  einheit: FundamentalEinheit,
  opts?: { nm?: boolean },
): string {
  if (opts?.nm) return 'NM'
  if (wert == null || !Number.isFinite(wert)) return '–'
  switch (einheit) {
    case 'prozent':
      return `${wert.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 2 })} %`
    case 'multiple':
      return `${wert.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}x`
    case 'ratio':
      return wert.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    case 'waehrung_usd_mio': {
      const usd = wert * 1_000_000
      // DE: Bio. = 10¹² (Trillion), Mrd. = 10⁹ (Billion) — nicht vertauschen.
      if (Math.abs(usd) >= 1e12) {
        return `${(usd / 1e12).toLocaleString('de-DE', { maximumFractionDigits: 2 })} Bio. $`
      }
      if (Math.abs(usd) >= 1e9) {
        return `${(usd / 1e9).toLocaleString('de-DE', { maximumFractionDigits: 2 })} Mrd. $`
      }
      if (Math.abs(usd) >= 1e6) {
        return `${(usd / 1e6).toLocaleString('de-DE', { maximumFractionDigits: 2 })} Mio. $`
      }
      return `${usd.toLocaleString('de-DE', { maximumFractionDigits: 0 })} $`
    }
    case 'waehrung_usd_aktie':
      return `${wert.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $`
    case 'aktien_mio':
      return `${wert.toLocaleString('de-DE', { maximumFractionDigits: 2 })} Mio.`
    case 'waehrung_usd':
      if (Math.abs(wert) >= 1e12) {
        return `${(wert / 1e12).toLocaleString('de-DE', { maximumFractionDigits: 2 })} Bio. $`
      }
      if (Math.abs(wert) >= 1e9) {
        return `${(wert / 1e9).toLocaleString('de-DE', { maximumFractionDigits: 2 })} Mrd. $`
      }
      if (Math.abs(wert) >= 1e6) {
        return `${(wert / 1e6).toLocaleString('de-DE', { maximumFractionDigits: 2 })} Mio. $`
      }
      return `${wert.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $`
    default:
      return wert.toLocaleString('de-DE', { maximumFractionDigits: 2 })
  }
}

export function cagrProzent(werte: number[], jahre: number): number | null {
  if (werte.length < 2 || jahre <= 0) return null
  const start = werte[0]
  const end = werte[werte.length - 1]
  if (start == null || end == null || start <= 0 || end <= 0) return null
  const cagr = (Math.pow(end / start, 1 / jahre) - 1) * 100
  return Number.isFinite(cagr) ? cagr : null
}

/**
 * Aufeinanderfolgende Jahre mit Sprung > `maxFaktor` sind typisch Einheiten-/Perioden-Mix
 * (Mio. vs. USD, Quartal vs. GJ). Behält die jüngste zusammenhängende Reihe.
 */
export function werteOhneNiveauSprung(werte: number[], maxFaktor = 2.8): number[] {
  const roh = werte.filter((v) => Number.isFinite(v) && v > 0)
  if (roh.length < 2) return roh
  const out: number[] = []
  for (let i = roh.length - 1; i >= 0; i--) {
    const cur = roh[i]!
    if (out.length === 0) {
      out.unshift(cur)
      continue
    }
    const ratio = out[0]! / cur
    if (ratio > maxFaktor || ratio < 1 / maxFaktor) break
    out.unshift(cur)
  }
  return out
}

export function cagr3AusSerie(werte: number[]): number | null {
  const clean = werteOhneNiveauSprung(werte)
  if (clean.length < 2) return null
  return cagrProzent(clean.slice(-4), Math.min(3, clean.length - 1))
}

export function formatYahooUmsatzUsd(wert: number | null | undefined): string {
  if (wert == null || !Number.isFinite(wert)) return '–'
  return formatFundamentalWert(wert, 'waehrung_usd')
}
