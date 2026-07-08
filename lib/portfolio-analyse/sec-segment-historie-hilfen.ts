import type { SecSegmentHistorie } from '@/lib/portfolio-analyse/fundamentaldaten-erweitert-types'

/** Max. Jahre in der UI (Anzeige). */
export const MAX_SEGMENT_HISTORIE_JAHRE = 10

function segmentNamenAusJahren(jahre: SecSegmentHistorie['jahre']): string[] {
  return [...new Set(jahre.flatMap((j) => j.segmente.map((s) => s.name)))].sort()
}

export function begrenzeSegmentHistorie(
  hist: SecSegmentHistorie,
  maxJahre = MAX_SEGMENT_HISTORIE_JAHRE,
): SecSegmentHistorie {
  if (hist.jahre.length <= maxJahre) return hist
  const jahre = hist.jahre.slice(-maxJahre)
  return {
    ...hist,
    jahre,
    anzahlJahre: jahre.length,
    aeltestesJahr: jahre[0]!.jahr,
    juengstesJahr: jahre[jahre.length - 1]!.jahr,
    segmentNamen: segmentNamenAusJahren(jahre),
  }
}
