import type { CoachMessage } from '@/lib/ki-coach-backend'
import { resolveCoachProvider, runCoachCompletion } from '@/lib/ki-coach-backend'

const INVOICE_IMAGE_SCHEMA: Record<string, unknown> = {
  type: 'OBJECT',
  properties: {
    amount: { type: 'NUMBER', description: 'Endbetrag / Zahlbetrag in EUR (positive Zahl).' },
    vendor: { type: 'STRING', nullable: true, description: 'Absender / Lieferant / Shopname.' },
    date_candidates: {
      type: 'ARRAY',
      description: 'Bis 12 plausible Rechnungsdaten, beste zuerst.',
      items: {
        type: 'OBJECT',
        properties: {
          iso: { type: 'STRING', description: 'YYYY-MM-DD' },
          display: { type: 'STRING', description: 'TT/MM/JJJJ' },
          hint: { type: 'STRING', description: 'Kurz, z. B. „Rechnungsdatum“' },
        },
        required: ['iso', 'display', 'hint'],
      },
    },
  },
  required: ['amount', 'date_candidates'],
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

function parseVisionJson(reply: string): unknown {
  const t = reply.trim()
  try {
    return JSON.parse(t) as unknown
  } catch {
    const start = t.indexOf('{')
    const end = t.lastIndexOf('}')
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(t.slice(start, end + 1)) as unknown
      } catch {
        return null
      }
    }
    return null
  }
}

function normalizeDateCandidates(raw: unknown): Array<{ iso: string; display: string; hint: string }> {
  if (!Array.isArray(raw)) return []
  const out: Array<{ iso: string; display: string; hint: string }> = []
  const seen = new Set<string>()
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const o = item as Record<string, unknown>
    const iso = typeof o.iso === 'string' ? o.iso.trim() : ''
    const display = typeof o.display === 'string' ? o.display.trim() : ''
    const hint = typeof o.hint === 'string' ? o.hint.trim() : 'KI'
    if (!ISO_DATE.test(iso) || !display) continue
    if (seen.has(iso)) continue
    seen.add(iso)
    out.push({ iso, display, hint: hint || 'KI' })
    if (out.length >= 12) break
  }
  return out
}

/**
 * Rechnungsfoto (PNG/JPEG): KI liefert dieselbe Struktur wie die PDF-Textauswertung.
 */
export async function parseInvoiceImageMitVision(
  bytes: Buffer,
  mimeType: 'image/jpeg' | 'image/png',
): Promise<
  | {
      ok: true
      amount: number
      vendor: string | null
      invoiceDate: { iso: string; display: string } | null
      invoiceDateCandidates: Array<{ iso: string; display: string; hint: string }>
    }
  | { ok: false; status: number; error: string }
> {
  const resolved = resolveCoachProvider()
  if (!resolved) {
    return {
      ok: false,
      status: 501,
      error:
        'KI ist nicht konfiguriert (wie Finanz-Coach): GEMINI_API_KEY oder OPENAI_API_KEY in .env.local, Dev-Server neu starten.',
    }
  }

  const base64 = bytes.toString('base64')
  const systemText = `Du liest eine **Rechnung oder einen Kassenbeleg** auf einem Bild (Deutschland/EU).

Antwort: **nur** ein JSON-Objekt mit:
- \`amount\` (Pflicht): **Zahlbetrag / Endbetrag** in Euro als Zahl (Komma im Bild = Dezimalstelle). Keine Tausender-Symbole in der Zahl. Positiv.
- \`vendor\` (optional): Firmenname / Shop / Lieferant oben auf dem Beleg. Kurz, ohne Adresse. Wenn unklar: null oder "".
- \`date_candidates\` (Pflicht, Array, kann leer sein): bis **12** plausible **Rechnungs-/Belegdaten**, wahrscheinlichstes zuerst. Nicht Lieferdatum, nicht „Zahlbar bis“, nicht Leistungszeitraum — bevorzugt „Rechnungsdatum“, „Datum“, „Kassendatum“.
  Jedes Element: \`iso\` als \`YYYY-MM-DD\`, \`display\` als \`TT/MM/JJJJ\` (europäisch), \`hint\` kurz auf Deutsch (z. B. „Rechnungsdatum“).

Wenn **kein** Betrag erkennbar: setze \`amount\` auf **0** (der Server lehnt das ab).`

  const userMessages: CoachMessage[] = [
    {
      role: 'user',
      content: 'Extrahiere Betrag, Anbieter und Rechnungsdatum(e) aus diesem Belegbild.',
      images: [{ mimeType, base64 }],
    },
  ]

  const ki = await runCoachCompletion(resolved.provider, resolved.apiKey, systemText, userMessages, {
    temperature: 0.15,
    jsonResponse: { schema: INVOICE_IMAGE_SCHEMA },
  })

  if (!ki.ok) {
    return { ok: false, status: ki.status, error: ki.hint || 'KI-Auswertung fehlgeschlagen.' }
  }

  const parsed = parseVisionJson(ki.reply)
  if (!parsed || typeof parsed !== 'object') {
    return { ok: false, status: 502, error: 'Ungültige KI-Antwort (kein JSON).' }
  }

  const o = parsed as Record<string, unknown>
  const amountRaw = o.amount
  const amount = typeof amountRaw === 'number' ? amountRaw : Number(amountRaw)
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, status: 422, error: 'Keinen Rechnungsbetrag im Bild erkannt.' }
  }

  const vendorRaw = o.vendor
  let vendor: string | null = null
  if (typeof vendorRaw === 'string') {
    const t = vendorRaw.trim()
    if (t) vendor = t
  }

  const invoiceDateCandidates = normalizeDateCandidates(o.date_candidates)
  const invoiceDate =
    invoiceDateCandidates.length > 0
      ? { iso: invoiceDateCandidates[0]!.iso, display: invoiceDateCandidates[0]!.display }
      : null

  return {
    ok: true,
    amount,
    vendor,
    invoiceDate,
    invoiceDateCandidates,
  }
}
