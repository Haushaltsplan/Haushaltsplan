/**
 * News-Terminal — KI-Tagesfazit pro Unternehmen (Deutsch, Gemini Free Flash).
 * Pro Request bewusst wenige Titel (Client batched alle ~40 in mehreren Calls).
 */

import 'server-only'

import {
  geminiFreeTierFlashModelKandidaten,
  resolveCoachProviderFromMode,
  runCoachCompletion,
} from '@/lib/ki-coach-backend'
import { teileArray } from '@/lib/portfolio-analyse/batch-hilfen'
import type {
  NewsTerminalKiFazit,
  NewsTerminalKiPaket,
  NewsTerminalZeile,
} from '@/lib/portfolio-analyse/portfolio-news-terminal-types'

const SYSTEM_PROMPT = `Du bist ein nüchterner Finanz-Nachrichtenredakteur.
Aufgabe: Fasse die vorliegenden Schlagzeilen zu EINEM Unternehmen in 2–4 kurzen deutschen Sätzen zusammen.
Regeln:
- Nur Deutsch.
- Nur Fakten aus den Schlagzeilen — nichts erfinden, keine Kursziele, keine Kauf-/Verkaufsempfehlung.
- Wenn die Meldungen dünn oder irrelevant wirken: klar sagen, dass wenig Substanz dabei ist.
- Keine Aufzählung der Originaltitel; verdichte zu einem lesbaren Tagesfazit.
- Maximal ~80 Wörter.`

const MAX_HEADLINES = 8
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
  const provider = resolveCoachProviderFromMode('gemini')
  if (!provider || provider.provider !== 'gemini') {
    return {
      symbol: g.symbol,
      name: g.name,
      fazit: '',
      anzahlMeldungen: g.headlines.length,
      fehler: 'Gemini nicht konfiguriert.',
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
    'Schreibe jetzt das deutsche Tagesfazit.',
  ].join('\n')

  const models = geminiFreeTierFlashModelKandidaten({
    primaryEnvKeys: ['NEWS_SUMMARY_GEMINI_MODEL', 'FINANCE_COACH_GEMINI_MODEL', 'GEMINI_MODEL'],
  })

  const result = await runCoachCompletion(
    provider.provider,
    provider.apiKey,
    SYSTEM_PROMPT,
    [{ role: 'user', content: userText }],
    { temperature: 0.3, geminiModels: models },
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
    fazit: result.reply.trim(),
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
