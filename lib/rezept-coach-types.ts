import { normalisiereRezeptKategorie } from '@/lib/lager-rezept-katalog-kategorie'

/** Strukturierte Antwort des Rezept-Coaches (KI → App). */

export type RezeptZutatZeile = {
  /** UUID aus dem mitgeschickten Lager — leer wenn Zutat nicht aus dem Lager. */
  produkt_id?: string | null
  name: string
  menge: number
  einheit: string
  aus_lager: boolean
}

export type RezeptGericht = {
  titel: string
  portionen: number
  zutaten: RezeptZutatZeile[]
  /** Kurze bis mittlere Kochschritte; Details können per Nachfrage kommen. */
  kochschritte: string[]
  /**
   * Geschätzte Kilokalorien fürs **gesamte** Gericht (alle Portionen zusammen).
   * Richtwert aus Zutatenmengen — keine Nährwertanalyse, keine medizinische Aussage.
   */
  geschaetzte_kcal_gesamt?: number | null
  /** Katalog-Kategorie (z. B. Vegetarisch, Nudelgericht) — laut App-Liste normalisiert. */
  kategorie: string
}

export type RezeptCoachAntwort = {
  einleitung?: string
  rezepte: RezeptGericht[]
}

/** Positive Ganzzahl kcal fürs Gesamtgericht, sonst null (ungültig oder fehlend). */
export function normalisiereKcalGesamt(v: unknown): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(String(v).replace(',', '.')) : Number.NaN
  if (!Number.isFinite(n) || n <= 0) return null
  const r = Math.round(n)
  if (r > 50_000) return null
  return r
}

const PORTIONEN_MIN = 0.5
const PORTIONEN_MAX = 99

function clampPortionen(n: number): number {
  if (!Number.isFinite(n)) return 1
  const r = Math.round(n * 2) / 2
  return Math.min(PORTIONEN_MAX, Math.max(PORTIONEN_MIN, r))
}

/**
 * Skaliert Zutatenmengen und Gesamt-kcal proportional (Rezept ist für `basisPortionen` Personen erfasst).
 */
export function skaliereRezeptAufPortionen(g: RezeptGericht, basisPortionen: number, zielPortionen: number): RezeptGericht {
  const basis = Number.isFinite(basisPortionen) && basisPortionen >= PORTIONEN_MIN ? basisPortionen : 1
  const ziel = clampPortionen(zielPortionen)
  const f = ziel / basis
  const kcal = normalisiereKcalGesamt(g.geschaetzte_kcal_gesamt)
  return {
    ...g,
    portionen: ziel,
    zutaten: (g.zutaten || []).map((z) => ({
      ...z,
      menge: Math.round(z.menge * f * 10000) / 10000,
    })),
    ...(kcal != null ? { geschaetzte_kcal_gesamt: Math.max(1, Math.round(kcal * f)) } : {}),
  }
}

/** Ein gespeichertes `gericht_json` aus der DB oder Roh-JSON validieren. */
export function parseEinzelGericht(raw: unknown): RezeptGericht | null {
  if (!raw || typeof raw !== 'object') return null
  const g = raw as Record<string, unknown>
  const titel = typeof g.titel === 'string' ? g.titel.trim() : ''
  const portionen = Number(g.portionen)
  if (!titel || !Number.isFinite(portionen) || portionen < 0.5) return null

  const zutaten: RezeptZutatZeile[] = []
  if (Array.isArray(g.zutaten)) {
    for (const zr of g.zutaten) {
      if (!zr || typeof zr !== 'object') continue
      const z = zr as Record<string, unknown>
      const name = typeof z.name === 'string' ? z.name.trim() : ''
      const menge = Number(z.menge)
      const einheit = typeof z.einheit === 'string' ? z.einheit.trim() : ''
      const aus_lager = z.aus_lager === true
      const pid = typeof z.produkt_id === 'string' ? z.produkt_id.trim() : ''
      if (!name || !Number.isFinite(menge) || menge <= 0 || !einheit) continue
      zutaten.push({
        produkt_id: pid || null,
        name,
        menge: Math.round(menge * 1000) / 1000,
        einheit,
        aus_lager,
      })
    }
  }

  const kochschritte: string[] = []
  if (Array.isArray(g.kochschritte)) {
    for (const s of g.kochschritte) {
      if (typeof s === 'string' && s.trim()) kochschritte.push(s.trim())
    }
  }

  const kcalNorm = normalisiereKcalGesamt(g.geschaetzte_kcal_gesamt)

  const rawKat = g.kategorie
  const kategorieNorm =
    rawKat != null && String(rawKat).trim()
      ? normalisiereRezeptKategorie(rawKat) ?? 'Sonstiges'
      : 'Sonstiges'

  return {
    titel,
    portionen,
    zutaten,
    kochschritte,
    kategorie: kategorieNorm,
    ...(kcalNorm != null ? { geschaetzte_kcal_gesamt: kcalNorm } : {}),
  }
}

export function formatRezeptAntwortAlsMarkdown(a: RezeptCoachAntwort): string {
  const parts: string[] = []
  if (a.einleitung?.trim()) parts.push(a.einleitung.trim())
  for (const r of a.rezepte || []) {
    parts.push(`### ${r.titel}`)
    parts.push(`*Für ca. ${Math.round(r.portionen)} Portion(en).*`)
    if (r.kategorie.trim()) {
      parts.push(`*Kategorie: ${r.kategorie.trim()}.*`)
    }
    const kcal = normalisiereKcalGesamt(r.geschaetzte_kcal_gesamt)
    if (kcal != null) {
      parts.push(`*Geschätzt: ca. **${kcal}** kcal fürs gesamte Gericht (alle Portionen) — unverbindliche Schätzung.*`)
    }
    parts.push('**Zutaten**')
    for (const z of r.zutaten || []) {
      const tag = z.aus_lager ? ' _(aus Lager)_' : ''
      parts.push(`- **${z.menge} ${z.einheit}** ${z.name}${tag}`)
    }
    if (r.kochschritte?.length) {
      parts.push('**Schritt-für-Schritt**')
      r.kochschritte.forEach((s, i) => parts.push(`${i + 1}. ${s}`))
    }
    parts.push('')
  }
  return parts.join('\n').trim()
}

/** Extrahiert das erste JSON-Objekt mit \`"rezepte"\` (z. B. nach Markdown-Fences). */
export function extractFirstRezeptJsonObject(text: string): string | null {
  const t = text.trim()
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const inner = fence ? fence[1].trim() : t
  if (inner.startsWith('{')) return inner
  const m = inner.match(/\{[\s\S]*"rezepte"[\s\S]*\}/)
  return m ? m[0] : null
}

export function parseRezeptCoachAntwortJson(text: string): RezeptCoachAntwort | null {
  const blob = extractFirstRezeptJsonObject(text)
  if (!blob) return null
  let raw: unknown
  try {
    raw = JSON.parse(blob) as unknown
  } catch {
    return null
  }
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const rezepteRaw = o.rezepte
  if (!Array.isArray(rezepteRaw) || rezepteRaw.length === 0) return null

  const rezepte: RezeptGericht[] = []
  for (const item of rezepteRaw) {
    const ger = parseEinzelGericht(item)
    if (ger) rezepte.push(ger)
  }

  if (!rezepte.length) return null
  const einleitung = typeof o.einleitung === 'string' ? o.einleitung.trim() : ''
  return { einleitung: einleitung || undefined, rezepte }
}
