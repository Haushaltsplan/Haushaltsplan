import { NextResponse } from 'next/server'
import {
  BESITZ_BELEG_KI_RESPONSE_SCHEMA,
  buildBesitzBelegKiSystemPrompt,
  parseBesitzPdfKiJson,
} from '@/lib/besitz-pdf-import'
import type { CoachMessage } from '@/lib/ki-coach-backend'
import { resolveCoachProvider, runCoachCompletion } from '@/lib/ki-coach-backend'

export const runtime = 'nodejs'

const MAX_BYTES = 12 * 1024 * 1024

function mimeFuerBelegfoto(file: File): 'image/jpeg' | 'image/png' | 'image/webp' | null {
  const n = file.name.toLowerCase()
  if (file.type === 'image/jpeg' || n.endsWith('.jpg') || n.endsWith('.jpeg')) return 'image/jpeg'
  if (file.type === 'image/png' || n.endsWith('.png')) return 'image/png'
  if (file.type === 'image/webp' || n.endsWith('.webp')) return 'image/webp'
  return null
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

  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `Datei zu groß (max. ${Math.round(MAX_BYTES / (1024 * 1024))} MB).` },
      { status: 413 },
    )
  }

  const mime = mimeFuerBelegfoto(file)
  if (!mime) {
    return NextResponse.json({ error: 'Nur JPEG, PNG oder WebP (Kassenbon-Foto).' }, { status: 400 })
  }

  const dateiname = typeof file.name === 'string' ? file.name : 'beleg.jpg'
  let bytes: Buffer
  try {
    bytes = Buffer.from(await file.arrayBuffer())
  } catch (e) {
    console.error('besitz/foto-import buffer', e)
    return NextResponse.json({ error: 'Datei konnte nicht gelesen werden.' }, { status: 500 })
  }

  const systemText = buildBesitzBelegKiSystemPrompt()
  const b64 = bytes.toString('base64')
  const userMessages: CoachMessage[] = [
    {
      role: 'user',
      content: `Dateiname: ${dateiname}

Das Bild zeigt einen **Kassenbon oder eine Rechnung** (Foto vom Handy oder Scan). Bitte alle **Wareneinkäufe** mit Zeilenpreisen gemäß Systemanweisung als JSON extrahieren.`,
      images: [{ mimeType: mime, base64: b64 }],
    },
  ]

  const hinweisPrefix = 'Erkennung aus Foto (KI). '

  try {
    const result = await runCoachCompletion(resolved.provider, resolved.apiKey, systemText, userMessages, {
      temperature: 0.15,
      jsonResponse: { schema: BESITZ_BELEG_KI_RESPONSE_SCHEMA },
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
          ? 'Keine Produktzeilen erkannt — Beleg schärfer fotografieren oder manuell eintragen.'
          : 'Bitte Vorschau prüfen, dann in der App übernehmen.'),
    })
  } catch (e) {
    console.error('besitz/foto-import', e)
    return NextResponse.json({ error: 'Verarbeitung fehlgeschlagen.' }, { status: 502 })
  }
}
