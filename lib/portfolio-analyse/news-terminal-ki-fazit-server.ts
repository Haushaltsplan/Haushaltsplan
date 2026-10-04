/**
 * News-Terminal — KI-Tagesfazit pro Unternehmen (Deutsch, Gemini Free Flash).
 * Ein Gemini-Call pro Request für alle Titel im Batch (JSON) — sonst Free-RPM/Timeouts.
 */

import 'server-only'

import {
  geminiFreeTierFlashModelKandidaten,
  resolveGeminiFreeTierProvider,
  runCoachCompletion,
} from '@/lib/ki-coach-backend'
import type {
  NewsTerminalKiFazit,
  NewsTerminalKiPaket,
  NewsTerminalZeile,
} from '@/lib/portfolio-analyse/portfolio-news-terminal-types'

const SYSTEM_PROMPT = `Du bist ein nüchterner Finanz-Nachrichtenredakteur für ein Aktien-Depot-Dashboard.
Aufgabe: Für JEDE gelieferte Firma ein informatives deutsches Nachrichtenfazit aus deren Schlagzeilen.

Inhalt je Firma (so viel wie die Schlagzeilen hergeben):
- Was konkret passiert ist (Produkt, Zahlen, Personal, Regulierung, M&A, Partnerschaft, Rechtsstreit, …)
- Genannte Zahlen, Zeiträume, Produkte, Regionen aus den Titeln übernehmen
- Bei mehreren Themen die 2–3 wichtigsten getrennt ansprechen

Form je Fazit:
- Nur Deutsch, 3–6 Sätze (ca. 80–160 Wörter wenn Substanz da ist)
- Fließtext, keine Bullet-Punkte, keine Aufzählung der Originaltitel
- Nichts erfinden; keine Kursziele; keine Kauf-/Verkaufsempfehlung

VERBOTEN in jedem Fazit:
- „Nachrichtenlage dünn/schwach/ruhig“, „wenig Substanz“, „kaum Relevanz“, „nichts Neues“
- Meta-Kommentare zur Menge/Qualität der Meldungen
Wenn wenig Brauchbares: kurz die konkreten Fakten — nie die Dürftigkeit kommentieren.

Antwort: NUR gültiges JSON gemäß Schema. Für jedes Symbol genau einen Eintrag.`

const MAX_HEADLINES = 8
const MAX_UNTERNEHMEN_PRO_REQUEST = 6
const MAX_RETRIES_BEI_RATE_LIMIT = 2

const FAZIT_JSON_SCHEMA: Record<string, unknown> = {
  type: 'OBJECT',
  properties: {
    fazite: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          symbol: { type: 'STRING' },
          fazit: { type: 'STRING' },
        },
        required: ['symbol', 'fazit'],
      },
    },
  },
  required: ['fazite'],
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

function bereinigeFazitMeta(text: string): string {
  const saetze = text
    .replace(/\s+/g, ' ')
    .trim()
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean)

  const meta =
    /nachrichtenlage|wenig substanz|kaum (belastbar|relevant|verwertbar)|keine wesentlichen meldungen|nichts wesentliches|nur (wenig|kaum) (relevante|substanzielle)|dünn(e|er)? (meldungs|nachrichten)|überschaubar(e|er)? nachrichten|kein(e)? relevante[nr]? (news|meldungen)|kaum neue information/i

  const behalten = saetze.filter((s) => !meta.test(s))
  return (behalten.length ? behalten : saetze).join(' ').trim()
}

function istRateLimitHinweis(hint: string): boolean {
  return /rate.?limit|30–60|zu viele anfragen|resource.?exhausted|too many requests|quota|429|kapazit/i.test(
    hint,
  )
}

type Gruppe = {
  symbol: string
  name: string
  headlines: { titel: string; quelle: string; datum: string | null }[]
}

function gruppiereNachUnternehmen(
  zeilen: NewsTerminalZeile[],
  nurHeute: boolean,
): Gruppe[] {
  const map = new Map<string, Gruppe>()
  for (const z of zeilen) {
    if (nurHeute && !z.istHeute) continue
    const u = z.unternehmen[0]
    if (!u) continue
    const symbol = (u.symbol || u.id || '').trim().toUpperCase()
    if (!symbol) continue
    let g = map.get(symbol)
    if (!g) {
      g = { symbol, name: u.name || symbol, headlines: [] }
      map.set(symbol, g)
    }
    if (g.headlines.length >= MAX_HEADLINES) continue
    g.headlines.push({
      titel: z.titel,
      quelle: z.quelle,
      datum: z.veroeffentlichtAm,
    })
  }
  return [...map.values()]
    .filter((g) => g.headlines.length > 0)
    .sort((a, b) => a.name.localeCompare(b.name, 'de'))
    .slice(0, MAX_UNTERNEHMEN_PRO_REQUEST)
}

