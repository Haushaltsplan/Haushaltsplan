import { NextResponse } from 'next/server'
import pdf from 'pdf-parse/lib/pdf-parse.js'
import { parseInvoiceImageMitVision } from '@/lib/parse-invoice-vision'

export const runtime = 'nodejs'

const MAX_IMAGE_BYTES = 12 * 1024 * 1024

function isPdfFile(file: File) {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
}

function isInvoiceImageFile(file: File) {
  const n = file.name.toLowerCase()
  if (file.type === 'image/jpeg' || n.endsWith('.jpg') || n.endsWith('.jpeg')) return true
  if (file.type === 'image/png' || n.endsWith('.png')) return true
  return false
}

function imageMimeForFile(file: File): 'image/jpeg' | 'image/png' | null {
  const n = file.name.toLowerCase()
  if (file.type === 'image/jpeg' || n.endsWith('.jpg') || n.endsWith('.jpeg')) return 'image/jpeg'
  if (file.type === 'image/png' || n.endsWith('.png')) return 'image/png'
  return null
}

function parseGermanAmount(raw: string) {
  const value = parseFlexibleAmount(raw)
  return Number.isFinite(value) ? value : null
}

function parseFlexibleAmount(raw: string) {
  const cleaned = raw.replace(/[^\d,.\-]/g, '').trim()
  if (!cleaned) return Number.NaN

  const lastComma = cleaned.lastIndexOf(',')
  const lastDot = cleaned.lastIndexOf('.')
  const decimalSeparator = lastComma > lastDot ? ',' : '.'

  let normalized = cleaned
  if (decimalSeparator === ',') {
    normalized = normalized.replace(/\./g, '').replace(',', '.')
  } else {
    normalized = normalized.replace(/,/g, '')
  }

  return Number.parseFloat(normalized)
}

function extractInvoiceAmount(text: string) {
  const normalized = text.replace(/\s+/g, ' ')
  const normalizedLines = text
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)

  const payableRegex = /(zu zahlen|zahlbetrag|endbetrag|rechnungsbetrag|betrag fällig|zu überweisen|zahlungsbetrag|gesamtbetrag inkl(?:\.|usive)? rabatt|final amount|amount due)/i
  const totalRegex = /(gesamt(?:betrag|summe)?|summe|total|invoice total)/i
  const grossRegex = /(brutto|zwischensumme|subtotal|netto)/i
  const discountRegex = /(rabatt|gutschein|skonto|nachlass|discount)/i
  const priorityPatterns = [
    /(?:gesamt(?:betrag|summe)?|rechnungsbetrag|zu zahlen|endbetrag|summe|brutto|zahlbetrag|betrag fällig|zu überweisen|total|invoice total)\s*[:\-]?\s*(?:eur|€)?\s*([\d\s.,]+(?:,\d{2}|\.\d{2}))/gi,
    /(?:eur|€)\s*([\d\s.,]+(?:,\d{2}|\.\d{2}))/gi,
    /([\d\s.,]+(?:,\d{2}|\.\d{2}))\s*(?:eur|€)/gi,
  ]

  let bestMatch: { amount: number; score: number; index: number } | null = null

  for (const [lineIndex, line] of normalizedLines.entries()) {
    const candidates = [...line.matchAll(/([\d\s.,]+(?:,\d{2}|\.\d{2}))/g)]
      .map((match) => parseGermanAmount(match[1]))
      .filter((value): value is number => value !== null)
      .filter((value) => value > 0)

    if (!candidates.length) continue

    if (discountRegex.test(line)) continue

    let score = 0
    if (payableRegex.test(line)) score += 100
    if (totalRegex.test(line)) score += 60
    if (grossRegex.test(line)) score += 20

    // Beträge am Ende der Rechnung sind oft der finale Zahlbetrag.
    score += Math.floor((lineIndex / Math.max(normalizedLines.length, 1)) * 10)

    const amount = candidates[candidates.length - 1]
    if (!bestMatch || score > bestMatch.score || (score === bestMatch.score && lineIndex > bestMatch.index)) {
      bestMatch = { amount, score, index: lineIndex }
    }
  }

  if (bestMatch && bestMatch.amount > 0) {
    return bestMatch.amount
  }

  for (const pattern of priorityPatterns) {
    const matches = [...normalized.matchAll(pattern)]
    if (!matches.length) continue

    const amounts = matches
      .map((match) => parseGermanAmount(match[1]))
      .filter((value): value is number => value !== null)
      .filter((value) => value > 0)

    if (amounts.length) return amounts[amounts.length - 1]
  }

  const fallbackAmounts = [...normalized.matchAll(/([\d\s.,]+(?:,\d{2}|\.\d{2}))/g)]
    .map((match) => parseGermanAmount(match[1]))
    .filter((value): value is number => value !== null)
    .filter((value) => value > 0 && value < 1000000)

  if (fallbackAmounts.length) return fallbackAmounts[fallbackAmounts.length - 1]

  return null
}

