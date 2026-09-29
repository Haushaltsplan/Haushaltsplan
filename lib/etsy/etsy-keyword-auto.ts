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

const MAX_SEEDS = 8

type ProduktFormId = 'schale' | 'vase' | 'schuessel' | 'dose'

const FORMEN: Array<{ id: ProduktFormId; re: RegExp; suche: string }> = [
  { id: 'vase', re: /vase/, suche: 'holzvase' },
  { id: 'schuessel', re: /schüssel|schuessel/, suche: 'holzschüssel' },
  { id: 'dose', re: /\bdose\b/, suche: 'holzdose' },
  { id: 'schale', re: /schale|\bbowl\b/, suche: 'holzschale' },
]

/** Käufersprache — so wird auf Etsy/Google getippt, nicht Shop-Jargon. */
const KAEUFER_IDEEN: Array<{ form: ProduktFormId; seed: string; grund: string }> = [
  { form: 'schale', seed: 'obstschale', grund: 'Jemand sucht eine Schale zum Befüllen' },
  { form: 'vase', seed: 'blumenvase holz', grund: 'Jemand will Blumen hinstellen' },
  { form: 'schale', seed: 'dekoschale holz', grund: 'Jemand sucht Tischdeko' },
  { form: 'vase', seed: 'gedrechselte vase', grund: 'Jemand sucht Handarbeit, keine Industrievase' },
  { form: 'schale', seed: 'gedrechselte schale', grund: 'Technik-Suche Drechseln' },
  { form: 'schale', seed: 'schale naturrand', grund: 'Stil Live-Edge' },
  { form: 'schale', seed: 'große holzschale', grund: 'Größen-Suche' },
  { form: 'vase', seed: 'holzvase unikat', grund: 'Unikat statt Massenware' },
  { form: 'schuessel', seed: 'salatschüssel holz', grund: 'Nutzung Schüssel' },
  { form: 'dose', seed: 'holzdose gedrechselt', grund: 'Nutzung Dose' },
]

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

function formenImText(text: string): ProduktFormId[] {
  const t = norm(text)
  return FORMEN.filter((f) => f.re.test(t)).map((f) => f.id)
}

function titelProduktPhrasen(title: string): string[] {
  const w = norm(title)
    .split(/[^a-zäöüß0-9]+/i)
    .filter(Boolean)
  const out: string[] = []
  for (let i = 0; i < w.length; i++) {
    if (!PRODUKT_RE.test(w[i]!)) continue
    if (i > 0) out.push(`${w[i - 1]} ${w[i]}`)
    if (i + 1 < w.length) out.push(`${w[i]} ${w[i + 1]}`)
  }
  return out.filter((p) => p.length >= 8 && p.length <= 28)
}