function parseFaziteJson(
  raw: string,
  gruppen: Gruppe[],
): Map<string, string> {
  const out = new Map<string, string>()
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    const m = raw.match(/\{[\s\S]*\}/)
    if (!m) return out
    try {
      parsed = JSON.parse(m[0])
    } catch {
      return out
    }
  }
  const list =
    parsed && typeof parsed === 'object' && Array.isArray((parsed as { fazite?: unknown }).fazite)
      ? (parsed as { fazite: Array<{ symbol?: unknown; fazit?: unknown }> }).fazite
      : []
  const known = new Set(gruppen.map((g) => g.symbol.toUpperCase()))
  for (const row of list) {
    const symbol = String(row.symbol ?? '')
      .trim()
      .toUpperCase()
    const fazit = bereinigeFazitMeta(String(row.fazit ?? '').trim())
    if (!symbol || !fazit || !known.has(symbol)) continue
    out.set(symbol, fazit)
  }
  return out
}

async function faziteFuerBatch(gruppen: Gruppe[]): Promise<NewsTerminalKiFazit[]> {
  const leer = (fehler: string): NewsTerminalKiFazit[] =>
    gruppen.map((g) => ({
      symbol: g.symbol,
      name: g.name,
      fazit: '',
      anzahlMeldungen: g.headlines.length,
      fehler,
    }))

  const provider = resolveGeminiFreeTierProvider()
  if (!provider) {
    return leer('GEMINI_API_KEY_FREE fehlt — News-Fazit darf den Billing-Key nicht nutzen.')
  }

  const bloecke = gruppen
    .map((g) => {
      const liste = g.headlines
        .map((h, i) => `  ${i + 1}. [${h.quelle}] ${h.titel}`)
        .join('\n')
      return `### ${g.name} (${g.symbol}) — ${g.headlines.length} Meldung(en)\n${liste}`
    })
    .join('\n\n')

  const userText = [
    `Erstelle für jede der ${gruppen.length} Firmen ein Fazit.`,
    `Symbole (exakt so zurückgeben): ${gruppen.map((g) => g.symbol).join(', ')}`,
    '',
    bloecke,
    '',
    'JSON mit Array „fazite“: [{ "symbol": "…", "fazit": "…" }, …] — ein Eintrag pro Symbol.',
  ].join('\n')

  const models = geminiFreeTierFlashModelKandidaten({
    primaryEnvKeys: ['NEWS_SUMMARY_GEMINI_MODEL', 'FINANCE_COACH_GEMINI_MODEL', 'GEMINI_MODEL'],
  })

  let letzterFehler = 'KI-Zusammenfassung fehlgeschlagen.'

  for (let attempt = 0; attempt < MAX_RETRIES_BEI_RATE_LIMIT; attempt++) {
    if (attempt > 0) {
      const backoff = 12_000 + attempt * 8_000
      console.warn(
        `[news-ki-fazit] Batch Rate-Limit — warte ${Math.round(backoff / 1000)}s (Versuch ${attempt + 1})`,
      )
      await sleep(backoff)
    }

    const result = await runCoachCompletion(
      provider.provider,
      provider.apiKey,
      SYSTEM_PROMPT,
      [{ role: 'user', content: userText }],
      {
        temperature: 0.3,
        geminiModels: models,
        geminiForceFreeApiKey: true,
        jsonResponse: { schema: FAZIT_JSON_SCHEMA },
        maxOutputTokens: 4096,
        thinkingMinimal: true,
        timeoutMs: 90_000,
        geminiTotalBudgetMs: 120_000,
      },
    )

    if (!result.ok) {
      letzterFehler = result.hint || letzterFehler
      if (!istRateLimitHinweis(letzterFehler)) break
      continue
    }

    const map = parseFaziteJson(result.reply, gruppen)
    if (map.size === 0) {
      letzterFehler = 'KI lieferte keine auswertbaren Fazite.'
      break
    }

    return gruppen.map((g) => {
      const fazit = map.get(g.symbol.toUpperCase()) ?? ''
      return {
        symbol: g.symbol,
        name: g.name,
        fazit,
        anzahlMeldungen: g.headlines.length,
        fehler: fazit ? null : 'Kein Fazit für dieses Symbol in der KI-Antwort.',
      }
    })
  }

  return leer(letzterFehler)
}

export async function generiereNewsTerminalKiFazite(opts: {
  zeilen: NewsTerminalZeile[]
  nurHeute: boolean
}): Promise<NewsTerminalKiPaket> {
  const gruppen = gruppiereNachUnternehmen(opts.zeilen, opts.nurHeute)
  const fazite =
    gruppen.length === 0
      ? []
      : await faziteFuerBatch(gruppen)

  fazite.sort((a, b) => a.name.localeCompare(b.name, 'de'))

  return {
    fazite,
    zeitraum: opts.nurHeute ? 'heute' : '48h',
    aktualisiertAm: new Date().toISOString(),
    modell: 'gemini-flash-free',
  }
}
