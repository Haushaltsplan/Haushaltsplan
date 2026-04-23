import { NextResponse } from 'next/server'
import { REZEPT_KATALOG_KATEGORIEN } from '@/lib/lager-rezept-katalog-kategorie'
import { prepareCoachMessages, resolveCoachProvider, runCoachCompletion } from '@/lib/ki-coach-backend'
import { REZEPT_KOCHSCHRITTE_LEITFADEN } from '@/lib/rezept-kochanleitung-prompt'
import {
  formatRezeptAntwortAlsMarkdown,
  parseRezeptCoachAntwortJson,
  type RezeptCoachAntwort,
} from '@/lib/rezept-coach-types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type LagerZeile = { produkt_id: string; name: string; menge: number; einheit: string }

type LagerKontext = {
  haben: LagerZeile[]
  leerOderNullbestand: string[]
}

/** Gemini `responseSchema` (strukturierte Rezept-Antwort). */
const REZEPT_GEMINI_SCHEMA: Record<string, unknown> = {
  type: 'OBJECT',
  properties: {
    einleitung: { type: 'STRING' },
    rezepte: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          titel: { type: 'STRING' },
          portionen: { type: 'NUMBER' },
          zutaten: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                produkt_id: { type: 'STRING', nullable: true },
                name: { type: 'STRING' },
                menge: { type: 'NUMBER' },
                einheit: { type: 'STRING' },
                aus_lager: { type: 'BOOLEAN' },
              },
              required: ['name', 'menge', 'einheit', 'aus_lager'],
            },
          },
          kochschritte: {
            type: 'ARRAY',
            minItems: 12,
            maxItems: 50,
            items: {
              type: 'STRING',
              description:
                'Ein Mikroschritt: genau eine Handlung; mit Zeit, °C oder Herdstufe wo sinnvoll; völlig verständlich für Laien.',
            },
            description: 'Lange, idiotensichere Abfolge vieler kleiner Schritte (Gesamtzahl im Leitfaden).',
          },
          geschaetzte_kcal_gesamt: { type: 'INTEGER', nullable: true },
          kategorie: { type: 'STRING' },
        },
        required: ['titel', 'portionen', 'zutaten', 'kochschritte', 'kategorie'],
      },
    },
  },
  required: ['rezepte'],
}

function normalizeLagerPayload(raw: unknown): LagerKontext | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const arr = o.artikel
  if (!Array.isArray(arr)) return null
  const haben: LagerZeile[] = []
  const leerOderNullbestand: string[] = []
  for (const row of arr) {
    if (!row || typeof row !== 'object') continue
    const r = row as Record<string, unknown>
    const pid = typeof r.id === 'string' ? r.id.trim() : typeof r.produkt_id === 'string' ? r.produkt_id.trim() : ''
    const name = typeof r.name === 'string' ? r.name.trim() : ''
    if (!name) continue
    const menge = Number(r.menge)
    const einheit = typeof r.einheit === 'string' && r.einheit.trim() ? r.einheit.trim() : 'Stück'
    const m = Number.isFinite(menge) ? menge : 0
    if (m > 0 && pid) {
      haben.push({ produkt_id: pid, name, menge: Math.round(m * 1000) / 1000, einheit })
    } else {
      leerOderNullbestand.push(name)
    }
  }
  return { haben, leerOderNullbestand: leerOderNullbestand.slice(0, 40) }
}

const REZEPT_KATEGORIEN_FUER_PROMPT = REZEPT_KATALOG_KATEGORIEN.map((k) => `\`${k}\``).join(', ')

const JSON_ANTWORT_REGELN = `
Antwortformat: **Nur ein gültiges JSON-Objekt** (kein Markdown drumherum), exakt dieses Schema:
- \`einleitung\` (optional): ein kurzer Satz zur Gesamtempfehlung.
- \`rezepte\`: Array mit **1–3** Gerichten.
- Jedes Gericht:
  - \`titel\`: kurzer Name des Gerichts.
  - \`portionen\`: Zahl (z. B. 2, 3, 4) — typisch 2–4, wenn der Nutzer nichts anderes sagt.
  - \`zutaten\`: jede Zeile mit **konkreter Menge** (\`menge\` > 0) und **\`einheit\`** exakt wie in „haben“ für Zutaten aus dem Vorrat.
  - Wenn eine Zutat aus dem mitgeschickten Bestand (Speisekammer) kommt: \`aus_lager: true\`, **\`produkt_id\`** exakt die UUID aus „haben“, **\`menge\`** darf **nicht größer** sein als die dortige \`menge\`, **\`einheit\`** muss **übereinstimmen**. \`name\` = Anzeigename aus dem Bestand.
  - Zutaten, die **nicht** im Bestand sind (Öl, Salz …): \`aus_lager: false\`, \`produkt_id\` weglassen oder null, \`menge\`/\`einheit\` realistisch (z. B. „1 EL“, „1 Prise“ als Menge 1, Einheit „EL“ / „Prise“).
  - \`kochschritte\`: Array aus **einzelnen** Sätzen — **PFLICHT: sehr ausführlich** (siehe Leitfaden unten). Nichts mit „4–8 kurz“ — das Ziel ist **Idiotensicherheit** für Laien. Wenn der Nutzer nach **mehr Details** fragt, **dieselbe JSON-Struktur** und **nur** \`kochschritte\` noch länger und feinkörniger, alle anderen Felder unverändert lassen, wo er das verlangt.
  ${REZEPT_KOCHSCHRITTE_LEITFADEN}
  - \`geschaetzte_kcal_gesamt\` (optional): **positive Ganzzahl** — grobe Schätzung der Kilokalorien für das **gesamte** Gericht inklusive **aller** Portionen (nicht pro Person). Orientierung an typischen Kaloriendichten der genannten Mengen; **keine** medizinische oder allergologische Beratung. Wenn unsicher: weglassen oder null.
  - \`kategorie\` (**Pflicht pro Gericht**): **genau eine** dieser Bezeichnungen, **exakt** so geschrieben (inkl. Leerzeichen um „/“): ${REZEPT_KATEGORIEN_FUER_PROMPT}.
    **Du ordnest selbst zu** anhand von Titel, Zutaten und Zubereitung: z. B. klare Nudel-Basis → \`Nudelgericht\`; Fleisch/Geflügel/Wurst als Hauptzutat → \`Fleischgericht\`; Fisch/Meeresfrüchte → \`Fischgericht\`; überwiegend Suppe/Eintopf → \`Suppe / Eintopf\`; Beilage oder Salat → \`Beilage / Salat\`; süß / Kuchen / Dessert → \`Dessert / Backen\`; ohne Fleisch/Fisch, mit tierischen Produkten (Milch, Ei …) → \`Vegetarisch\`; rein pflanzlich → \`Vegan\`; wirklich nicht einzuordnen → \`Sonstiges\`.
`

