import { NextResponse } from 'next/server'
import {
  BESITZ_GEBRAUCHTPREIS_RESPONSE_SCHEMA,
  buildBesitzGebrauchtpreisSystemPrompt,
  buildBesitzGebrauchtpreisUserText,
  parseBesitzGebrauchtpreisJson,
  type BesitzProduktKontext,
} from '@/lib/besitz-gebrauchtpreis-ki'
import type { CoachMessage } from '@/lib/ki-coach-backend'
import {
  COACH_MAX_IMAGES_PER_MESSAGE,
  coachProviderSchluesselDiagnose,
  resolveCoachProviderFromMode,
  runCoachCompletion,
} from '@/lib/ki-coach-backend'

export const runtime = 'nodejs'
export const maxDuration = 120

const MAX_BYTES_PRO_DATEI = 12 * 1024 * 1024

type ProduktFotoMime = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/heic' | 'image/heif'

function mimeFuerProduktfoto(file: File): ProduktFotoMime | null {
  const t = (file.type || '').toLowerCase().trim()
  const n = file.name.toLowerCase()
  if (t === 'image/jpeg' || t === 'image/jpg' || n.endsWith('.jpg') || n.endsWith('.jpeg')) return 'image/jpeg'
  if (t === 'image/png' || n.endsWith('.png')) return 'image/png'
  if (t === 'image/webp' || n.endsWith('.webp')) return 'image/webp'
  if (t === 'image/heic' || n.endsWith('.heic')) return 'image/heic'
  if (t === 'image/heif' || n.endsWith('.heif')) return 'image/heif'
  return null
}

function envGoogleSearchDefaultTrue(): boolean {
  const v = process.env.BESITZ_GEBRAUCHTPREIS_GOOGLE_SEARCH?.trim().toLowerCase()
  if (v === '0' || v === 'false' || v === 'no' || v === 'off') return false
  return true
}

function parseProduktJson(raw: string): BesitzProduktKontext | null {
  let o: unknown
  try {
    o = JSON.parse(raw) as unknown
  } catch {
    return null
  }
  if (!o || typeof o !== 'object') return null
  const p = o as Record<string, unknown>
  const name = typeof p.name === 'string' ? p.name.trim() : ''
  const kategorie = typeof p.kategorie === 'string' ? p.kategorie.trim() : ''
  const einkaufRaw = p.einkaufspreis_eur
  const einkaufspreis_eur =
    typeof einkaufRaw === 'number' && Number.isFinite(einkaufRaw)
      ? einkaufRaw
      : Number.parseFloat(String(einkaufRaw ?? '').trim().replace(/\s/g, '').replace(',', '.'))
  if (!name || !kategorie || !Number.isFinite(einkaufspreis_eur) || einkaufspreis_eur < 0) return null
  return {
    name,
    kategorie,
    einkaufspreis_eur: Math.round(einkaufspreis_eur * 100) / 100,
    einkaufsdatum: typeof p.einkaufsdatum === 'string' ? p.einkaufsdatum.trim().slice(0, 10) || null : null,
    haendler: typeof p.haendler === 'string' ? p.haendler.trim() || null : null,
    hersteller: typeof p.hersteller === 'string' ? p.hersteller.trim() || null : null,
    notiz: typeof p.notiz === 'string' ? p.notiz.trim() || null : null,
  }
}

