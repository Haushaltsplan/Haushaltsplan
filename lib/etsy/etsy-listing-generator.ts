/** Vision → Listing-Entwurf (Preisspanne, Taxonomy, Foto-Check). */

import 'server-only'

import {
  buildEtsyListingSystemPrompt,
  ETSY_LISTING_JSON_SCHEMA,
} from '@/lib/etsy/etsy-listing-prompt'
import type { EtsyMarktKontext } from '@/lib/etsy/etsy-markt-types'
import {
  baueMarktPromptBlock,
  ladeEtsyMarktKontext,
  marktSeedsFuerBasis,
  marktSeedsFuerListing,
} from '@/lib/etsy/etsy-scraping'
import {
  berechneEtsyDraftSeoGeoScore,
  haerteEtsyListingFuerScore,
  pruefeMarktAbdeckung,
} from '@/lib/etsy/etsy-seo-regeln'
import {
  ETSY_DEFAULT_TAXONOMY_ID,
  ETSY_FORM_TAXONOMY,
  filterFotoWarnungen,
  istMassstabHinweis,
  type EtsyFotoCheck,
  type EtsyGeneratedListing,
  type EtsyListingBasis,
  type EtsyListingGeoInsights,
} from '@/lib/etsy/etsy-types'
import {
  geminiFreeTierFlashModelKandidaten,
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
    'handgedrehte schale',
    'holzschale unikat',
    'obstschale holz',
    'drechselarbeit',
    'holzschale deko',
    'walnussöl finish',
    'massivholz schale',
    'holzgeschenk',
    'niederbayern',
    'esstisch deko',
    'naturrand schale',
    'holzschale modern',
    'unikat holz',
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
      if (s && !istMassstabHinweis(s)) warnungen.push(s.slice(0, 200))
    }
  }
  if (!hatHauptbild) warnungen.push('Kein klares Haupt-/Gesamtbild erkannt.')
  if (!hatDetailMaserung) warnungen.push('Detailfoto der Maserung/Oberfläche fehlt oder unklar.')
  if (imageCount < 2) {
    warnungen.push(`Nur ${imageCount} Foto — ideal: Hauptbild + Detail der Maserung.`)
  }
  return {
    hatHauptbild,
    hatDetailMaserung,
    hatMassstab,
    warnungen: filterFotoWarnungen([...new Set(warnungen)]).slice(0, 8),
  }
}

function normalisiereGeoInsights(raw: unknown): EtsyListingGeoInsights | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const o = raw as Record<string, unknown>
  const liste = (v: unknown, max: number) =>
    Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean).slice(0, max) : []
  const zielgruppe = typeof o.zielgruppe === 'string' ? o.zielgruppe.trim().slice(0, 240) : ''
  const geo: EtsyListingGeoInsights = {
    zielgruppe,
    anlaesse: liste(o.anlaesse, 6),
    intentQueries: liste(o.intentQueries, 6),
    marktKeywords: liste(o.marktKeywords, 13),
  }
  return zielgruppe || geo.intentQueries.length ? geo : undefined
}

function validiereListing(raw: Record<string, unknown>, imageCount: number): EtsyGeneratedListing {
  let title = typeof raw.title === 'string' ? raw.title.trim().replace(/\s+/g, ' ') : ''
  if (title.length > TITLE_MAX) title = title.slice(0, TITLE_MAX).trim()
  if (!title) throw new Error('KI lieferte keinen gültigen Titel.')

  let description = typeof raw.description === 'string' ? raw.description.trim() : ''

  const tax = normalisiereTaxonomy(
    typeof raw.produktForm === 'string' ? raw.produktForm : 'Schale',
    raw.taxonomyId,
    raw.taxonomyLabel,
  )
  // Dekorative Holzschalen: feste Kategorie Decorative Bowls
  if (/schale|schüssel|schuessel|teller|dose|vase/i.test(tax.produktForm)) {
    tax.taxonomyId = ETSY_DEFAULT_TAXONOMY_ID
    tax.taxonomyLabel = 'Dekorative Schalen'
  }

  let warenkorb =
    typeof raw.warenkorbZusammenfassung === 'string' ? raw.warenkorbZusammenfassung.trim() : ''
  if (!warenkorb) {
    warenkorb = [
      `Handgedrehte ${tax.produktForm}`,
      'Unikat aus Massivholz',
      'Finish Walnussöl',
    ].join(' · ')
  }
  if (warenkorb && !description.includes(warenkorb.slice(0, 24))) {
    description = `${description}\n\n${warenkorb}`.trim()
  }
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
    geoInsights: normalisiereGeoInsights(raw.geoInsights),
  }
}

async function marktOderLaden(
  markt: EtsyMarktKontext | null | undefined,
  seeds: string[],
): Promise<EtsyMarktKontext | null> {
  if (markt !== undefined) return markt
  return ladeEtsyMarktKontext({ seeds, maxAutosuggest: 3, maxCompetitor: 2 })
}

