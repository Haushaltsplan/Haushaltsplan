import {
  normalisiereKalenderKategorie,
  parseIsoDatum,
  type KalenderKategorieId,
} from '@/lib/haushalt-kalender'
import { resolveCoachProvider, runCoachCompletion, type CoachMessage } from '@/lib/ki-coach-backend'

/** Gemini `responseSchema` (OpenAPI-ähnlich) */
const KALENDER_FOTO_SCHEMA: Record<string, unknown> = {
  type: 'OBJECT',
  properties: {
    events: {
      type: 'ARRAY',
      description:
        'Alle erkennbaren Kalender-Einträge (0–25). Ein Eintrag = ein konkreter Tag mit Titel; bei mehrtägigem Urlaub ggf. Start- und Enddatum als zwei Einträge oder ein Eintrag am Starttag.',
      items: {
        type: 'OBJECT',
        properties: {
          titel: { type: 'STRING', description: 'Kurzer Titel (z. B. Zahnarzt, Meeting, Flug BER).' },
          datum: { type: 'STRING', description: 'Datum im Format YYYY-MM-DD (Kalendertag des Termins).' },
          uhrzeit: {
            type: 'STRING',
            nullable: true,
            description: 'Beginn als HH:MM (24h), leer wenn nicht erkennbar.',
          },
          kategorie: {
            type: 'STRING',
            description:
              'Eine von: geburtstag, termin, urlaub, feiertag, erinnerung, sonstiges (Arzt/Büro/Meeting = termin; Reise/Ferien = urlaub).',
          },
        },
        required: ['titel', 'datum', 'kategorie'],
      },
    },
  },
  required: ['events'],
}

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

function normalisiereUhrzeit(raw: unknown): string {
  if (raw == null) return ''
  const s = String(raw).trim()
  if (!s) return ''
  const m = s.match(/^(\d{1,2})[:h.](\d{2})/i)
  if (!m) return ''
  let h = Number.parseInt(m[1], 10)
  let min = Number.parseInt(m[2], 10)
  if (!Number.isFinite(h) || !Number.isFinite(min)) return ''
  if (h > 23 && h < 100) {
    min = h % 100
    h = Math.floor(h / 100)
  }
  h = Math.min(23, Math.max(0, h))
  min = Math.min(59, Math.max(0, min))
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`
}

export type KalenderFotoImportZeile = {
  titel: string
  datum: string
  uhrzeit: string
  kategorie: KalenderKategorieId
}

const MAX_EVENTS = 25

function validiereUndMappeEvents(raw: unknown): KalenderFotoImportZeile[] {
  if (!raw || typeof raw !== 'object') return []
  const o = raw as Record<string, unknown>
  const arr = o.events
  if (!Array.isArray(arr)) return []
  const out: KalenderFotoImportZeile[] = []
  for (const item of arr) {
    if (!item || typeof item !== 'object') continue
    const e = item as Record<string, unknown>
    const titel = typeof e.titel === 'string' ? e.titel.trim() : ''
    const datum = typeof e.datum === 'string' ? e.datum.trim() : ''
    if (!titel || !/^\d{4}-\d{2}-\d{2}$/.test(datum)) continue
    if (!parseIsoDatum(datum)) continue
    const uhrzeit = normalisiereUhrzeit(e.uhrzeit)
    const kategorie = normalisiereKalenderKategorie(e.kategorie)
    out.push({ titel: titel.slice(0, 200), datum, uhrzeit, kategorie })
    if (out.length >= MAX_EVENTS) break
  }
  return out
}

/**
 * Liest ein Foto (Einladung, Ticket, Arztbrief, Screenshot) und extrahiert Kalendereinträge.
 * Nutzt dieselbe KI-Konfiguration wie Finanz-Coach / Rechnungsfoto (GEMINI_API_KEY oder OPENAI_API_KEY).
 */
export async function extrahiereKalenderEventsAusFoto(
  bytes: Buffer,
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp',
): Promise<
  | { ok: true; events: KalenderFotoImportZeile[] }
  | { ok: false; status: number; error: string }
> {
  const resolved = resolveCoachProvider()
  if (!resolved) {
    return {
      ok: false,
      status: 501,
      error:
        'KI ist nicht konfiguriert: Lege GEMINI_API_KEY oder OPENAI_API_KEY in .env.local an (wie Finanz-Coach), Dev-Server neu starten.',
    }
  }

  const base64 = bytes.toString('base64')
  const systemText = `Du siehst ein Foto oder Screenshot, das für einen **privaten Kalender** relevant sein kann (Einladung, Ticket, Arzttermin, Meeting, Geburtstag, Urlaub/Ferien, Erinnerung).

Gib **nur** ein JSON-Objekt mit dem Feld \`events\` (Array, 0–${MAX_EVENTS} Einträge). Jeder Eintrag:
- \`titel\` (Pflicht): kurz, typisch was im Kalender stehen soll.
- \`datum\` (Pflicht): **YYYY-MM-DD** des Termins (lokale Lesart des Bildes; Jahreszahl ggf. aus dem Kontext, sonst plausibel).
- \`uhrzeit\`: **HH:MM** in 24h, oder leer/null wenn unklar.
- \`kategorie\` (Pflicht): genau eine von: \`geburtstag\`, \`termin\`, \`urlaub\`, \`feiertag\`, \`erinnerung\`, \`sonstiges\`.
  - Arzt, Behörde, Meeting, Termin mit Uhrzeit → meist \`termin\`.
  - Geburtstag explizit → \`geburtstag\`.
  - Reise, Hotel, Flug als Zeitraum → \`urlaub\` oder \`termin\` je nach Kontext.
  - Feiertage laut Kalender → \`feiertag\`.
Wenn **nichts** Passendes erkennbar ist: \`events: []\`.
Keine Erklärtexte außerhalb des JSON.`

  const userMessages: CoachMessage[] = [
    {
      role: 'user',
      content:
        'Extrahiere alle sinnvollen Kalendereinträge aus diesem Bild. Antworte nur mit JSON gemäß Systemanweisung.',
      images: [{ mimeType, base64 }],
    },
  ]

  const ki = await runCoachCompletion(resolved.provider, resolved.apiKey, systemText, userMessages, {
    temperature: 0.2,
    jsonResponse: { schema: KALENDER_FOTO_SCHEMA },
  })

  if (!ki.ok) {
    return { ok: false, status: ki.status, error: ki.hint || 'KI-Auswertung fehlgeschlagen.' }
  }

  const parsed = parseVisionJson(ki.reply)
  const events = validiereUndMappeEvents(parsed)
  return { ok: true, events }
}
