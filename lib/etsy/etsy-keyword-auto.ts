/**
 * Keyword-Auto-Scan: aus eigenen Listings Suchfelder ableiten, Explorer-Ergebnisse mergen,
 * Abdeckung im Shop messen. Rein (ohne DB/Netz) — testbar.
 */

import type { EtsyAutoKeyword, EtsyAutoKeywordSeed, EtsyKeywordIdee } from '@/lib/etsy/etsy-markt-types'
import { erkenneHolzGruppen, tagSprache } from '@/lib/etsy/etsy-zielmarkt'

export type AutoSeedListing = {
  title: string
  tags: string[]
  views: number | null
}

const GENERISCH = new Set([
  'holz',
  'wood',
  'wooden',
  'handgemacht',
  'handmade',
  'unikat',
  'geschenk',
  'deko',
  'dekoration',
  'natur',
  'handarbeit',
  'rustikal',
  'landhaus',
  'wohnaccessoire',
])

const PRODUKT_RE =
  /(holzschale|obstschale|salatschüssel|salatschussel|holzschüssel|holzschussel|schale|schüssel|schuessel|bowl|dose|vase|teller)/

const HOLZ_SUCHE: Record<string, string> = {
  nuss: 'nussbaum',
  eiche: 'eiche',
  ahorn: 'ahorn',
  buche: 'buche',
  kirsch: 'kirsche',
  esche: 'esche',
  olive: 'olivenholz',
  birke: 'birke',
  ulme: 'ulme',
  robinie: 'robinie',
  pflaume: 'pflaumenholz',
}

function norm(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').trim()
}

function gewicht(views: number | null): number {
  return 1 + Math.log10(1 + Math.max(0, views ?? 0))
}

function istNutzbar(tag: string): boolean {
  const t = norm(tag)
  if (t.length < 5 || t.length > 40) return false
  if (GENERISCH.has(t)) return false
  if (tagSprache(t) === 'fremd') return false
  return true
}

/** Wie viele eigene Listings tragen die Phrase schon (Tag oder Titel+Tags). */
export function zaehleEigeneNutzung(keyword: string, listings: AutoSeedListing[]): number {
  const n = norm(keyword)
  const teile = n.split(' ').filter((w) => w.length >= 3)
  return listings.filter((l) => {
    const tags = l.tags.map(norm)
    if (tags.some((t) => t === n)) return true
    const blob = `${norm(l.title)} ${tags.join(' ')}`
    return teile.length > 0 && teile.every((w) => blob.includes(w))
  }).length
}

export function leiteKeywordSeeds(
  listings: AutoSeedListing[],
  hauptbegriffe: string[] = [],
): { seeds: EtsyAutoKeywordSeed[]; holzKontext: string } {
  const holzKontext = listings.map((l) => `${l.title} ${l.tags.join(' ')}`).join(' ')
  if (!listings.length) return { seeds: [], holzKontext }

  const tagScore = new Map<string, number>()
  const holzScore = new Map<string, number>()
  for (const l of listings) {
    const w = gewicht(l.views)
    for (const t of new Set(l.tags.map(norm).filter(istNutzbar))) {
      tagScore.set(t, (tagScore.get(t) ?? 0) + w)
    }
    for (const h of erkenneHolzGruppen(`${l.title} ${l.tags.join(' ')}`)) {
      holzScore.set(h, (holzScore.get(h) ?? 0) + w)
    }
  }

  const produktTags = [...tagScore.entries()]
    .filter(([t]) => PRODUKT_RE.test(t))
    .sort((a, b) => b[1] - a[1])

  const seeds: EtsyAutoKeywordSeed[] = []
  const gesehen = new Set<string>()
  const add = (seed: string, grund: string) => {
    const s = norm(seed).slice(0, 50)
    if (s.length < 5 || gesehen.has(s)) return
    gesehen.add(s)
    seeds.push({ seed: s, grund })
  }

  if (produktTags[0]) {
    add(produktTags[0][0], `Häufigstes Produkt-Tag in ${listings.length} Listings`)
  }
  const zweit = produktTags.find(([t]) => {
    const erst = produktTags[0]?.[0] ?? ''
    const erstStamm = erst.replace(/holz|gedrechselt|handgedreht|e|n$/g, '')
    return t !== erst && !t.includes(erstStamm.slice(0, 6))
  })
  if (zweit) add(zweit[0], 'Zweites Produkt im Sortiment')

  const topHolz = [...holzScore.entries()].sort((a, b) => b[1] - a[1])[0]
  if (topHolz && HOLZ_SUCHE[topHolz[0]]) {
    const holz = HOLZ_SUCHE[topHolz[0]]
    const basis = produktTags[0]?.[0]?.includes('schüssel') ? 'holzschüssel' : 'holzschale'
    add(`${basis} ${holz}`, `Deine häufigste Holzart (${holz})`)
  }

  for (const hb of hauptbegriffe) {
    if (seeds.length >= 4) break
    const t = norm(hb)
    if (istNutzbar(t) && PRODUKT_RE.test(t)) add(t, 'Festgelegter Hauptbegriff')
  }

  if (!seeds.length) add('gedrechselte schale', 'Fallback für Drechsler-Shops')
  if (seeds.length === 1) add('holzschale', 'Ergänzung: häufigste Käufersuche in der Nische')

  return { seeds: seeds.slice(0, 4), holzKontext }
}

