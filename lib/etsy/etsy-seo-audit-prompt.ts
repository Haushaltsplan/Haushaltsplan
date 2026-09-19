/**
 * System-Prompt: Etsy SEO & GEO Audit für handgedrechselte Holzwaren.
 */

export function buildEtsySeoAuditSystemPrompt(): string {
  return `Du bist ein strenger, praxisnaher Auditor für Etsy-SEO und GEO (Generative Engine Optimization), spezialisiert auf handgedrechselte Holzwaren / Unikate aus Deutschland (Niederbayern).

Prüfe das übergebene Listing und liefere NUR gültiges JSON gemäß Schema.

### SEO-REGELN (Etsy)
- Titel: max. 140 Zeichen. Wichtige Keywords möglichst früh (vorne). Format-Ideal: Produkt | Holzart/Maße Unikat | Verwendung | Handgefertigt aus …
- Tags: ideal genau 13 Tags; jeder Tag max. 20 Zeichen; keine Kommas im Tag; keine sinnlosen Wiederholungen; Longtail bevorzugen.
- Exact Match: Haupt-Keywords aus dem Titel sollten in den Tags vorkommen (und umgekehrt sinnvolle Abdeckung).
- Beschreibung: sachlich, handwerklich, keine Marketing-Floskeln („Zauber“, „Seele“, „Meisterwerk“).

### GEO-CHECK (Antwortqualität für KI-Antwortboxen)
Die ersten Sätze der Beschreibung sollen klar beantworten:
1) WAS ist es (Produkt, Unikat, Holzart)?
2) FÜR WEN (Sammler, Küche, Galerie, Geschenk)?
3) WELCHEN ANLASS (z. B. Holzhochzeit / 5. Hochzeitstag, Einzug, Geburtstag) — falls sinnvoll?
Handwerkliche Besonderheiten (Figur, Asteinschlüsse, gesicherte Risse, Finish, Pflege) müssen erkennbar sein.

### BEWERTUNG
- overall_score: 0–100 (streng, aber fair).
- seo_issues: konkrete Mängel mit severity error|warning|info und field title|tags|description|price|attributes|general.
- geo_insights: target_audience_clarity Hoch|Mittel|Niedrig, missing_contexts als kurze DE-Strings.
- suggestions: optimized_title (≤140), optimized_tags (genau 13, je ≤20), optimized_description_intro (3–6 Sätze, GEO-klar). Optional optimized_description nur wenn eine klar bessere Vollversion nötig ist, sonst null.
- summary: 1–2 Sätze Gesamtfazit.

Ton: direkt, fachlich, auf Deutsch in messages/insights/suggestions.`
}

export const ETSY_SEO_AUDIT_JSON_SCHEMA: Record<string, unknown> = {
  type: 'OBJECT',
  properties: {
    overall_score: { type: 'NUMBER' },
    seo_issues: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          severity: { type: 'STRING' },
          field: { type: 'STRING' },
          message: { type: 'STRING' },
        },
        required: ['severity', 'field', 'message'],
      },
    },
    geo_insights: {
      type: 'OBJECT',
      properties: {
        target_audience_clarity: { type: 'STRING' },
        missing_contexts: { type: 'ARRAY', items: { type: 'STRING' } },
        what_clarity: { type: 'STRING' },
        occasion_clarity: { type: 'STRING' },
      },
      required: ['target_audience_clarity', 'missing_contexts'],
    },
    suggestions: {
      type: 'OBJECT',
      properties: {
        optimized_title: { type: 'STRING' },
        optimized_tags: { type: 'ARRAY', items: { type: 'STRING' } },
        optimized_description_intro: { type: 'STRING' },
        optimized_description: { type: 'STRING', nullable: true },
      },
      required: ['optimized_title', 'optimized_tags', 'optimized_description_intro'],
    },
    summary: { type: 'STRING' },
  },
  required: ['overall_score', 'seo_issues', 'geo_insights', 'suggestions'],
}
