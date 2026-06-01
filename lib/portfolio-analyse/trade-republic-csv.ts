import type { TrPdfParseErgebnis, TrRawCashZeile, TrRawPosition } from '@/lib/portfolio-analyse/trade-republic-pdf-parser'
import { parseGeldBetrag, positiverGeldbetrag } from '@/lib/portfolio-analyse/parse-geld-betrag'
import { parseDeDatumZuIso } from '@/lib/portfolio-analyse/parse-hilfen'

export type CsvErkanntesFormat =
  | 'tr_aktivitaet'
  | 'tr_wertpapier_order'
  | 'kontoauszug_cash'
  | 'depot_positionen'
  | 'unbekannt'

export type CsvParseMeta = {
  format: CsvErkanntesFormat
  delimiter: string
  spalten: string[]
  hinweise: string[]
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
  out.push(cur.trim())
  return out
}

function detectDelimiter(headerLine: string): string {
  const counts = [
    { d: ';', c: (headerLine.match(/;/g) ?? []).length },
    { d: ',', c: (headerLine.match(/,/g) ?? []).length },
    { d: '\t', c: (headerLine.match(/\t/g) ?? []).length },
  ]
  counts.sort((a, b) => b.c - a.c)
  const best = counts[0]
  if (!best?.c) return ';'
  if (best.d === ',' && best.c >= 4) return ','
  if (best.d === ';' && best.c >= 2) return ';'
  return best.d
}

