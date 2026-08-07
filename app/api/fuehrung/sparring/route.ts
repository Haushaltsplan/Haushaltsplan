import { NextResponse } from 'next/server'
import { prepareCoachMessages, resolveCoachProvider, runCoachCompletion } from '@/lib/ki-coach-backend'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export type FuehrungSparringAntwort = {
  einordnung: 'fuehrung' | 'redirect' | 'spaeter' | 'selbst' | 'gemischt'
  einordnungText: string
  saetze: string[]
  tipp: string
}

const SYSTEM = `Du bist ein knapper Führungs-Sparringspartner für einen stellvertretenden Leiter Hartware (Ski-Onlinehandel, ~40 MA, erste Führungsrolle).
Kontext: Er soll aufhören, der „einfache Weg“ für alle zu sein — freundlich bleiben, aber Denken zurückgeben, Nein/Später sagen, Fokus schützen.

Aufgabe: Bewerte die geschilderte Situation und gib 2–3 konkrete Sätze auf Deutsch, die er morgen sagen kann.

Antworte NUR mit gültigem JSON (kein Markdown, keine Code-Fences):
{
  "einordnung": "fuehrung" | "redirect" | "spaeter" | "selbst" | "gemischt",
  "einordnungText": "1–2 Sätze: Ist das wirklich seine Führungsaufgabe oder soll er zurückgeben?",
  "saetze": ["Satz 1", "Satz 2", "Satz 3"],
  "tipp": "Ein kurzer Praxistipp (max 2 Sätze)"
}

Regeln:
- einordnung "fuehrung" = er soll selbst entscheiden/eskalieren
- "redirect" = Gegenfrage / zurückgeben
- "spaeter" = Fokus schützen, später
- "selbst" = er darf/soll lösen (selten)
- "gemischt" = hybrid
- Sätze: natürlich, bestimmt, nicht kalt, keine Anglizismen-Floskeln
- Keine Floskeln wie „synergetisch“; praxisnah für den Shop-Alltag`

function parseAntwort(raw: string): FuehrungSparringAntwort | null {
  const trimmed = raw.trim()
  const start = trimmed.indexOf('{')
  const end = trimmed.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  try {
    const obj = JSON.parse(trimmed.slice(start, end + 1)) as Partial<FuehrungSparringAntwort>
    const saetze = Array.isArray(obj.saetze)
      ? obj.saetze.filter((s): s is string => typeof s === 'string' && s.trim().length > 0).slice(0, 4)
      : []
    if (!obj.einordnungText || saetze.length < 1) return null
    const einordnung = (
      ['fuehrung', 'redirect', 'spaeter', 'selbst', 'gemischt'] as const
    ).includes(obj.einordnung as FuehrungSparringAntwort['einordnung'])
      ? (obj.einordnung as FuehrungSparringAntwort['einordnung'])
      : 'gemischt'
    return {
      einordnung,
      einordnungText: String(obj.einordnungText).trim(),
      saetze,
      tipp: typeof obj.tipp === 'string' ? obj.tipp.trim() : '',
    }
  } catch {
    return null
  }
}

export async function GET() {
  const resolved = resolveCoachProvider()
  return NextResponse.json({ configured: Boolean(resolved), provider: resolved?.provider })
}

export async function POST(req: Request) {
  const resolved = resolveCoachProvider()
  if (!resolved) {
    return NextResponse.json(
      {
        error:
          'KI ist nicht konfiguriert (GEMINI_API_KEY oder OPENAI_API_KEY in .env.local).',
      },
      { status: 501 },
    )
  }

  let body: { situation?: string; context?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Ungültige Anfrage.' }, { status: 400 })
  }

  const situation = typeof body.situation === 'string' ? body.situation.trim() : ''
  if (situation.length < 8) {
    return NextResponse.json(
      { error: 'Bitte die Situation etwas genauer beschreiben (mind. ein Satz).' },
      { status: 400 },
    )
  }

  const contextBlock =
    body.context != null
      ? `\n\nZusatzkontext (Personen/Muster):\n${JSON.stringify(body.context).slice(0, 2500)}`
      : ''

  const userMessages = prepareCoachMessages([
    {
      role: 'user',
      content: `Situation:\n${situation}${contextBlock}\n\nAntworte nur mit dem JSON-Objekt.`,
    },
  ])

  try {
    const result = await runCoachCompletion(resolved.provider, resolved.apiKey, SYSTEM, userMessages, {
      temperature: 0.45,
    })
    if (!result.ok) {
      return NextResponse.json(
        { error: `KI-Dienst: ${result.status}. ${result.hint}` },
        { status: 502 },
      )
    }
    const parsed = parseAntwort(result.reply)
    if (!parsed) {
      return NextResponse.json(
        {
          error: 'KI-Antwort konnte nicht gelesen werden. Bitte nochmal versuchen.',
          raw: result.reply.slice(0, 500),
        },
        { status: 502 },
      )
    }
    return NextResponse.json(parsed)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unbekannter Fehler'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
