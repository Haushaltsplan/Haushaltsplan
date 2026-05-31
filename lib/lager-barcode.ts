/** Barcode/EAN auf Ziffern normalisieren (Scanner liefert teils Leerzeichen oder Präfixe). */
export function lagerBarcodeNorm(code: string): string {
  return String(code || '').trim().replace(/\D/g, '')
}

/** Vergleicht zwei Barcodes (EAN-13 vs. UPC-A mit führender 0). */
export function lagerBarcodesGleich(a: string, b: string): boolean {
  const na = lagerBarcodeNorm(a)
  const nb = lagerBarcodeNorm(b)
  if (!na || !nb) return false
  if (na === nb) return true
  return na.padStart(13, '0') === nb.padStart(13, '0')
}
