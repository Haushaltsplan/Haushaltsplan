/**
 * Abgeleitete Bilanz-/Hebel-Zeilen für Key-Metric-Historie.
 */
import type { FundamentalMetrikZeile, FundamentalPeriode } from '@/lib/portfolio-analyse/fundamentaldaten-types'

function wert(zeilen: FundamentalMetrikZeile[], id: string, key: string): number | null {
  const v = zeilen.find((z) => z.id === id)?.werte[key]
  return v != null && Number.isFinite(v) ? v : null
}

function upsert(
  zeilen: FundamentalMetrikZeile[],
  id: string,
  label: string,
  gruppe: FundamentalMetrikZeile['gruppe'],
  einheit: FundamentalMetrikZeile['einheit'],
  werte: Record<string, number | null>,
): void {
  const existing = zeilen.find((z) => z.id === id)
  if (existing) {
    existing.werte = { ...existing.werte, ...werte }
    existing.label = label
    return
  }
  zeilen.push({ id, label, gruppe, einheit, werte })
}

export function ergaenzeNettoverschuldungZeilen(
  perioden: FundamentalPeriode[],
  zeilen: FundamentalMetrikZeile[],
  opts?: { ohneEbitdaMultiple?: boolean },
): void {
  if (perioden.length === 0) return

  const ndWerte: Record<string, number | null> = {}
  const ndEbitdaWerte: Record<string, number | null> = {}
  let hatNd = false
  let hatNdE = false

  for (const p of perioden) {
    const d = wert(zeilen, 'gesamtverschuldung', p.iso)
    const c = wert(zeilen, 'bargeld', p.iso)
    const e = wert(zeilen, 'ebitda', p.iso)
    // Beide Seiten nötig — fehlendes Cash nicht als 0 behandeln (sonst Gross Debt als Net Debt).
    if (d != null && c != null) {
      const nd = d - c
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

  if (hatNd) {
    upsert(zeilen, 'nettoverschuldung', 'Nettoverschuldung', 'bilanz', 'waehrung_usd_mio', ndWerte)
  }
  if (hatNdE && !opts?.ohneEbitdaMultiple) {
    upsert(
      zeilen,
      'net_debt_ebitda',
      'Net Debt / EBITDA',
      'bewertung_trailing',
      'multiple',
      ndEbitdaWerte,
    )
  }
}
