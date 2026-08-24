import { parseDeDatumZuIso, parseEuropeanNumber } from '@/lib/portfolio-analyse/parse-hilfen'

export type TrRawCashZeile = {
  datum: string
  typ: string
  beschreibung: string
  zahlungseingang: string
  zahlungsausgang: string
  saldo: string
  /** Nur CSV (TR Transaktionsexport): ISIN steht oft in Spalte „symbol“. */
  isin?: string
  /** Nur CSV: Stückzahl für Kurs-Schätzung. */
  stueck?: number | null
  /** Nur CSV (z. B. Parqet): Ausführungskurs pro Stück — für realisierte Gewinne. */
  kursEur?: number | null
  /** Nur Parqet-Portfolio-CSV: Spalte realizedgains (FIFO laut Parqet). */
  realisierterGewinnEur?: number | null
  /** Nur CSV: Steuer laut Spalte „tax“ / „Steuern“. */
  steuerEur?: number | null
}

export type TrRawPosition = {
  quantity: number | null
  name: string
  isin: string
  pricePerUnit: number | null
  marketValueEUR: number | null
}

export type TrPdfParseErgebnis = {
  cash: TrRawCashZeile[]
  portfolio: TrRawPosition[]
  crypto: TrRawPosition[]
}

type PdfTextItem = { text: string; x: number; y: number; width: number; height: number }

type ColumnRange = { start: number; end: number }

type CashColumnBoundaries = {
  datum: ColumnRange
  typ: ColumnRange
  beschreibung: ColumnRange
  zahlungseingang: ColumnRange
  zahlungsausgang: ColumnRange
  saldo: ColumnRange
  headerY: number
}

type PortfolioColumnBoundaries = {
  quantity: ColumnRange
  security: ColumnRange
  price: ColumnRange
  value: ColumnRange
  headerY: number
}

const FOOTER_BOTTOM_BAND = 120

function groupItemsIntoLines(items: PdfTextItem[], eps = 2) {
  const rows = new Map<number, PdfTextItem[]>()
  for (const it of items) {
    const y = Math.round(it.y / eps) * eps
    if (!rows.has(y)) rows.set(y, [])
    rows.get(y)!.push(it)
  }
  return [...rows.keys()]
    .sort((a, b) => b - a)
    .map((y) => {
      const row = rows.get(y)!.sort((a, b) => a.x - b.x)
      return { y, items: row, text: row.map((r) => r.text).join(' ').trim() }
    })
}

function findCashHeaders(items: PdfTextItem[]) {
  const headerKeywords = [
    'DATUM', 'TYP', 'BESCHREIBUNG', 'ZAHLUNGSEINGANG', 'ZAHLUNGSAUSGANG', 'SALDO',
    'DATE', 'TYPE', 'DESCRIPTION', 'MONEY', 'BALANCE',
  ]
  const potentialHeaders = items.filter(
    (item) =>
      item.text.trim().length > 2 &&
      item.text.trim() === item.text.trim().toUpperCase() &&
      headerKeywords.some((kw) => item.text.includes(kw)),
  )
  const matchAny = (labels: string[]) =>
    potentialHeaders.find((p) => labels.includes(p.text.trim())) ?? null

  const headers = {
    DATUM: matchAny(['DATUM', 'DATE']),
    TYP: matchAny(['TYP', 'TYPE']),
    BESCHREIBUNG: matchAny(['BESCHREIBUNG', 'DESCRIPTION']),
    ZAHLUNGEN: potentialHeaders.find((p) => {
      const t = p.text.trim()
      return (t.includes('ZAHLUNGSEINGANG') && t.includes('ZAHLUNGSAUSGANG')) ||
        (t.includes('MONEY IN') && t.includes('MONEY OUT'))
    }) ?? null,
    ZAHLUNGSEINGANG: matchAny(['ZAHLUNGSEINGANG']) as PdfTextItem | null,
    ZAHLUNGSAUSGANG: matchAny(['ZAHLUNGSAUSGANG']) as PdfTextItem | null,
    SALDO: matchAny(['SALDO', 'BALANCE']),
  }

  if (!headers.DATUM || !headers.TYP || !headers.BESCHREIBUNG || !headers.SALDO) return null
  if (!headers.ZAHLUNGEN && (!headers.ZAHLUNGSEINGANG || !headers.ZAHLUNGSAUSGANG)) return null
  return headers
}

