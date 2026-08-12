/**
 * Metrik-Wert zu einer FY-Spalte finden — auch wenn Quellen leicht
 * unterschiedliche Perioden-ISOs nutzen (Macrotrends vs. Yahoo/SA).
 */
const MATCH_TOLERANZ_MS = 45 * 24 * 3600 * 1000

export function wertAusMapFuerIso(
  werte: Record<string, number | null | undefined> | undefined,
  iso: string,
): number | null {
  if (!werte) return null

  const direkt = werte[iso]
  if (direkt != null && Number.isFinite(direkt)) return direkt

  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null

  const ziel = new Date(`${iso}T12:00:00Z`).getTime()
  let best: number | null = null
  let bestDiff = Infinity

  for (const [k, v] of Object.entries(werte)) {
    if (v == null || !Number.isFinite(v) || !/^\d{4}-\d{2}-\d{2}$/.test(k)) continue
    const diff = Math.abs(new Date(`${k}T12:00:00Z`).getTime() - ziel)
    if (diff < bestDiff && diff <= MATCH_TOLERANZ_MS) {
      bestDiff = diff
      best = v
    }
  }
  if (best != null) return best

  const jahr = iso.slice(0, 4)
  const gleiche = Object.entries(werte)
    .filter(
      ([k, v]) =>
        v != null && Number.isFinite(v) && /^\d{4}-\d{2}-\d{2}$/.test(k) && k.startsWith(jahr),
    )
    .sort((a, b) => b[0].localeCompare(a[0]))
  const hit = gleiche[0]?.[1]
  return hit != null && Number.isFinite(hit) ? hit : null
}
