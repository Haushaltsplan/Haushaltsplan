/**
 * Kalender-ISO (YYYY-MM-DD) ohne UTC-Verschiebung durch toISOString().
 * Wichtig für WHOOP-Trends (Kalorien/Schritte) und Tagesnavigation in DE.
 */

/** ISO-Datum aus lokalen Date-Komponenten (Browser = Nutzer-TZ). */
export function isoAusDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** ISO-Datum aus Unix-ms in lokaler Zeitzone. */
export function isoAusMs(ms: number): string {
  return isoAusDate(new Date(ms))
}

/** Heute als Kalendertag (Browser: Nutzer-TZ). */
export function heuteIsoKalender(): string {
  return isoAusDate(new Date())
}

/**
 * Heute in fester Zeitzone (Server, z. B. Europe/Berlin).
 * Fallback wenn der Client kein endDate mitschickt.
 */
export function heuteIsoInZeitzone(timeZone = defaultWhoopZeitzone()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const y = parts.find((p) => p.type === 'year')?.value
  const m = parts.find((p) => p.type === 'month')?.value
  const day = parts.find((p) => p.type === 'day')?.value
  if (!y || !m || !day) return heuteIsoKalender()
  return `${y}-${m}-${day}`
}

export function defaultWhoopZeitzone(): string {
  return process.env.WHOOP_TZ?.trim() || 'Europe/Berlin'
}

/** Kalendertag ± N Tage (mittags verankert, kein UTC-Drift). */
export function isoAddDaysKalender(iso: string, days: number): string {
  const d = new Date(iso + 'T12:00:00')
  d.setDate(d.getDate() + days)
  return isoAusDate(d)
}

/**
 * WHOOP-Trend: Punkte sind nach position_x sortiert, rechter Punkt = endDate.
 * Nicht data_scrubber_details parsen — Labels sind oft Zyklus-Start (= 1 Tag zu früh).
 */
export function trendTageAusEndDatum(
  punkte: { value: number; x: number }[],
  endDate: string,
): { date: string; value: number }[] {
  if (punkte.length === 0) return []
  const sorted = [...punkte].sort((a, b) => a.x - b.x)
  const end = new Date(endDate + 'T12:00:00')
  return sorted.map((r, i) => {
    const d = new Date(end)
    d.setDate(d.getDate() - (sorted.length - 1 - i))
    return { date: isoAusDate(d), value: r.value }
  })
}
