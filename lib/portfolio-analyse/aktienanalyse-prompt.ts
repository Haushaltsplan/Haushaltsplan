/**
 * Aktienanalyse — Prompt, Block-Typen und JSON-Schema für Gemini.
 */

export const AKTIENANALYSE_PROMPT_LS = 'pa-aktienanalyse-prompt-v5'

/** Alte LocalStorage-Keys — beim Laden löschen, damit kein veralteter Prompt hängen bleibt. */
export const AKTIENANALYSE_PROMPT_LS_LEGACY = [
  'pa-aktienanalyse-prompt',
  'pa-aktienanalyse-prompt-v1',
  'pa-aktienanalyse-prompt-v2',
  'pa-aktienanalyse-prompt-v3',
  'pa-aktienanalyse-prompt-v4',
] as const

/** Fingerprint: gespeicherter Prompt ohne diese Marker gilt als veraltet → Default. */
export const AKTIENANALYSE_PROMPT_MARKER = 'Analysten-Schätzungen (PFLICHT)'

export type AktienanalyseCoverTon = 'positiv' | 'neutral' | 'vorsichtig'

export type AktienanalyseCover = {
  untertitel: string
  stichwort: string
  ton: AktienanalyseCoverTon
}

export type AktienanalyseTextBlock = {
  type: 'text'
  markdown: string
}

export type AktienanalyseChartBlock = {
  type: 'chart'
  titel?: string
  metrikIds: string[]
  jahre?: number
  variant?: 'standard' | 'bewertung'
}

export type AktienanalyseKennzahlBlock = {
  type: 'kennzahl'
  label: string
  wert: string
  kontext?: string
}

export type AktienanalyseZitatBlock = {
  type: 'zitat'
  text: string
  quelle?: string
}

export type AktienanalyseCalloutBlock = {
  type: 'callout'
  variant?: 'thesis' | 'risiko' | 'chance'
  markdown: string
}

export type AktienanalyseBlock =
  | AktienanalyseTextBlock
  | AktienanalyseChartBlock
  | AktienanalyseKennzahlBlock
  | AktienanalyseZitatBlock
  | AktienanalyseCalloutBlock

export type AktienanalyseBericht = {
  titel: string
  cover: AktienanalyseCover
  bloecke: AktienanalyseBlock[]
}

export type AktienanalyseEintrag = {
  id: string
  ticker: string
  titel: string
  promptSnapshot: string
  bericht: AktienanalyseBericht
  thumbnailSvg: string | null
  /** z. B. gemini-3.5-flash — für „Erstellt von Gemini (Modell)“ */
  kiModell: string | null
  createdAt: string
}

/** Häufige Metrik-IDs aus Fundamentaldaten (Charts). */
export const AKTIENANALYSE_METRIK_IDS = [
  'umsatz',
  'bruttogewinn',
  'bruttomarge',
  'ebitda',
  'ebitda_marge',
  'ebit',
  'ebit_marge',
  'nettogewinn',
  'nettomarge',
  'eps',
  'ocf',
  'fcf',
  'fcf_marge',
  'capex',
  'sga',
  'rd',
  'sbc',
  'da',
  'dividenden_gezahlt',
  'free_cash_flow_yield',
  'kgv',
  'kgv_ntm',
  'ev_ebitda',
  'ev_sales',
  'ps',
  'roe',
  'roic',
] as const

