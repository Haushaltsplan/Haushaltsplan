/**
 * Robuste Deltas aus Lifetime-Zähler-Snapshots (Views/Favoriten).
 *
 * Cron-Lücken: nicht starr „heute − vor 7 Tagen“, sondern
 * (Snapshot_aktuell − letzter_vorhandener) / Tage × Ziel-Fenster.
 */

export type StatistikSnap = { tag: string; views: number | null; favoriten: number | null }

export type StatistikDelta = {
  /** Roh-Zuwachs zwischen den beiden genutzten Snapshots */
  roh: number
  /** Auf `zielTage` hoch-/runtergerechnet */
  normalisiert: number
  /** Tage zwischen den genutzten Snapshots (≥ 1) */
  tageSpan: number
  vonTag: string
  bisTag: string
  /** true wenn Span stark vom Ziel abweicht oder Daten dünn sind */
  unvollstaendig: boolean
}

function tageZwischen(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86_400_000)
}

/** Letzter Snapshot mit tag ≤ ziel. */
export function letzterSnapBis(reihe: StatistikSnap[], ziel: string): StatistikSnap | null {
  let treffer: StatistikSnap | null = null
  for (const p of reihe) {
    if (p.tag <= ziel && (!treffer || p.tag > treffer.tag)) treffer = p
  }
  return treffer
}

/**
 * Zuwachs eines Feldes, normalisiert auf `zielTage`.
 * Beispiel: 10 Tage Lücke, +20 Views → normalisiert 7d = 14.
 */
export function zuwachsNormalisiert(
  reihe: StatistikSnap[],
  vonSoll: string,
  bisSoll: string,
  feld: 'views' | 'favoriten',
  zielTage = 7,
): StatistikDelta | null {
  const sorted = [...reihe].sort((a, b) => (a.tag < b.tag ? -1 : a.tag > b.tag ? 1 : 0))
  const ende = letzterSnapBis(sorted, bisSoll)
  if (!ende) return null

  // Start: letzter Snap ≤ vonSoll; sonst frühester Snap vor ende (Cron-Lücke am Fensterrand)
  let start = letzterSnapBis(sorted, vonSoll)
  if (!start || start.tag === ende.tag) {
    start = null
    for (const p of sorted) {
      if (p.tag < ende.tag) start = p
    }
  }
  if (!start || start.tag === ende.tag) return null

  const va = start[feld]
  const vb = ende[feld]
  if (va == null || vb == null) return null

  const tageSpan = Math.max(1, tageZwischen(start.tag, ende.tag))
  const roh = Math.max(0, vb - va)
  const proTag = roh / tageSpan
  const normalisiert = Math.round(proTag * zielTage * 10) / 10

  const driftStart = Math.abs(tageZwischen(start.tag, vonSoll))
  const driftEnde = Math.abs(tageZwischen(ende.tag, bisSoll))
  const unvollstaendig = driftStart > 2 || driftEnde > 2 || Math.abs(tageSpan - zielTage) > 2

  return {
    roh,
    normalisiert,
    tageSpan,
    vonTag: start.tag,
    bisTag: ende.tag,
    unvollstaendig,
  }
}

/** Convenience: Views+Favs für ein 7-Tage-Fenster. */
export function funnelDelta7(
  reihe: StatistikSnap[],
  heute: string,
  vor7: string,
): { views7: number; favs7: number; unvollstaendig: boolean; tageSpan: number } {
  const v = zuwachsNormalisiert(reihe, vor7, heute, 'views', 7)
  const f = zuwachsNormalisiert(reihe, vor7, heute, 'favoriten', 7)
  return {
    views7: v?.normalisiert ?? 0,
    favs7: f?.normalisiert ?? 0,
    unvollstaendig: Boolean(v?.unvollstaendig || f?.unvollstaendig || (!v && !f)),
    tageSpan: v?.tageSpan ?? f?.tageSpan ?? 0,
  }
}
