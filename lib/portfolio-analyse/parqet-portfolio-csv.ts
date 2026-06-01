import type { TrPdfParseErgebnis, TrRawCashZeile } from '@/lib/portfolio-analyse/trade-republic-pdf-parser'
import { parseGeldBetrag } from '@/lib/portfolio-analyse/parse-geld-betrag'
import { parseDeDatumZuIso } from '@/lib/portfolio-analyse/parse-hilfen'

const ISIN_RE = /^[A-Z]{2}[A-Z0-9]{10}$/

/** Parqet-Portfolio-Export: „Aktien Portfolio-YYYYMMDD-HHMMSS.csv“ */
export type ParqetPortfolioCsvMeta = {
  format: 'parqet_portfolio' | 'unbekannt'
  delimiter: string
  spalten: string[]
  hinweise: string[]
  zeilenGesamt: number
  uebersprungen: number
  typUebersprungen: Map<string, number>
}

function splitCsvLine(line: string, delimiter: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"'
        i++
        continue
      }
      inQuotes = !inQuotes
      continue
    }
    if (ch === delimiter && !inQuotes) {
      out.push(cur.trim())
      cur = ''
      continue
    }
    cur += ch
  }
  out.push(cur.trim().replace(/^\ufeff/, ''))
  return out
}

function normalizeHeader(h: string): string {
  return h
    .replace(/^\ufeff/, '')
    .replace(/^"|"$/g, '')
    .toLowerCase()
    .trim()
}

function colIndex(headers: string[], name: string): number {
  return headers.indexOf(name)
}

/** Erkennt Parqet-Export „Aktien Portfolio-…“ (identifier + holdingname + shares + amount). */
export function istParqetPortfolioCsv(text: string): boolean {
  const raw = text.replace(/^\ufeff/, '')
  const first = raw.split(/\r?\n/).map((l) => l.trim()).find(Boolean)
  if (!first) return false
  const headers = splitCsvLine(first, ';').map(normalizeHeader)
  return (
    headers.includes('identifier') &&
    headers.includes('holdingname') &&
    headers.includes('shares') &&
    headers.includes('amount') &&
    headers.includes('type') &&
    (headers.includes('datetime') || headers.includes('date'))
  )
}

function parseDatum(cols: string[], idx: { datetime: number; date: number }): string | null {
  const iso = idx.datetime >= 0 ? cols[idx.datetime]?.trim() ?? '' : ''
  if (iso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
    if (m) return `${m[1]}-${m[2]}-${m[3]}`
  }
  const de = idx.date >= 0 ? cols[idx.date]?.trim() ?? '' : ''
  if (de) return parseDeDatumZuIso(de)
  return null
}

function isinAusIdentifier(raw: string): string {
  const s = raw.trim().toUpperCase()
  return ISIN_RE.test(s) ? s : ''
}

function geldbetragNetto(
  typRaw: string,
  amount: number,
  fee: number,
  tax: number,
): { eingang: string; ausgang: string } {
  const t = typRaw.toLowerCase()
  const feeAbs = Math.abs(fee)
  const taxAbs = Math.abs(tax)
  const amt = Math.abs(amount)
  const fmt = (n: number) => String(Math.round(n * 100) / 100).replace('.', ',')

  if (/^buy$|^transferin$/i.test(t)) {
    const aus = amt + feeAbs
    return aus > 0 ? { eingang: '', ausgang: fmt(aus) } : { eingang: '', ausgang: '' }
  }
  if (/^sell$|^transferout$/i.test(t)) {
    let ein = Math.max(0, amt - feeAbs - taxAbs)
    // Gebühr kann den Nettoerlös übersteigen (z. B. Turbo-Restverkauf) — Brutto „amount“ trotzdem buchen
    if (ein <= 0 && amt > 0) ein = amt
    return ein > 0 ? { eingang: fmt(ein), ausgang: '' } : { eingang: '', ausgang: '' }
  }
  if (/^dividend$/i.test(t)) {
    const ein = Math.max(0, amt - taxAbs)
    return ein > 0 ? { eingang: fmt(ein), ausgang: '' } : { eingang: '', ausgang: '' }
  }
  if (amt > 0) {
    if (/deposit|interest|in$/i.test(t)) return { eingang: fmt(amt), ausgang: '' }
    return { eingang: '', ausgang: fmt(amt + feeAbs + taxAbs) }
  }
  return { eingang: '', ausgang: '' }
}

function zeileUeberspringen(typRaw: string, assettype: string): boolean {
  const t = typRaw.toLowerCase()
  if (!t) return true
  const at = assettype.toLowerCase()
  if (at === 'cash') {
    return !/deposit|withdrawal|interest|transfer/i.test(t)
  }
  if (assettype && at !== 'security') return true
  return false
}