function normalizeHeader(h: string): string {
  return h
    .replace(/^\ufeff/, '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
}

type SpaltenMap = {
  datum?: number
  typ?: number
  beschreibung?: number
  title?: number
  subtitle?: number
  eingang?: number
  ausgang?: number
  betrag?: number
  saldo?: number
  isin?: number
  symbol?: number
  name?: number
  stueck?: number
  kurs?: number
  wert?: number
}

function findeSpalteExakt(headers: string[], aliases: string[]): number | undefined {
  const i = headers.findIndex((h) => aliases.includes(h))
  return i >= 0 ? i : undefined
}

function mappeSpalten(headers: string[]): SpaltenMap {
  return {
    datum: findeSpalteExakt(headers, [
      'datum',
      'date',
      'timestamp',
      'buchungsdatum',
      'valutadatum',
      'zeit',
      'time',
    ]),
    typ: findeSpalteExakt(headers, [
      'type',
      'typ',
      'zahlungsart',
      'transaction_type',
      'transaktionstyp',
    ]),
    beschreibung: findeSpalteExakt(headers, [
      'beschreibung',
      'description',
      'text',
      'verwendungszweck',
      'referenz',
      'details',
      'info',
    ]),
    title: findeSpalteExakt(headers, ['title', 'titel']),
    subtitle: findeSpalteExakt(headers, ['subtitle', 'untertitel']),
    eingang: findeSpalteExakt(headers, [
      'zahlungseingang',
      'eingang',
      'money_in',
      'moneyin',
      'inflow',
      'incoming',
      'credit',
      'gutschrift',
      'haben',
    ]),
    ausgang: findeSpalteExakt(headers, [
      'zahlungsausgang',
      'ausgang',
      'money_out',
      'moneyout',
      'outflow',
      'outgoing',
      'debit',
      'lastschrift',
      'soll',
    ]),
    betrag: findeSpalteExakt(headers, ['betrag', 'amount', 'summe']),
    saldo: findeSpalteExakt(headers, ['saldo', 'balance', 'kontostand']),
    isin: findeSpalteExakt(headers, ['isin', 'instrument', 'wertpapierkennnummer']),
    symbol: findeSpalteExakt(headers, ['symbol', 'ticker', 'kuerzel']),
    name: findeSpalteExakt(headers, ['name', 'wertpapier', 'security', 'security_description', 'instrument_name']),
    stueck: findeSpalteExakt(headers, ['stuck', 'stueck', 'shares', 'quantity', 'stk', 'nominal', 'menge']),
    kurs: findeSpalteExakt(headers, ['kurs', 'rate', 'price', 'price_per_unit', 'kurs_pro_stuck']),
    wert: findeSpalteExakt(headers, ['kurswert_in_eur', 'market_value', 'marketvalueeur', 'market_value_eur']),
  }
}

function erkenneFormat(headers: string[], map: SpaltenMap): CsvErkanntesFormat {
  const hatTrAktivitaet =
    headers.includes('timestamp') &&
    map.typ != null &&
    (map.eingang != null || map.ausgang != null) &&
    (headers.includes('instrument') || headers.includes('id'))

  const hatWertpapierOrder =
    map.datum != null &&
    map.typ != null &&
    map.betrag != null &&
    (map.symbol != null || map.stueck != null) &&
    map.eingang == null &&
    map.ausgang == null

  const hatKontoauszug =
    map.datum != null &&
    (map.eingang != null || map.ausgang != null || map.betrag != null) &&
    (map.beschreibung != null || map.title != null || map.typ != null) &&
    !hatTrAktivitaet

  const hatDepot =
    (map.stueck != null || headers.includes('quantity')) &&
    (map.wert != null || map.kurs != null) &&
    (map.name != null || map.isin != null) &&
    map.datum == null &&
    !hatTrAktivitaet

  if (hatTrAktivitaet) return 'tr_aktivitaet'
  if (hatWertpapierOrder) return 'tr_wertpapier_order'
  if (hatDepot) return 'depot_positionen'
  if (hatKontoauszug) return 'kontoauszug_cash'
  return 'unbekannt'
}

/** TR-Typ → Geld fließt raus (Ausgang) oder rein (Eingang)? */
function geldRichtungAusTyp(typ: string): 'eingang' | 'ausgang' | null {
  const t = typ.toLowerCase().trim()
  if (!t || t === 'executed' || t === 'cancelled') return null
  if (
    /purchase|kauf|buy|saveback|round\s*up|withdrawal|auszahlung|fee|gebühr|commission|steuer|tax/i.test(
      t,
    )
  ) {
    return 'ausgang'
  }
  if (
    /sale|verkauf|sell|dividend|interest|zins|deposit|einzahlung|gutschrift|payout/i.test(t)
  ) {
    return 'eingang'
  }
  return null
}

function zeileIstKopfOderSumme(cols: string[], map: SpaltenMap): boolean {
  const joined = cols.join(' ').toLowerCase()
  if (/^(summe|gesamt|total|subtotal)/i.test(joined)) return true
  const typ = map.typ != null ? cols[map.typ]?.trim() : ''
  if (/^(summe|gesamt|total|subtotal|executed)$/i.test(typ)) return false
  if (/^(summe|gesamt|total|subtotal)$/i.test(typ)) return true
  const datum = map.datum != null ? cols[map.datum]?.trim() : ''
  if (datum && !parseDeDatumZuIso(datum) && /summe|gesamt|saldo/i.test(datum)) return true
  return false
}

function betraegeAusSpalten(cols: string[], map: SpaltenMap, typRaw: string): { eingang: string; ausgang: string } {
  let eingang = map.eingang != null ? cols[map.eingang] ?? '' : ''
  let ausgang = map.ausgang != null ? cols[map.ausgang] ?? '' : ''

  const einPos = positiverGeldbetrag(eingang)
  const ausPos = positiverGeldbetrag(ausgang)

  if (einPos == null && ausPos == null && map.betrag != null) {
    const n = parseGeldBetrag(cols[map.betrag])
    if (n != null && n !== 0) {
      const richtung = geldRichtungAusTyp(typRaw)
      const abs = Math.abs(n)
      const str = String(abs).replace('.', ',')
      if (richtung === 'ausgang' || (richtung == null && n < 0)) {
        ausgang = str
      } else {
        eingang = str
      }
    }
  }

  if (einPos != null && einPos > 0 && ausPos != null && ausPos > 0) {
    const richtung = geldRichtungAusTyp(typRaw)
    if (richtung === 'eingang') ausgang = ''
    else if (richtung === 'ausgang') eingang = ''
    else if (ausPos >= einPos) eingang = ''
    else ausgang = ''
  }

  return { eingang: eingang.trim(), ausgang: ausgang.trim() }
}

function cashZeileAusCols(cols: string[], map: SpaltenMap, format: CsvErkanntesFormat): TrRawCashZeile | null {
  if (zeileIstKopfOderSumme(cols, map)) return null

  const datumRaw = map.datum != null ? cols[map.datum]?.trim() ?? '' : ''
  if (!datumRaw || !parseDeDatumZuIso(datumRaw)) return null

  const typ = map.typ != null ? cols[map.typ]?.trim() ?? '' : ''
  if (typ.toLowerCase() === 'executed' || typ.toLowerCase() === 'cancelled') return null

  let beschreibung = ''
  if (map.beschreibung != null) beschreibung = cols[map.beschreibung]?.trim() ?? ''
  const title = map.title != null ? cols[map.title]?.trim() ?? '' : ''
  const subtitle = map.subtitle != null ? cols[map.subtitle]?.trim() ?? '' : ''
  if (!beschreibung && (title || subtitle)) {
    beschreibung = [title, subtitle].filter(Boolean).join(' — ')
  }
  const symbol = map.symbol != null ? cols[map.symbol]?.trim() ?? '' : ''
  const name = map.name != null ? cols[map.name]?.trim() ?? '' : ''
  const isin = map.isin != null ? cols[map.isin]?.trim().replace(/^ISIN:?\s*/i, '') ?? '' : ''
  if (!beschreibung) {
    beschreibung = [name, symbol, isin ? `ISIN ${isin}` : ''].filter(Boolean).join(' ')
  }

  const { eingang, ausgang } = betraegeAusSpalten(cols, map, typ)
  const saldo = map.saldo != null ? cols[map.saldo]?.trim() ?? '' : ''

  if (!eingang && !ausgang) return null

  if (format === 'tr_wertpapier_order' && !typ) return null

  return {
    datum: datumRaw,
    typ,
    beschreibung,
    zahlungseingang: eingang,
    zahlungsausgang: ausgang,
    saldo,
  }
}

function positionAusCols(cols: string[], map: SpaltenMap): TrRawPosition | null {
  const name = map.name != null ? cols[map.name]?.trim() ?? '' : ''
  const isin = map.isin != null ? cols[map.isin]?.trim().replace(/^ISIN:?\s*/i, '') ?? '' : ''
  const stueckRaw = map.stueck != null ? cols[map.stueck] : null
  const stueck = stueckRaw != null ? parseGeldBetrag(stueckRaw) : null
  const kurs = map.kurs != null ? parseGeldBetrag(cols[map.kurs]) : null
  const wert = map.wert != null ? parseGeldBetrag(cols[map.wert]) : null
  if (!name && !isin) return null
  if (stueck == null || stueck === 0) return null
  const qty = Math.abs(stueck)
  const marketValueEUR = wert ?? (kurs != null ? qty * Math.abs(kurs) : null)
  if (marketValueEUR == null || marketValueEUR <= 0) return null
  return {
    quantity: qty,
    name: name || isin,
    isin,
    pricePerUnit: kurs != null ? Math.abs(kurs) : null,
    marketValueEUR: Math.round(Math.abs(marketValueEUR) * 100) / 100,
  }
}

function parseDatenzeilen(
  lines: string[],
  delimiter: string,
  map: SpaltenMap,
  format: CsvErkanntesFormat,
): TrPdfParseErgebnis {
  const cash: TrRawCashZeile[] = []
  const portfolio: TrRawPosition[] = []

  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i], delimiter)
    if (cols.every((c) => !c)) continue

    if (format === 'depot_positionen') {
      const pos = positionAusCols(cols, map)
      if (pos) portfolio.push(pos)
      continue
    }

    const row = cashZeileAusCols(cols, map, format)
    if (row) cash.push(row)
  }

  return { cash, portfolio, crypto: [] }
}

