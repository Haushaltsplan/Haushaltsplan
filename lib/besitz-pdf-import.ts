import { normalisiereBesitzKategorie } from '@/lib/besitz-kategorien'

export type BesitzPdfPosition = {
  name: string
  kategorie: string
  einkaufspreis_eur: number
  einkaufsdatum: string | null
  haendler: string | null
  hersteller: string | null
  notiz: string | null
}

function extractJsonObject(text: string): string | null {
  const t = text.trim()
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const inner = fence ? fence[1].trim() : t
  if (inner.startsWith('{')) return inner
  const m = inner.match(/\{[\s\S]*"positionen"[\s\S]*\}/)
  return m ? m[0] : null
}

function isoDatumOderNull(v: unknown): string | null {
  if (v == null) return null
  const s = String(v).trim().slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null
  return s
}

/** Roh-Antwort der KI → normalisierte Positionen (leere/unbrauchbare Zeilen fallen raus). */
export function parseBesitzPdfKiJson(raw: string): BesitzPdfPosition[] {
  const blob = extractJsonObject(raw)
  if (!blob) return []
  let o: unknown
  try {
    o = JSON.parse(blob) as unknown
  } catch {
    return []
  }
  if (!o || typeof o !== 'object') return []
  const rec = o as Record<string, unknown>
  const arr = rec.positionen
  if (!Array.isArray(arr)) return []

  const out: BesitzPdfPosition[] = []
  for (const item of arr) {
    if (!item || typeof item !== 'object') continue
    const p = item as Record<string, unknown>
    const name = typeof p.name === 'string' ? p.name.trim() : ''
    if (!name || name.length > 500) continue
    const preis = typeof p.einkaufspreis_eur === 'number' ? p.einkaufspreis_eur : Number(p.einkaufspreis_eur)
    if (!Number.isFinite(preis) || preis < 0 || preis > 1_000_000) continue
    const kat = normalisiereBesitzKategorie(p.kategorie)
    const haendler = typeof p.haendler === 'string' && p.haendler.trim() ? p.haendler.trim().slice(0, 200) : null
    const herstellerRaw = p.hersteller ?? p.marke
    const hersteller =
      typeof herstellerRaw === 'string' && herstellerRaw.trim() ? herstellerRaw.trim().slice(0, 200) : null
    const notiz = typeof p.notiz === 'string' && p.notiz.trim() ? p.notiz.trim().slice(0, 500) : null
    const einkaufsdatum = isoDatumOderNull(p.einkaufsdatum)
    out.push({
      name: name.slice(0, 300),
      kategorie: kat,
      einkaufspreis_eur: Math.round(preis * 100) / 100,
      einkaufsdatum,
      haendler,
      hersteller,
      notiz,
    })
    if (out.length >= 80) break
  }
  return out
}
