import type { TrPdfParseErgebnis, TrRawCashZeile, TrRawPosition } from '@/lib/portfolio-analyse/trade-republic-pdf-parser'
import { parseGeldBetrag, positiverGeldbetrag } from '@/lib/portfolio-analyse/parse-geld-betrag'
import { parseDatumUhrzeitMitJahr, parseDeDatumZuIso } from '@/lib/portfolio-analyse/parse-hilfen'

export type CsvErkanntesFormat =
  | 'transaktionen_de'
  | 'tr_transaktionsexport'
  | 'tr_aktivitaet'
  | 'tr_wertpapier_order'
  | 'kontoauszug_cash'
  | 'depot_positionen'
  | 'unbekannt'

const ISIN_IN_SYMBOL = /^[A-Z]{2}[A-Z0-9]{10}$/

/** TR-App-Export: keine echte Geldbewegung / Doppelung mit Folge-Kauf. */
const CSV_TYP_UEBERSPRINGEN = new Set([
  'free_receipt',
  'stockperk',
  'cancelled',
  'canceled',
])

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
  out.push(cur.trim().replace(/^\ufeff/, ''))
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
  fee?: number
  tax?: number
  jahr?: number
  description?: number
  category?: number
}

function findeSpalteExakt(headers: string[], aliases: string[]): number | undefined {
  const i = headers.findIndex((h) => aliases.includes(h))
  return i >= 0 ? i : undefined
}

function mappeSpalten(headers: string[]): SpaltenMap {
  return {
    datum: findeSpalteExakt(headers, [
      'date',
      'datum',
      'datum_uhrzeit',
      'datetime',
      'timestamp',
      'buchungsdatum',
      'valutadatum',
      'zeit',
      'time',
    ]),
    jahr: findeSpalteExakt(headers, ['jahr', 'year']),
    typ: findeSpalteExakt(headers, [
      'type',
      'typ',
      'zahlungsart',
      'transaction_type',
      'transaktionstyp',
    ]),
    beschreibung: findeSpalteExakt(headers, [
      'description',
      'beschreibung',
      'text',
      'verwendungszweck',
      'referenz',
      'details',
      'info',
    ]),
    description: findeSpalteExakt(headers, ['description', 'beschreibung']),
    category: findeSpalteExakt(headers, ['category', 'kategorie']),
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
    betrag: findeSpalteExakt(headers, ['betrag', 'betrag_eur', 'amount', 'summe', 'betrageur']),
    saldo: findeSpalteExakt(headers, ['saldo', 'balance', 'kontostand']),
    isin: findeSpalteExakt(headers, ['isin', 'instrument', 'wertpapierkennnummer']),
    symbol: findeSpalteExakt(headers, ['symbol', 'ticker', 'kuerzel']),
    fee: findeSpalteExakt(headers, ['fee', 'gebuehr', 'gebuhren', 'gebuehren', 'gebuehren_eur', 'commission', 'entgelt']),
    tax: findeSpalteExakt(headers, ['steuern', 'steuern_eur', 'steuer', 'tax', 'taxes']),
    name: findeSpalteExakt(headers, ['name', 'wertpapier', 'security', 'security_description', 'instrument_name']),
    stueck: findeSpalteExakt(headers, ['stuck', 'stueck', 'anteile', 'shares', 'quantity', 'stk', 'nominal', 'menge']),
    kurs: findeSpalteExakt(headers, ['kurs', 'preis', 'preis_eur', 'rate', 'price', 'price_per_unit', 'kurs_pro_stuck']),
    wert: findeSpalteExakt(headers, ['kurswert_in_eur', 'market_value', 'marketvalueeur', 'market_value_eur']),
  }
}

/** Parqet/manuell: Datum;… oder Jahr;Datum_Uhrzeit;… + ISIN + Betrag */
function istTransaktionenDeLayout(headers: string[], map: SpaltenMap): boolean {
  if (!headers.includes('isin')) return false
  if (map.typ == null || map.betrag == null) return false
  if (map.stueck == null && !headers.includes('anteile') && !headers.includes('quantity')) return false
  const hatDatum =
    headers.includes('datum') || headers.includes('datum_uhrzeit') || headers.includes('date')
  const hatJahr = headers.includes('jahr') || headers.includes('year')
  if (!hatDatum && !hatJahr) return false
  return headers.includes('wertpapier') || headers.includes('name') || map.name != null
}

