import 'server-only'

import {
  geminiFreeTierFlashModelKandidaten,
  resolveGeminiFreeTierProvider,
  runCoachCompletion,
} from '@/lib/ki-coach-backend'
import { tagBereinigen, tagsZusammen } from '@/lib/youtube/youtube-tags'

function parseJson(text: string): unknown {
  const start = text.indexOf('{')
  const startArr = text.indexOf('[')
  const useArr = startArr >= 0 && (start < 0 || startArr < start)
  const cut = useArr ? text.slice(startArr) : text.slice(start)
  const end = useArr ? cut.lastIndexOf(']') : cut.lastIndexOf('}')
  if (end < 0) return null
  try {
    return JSON.parse(cut.slice(0, end + 1)) as unknown
  } catch {
    return null
  }
}

async function frage(system: string, user: string): Promise<unknown> {
  const provider = resolveGeminiFreeTierProvider()
  if (!provider) throw new Error('GEMINI_API_KEY_FREE fehlt.')
  const result = await runCoachCompletion(provider.provider, provider.apiKey, system, [{ role: 'user', content: user }], {
    geminiModels: geminiFreeTierFlashModelKandidaten(),
    geminiForceFreeApiKey: true,
    maxOutputTokens: 2048,
    timeoutMs: 45_000,
    geminiTotalBudgetMs: 60_000,
  })
  if (!result.ok) throw new Error(result.hint || 'Text-Generierung fehlgeschlagen')
  const json = parseJson(result.reply)
  if (!json) throw new Error('Die KI lieferte kein gültiges JSON.')
  return json
}

const SYSTEM = `You write English YouTube Short metadata for an existing finance short.
Use only facts already in the current title, description or tags. Do not invent a company, a number, or a promise.
No guaranteed returns, no "risk-free", no "get rich".
Reply with JSON only.`

export async function erzeugeTitel(input: { titel: string; beschreibung: string; tags: string[] }): Promise<string[]> {
  const json = await frage(
    SYSTEM,
    `Current title: ${input.titel}\nDescription: ${input.beschreibung.slice(0, 600)}\nTags: ${input.tags.join(', ')}\nReturn {"titel":[five strings]}. Each title is 40–60 characters, search phrase first. Include the company or the number only if it is already in the current title.`,
  )
  const liste = Array.isArray((json as { titel?: unknown }).titel) ? (json as { titel: unknown[] }).titel : []
  return liste.map((t) => String(t).replace(/\s+/g, ' ').trim()).filter((t) => t.length >= 20 && t.length <= 80).slice(0, 5)
}

export async function erzeugeTags(input: { titel: string; beschreibung: string; tags: string[] }): Promise<string[]> {
  const json = await frage(
    SYSTEM,
    `Current title: ${input.titel}\nDescription: ${input.beschreibung.slice(0, 600)}\nTags: ${input.tags.join(', ')}\nReturn {"tags":[up to 30 short tags]}. Group ticker, metric and niche words that already fit this video. No hashtag sign.`,
  )
  const liste = Array.isArray((json as { tags?: unknown }).tags) ? (json as { tags: unknown[] }).tags : []
  return tagsZusammen([], liste.map((t) => tagBereinigen(String(t))).filter(Boolean))
}

export async function erzeugeBeschreibung(input: { titel: string; beschreibung: string; tags: string[] }): Promise<string> {
  const json = await frage(
    SYSTEM,
    `Current title: ${input.titel}\nDescription: ${input.beschreibung.slice(0, 800)}\nReturn {"beschreibung":"..."}. One short hook, the metric only if it is already in the title or description, then the line "Not investment advice". Do not replace a pinned comment.`,
  )
  const text = String((json as { beschreibung?: unknown }).beschreibung ?? '').trim()
  if (!text) throw new Error('Keine Beschreibung erhalten.')
  return text.includes('Not investment advice') ? text : `${text}\n\nNot investment advice.`
}

export async function erzeugeIdeen(input: { begriffe: string[]; titel: string[] }): Promise<string[]> {
  const json = await frage(
    SYSTEM,
    `Keyword chances: ${input.begriffe.slice(0, 8).join('; ') || 'none'}\nOutlier titles: ${input.titel.slice(0, 6).join(' | ') || 'none'}\nReturn {"ideen":[five English short ideas for this finance channel]}. Each idea is one sentence naming the question a short should open with. Do not write the full script.`,
  )
  const liste = Array.isArray((json as { ideen?: unknown }).ideen) ? (json as { ideen: unknown[] }).ideen : []
  return liste.map((t) => String(t).trim()).filter(Boolean).slice(0, 5)
}
