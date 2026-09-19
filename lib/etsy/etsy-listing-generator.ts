/** Vision → Titel, Beschreibung, Tags (Gemini Free). */

import 'server-only'

import {
  buildEtsyListingSystemPrompt,
  ETSY_LISTING_JSON_SCHEMA,
} from '@/lib/etsy/etsy-listing-prompt'
import type { EtsyGeneratedListing, EtsyListingBasis } from '@/lib/etsy/etsy-types'
import {
  resolveGeminiFreeTierProvider,
  runCoachCompletion,
  type CoachImagePart,
  type CoachMessage,
} from '@/lib/ki-coach-backend'

const TITLE_MAX = 140
const TAG_MAX = 20
const TAG_COUNT = 13

function parseJsonObject(reply: string): Record<string, unknown> | null {
  const t = reply.trim()
  try {
    return JSON.parse(t) as Record<string, unknown>
  } catch {
    const start = t.indexOf('{')
    const end = t.lastIndexOf('}')
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(t.slice(start, end + 1)) as Record<string, unknown>
      } catch {
        return null
      }
    }
    return null
  }
}

function normalisiereTag(raw: string): string {
  return raw
    .replace(/,/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, TAG_MAX)
}

function normalisiereTags(raw: unknown): string[] {
  const list = Array.isArray(raw) ? raw : typeof raw === 'string' ? raw.split(',') : []
  const seen = new Set<string>()
  const out: string[] = []
  for (const item of list) {
    const t = normalisiereTag(String(item || ''))
    if (!t) continue
    const key = t.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(t)
    if (out.length >= TAG_COUNT) break
  }
  const fallbacks = [
    'holzschale',
    'handgedreht',
    'unikat holz',
    'drechselarbeit',
    'holzschale deko',
    'walnussöl finish',
    'handgemacht',
    'niederbayern',
    'holzschale obst',
    'massivholz',
    'holzschale modern',
    'naturrand',
    'holzgeschenk',
  ]
  for (const f of fallbacks) {
    if (out.length >= TAG_COUNT) break
    const t = normalisiereTag(f)
    const key = t.toLowerCase()
    if (!t || seen.has(key)) continue
    seen.add(key)
    out.push(t)
  }
  return out.slice(0, TAG_COUNT)
}

function validiereListing(raw: Record<string, unknown>): EtsyGeneratedListing {
  let title = typeof raw.title === 'string' ? raw.title.trim().replace(/\s+/g, ' ') : ''
  if (title.length > TITLE_MAX) title = title.slice(0, TITLE_MAX).trim()
  if (!title) throw new Error('KI lieferte keinen gültigen Titel.')

  let description = typeof raw.description === 'string' ? raw.description.trim() : ''
  const warenkorb =
    typeof raw.warenkorbZusammenfassung === 'string' ? raw.warenkorbZusammenfassung.trim() : ''
  if (warenkorb) {
    description = `${description}\n\n${warenkorb}`.trim()
  }
  if (!description) throw new Error('KI lieferte keine Beschreibung.')

  const tags = normalisiereTags(raw.tags)
  if (tags.length < TAG_COUNT) {
    throw new Error(`KI lieferte nur ${tags.length} Tags — ${TAG_COUNT} erforderlich.`)
  }

  return {
    title,
    description,
    tags,
    warenkorbZusammenfassung: warenkorb,
  }
}

function baueUserPrompt(basis: EtsyListingBasis): string {
  const zeilen = [
    'Erstelle ein Etsy-Listing (JSON) für dieses handgedrechselte Holzprodukt.',
    `Preis (EUR, Info): ${basis.preisEur}`,
  ]
  if (basis.holzart?.trim()) zeilen.push(`Holzart (verbindlich): ${basis.holzart.trim()}`)
  if (basis.masse?.trim()) zeilen.push(`Maße (verbindlich): ${basis.masse.trim()}`)
  if (basis.materials?.length) zeilen.push(`Materialien: ${basis.materials.join(', ')}`)
  zeilen.push('Analysiere die angehängten Produktfotos gründlich.')
  return zeilen.join('\n')
}

export async function generiereEtsyListingTexte(
  images: CoachImagePart[],
  basis: EtsyListingBasis,
): Promise<EtsyGeneratedListing> {
  if (images.length === 0) throw new Error('Mindestens ein Produktfoto ist erforderlich.')

  const resolved = resolveGeminiFreeTierProvider()
  if (!resolved) {
    throw new Error('GEMINI_API_KEY_FREE fehlt — der Etsy-Agent nutzt nur den Free-Tier-Key.')
  }

  const messages: CoachMessage[] = [
    {
      role: 'user',
      content: baueUserPrompt(basis),
      images: images.slice(0, 8),
    },
  ]

  const result = await runCoachCompletion(
    'gemini',
    resolved.apiKey,
    buildEtsyListingSystemPrompt(),
    messages,
    {
      temperature: 0.45,
      geminiForceFreeApiKey: true,
      thinkingMinimal: true,
      maxOutputTokens: 4096,
      jsonResponse: { schema: ETSY_LISTING_JSON_SCHEMA },
    },
  )

  if (!result.ok) {
    throw new Error(result.hint || 'KI-Generierung fehlgeschlagen.')
  }

  const parsed = parseJsonObject(result.reply)
  if (!parsed) throw new Error('KI-Antwort war kein gültiges JSON.')
  return validiereListing(parsed)
}