function buildLagerRezeptSystemPrompt(lager: LagerKontext | null): string {
  const block =
    lager != null
      ? `\n\n--- Aktueller Vorrat / Speisekammer (haben = wirklich vorrätig; produkt_id für Ausbuchen in der App) ---\n${JSON.stringify(lager, null, 2)}\n---`
      : '\n\n(Hinweis: Es wurden keine Bestandszeilen mitgeschickt — arbeite mit Nutzertext und ggf. Fotos.)\n'

  return `Du bist ein Kulinarik- und Zero-Waste-Assistent für private Haushalte in Deutschland.${block}

Aufgabe: **Rezepte vorschlagen**, die **vorhandene Zutaten möglichst gut aufbrauchen**, um **Lebensmittelverschwendung zu vermeiden**.

Leitlinien:
- Nutze vor allem Einträge aus **haben** (mit \`produkt_id\`, \`menge\`, \`einheit\`) — plane **realistische Portionsmengen** und gib für jede Vorrat-Zutat die **genaue abzubuchende Menge** im Rezept an (≤ aktueller Bestand).
- **Jedes** Gericht in \`rezepte\` **muss** das Feld \`kategorie\` enthalten (eine der erlaubten Zeichenketten oben).
- Wenn sinnvoll: Gerichte, die **mehrere** Vorratsposten gleichzeitig verwerten.
- „leerOderNullbestand“ nur als Hinweis; **nicht** als vorrätig behandeln.
- **Fotos**: sichtbare Lebensmittel zusätzlich zur Liste nutzen.
- **Keine** medizinische Ernährungs- oder Allergieberatung.
- **Verständlichkeit** wichtiger als kreative Formulierungen: jede \`kochschritte\`-Folge muss in einem realen Haushalt **sicher** nachkochbar sein, ohne Raten.
- Antwort auf **Deutsch**.

${JSON_ANTWORT_REGELN}`
}

export async function POST(req: Request) {
  const resolved = resolveCoachProvider()
  if (!resolved) {
    return NextResponse.json(
      {
        error:
          'KI ist nicht konfiguriert (gleiche Einstellung wie Finanz-Coach): GEMINI_API_KEY oder OPENAI_API_KEY in .env.local.',
      },
      { status: 501 },
    )
  }

  let body: { messages?: unknown[]; lager?: unknown }
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
      { error: 'Bitte eine Frage/Idee eintippen und/oder ein Foto anhängen.' },
      { status: 400 },
    )
  }

  const lagerNorm = normalizeLagerPayload(body.lager)
  const systemText = buildLagerRezeptSystemPrompt(lagerNorm)

  try {
    const result = await runCoachCompletion(resolved.provider, resolved.apiKey, systemText, userMessages, {
      temperature: 0.4,
      jsonResponse: { schema: REZEPT_GEMINI_SCHEMA },
    })
    if (!result.ok) {
      return NextResponse.json(
        { error: `KI-Dienst antwortete mit ${result.status}. ${result.hint}` },
        { status: 502 },
      )
    }

    const structured = parseRezeptCoachAntwortJson(result.reply)
    if (!structured) {
      console.error('lager/rezept-coach: JSON parse failed', result.reply.slice(0, 500))
      return NextResponse.json(
        { error: 'Die KI-Antwort konnte nicht als Rezept-JSON gelesen werden. Bitte erneut senden oder kürzer fragen.' },
        { status: 422 },
      )
    }

    const markdown = formatRezeptAntwortAlsMarkdown(structured)
    return NextResponse.json({ reply: markdown, structured })
  } catch (e) {
    console.error('lager/rezept-coach', e)
    return NextResponse.json({ error: 'Verbindung zum KI-Dienst fehlgeschlagen.' }, { status: 502 })
  }
}
