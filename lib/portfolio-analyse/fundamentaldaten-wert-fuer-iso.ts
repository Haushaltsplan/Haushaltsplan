/**
 * Metrik-Wert zu einer Perioden-Spalte finden — auch wenn Quellen leicht
 * unterschiedliche Perioden-ISOs nutzen (Macrotrends vs. Yahoo/SA).
 *
 * Wichtig: Kein „gleiches Kalenderjahr“-Fallback. Der zog sonst Q4/FY-Werte
 * in Q1-Spalten (oder März-GJ in Dez-Spalten) und verfälschte Quartalszahlen.
 */

export type WertAusMapFuerIsoOpts = {
  /** Max. Abstand in Tagen. Default 45 (Jahres-Drift). Quartals-Merge: ~10. */
  maxDiffTage?: number
}

const DEFAULT_MAX_DIFF_TAGE = 45

export function wertAusMapFuerIso(
  werte: Record<string, number | null | undefined> | undefined,
  iso: string,
  opts?: WertAusMapFuerIsoOpts,
): number | null {
  if (!werte) return null

  const direkt = werte[iso]
  if (direkt != null && Number.isFinite(direkt)) return direkt

  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null

  const maxDiffMs = (opts?.maxDiffTage ?? DEFAULT_MAX_DIFF_TAGE) * 24 * 3600 * 1000
  const ziel = new Date(`${iso}T12:00:00Z`).getTime()
  let best: number | null = null
  let bestDiff = Infinity

  for (const [k, v] of Object.entries(werte)) {
    if (v == null || !Number.isFinite(v) || !/^\d{4}-\d{2}-\d{2}$/.test(k)) continue
    const diff = Math.abs(new Date(`${k}T12:00:00Z`).getTime() - ziel)
    if (diff < bestDiff && diff <= maxDiffMs) {
      bestDiff = diff
      best = v
    }
  }
  return best
}