function cashZeileAusParqet(
  cols: string[],
  idx: Record<string, number>,
): TrRawCashZeile | null {
  const typRaw = idx.type >= 0 ? cols[idx.type]?.trim() ?? '' : ''
  const assettype = idx.assettype >= 0 ? cols[idx.assettype]?.trim() ?? '' : ''
  if (zeileUeberspringen(typRaw, assettype)) return null

  const datum = parseDatum(cols, { datetime: idx.datetime, date: idx.date })
  if (!datum) return null

  const identifier = idx.identifier >= 0 ? cols[idx.identifier]?.trim() ?? '' : ''
  const isin = isinAusIdentifier(identifier)
  const name = idx.holdingname >= 0 ? cols[idx.holdingname]?.trim() ?? '' : ''
  const broker = idx.broker >= 0 ? cols[idx.broker]?.trim() ?? '' : ''

  const price = idx.price >= 0 ? parseGeldBetrag(cols[idx.price]) : null
  const shares = idx.shares >= 0 ? parseGeldBetrag(cols[idx.shares]) : null
  const amount = idx.amount >= 0 ? parseGeldBetrag(cols[idx.amount]) : null
  const fee = idx.fee >= 0 ? parseGeldBetrag(cols[idx.fee]) ?? 0 : 0
  const tax = idx.tax >= 0 ? parseGeldBetrag(cols[idx.tax]) ?? 0 : 0

  const amt = amount ?? 0
  const stueck = shares != null && shares !== 0 ? Math.abs(shares) : null

  let { eingang, ausgang } = geldbetragNetto(typRaw, amt, fee, tax)

  // Buchwert-Umbuchung ohne amount: price × shares
  if (!eingang && !ausgang && stueck != null && price != null && price > 0) {
    const wert = Math.round(stueck * price * 100) / 100
    ;({ eingang, ausgang } = geldbetragNetto(typRaw, wert, fee, tax))
  }

  // Reine Stück-Umbuchung (z. B. ISIN-Wechsel) — für Bestand, ohne Cashflow
  if (!eingang && !ausgang && stueck != null && /transfer/i.test(typRaw)) {
    const pseudo = Math.max(0.01, (price ?? 0) * stueck)
    ;({ eingang, ausgang } = geldbetragNetto(typRaw, pseudo, 0, 0))
  }

  if (!eingang && !ausgang) return null

  const teile = [name, isin ? `ISIN ${isin}` : identifier, broker ? `(${broker})` : ''].filter(Boolean)
  let beschreibung = teile.join(' ')
  if (stueck != null) beschreibung = `${beschreibung} ${stueck} Stk`.trim()

  return {
    datum,
    typ: typRaw,
    beschreibung,
    zahlungseingang: eingang,
    zahlungsausgang: ausgang,
    saldo: '',
    isin: isin || undefined,
    stueck,
  }
}

/** Parqet „Aktien Portfolio“-CSV — alle Buchungszeilen. */
export function parseParqetPortfolioCsvText(text: string): TrPdfParseErgebnis & { meta: ParqetPortfolioCsvMeta } {
  const hinweise: string[] = []
  const typUebersprungen = new Map<string, number>()
  const raw = text.replace(/^\ufeff/, '')
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)

  if (lines.length < 2) {
    return {
      cash: [],
      portfolio: [],
      crypto: [],
      meta: {
        format: 'unbekannt',
        delimiter: ';',
        spalten: [],
        hinweise: ['CSV ist leer oder hat keine Datenzeilen.'],
        zeilenGesamt: 0,
        uebersprungen: 0,
        typUebersprungen,
      },
    }
  }

  const delimiter = ';'
  const headers = splitCsvLine(lines[0], delimiter).map(normalizeHeader)

  if (!istParqetPortfolioCsv(text)) {
    return {
      cash: [],
      portfolio: [],
      crypto: [],
      meta: {
        format: 'unbekannt',
        delimiter,
        spalten: headers,
        hinweise: [
          'Kein Parqet-Portfolio-Export. Erwartet: Spalten datetime, type, shares, amount, identifier, holdingname (Export „Aktien Portfolio“ aus Parqet).',
        ],
        zeilenGesamt: Math.max(0, lines.length - 1),
        uebersprungen: 0,
        typUebersprungen,
      },
    }
  }

  const idx = {
    datetime: colIndex(headers, 'datetime'),
    date: colIndex(headers, 'date'),
    type: colIndex(headers, 'type'),
    assettype: colIndex(headers, 'assettype'),
    identifier: colIndex(headers, 'identifier'),
    holdingname: colIndex(headers, 'holdingname'),
    broker: colIndex(headers, 'broker'),
    price: colIndex(headers, 'price'),
    shares: colIndex(headers, 'shares'),
    amount: colIndex(headers, 'amount'),
    fee: colIndex(headers, 'fee'),
    tax: colIndex(headers, 'tax'),
  }

  hinweise.push(
    'Parqet-Portfolio-CSV: Buy/Sell/Dividend/TransferIn/TransferOut — ISIN aus „identifier“, Name aus „holdingname“, Gebühren/Steuern netto.',
  )

  const cash: TrRawCashZeile[] = []
  let uebersprungen = 0

  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i], delimiter)
    if (cols.every((c) => !c)) continue
    const typRaw = idx.type >= 0 ? cols[idx.type]?.trim() ?? '' : ''
    const row = cashZeileAusParqet(cols, idx)
    if (row) {
      cash.push(row)
    } else {
      uebersprungen++
      if (typRaw) typUebersprungen.set(typRaw, (typUebersprungen.get(typRaw) ?? 0) + 1)
    }
  }

  let summeEin = 0
  let summeAus = 0
  for (const row of cash) {
    summeEin += parseGeldBetrag(row.zahlungseingang) ?? 0
    summeAus += parseGeldBetrag(row.zahlungsausgang) ?? 0
  }

  hinweise.push(
    `${cash.length} von ${lines.length - 1} Zeilen importiert` +
      (uebersprungen > 0 ? ` (${uebersprungen} übersprungen)` : '') +
      ` · Eingänge ${summeEin.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })} · Ausgänge ${summeAus.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}.`,
  )

  if (typUebersprungen.size > 0) {
    const liste = [...typUebersprungen.entries()].map(([t, n]) => `${t} (${n})`).join(', ')
    hinweise.push(`Übersprungene Typen: ${liste}`)
  }

  return {
    cash,
    portfolio: [],
    crypto: [],
    meta: {
      format: 'parqet_portfolio',
      delimiter,
      spalten: headers,
      hinweise,
      zeilenGesamt: lines.length - 1,
      uebersprungen,
      typUebersprungen,
    },
  }
}
