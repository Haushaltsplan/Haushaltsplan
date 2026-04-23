import { NextResponse } from 'next/server'
import pdf from 'pdf-parse/lib/pdf-parse.js'
import { BESITZ_KATEGORIEN } from '@/lib/besitz-kategorien'
import { parseBesitzPdfKiJson } from '@/lib/besitz-pdf-import'
import type { CoachMessage } from '@/lib/ki-coach-backend'
import { resolveCoachProvider, runCoachCompletion } from '@/lib/ki-coach-backend'

export const runtime = 'nodejs'

const MAX_PDF_TEXT_CHARS = 14_000
/** Gescannte PDFs ohne Textlayer: direkt an Gemini (inline PDF), Größenlimit grob unter API-Limits. */
const MAX_PDF_INLINE_BYTES = 10 * 1024 * 1024

const BESITZ_PDF_GEMINI_SCHEMA: Record<string, unknown> = {
  type: 'OBJECT',
  properties: {
    positionen: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          name: { type: 'STRING' },
          kategorie: { type: 'STRING' },
          einkaufspreis_eur: { type: 'NUMBER' },
          einkaufsdatum: { type: 'STRING', nullable: true },
          haendler: { type: 'STRING', nullable: true },
          hersteller: { type: 'STRING', nullable: true },
          notiz: { type: 'STRING', nullable: true },
        },
        required: ['name', 'kategorie', 'einkaufspreis_eur'],
      },
    },
  },
  required: ['positionen'],
}

function buildSystemPrompt(): string {
  const cats = BESITZ_KATEGORIEN.map((c) => `\`${c}\``).join(', ')
  return `Du extrahierst gekaufte **Waren und Artikel** aus dem Text eines **Kassenbons oder einer Rechnung** (z. B. Mode, Schuhe, Elektronik, Haushalt).

Antwort: **Nur** ein JSON-Objekt mit genau einem Feld \`positionen\` (Array). Jedes Listenelement:
- \`name\` (Pflicht): kurze Produktbezeichnung auf Deutsch.
- \`kategorie\` (Pflicht): **genau eine** dieser Bezeichnungen, exakt so geschrieben: ${cats}.
- \`einkaufspreis_eur\` (Pflicht): **positive** Zahl in Euro für diese Position (Zeilensumme; wenn nur Stückpreis × Menge erkennbar, das Produkt von Rabatt-/Gutscheinzeilen trennen).
- \`einkaufsdatum\` (optional): \`YYYY-MM-DD\` nur wenn eindeutig im Text.
- \`haendler\` (optional): Filiale, Kette oder **Verkaufs**-Shop (wo gekauft), nicht die Marke.
- \`hersteller\` (optional): **Marke oder Hersteller** der Ware (z. B. Nike, Apple, Bosch), wenn im Beleg erkennbar — sonst weglassen oder null.
- \`notiz\` (optional): z. B. Größe, Farbe, Artikelnummer — kurz.

**Nicht** übernehmen: Zeilen wie „Summe“, „Gesamt“, „MwSt“, „Pfand“, „Rabatt“, „Gutschein“, „Barzahlung“, „VISA“, „EC-Terminal“, reine Servicegebühren ohne Ware.

Wenn der Text **keine** brauchbaren Produktzeilen enthält: \`positionen\` = leeres Array \`[]\`.`
}

