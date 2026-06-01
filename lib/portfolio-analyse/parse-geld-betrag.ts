/** Geldbetrag aus CSV/PDF-Text (deutsch oder englisch, mit Vorzeichen). */
export function parseGeldBetrag(raw: string | null | undefined): number | null {
  if (raw == null) return null
  let s = String(raw)
    .replace(/\u00a0|\u202f/g, ' ')
    .replace(/€|EUR|eur/gi, '')
    .trim()
  if (!s || s === '—' || s === '-' || s === '–') return null

  let negativ = false
  if (/^\(.*\)$/.test(s)) {
    negativ = true
    s = s.slice(1, -1).trim()
  }
  if (s.startsWith('-')) {
    negativ = true
    s = s.slice(1).trim()
  } else if (s.endsWith('-')) {
    negativ = true
    s = s.slice(0, -1).trim()
  }

  s = s.replace(/\s/g, '')
  if (!s) return null

  const lastComma = s.lastIndexOf(',')
  const lastDot = s.lastIndexOf('.')

  let normalized: string
  if (lastComma > lastDot) {
    normalized = s.replace(/\./g, '').replace(',', '.')
  } else if (lastDot > lastComma) {
    const nachKomma = s.length - lastDot - 1
    const dotCount = (s.match(/\./g) ?? []).length
    const commaCount = (s.match(/,/g) ?? []).length
    if (commaCount === 0 && dotCount === 1) {
      normalized = s
    } else if (nachKomma === 2) {
      normalized = s.replace(/,/g, '')
    } else {
      normalized = s.replace(/\./g, '').replace(',', '.')
    }
  } else {
    normalized = s.replace(/,/g, '.')
  }

  const v = Number.parseFloat(normalized)
  if (!Number.isFinite(v)) return null
  const betrag = negativ ? -Math.abs(v) : Math.abs(v)
  return betrag === 0 ? 0 : betrag
}

/** Positiver Betrag in EUR für Buchungen (Richtung kommt aus Spalte/Typ). */
export function positiverGeldbetrag(raw: string | null | undefined): number | null {
  const n = parseGeldBetrag(raw)
  if (n == null) return null
  return Math.abs(n)
}
