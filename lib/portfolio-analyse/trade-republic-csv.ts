import type { TrPdfParseErgebnis, TrRawCashZeile } from '@/lib/portfolio-analyse/trade-republic-pdf-parser'

function splitCsvLine(line: string, delimiter: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
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
  return counts[0]?.c ? counts[0].d : ';'
}

function normalizeHeader(h: string): string {
  return h
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
}

/** CSV aus TR-Konvertern (Kontoauszug-Tool, Semicolon-Export). Kein Server, nur Text. */
export function parseTradeRepublicCsvText(text: string): TrPdfParseErgebnis {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  if (lines.length < 2) return { cash: [], portfolio: [], crypto: [] }

  const delimiter = detectDelimiter(lines[0])
  const headers = splitCsvLine(lines[0], delimiter).map(normalizeHeader)

  const idx = (aliases: string[]) => headers.findIndex((h) => aliases.includes(h))

  const datumIdx = idx(['datum', 'date', 'timestamp'])
  const typIdx = idx(['typ', 'type', 'zahlungsart'])
  const beschreibungIdx = idx(['beschreibung', 'description', 'title', 'name', 'subtitle', 'wertpapier'])
  const eingangIdx = idx(['zahlungseingang', 'eingang', 'money_in', 'credit', 'in'])
  const ausgangIdx = idx(['zahlungsausgang', 'ausgang', 'money_out', 'debit', 'out'])
  const betragIdx = idx(['betrag', 'amount', 'value'])
  const saldoIdx = idx(['saldo', 'balance'])

  const cash: TrRawCashZeile[] = []

  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i], delimiter)
    if (cols.every((c) => !c)) continue

    const datum = datumIdx >= 0 ? cols[datumIdx] ?? '' : cols[0] ?? ''
    const typ = typIdx >= 0 ? cols[typIdx] ?? '' : cols[1] ?? ''
    const beschreibung =
      beschreibungIdx >= 0
        ? cols[beschreibungIdx] ?? ''
        : cols.slice(2, Math.max(3, cols.length - 3)).join(' ')

    let zahlungseingang = eingangIdx >= 0 ? cols[eingangIdx] ?? '' : ''
    let zahlungsausgang = ausgangIdx >= 0 ? cols[ausgangIdx] ?? '' : ''
    const saldo = saldoIdx >= 0 ? cols[saldoIdx] ?? '' : ''

    if (!zahlungseingang && !zahlungsausgang && betragIdx >= 0) {
      const betrag = cols[betragIdx] ?? ''
      if (betrag.includes('-')) zahlungsausgang = betrag.replace('-', '').trim()
      else zahlungseingang = betrag
    }

    cash.push({
      datum,
      typ,
      beschreibung,
      zahlungseingang,
      zahlungsausgang,
      saldo,
    })
  }

  return { cash, portfolio: [], crypto: [] }
}