export const AKTIENANALYSE_DEFAULT_PROMPT = `Du agierst als leitender Equity Research Analyst mit der Herangehensweise eines Quality-Compounder-Investors (hohe Kapitaleffizienz, Preissetzungsmacht, Kapitalallokation, nachhaltiger Value Spread).

Deine Aufgabe ist es nicht, Finanzdaten lediglich aufzulisten. Erstelle eine tiefgehende, kritische, fundierte und nüchterne Investment-Analyse auf Basis des bereitgestellten JSON-Exports. Analysiere das Zahlenmaterial über die ausgewiesenen Jahre, erkläre Ursachen-Wirkungs-Zusammenhänge und entwickle begründete Zukunftsszenarien — nur wo die Daten das tragen.

Die Ausgabe wird als hochwertiges Research-Magazin gerendert: nutze deshalb gezielt visuelle Blöcke (Charts, Kennzahlen, Zitate, Callouts), damit die Analyse auch optisch lustvoll zu lesen ist.

---

### REGELN & DATENLINIEN

1. Sprache & Stil
   - Nur Deutsch.
   - Nüchtern, handwerklich, sachlich — keine Floskeln, keine übertriebene Emotionalität.
   - Keine Meta-Kommentare („Datenlage dünn“, „Aufgrund fehlender Daten…“). Fehlt ein Thema: Abschnitt weglassen.

2. Fakten-Treue
   - AUSSCHLIESSLICH Fakten aus dem gelieferten JSON-Export.
   - Nichts erfinden.
   - KEINE Kursziele, KEINE expliziten Kauf-/Verkaufsempfehlungen.

3. Vollständige Datennutzung
   - Kennzahlen, Mantra, Struktur, News aus dem Export.
   - Analysten-Schätzungen (PFLICHT, wenn vorhanden):
     - tabs.finanzdaten.zeilen mit gruppe "schaetzungen" bzw. IDs umsatz_schaetzung, eps_schaetzung, ebitda_schaetzung, umsatz_wachstum_schaetzung, eps_wachstum_schaetzung
     - Perioden mit Schätzungs-Jahren (FY1/FY2 bzw. istSchätzung) in tabs.finanzdaten.perioden
     - Forward-/NTM-Bewertung: tabs.uebersicht.keyMetrics und tabs.bewertung (gruppe bewertung_ntm / bewertung_forward, z. B. ntm_pe, ntm_ev_ebitda, forward PE)
     - Diese Schätzungen explizit in Kennzahl-Blöcken und im Szenario-Teil nutzen; Historie vs. Konsens gegenüberstellen.
     - Schätzungen sind Konsens-/Marktdaten aus dem Export — keine eigenen Kursziele daraus ableiten.
   - tabs.quartalszahlen.earningsCalls.quartale:
     - zusammenfassung → Kernaussagen der fertigen Earnings-Memos
     - transcriptText → Nuancen, Zitate, Management-Tonfall (Original-Transkript, ggf. gekürzt)
   - tabs.quartalszahlen.secBerichte: zusammenfassung und Textauszüge
   - quartalsKiDiffs und Beat/Miss-Historie einbeziehen, falls vorhanden.
   - ROIC/ROE/WACC/ROCE nur ansprechen, wenn entsprechende Werte im Export stehen.

4. Visuelle Charts (PFLICHT, wo passend)
   - Sobald du Wachstum, Umsatz, Margen, FCF, Verschuldung oder Bewertung über mehrere Jahre ansprichst: ZWISCHEN den Text-Blöcken einen chart-Block einfügen, dann mit Text weiterarbeiten.
   - Beispiel Umsatzverlauf: nach dem Absatz zum Umsatzwachstum sofort
     { "type": "chart", "titel": "Umsatz 5 Jahre", "metrikIds": ["umsatz"], "jahre": 5 }
   - Weitere typische Charts: ["umsatz","nettomarge"], ["ocf","fcf"], ["roe","roic"], ["kgv","ev_ebitda"] (variant: "bewertung" bei Bewertungs-Multiples).
   - jahre typisch 5–10. NUR diese metrikIds: ${AKTIENANALYSE_METRIK_IDS.join(', ')}
   - Mindestens 2–4 Chart-Blöcke, wenn Zeitreihen vorhanden.

5. Visuelle Lese-Elemente (PFLICHT für Magazin-Feeling)
   - cover: Kurz-Untertitel (max. 90 Zeichen), Stichwort (1–2 Wörter), ton = positiv|neutral|vorsichtig — für das Vorschaubild.
   - Nach der Thesis: 2–4 kennzahl-Blöcke mit den wichtigsten Zahlen (label, wert, optional kontext).
   - 1–2 zitat-Blöcke aus Earnings/SEC (echtes Zitat oder sinngemäß aus Zusammenfassung, mit Quelle).
   - 1–3 callout-Blöcke: variant "thesis" | "risiko" | "chance" mit kurzem markdown.
   - text-Blöcke: Markdown mit ## / ###, **fett**, Aufzählungen mit -

6. Lesefluss
   - Kurze Absätze (3–6 Sätze), dann visueller Block, dann weiter.
   - Keine Wand aus Text ohne Unterbrechung.

---

### STRUKTUR DER ANALYSE

1. Executive Summary & Investment-Thesis (+ callout thesis, kennzahlen)
2. Historische Ertrags- & Cashflow-Qualität (+ Charts Umsatz/Margen/FCF)
3. Wettbewerbsvorteil & Preissetzungsmacht
4. Kritische Risiken & Earnings/SEC (+ zitat, callout risiko)
5. Szenario-Prognose & Bewertungstrends (+ Bewertungs-Chart)
   - Base / Bull / Bear an historischen Mustern UND an vorhandenen Analysten-Schätzungen (Umsatz/EPS/EBITDA, Wachstum) ausrichten.
   - Wenn Schätzungen fehlen: nur Historie; nichts erfinden.
   - Forward-Multiples (NTM/FY KGV, EV/EBITDA) aus keyMetrics/bewertung einordnen.
6. Fazit (+ callout chance oder thesis)

---

### AUSGABEFORMAT (STRIKTES JSON)

Nur ein gültiges JSON-Objekt — ohne Markdown-Codefence, ohne Prolog.

Block-Typen:
- { "type": "text", "markdown": "..." }
- { "type": "chart", "titel": "Umsatz 5 Jahre", "metrikIds": ["umsatz"], "jahre": 5 }
- { "type": "kennzahl", "label": "ROIC", "wert": "18 %", "kontext": "5J-Schnitt" }
- { "type": "zitat", "text": "...", "quelle": "Q2 Earnings Call" }
- { "type": "callout", "variant": "thesis", "markdown": "**Kernthese:** ..." }

Beispiel:
{
  "titel": "Equity Research: Unternehmensname",
  "cover": {
    "untertitel": "Quality Compounder mit Preissetzungsmacht — teuer, aber robust",
    "stichwort": "Compounder",
    "ton": "neutral"
  },
  "bloecke": [
    { "type": "callout", "variant": "thesis", "markdown": "**Kernthese:** ..." },
    { "type": "kennzahl", "label": "Bruttomarge", "wert": "62 %", "kontext": "stabil seit 5J" },
    { "type": "kennzahl", "label": "FCF-Marge", "wert": "24 %", "kontext": "TTM" },
    { "type": "text", "markdown": "## Executive Summary\\n..." },
    { "type": "chart", "titel": "Umsatz 5 Jahre", "metrikIds": ["umsatz"], "jahre": 5 },
    { "type": "text", "markdown": "..." },
    { "type": "zitat", "text": "...", "quelle": "Q3 Earnings" }
  ]
}`

