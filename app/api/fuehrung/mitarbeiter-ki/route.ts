import { NextResponse } from 'next/server'
import {
  geminiFreeTierFlashModelKandidaten,
  prepareCoachMessages,
  resolveCoachProvider,
  resolveCoachProviderFromMode,
  runCoachCompletion,
} from '@/lib/ki-coach-backend'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const SYSTEM = `Du bist ein knapper, praxisnaher Coach für einen stellvertretenden Leiter Hartware (erste Führungsrolle).
Der Nutzer erfasst in Woche 1, wie oft Mitarbeiter ihn mit Fragen holen — oft unnötig, weil sie selbst denken könnten.
Hilf bei: Einordnung der Zahlen, Gesprächsvorbereitung („schau, so oft…“), Formulierungen, Muster erkennen.
Antworte auf Deutsch, konkret, ohne Moralpredigt. Max. ~12 Sätze oder kurze Aufzählungen.
Nutze mitgelieferte Zählungen — erfinde keine Mitarbeiter oder Anzahlen.`

export async function GET() {
  const resolved = resolveCoachProvider()
  return NextResponse.json({
    configured: Boolean(resolved),
    provider: resolved?.provider,
    freeTier: true,
  })
}

export async function POST(req: Request) {
  // Immer Free-Tier Gemini, falls Schlüssel da — sonst Fallback OpenAI.
  const resolved =
    resolveCoachProviderFromMode('gemini') ?? resolveCoachProvider()
  if (!resolved) {
    return NextResponse.json(
      { error: 'KI nicht konfiguriert (GEMINI_API_KEY empfohlen für Free Tier).' },
      { status: 501 },
    )
  }

  let body: { message?: string; context?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Ungültige Anfrage.' }, { status: 400 })
  }

  const message = typeof body.message === 'string' ? body.message.trim() : ''
  if (message.length < 3) {
    return NextResponse.json({ error: 'Bitte eine Frage eingeben.' }, { status: 400 })
  }

  const contextBlock =
    body.context != null
      ? `\n\n--- Erfasste Mitarbeiter-Fragen (nur diese Zahlen nutzen) ---\n${JSON.stringify(body.context, null, 2).slice(0, 6000)}\n---`
      : ''

  const userMessages = prepareCoachMessages([
    { role: 'user', content: `${message}${contextBlock}` },
  ])

  try {
    const result = await runCoachCompletion(resolved.provider, resolved.apiKey, SYSTEM, userMessages, {
      temperature: 0.5,
      geminiModels:
        resolved.provider === 'gemini' ? geminiFreeTierFlashModelKandidaten() : undefined,
    })
    if (!result.ok) {
      return NextResponse.json(
        { error: `KI: ${result.status}. ${result.hint}` },
        { status: 502 },
      )
    }
    return NextResponse.json({ reply: result.reply })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Fehler'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
