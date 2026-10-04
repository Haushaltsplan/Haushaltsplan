/**
 * News-Terminal — KI-Tagesfazit pro Unternehmen (Deutsch, Gemini Free Flash).
 * Pro Request bewusst wenige Titel (Client batched alle ~40 in mehreren Calls).
 */

import 'server-only'

import {
  geminiFreeTierFlashModelKandidaten,
  resolveGeminiFreeTierProvider,
  runCoachCompletion,
} from '@/lib/ki-coach-backend'
import { teileArray } from '@/lib/portfolio-analyse/batch-hilfen'
import type {
  NewsTerminalKiFazit,
  NewsTerminalKiPaket,
  NewsTerminalZeile,
} from '@/lib/portfolio-analyse/portfolio-news-terminal-types'

const SYSTEM_PROMPT = `Du bist ein nüchterner Finanz-Nachrichtenredakteur für ein Aktien-Depot-Dashboard.
Aufgabe: Schreibe zu EINEM Unternehmen ein informatives deutsches Nachrichtenfazit aus den gelieferten Schlagzeilen.

Inhalt (so viel wie die Schlagzeilen hergeben):
- Was konkret passiert ist (Produkt, Quartalszahlen, Personal, Regulierung, M&A, Partnerschaft, Rechtsstreit, …)
- Wer betroffen ist / was das Unternehmen betrifft
- Genannte Zahlen, Zeiträume, Produkte, Regionen — wörtlich übernehmen, wenn in den Titeln stehen
- Wenn mehrere Themen: die 2–3 wichtigsten getrennt ansprechen (nicht alles zu einem Nebel verdichten)
- Kurzer Kontext nur, wenn er aus den Schlagzeilen folgt (z. B. „nach Gewinnwarnung“, „vor Earnings“)

Form:
- Nur Deutsch, 4–8 Sätze, ca. 120–220 Wörter wenn Substanz da ist
- Fließtext, keine Aufzählung der Originaltitel, keine Bullet-Punkte
- Nichts erfinden; keine Kursziele; keine Kauf-/Verkaufsempfehlung

VERBOTEN — diese Meta-Sätze und Synonyme niemals schreiben:
- „Nachrichtenlage dünn/schwach/ruhig/überschaubar“
- „wenig Substanz / wenig Relevanz / kaum belastbare Infos“
- „keine wesentlichen Meldungen / nichts Neues / nur Rauschen“
- Kommentare über die Qualität oder Menge der Nachrichtenlage
Wenn nur wenig Brauchbares da ist: kurz die konkreten Fakten nennen — oder bei komplett irrelevanten Titeln gar nichts Meta schreiben, sondern 1–2 Sätze nur zum greifbaren Inhalt. Nie die Dürftigkeit kommentieren.`

const MAX_HEADLINES = 12

/** Entfernt Meta-Floskeln zur „dünnen Nachrichtenlage“, falls das Modell sie trotzdem liefert. */
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
/** Sicherheit pro Request — der Client schickt Batches. */
const MAX_UNTERNEHMEN_PRO_REQUEST = 8
const PARALLEL = 2
const ZEIT_BUDGET_MS = 150_000

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

async function fazitFuerUnternehmen(g: Gruppe): Promise<NewsTerminalKiFazit> {
  const provider = resolveGeminiFreeTierProvider()
  if (!provider) {
    return {
      symbol: g.symbol,
      name: g.name,
      fazit: '',
      anzahlMeldungen: g.headlines.length,
      fehler: 'GEMINI_API_KEY_FREE fehlt — News-Fazit darf den Billing-Key nicht nutzen.',
    }
  }

  const liste = g.headlines
    .map((h, i) => `${i + 1}. [${h.quelle}] ${h.titel}`)
    .join('\n')

  const userText = [
    `Unternehmen: ${g.name} (${g.symbol})`,
    `Anzahl Meldungen: ${g.headlines.length}`,
    '',
    'Schlagzeilen:',
    liste,
    '',
    'Schreibe jetzt ein informatives deutsches Fazit mit möglichst vielen konkreten Fakten aus diesen Schlagzeilen.',
    'Keine Meta-Kommentare zur Nachrichtenlage.',
  ].join('\n')

  const models = geminiFreeTierFlashModelKandidaten({
    primaryEnvKeys: ['NEWS_SUMMARY_GEMINI_MODEL', 'FINANCE_COACH_GEMINI_MODEL', 'GEMINI_MODEL'],
  })

  const result = await runCoachCompletion(
    provider.provider,
    provider.apiKey,
    SYSTEM_PROMPT,
    [{ role: 'user', content: userText }],
    { temperature: 0.3, geminiModels: models, geminiForceFreeApiKey: true },
  )

  if (!result.ok) {
    return {
      symbol: g.symbol,
      name: g.name,
      fazit: '',
      anzahlMeldungen: g.headlines.length,
      fehler: result.hint || 'KI-Zusammenfassung fehlgeschlagen.',
    }
  }

  return {
    symbol: g.symbol,
    name: g.name,
    fazit: bereinigeFazitMeta(result.reply.trim()),
    anzahlMeldungen: g.headlines.length,
    fehler: null,
  }
}

export async function generiereNewsTerminalKiFazite(opts: {
  zeilen: NewsTerminalZeile[]
  nurHeute: boolean
}): Promise<NewsTerminalKiPaket> {
  const gruppen = gruppiereNachUnternehmen(opts.zeilen, opts.nurHeute)
  const fazite: NewsTerminalKiFazit[] = []
  const start = Date.now()
  const batches = teileArray(gruppen, PARALLEL)

  for (let bi = 0; bi < batches.length; bi++) {
    if (Date.now() - start > ZEIT_BUDGET_MS) {
      for (const g of batches.slice(bi).flat()) {
        fazite.push({
          symbol: g.symbol,
          name: g.name,
          fazit: '',
          anzahlMeldungen: g.headlines.length,
          fehler: 'Zeitbudget in diesem Batch — bitte erneut versuchen.',
        })
      }
      break
    }
    const parts = await Promise.all(batches[bi].map((g) => fazitFuerUnternehmen(g)))
    fazite.push(...parts)
  }

  fazite.sort((a, b) => a.name.localeCompare(b.name, 'de'))

  return {
    fazite,
    zeitraum: opts.nurHeute ? 'heute' : '48h',
    aktualisiertAm: new Date().toISOString(),
    modell: 'gemini-flash-free',
  }
}
