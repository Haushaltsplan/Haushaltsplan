import { NextResponse } from 'next/server'
import { prepareCoachMessages, resolveCoachProvider, runCoachCompletion } from '@/lib/ki-coach-backend'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function buildSystemPrompt(context: unknown): string {
  const contextBlock =
    context != null
      ? `\n\n--- Aktuelle Kennzahlen aus der App (nur zur Einordnung, keine Steuer-/Rechtsberatung) ---\n${JSON.stringify(context, null, 2)}\n---`
      : ''
  return `Du bist ein freundlicher, pragmatischer Finanz- und Verhaltenscoach für private Haushaltsführung in Deutschland.
Du hilfst bei: Ausgabeverhalten, Sparpotenzial, Routinen, Daueraufträge, Übersicht, Motivation — immer konkret und ohne Moralpredigt.
Wenn der Nutzer Fotos von Supermarkt-Kassenzetteln oder Belegen anhängt: lies sie sorgfältig (deutsche Preise, Artikel, Mengen, Rabatte, Summen). Liste erkannte Positionen strukturiert; wenn etwas unleserlich ist, sag es ehrlich.
Der Nutzer kann diese Infos für seine Speisekammer / Einkäufe nutzen — gib konkrete nächste Schritte (z. B. „so könntest du die Posten in die Speisekammer übernehmen“), ohne behaupten, Daten seien schon in der App gespeichert.
Zum automatischen Einbuchen mit Einkaufspreis: auf der Speisekammer-Seite den Bereich „Kassenzettel → Speisekammer“ nutzen (Fotos analysieren, dann buchen).
Wenn Zahlen fehlen, frage kurz nach oder arbeite mit allgemeinen Tipps.
Keine Anlageberatung, keine Steuer- oder Rechtsberatung; verweise bei Bedarf auf Fachleute.
Antworte auf Deutsch, knapp strukturiert (kurze Absätze oder Aufzählungen), maximal etwa 12–15 Sätze pro Antwort, außer der Nutzer bittet ausdrücklich um mehr Detail.${contextBlock}`
}

export async function GET() {
  const resolved = resolveCoachProvider()
  const isVercel = Boolean(process.env.VERCEL)
  return NextResponse.json({
    configured: Boolean(resolved),
    provider: resolved?.provider,
    ...(!resolved && isVercel
      ? {
          hostedNote:
            'Auf Vercel: Project Settings → Environment Variables → GEMINI_API_KEY (oder OPENAI_API_KEY) für Production setzen, Deployment neu bauen. .env.local wird nicht mit deployt.',
        }
      : {}),
  })
}

export async function POST(req: Request) {
  const resolved = resolveCoachProvider()
  if (!resolved) {
    return NextResponse.json(
      {
        error:
          'KI ist nicht konfiguriert: Lege in .env.local im Projektroot einen API-Schlüssel an, speichere, starte den Dev-Server neu (npm run dev). ' +
          'Option A — Gemini (Google AI Studio): GEMINI_API_KEY=… (oder GOOGLE_GENERATIVE_AI_API_KEY). ' +
          'Option B — OpenAI: OPENAI_API_KEY=… (oder AI_API_KEY). ' +
          'Optional: FINANCE_COACH_PROVIDER=auto|gemini|openai (Standard: auto = Gemini bevorzugt, falls Schlüssel da).',
      },
      { status: 501 },
    )
  }

  let body: { messages?: unknown[]; context?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Ungültige Anfrage.' }, { status: 400 })
  }

  const userMessages = prepareCoachMessages(Array.isArray(body.messages) ? body.messages : [])
  const last = userMessages[userMessages.length - 1]
  const lastHasText = last?.role === 'user' && typeof last.content === 'string' && last.content.trim().length > 0
  const lastHasImg = last?.role === 'user' && Array.isArray(last.images) && last.images.length > 0
  if (!userMessages.length || last?.role !== 'user' || (!lastHasText && !lastHasImg)) {
    return NextResponse.json(
      { error: 'Bitte Text und/oder mindestens ein Belegfoto senden.' },
      { status: 400 },
    )
  }

  const systemText = buildSystemPrompt(body.context)

  try {
    const result = await runCoachCompletion(resolved.provider, resolved.apiKey, systemText, userMessages, {
      temperature: 0.55,
    })

    if (!result.ok) {
      return NextResponse.json(
        { error: `KI-Dienst antwortete mit ${result.status}. ${result.hint}` },
        { status: 502 },
      )
    }
    return NextResponse.json({ reply: result.reply })
  } catch (e) {
    console.error('finance-coach', e)
    return NextResponse.json({ error: 'Verbindung zum KI-Dienst fehlgeschlagen.' }, { status: 502 })
  }
}
