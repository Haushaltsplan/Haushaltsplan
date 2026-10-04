import { NextResponse } from 'next/server'
import type { ModelMessage } from 'ai'
import { parseJsonBody } from '@/lib/api/parse-json-body'
import { financeCoachBodySchema } from '@/lib/api/schemas/finance-coach'
import { prepareCoachMessages, resolveGeminiFreeTierProvider, resolveCoachProvider } from '@/lib/ki-coach-backend'
import { streamGeminiText } from '@/lib/ki/ai-sdk-gemini'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

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

export async function POST(req: Request) {
  const resolved = resolveFinanceCoachProvider()
  if (!resolved || resolved.provider !== 'gemini') {
    return NextResponse.json(
      {
        error:
          'Streaming benötigt Gemini (GEMINI_API_KEY_FREE). OpenAI bitte über /api/finance-coach nutzen.',
      },
      { status: 501 },
    )
  }

  const parsed = await parseJsonBody(req, financeCoachBodySchema)
  if (!parsed.ok) return parsed.response

  const userMessages = prepareCoachMessages(parsed.data.messages)
  const last = userMessages[userMessages.length - 1]
  const lastHasText = last?.role === 'user' && typeof last.content === 'string' && last.content.trim().length > 0
  if (!userMessages.length || last?.role !== 'user' || !lastHasText) {
    return NextResponse.json({ error: 'Bitte eine Frage oder einen kurzen Text eingeben.' }, { status: 400 })
  }

  const messages: ModelMessage[] = userMessages.map((m) => ({
    role: m.role,
    content: m.content,
  }))

  try {
    const result = await streamGeminiText({
      system: buildSystemPrompt(parsed.data.context),
      messages,
      mode: 'free',
      temperature: 0.5,
      maxOutputTokens: 4096,
    })
    return result.toTextStreamResponse()
  } catch (e) {
    console.error('finance-coach/stream', e)
    return NextResponse.json({ error: 'Streaming fehlgeschlagen.' }, { status: 502 })
  }
}
