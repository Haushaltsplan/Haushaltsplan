/** Preisvergleich letzter vs. vorletzter Einkauf (je Basiseinheit). */

export function einzelpreisAusEinkauf(gesamtpreis: number, basisMenge: number): number | null {
  const g = Number(gesamtpreis)
  const m = Number(basisMenge)
  if (!Number.isFinite(g) || !Number.isFinite(m) || m <= 0) return null
  return Math.round((g / m) * 1_000_000) / 1_000_000
}

/** Prozentuale Änderung (positiv = teurer). */
export function preisAenderungProzent(letzter: number | null, vorheriger: number | null): number | null {
  if (letzter == null || vorheriger == null || vorheriger <= 0) return null
  const pct = ((letzter - vorheriger) / vorheriger) * 100
  if (!Number.isFinite(pct)) return null
  return Math.round(pct * 10) / 10
}

export function preisAenderungLabel(pct: number | null): string | null {
  if (pct == null || !Number.isFinite(pct)) return null
  if (Math.abs(pct) < 0.5) return null
  const sign = pct > 0 ? '+' : ''
  return `${sign}${pct.toLocaleString('de-DE', { maximumFractionDigits: 1 })} %`
}