function unikatZeile(basis: EtsyListingBasis): string {
  const wer = basis.whoMade === 'i_did' || !basis.whoMade ? 'selbst gedrechselt' : basis.whoMade
  return `Unikat-Status: Einzelstück (Menge 1), ${wer}${basis.whenMade ? `, Entstehung ${basis.whenMade}` : ''}.`
}

function baueUserPrompt(basis: EtsyListingBasis, markt: EtsyMarktKontext | null): string {
  const zeilen = [
    'Erstelle ein Etsy-Listing (JSON) für dieses handgedrechselte Holzprodukt.',
    unikatZeile(basis),
    'Kapazität ~50 Unikate/Jahr — Preisspanne marktfähig und verkaufbar (weder Dumping noch Ladenhüter).',
    'Preisbegründung MUSS Schalengröße/Maße + Holzart + Optik + sorgfältige Handarbeit nennen.',
    'Prüfe Foto-Rollen: Hauptbild, Detail Maserung (Maßstab optional, keine Warnung).',
  ]
  if (basis.preisEur != null && basis.preisEur > 0) {
    zeilen.push(`Nutzer-Wunschpreis (Hinweis): ${basis.preisEur} €`)
  }
  if (basis.holzart?.trim()) zeilen.push(`Holzart (verbindlich): ${basis.holzart.trim()}`)
  if (basis.masse?.trim()) {
    zeilen.push(`Maße (verbindlich, für Preis zentral): ${basis.masse.trim()}`)
  } else {
    zeilen.push('Maße unbekannt — Größe aus Fotos schätzen und in preisBegruendung nennen.')
  }
  if (basis.finishText?.trim()) zeilen.push(`Finish (verbindlich): ${basis.finishText.trim()}`)
  if (basis.standortText?.trim()) zeilen.push(`Standort-Text: ${basis.standortText.trim()}`)
  if (basis.materials?.length) zeilen.push(`Materialien: ${basis.materials.join(', ')}`)
  const marktBlock = baueMarktPromptBlock(markt)
  if (marktBlock) zeilen.push('', marktBlock)
  zeilen.push('Analysiere die angehängten Produktfotos gründlich.')
  return zeilen.join('\n')
}

export type EtsyGeneratorOptionen = {
  /** Vorab geladener Markt-Kontext; `null` = ohne Marktdaten, `undefined` = automatisch laden. */
  markt?: EtsyMarktKontext | null
}

export async function generiereEtsyListingTexte(
  images: CoachImagePart[],
  basis: EtsyListingBasis,
  opts?: EtsyGeneratorOptionen,
): Promise<EtsyGeneratedListing> {
  if (images.length === 0) throw new Error('Mindestens ein Produktfoto ist erforderlich.')

  const resolved = resolveGeminiFreeTierProvider()
  if (!resolved) {
    throw new Error('GEMINI_API_KEY_FREE fehlt — der Etsy-Agent nutzt nur den Free-Tier-Key.')
  }

  const markt = await marktOderLaden(opts?.markt, marktSeedsFuerBasis({ holzart: basis.holzart }))

  const messages: CoachMessage[] = [
    {
      role: 'user',
      content: baueUserPrompt(basis, markt),
      images: images.slice(0, 4),
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
      /** Listing-JSON ist lang; Thinking zählt mit — nicht zu knapp. */
      maxOutputTokens: 8192,
      timeoutMs: 90_000,
      geminiTotalBudgetMs: 110_000,
      geminiModels: geminiFreeTierFlashModelKandidaten(),
      jsonResponse: { schema: ETSY_LISTING_JSON_SCHEMA },
    },
  )

  if (!result.ok) throw new Error(result.hint || 'KI-Generierung fehlgeschlagen.')

  const parsed = parseJsonObject(result.reply)
  if (!parsed) throw new Error('KI-Antwort war kein gültiges JSON.')
  const listing = validiereListing(parsed, images.length)

  const gehaertet = haerteEtsyListingFuerScore({
    title: listing.title,
    tags: listing.tags,
    description: listing.description,
    holzart: basis.holzart,
    produktForm: listing.produktForm,
  })
  let description = gehaertet.description
  const masse = basis.masse?.trim()
  if (masse && /\[MASSE EINFÜGEN\]/i.test(description)) {
    description = description.replace(/\[MASSE EINFÜGEN\]/gi, masse)
  }

  return {
    ...listing,
    title: gehaertet.title,
    tags: gehaertet.tags,
    description,
  }
}