export async function POST(request: Request) {
  const resolved = resolveCoachProvider()
  if (!resolved) {
    return NextResponse.json(
      {
        error:
          'KI ist nicht konfiguriert (wie Finanz-Coach): GEMINI_API_KEY oder OPENAI_API_KEY in .env.local, Dev-Server neu starten.',
      },
      { status: 501 },
    )
  }

  const contentType = request.headers.get('content-type') || ''
  if (!contentType.includes('multipart/form-data')) {
    return NextResponse.json({ error: 'Bitte Datei per Formular-Upload senden.' }, { status: 400 })
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Ungültiges Formular.' }, { status: 400 })
  }

  const file = formData.get('file')
  if (!file || typeof file === 'string') {
    return NextResponse.json({ error: 'Keine Datei empfangen.' }, { status: 400 })
  }

  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
  if (!isPdf) {
    return NextResponse.json({ error: 'Bitte eine PDF-Datei hochladen.' }, { status: 400 })
  }

  const dateiname = typeof file.name === 'string' ? file.name : 'beleg.pdf'
  let bytes: Buffer
  try {
    bytes = Buffer.from(await file.arrayBuffer())
  } catch (e) {
    console.error('besitz/pdf-import buffer', e)
    return NextResponse.json({ error: 'Datei konnte nicht gelesen werden.' }, { status: 500 })
  }

  let text: string
  try {
    const parsed = await pdf(Buffer.from(bytes))
    text = (parsed.text || '').trim()
  } catch (e) {
    console.error('besitz/pdf-import pdf-parse', e)
    return NextResponse.json({ error: 'PDF konnte nicht gelesen werden.' }, { status: 500 })
  }

  const systemText = buildSystemPrompt()
  let userMessages: CoachMessage[]
  let hinweisPrefix = ''

  if (text) {
    const gekuerzt =
      text.length > MAX_PDF_TEXT_CHARS ? text.slice(0, MAX_PDF_TEXT_CHARS) + '\n\n[… Text gekürzt …]' : text
    userMessages = [{ role: 'user', content: `Dateiname: ${dateiname}\n\n--- Belegtext ---\n${gekuerzt}` }]
  } else {
    if (resolved.provider !== 'gemini') {
      return NextResponse.json(
        {
          error:
            'Dieses PDF hat keinen auswählbaren Text (häufig ein **gescannter** Beleg). Dafür wird **Google Gemini** benötigt: `GEMINI_API_KEY` in `.env.local` setzen (oder `FINANCE_COACH_PROVIDER=gemini`), Dev-Server neu starten. Mit nur OpenAI funktioniert hier kein reines Bild-PDF.',
        },
        { status: 422 },
      )
    }
    if (bytes.length > MAX_PDF_INLINE_BYTES) {
      return NextResponse.json(
        {
          error: `PDF ist zu groß für die direkte Analyse (max. ca. ${Math.round(MAX_PDF_INLINE_BYTES / (1024 * 1024))} MB).`,
        },
        { status: 413 },
      )
    }
    const b64 = bytes.toString('base64')
    userMessages = [
      {
        role: 'user',
        content: `Dateiname: ${dateiname}\n\nDer Beleg liegt als **PDF ohne Textlayer** vor (z. B. Scan oder Foto im PDF). Bitte den sichtbaren Kassenbon bzw. die Rechnung **als Dokument** lesen und alle **Wareneinkäufe** mit Zeilenpreisen gemäß Systemanweisung als JSON extrahieren.`,
        images: [{ mimeType: 'application/pdf', base64: b64 }],
      },
    ]
    hinweisPrefix = 'Erkennung aus gescanntem PDF (Gemini). '
  }

  try {
    const result = await runCoachCompletion(resolved.provider, resolved.apiKey, systemText, userMessages, {
      temperature: 0.15,
      jsonResponse: { schema: BESITZ_PDF_GEMINI_SCHEMA },
    })

    if (!result.ok) {
      return NextResponse.json({ error: `KI: ${result.hint}` }, { status: 502 })
    }

    const positionen = parseBesitzPdfKiJson(result.reply)
    return NextResponse.json({
      positionen,
      dateiname,
      hinweis:
        hinweisPrefix +
        (positionen.length === 0
          ? 'Keine Produktzeilen erkannt — Beleg prüfen oder manuell eintragen.'
          : 'Bitte Vorschau prüfen, dann in der App übernehmen.'),
    })
  } catch (e) {
    console.error('besitz/pdf-import', e)
    return NextResponse.json({ error: 'Verarbeitung fehlgeschlagen.' }, { status: 502 })
  }
}