function calculateCashColumnBoundaries(headers: NonNullable<ReturnType<typeof findCashHeaders>>): CashColumnBoundaries {
  let zahlungseingangEnd: number
  let zahlungsausgangStart: number
  let paymentsStart: number

  if (headers.ZAHLUNGEN) {
    const mid = headers.ZAHLUNGEN.x + headers.ZAHLUNGEN.width / 2
    zahlungseingangEnd = mid
    zahlungsausgangStart = mid
    paymentsStart = headers.ZAHLUNGEN.x - 5
  } else {
    zahlungseingangEnd = headers.ZAHLUNGSAUSGANG!.x - 5
    zahlungsausgangStart = headers.ZAHLUNGSAUSGANG!.x - 5
    paymentsStart = headers.ZAHLUNGSEINGANG!.x - 5
  }

  return {
    datum: { start: 0, end: headers.TYP!.x - 5 },
    typ: { start: headers.TYP!.x - 5, end: headers.BESCHREIBUNG!.x - 5 },
    beschreibung: { start: headers.BESCHREIBUNG!.x - 5, end: paymentsStart },
    zahlungseingang: { start: paymentsStart, end: zahlungseingangEnd },
    zahlungsausgang: { start: zahlungsausgangStart, end: headers.SALDO!.x - 5 },
    saldo: { start: headers.SALDO!.x - 5, end: Infinity },
    headerY: headers.DATUM!.y,
  }
}

function extractCashTransactions(items: PdfTextItem[], boundaries: CashColumnBoundaries): TrRawCashZeile[] {
  const contentItems = items.filter((item) => item.y < boundaries.headerY - 5 && item.text.trim() !== '')
  if (contentItems.length === 0) return []

  contentItems.sort((a, b) => b.y - a.y || a.x - b.x)
  const rows: PdfTextItem[][] = []
  const avgHeight = contentItems.reduce((s, i) => s + i.height, 0) / contentItems.length || 10
  const gapThreshold = avgHeight * 1.5
  let currentRow: PdfTextItem[] = [contentItems[0]]
  for (let i = 1; i < contentItems.length; i++) {
    if (contentItems[i - 1].y - contentItems[i].y > gapThreshold) {
      rows.push(currentRow)
      currentRow = []
    }
    currentRow.push(contentItems[i])
  }
  rows.push(currentRow)

  const transactions: TrRawCashZeile[] = []
  for (const rowItems of rows) {
    const transaction: TrRawCashZeile = {
      datum: '',
      typ: '',
      beschreibung: '',
      zahlungseingang: '',
      zahlungsausgang: '',
      saldo: '',
    }
    const financialItems: PdfTextItem[] = []
    for (const item of rowItems) {
      if (item.x < boundaries.datum.end) transaction.datum += ' ' + item.text
      else if (item.x < boundaries.typ.end) transaction.typ += ' ' + item.text
      else if (item.x < boundaries.beschreibung.end) transaction.beschreibung += ' ' + item.text
      else financialItems.push(item)
    }
    financialItems.sort((a, b) => a.x - b.x)
    if (financialItems.length > 0) transaction.saldo = financialItems.pop()!.text
    for (const item of financialItems) {
      if (item.x < boundaries.zahlungseingang.end) transaction.zahlungseingang += ' ' + item.text
      else if (item.x < boundaries.zahlungsausgang.end) transaction.zahlungsausgang += ' ' + item.text
    }
    const textKeys = ['datum', 'typ', 'beschreibung', 'zahlungseingang', 'zahlungsausgang', 'saldo'] as const
    for (const key of textKeys) {
      transaction[key] = transaction[key].trim().replace(/\s+/g, ' ')
    }
    if (textKeys.some((k) => transaction[k] !== '')) transactions.push(transaction)
  }
  return transactions
}