function erkenneFormat(headers: string[], map: SpaltenMap): CsvErkanntesFormat {
  if (istTransaktionenDeLayout(headers, map)) return 'transaktionen_de'

  const hatParqetPortfolio =
    headers.includes('identifier') &&
    headers.includes('holdingname') &&
    headers.includes('shares')

  const hatTrTransaktionsexport =
    !hatParqetPortfolio &&
    (headers.includes('datetime') || headers.includes('timestamp') || headers.includes('date')) &&
    map.typ != null &&
    map.betrag != null &&
    (headers.includes('category') ||
      headers.includes('transaction_id') ||
      headers.includes('symbol') ||
      headers.includes('fee') ||
      headers.includes('commission'))

  const hatTrAktivitaet =
    !hatParqetPortfolio &&
    (headers.includes('timestamp') || headers.includes('datetime')) &&
    map.typ != null &&
    (map.eingang != null || map.ausgang != null) &&
    (headers.includes('instrument') ||
      headers.includes('id') ||
      headers.includes('debit') ||
      headers.includes('credit'))

  const hatWertpapierOrder =
    !headers.includes('isin') &&
    !hatTrTransaktionsexport &&
    map.datum != null &&
    map.typ != null &&
    map.betrag != null &&
    (map.symbol != null || map.stueck != null) &&
    map.eingang == null &&
    map.ausgang == null

  const hatKontoauszug =
    !headers.includes('isin') &&
    map.datum != null &&
    (map.eingang != null || map.ausgang != null) &&
    (map.beschreibung != null || map.title != null || map.typ != null) &&
    !hatTrAktivitaet

  const hatDepot =
    !headers.includes('isin') &&
    (map.stueck != null || headers.includes('quantity')) &&
    (map.wert != null || map.kurs != null) &&
    (map.name != null || map.isin != null) &&
    map.datum == null &&
    !hatTrAktivitaet

  if (hatTrTransaktionsexport) return 'tr_transaktionsexport'
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
    /purchase|kauf|buy|saveback|round\s*up|withdrawal|auszahlung|outbound|fee|gebühr|commission|steuer|tax/i.test(
      t,
    )
  ) {
    return 'ausgang'
  }
  if (
    /sale|verkauf|sell|dividend|dividende|interest|zins|deposit|einzahlung|customer_inbound|inbound|gutschrift|payout/i.test(
      t,
    )
  ) {
    return 'eingang'
  }
  return null
}