export const AKTIENANALYSE_JSON_SCHEMA: Record<string, unknown> = {
  type: 'OBJECT',
  properties: {
    titel: { type: 'STRING' },
    cover: {
      type: 'OBJECT',
      properties: {
        untertitel: { type: 'STRING' },
        stichwort: { type: 'STRING' },
        ton: { type: 'STRING' },
      },
    },
    bloecke: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          type: { type: 'STRING' },
          markdown: { type: 'STRING' },
          titel: { type: 'STRING' },
          metrikIds: { type: 'ARRAY', items: { type: 'STRING' } },
          jahre: { type: 'NUMBER' },
          variant: { type: 'STRING' },
          label: { type: 'STRING' },
          wert: { type: 'STRING' },
          kontext: { type: 'STRING' },
          text: { type: 'STRING' },
          quelle: { type: 'STRING' },
        },
        required: ['type'],
      },
    },
  },
  required: ['titel', 'bloecke'],
}

function normalisiereCover(raw: unknown, titel: string): AktienanalyseCover {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const tonRaw = String(o.ton ?? '').toLowerCase().trim()
  const ton: AktienanalyseCoverTon =
    tonRaw === 'positiv' || tonRaw === 'bullish'
      ? 'positiv'
      : tonRaw === 'vorsichtig' || tonRaw === 'cautious' || tonRaw === 'bearish'
        ? 'vorsichtig'
        : 'neutral'
  const untertitel =
    String(o.untertitel ?? o.subtitle ?? '').trim().slice(0, 120) ||
    titel.slice(0, 90)
  const stichwort =
    String(o.stichwort ?? o.badge ?? o.tag ?? '')
      .trim()
      .slice(0, 28) || 'Research'
  return { untertitel, stichwort, ton }
}

