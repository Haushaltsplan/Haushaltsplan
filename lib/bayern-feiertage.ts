/**
 * Gesetzliche Feiertage in **Bayern** (ohne Alemannische Fastnacht, lokale Wahltermine, …)
 * inkl. beweglicher Feier- und Ostertage. Namen passend zu typischen Kalender-Apps.
 *
 * Quelle u. a.: Feiertage nach BayFTG, bundesweite Feiertage (AG FeiertG).
 * Mariä Himmelfahrt 15.8. = gesetzlich in ganz Bayern.
 */

function isoLokal(d: Date): string {
  const y = d.getFullYear()
  const m = d.getMonth() + 1
  const t = d.getDate()
  return `${y}-${String(m).padStart(2, '0')}-${String(t).padStart(2, '0')}`
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d.getTime())
  x.setDate(x.getDate() + n)
  return x
}

/** Oster**sonn**tag; Algorithmus: Anonymous Gregorian (Meeus) */
function osterDatum(jahr: number): { monat: number; tag: number } {
  const a = jahr % 19
  const b = Math.floor(jahr / 100)
  const c = jahr % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const monat = Math.floor((h + l - 7 * m + 114) / 31)
  const tag = ((h + l - 7 * m + 114) % 31) + 1
  return { monat, tag }
}

function ostersonntagDate(jahr: number): Date {
  const { monat, tag } = osterDatum(jahr)
  return new Date(jahr, monat - 1, tag, 12, 0, 0)
}

export type BayernFeiertagZeile = { datum: string; name: string }

/**
 * Alle bayerischen gesetzlichen Feiertage in einem Jahr, als ISO-YYYY-MM-DD + Name.
 * Sortiert nach Datum.
 */
export function bayernFeiertageFuerJahr(jahr: number): BayernFeiertagZeile[] {
  if (!Number.isFinite(jahr) || jahr < 1990 || jahr > 2100) return []

  const ost = ostersonntagDate(jahr)

  const tage: BayernFeiertagZeile[] = [
    { datum: `${jahr}-01-01`, name: 'Neujahr' },
    { datum: `${jahr}-01-06`, name: 'Heilige Drei Könige' },
    { datum: isoLokal(addDays(ost, -2)), name: 'Karfreitag' },
    { datum: isoLokal(addDays(ost, 1)), name: 'Ostermontag' },
    { datum: `${jahr}-05-01`, name: 'Tag der Arbeit' },
    { datum: isoLokal(addDays(ost, 39)), name: 'Christi Himmelfahrt' },
    { datum: isoLokal(addDays(ost, 50)), name: 'Pfingstmontag' },
    { datum: isoLokal(addDays(ost, 60)), name: 'Fronleichnam' },
    { datum: `${jahr}-08-15`, name: 'Mariä Himmelfahrt' },
    { datum: `${jahr}-10-03`, name: 'Tag der deutschen Einheit' },
    { datum: `${jahr}-11-01`, name: 'Allerheiligen' },
    { datum: `${jahr}-12-25`, name: '1. Weihnachtsfeiertag' },
    { datum: `${jahr}-12-26`, name: '2. Weihnachtsfeiertag' },
  ]

  tage.sort((a, b) => a.datum.localeCompare(b.datum))
  return tage
}
