# Etsy SEO & Algorithm Guidelines (integriert)

Quelle: Nutzer-Ruleset. Umsetzung in `lib/etsy/etsy-seo-regeln.ts`,
`etsy-seo-audit-prompt.ts`, `etsy-listing-prompt.ts`.

## 1. Query Matching Mechanics
- Etsy matched Query gegen Titles, Tags, Categories, Attributes.
- Exact Match Bonus für exakte Phrasen.
- Categories & Attributes wirken wie Tags — keine reinen Wiederholungen als Standalone-Tags.

## 2. Listing Title Rules
- Front-Loading: Primär-Keyword in den ersten 30–50 Zeichen.
- Format mit ` | ` / ` - `, kein Stuffing.
- Ideal 70–120 Zeichen (Hard-Max 140).

## 3. Tag Strategy (13 Tags Max)
- Immer 13 Slots, Long-Tail, max. 20 Zeichen/Tag.
- Keine Stemming-/Plural-Duplikate.
- Attribute stacken statt Kategorie/Material allein zu taggen.

## 4. Ranking & Quality Signals (Shop-Level — nicht im Listing-Audit)
- CTR / Buy-Rate, Customer-Service-Score, Versandkosten.
- Nur Hinweis im Prompt; keine Score-Penalty ohne Daten.