export async function POST(request: Request) {
  const modeBesitz =
    process.env.BESITZ_GEBRAUCHTPREIS_PROVIDER?.trim() ||
    process.env.FINANCE_COACH_PROVIDER?.trim() ||
    'auto'
  const resolved = resolveCoachProviderFromMode(modeBesitz)
  if (!resolved) {
    return NextResponse.json(
      {
        error:
          'KI ist nicht konfiguriert (wie Finanz-Coach): GEMINI_API_KEY oder OPENAI_API_KEY in .env.local, Dev-Server neu starten. ' +
          'Wenn nur Gemini genutzt wird: FINANCE_COACH_PROVIDER leer oder `auto` oder `gemini` — nicht `openai`.',
        ki_provider: null,
        ki_modus: modeBesitz,
        schluessel: coachProviderSchluesselDiagnose(),
      },
      { status: 501 },
    )
  }

  const kiMeta = { ki_provider: resolved.provider, ki_modus: modeBesitz }

  const contentType = request.headers.get('content-type') || ''
  if (!/multipart\/form-data/i.test(contentType)) {
    return NextResponse.json({ ...kiMeta, error: 'Bitte Fotos per Formular-Upload senden.' }, { status: 400 })
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ ...kiMeta, error: 'Ungültiges Formular.' }, { status: 400 })
  }

  const produktRaw = formData.get('produkt')
  if (typeof produktRaw !== 'string' || !produktRaw.trim()) {
    return NextResponse.json({ ...kiMeta, error: 'Feld „produkt“ (JSON) fehlt.' }, { status: 400 })
  }
  const produkt = parseProduktJson(produktRaw)
  if (!produkt) {
    return NextResponse.json({ ...kiMeta, error: 'Ungültiges Produkt-JSON.' }, { status: 400 })
  }

  const alle = formData.getAll('fotos')
  const dateien: File[] = []
  for (const e of alle) {
    if (e instanceof File && e.size > 0) dateien.push(e)
  }
  if (dateien.length === 0) {
    return NextResponse.json(
      { ...kiMeta, error: 'Mindestens ein Foto (JPEG, PNG, WebP oder HEIC) erforderlich.' },
      { status: 400 },
    )
  }
  if (dateien.length > COACH_MAX_IMAGES_PER_MESSAGE) {
    return NextResponse.json(
      { ...kiMeta, error: `Maximal ${COACH_MAX_IMAGES_PER_MESSAGE} Fotos pro Anfrage.` },
      { status: 400 },
    )
  }

  const images: { mimeType: string; base64: string }[] = []
  for (const file of dateien) {
    if (file.size > MAX_BYTES_PRO_DATEI) {
      return NextResponse.json(
        { ...kiMeta, error: `Datei zu groß (max. ${Math.round(MAX_BYTES_PRO_DATEI / (1024 * 1024))} MB pro Bild).` },
        { status: 413 },
      )
    }
    const mime = mimeFuerProduktfoto(file)
    if (!mime) {
      return NextResponse.json(
        {
          ...kiMeta,
          error:
            'Bildformat nicht erkannt (JPEG, PNG, WebP, HEIC). Bei Kamera ohne Endung: bitte „Aus Galerie“ mit JPEG wählen oder iPhone auf „Kompatibel“ stellen.',
        },
        { status: 400 },
      )
    }
    if (
      resolved.provider === 'openai' &&
      (mime === 'image/heic' || mime === 'image/heif')
    ) {
      return NextResponse.json(
        {
          ...kiMeta,
          error:
            'HEIC/HEIF wird von OpenAI-Vision nicht unterstützt. Bitte JPEG wählen oder BESITZ_GEBRAUCHTPREIS_PROVIDER=gemini bzw. GEMINI_API_KEY setzen.',
        },
        { status: 400 },
      )
    }
    try {
      const bytes = Buffer.from(await file.arrayBuffer())
      images.push({ mimeType: mime, base64: bytes.toString('base64') })
    } catch (e) {
      console.error('besitz/gebrauchtpreis buffer', e)
      return NextResponse.json({ ...kiMeta, error: 'Datei konnte nicht gelesen werden.' }, { status: 500 })
    }
  }

  const systemText = buildBesitzGebrauchtpreisSystemPrompt()
  const mitWeb =
    resolved.provider === 'gemini' && envGoogleSearchDefaultTrue()
      ? true
      : false
  const userText = buildBesitzGebrauchtpreisUserText(produkt, images.length, mitWeb)

  const userMessages: CoachMessage[] = [
    {
      role: 'user',
      content: userText,
      images,
    },
  ]

  /** OpenAI: `json_object` + Vision ist fehleranfällig; Gemini nutzt strukturiertes Schema. */
  const jsonOpts =
    resolved.provider === 'gemini'
      ? { jsonResponse: { schema: BESITZ_GEBRAUCHTPREIS_RESPONSE_SCHEMA } }
      : undefined

  try {
    let groundingNachAntwort = false
    let result = await runCoachCompletion(resolved.provider, resolved.apiKey, systemText, userMessages, {
      temperature: 0.35,
      ...jsonOpts,
      geminiGoogleSearch: mitWeb,
    })

    if (result.ok) {
      groundingNachAntwort = mitWeb
    } else if (
      resolved.provider === 'gemini' &&
      mitWeb &&
      (result.status === 400 || /tool|google|search|schema|invalid/i.test(result.hint))
    ) {
      const userTextOhneWeb = buildBesitzGebrauchtpreisUserText(produkt, images.length, false)
      result = await runCoachCompletion(resolved.provider, resolved.apiKey, systemText, [
        { role: 'user', content: userTextOhneWeb, images },
      ], {
        temperature: 0.35,
        ...jsonOpts,
        geminiGoogleSearch: false,
      })
      groundingNachAntwort = false
    }

    if (!result.ok) {
      return NextResponse.json({ ...kiMeta, error: `KI: ${result.hint}` }, { status: 502 })
    }

    const parsed = parseBesitzGebrauchtpreisJson(result.reply)
    if (!parsed) {
      return NextResponse.json(
        {
          ...kiMeta,
          error:
            resolved.provider === 'openai'
              ? 'KI-Antwort konnte nicht ausgewertet werden (OpenAI liefert manchmal kein sauberes JSON). Tipp: BESITZ_GEBRAUCHTPREIS_PROVIDER=gemini in .env.local oder FINANCE_COACH_PROVIDER=gemini.'
              : 'KI-Antwort konnte nicht ausgewertet werden.',
          roh: result.reply.slice(0, 2000),
        },
        { status: 502 },
      )
    }

    return NextResponse.json({
      ergebnis: parsed,
      grounding_aktiv: resolved.provider === 'gemini' && groundingNachAntwort,
      ...kiMeta,
    })
  } catch (e) {
    console.error('besitz/gebrauchtpreis', e)
    return NextResponse.json({ ...kiMeta, error: 'Verarbeitung fehlgeschlagen.' }, { status: 502 })
  }
}
