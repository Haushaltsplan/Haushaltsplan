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
import type { CoachMessage } from '@/lib/ki-coach-backend'
import { runCoachCompletion } from '@/lib/ki-coach-backend'

export const BESITZ_ANREICHern_RESPONSE_SCHEMA: Record<string, unknown> = {
  type: 'OBJECT',
  properties: {
    kleidungsart: { type: 'STRING', nullable: true },
    groesse: { type: 'STRING', nullable: true },
    farbe: { type: 'STRING', nullable: true },
    bild_url: { type: 'STRING', nullable: true },
    suchbegriff: { type: 'STRING', nullable: true },
    hinweis: { type: 'STRING', nullable: true },
  },
  required: ['kleidungsart'],
}

export type BesitzAnreichernKiErgebnis = {
  kleidungsart: string | null
  groesse: string | null
  farbe: string | null
  bild_url: string | null
  suchbegriff: string | null
  hinweis: string | null
}

export type BesitzAnreichernItem = BesitzArtErkennungInput & {
  id: string
  einkaufspreis_eur?: number
  einkaufsdatum?: string | null
}

function buildSystemPrompt(kategorie: string, arten: string[]): string {
  return `Du ordnest **Kleidung/Schuhe** aus einem persönlichen Inventar zu und findest **Produktfotos** im Web.

Antwort: **Nur** JSON gemäß Schema.

## Kleidungsart / Schuhart
Wähle **genau eine** Bezeichnung aus dieser Liste (exakt so schreiben):
${arten.map((a) => `- ${a}`).join('\n')}

Wenn nichts passt: \`Sonstiges\`.

## Größe & Farbe
Aus Name, Notiz, Artikelnummer — nur wenn erkennbar, sonst null.

## Produktfoto (\`bild_url\`)
Mit **Google Search** (Grounding) ein **direktes HTTPS-Bild** suchen:
- Packshot / Produktfoto auf **Hersteller-, Händler- oder Shop-Seite**
- URL muss auf eine **Bilddatei** enden (.jpg, .jpeg, .png, .webp) oder ein CDN-Produktbild sein
- **Kein** Logo, kein Lifestyle-Foto mit Person, kein Icon
- Priorität: Artikelnummer/SKU + Marke + Produktname
- Wenn kein brauchbares Bild: \`bild_url\` = null

Kategorie des Artikels: **${kategorie}**.`
}

function buildUserText(item: BesitzAnreichernItem, regel: ReturnType<typeof errateBesitzArtRegeln>): string {
  const lines = [
    `Bezeichnung: ${item.name}`,
    `Kategorie: ${item.kategorie}`,
    item.hersteller ? `Marke/Hersteller: ${item.hersteller}` : null,
    item.haendler ? `Händler: ${item.haendler}` : null,
    item.notiz ? `Notiz: ${item.notiz}` : null,
    item.einkaufsdatum ? `Kaufdatum: ${item.einkaufsdatum}` : null,
    typeof item.einkaufspreis_eur === 'number' ? `Einkaufspreis EUR: ${item.einkaufspreis_eur}` : null,
    regel.artikelnummer ? `Erkannte Artikelnummer: ${regel.artikelnummer}` : null,
    regel.kleidungsart ? `Regel-Vorschlag Art: ${regel.kleidungsart}` : null,
  ].filter(Boolean)
  return `${lines.join('\n')}\n\nBitte Art zuordnen und ein passendes Produktfoto-URL finden.`
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
  let bild_url: string | null = null
  if (typeof p.bild_url === 'string' && p.bild_url.trim().startsWith('https://')) {
    bild_url = p.bild_url.trim().slice(0, 2000)
  }
  const suchbegriff = typeof p.suchbegriff === 'string' && p.suchbegriff.trim() ? p.suchbegriff.trim().slice(0, 200) : null
  const hinweis = typeof p.hinweis === 'string' && p.hinweis.trim() ? p.hinweis.trim().slice(0, 500) : null
  return { kleidungsart, groesse, farbe, bild_url, suchbegriff, hinweis }
}

export function mergeAnreicherung(
  item: BesitzAnreichernItem,
  regel: ReturnType<typeof errateBesitzArtRegeln>,
  ki: BesitzAnreichernKiErgebnis | null,
): {
  kleidungsart: string | null
  groesse: string | null
  farbe: string | null
  bild_url: string | null
  art_quelle: 'regel' | 'ki' | null
  foto_quelle: 'ki' | null
} {
  const kat = normalisiereBesitzKategorie(item.kategorie)
  const blob = [item.name, item.notiz, item.hersteller].filter(Boolean).join(' ')
  return {
    kleidungsart: regel.kleidungsart ?? ki?.kleidungsart ?? null,
    groesse: regel.groesse ?? ki?.groesse ?? extrahiereGroesse(blob),
    farbe: regel.farbe ?? ki?.farbe ?? extrahiereFarbe(blob),
    bild_url: ki?.bild_url ?? null,
    art_quelle: regel.kleidungsart ? 'regel' : ki?.kleidungsart ? 'ki' : null,
    foto_quelle: ki?.bild_url ? 'ki' : null,
  }
}

export async function kiAnreichereBesitzItem(
  provider: 'gemini' | 'openai',
  apiKey: string,
  item: BesitzAnreichernItem,
  opts?: { mitGoogleSearch?: boolean; brauchtFoto?: boolean },
): Promise<{ ok: true; ergebnis: BesitzAnreichernKiErgebnis } | { ok: false; error: string }> {
  const kat = normalisiereBesitzKategorie(item.kategorie)
  if (kat !== 'Kleidung' && kat !== 'Schuhe') {
    return { ok: false, error: 'Nur Kleidung/Schuhe.' }
  }

  const regel = errateBesitzArtRegeln(item)
  const brauchtArtKi = !regel.kleidungsart
  const brauchtFotoKi = opts?.brauchtFoto ?? true
  if (!brauchtArtKi && !brauchtFotoKi) {
    return {
      ok: true,
      ergebnis: {
        kleidungsart: regel.kleidungsart,
        groesse: regel.groesse,
        farbe: regel.farbe,
        bild_url: null,
        suchbegriff: null,
        hinweis: 'Nur Regeln — kein KI-Lauf nötig.',
      },
    }
  }

  const arten = alleBesitzArtenListe(kat)
  const systemText = buildSystemPrompt(kat, arten)
  const userMessages: CoachMessage[] = [{ role: 'user', content: buildUserText(item, regel) }]

  const mitWeb = provider === 'gemini' && (opts?.mitGoogleSearch ?? true) && brauchtFotoKi

  let result = await runCoachCompletion(provider, apiKey, systemText, userMessages, {
    temperature: 0.2,
    jsonResponse: provider === 'gemini' ? { schema: BESITZ_ANREICHern_RESPONSE_SCHEMA } : undefined,
    geminiGoogleSearch: mitWeb,
  })

  if (
    !result.ok &&
    provider === 'gemini' &&
    mitWeb &&
    (result.status === 400 || /tool|google|search|schema|invalid/i.test(result.hint))
  ) {
    result = await runCoachCompletion(provider, apiKey, systemText, userMessages, {
      temperature: 0.2,
      jsonResponse: { schema: BESITZ_ANREICHern_RESPONSE_SCHEMA },
      geminiGoogleSearch: false,
    })
  }

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
