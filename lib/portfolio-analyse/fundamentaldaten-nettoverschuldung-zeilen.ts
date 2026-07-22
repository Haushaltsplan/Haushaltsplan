/**
 * Abgeleitete Bilanz-/Hebel-Zeilen für Key-Metric-Historie.
 */
import type { FundamentalMetrikZeile, FundamentalPeriode } from '@/lib/portfolio-analyse/fundamentaldaten-types'

function wert(zeilen: FundamentalMetrikZeile[], id: string, key: string): number | null {
  const v = zeilen.find((z) => z.id === id)?.werte[key]
  return v != null && Number.isFinite(v) ? v : null
}

export function ergaenzeNettoverschuldungZeilen(
  perioden: FundamentalPeriode[],
  zeilen: FundamentalMetrikZeile[],
): void {
  if (perioden.length === 0) return
  if (zeilen.some((z) => z.id === 'nettoverschuldung') && zeilen.some((z) => z.id === 'net_debt_ebitda')) {
    return
  }

  const ndWerte: Record<string, number | null> = {}
  const ndEbitdaWerte: Record<string, number | null> = {}
  let hatNd = false
  let hatNdE = false

  for (const p of perioden) {
    const d = wert(zeilen, 'gesamtverschuldung', p.iso)
    const c = wert(zeilen, 'bargeld', p.iso)
    const e = wert(zeilen, 'ebitda', p.iso)
    if (d != null || c != null) {
      const nd = (d ?? 0) - (c ?? 0)
      ndWerte[p.iso] = nd
      hatNd = true
      if (e != null && e > 0) {
        ndEbitdaWerte[p.iso] = nd / e
        hatNdE = true
      } else ndEbitdaWerte[p.iso] = null
    } else {
      ndWerte[p.iso] = null
      ndEbitdaWerte[p.iso] = null
    }
  }

  if (hatNd && !zeilen.some((z) => z.id === 'nettoverschuldung')) {
    zeilen.push({
      id: 'nettoverschuldung',
      label: 'Nettoverschuldung',
      gruppe: 'bilanz',
      einheit: 'waehrung_usd_mio',
      werte: ndWerte,
    })
  }
  if (hatNdE && !zeilen.some((z) => z.id === 'net_debt_ebitda')) {
    zeilen.push({
      id: 'net_debt_ebitda',
      label: 'Net Debt / EBITDA',
      gruppe: 'bewertung_trailing',
      einheit: 'multiple',
      werte: ndEbitdaWerte,
    })
  }
}
