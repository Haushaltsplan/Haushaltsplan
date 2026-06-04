import { tageZwischenIso } from '@/lib/portfolio-analyse/dividenden-datum-hilfen'

/** Wann Quartalszahlen typischerweise veröffentlicht werden (BMO/AMC). */
export type Berichtszeit = 'vor_boersenoeffnung' | 'nach_handelsschluss'

export type BerichtszeitKalenderEintrag = {
  terminDatumIso: string
  berichtszeit: Berichtszeit | null
}

/** Berichtszeit aus Finnhub-Kalender zum gewählten Termin (±1 Tag Toleranz). */
export function berichtszeitAusKalenderListe(
  termine: BerichtszeitKalenderEintrag[],
  terminDatumIso: string,
): Berichtszeit | null {
  const mitZeit = termine.filter((t) => t.berichtszeit)
  if (mitZeit.length === 0) return null

  const exakt = mitZeit.find((t) => t.terminDatumIso === terminDatumIso)
  if (exakt?.berichtszeit) return exakt.berichtszeit

  let best: { t: BerichtszeitKalenderEintrag; diff: number } | null = null
  for (const t of mitZeit) {
    const diff = Math.abs(tageZwischenIso(terminDatumIso, t.terminDatumIso))
    if (diff > 1) continue
    if (!best || diff < best.diff) best = { t, diff }
  }
  return best?.t.berichtszeit ?? null
}

/** US-Earnings-Zeitstempel von Yahoo (America/New_York). */
export function berichtszeitAusYahooUnix(rawSec: number | null | undefined): Berichtszeit | null {
  if (rawSec == null || !Number.isFinite(rawSec) || rawSec <= 0) return null
  const d = new Date(rawSec * 1000)
  if (d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0) return null

  const hourEt = Number(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      hour: 'numeric',
      hour12: false,
    }).format(d),
  )
  if (!Number.isFinite(hourEt)) return null
  if (hourEt <= 9) return 'vor_boersenoeffnung'
  if (hourEt >= 16) return 'nach_handelsschluss'
  return null
}

export function berichtszeitAusFinnhubHour(hour: string | undefined | null): Berichtszeit | null {
  const h = hour?.trim().toLowerCase()
  if (h === 'bmo') return 'vor_boersenoeffnung'
  if (h === 'amc') return 'nach_handelsschluss'
  return null
}

export function berichtszeitLabel(zeit: Berichtszeit | null | undefined): string | null {
  if (zeit === 'vor_boersenoeffnung') return 'Vor Börsenöffnung'
  if (zeit === 'nach_handelsschluss') return 'Nach Handelsschluss'
  return null
}

export function berichtszeitKurz(zeit: Berichtszeit | null | undefined): string | null {
  if (zeit === 'vor_boersenoeffnung') return 'Vor Börse'
  if (zeit === 'nach_handelsschluss') return 'Nach Schluss'
  return null
}

export function berichtszeitBadgeTitel(zeit: Berichtszeit | null | undefined): string {
  if (zeit === 'vor_boersenoeffnung') return 'Before Market Open — vor Börsenöffnung'
  if (zeit === 'nach_handelsschluss') return 'After Market Close — nach Handelsschluss'
  return 'Berichtszeit noch nicht veröffentlicht'
}
