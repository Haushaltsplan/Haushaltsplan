/**
 * GEO-HOOK-Einleitung wie beim Neu-Listing (etsy-listing-prompt: HOOK → …).
 * Nur die Einleitung — Specs/Prozess/Abrundung bleiben im bestehenden Text.
 */
import 'server-only'

import { mitEtsyGeminiQueue } from '@/lib/etsy/etsy-gemini-queue'
import { normalisiereDrechselSprache } from '@/lib/etsy/etsy-drechsel-sprache'
import type { EtsyShopListingDetail } from '@/lib/etsy/etsy-seo-audit-types'
import {
  geminiFreeTierFlashModelKandidaten,
  resolveGeminiFreeTierProvider,
  runCoachCompletion,
} from '@/lib/ki-coach-backend'

const SYSTEM = `Du schreibst die GEO-/HOOK-Einleitung für ein bestehendes Etsy-Listing handgedrechselter Holzwaren (Niederbayern) — genau so wie beim Neu-Einstellen eines Produkts.

### AUFGABE
Liefere NUR gültiges JSON: { "intro": "…" }

### HOOK / GEO (wie Listing-Prompt Neuaufnahme)
- 3–6 Sätze, fließender Absatz (keine Emojis, keine Bullet-Liste).
- Die ersten 2 Sätze = Etsy-Vorschau + Google-Snippet: WAS (Produkt, Unikat, Holzart) · FÜR WEN / Nutzen (Obstschale, Esstisch, Sammler, Geschenk …). Holzart MUSS in diesen zwei Sätzen stehen.
- Handwerk-Sprache: „handgedrechselt“ / „handgedrechselte …“ — nie „handgedreht“.
- Sachlich, bodenständig — keine Floskeln („Zauber“, „Seele“, „Meisterwerk“, „traumhaft“).
- Anlass (Holzhochzeit, Einzug, Geburtstag) höchstens als ein Nebensatz, nie als alleinige Einleitung.
- Keine Specs-Blöcke (kein 🪵/📏), kein Entstehungsprozess, keine Pflegehinweise, keine Schluss-Abrundung.
- Nutze Titel, Tags und vorhandene Beschreibung nur als Faktenquelle (Holzart, Maße, Charakter).`

const JSON_SCHEMA = {
  type: 'OBJECT',
  properties: {
    intro: { type: 'STRING' },
  },
  required: ['intro'],
} as const

function parseIntro(reply: string): string | null {
  const t = reply.trim()
  try {
    const j = JSON.parse(t) as { intro?: string }
    if (typeof j.intro === 'string' && j.intro.trim()) return j.intro.trim()
  } catch {
    /* fallthrough */
  }
  const start = t.indexOf('{')
  const end = t.lastIndexOf('}')
  if (start >= 0 && end > start) {
    try {
      const j = JSON.parse(t.slice(start, end + 1)) as { intro?: string }
      if (typeof j.intro === 'string' && j.intro.trim()) return j.intro.trim()
    } catch {
      /* ignore */
    }
  }
  return null
}

export async function generiereGeoHookEinleitung(
  listing: EtsyShopListingDetail,
  opts?: { hauptbegriff?: string | null },
): Promise<string> {
  const resolved = resolveGeminiFreeTierProvider()
  if (!resolved) {
    throw new Error('GEMINI_API_KEY_FREE fehlt — Einleitung nutzt nur den Free-Tier-Key.')
  }

  const user = [
    `Titel: ${listing.title}`,
    `Tags: ${listing.tags.join(', ')}`,
    `Preis EUR: ${listing.priceEur ?? 'n/a'}`,
    `Material: ${(listing.materials ?? []).join(', ') || 'n/a'}`,
    opts?.hauptbegriff ? `Hauptbegriff: ${opts.hauptbegriff}` : '',
    '--- BESCHREIBUNG (Fakten, Struktur beibehalten — du schreibst NUR den Hook-Intro) ---',
    listing.description.slice(0, 6000),
    '',
    'Schreibe jetzt die HOOK-/GEO-Einleitung (3–6 Sätze) wie bei einem neuen Listing.',
  ]
    .filter(Boolean)
    .join('\n')

  const result = await mitEtsyGeminiQueue(() =>
    runCoachCompletion(
      'gemini',
      resolved.apiKey,
      SYSTEM,
      [{ role: 'user', content: user }],
      {
        temperature: 0.45,
        geminiForceFreeApiKey: true,
        thinkingMinimal: true,
        maxOutputTokens: 2048,
        timeoutMs: 55_000,
        geminiTotalBudgetMs: 90_000,
        geminiModels: geminiFreeTierFlashModelKandidaten(),
        jsonResponse: { schema: JSON_SCHEMA },
      },
    ),
  )

  if (!result.ok) throw new Error(result.hint || 'Einleitung generieren fehlgeschlagen.')
  const intro = parseIntro(result.reply)
  if (!intro) throw new Error('KI-Antwort ohne intro.')
  const clean = normalisiereDrechselSprache(intro)
  if (clean.length < 80) throw new Error('KI-Einleitung zu kurz.')
  return clean
}
