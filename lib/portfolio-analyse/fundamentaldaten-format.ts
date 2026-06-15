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
      if (Math.abs(usd) >= 1e12) {
        return `${(usd / 1e12).toLocaleString('de-DE', { maximumFractionDigits: 2 })} Mrd. $`
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
        return `${(wert / 1e12).toLocaleString('de-DE', { maximumFractionDigits: 2 })} Mrd. $`
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

export function formatYahooUmsatzUsd(wert: number | null | undefined): string {
  if (wert == null || !Number.isFinite(wert)) return '–'
  return formatFundamentalWert(wert, 'waehrung_usd')
}
