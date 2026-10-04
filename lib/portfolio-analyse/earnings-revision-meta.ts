/** Analysten-Revisionen / Spannen aus Yahoo earningsTrend (und Fills). */

export type EarningsRevisionMeta = {
  /** Anzahl Analysten EPS-Konsens. */
  epsAnalysten: number | null
  /** Anzahl Analysten Umsatz-Konsens. */
  umsatzAnalysten: number | null
  /** EPS-Konsens aktuell vs. vor 30/90 Tagen (Richtung). */
  epsTrend30dPct: number | null
  epsTrend90dPct: number | null
  /** Hochstufungen / Herabstufungen letzte 30 Tage. */
  revisionenUp30d: number | null
  revisionenDown30d: number | null
  /** Abgeleitet: up | down | flat | unbekannt */
  revisionsRichtung: 'up' | 'down' | 'flat' | 'unbekannt'
}

export function revisionsRichtungAusMeta(meta: {
  epsTrend30dPct: number | null
  revisionenUp30d: number | null
  revisionenDown30d: number | null
}): EarningsRevisionMeta['revisionsRichtung'] {
  const up = meta.revisionenUp30d
  const down = meta.revisionenDown30d
  if (up != null && down != null && (up > 0 || down > 0)) {
    if (up > down) return 'up'
    if (down > up) return 'down'
    return 'flat'
  }
  const t = meta.epsTrend30dPct
  if (t == null || !Number.isFinite(t)) return 'unbekannt'
  if (t > 0.5) return 'up'
  if (t < -0.5) return 'down'
  return 'flat'
}

export function leereRevisionMeta(): EarningsRevisionMeta {
  return {
    epsAnalysten: null,
    umsatzAnalysten: null,
    epsTrend30dPct: null,
    epsTrend90dPct: null,
    revisionenUp30d: null,
    revisionenDown30d: null,
    revisionsRichtung: 'unbekannt',
  }
}