function extractVendorName(text: string) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .slice(0, 20)

  const blockedLineRegex = /(rechnung|invoice|kundennummer|customer|steuer|ust|mwst|vat|datum|date|liefer|zahl|summe|gesamt|brutto|netto|rabatt|tel\.?|phone|fax|www\.|http|@|iban|bic|swift|de\d{2}|seite\s+\d+|page\s+\d+\s+of\s+\d+|page\s+\d+\/\d+|p\.?\s*\d+\s*(?:\/|of|von)\s*\d+|bill to|ship to|invoice to|address|anschrift)/i
  const genericNameRegex = /^(company|firma|vendor|supplier|kunde|customer|name|business|unternehmen|store|shop)$/i
  const leadingGenericRegex = /^(company|firma|vendor|supplier|kunde|customer|name|business|unternehmen)\b/i
  const labelPrefixRegex = /^(company|firma|vendor|supplier|kunde|customer|name|business|unternehmen)\s*[:\-–—|]\s*/i
  const placeholderRegex = /\b(company|name|company name|your company|sample|example|demo|template|placeholder)\b/i

  function sanitizeCandidate(input: string) {
    let stripped = input.trim()
    stripped = stripped.replace(labelPrefixRegex, '').trim()
    stripped = stripped.replace(/^(company|firma|vendor|supplier|kunde|customer|name|business|unternehmen)\s*[:\-–—|]?\s*/i, '').trim()
    stripped = stripped.replace(/^[-–—|:.,\s]+/, '').trim()
    if (!stripped) return null
    if (genericNameRegex.test(stripped)) return null
    if (leadingGenericRegex.test(stripped)) {
      const remainder = stripped
        .replace(/^(company|firma|vendor|supplier|kunde|customer|name|business|unternehmen)\b\s*/i, '')
        .replace(/^[-–—|:.,\s]+/, '')
        .trim()
      if (!remainder || genericNameRegex.test(remainder)) return null
      return remainder
    }
    return stripped
  }

  for (const line of lines) {
    const candidate = sanitizeCandidate(line)
    if (!candidate) continue
    if (candidate.length < 2 || candidate.length > 60) continue
    if (placeholderRegex.test(candidate)) continue
    if (/\d{3,}/.test(line)) continue
    if (/^\d+$/.test(line)) continue
    if (/^(page|seite)\b/i.test(line)) continue
    if (/^\s*(page|seite)?\s*\d+\s*(?:\/|of|von)\s*\d+\s*$/i.test(line)) continue
    if (blockedLineRegex.test(line)) continue

    const looksLikeCompany = /(?:gmbh|ug|ag|kg|ohg|e\.k\.?|gbr|se|ltd|inc|llc|markt|apotheke|bäckerei|metzgerei|restaurant|cafe|café)/i.test(candidate)
    if (looksLikeCompany) return candidate
  }

  for (const line of lines) {
    const candidate = sanitizeCandidate(line)
    if (!candidate) continue
    if (candidate.length < 3 || candidate.length > 45) continue
    if (placeholderRegex.test(candidate)) continue
    if (blockedLineRegex.test(line)) continue
    if (/^\s*(page|seite)?\s*\d+\s*(?:\/|of|von)\s*\d+\s*$/i.test(line)) continue
    if (/\d/.test(candidate)) continue
    return candidate
  }

  return null
}

function normalizeDateParts(dayRaw: string, monthRaw: string, yearRaw: string) {
  const day = Number.parseInt(dayRaw, 10)
  const month = Number.parseInt(monthRaw, 10)
  let year = Number.parseInt(yearRaw, 10)

  if (!Number.isFinite(day) || !Number.isFinite(month) || !Number.isFinite(year)) return null
  if (yearRaw.length === 2) year += year >= 70 ? 1900 : 2000
  if (day < 1 || day > 31 || month < 1 || month > 12 || year < 2000 || year > 2100) return null

  const iso = `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`
  const testDate = new Date(`${iso}T00:00:00`)
  if (
    testDate.getFullYear() !== year ||
    testDate.getMonth() + 1 !== month ||
    testDate.getDate() !== day
  ) return null
  const display = `${day.toString().padStart(2, '0')}/${month.toString().padStart(2, '0')}/${year.toString().padStart(4, '0')}`
  return { iso, display }
}

function normalizeIsoDateParts(yearRaw: string, monthRaw: string, dayRaw: string) {
  return normalizeDateParts(dayRaw, monthRaw, yearRaw)
}

