/** Wann Quartalszahlen typischerweise veröffentlicht werden (BMO/AMC). */
export type Berichtszeit = 'vor_boersenoeffnung' | 'nach_handelsschluss'

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
  if (zeit === 'vor_boersenoeffnung') return 'vor Börse'
  if (zeit === 'nach_handelsschluss') return 'nach Schluss'
  return null
}
