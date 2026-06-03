/** ISO-Datum (YYYY-MM-DD) + Tage addieren (UTC). */
export function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const t = Date.UTC(y, m - 1, d) + days * 86400000
  const dt = new Date(t)
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`
}

export function tageZwischenIso(von: string, bis: string): number {
  const [y1, m1, d1] = von.split('-').map(Number)
  const [y2, m2, d2] = bis.split('-').map(Number)
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000)
}

export function heuteIsoUtc(): string {
  const d = new Date()
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
}

export function isoVorJahren(jahre: number): string {
  const d = new Date()
  d.setUTCFullYear(d.getUTCFullYear() - jahre)
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
}

export function isoInJahren(jahre: number): string {
  const d = new Date()
  d.setUTCFullYear(d.getUTCFullYear() + jahre)
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
}

export function median(values: number[]): number {
  if (values.length === 0) return 0
  const s = [...values].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid]
}

/** Finnhub/Yahoo: US-Ticker und Xetra-Variante probieren. */
export function brokerSymbolKandidaten(sym: string): string[] {
  const s = sym.trim().toUpperCase()
  if (!s) return []
  const out = [s]
  const m = /^([A-Z0-9-]+)\.(DE|F|PA|AS|L|SW|MI|MC|ST|HK|T|TO|AX|NZ|US)$/i.exec(s)
  if (m) {
    const base = m[1]
    if (!out.includes(base)) out.push(base)
  }
  if (!s.includes('.') && s.length <= 6) {
    if (!out.includes(`${s}.DE`)) out.push(`${s}.DE`)
  }
  return out
}