/** Punkt/Minus = typisch DE (TT.MM.JJJJ). Schrägstrich separat wegen US/EU. */
function findDatesInLine(line: string) {
  const results: Array<{ iso: string; display: string }> = []
  const dmyRegex = /(\d{1,2})[.-](\d{1,2})[.-](\d{2,4})/g
  const ymdRegex = /\b(\d{4})[./-](\d{1,2})[./-](\d{1,2})\b/g

  for (const match of line.matchAll(dmyRegex)) {
    const normalized = normalizeDateParts(match[1], match[2], match[3])
    if (normalized) results.push(normalized)
  }
  for (const match of line.matchAll(ymdRegex)) {
    const normalized = normalizeIsoDateParts(match[1], match[2], match[3])
    if (normalized) results.push(normalized)
  }

  return results
}

function addSlashDateCandidates(
  line: string,
  lineScore: number,
  add: (d: { iso: string; display: string } | null, score: number, hint: string) => void,
) {
  for (const m of line.matchAll(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g)) {
    const a = Number.parseInt(m[1], 10)
    const b = Number.parseInt(m[2], 10)
    const y = m[3]
    if (!Number.isFinite(a) || !Number.isFinite(b)) continue

    const asDmy = normalizeDateParts(String(a), String(b), y)
    const asMdy = normalizeDateParts(String(b), String(a), y)

    if (a > 12 && asDmy) {
      add(asDmy, lineScore + 70, 'TT/MM/JJJJ (eindeutig)')
      continue
    }
    if (b > 12 && asDmy) {
      add(asDmy, lineScore + 70, 'TT/MM/JJJJ (eindeutig)')
      continue
    }
    if (a > 12 && asMdy) {
      add(asMdy, lineScore + 70, 'MM/TT/JJJJ (eindeutig)')
      continue
    }
    if (b > 12 && asMdy) {
      add(asMdy, lineScore + 70, 'MM/TT/JJJJ (eindeutig)')
      continue
    }

    if (a <= 12 && b <= 12) {
      if (asDmy && asMdy && asDmy.iso !== asMdy.iso) {
        add(asDmy, lineScore + 45, 'TT/MM/JJJJ (EU)')
        add(asMdy, lineScore + 45, 'MM/TT/JJJJ (US)')
      } else if (asDmy) {
        add(asDmy, lineScore + 55, 'TT/MM/JJJJ')
      } else if (asMdy) {
        add(asMdy, lineScore + 55, 'MM/TT/JJJJ')
      }
    }
  }
}

const MONTH_NAME_TO_NUM: Record<string, number> = {
  januar: 1,
  january: 1,
  jan: 1,
  februar: 2,
  february: 2,
  feb: 2,
  märz: 3,
  maerz: 3,
  mar: 3,
  march: 3,
  april: 4,
  apr: 4,
  mai: 5,
  may: 5,
  juni: 6,
  jun: 6,
  june: 6,
  juli: 7,
  jul: 7,
  july: 7,
  august: 8,
  aug: 8,
  september: 9,
  sep: 9,
  sept: 9,
  oktober: 10,
  okt: 10,
  oct: 10,
  october: 10,
  november: 11,
  nov: 11,
  dezember: 12,
  dez: 12,
  dec: 12,
  december: 12,
}

function monthNumFromToken(token: string): number | null {
  const key = token.toLowerCase().replace(/\./g, '')
  return MONTH_NAME_TO_NUM[key] ?? null
}

/** z. B. „11. April 2026“, „11 April 2026“, „April 11, 2026“, „11. Apr. 26“ */
function findNamedMonthDatesInLine(line: string) {
  const results: Array<{ iso: string; display: string }> = []
  const monthPattern =
    'januar|january|jan|februar|february|feb|märz|maerz|mar|march|april|apr|mai|may|juni|jun|june|juli|jul|july|august|aug|september|sep|sept|oktober|okt|oct|october|november|nov|dezember|dez|dec|december'

  // DD. Month YYYY  oder  DD Month YYYY
  const dMonthY = new RegExp(
    `(\\d{1,2})\\.?\\s*(${monthPattern})\\.?\\s*(\\d{2,4})\\b`,
    'gi',
  )
  for (const m of line.matchAll(dMonthY)) {
    const day = m[1]
    const month = monthNumFromToken(m[2])
    const year = m[3]
    if (month) {
      const n = normalizeDateParts(day, String(month), year)
      if (n) results.push(n)
    }
  }

  // Month DD, YYYY  (englisch)
  const monthDdY = new RegExp(
    `\\b(${monthPattern})\\s+(\\d{1,2}),?\\s+(\\d{4})\\b`,
    'gi',
  )
  for (const m of line.matchAll(monthDdY)) {
    const month = monthNumFromToken(m[1])
    const day = m[2]
    const year = m[3]
    if (month) {
      const n = normalizeDateParts(day, String(month), year)
      if (n) results.push(n)
    }
  }

  return results
}

