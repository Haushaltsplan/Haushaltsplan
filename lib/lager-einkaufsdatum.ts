/** Lokales Kalenderdatum (YYYY-MM-DD) → ISO (Mittag, damit UTC das Datum nicht verschiebt). */
export function einkaufsdatumLokalZuIsoMitMittag(yyyyMmDd: string): string {
  const m = yyyyMmDd.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) throw new Error('Einkaufsdatum bitte als gültiges Kalenderdatum (YYYY-MM-DD).')
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  const dt = new Date(y, mo - 1, d, 12, 0, 0, 0)
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) {
    throw new Error('Einkaufsdatum ungültig.')
  }
  return dt.toISOString()
}