export function mergeKeywordIdeen(laeufe: Array<{ seed: string; ideen: EtsyKeywordIdee[] }>): EtsyKeywordIdee[] {
  const map = new Map<string, EtsyKeywordIdee>()
  for (const lauf of laeufe) {
    for (const i of lauf.ideen) {
      const k = norm(i.keyword)
      const alt = map.get(k)
      if (!alt) {
        map.set(k, { ...i, keyword: k })
        continue
      }
      alt.nachfrage = Math.max(alt.nachfrage, i.nachfrage)
      alt.quellen = [...new Set([...alt.quellen, ...i.quellen])]
      if (i.etsyNutzung != null) alt.etsyNutzung = Math.max(alt.etsyNutzung ?? 0, i.etsyNutzung)
      if (i.wettbewerb != null && (alt.wettbewerb == null || i.wettbewerb < alt.wettbewerb)) {
        alt.wettbewerb = i.wettbewerb
        alt.wettbewerbMarkt = i.wettbewerbMarkt
        alt.chance = i.chance
      }
      if (!alt.saison && i.saison) alt.saison = i.saison
    }
  }
  return [...map.values()]
}

export function anreichereAutoKeywords(opts: {
  ideen: EtsyKeywordIdee[]
  listings: AutoSeedListing[]
  konkurrenzTags: Map<string, number>
  seedZuKeyword: Map<string, string[]>
}): EtsyAutoKeyword[] {
  const n = Math.max(1, opts.listings.length)
  return opts.ideen
    .map((i) => {
      const eigene = zaehleEigeneNutzung(i.keyword, opts.listings)
      const anteil = eigene / n
      const status: EtsyAutoKeyword['status'] =
        eigene === 0 ? 'fehlt' : anteil < 0.25 || eigene === 1 ? 'selten' : 'drin'
      return {
        ...i,
        eigeneListings: eigene,
        konkurrenzShops: opts.konkurrenzTags.get(norm(i.keyword)) ?? 0,
        status,
        seeds: opts.seedZuKeyword.get(norm(i.keyword)) ?? [],
      }
    })
    .sort((a, b) => autoRang(b) - autoRang(a))
}

function autoRang(k: EtsyAutoKeyword): number {
  let p = k.nachfrage
  if (k.chance === 'hoch') p += 28
  else if (k.chance === 'mittel') p += 14
  if (k.tagTauglich) p += 8
  if (k.quellen.includes('etsy_tags')) p += 6
  p += Math.min(12, k.konkurrenzShops * 3)
  p += Math.min(10, k.etsyNutzung ?? 0)
  if (k.status === 'fehlt') p += 18
  else if (k.status === 'selten') p += 8
  else p -= 10
  if (tagSprache(k.keyword) === 'fremd') p -= 20
  return p
}

/** Handlungsrelevante Treffer: Nachfrage da, bei dir dünn, Deutsch, als Tag nutzbar. */
export function filtereChancen(alle: EtsyAutoKeyword[]): EtsyAutoKeyword[] {
  return alle
    .filter((k) => k.tagTauglich && k.status !== 'drin' && tagSprache(k.keyword) !== 'fremd')
    .filter((k) => k.nachfrage >= 12 || k.chance === 'hoch' || k.chance === 'mittel' || (k.etsyNutzung ?? 0) >= 4)
    .slice(0, 20)
}
