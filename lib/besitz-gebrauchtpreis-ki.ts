/**
 * KI-Gebrauchtpreis-Schätzung für Besitz-Gegenstände (Fotos + Stammdaten).
 * Nutzt dieselbe Provider-Auflösung wie Finanz-Coach (`resolveCoachProvider` / `runCoachCompletion`).
 */

/** Gemini `responseSchema` (OpenAPI-ähnlich). */
export const BESITZ_GEBRAUCHTPREIS_RESPONSE_SCHEMA: Record<string, unknown> = {
  type: 'OBJECT',
  properties: {
    zustand_kurz: { type: 'STRING' },
    zustand_stufe: { type: 'STRING' },
    preis_min_eur: { type: 'NUMBER' },
    preis_max_eur: { type: 'NUMBER' },
    preis_wahrscheinlich_eur: { type: 'NUMBER' },
    markt_einordnung: { type: 'STRING' },
    begruendung: { type: 'STRING' },
    unsicherheiten: { type: 'ARRAY', items: { type: 'STRING' } },
    hinweis_rechtlich: { type: 'STRING' },
  },
  required: [
    'zustand_kurz',
    'zustand_stufe',
    'preis_min_eur',
    'preis_max_eur',
    'preis_wahrscheinlich_eur',
    'markt_einordnung',
    'begruendung',
    'unsicherheiten',
    'hinweis_rechtlich',
  ],
}

export type BesitzProduktKontext = {
  name: string
  kategorie: string
  einkaufspreis_eur: number
  einkaufsdatum: string | null
  haendler: string | null
  hersteller: string | null
  notiz: string | null
}

export type BesitzGebrauchtpreisErgebnis = {
  zustand_kurz: string
  zustand_stufe: string
  preis_min_eur: number
  preis_max_eur: number
  preis_wahrscheinlich_eur: number
  markt_einordnung: string
  begruendung: string
  unsicherheiten: string[]
  hinweis_rechtlich: string
}

export function buildBesitzGebrauchtpreisSystemPrompt(): string {
  return `Du bist ein **senior Gebrauchtwaren- und Second-Hand-Gutachter** (Deutschland / DACH) mit Schwerpunkt auf **privaten Verkauf** (z. B. eBay Kleinanzeigen, Facebook-Marktplatz, Vinted, regionaler Flohmarkt) sowie gängigen **Ankauf-/Trade-in-Kanälen** (z. B. Rebuy, refurbed, Händlerankauf), wo relevant.

## Aufgabe
Anhand der **Fotos vom aktuellen Zustand** und der **Stammdaten** des Gegenstands schätzt du eine **realistische aktuelle Verkaufsspanne** in **EUR** für einen **privaten Gebrauchtverkauf** in gutem bis üblichem Zustand — **nicht** Neupreis, **nicht** Versicherungs-/Zeitwert, **keine** rechtsverbindliche Wertermittlung.

## Vorgehen (intern, dann strukturiert ausgeben)
1. **Identifikation**: Was ist erkennbar (Produkttyp, Marke, Modell, Größe, Zubehör, Altersspur)? Nutze die Fotos priorisiert; Stammdaten ergänzen.
2. **Zustand**: Bewerte sichtbar Gebrauchsspuren, Reinheit, Vollständigkeit (OVP, Zubehör, Kratzer, Risse, Funktion nur wenn erkennbar), Authentizitätsrisiko nur vorsichtig ansprechen.
3. **Markt**: Ordne den Artikel **marktgängigen Gebrauchtpreisen** zu. Wenn du **aktuelle Referenzpreise** recherchieren kannst (Web), nutze das; sonst konservativ aus Erfahrung und typischen Preisniveaus in DE.
4. **Spanne**: \`preis_min_eur\` ≤ \`preis_wahrscheinlich_eur\` ≤ \`preis_max_eur\`. Die Spanne soll typische Verhandlung und Zustandsstreuung abbilden (meist **nicht** extrem schmal bei unsicherem Zustand).
5. **Einkaufspreis** aus den Daten nur **zur Einordnung** (nicht als „soll verkauft werden“): kurz erwähnen, ob der geschätzte Gebrauchtmarkt darüber/unter liegt und warum.

## Regeln
- Sprache der Textfelder: **Deutsch**, sachlich, für Laien verständlich.
- Keine Garantie auf erzielbaren Preis; immer Unsicherheiten nennen, wenn Fotos Lücken lassen.
- Keine Anweisung zu Betrug, Fälschungen oder Täuschung am Käufer.
- Wenn der Gegenstand auf Fotos **nicht** zum Stammdaten passt: ehrlich sagen und trotzdem bestmöglich schätzen oder Spanne breiter setzen.
- **Antwort ausschließlich** als ein JSON-Objekt gemäß vorgegebenem Schema (kein Markdown außerhalb des JSON).

## JSON-Felder (Bedeutung)
- \`zustand_kurz\`: 1–3 Sätze sichtbarer Zustand aus den Fotos.
- \`zustand_stufe\`: eine von exakt: \`neuwertig\` | \`sehr_gut\` | \`gut\` | \`befriedigend\` | \`stark_gebraucht\` | \`unbekannt\`.
- \`preis_min_eur\`, \`preis_max_eur\`, \`preis_wahrscheinlich_eur\`: Zahlen in **EUR**, ganzzahlig oder eine Nachkommastelle.
- \`markt_einordnung\`: 2–5 Sätze: typische Verkaufskanäle, was du am Markt vergleichbar siehst (ohne erfundene konkrete Anzeigen-IDs).
- \`begruendung\`: 4–8 Sätze: Zustand + Marktlogik + Einordnung Einkaufspreis.
- \`unsicherheiten\`: 0–6 kurze Punkte (Strings), was die Schätzung trübt.
- \`hinweis_rechtlich\`: ein Satz: z. B. dass es **keine** offizielle Wertermittlung ist und lokale Nachfrage schwankt.`
}