export function leiteKeywordSeeds(
  listings: AutoSeedListing[],
  hauptbegriffe: string[] = [],
  konkurrenzTags: Map<string, number> = new Map(),
): { seeds: EtsyAutoKeywordSeed[]; holzKontext: string } {
  const holzKontext = listings.map((l) => `${l.title} ${l.tags.join(' ')}`).join(' ')
  if (!listings.length) return { seeds: [], holzKontext }

  const tagScore = new Map<string, number>()
  const holzScore = new Map<string, number>()
  const formScore = new Map<ProduktFormId, number>()
  for (const l of listings) {
    const w = gewicht(l.views)
    const blob = `${l.title} ${l.tags.join(' ')}`
    for (const t of new Set([...l.tags.map(norm).filter(istNutzbar), ...titelProduktPhrasen(l.title)])) {
      tagScore.set(t, (tagScore.get(t) ?? 0) + w)
    }
    for (const h of erkenneHolzGruppen(blob)) {
      holzScore.set(h, (holzScore.get(h) ?? 0) + w)
    }
    const formen = formenImText(blob)
    for (const f of formen) formScore.set(f, (formScore.get(f) ?? 0) + w)
  }

  const seeds: EtsyAutoKeywordSeed[] = []
  const gesehen = new Set<string>()
  const add = (seed: string, grund: string) => {
    const s = norm(seed).slice(0, 50)
    if (s.length < 5 || gesehen.has(s)) return false
    gesehen.add(s)
    seeds.push({ seed: s, grund })
    return true
  }

  const formenNachGewicht = [...formScore.entries()].sort((a, b) => b[1] - a[1])
  for (const [id] of formenNachGewicht) {
    const form = FORMEN.find((f) => f.id === id)
    if (form) add(form.suche, `Produktlinie ${form.suche} (aus Titeln, nicht nur Tags)`)
  }

  const topHolz = [...holzScore.entries()].sort((a, b) => b[1] - a[1])[0]
  const holzName = topHolz ? HOLZ_SUCHE[topHolz[0]] : undefined
  if (holzName) {
    for (const [id] of formenNachGewicht.slice(0, 2)) {
      const wort = id === 'schuessel' ? 'schüssel' : id
      add(`${holzName} ${wort}`, `Häufigste Holzart × ${wort}`)
    }
  }

  for (const idee of KAEUFER_IDEEN) {
    if (seeds.length >= MAX_SEEDS) break
    if (!formScore.has(idee.form)) continue
    add(idee.seed, idee.grund)
  }

  if (/weihnacht|advent|nikolaus/.test(holzKontext)) {
    add('weihnachtsgeschenk holz', 'Saison kommt in deinen Titeln vor')
  } else {
    add('holzgeschenk', 'Ganzjährige Käufersuche: Geschenk aus Holz')
  }
  if (/hochzeit/.test(holzKontext)) add('hochzeitsgeschenk holz', 'Anlass Hochzeit im Sortiment')

  const konkurrenz = [...konkurrenzTags.entries()]
    .filter(([t, n]) => n >= 3 && PRODUKT_RE.test(t) && t.length <= 24)
    .sort((a, b) => b[1] - a[1])
  for (const [t, n] of konkurrenz) {
    if (seeds.length >= MAX_SEEDS) break
    add(t, `${n} Konkurrenten setzen das als Tag`)
  }

  for (const hb of hauptbegriffe) {
    if (seeds.length >= MAX_SEEDS) break
    const t = norm(hb)
    if (istNutzbar(t) && PRODUKT_RE.test(t)) add(t, 'Festgelegter Hauptbegriff')
  }

  const extraTags = [...tagScore.entries()]
    .filter(([t]) => PRODUKT_RE.test(t))
    .sort((a, b) => b[1] - a[1])
  for (const [t] of extraTags) {
    if (seeds.length >= MAX_SEEDS) break
    add(t, 'Häufig in Titel/Tags')
  }

  if (!seeds.length) add('gedrechselte schale', 'Fallback für Drechsler-Shops')

  return { seeds: seeds.slice(0, MAX_SEEDS), holzKontext }
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
  if (k.quellen.includes('etsy_suggest')) p += 8
  if (k.quellen.includes('google_de') || k.quellen.includes('amazon_de')) p += 5
  const woerter = k.keyword.split(/\s+/).length
  if (woerter >= 2) p += 12
  if (woerter === 3) p += 4
  if (/geschenk|hochzeit|mama|einzug|weihnacht/.test(k.keyword)) p += 8
  if (/für | aus /.test(` ${k.keyword} `)) p += 5
  p += Math.min(12, k.konkurrenzShops * 3)
  p += Math.min(10, k.etsyNutzung ?? 0)
  if (k.status === 'fehlt') p += 18
  else if (k.status === 'selten') p += 8
  else p -= 10
  if (tagSprache(k.keyword) === 'fremd') p -= 20
  if (tagSprache(k.keyword) === 'de') p += 4
  return p
}

/** Handlungsrelevante Treffer: Nachfrage da, bei dir dünn, Deutsch, als Tag nutzbar. */
export function filtereChancen(alle: EtsyAutoKeyword[]): EtsyAutoKeyword[] {
  return alle
    .filter((k) => k.tagTauglich && k.status !== 'drin' && tagSprache(k.keyword) !== 'fremd')
    .filter(
      (k) =>
        k.nachfrage >= 8 ||
        k.chance === 'hoch' ||
        k.chance === 'mittel' ||
        (k.etsyNutzung ?? 0) >= 3 ||
        k.quellen.includes('etsy_suggest'),
    )
    .slice(0, 28)
}

export function menschAnhaengeAusListings(listings: AutoSeedListing[]): string[] {
  const holz = new Set<string>()
  for (const l of listings) {
    for (const id of erkenneHolzGruppen(`${l.title} ${l.tags.join(' ')}`)) {
      const name = HOLZ_SUCHE[id]
      if (name) holz.add(name)
    }
  }
  return [...holz, 'geschenk', 'unikat', 'groß', 'deko', 'rustikal', 'für', 'aus', 'massivholz']
}

const SCHALE_RE = /schale|schüssel|schuessel|bowl|dekoschale|obstschale|salatschale/
const VASE_RE = /vase/

/** Schale vs. Vase anhand Phrase und optionaler Scan-Seeds. */
export function keywordProduktGruppe(
  keyword: string,
  seeds: string[] = [],
): 'schale' | 'vase' | 'allgemein' {
  const blob = `${keyword} ${seeds.join(' ')}`.toLowerCase()
  const schale = SCHALE_RE.test(blob)
  const vase = VASE_RE.test(blob)
  if (schale && !vase) return 'schale'
  if (vase && !schale) return 'vase'
  if (schale && vase) return 'schale'
  return 'allgemein'
}
