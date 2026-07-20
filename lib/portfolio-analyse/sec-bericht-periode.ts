/** Berichtsperiode aus SEC-Ergebnisbericht / Earnings-Release (ticker-agnostisch). */

export type Berichtsperiode = {
  label: string
  /** Dedup gegen 10-Q/10-K über Periodenende: `pe:2026-03-31` oder Fallback `2026-Q2` / `2026-FY` */
  periodenKey: string
  berichtszeitraum: string | null
}

const MONAT: Record<string, number> = {
  january: 1,
  jan: 1,
  february: 2,
  feb: 2,
  march: 3,
  mar: 3,
  april: 4,
  apr: 4,
  may: 5,
  june: 6,
  jun: 6,
  july: 7,
  jul: 7,
  august: 8,
  aug: 8,
  september: 9,
  sep: 9,
  sept: 9,
  october: 10,
  oct: 10,
  november: 11,
  nov: 11,
  december: 12,
  dec: 12,
}

const Q_WORD: Record<string, 1 | 2 | 3 | 4> = {
  first: 1,
  '1st': 1,
  second: 2,
  '2nd': 2,
  third: 3,
  '3rd': 3,
  fourth: 4,
  '4th': 4,
}

function jahrAusZweistellig(y: string): number {
  const n = Number.parseInt(y, 10)
  if (n >= 100) return n
  return n >= 70 ? 1900 + n : 2000 + n
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

function letzterTag(jahr: number, monat: number): number {
  return new Date(Date.UTC(jahr, monat, 0)).getUTCDate()
}

function isoDatum(jahr: number, monat: number, tag?: number): string {
  const t = tag ?? letzterTag(jahr, monat)
  return `${jahr}-${pad2(monat)}-${pad2(Math.min(t, letzterTag(jahr, monat)))}`
}

function quartalAusMonat(monat: number): 1 | 2 | 3 | 4 {
  return (monat <= 3 ? 1 : monat <= 6 ? 2 : monat <= 9 ? 3 : 4) as 1 | 2 | 3 | 4
}

/** Wie 10-Q-Labels: Kalenderquartal aus Periodenende. */
export function periodeAusEnde(endeIso: string, alsFy = false): Berichtsperiode {
  const jahr = Number(endeIso.slice(0, 4))
  const monat = Number(endeIso.slice(5, 7))
  if (alsFy) {
    return {
      label: `Jahresbericht ${jahr}`,
      periodenKey: `pe:${endeIso}`,
      berichtszeitraum: endeIso,
    }
  }
  const q = quartalAusMonat(monat)
  return {
    label: `Q${q} ${jahr}`,
    periodenKey: `pe:${endeIso}`,
    berichtszeitraum: endeIso,
  }
}

/** Alle Dedup-Keys einer Periode (pe: + optional YYYY-FY). */
export function periodenDedupKeys(periode: Berichtsperiode): string[] {
  const keys = [periode.periodenKey]
  if (periode.periodenKey.endsWith('-FY')) {
    /* already */
  } else if (periode.label.startsWith('Jahresbericht') && periode.berichtszeitraum) {
    keys.push(`${periode.berichtszeitraum.slice(0, 4)}-FY`)
  } else if (periode.periodenKey.startsWith('pe:') && periode.label.startsWith('Jahresbericht')) {
    keys.push(`${periode.periodenKey.slice(3, 7)}-FY`)
  }
  return [...new Set(keys)]
}

function parseMonatsname(raw: string): number | null {
  return MONAT[raw.toLowerCase().replace(/\./g, '')] ?? null
}

function headlineSlice(text: string): string {
  return text.slice(0, 600)
}

/**
 * Erkennt Periode aus Pressetext.
 * Primär: Periodenende-Datum (align mit 10-Q reportDate).
 * FY nur bei klarem Full-Year/Year-End-Kontext.
 */
export function parseBerichtsperiodeAusText(roh: string): Berichtsperiode | null {
  const text = roh.replace(/\s+/g, ' ').trim()
  if (!text) return null
  const head = headlineSlice(text)

  const hatQuartalHeadline =
    /\b(first|second|third|fourth|1st|2nd|3rd|4th)\s+quarter\b/i.test(head) || /\bq\s*[1-4]\b/i.test(head)
  const hatFyHeadline =
    /\b(?:fourth|4th)\s+quarter\s+and\s+(?:full\s+year|year-?end)\b/i.test(head) ||
    /\b(?:full\s+year|annual)\s+results?\b/i.test(head) ||
    /\bfiscal\s+(?:year\s+)?(20\d{2}|\d{2})\s+(?:fourth|4th)\s+quarter\s+and\s+full\s+year\b/i.test(head)

  // Full-Year zuerst (sonst greift „year ended …“ als normales Quartals-Periodenende)
  if (hatFyHeadline) {
    const fyEnded = text.match(
      /\b(?:full\s+year|fiscal\s+year|year)\s+ended\s+([A-Za-z]+)\.?\s+(\d{1,2}),?\s+(20\d{2})\b/i,
    )
    if (fyEnded) {
      const monat = parseMonatsname(fyEnded[1]!)
      const jahr = Number(fyEnded[3])
      if (monat) return periodeAusEnde(isoDatum(jahr, monat, Number(fyEnded[2])), true)
    }
    const y =
      text.match(/\bfiscal\s+(?:year\s+)?(20\d{2}|\d{2})\b/i) ||
      head.match(/\b(20\d{2})\b/) ||
      text.match(/\b(20\d{2})\b/)
    if (y) {
      const jahr = jahrAusZweistellig(y[1]!)
      return {
        label: `Jahresbericht ${jahr}`,
        periodenKey: `${jahr}-FY`,
        berichtszeitraum: `${jahr}-12-31`,
      }
    }
  }

  // Periodenende: „three months ended March 31, 2026“ / „quarter ended …“
  const ended = text.match(
    /\b(?:(?:three|3|six|6|nine|9)\s+months?|quarter)\s+ended\s+([A-Za-z]+)\.?\s+(\d{1,2}),?\s+(20\d{2})\b/i,
  )
  if (ended) {
    const monat = parseMonatsname(ended[1]!)
    const jahr = Number(ended[3])
    const tag = Number(ended[2])
    if (monat) return periodeAusEnde(isoDatum(jahr, monat, tag), false)
  }

  const endedNum = text.match(
    /\b(?:(?:three|3|six|6|nine|9)\s+months?|quarter)\s+ended\s+(\d{1,2})[\/\-.](\d{1,2})[\/\-.](20\d{2})\b/i,
  )
  if (endedNum) {
    const a = Number(endedNum[1])
    const b = Number(endedNum[2])
    const jahr = Number(endedNum[3])
    const monat = a > 12 ? b : a
    const tag = a > 12 ? a : b
    if (monat >= 1 && monat <= 12) return periodeAusEnde(isoDatum(jahr, monat, tag), false)
  }

  // Explizites Quartal in Headline (ohne Periodenende oben)
  const qWord = head.match(
    /\b(first|second|third|fourth|1st|2nd|3rd|4th)\s+quarter\s+(?:of\s+)?(?:fy|fiscal(?:\s+year)?)?\s*['']?(20\d{2}|\d{2})\b/i,
  )
  if (qWord && !hatFyHeadline) {
    const q = Q_WORD[qWord[1]!.toLowerCase()]
    const jahr = jahrAusZweistellig(qWord[2]!)
    if (q) {
      return {
        label: `Q${q} ${jahr}`,
        periodenKey: `${jahr}-Q${q}`,
        berichtszeitraum: null,
      }
    }
  }

  const qNum = head.match(/\bq\s*([1-4])\s*(?:fy|fiscal)?\s*['']?(20\d{2}|\d{2})\b/i)
  if (qNum && !hatFyHeadline) {
    const q = Number(qNum[1]) as 1 | 2 | 3 | 4
    const jahr = jahrAusZweistellig(qNum[2]!)
    return { label: `Q${q} ${jahr}`, periodenKey: `${jahr}-Q${q}`, berichtszeitraum: null }
  }

  // Fallback: year ended ohne FY-Headline (selten)
  if (!hatQuartalHeadline) {
    const fyEnded = text.match(
      /\b(?:full\s+year|fiscal\s+year)\s+(?:results?\s+)?ended\s+([A-Za-z]+)\.?\s+(\d{1,2}),?\s+(20\d{2})\b/i,
    )
    if (fyEnded) {
      const monat = parseMonatsname(fyEnded[1]!)
      const jahr = Number(fyEnded[3])
      if (monat) return periodeAusEnde(isoDatum(jahr, monat, Number(fyEnded[2])), true)
    }
  }

  return null
}

/** Dateiname: zuerst Periodenende (YYYYMMDD), dann Q-Muster. */
export function parseBerichtsperiodeAusDateiname(dokumentName: string): Berichtsperiode | null {
  const name = dokumentName.replace(/\.html?$/i, '')

  // 20260331 / 2026-03-31 / x03312026 / 03312026
  const mIso = name.match(/(?<![0-9])(20\d{2})([01]\d)([0-3]\d)(?![0-9])/)
  if (mIso) {
    const jahr = Number(mIso[1])
    const monat = Number(mIso[2])
    const tag = Number(mIso[3])
    if (monat >= 1 && monat <= 12 && tag >= 1 && tag <= 31) {
      return periodeAusEnde(isoDatum(jahr, monat, tag))
    }
  }
  const mIsoUs = name.match(/(?<![0-9])([01]\d)([0-3]\d)(20\d{2})(?![0-9])/)
  if (mIsoUs) {
    const monat = Number(mIsoUs[1])
    const tag = Number(mIsoUs[2])
    const jahr = Number(mIsoUs[3])
    if (monat >= 1 && monat <= 12 && tag >= 1 && tag <= 31) {
      return periodeAusEnde(isoDatum(jahr, monat, tag))
    }
  }

  // ex99YYYY-MxDD
  const mMd = name.match(/ex-?99.?(\d{4}).{0,10}(\d{1,2})\s*[x\/._-]\s*(\d{1,2})(?!\d)/i)
  if (mMd) {
    const jahr = Number(mMd[1])
    const monat = Number(mMd[2])
    const tag = Number(mMd[3])
    if (monat >= 1 && monat <= 12) return periodeAusEnde(isoDatum(jahr, monat, tag))
  }

  const mQn = name.match(/(?<![0-9])q([1-4])(?:fy)?(20\d{2}|\d{2})(?!\d)/i)
  if (mQn) {
    const q = Number(mQn[1]) as 1 | 2 | 3 | 4
    const jahr = jahrAusZweistellig(mQn[2]!)
    return { label: `Q${q} ${jahr}`, periodenKey: `${jahr}-Q${q}`, berichtszeitraum: null }
  }

  const mNq = name.match(/(?<![0-9])([1-4])q(?:fy)?(20\d{2}|\d{2})(?!\d)/i)
  if (mNq) {
    const q = Number(mNq[1]) as 1 | 2 | 3 | 4
    const jahr = jahrAusZweistellig(mNq[2]!)
    return { label: `Q${q} ${jahr}`, periodenKey: `${jahr}-Q${q}`, berichtszeitraum: null }
  }

  return null
}

/** Perioden-Key für 10-Q/10-K (reportDate). */
export function periodenKeyAusReportDate(
  formular: '10-Q' | '10-K',
  reportDate: string | null,
): string | null {
  if (!reportDate || reportDate.length < 10) return null
  return `pe:${reportDate.slice(0, 10)}`
}

export function labelAusReportDate(formular: '10-Q' | '10-K', reportDate: string | null): string {
  if (!reportDate || reportDate.length < 7) {
    return formular === '10-K' ? 'Jahresbericht' : 'Quartalsbericht'
  }
  const p = periodeAusEnde(reportDate.slice(0, 10), formular === '10-K')
  return p.label
}
