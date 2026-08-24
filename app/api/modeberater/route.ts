import { NextResponse } from 'next/server'
import {
  geminiApiKeyFreeConfigured,
  geminiFreeTierFlashModelKandidaten,
  prepareCoachMessages,
  readGeminiApiKeyFromEnv,
  resolveCoachProviderFromMode,
  runCoachCompletion,
  type CoachImagePart,
  type CoachMessage,
} from '@/lib/ki-coach-backend'
import { ladeKleidungLinkKontext } from '@/lib/modeberater/mode-kleidung-link'
import { parseModeStand } from '@/lib/modeberater/mode-profil'
import { buildModeberaterSystemPrompt } from '@/lib/modeberater/mode-prompt'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 90

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
const MAX_IMAGES = 8
const MAX_B64 = 3_600_000

function resolveModeberaterProvider() {
  const key = readGeminiApiKeyFromEnv()
  if (!key) return null
  return resolveCoachProviderFromMode('gemini')
}

function kleidungUrlsAusStand(stand: ReturnType<typeof parseModeStand>): string[] {
  return stand.kleidung.map((k) => k.url.trim()).filter(Boolean)
}

function urlsAusLetzterNachricht(text: string): string[] {
  const found = text.match(/https?:\/\/[^\s<>"'()]+/gi) || []
  return found.map((u) => u.replace(/[.,;:!?)]+$/, '')).slice(0, 4)
}

export async function GET() {
  const resolved = resolveModeberaterProvider()
  const isVercel = Boolean(process.env.VERCEL)
  return NextResponse.json({
    configured: Boolean(resolved),
    provider: resolved?.provider ?? 'gemini',
    freeTierKey: geminiApiKeyFreeConfigured(),
    ...(!resolved && isVercel
      ? {
          hostedNote:
            'Auf Vercel: GEMINI_API_KEY_FREE (kostenloses Google-AI-Studio-Kontingent) in Environment Variables setzen, Deployment neu bauen.',
        }
      : {}),
  })
}

export async function POST(req: Request) {
  const resolved = resolveModeberaterProvider()
  if (!resolved) {
    return NextResponse.json(
      {
        error:
          'KI ist nicht konfiguriert. Setze GEMINI_API_KEY_FREE (kostenloses Google-AI-Studio-Kontingent) in .env.local und starte den Dev-Server neu.',
      },
      { status: 501 },
    )
  }

  let body: {
    messages?: unknown[]
    stand?: unknown
    webSuche?: unknown
    mitFotos?: unknown
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Ungültige Anfrage.' }, { status: 400 })
  }

  const stand = parseModeStand(body.stand)
  const chat = prepareCoachMessages(Array.isArray(body.messages) ? body.messages : [])
  const last = chat[chat.length - 1]
  const lastHasText = last?.role === 'user' && typeof last.content === 'string' && last.content.trim().length > 0
  if (!chat.length || last?.role !== 'user' || !lastHasText) {
    return NextResponse.json({ error: 'Bitte eine Frage eingeben oder „Beraten“ wählen.' }, { status: 400 })
  }

  const mitFotos = body.mitFotos !== false
  const extraUrls = urlsAusLetzterNachricht(last.content)
  const urls = [...new Set([...kleidungUrlsAusStand(stand), ...extraUrls])]
  const extraImages = mitFotos
    ? [
        ...stand.personFotos.map((f) => ({ mimeType: f.mimeType, base64: f.base64 })),
        ...stand.kleidung.flatMap((k) => (k.foto?.base64 ? [k.foto] : [])),
      ]
        .filter((im) => ALLOWED_MIME.has(im.mimeType) && im.base64.length > 80 && im.base64.length <= MAX_B64)
        .slice(0, urls.length ? Math.max(1, MAX_IMAGES - 2) : MAX_IMAGES)
    : []
  const willWeb =
    body.webSuche === true ||
    (mitFotos && urls.length > 0) ||
    /alternativ|zalando|aboutyou|asos|amazon|otto\.de|kaufen/i.test(last.content)

  let linkKontext: Awaited<ReturnType<typeof ladeKleidungLinkKontext>> = { kontext: [], bilder: [] }
  if (urls.length && mitFotos) {
    try {
      linkKontext = await ladeKleidungLinkKontext(urls)
    } catch (e) {
      console.warn('modeberater link-fetch', e)
    }
  } else if (urls.length) {
    linkKontext = { kontext: urls.map((url) => ({ url })), bilder: [] }
  }

  const bilder: CoachImagePart[] = [...extraImages]
  for (const im of linkKontext.bilder) {
    if (bilder.length >= MAX_IMAGES) break
    bilder.push(im)
  }

  const userMessages: CoachMessage[] = chat.map((m, i) => {
    if (i !== chat.length - 1 || m.role !== 'user') return m
    return bilder.length ? { ...m, images: bilder } : m
  })

  const systemText = buildModeberaterSystemPrompt({
    profil: stand.profil,
    personFotos: stand.personFotos,
    kleidung: stand.kleidung,
    linkKontext: linkKontext.kontext,
    fotosBeiliegend: extraImages.length > 0,
  })

  try {
    const result = await runCoachCompletion(resolved.provider, resolved.apiKey, systemText, userMessages, {
      temperature: 0.5,
      geminiModels: resolved.provider === 'gemini' ? geminiFreeTierFlashModelKandidaten() : undefined,
      geminiGoogleSearch: resolved.provider === 'gemini' && willWeb,
      timeoutMs: 70_000,
    })
    if (!result.ok) {
      return NextResponse.json(
        { error: `KI-Dienst antwortete mit ${result.status}. ${result.hint}` },
        { status: 502 },
      )
    }
    return NextResponse.json({ reply: result.reply })
  } catch (e) {
    console.error('modeberater', e)
    return NextResponse.json({ error: 'Verbindung zum KI-Dienst fehlgeschlagen.' }, { status: 502 })
  }
}
