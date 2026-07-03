import {
  alleBesitzArtenListe,
  type BesitzArtErkennungInput,
  errateBesitzArtRegeln,
  extrahiereArtikelnummer,
  extrahiereFarbe,
  extrahiereGroesse,
} from '@/lib/besitz-art-erkennung'
import { normalisiereBesitzKategorie } from '@/lib/besitz-kategorien'
import { normalisiereBesitzKleidungsart } from '@/lib/besitz-kleidungsarten'
import type { CoachImagePart, CoachMessage } from '@/lib/ki-coach-backend'
import { runCoachCompletion } from '@/lib/ki-coach-backend'

export const BESITZ_ANREICHern_RESPONSE_SCHEMA: Record<string, unknown> = {
  type: 'OBJECT',
  properties: {
    kleidungsart: { type: 'STRING', nullable: true },
    groesse: { type: 'STRING', nullable: true },
    farbe: { type: 'STRING', nullable: true },
    hersteller: { type: 'STRING', nullable: true },
    hinweis: { type: 'STRING', nullable: true },
  },
  required: [],
}

export type BesitzAnreichernKiErgebnis = {
  kleidungsart: string | null
  groesse: string | null
  farbe: string | null
  hersteller: string | null
  hinweis: string | null
}

export type BesitzAnreichernItem = BesitzArtErkennungInput & {
  id: string
  einkaufspreis_eur?: number
  einkaufsdatum?: string | null
}

function buildSystemPrompt(kategorie: string, arten: string[] | null): string {
  const artBlock =
    arten && arten.length
      ? `## Kleidungsart / Schuhart
Wähle **genau eine** Bezeichnung aus dieser Liste (exakt so schreiben):
${arten.map((a) => `- ${a}`).join('\n')}

Wenn nichts passt: \`Sonstiges\`.`
      : `## Art / Typ
Kurze, präzise Bezeichnung des Gegenstands (z. B. „Bluetooth-Kopfhörer“, „Kaffeemaschine“, „Rucksack“). Feld \`kleidungsart\` für die Art nutzen.`

  return `Du analysierst **Fotos aus einem persönlichen Inventar** (eigenes Foto des Besitzers — kein Websuche, kein Stock-Foto).

Antwort: **Nur** JSON gemäß Schema.

${artBlock}

## Größe & Farbe
Nur aus Foto und mitgelieferten Stammdaten — wenn erkennbar, sonst null.

## Hersteller / Marke
Nur wenn auf dem Foto, Etikett oder in den Stammdaten erkennbar — sonst null. Nicht raten.

## Regeln
- Keine Websuche, keine erfundenen Produkt-URLs.
- Keine Schätzungen zu Wert oder Zustand (dafür gibt es einen separaten Gebrauchtpreis-Flow).
- Kategorie des Artikels: **${kategorie}**.`
}

function buildUserText(item: BesitzAnreichernItem, regel: ReturnType<typeof errateBesitzArtRegeln>): string {
  const lines = [
    `Bezeichnung: ${item.name}`,
    `Kategorie: ${item.kategorie}`,
    item.hersteller ? `Marke/Hersteller (Stamm): ${item.hersteller}` : null,
    item.haendler ? `Händler: ${item.haendler}` : null,
    item.notiz ? `Notiz: ${item.notiz}` : null,
    item.einkaufsdatum ? `Kaufdatum: ${item.einkaufsdatum}` : null,
    typeof item.einkaufspreis_eur === 'number' ? `Einkaufspreis EUR: ${item.einkaufspreis_eur}` : null,
    regel.artikelnummer ? `Erkannte Artikelnummer: ${regel.artikelnummer}` : null,
    regel.kleidungsart ? `Regel-Vorschlag Art: ${regel.kleidungsart}` : null,
  ].filter(Boolean)
  return `${lines.join('\n')}\n\nBitte Art, Größe, Farbe und ggf. Marke aus dem **eigenen Foto** ergänzen.`
}