type InvoiceDateCandidate = { iso: string; display: string; score: number; hint: string }

function mergeDateCandidate(map: Map<string, InvoiceDateCandidate>, item: InvoiceDateCandidate) {
  const prev = map.get(item.iso)
  if (!prev || item.score > prev.score) map.set(item.iso, item)
}

/** Sammelt alle plausiblen Daten inkl. TT/MM vs MM/TT bei Schrägstrich — UI kann wählen. */
function collectInvoiceDateCandidates(text: string): InvoiceDateCandidate[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)

  const preferredStrongRegex =
    /(rechnungsdatum|invoice date|bill date|ausstellungsdatum|date of invoice)\b/i
  const preferredSoftRegex = /\bdatum\b/i
  const excludedRegex =
    /(lieferdatum|delivery|faellig|fällig|due date|leistungsdatum|service period|leistungszeitraum|vertragsbeginn|order date|bestelldatum|zahlbar bis|payment due)/i

  const map = new Map<string, InvoiceDateCandidate>()
  const add = (d: { iso: string; display: string } | null, score: number, hint: string) => {
    if (!d) return
    mergeDateCandidate(map, { iso: d.iso, display: d.display, score, hint })
  }

  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx]
    if (excludedRegex.test(line)) continue

    let lineScore = Math.max(0, 35 - idx)
    if (preferredStrongRegex.test(line)) lineScore += 260
    else if (preferredSoftRegex.test(line)) lineScore += 100

    for (let k = 1; k <= 5; k++) {
      const prev = lines[idx - k]
      if (prev && preferredStrongRegex.test(prev) && !excludedRegex.test(prev)) {
        lineScore += 200 - k * 28
      }
    }

    for (const d of findNamedMonthDatesInLine(line)) add(d, lineScore + 200, 'Monatsname')
    addSlashDateCandidates(line, lineScore + 65, add)
    for (const d of findDatesInLine(line)) add(d, lineScore + 70, 'TT.MM.JJJJ')
  }

  return [...map.values()].sort((a, b) => b.score - a.score)
}

function extractInvoiceDate(text: string) {
  const list = collectInvoiceDateCandidates(text)
  if (!list.length) return null
  return { iso: list[0].iso, display: list[0].display }
}

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get('content-type') || ''
    if (!contentType.includes('multipart/form-data')) {
      return NextResponse.json({ error: 'Ungültiger Upload-Typ. Bitte Datei-Upload verwenden.' }, { status: 400 })
    }

    const formData = await request.formData()
    const file = formData.get('file')

    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'Keine Datei empfangen.' }, { status: 400 })
    }

    if (!isPdfFile(file) && !isInvoiceImageFile(file)) {
      return NextResponse.json({ error: 'Bitte eine PDF-, PNG- oder JPEG-Datei hochladen.' }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    if (isPdfFile(file)) {
      const result = await pdf(buffer)
      const text = (result.text || '').trim()

      if (!text) {
        return NextResponse.json({ error: 'PDF enthält keinen auslesbaren Text.' }, { status: 422 })
      }

      const amount = extractInvoiceAmount(text)
      if (!amount) {
        return NextResponse.json({ error: 'Keinen Rechnungsbetrag gefunden.' }, { status: 422 })
      }

      const vendor = extractVendorName(text)
      const invoiceDate = extractInvoiceDate(text)
      const invoiceDateCandidates = collectInvoiceDateCandidates(text)
        .slice(0, 12)
        .map(({ iso, display, hint }) => ({ iso, display, hint }))
      return NextResponse.json({ amount, vendor, invoiceDate, invoiceDateCandidates })
    }

    if (buffer.byteLength > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: 'Bild ist zu groß (max. ca. 12 MB).' }, { status: 400 })
    }

    const mime = imageMimeForFile(file)
    if (!mime) {
      return NextResponse.json({ error: 'Nur PNG- oder JPEG-Bilder werden unterstützt.' }, { status: 400 })
    }

    const vision = await parseInvoiceImageMitVision(buffer, mime)
    if (!vision.ok) {
      return NextResponse.json({ error: vision.error }, { status: vision.status })
    }

    return NextResponse.json({
      amount: vision.amount,
      vendor: vision.vendor,
      invoiceDate: vision.invoiceDate,
      invoiceDateCandidates: vision.invoiceDateCandidates,
    })
  } catch (error) {
    console.error('Invoice parsing failed:', error)
    return NextResponse.json({ error: 'Beleg konnte nicht gelesen werden.' }, { status: 500 })
  }
}