const FORMAT_HINWEISE: Record<CsvErkanntesFormat, string> = {
  tr_aktivitaet:
    'Trade-Republic-Aktivitäts-CSV (z. B. Portfolio-Performance-Export): Spalten Type, Debit, Credit — nicht „Status“.',
  tr_wertpapier_order:
    'Wertpapier-Order-CSV (Date/Symbol/Type/Amount): Beträge werden anhand von Kauf/Verkauf als Ausgang/Eingang gelesen.',
  kontoauszug_cash: 'Kontoauszug-CSV (Datum, Eingang, Ausgang, Beschreibung).',
  depot_positionen: 'Nur Depotpositionen — keine Kontobewegungen.',
  unbekannt: 'Unbekanntes Layout.',
}

/** CSV — nur Text, kein Server. */
export function parseTradeRepublicCsvText(text: string): TrPdfParseErgebnis & { meta: CsvParseMeta } {
  const hinweise: string[] = []
  const raw = text.replace(/^\ufeff/, '')
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)

  if (lines.length < 2) {
    return {
      cash: [],
      portfolio: [],
      crypto: [],
      meta: { format: 'unbekannt', delimiter: ';', spalten: [], hinweise: ['CSV ist leer oder hat keine Datenzeilen.'] },
    }
  }

  hinweise.push(
    'Hinweis: Trade Republic bietet in der App keinen offiziellen CSV-Export — die Datei stammt meist von einem Dritttool (Parqet, Portfolio Performance, Kontoauszug-Konverter).',
  )

  let headerIndex = 0
  for (let i = 0; i < Math.min(lines.length, 12); i++) {
    const probe = splitCsvLine(lines[i], detectDelimiter(lines[i])).map(normalizeHeader)
    if (
      probe.some((h) =>
        ['datum', 'date', 'timestamp', 'type', 'typ', 'instrument', 'symbol', 'amount', 'debit'].includes(h),
      )
    ) {
      headerIndex = i
      break
    }
  }

  const delimiter = detectDelimiter(lines[headerIndex])
  const headers = splitCsvLine(lines[headerIndex], delimiter).map(normalizeHeader)
  const map = mappeSpalten(headers)
  const format = erkenneFormat(headers, map)

  hinweise.push(FORMAT_HINWEISE[format])
  hinweise.push(`Spalten: ${headers.join(', ')}`)

  if (format === 'unbekannt') {
    hinweise.push(
      'Erste Zeile deiner Datei sollte u. a. „Type“ oder „Typ“ und „Debit“/„Credit“ oder „Amount“ enthalten. Sonst PDF importieren.',
    )
    return { cash: [], portfolio: [], crypto: [], meta: { format, delimiter, spalten: headers, hinweise } }
  }

  const dataLines = lines.slice(headerIndex)
  const ergebnis = parseDatenzeilen(dataLines, delimiter, map, format)

  if (format === 'tr_aktivitaet' || format === 'kontoauszug_cash' || format === 'tr_wertpapier_order') {
    let summeEin = 0
    let summeAus = 0
    let kaeufe = 0
    let verkaeufe = 0
    for (const row of ergebnis.cash) {
      const ein = positiverGeldbetrag(row.zahlungseingang) ?? 0
      const aus = positiverGeldbetrag(row.zahlungsausgang) ?? 0
      summeEin += ein
      summeAus += aus
      const t = row.typ.toLowerCase()
      if (t.includes('purchase') || t.includes('kauf') || t.includes('buy')) kaeufe += aus
      if (t.includes('sale') || t.includes('verkauf') || t.includes('sell')) verkaeufe += ein
    }
    hinweise.push(
      `CSV-Plausibilität: ${ergebnis.cash.length} Buchungen · Eingänge ${summeEin.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })} · Ausgänge ${summeAus.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}.`,
    )
    if (format === 'tr_aktivitaet' && kaeufe > 0 && verkaeufe === 0 && summeEin > summeAus * 2) {
      hinweise.push(
        'Warnung: Sehr hohe „Eingänge“ bei wenig Verkäufen — oft falsche Spalte. Prüfe, ob die CSV-Spalte „Type“ (nicht „Status“) erkannt wurde.',
      )
    }
  }

  return { ...ergebnis, meta: { format, delimiter, spalten: headers, hinweise } }
}