function findPortfolioHeaders(items: PdfTextItem[]) {
  const headerKeywords = ['STK.', 'NOMINALE', 'WERTPAPIERBEZEICHNUNG', 'KURS PRO STÜCK', 'KURSWERT IN EUR', 'QUANTITY', 'MARKET VALUE']
  const potentialHeaders = items.filter(
    (item) =>
      item.text.trim().length > 2 &&
      item.text.trim() === item.text.trim().toUpperCase() &&
      headerKeywords.some((kw) => item.text.includes(kw)),
  )
  const matchAny = (labels: string[]) =>
    potentialHeaders.find((p) => labels.some((l) => p.text.trim().includes(l))) ?? null

  const headers = {
    QUANTITY: matchAny(['STK.', 'NOMINALE', 'QUANTITY']),
    SECURITY: matchAny(['WERTPAPIERBEZEICHNUNG', 'SECURITY DESCRIPTION', 'SECURITY']),
    PRICE: matchAny(['KURS PRO STÜCK', 'PRICE PER UNIT', 'PRICE']),
    VALUE: matchAny(['KURSWERT IN EUR', 'MARKET VALUE', 'VALUE']),
  }
  if (!headers.QUANTITY || !headers.SECURITY || !headers.PRICE || !headers.VALUE) return null
  return headers
}

function calculatePortfolioColumnBoundaries(headers: NonNullable<ReturnType<typeof findPortfolioHeaders>>): PortfolioColumnBoundaries {
  return {
    quantity: { start: 0, end: headers.SECURITY!.x - 5 },
    security: { start: headers.SECURITY!.x - 5, end: headers.PRICE!.x - 5 },
    price: { start: headers.PRICE!.x - 5, end: headers.VALUE!.x - 5 },
    value: { start: headers.VALUE!.x - 5, end: Infinity },
    headerY: headers.QUANTITY!.y,
  }
}

function extractPortfolioPositions(items: PdfTextItem[], boundaries: PortfolioColumnBoundaries): TrRawPosition[] {
  const contentItems = items.filter((item) => item.y < boundaries.headerY - 5 && item.text.trim() !== '')
  if (contentItems.length === 0) return []

  const lines = groupItemsIntoLines(contentItems, 2)
  const positions: TrRawPosition[] = []
  let current: TrRawPosition | null = null

  const QTY_LINE = /^\s*([\d.]+,\d{2,6}|\d+([.,]\d+)?)\s*(Stk\.?|Nominale)\b/i
  const ISIN_PATTERN = /\bISIN:\s*([A-Z]{2}[A-Z0-9]{10})\b/
  const SKIP_PATTERNS = /(POSITIONEN|STK\.?\s*\/\s*NOMINALE|KURS PRO ST|KURSWERT IN EUR|DEPOTAUSZUG|SEITE|ANZAHL POSITIONEN)/i
  const SKIP_NAME = /(Wertpapierrechnung)/i

  for (const line of lines) {
    const text = line.text
    if (SKIP_PATTERNS.test(text)) continue

    const qtyMatch = QTY_LINE.exec(text)
    if (qtyMatch) {
      if (current && current.quantity != null) positions.push(current)
      current = {
        quantity: parseEuropeanNumber(qtyMatch[1]),
        name: '',
        isin: '',
        pricePerUnit: null,
        marketValueEUR: null,
      }
      const rightItems = line.items.filter((i) => i.x >= boundaries.price.start)
      for (const item of rightItems.sort((a, b) => a.x - b.x)) {
        const num = parseEuropeanNumber(item.text)
        if (num == null) continue
        if (item.x < boundaries.value.start && current.pricePerUnit == null) current.pricePerUnit = num
        else if (item.x >= boundaries.value.start && current.marketValueEUR == null) current.marketValueEUR = num
      }
      const nameItems = line.items.filter((i) => i.x < boundaries.price.start && !QTY_LINE.test(i.text.trim()))
      if (nameItems.length) {
        const nm = nameItems.map((i) => i.text).join(' ').trim()
        if (nm && !SKIP_NAME.test(nm)) current.name = nm
      }
      continue
    }

    if (!current) continue
    if (SKIP_NAME.test(text)) continue

    const isinMatch = ISIN_PATTERN.exec(text)
    if (isinMatch) {
      current.isin = isinMatch[1]
      continue
    }

    const rightItems = line.items.filter((i) => i.x >= boundaries.price.start)
    if (rightItems.length) {
      for (const item of rightItems.sort((a, b) => a.x - b.x)) {
        const num = parseEuropeanNumber(item.text)
        if (num == null) continue
        if (item.x < boundaries.value.start && current.pricePerUnit == null) current.pricePerUnit = num
        else if (item.x >= boundaries.value.start && current.marketValueEUR == null) current.marketValueEUR = num
      }
      continue
    }

    if (!current.isin && text.trim().length > 0) {
      current.name = current.name ? `${current.name} ${text.trim()}` : text.trim()
    }
  }

  if (current && current.quantity != null) positions.push(current)

  return positions.map((pos) => ({
    quantity: pos.quantity,
    name: pos.name.trim(),
    isin: pos.isin,
    pricePerUnit: pos.pricePerUnit,
    marketValueEUR: pos.marketValueEUR ?? (pos.quantity != null && pos.pricePerUnit != null ? pos.quantity * pos.pricePerUnit : null),
  }))
}