export function buildBesitzGebrauchtpreisUserText(
  p: BesitzProduktKontext,
  anzahlFotos: number,
  mitWebRecherche: boolean,
): string {
  const web = mitWebRecherche
    ? 'Du kannst bei passender Konfiguration **aktuelle Web-Preise** einbeziehen (Gebrauchtangebote Deutschland / EU).'
    : 'Es steht **keine Live-Web-Recherche** zur Verfügung — arbeite mit deinem Marktwissen (Deutschland, Stand 2026) und den Fotos; markiere Unsicherheiten klar.'
  return `## Stammdaten (aus App, vertraulich)
${JSON.stringify(
  {
    name: p.name,
    kategorie: p.kategorie,
    einkaufspreis_eur: p.einkaufspreis_eur,
    einkaufsdatum: p.einkaufsdatum,
    haendler: p.haendler,
    hersteller: p.hersteller,
    notiz: p.notiz,
  },
  null,
  2,
)}

## Fotos
Es folgen **${anzahlFotos}** Foto(s) vom **aktuellen** Zustand des Gegenstands (Reihenfolge beliebig). Bitte alle sichtbaren Details für Preis und Zustand nutzen.

${web}

Antworte **nur** mit dem geforderten JSON-Objekt (ein Objekt, kein Text davor oder danach).`
}

function extractJsonObject(text: string): string | null {
  const t = text.trim()
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const inner = fence ? fence[1].trim() : t
  if (inner.startsWith('{')) return inner
  const m = inner.match(/\{[\s\S]*\}/)
  return m ? m[0] : null
}

function clampZahl(n: unknown, fallback: number): number {
  const x = typeof n === 'number' ? n : Number.parseFloat(String(n ?? ''))
  if (!Number.isFinite(x) || x < 0) return fallback
  return Math.round(x * 100) / 100
}

export function parseBesitzGebrauchtpreisJson(raw: string): BesitzGebrauchtpreisErgebnis | null {
  const blob = extractJsonObject(raw)
  if (!blob) return null
  let o: Record<string, unknown>
  try {
    o = JSON.parse(blob) as Record<string, unknown>
  } catch {
    return null
  }
  let min = clampZahl(o.preis_min_eur, NaN)
  let max = clampZahl(o.preis_max_eur, NaN)
  let w = clampZahl(o.preis_wahrscheinlich_eur, NaN)
  if (!Number.isFinite(min)) min = 0
  if (!Number.isFinite(max)) max = min
  if (!Number.isFinite(w)) w = (min + max) / 2
  if (min > max) [min, max] = [max, min]
  if (w < min) w = min
  if (w > max) w = max

  const uns = Array.isArray(o.unsicherheiten) ? o.unsicherheiten.map((x) => String(x).trim()).filter(Boolean) : []

  return {
    zustand_kurz: typeof o.zustand_kurz === 'string' ? o.zustand_kurz.trim() : '',
    zustand_stufe: typeof o.zustand_stufe === 'string' ? o.zustand_stufe.trim() : 'unbekannt',
    preis_min_eur: min,
    preis_max_eur: max,
    preis_wahrscheinlich_eur: w,
    markt_einordnung: typeof o.markt_einordnung === 'string' ? o.markt_einordnung.trim() : '',
    begruendung: typeof o.begruendung === 'string' ? o.begruendung.trim() : '',
    unsicherheiten: uns.slice(0, 8),
    hinweis_rechtlich:
      typeof o.hinweis_rechtlich === 'string' && o.hinweis_rechtlich.trim()
        ? o.hinweis_rechtlich.trim()
        : 'Keine rechtsverbindliche Wertermittlung; tatsächlich erzielbarer Preis hängt von Nachfrage, Beschreibung und Zeitpunkt ab.',
  }
}