export function normalisiereAktienanalyseBericht(raw: unknown): AktienanalyseBericht {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const titel = String(o.titel ?? 'Aktienanalyse').trim().slice(0, 200) || 'Aktienanalyse'
  const cover = normalisiereCover(o.cover, titel)
  const rawBloecke = Array.isArray(o.bloecke) ? o.bloecke : []
  const bloecke: AktienanalyseBlock[] = []

  for (const b of rawBloecke.slice(0, 48)) {
    if (!b || typeof b !== 'object') continue
    const row = b as Record<string, unknown>
    const type = String(row.type ?? row.typ ?? '')
      .toLowerCase()
      .trim()

    if (type === 'text') {
      const markdown = String(row.markdown ?? row.inhalt ?? '').trim()
      if (markdown) bloecke.push({ type: 'text', markdown: markdown.slice(0, 12_000) })
      continue
    }

    if (type === 'chart') {
      const metrikIds = (Array.isArray(row.metrikIds) ? row.metrikIds : [])
        .map((x) => String(x).trim().toLowerCase())
        .filter((id) => id.length > 0)
        .slice(0, 6)
      if (metrikIds.length === 0) continue
      const jahreRaw = Number(row.jahre)
      const jahre =
        Number.isFinite(jahreRaw) && jahreRaw >= 2 && jahreRaw <= 20 ? Math.round(jahreRaw) : 5
      const variant = row.variant === 'bewertung' ? 'bewertung' : 'standard'
      bloecke.push({
        type: 'chart',
        titel: row.titel != null ? String(row.titel).trim().slice(0, 120) : undefined,
        metrikIds,
        jahre,
        variant,
      })
      continue
    }

    if (type === 'kennzahl' || type === 'metric' || type === 'kpi') {
      const label = String(row.label ?? row.titel ?? '').trim().slice(0, 48)
      const wert = String(row.wert ?? row.value ?? '').trim().slice(0, 40)
      if (!label || !wert) continue
      const kontext = row.kontext != null ? String(row.kontext).trim().slice(0, 80) : undefined
      bloecke.push({ type: 'kennzahl', label, wert, kontext: kontext || undefined })
      continue
    }

    if (type === 'zitat' || type === 'quote') {
      const text = String(row.text ?? row.markdown ?? row.inhalt ?? '').trim().slice(0, 600)
      if (!text) continue
      const quelle = row.quelle != null ? String(row.quelle).trim().slice(0, 80) : undefined
      bloecke.push({ type: 'zitat', text, quelle: quelle || undefined })
      continue
    }

    if (type === 'callout' || type === 'hinweis' || type === 'box') {
      const markdown = String(row.markdown ?? row.inhalt ?? row.text ?? '').trim().slice(0, 1_200)
      if (!markdown) continue
      const v = String(row.variant ?? row.art ?? '').toLowerCase()
      const variant =
        v === 'risiko' || v === 'risk'
          ? 'risiko'
          : v === 'chance' || v === 'opportunity'
            ? 'chance'
            : 'thesis'
      bloecke.push({ type: 'callout', variant, markdown })
    }
  }

  if (bloecke.length === 0) {
    bloecke.push({ type: 'text', markdown: '_Keine auswertbaren Analyse-Blöcke geliefert._' })
  }

  return { titel, cover, bloecke }
}