function typZeileUeberspringen(typ: string): boolean {
  const t = typ.toLowerCase()
  if (CSV_TYP_UEBERSPRINGEN.has(t)) return true
  if (/isin.wechsel/i.test(t)) return true
  if (/ausbuchung|einbuchung/.test(t) && /wechsel|umtausch/i.test(t)) return true
  return false
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

function isinAusSymbolSpalte(symbolRaw: string): string {
  const s = symbolRaw.trim().toUpperCase()
  return ISIN_IN_SYMBOL.test(s) ? s : ''
}

function parseAnteileRaw(raw: string): number | null {
  const s = raw.trim().replace(/x\s*$/i, '').trim()
  if (!s) return null
  return parseGeldBetrag(s)
}

function datumAusZeile(cols: string[], map: SpaltenMap, _format: CsvErkanntesFormat): string | null {
  const datumRaw = map.datum != null ? cols[map.datum]?.trim().replace(/^\ufeff/, '') ?? '' : ''
  if (!datumRaw) return null
  if (map.jahr != null && /^\d{1,2}\.\d{1,2}\./.test(datumRaw)) {
    const jahr = cols[map.jahr]?.trim() ?? ''
    return parseDatumUhrzeitMitJahr(datumRaw, jahr)
  }
  return parseDeDatumZuIso(datumRaw)
}

function cashZeileAusCols(cols: string[], map: SpaltenMap, format: CsvErkanntesFormat): TrRawCashZeile | null {
  if (zeileIstKopfOderSumme(cols, map)) return null

  const datumRaw = map.datum != null ? cols[map.datum]?.trim() ?? '' : ''
  const datumIso = datumAusZeile(cols, map, format)
  if (!datumRaw || !datumIso) return null

  const typ = map.typ != null ? cols[map.typ]?.trim() ?? '' : ''
  const typNorm = typ.toLowerCase()
  if (typNorm === 'executed' || typNorm === 'cancelled' || typNorm === 'canceled') return null
  if (typZeileUeberspringen(typ)) return null

  const symbolRaw = map.symbol != null ? cols[map.symbol]?.trim() ?? '' : ''
  const name = map.name != null ? cols[map.name]?.trim() ?? '' : ''
  let isin =
    map.isin != null ? cols[map.isin]?.trim().replace(/^ISIN:?\s*/i, '').toUpperCase() ?? '' : ''
  if (!isin) isin = isinAusSymbolSpalte(symbolRaw)

  let beschreibung = ''
  if (map.description != null) beschreibung = cols[map.description]?.trim() ?? ''
  if (!beschreibung && map.beschreibung != null) beschreibung = cols[map.beschreibung]?.trim() ?? ''
  const title = map.title != null ? cols[map.title]?.trim() ?? '' : ''
  const subtitle = map.subtitle != null ? cols[map.subtitle]?.trim() ?? '' : ''
  if (!beschreibung && (title || subtitle)) {
    beschreibung = [title, subtitle].filter(Boolean).join(' — ')
  }
  if (!beschreibung && (format === 'tr_transaktionsexport' || format === 'transaktionen_de')) {
    const teile = [name, isin ? `ISIN ${isin}` : symbolRaw].filter(Boolean)
    beschreibung = teile.join(' ')
  } else if (!beschreibung) {
    beschreibung = [name, symbolRaw, isin ? `ISIN ${isin}` : ''].filter(Boolean).join(' ')
  }

  let stueck: number | null = null
  if (map.stueck != null) {
    const rawStueck = cols[map.stueck]?.trim() ?? ''
    if (rawStueck) {
      const n = parseAnteileRaw(rawStueck)
      if (n != null && n !== 0) stueck = Math.abs(n)
    }
  }
  if (stueck != null && !/\bStk\b/i.test(beschreibung)) {
    beschreibung = `${beschreibung} ${stueck} Stk`.trim()
  }

  let { eingang, ausgang } = betraegeAusSpalten(cols, map, typ)

  const feeBetrag = map.fee != null ? parseGeldBetrag(cols[map.fee]) : null
  if (feeBetrag != null && feeBetrag !== 0) {
    const feeAbs = Math.abs(feeBetrag)
    const feeStr = String(feeAbs).replace('.', ',')
    if (ausgang) {
      const bisher = positiverGeldbetrag(ausgang) ?? 0
      ausgang = String(bisher + feeAbs).replace('.', ',')
    } else if (eingang && /sell|verkauf|sale/i.test(typ)) {
      const bisher = positiverGeldbetrag(eingang) ?? 0
      eingang = String(Math.max(0, bisher - feeAbs)).replace('.', ',')
    } else if (!eingang && !ausgang) {
      ausgang = feeStr
    } else {
      const bisher = positiverGeldbetrag(ausgang) ?? 0
      ausgang = String(bisher + feeAbs).replace('.', ',')
    }
  }

  const taxBetrag = map.tax != null ? parseGeldBetrag(cols[map.tax]) : null
  let steuerEur: number | null =
    taxBetrag != null && taxBetrag !== 0 ? Math.round(Math.abs(taxBetrag) * 100) / 100 : null
  if (taxBetrag != null && taxBetrag !== 0) {
    const taxAbs = Math.abs(taxBetrag)
    if (eingang && /dividend|dividende|zins/i.test(typ)) {
      const bisher = positiverGeldbetrag(eingang) ?? 0
      eingang = String(Math.max(0, bisher - taxAbs)).replace('.', ',')
    } else if (!eingang && !ausgang) {
      ausgang = String(taxAbs).replace('.', ',')
    } else if (ausgang) {
      const bisher = positiverGeldbetrag(ausgang) ?? 0
      ausgang = String(bisher + taxAbs).replace('.', ',')
    }
  }

  const saldo = map.saldo != null ? cols[map.saldo]?.trim() ?? '' : ''

  if (!eingang && !ausgang) return null

  if (
    (format === 'tr_wertpapier_order' || format === 'tr_transaktionsexport' || format === 'transaktionen_de') &&
    !typ
  ) {
    return null
  }

  return {
    datum: datumIso,
    typ,
    beschreibung,
    zahlungseingang: eingang,
    zahlungsausgang: ausgang,
    saldo,
    isin: isin || undefined,
    stueck,
    steuerEur,
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
  transaktionen_de:
    'Transaktions-CSV (Datum oder Jahr+Datum_Uhrzeit; Typ; Name/Wertpapier; ISIN; Anteile; Betrag; Gebühren; Steuern). ISIN-Wechsel werden übersprungen.',
  tr_transaktionsexport:
    'Trade-Republic-Transaktionsexport (datetime, type, amount): Vorzeichen in „amount“, Gebühren aus „fee“. STOCKPERK/FREE_RECEIPT werden übersprungen.',
  tr_aktivitaet:
    'Trade-Republic-Aktivitäts-CSV (z. B. Portfolio-Performance-Export): Spalten Type, Debit, Credit — nicht „Status“.',
  tr_wertpapier_order:
    'Wertpapier-Order-CSV (Date/Symbol/Type/Amount): Beträge werden anhand von Kauf/Verkauf als Ausgang/Eingang gelesen.',
  kontoauszug_cash: 'Kontoauszug-CSV (Datum, Eingang, Ausgang, Beschreibung).',
  depot_positionen: 'Nur Depotpositionen — keine Kontobewegungen.',
  unbekannt: 'Unbekanntes Layout.',
}

/** Erkennt TR-CSV (Transaktionsexport, Aktivität, Kontoauszug …), nicht Parqet-Portfolio. */
export function istTradeRepublicCsv(text: string): boolean {
  const raw = text.replace(/^\ufeff/, '')
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  if (lines.length < 2) return false

  let headerIndex = 0
  for (let i = 0; i < Math.min(lines.length, 12); i++) {
    const probe = splitCsvLine(lines[i], detectDelimiter(lines[i])).map(normalizeHeader)
    if (
      probe.some((h) =>
        ['datum', 'date', 'datetime', 'timestamp', 'type', 'typ', 'debit', 'credit', 'amount'].includes(h),
      )
    ) {
      headerIndex = i
      break
    }
  }

  const delimiter = detectDelimiter(lines[headerIndex])
  const headers = splitCsvLine(lines[headerIndex], delimiter).map(normalizeHeader)
  if (
    headers.includes('identifier') &&
    headers.includes('holdingname') &&
    headers.includes('shares')
  ) {
    return false
  }
  const map = mappeSpalten(headers)
  return erkenneFormat(headers, map) !== 'unbekannt'
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
    'CSV-Formate: Transaktionen (Datum/ISIN/Betrag_EUR), TR-Transaktionsexport, Aktivitäts-CSV oder Kontoauszug.',
  )

  let headerIndex = 0
  for (let i = 0; i < Math.min(lines.length, 12); i++) {
    const probe = splitCsvLine(lines[i], detectDelimiter(lines[i])).map(normalizeHeader)
    if (
      probe.some((h) =>
        [
          'datum',
          'date',
          'datetime',
          'timestamp',
          'type',
          'typ',
          'instrument',
          'symbol',
          'amount',
          'betrag_eur',
          'debit',
          'category',
          'wertpapier',
          'datum_uhrzeit',
          'jahr',
          'name',
          'betrag',
        ].includes(h),
      )
    ) {
      headerIndex = i
      break
    }
  }

  const delimiter = detectDelimiter(lines[headerIndex])
  const headers = splitCsvLine(lines[headerIndex], delimiter).map(normalizeHeader)
  const map = mappeSpalten(headers)
  let format = erkenneFormat(headers, map)

  hinweise.push(FORMAT_HINWEISE[format])
  hinweise.push(`Spalten: ${headers.join(', ')}`)

  if (format === 'unbekannt') {
    if (istTransaktionenDeLayout(headers, map)) {
      format = 'transaktionen_de'
      hinweise[hinweise.length - 1] = FORMAT_HINWEISE.transaktionen_de
      hinweise.push('Format anhand ISIN/Typ/Betrag erkannt (Transaktions-CSV).')
    } else {
      hinweise.push(
        'Unbekanntes Layout. Erwartet z. B. „Datum;Typ;ISIN;Betrag“ oder TR-Export mit „date“ und „amount“. Erkannte Spalten siehe oben.',
      )
      return { cash: [], portfolio: [], crypto: [], meta: { format, delimiter, spalten: headers, hinweise } }
    }
  }

  const dataLines = lines.slice(headerIndex)
  let ergebnis = parseDatenzeilen(dataLines, delimiter, map, format)

  if (ergebnis.cash.length === 0 && istTransaktionenDeLayout(headers, map) && format !== 'transaktionen_de') {
    format = 'transaktionen_de'
    ergebnis = parseDatenzeilen(dataLines, delimiter, map, format)
    hinweise.push('Zweiter Lauf als Transaktions-CSV (Datum_Uhrzeit + Jahr).')
  }

  if (
    format === 'transaktionen_de' ||
    format === 'tr_transaktionsexport' ||
    format === 'tr_aktivitaet' ||
    format === 'kontoauszug_cash' ||
    format === 'tr_wertpapier_order'
  ) {
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