function parseKiJson(raw: string, kategorie: ReturnType<typeof normalisiereBesitzKategorie>): BesitzAnreichernKiErgebnis | null {
  const t = raw.trim()
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const inner = fence ? fence[1].trim() : t
  let o: unknown
  try {
    o = JSON.parse(inner) as unknown
  } catch {
    const m = inner.match(/\{[\s\S]*\}/)
    if (!m) return null
    try {
      o = JSON.parse(m[0]) as unknown
    } catch {
      return null
    }
  }
  if (!o || typeof o !== 'object') return null
  const p = o as Record<string, unknown>
  const artRaw = p.kleidungsart
  const kleidungsart =
    typeof artRaw === 'string' && artRaw.trim()
      ? normalisiereBesitzKleidungsart(artRaw.trim(), kategorie)
      : null
  const groesse = typeof p.groesse === 'string' && p.groesse.trim() ? p.groesse.trim().slice(0, 40) : null
  const farbe = typeof p.farbe === 'string' && p.farbe.trim() ? p.farbe.trim().slice(0, 40) : null
  const hersteller =
    typeof p.hersteller === 'string' && p.hersteller.trim() ? p.hersteller.trim().slice(0, 80) : null
  const hinweis = typeof p.hinweis === 'string' && p.hinweis.trim() ? p.hinweis.trim().slice(0, 500) : null
  return { kleidungsart, groesse, farbe, hersteller, hinweis }
}

export function mergeAnreicherung(
  item: BesitzAnreichernItem,
  regel: ReturnType<typeof errateBesitzArtRegeln>,
  ki: BesitzAnreichernKiErgebnis | null,
): {
  kleidungsart: string | null
  groesse: string | null
  farbe: string | null
  hersteller: string | null
  art_quelle: 'regel' | 'ki' | null
} {
  const blob = [item.name, item.notiz, item.hersteller].filter(Boolean).join(' ')
  return {
    kleidungsart: regel.kleidungsart ?? ki?.kleidungsart ?? null,
    groesse: regel.groesse ?? ki?.groesse ?? extrahiereGroesse(blob),
    farbe: regel.farbe ?? ki?.farbe ?? extrahiereFarbe(blob),
    hersteller: item.hersteller?.trim() || ki?.hersteller || null,
    art_quelle: regel.kleidungsart ? 'regel' : ki?.kleidungsart ? 'ki' : null,
  }
}

export async function kiAnreichereBesitzItem(
  provider: 'gemini' | 'openai',
  apiKey: string,
  item: BesitzAnreichernItem,
  foto: CoachImagePart,
): Promise<{ ok: true; ergebnis: BesitzAnreichernKiErgebnis } | { ok: false; error: string }> {
  const kat = normalisiereBesitzKategorie(item.kategorie)
  const regel = errateBesitzArtRegeln(item)
  const brauchtKi = !regel.kleidungsart || !regel.groesse || !regel.farbe || !item.hersteller?.trim()

  if (!brauchtKi && regel.kleidungsart) {
    return {
      ok: true,
      ergebnis: {
        kleidungsart: regel.kleidungsart,
        groesse: regel.groesse,
        farbe: regel.farbe,
        hersteller: item.hersteller?.trim() || null,
        hinweis: 'Nur Regeln — kein KI-Lauf nötig.',
      },
    }
  }

  const arten = kat === 'Kleidung' || kat === 'Schuhe' ? alleBesitzArtenListe(kat) : null
  const systemText = buildSystemPrompt(kat, arten)
  const userMessages: CoachMessage[] = [
    {
      role: 'user',
      content: buildUserText(item, regel),
      images: [foto],
    },
  ]

  const result = await runCoachCompletion(provider, apiKey, systemText, userMessages, {
    temperature: 0.2,
    jsonResponse: provider === 'gemini' ? { schema: BESITZ_ANREICHern_RESPONSE_SCHEMA } : undefined,
  })

  if (!result.ok) return { ok: false, error: result.hint || 'KI fehlgeschlagen.' }

  const parsed = parseKiJson(result.reply, kat)
  if (!parsed) return { ok: false, error: 'KI-Antwort unlesbar.' }

  if (!parsed.kleidungsart && regel.kleidungsart) parsed.kleidungsart = regel.kleidungsart
  if (!parsed.groesse && regel.groesse) parsed.groesse = regel.groesse
  if (!parsed.farbe && regel.farbe) parsed.farbe = regel.farbe
  if (!parsed.kleidungsart) {
    const nr = regel.artikelnummer ?? extrahiereArtikelnummer([item.name, item.notiz].filter(Boolean).join(' '))
    if (nr) parsed.hinweis = (parsed.hinweis ? `${parsed.hinweis} ` : '') + `Artikelnr. ${nr} — Art unklar.`
  }

  return { ok: true, ergebnis: parsed }
}