function formatEuroBetrag(n: number): string {
  return n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/**
 * Parst einen Betrag der entweder US-Notation (3.91) oder DE-Notation (3,91) haben kann.
 * Dividenden-PDFs von Trade Republic nutzen US-Notation fuer USD/EUR-Betraege auf Seite 1.
 */
function parseFlexiblerBetrag(raw: string): number | null {
  const s = raw.replace(/\s/g, '').trim()
  if (!s) return null
  if (s.includes(',')) return parseEuropeanNumber(s)
  const n = parseFloat(s)
  return isFinite(n) ? n : null
}

/**
 * Einzel-PDF „Dividendenabrechnung“ (Trade Republic).
 * Erwartet den kombinierten Text ALLER Seiten (damit Steuern von Seite 2 einbezogen werden).
 */
function parseDividendenAbrechnung(alleTexte: string[]): TrRawCashZeile[] {
  const joined = alleTexte.join('\n')

  if (!/\bDIVIDENDE\b/i.test(joined)) return []
  if (/WERTPAPIERABRECHNUNG/i.test(joined)) return []

  // Arbeite direkt auf dem ÜBERSICHT-Block des joined-Textes.
  // pdfjs-dist splittet Tabellenzeilen oft auf verschiedene Y-Koordinaten auf,
  // daher ist Zeilenindex-Navigation in alleTexte unzuverlässig.
  const uebersichtStart = joined.search(/ÜBERSICHT|OVERVIEW/i)
  const abrechnungStart = joined.search(/\bABRECHNUNG\b/)
  const uebersichtBlock = joined.slice(
    uebersichtStart >= 0 ? uebersichtStart : 0,
    abrechnungStart >= 0 ? abrechnungStart : joined.length,
  )

  // ISIN: Word-Boundary verhindert False Matches wie "BRUNNENSTRA" aus "BRUNNENSTRASSE"
  const isinMatch = uebersichtBlock.match(/\b([A-Z]{2}[A-Z0-9]{10})\b/)
  const isin = isinMatch?.[1]
    ?? joined.match(/\b([A-Z]{2}[A-Z0-9]{10})\b/)?.[1]

  // Firmenname: letzte Zeile VOR der ISIN im ÜBERSICHT-Block die wie ein Firmenname aussieht
  // (kein reiner Zahlen-/Header-String, Länge 2–80)
  let name = ''
  if (isin) {
    const beforeIsin = uebersichtBlock.slice(0, uebersichtBlock.indexOf(isin))
    const candidateLines = beforeIsin.split('\n').map((s) => s.trim()).filter(Boolean)
    for (let i = candidateLines.length - 1; i >= 0; i--) {
      const line = candidateLines[i] ?? ''
      if (line.length < 2 || line.length > 80) continue
      if (/^(POSITION|ANZAHL|ERTRAG|BETRAG|GESAMT|ÜBERSICHT|DIVIDENDE|OVERVIEW)/i.test(line)) continue
      if (/^\d/.test(line)) continue
      if (/\d{5,}/.test(line)) continue
      // Zeilen mit Dezimalzahlen (0.67, 5.36) oder Währungscodes sind keine Firmennamen
      if (/\d+[.,]\d+/.test(line)) continue
      if (/\b(USD|EUR|GBP|CHF|JPY|CNY)\b/.test(line)) continue
      name = line
      break
    }
  }

  // Stücke: aus dem ÜBERSICHT-Block, Zeile die ISIN enthält oder Zeile mit "Stücke"
  let stueck: number | null = null
  const stueckMatch = uebersichtBlock.match(/(\d+(?:\.\d+)?)\s*Stücke?/i)
  if (stueckMatch) stueck = parseFloat(stueckMatch[1])

  // Datum: aus BUCHUNG-Block
  let datum: string | null = null
  const buchungIdx = alleTexte.findIndex((t) => t.trim() === 'BUCHUNG')
  if (buchungIdx >= 0) {
    for (let i = buchungIdx + 1; i < Math.min(buchungIdx + 8, alleTexte.length); i++) {
      const m = alleTexte[i]?.match(/(\d{2}\.\d{2}\.\d{4})/)
      if (m) { datum = parseDeDatumZuIso(m[1]); break }
    }
  }
  if (!datum) {
    const m = joined.match(/DATUM\s+(\d{2}\.\d{2}\.\d{4})/)
    if (m) datum = parseDeDatumZuIso(m[1])
  }
  if (!datum) return []

  // EUR-Nettobetrag aus ABRECHNUNG-Block
  let betragEur: number | null = null
  const abrechnungBlock = abrechnungStart >= 0
    ? joined.slice(abrechnungStart, buchungIdx >= 0
        ? joined.indexOf('BUCHUNG', abrechnungStart)
        : joined.length)
    : ''

  // "GESAMT 3.91 EUR"
  const gestMatch = abrechnungBlock.match(/\bGESAMT\s+(\d+(?:\.\d+)?)\s*EUR\b/i)
  if (gestMatch) betragEur = parseFloat(gestMatch[1])
  // "Zwischensumme 1.1644 USD/EUR 3.91 EUR"
  if (betragEur == null) {
    const zwMatch = abrechnungBlock.match(/Zwischensumme\s+[\d.]+\s*USD\/EUR\s+(\d+(?:\.\d+)?)\s*EUR/i)
    if (zwMatch) betragEur = parseFloat(zwMatch[1])
  }
  // Fallback: EUR-Betrag in BUCHUNG-Zeile "DE... 01.06.2026 3.91 EUR"
  if (betragEur == null && buchungIdx >= 0) {
    for (let i = buchungIdx + 1; i < Math.min(buchungIdx + 6, alleTexte.length); i++) {
      const m = alleTexte[i]?.match(/(\d+(?:[.,]\d+)?)\s*EUR/i)
      if (m) { betragEur = parseFlexiblerBetrag(m[1]); break }
    }
  }

  if (betragEur == null || betragEur <= 0) return []

  let steuerEur: number | null = null
  const steuernMatch = joined.match(/GESAMTE\s+STEUERN\s+(\d+(?:[.,]\d+)?)\s*EUR/i)
  if (steuernMatch) steuerEur = parseFlexiblerBetrag(steuernMatch[1])

  return [{
    datum,
    typ: 'Dividende',
    beschreibung: [
      name,
      isin ? ('ISIN: ' + isin) : '',
      (stueck != null && stueck > 0) ? (stueck + ' Stk.') : '',
    ].filter(Boolean).join(' '),
    zahlungseingang: formatEuroBetrag(betragEur),
    zahlungsausgang: '',
    saldo: '',
    isin,
    stueck: stueck ?? undefined,
    steuerEur: steuerEur ?? undefined,
  }]
}
/** Einzel-PDF „Wertpapierabrechnung“ (Kauf/Verkauf) — nicht Kontoauszug. */
function parseWertpapierabrechnung(items: PdfTextItem[]): TrRawCashZeile[] {
  const lines = groupItemsIntoLines(items.filter((it) => it.y > FOOTER_BOTTOM_BAND), 3)
  const texts = lines.map((l) => l.text)
  const joined = texts.join('\n')
  if (!/WERTPAPIERABRECHNUNG/i.test(joined)) return []

  const wertstellungIso = joined.match(/WERTSTELLUNG[\s\S]{0,120}?(\d{4}-\d{2}-\d{2})/)?.[1] ?? null
  const docDatum = joined.match(/DATUM\s+(\d{2}\.\d{2}\.\d{4})/)?.[1] ?? null
  const tradeDatum =
    joined.match(/(?:Market-Order\s+)?(?:Kauf|Verkauf)\s+am\s+(\d{2}\.\d{2}\.\d{4})/i)?.[1] ?? null
  const datum =
    wertstellungIso ??
    (tradeDatum ? parseDeDatumZuIso(tradeDatum) : null) ??
    (docDatum ? parseDeDatumZuIso(docDatum) : null)
  if (!datum) return []

  const isVerkauf =
    /(?:Market-Order\s+)?Verkauf\s+am\b/i.test(joined) ||
    (/\bVerkauf\b/i.test(joined) && !/(?:Market-Order\s+)?Kauf\s+am\b/i.test(joined))
  const isin = joined.match(/ISIN:\s*([A-Z]{2}[A-Z0-9]{10})/)?.[1] ?? undefined

  const stkLine = texts.find((t) => /\d+\s*Stk\.?/i.test(t) && /EUR/i.test(t))
  const stkMatch = stkLine?.match(/(\d+(?:[.,]\d+)?)\s*Stk\.?/i)
  const stueck = stkMatch ? parseEuropeanNumber(stkMatch[1]) : null

  let name = ''
  const isinLineIdx = texts.findIndex((t) => /ISIN:/i.test(t))
  if (isinLineIdx > 0) {
    const prev = texts[isinLineIdx - 1] ?? ''
    if (prev && !/^(POSITION|ANZAHL|PREIS|BETRAG|ÜBERSICHT|ABRECHNUNG)/i.test(prev.trim())) {
      name = prev.split(/\d+\s*Stk\.?/i)[0]?.trim() ?? ''
    }
  }
  if (!name && stkLine) name = stkLine.split(/\d+\s*Stk\.?/i)[0]?.trim() ?? ''

  // 2–4 Nachkommastellen: TR-Stückpreise oft 25,815 EUR (3 Stellen) neben 154,89 EUR.
  const eurBetraege =
    stkLine?.match(/-?\d{1,3}(?:\.\d{3})*,\d{2,4}\s*EUR/gi)?.map((s) => parseEuropeanNumber(s)) ?? []
  const positive = eurBetraege.filter((n): n is number => n != null && n > 0)
  const gesamtAbrechnung = parseEuropeanNumber(
    joined.match(/\bGESAMT\s+(-?\d{1,3}(?:\.\d{3})*,\d{2})\s*EUR/i)?.[1],
  )
  const round2 = (n: number) => Math.round(n * 100) / 100
  const round4 = (n: number) => Math.round(n * 10000) / 10000
  const nahe = (a: number, b: number) => Math.abs(a - b) <= Math.max(1.02, b * 0.015)

  // Zeile „6 Stk. 25,815 EUR 154,89 EUR“ → Preis + Betrag.
  // Ein Betrag bei Mehrstück: nicht pauschal × Stück (sonst Gesamt als Kurs → 6× zu hoch).
  let handelsBetrag: number | null = null
  let kursEur: number | null = null
  if (positive.length >= 2 && stueck != null && stueck > 0) {
    const a = positive[0]!
    const b = positive[1]!
    const prodA = round2(stueck * a)
    const prodB = round2(stueck * b)
    if (nahe(prodA, b)) {
      kursEur = a
      handelsBetrag = b
    } else if (nahe(prodB, a)) {
      kursEur = b
      handelsBetrag = a
    } else {
      kursEur = a
      handelsBetrag = b
    }
  } else if (positive.length >= 2) {
    kursEur = positive[0]!
    handelsBetrag = positive[1]!
  } else if (positive.length === 1) {
    const only = positive[0]!
    if (stueck != null && stueck > 1.01) {
      const alsGesamtMalStk = round2(stueck * only)
      if (gesamtAbrechnung != null && nahe(only, Math.abs(gesamtAbrechnung))) {
        handelsBetrag = only
        kursEur = round4(only / stueck)
      } else if (gesamtAbrechnung != null && nahe(alsGesamtMalStk, Math.abs(gesamtAbrechnung))) {
        kursEur = only
        handelsBetrag = alsGesamtMalStk
      } else {
        handelsBetrag = only
        kursEur = round4(only / stueck)
      }
    } else if (stueck != null && stueck > 0) {
      handelsBetrag = only
      kursEur = round4(only / stueck)
    } else {
      handelsBetrag = only
    }
  } else if (stueck != null && stueck > 0 && kursEur != null && kursEur > 0) {
    handelsBetrag = round2(stueck * kursEur)
  }

  const out: TrRawCashZeile[] = []

  if (handelsBetrag != null && handelsBetrag > 0) {
    out.push({
      datum,
      typ: isVerkauf ? 'Verkauf' : 'Kauf',
      beschreibung: [name, isin ? `ISIN: ${isin}` : '', stueck != null ? `${stueck} Stk.` : '']
        .filter(Boolean)
        .join(' '),
      zahlungseingang: isVerkauf ? formatEuroBetrag(handelsBetrag) : '',
      zahlungsausgang: isVerkauf ? '' : formatEuroBetrag(handelsBetrag),
      saldo: '',
      isin,
      stueck: stueck ?? undefined,
      kursEur: kursEur ?? undefined,
    })
  }

  const abrechnungIdx = texts.findIndex((t) => t.trim() === 'ABRECHNUNG')
  const buchungIdx = texts.findIndex((t) => t.trim() === 'BUCHUNG')
  if (abrechnungIdx >= 0) {
    const end = buchungIdx >= 0 ? buchungIdx : texts.length
    for (const line of texts.slice(abrechnungIdx + 1, end)) {
      const trimmed = line.trim()
      if (!trimmed || /^POSITION$/i.test(trimmed) || /^GESAMT/i.test(trimmed)) continue
      const feeMatch = trimmed.match(/^(.+?)\s+(-?\d{1,3}(?:\.\d{3})*,\d{2})\s*EUR\s*$/i)
      if (!feeMatch) continue
      const feeName = feeMatch[1].trim()
      const feeAmt = Math.abs(parseEuropeanNumber(feeMatch[2]) ?? 0)
      if (feeAmt <= 0) continue
      const feeTyp = /steuer/i.test(feeName)
        ? 'Steuer'
        : /gebühr|entgelt|zuschlag|pauschale|provision|spesen/i.test(feeName)
          ? 'Gebühr'
          : feeName
      out.push({
        datum,
        typ: feeTyp,
        beschreibung: [feeName, name].filter(Boolean).join(' '),
        zahlungseingang: '',
        zahlungsausgang: formatEuroBetrag(feeAmt),
        saldo: '',
        isin,
      })
    }
  }

  return out
}

async function parsePdfDocument(pdf: import('pdfjs-dist').PDFDocumentProxy): Promise<TrPdfParseErgebnis> {
  let allCash: TrRawCashZeile[] = []
  let allPortfolio: TrRawPosition[] = []
  let cashBoundaries: CashColumnBoundaries | null = null
  let portfolioBoundaries: PortfolioColumnBoundaries | null = null
  let isParsingCash = false
  let isParsingPortfolio = false
  const allPageLines: string[] = []
  let wertpapierAbrechnungItems: PdfTextItem[] = []

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum)
    const textContent = await page.getTextContent()
    let pageItems: PdfTextItem[] = textContent.items
      .filter((item) => 'str' in item)
      .map((item) => {
        const t = item as { str: string; transform: number[]; width: number; height: number }
        return {
          text: t.str,
          x: t.transform[4],
          y: t.transform[5],
          width: t.width,
          height: t.height,
        }
      })
    pageItems = pageItems.filter((it) => it.y > FOOTER_BOTTOM_BAND)
    const pageLines = groupItemsIntoLines(pageItems, 3).map((l) => l.text)
    allPageLines.push(...pageLines)

    const cashStart = pageItems.find((i) => ['UMSATZÜBERSICHT', 'ACCOUNT TRANSACTIONS'].includes(i.text.trim()))
    const cashEnd = pageItems.find((i) =>
      i.text.includes('BARMITTELÜBERSICHT') || i.text.includes('CASH SUMMARY') || i.text.includes('BALANCE OVERVIEW'),
    )
    const shouldProcessCash: boolean = isParsingCash || !!cashStart

    if (shouldProcessCash) {
      let cashItems = [...pageItems]
      if (cashStart) cashItems = cashItems.filter((i) => i.y <= cashStart.y)
      if (cashEnd) cashItems = cashItems.filter((i) => i.y > cashEnd.y)
      const headers = findCashHeaders(cashItems)
      if (headers) cashBoundaries = calculateCashColumnBoundaries(headers)
      if (cashBoundaries) allCash = allCash.concat(extractCashTransactions(cashItems, cashBoundaries))
    }
    isParsingCash = cashEnd ? false : shouldProcessCash

    const portfolioStart = pageItems.find((i) => i.text.trim() === 'POSITIONEN' || i.text.trim() === 'POSITIONS')
    const portfolioEnd = pageItems.find((i) =>
      i.text.includes('ANZAHL POSITIONEN') || i.text.includes('NUMBER OF POSITIONS') || i.text.trim() === 'Achtung:',
    )
    const shouldProcessPortfolio: boolean = isParsingPortfolio || !!portfolioStart

    if (shouldProcessPortfolio) {
      let portfolioItems = [...pageItems]
      if (portfolioStart) portfolioItems = portfolioItems.filter((i) => i.y <= portfolioStart.y)
      if (portfolioEnd) portfolioItems = portfolioItems.filter((i) => i.y > portfolioEnd.y)
      const headers = findPortfolioHeaders(portfolioItems)
      if (headers) portfolioBoundaries = calculatePortfolioColumnBoundaries(headers)
      if (portfolioBoundaries) {
        allPortfolio = allPortfolio.concat(extractPortfolioPositions(portfolioItems, portfolioBoundaries))
      }
    }
    isParsingPortfolio = portfolioEnd ? false : shouldProcessPortfolio

    const abrechnungDoc = pageItems.some((i) => i.text.includes('WERTPAPIERABRECHNUNG'))
    if (abrechnungDoc) {
      wertpapierAbrechnungItems = wertpapierAbrechnungItems.concat(pageItems)
    }
  }

  if (wertpapierAbrechnungItems.length > 0) {
    allCash = allCash.concat(parseWertpapierabrechnung(wertpapierAbrechnungItems))
  }

  // Dividenden-Einzelabrechnung (separate TR-PDF)
  if (allPageLines.some((t) => /\bDIVIDENDE\b/i.test(t)) && !allPageLines.some((t) => /WERTPAPIERABRECHNUNG/i.test(t))) {
    allCash = allCash.concat(parseDividendenAbrechnung(allPageLines))
  }
  return { cash: allCash, portfolio: allPortfolio, crypto: [] }
}

export async function parseTradeRepublicPdfBuffer(buffer: ArrayBuffer): Promise<TrPdfParseErgebnis> {
  const pdfjs = await import('pdfjs-dist')
  if (typeof window !== 'undefined' && !pdfjs.GlobalWorkerOptions.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`
  }
  let pdf: import('pdfjs-dist').PDFDocumentProxy
  try {
    const loadingTask = pdfjs.getDocument({ data: new Uint8Array(buffer) })
    pdf = await loadingTask.promise
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    throw new Error(
      msg.includes('worker') || msg.includes('fetch')
        ? `PDF konnte nicht gelesen werden (${msg}). Netzwerk für pdf.js-Worker prüfen oder erneut versuchen.`
        : `PDF konnte nicht gelesen werden: ${msg}`,
    )
  }
  try {
    return await parsePdfDocument(pdf)
  } finally {
    await pdf.destroy()
  }
}
