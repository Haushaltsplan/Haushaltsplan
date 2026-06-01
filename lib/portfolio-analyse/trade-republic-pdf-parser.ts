import { parseEuropeanNumber } from '@/lib/portfolio-analyse/parse-hilfen'

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

async function parsePdfDocument(pdf: import('pdfjs-dist').PDFDocumentProxy): Promise<TrPdfParseErgebnis> {
  let allCash: TrRawCashZeile[] = []
  let allPortfolio: TrRawPosition[] = []
  let cashBoundaries: CashColumnBoundaries | null = null
  let portfolioBoundaries: PortfolioColumnBoundaries | null = null
  let isParsingCash = false
  let isParsingPortfolio = false

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
  }

  return { cash: allCash, portfolio: allPortfolio, crypto: [] }
}

export async function parseTradeRepublicPdfBuffer(buffer: ArrayBuffer): Promise<TrPdfParseErgebnis> {
  const pdfjs = await import('pdfjs-dist')
  if (typeof window !== 'undefined') {
    pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`
  }
  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(buffer) })
  const pdf = await loadingTask.promise
  try {
    return await parsePdfDocument(pdf)
  } finally {
    await pdf.destroy()
  }
}
