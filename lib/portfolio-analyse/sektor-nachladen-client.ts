/** Lädt fehlende Yahoo-Sektoren für Symbole nach (Sonstige-Auflösung). */
export async function ladeSektorenNach(symbols: string[]): Promise<Map<string, string>> {
  const unique = [
    ...new Set(
      symbols
        .map((s) => s.trim().toUpperCase().split('.')[0]!)
        .filter(Boolean),
    ),
  ]
  if (unique.length === 0) return new Map()

  const res = await fetch('/api/portfolio-analyse/sektor', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ symbols: unique.slice(0, 80) }),
  })
  const j = (await res.json()) as { ok?: boolean; sectors?: Record<string, string> }
  if (!j.ok || !j.sectors) return new Map()
  return new Map(Object.entries(j.sectors))
}
