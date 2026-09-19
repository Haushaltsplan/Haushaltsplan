/** Vision → Listing-Entwurf (Preisspanne, Taxonomy, Foto-Check). */

import 'server-only'

import {
  buildEtsyListingSystemPrompt,
  ETSY_LISTING_JSON_SCHEMA,
} from '@/lib/etsy/etsy-listing-prompt'
import {
  ETSY_DEFAULT_TAXONOMY_ID,
  ETSY_FORM_TAXONOMY,
  type EtsyFotoCheck,
  type EtsyGeneratedListing,
  type EtsyListingBasis,
} from '@/lib/etsy/etsy-types'
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
  return raw.replace(/,/g, ' ').replace(/\s+/g, ' ').trim().slice(0, TAG_MAX)
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

function euro(raw: unknown): number {
  const n = typeof raw === 'number' ? raw : Number(String(raw ?? '').replace(',', '.'))
  if (!Number.isFinite(n) || n < 1) return 0
  return Math.round(n)
}

function normalisiereTaxonomy(form: string, idRaw: unknown, labelRaw: unknown): {
  taxonomyId: number
  taxonomyLabel: string
  produktForm: string
} {
  const produktForm = (typeof form === 'string' && form.trim() ? form.trim() : 'Schale').slice(0, 40)
  const key = produktForm
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
  const mapped = Object.entries(ETSY_FORM_TAXONOMY).find(([k]) => key.includes(k))?.[1]
  let taxonomyId = euro(idRaw)
  if (taxonomyId < 1) taxonomyId = mapped?.id ?? ETSY_DEFAULT_TAXONOMY_ID
  const taxonomyLabel =
    (typeof labelRaw === 'string' && labelRaw.trim()
      ? labelRaw.trim()
      : mapped?.label || 'Schalen'
    ).slice(0, 80)
  return { taxonomyId, taxonomyLabel, produktForm }
}

function normalisiereFotoCheck(raw: unknown, imageCount: number): EtsyFotoCheck {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const hatHauptbild = o.hatHauptbild === true || imageCount >= 1
  const hatDetailMaserung = o.hatDetailMaserung === true
  const hatMassstab = o.hatMassstab === true
  const warnungen: string[] = []
  if (Array.isArray(o.warnungen)) {
    for (const w of o.warnungen) {
      const s = String(w || '').trim()
      if (s) warnungen.push(s.slice(0, 200))
    }
  }
  if (!hatHauptbild) warnungen.push('Kein klares Haupt-/Gesamtbild erkannt.')
  if (!hatDetailMaserung) warnungen.push('Detailfoto der Maserung/Oberfläche fehlt oder unklar.')
  if (!hatMassstab) warnungen.push('Maßstab fehlt (Hand, Münze oder Lineal empfohlen).')
  if (imageCount < 3) {
    warnungen.push(`Nur ${imageCount} Foto(s) — ideal: Hauptbild + Detail + Maßstab.`)
  }
  return {
    hatHauptbild,
    hatDetailMaserung,
    hatMassstab,
    warnungen: [...new Set(warnungen)].slice(0, 8),
  }
}

function validiereListing(raw: Record<string, unknown>, imageCount: number): EtsyGeneratedListing {
  let title = typeof raw.title === 'string' ? raw.title.trim().replace(/\s+/g, ' ') : ''
  if (title.length > TITLE_MAX) title = title.slice(0, TITLE_MAX).trim()
  if (!title) throw new Error('KI lieferte keinen gültigen Titel.')

  let description = typeof raw.description === 'string' ? raw.description.trim() : ''
  const warenkorb =
    typeof raw.warenkorbZusammenfassung === 'string' ? raw.warenkorbZusammenfassung.trim() : ''
  if (warenkorb) description = `${description}\n\n${warenkorb}`.trim()
  if (!description) throw new Error('KI lieferte keine Beschreibung.')

  const tags = normalisiereTags(raw.tags)
  if (tags.length < TAG_COUNT) {
    throw new Error(`KI lieferte nur ${tags.length} Tags — ${TAG_COUNT} erforderlich.`)
  }

  let preisMinEur = euro(raw.preisMinEur)
  let preisEmpfohlenEur = euro(raw.preisEmpfohlenEur)
  let preisMaxEur = euro(raw.preisMaxEur)
  if (preisEmpfohlenEur < 1) throw new Error('KI lieferte keinen gültigen Preisvorschlag.')
  if (preisMinEur < 1) preisMinEur = Math.max(1, Math.round(preisEmpfohlenEur * 0.85))
  if (preisMaxEur < 1) preisMaxEur = Math.round(preisEmpfohlenEur * 1.15)
  if (preisMinEur > preisEmpfohlenEur) [preisMinEur, preisEmpfohlenEur] = [preisEmpfohlenEur, preisMinEur]
  if (preisMaxEur < preisEmpfohlenEur) preisMaxEur = preisEmpfohlenEur

  const preisBegruendung =
    typeof raw.preisBegruendung === 'string' ? raw.preisBegruendung.trim() : ''
  if (!preisBegruendung) throw new Error('KI lieferte keine Preisbegründung.')

  const tax = normalisiereTaxonomy(
    typeof raw.produktForm === 'string' ? raw.produktForm : 'Schale',
    raw.taxonomyId,
    raw.taxonomyLabel,
  )

  return {
    title,
    description,
    tags,
    warenkorbZusammenfassung: warenkorb,
    preisMinEur,
    preisEmpfohlenEur,
    preisMaxEur,
    preisBegruendung,
    produktForm: tax.produktForm,
    taxonomyId: tax.taxonomyId,
    taxonomyLabel: tax.taxonomyLabel,
    fotoCheck: normalisiereFotoCheck(raw.fotoCheck, imageCount),
  }
}

function baueUserPrompt(basis: EtsyListingBasis): string {
  const zeilen = [
    'Erstelle ein Etsy-Listing (JSON) für dieses handgedrechselte Holzprodukt.',
    'Kapazität ~50 Unikate/Jahr — Preisspanne marktfähig und verkaufbar (weder Dumping noch Ladenhüter).',
    'Prüfe Foto-Rollen: Hauptbild, Detail Maserung, Maßstab.',
  ]
  if (basis.preisEur != null && basis.preisEur > 0) {
    zeilen.push(`Nutzer-Wunschpreis (Hinweis): ${basis.preisEur} €`)
  }
  if (basis.holzart?.trim()) zeilen.push(`Holzart (verbindlich): ${basis.holzart.trim()}`)
  if (basis.masse?.trim()) zeilen.push(`Maße (verbindlich): ${basis.masse.trim()}`)
  if (basis.finishText?.trim()) zeilen.push(`Finish (verbindlich): ${basis.finishText.trim()}`)
  if (basis.standortText?.trim()) zeilen.push(`Standort-Text: ${basis.standortText.trim()}`)
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
    buildEtsyListingSystemPrompt({
      standortText: basis.standortText,
      finishText: basis.finishText,
    }),
    messages,
    {
      temperature: 0.45,
      geminiForceFreeApiKey: true,
      thinkingMinimal: true,
      maxOutputTokens: 4096,
      jsonResponse: { schema: ETSY_LISTING_JSON_SCHEMA },
    },
  )

  if (!result.ok) throw new Error(result.hint || 'KI-Generierung fehlgeschlagen.')

  const parsed = parseJsonObject(result.reply)
  if (!parsed) throw new Error('KI-Antwort war kein gültiges JSON.')
  return validiereListing(parsed, images.length)
}
