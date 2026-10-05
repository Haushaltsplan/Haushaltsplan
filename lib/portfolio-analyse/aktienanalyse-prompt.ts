/**
 * Aktienanalyse — Prompt, Block-Typen und JSON-Schema für Gemini.
 */

export const AKTIENANALYSE_PROMPT_LS = 'pa-aktienanalyse-prompt-v1'

export type AktienanalyseTextBlock = {
  type: 'text'
  markdown: string
}

export type AktienanalyseChartBlock = {
  type: 'chart'
  titel?: string
  metrikIds: string[]
  jahre?: number
  variant?: 'standard' | 'bewertung'
}

export type AktienanalyseBlock = AktienanalyseTextBlock | AktienanalyseChartBlock

export type AktienanalyseBericht = {
  titel: string
  bloecke: AktienanalyseBlock[]
}

export type AktienanalyseEintrag = {
  id: string
  ticker: string
  titel: string
  promptSnapshot: string
  bericht: AktienanalyseBericht
  createdAt: string
}

/** Häufige Metrik-IDs aus Fundamentaldaten (Charts). */
export const AKTIENANALYSE_METRIK_IDS = [
  'umsatz',
  'bruttogewinn',
  'bruttomarge',
  'ebitda',
  'ebitda_marge',
  'ebit',
  'ebit_marge',
  'nettogewinn',
  'nettomarge',
  'eps',
  'ocf',
  'fcf',
  'fcf_marge',
  'capex',
  'sga',
  'rd',
  'sbc',
  'da',
  'dividenden_gezahlt',
  'free_cash_flow_yield',
  'kgv',
  'kgv_ntm',
  'ev_ebitda',
  'ev_sales',
  'ps',
  'roe',
  'roic',
] as const

export const AKTIENANALYSE_DEFAULT_PROMPT = `Du bist ein fundierter Aktienanalyst. Erstelle eine nüchterne, lesbare Analyse der vorliegenden Unternehmensdaten.

Regeln:
- Nur Deutsch.
- Nur Fakten aus dem gelieferten Datenkontext (Export JSON) — nichts erfinden, keine Kursziele, keine Kauf-/Verkaufsempfehlung.
- Struktur: Einleitung → Geschäft/Qualität → Wachstum & Profitabilität → Cashflow/Bilanz → Bewertung (falls Daten da) → Risiken → kurzes Fazit.
- Wenn du Wachstum, Umsatz, Margen, FCF, Bewertung o. Ä. über mehrere Jahre ansprichst: setze ZWISCHEN den Textabschnitten einen Chart-Block mit passenden metrikIds (z. B. umsatz, fcf, nettomarge).
- Chart-Blöcke nur mit IDs aus der erlaubten Liste; jahre typisch 5–10.
- Text als Markdown (## Überschriften, **fett**, Aufzählungen mit - ).
- Keine Meta-Kommentare („Datenlage dünn“ etc.) — fehlende Themen einfach weglassen.

Erlaubte metrikIds: ${AKTIENANALYSE_METRIK_IDS.join(', ')}

Antwort: NUR gültiges JSON gemäß Schema mit titel und bloecke (text | chart).`

export const AKTIENANALYSE_JSON_SCHEMA: Record<string, unknown> = {
  type: 'OBJECT',
  properties: {
    titel: { type: 'STRING' },
    bloecke: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          type: { type: 'STRING' },
          markdown: { type: 'STRING' },
          titel: { type: 'STRING' },
          metrikIds: { type: 'ARRAY', items: { type: 'STRING' } },
          jahre: { type: 'NUMBER' },
          variant: { type: 'STRING' },
        },
        required: ['type'],
      },
    },
  },
  required: ['titel', 'bloecke'],
}

export function normalisiereAktienanalyseBericht(raw: unknown): AktienanalyseBericht {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const titel = String(o.titel ?? 'Aktienanalyse').trim().slice(0, 200) || 'Aktienanalyse'
  const rawBloecke = Array.isArray(o.bloecke) ? o.bloecke : []
  const bloecke: AktienanalyseBlock[] = []
  const erlaubt = new Set(AKTIENANALYSE_METRIK_IDS.map((x) => x.toLowerCase()))

  for (const b of rawBloecke.slice(0, 40)) {
    if (!b || typeof b !== 'object') continue
    const row = b as Record<string, unknown>
    const type = String(row.type ?? '').toLowerCase()
    if (type === 'text') {
      const markdown = String(row.markdown ?? '').trim()
      if (markdown) bloecke.push({ type: 'text', markdown: markdown.slice(0, 12_000) })
      continue
    }
    if (type === 'chart') {
      const metrikIds = (Array.isArray(row.metrikIds) ? row.metrikIds : [])
        .map((x) => String(x).trim().toLowerCase())
        .filter((id) => id.length > 0)
        .slice(0, 6)
      // Unbekannte IDs behalten — Renderer filtert gegen Paket-Zeilen
      if (metrikIds.length === 0) continue
      void erlaubt
      const jahreRaw = Number(row.jahre)
      const jahre =
        Number.isFinite(jahreRaw) && jahreRaw >= 2 && jahreRaw <= 20 ? Math.round(jahreRaw) : 5
      const variant = row.variant === 'bewertung' ? 'bewertung' : 'standard'
      bloecke.push({
        type: 'chart',
        titel: row.titel != null ? String(row.titel).trim().slice(0, 120) : undefined,
        metrikIds,
        jahre,
        variant,
      })
    }
  }

  if (bloecke.length === 0) {
    bloecke.push({ type: 'text', markdown: '_Keine auswertbaren Analyse-Blöcke geliefert._' })
  }

  return { titel, bloecke }
}