export type EtsyListingOptimizeInput = {
  title: string
  description: string
  tags: string[]
  produktForm?: string
  taxonomyId?: number
  taxonomyLabel?: string
  warenkorbZusammenfassung?: string
  issues: string[]
  preisMinEur?: number
  preisEmpfohlenEur?: number
  preisMaxEur?: number
  preisBegruendung?: string
  fotoCheck?: EtsyFotoCheck | null
}

/** SEO/GEO-Nachzieh: bestehender Entwurf + Issues → verbesserte Version (Fotos bleiben Referenz). */
export async function optimiereEtsyListingTexte(
  images: CoachImagePart[],
  basis: EtsyListingBasis,
  draft: EtsyListingOptimizeInput,
  opts?: EtsyGeneratorOptionen & {
    /** `markt` = Auto-SEO Anreichern: Tags/Titel gezielt auf reale Suchphrasen ausrichten. */
    fokus?: 'score' | 'markt'
  },
): Promise<EtsyGeneratedListing> {
  if (images.length === 0) throw new Error('Mindestens ein Produktfoto ist erforderlich.')

  const resolved = resolveGeminiFreeTierProvider()
  if (!resolved) {
    throw new Error('GEMINI_API_KEY_FREE fehlt — der Etsy-Agent nutzt nur den Free-Tier-Key.')
  }

  const markt = await marktOderLaden(
    opts?.markt,
    marktSeedsFuerListing({ title: draft.title, tags: draft.tags }),
  )
  const abdeckung = markt
    ? pruefeMarktAbdeckung({ title: draft.title, tags: draft.tags }, markt.keywordKandidaten)
    : null
  const marktFokus =
    opts?.fokus === 'markt' && markt
      ? [
          'FOKUS MARKT-ANREICHERUNG:',
          '- Ersetze bis zu 5 schwächste Tags durch passende reale Suchphrasen aus MARKT-DATEN.',
          '- Stärkste passende Phrase in die ersten 50 Titel-Zeichen (Titel bleibt lesbar, Trenner „ | “).',
          '- Erste 2 Sätze der Beschreibung um passende Intent-Phrase ergänzen, Fakten unverändert.',
          abdeckung
            ? `- Aktuell abgedeckt: ${abdeckung.abgedeckt.join(', ') || 'keine'}; noch offen: ${abdeckung.fehlend.slice(0, 8).join(', ')}`
            : '',
        ]
          .filter(Boolean)
          .join('\n')
      : ''

  const beforeScore = berechneEtsyDraftSeoGeoScore({
    title: draft.title,
    tags: draft.tags,
    description: draft.description,
    materials: basis.holzart ? [basis.holzart] : basis.materials,
    taxonomyId: draft.taxonomyId ?? null,
    taxonomyLabel: draft.taxonomyLabel ?? null,
    fotoCheck: draft.fotoCheck ?? null,
  })

  const issuesBlock =
    draft.issues.length > 0
      ? draft.issues.map((i) => `- ${i}`).join('\n')
      : '- Score verbessern: Long-Tail-Tags, GEO (FÜR WEN + ANLASS).'

  const content = [
    'Optimiere den Entwurf. Liefere vollständiges JSON gemäß Schema.',
    'PFLICHT für On-Page-Score 100:',
    '1) Genau 13 Tags, je ≤20 Zeichen. Mindestens 8 Long-Tail (2+ Wörter oder starkes DE-Kompositum).',
    '2) Beschreibung: ERSTE 2–3 Sätze mit WAS (Produkt+Holz), FÜR WEN (Obstschale/Sammler/Geschenk/Esstisch) und ANLASS (Holzhochzeit/Einzug/Geburtstag — konkret, nicht nur „Geschenk“).',
    '3) Titel: Primär-Keyword in den ersten 50 Zeichen, Ideal 70–120 Zeichen, max. 140.',
    '4) Keine Stemming-Duplikate. Titel-Keywords in Tags abdecken.',
    '5) Struktur beibehalten: 🪵 📏 ✨ 💎 VERWENDUNG + Pflege.',
    '6) Fakten (Holzart, Maße, Finish, Preis) unverändert — nur Formulierungen für Score 100.',
    '',
    'Bekannte Mängel:',
    issuesBlock,
    '',
    '--- AKTUELLER ENTWURF ---',
    `title: ${draft.title}`,
    `tags (${draft.tags.length}): ${draft.tags.join(', ')}`,
    `produktForm: ${draft.produktForm || ''}`,
    `taxonomyId: ${draft.taxonomyId ?? ''}`,
    `taxonomyLabel: ${draft.taxonomyLabel || ''}`,
    draft.warenkorbZusammenfassung
      ? `warenkorbZusammenfassung: ${draft.warenkorbZusammenfassung}`
      : '',
    draft.preisEmpfohlenEur != null
      ? `Preis Min/Empfohlen/Max: ${draft.preisMinEur}/${draft.preisEmpfohlenEur}/${draft.preisMaxEur}`
      : '',
    draft.preisBegruendung ? `preisBegruendung: ${draft.preisBegruendung}` : '',
    '--- BESCHREIBUNG ---',
    draft.description.slice(0, 10000),
    basis.holzart?.trim() ? `Holzart (verbindlich): ${basis.holzart.trim()}` : '',
    basis.masse?.trim() ? `Maße (verbindlich): ${basis.masse.trim()}` : '',
    basis.finishText?.trim() ? `Finish (verbindlich): ${basis.finishText.trim()}` : '',
    unikatZeile(basis),
    baueMarktPromptBlock(markt),
    marktFokus,
  ]
    .filter(Boolean)
    .join('\n')

  const messages: CoachMessage[] = [
    {
      role: 'user',
      content,
      images: images.slice(0, 4),
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
      temperature: 0.25,
      geminiForceFreeApiKey: true,
      thinkingMinimal: true,
      maxOutputTokens: 8192,
      timeoutMs: 90_000,
      geminiTotalBudgetMs: 110_000,
      geminiModels: geminiFreeTierFlashModelKandidaten(),
      jsonResponse: { schema: ETSY_LISTING_JSON_SCHEMA },
    },
  )

  if (!result.ok) throw new Error(result.hint || 'SEO-Optimierung fehlgeschlagen.')
  const parsed = parseJsonObject(result.reply)
  if (!parsed) throw new Error('Optimierungs-Antwort war kein gültiges JSON.')

  let neu = validiereListing(parsed, images.length)

  // Deterministisch nachhärten (Tags/GEO), dann Score-Gate gegen Vorversion
  const gehaertet = haerteEtsyListingFuerScore({
    title: neu.title,
    tags: neu.tags,
    description: neu.description,
    holzart: basis.holzart,
    produktForm: neu.produktForm || draft.produktForm,
  })
  neu = {
    ...neu,
    title: gehaertet.title,
    tags: gehaertet.tags,
    description: (() => {
      let d = gehaertet.description
      const masse = basis.masse?.trim()
      if (masse && /\[MASSE EINFÜGEN\]/i.test(d)) d = d.replace(/\[MASSE EINFÜGEN\]/gi, masse)
      return d
    })(),
    // Preis aus Entwurf behalten, wenn KI abweicht
    preisMinEur: draft.preisMinEur ?? neu.preisMinEur,
    preisEmpfohlenEur: draft.preisEmpfohlenEur ?? neu.preisEmpfohlenEur,
    preisMaxEur: draft.preisMaxEur ?? neu.preisMaxEur,
    preisBegruendung: draft.preisBegruendung || neu.preisBegruendung,
  }

  const afterScore = berechneEtsyDraftSeoGeoScore({
    title: neu.title,
    tags: neu.tags,
    description: neu.description,
    materials: basis.holzart ? [basis.holzart] : basis.materials,
    taxonomyId: neu.taxonomyId,
    taxonomyLabel: neu.taxonomyLabel,
    fotoCheck: neu.fotoCheck ?? draft.fotoCheck ?? null,
  })

  // Regression verhindern: alten Entwurf behalten, wenn Score nicht steigt
  if (afterScore.overall < beforeScore.overall) {
    const altGehaertet = haerteEtsyListingFuerScore({
      title: draft.title,
      tags: draft.tags,
      description: draft.description,
      holzart: basis.holzart,
      produktForm: draft.produktForm,
    })
    const altScore = berechneEtsyDraftSeoGeoScore({
      title: altGehaertet.title,
      tags: altGehaertet.tags,
      description: altGehaertet.description,
      materials: basis.holzart ? [basis.holzart] : basis.materials,
      taxonomyId: draft.taxonomyId ?? null,
      taxonomyLabel: draft.taxonomyLabel ?? null,
      fotoCheck: draft.fotoCheck ?? null,
    })
    // Nimm das bessere aus: gehärteter Alt vs. KI-Neu
    if (altScore.overall >= afterScore.overall) {
      return {
        ...neu,
        title: altGehaertet.title,
        description: altGehaertet.description,
        tags: altGehaertet.tags,
        produktForm: draft.produktForm || neu.produktForm,
        taxonomyId: draft.taxonomyId ?? neu.taxonomyId,
        taxonomyLabel: draft.taxonomyLabel || neu.taxonomyLabel,
        warenkorbZusammenfassung:
          draft.warenkorbZusammenfassung || neu.warenkorbZusammenfassung,
        preisMinEur: draft.preisMinEur ?? neu.preisMinEur,
        preisEmpfohlenEur: draft.preisEmpfohlenEur ?? neu.preisEmpfohlenEur,
        preisMaxEur: draft.preisMaxEur ?? neu.preisMaxEur,
        preisBegruendung: draft.preisBegruendung || neu.preisBegruendung,
      }
    }
  }

  return neu
}
