import { NextResponse } from 'next/server'
import {
  geminiApiKeyFreeConfigured,
  geminiFreeTierFlashModelKandidaten,
  prepareCoachMessages,
  resolveCoachProvider,
  resolveGeminiFreeTierProvider,
  runCoachCompletion,
} from '@/lib/ki-coach-backend'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function resolveFinanceCoachProvider() {
  return resolveGeminiFreeTierProvider() ?? resolveCoachProvider()
}

function buildSystemPrompt(context: unknown): string {
  const contextBlock =
    context != null
      ? `\n\n--- Deine aktuellen Zahlen aus der App (nur zur Einordnung; keine erfundenen Beträge) ---\n${JSON.stringify(context, null, 2)}\n---`
      : ''
  return `Du bist ein freundlicher, klarer Finanz-, Vorsorge- und Lebensberater für eine Privatperson in Deutschland.
Du denkst ganzheitlich: Haushalt (Einnahmen/Ausgaben), Gesamtvermögen, Liquidität, Sparen, grobe Anlageklassen, Altersvorsorge, Absicherung und große Lebensziele (Hausbau/Kauf, Familie, Jobwechsel, große Anschaffungen).

## Was du darfst und sollst
- Konkrete, umsetzbare Tipps aus den mitgelieferten Zahlen: wo zu viel Cash liegt, ob ein Notgroschen fehlt, ob die Sparrate zum Ziel passt, welche Lücken (z. B. Bausparen/Eigenkapital, Vorsorge, Diversifikation) auffallen.
- Szenarien und Checklisten: Hausbau/Kauf (Eigenkapital, Nebenkosten ~10–15 %, Zins/Tilgung, Puffer, Fördermittel nur grob nennen), Notgroschen (typisch 3–6 Monatsausgaben), Reihenfolge „teure Schulden → Puffer → Ziele → langfristig anlegen“.
- Anlageklassen auf Deutsch erklären (Tagesgeld, ETF-Sparplan, Aktien-Depot, Fonds, Bausparer, P2P, Rente) — immer passend zum vorhandenen Mix, ohne Einzelaktien oder konkrete Produkte zu empfehlen.
- Vorsorge und Leben: grob Riester/Rürup/bAV/BU als Themen nennen, Prioritäten setzen, Fragen stellen wenn Daten fehlen (Alter, Wunschimmobilie, Zeithorizont, Risikobereitschaft).
- Motivation ohne Moralpredigt. Zahlen aus dem Kontext verwenden, fehlende Werte nachfragen.

## Grenzen (unbedingt)
- Keine individuelle Anlage-, Steuer- oder Rechtsberatung und keine konkreten Wertpapierkäufe/-verkäufe.
- Keine Garantien, keine „du musst jetzt XY-Aktie kaufen“. Verweise bei Verträgen, Steuern, Kredit und Versicherung auf Fachleute (Steuerberatung, Bank, unabhängige Beratung).
- Keine Kassenzettel, keine Speisekammer: kurz auf die anderen App-Bereiche verweisen.
- Erfinde keine Kontostände. Wenn Vermögen leer ist, sage das und arbeite mit Cashflow.

Antworte auf Deutsch, gut lesbar: kurze \`## \`-Abschnitte, Aufzählungen mit \`- \`, Kernbeträge mit \`**fett**\`.
Standardlänge: 2–5 knappe Abschnitte (ca. 15–22 Sätze). Mehr nur, wenn ausdrücklich nach Tiefe gefragt wird.${contextBlock}`
}

export async function GET() {
  const resolved = resolveFinanceCoachProvider()
  const isVercel = Boolean(process.env.VERCEL)
  return NextResponse.json({
    configured: Boolean(resolved),
    provider: resolved?.provider,
    ...(!resolved && isVercel
      ? {
          hostedNote:
            'Auf Vercel: Project Settings → Environment Variables → GEMINI_API_KEY_FREE (oder GEMINI_API_KEY / OPENAI_API_KEY) für Production setzen, Deployment neu bauen. .env.local wird nicht mit deployt.',
        }
      : {}),
  })
}

export async function POST(req: Request) {
  const resolved = resolveFinanceCoachProvider()
  if (!resolved) {
    return NextResponse.json(
      {
        error:
          'KI ist nicht konfiguriert: Lege in .env.local im Projektroot einen API-Schlüssel an, speichere, starte den Dev-Server neu (npm run dev). ' +
          'Option A — Gemini (Google AI Studio): GEMINI_API_KEY_FREE=… oder GEMINI_API_KEY=…. ' +
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
  if (!userMessages.length || last?.role !== 'user' || !lastHasText) {
    return NextResponse.json(
      { error: 'Bitte eine Frage oder einen kurzen Text eingeben.' },
      { status: 400 },
    )
  }

  const systemText = buildSystemPrompt(body.context)

  try {
    const result = await runCoachCompletion(resolved.provider, resolved.apiKey, systemText, userMessages, {
      temperature: 0.5,
      geminiModels: resolved.provider === 'gemini' ? geminiFreeTierFlashModelKandidaten() : undefined,
      geminiForceFreeApiKey: resolved.provider === 'gemini' && geminiApiKeyFreeConfigured(),
      maxOutputTokens: 4096,
      thinkingMinimal: true,
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
