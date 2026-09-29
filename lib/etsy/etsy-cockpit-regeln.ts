/**
 * Etsy-Cockpit Regel-Engine (rein, ohne DB/Netz → testbar, kein Gemini).
 * Verknüpft Messung, SEO-Audit, Ranking, Keyword-Merkliste und Konkurrenz zu
 * priorisierten Aufgaben mit 1-Klick-Aktionen.
 */

import type {
  EtsyCockpitAufgabe,
  EtsyTagTausch,
  EtsyWirkung,
} from '@/lib/etsy/etsy-cockpit-types'
import {
  ETSY_SEO_TAG_COUNT,
  ETSY_SEO_TAG_MAX,
  istTagLongtail,
  klassifiziereTag,
  pruefeHauptbegriff,
  stemWort,
} from '@/lib/etsy/etsy-seo-regeln'
import {
  ETSY_MAX_FREMDSPRACHIGE_TAGS,
  erkenneHolzGruppen,
  nenntFremdeHolzart,
  tagSprache,
} from '@/lib/etsy/etsy-zielmarkt'

// ---------------------------------------------------------------------------
// Saison-Kalender (MM-TT, Europe/Berlin)
// ---------------------------------------------------------------------------

export type EtsySaison = {
  id: string
  name: string
  /** Aktiv-Fenster: Tag rein */
  von: string
  bis: string
  /** Danach bis hier: Tag wieder raus (Platz für ganzjährige Keywords) */
  endeBis: string
  tag: string
  re: RegExp
}

export const ETSY_SAISONS: EtsySaison[] = [
  {
    id: 'weihnachten',
    name: 'Weihnachtsgeschäft',
    von: '10-01',
    bis: '12-18',
    endeBis: '01-31',
    tag: 'weihnachtsgeschenk',
    re: /weihnacht|advent|nikolaus|christmas|xmas/,
  },
  {
    id: 'valentinstag',
    name: 'Valentinstag',
    von: '01-10',
    bis: '02-12',
    endeBis: '03-15',
    tag: 'valentinsgeschenk',
    re: /valentin/,
  },
  {
    id: 'ostern',
    name: 'Ostern',
    von: '02-25',
    bis: '04-12',
    endeBis: '05-10',
    tag: 'ostergeschenk',
    re: /oster|easter/,
  },
  {
    id: 'muttertag',
    name: 'Muttertag',
    von: '04-05',
    bis: '05-08',
    endeBis: '06-10',
    tag: 'muttertagsgeschenk',
    re: /muttertag|mothers ?day/,
  },
]

/** MM-TT im Fenster [von, bis] — auch über den Jahreswechsel. */
export function imFenster(mmtt: string, von: string, bis: string): boolean {
  return von <= bis ? mmtt >= von && mmtt <= bis : mmtt >= von || mmtt <= bis
}

function naechsterTag(mmtt: string): string {
  const [m, t] = mmtt.split('-').map(Number)
  const d = new Date(Date.UTC(2001, m! - 1, t! + 1))
  return `${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
}

export function saisonStatus(heute: string): { aktiv: EtsySaison[]; vorbei: EtsySaison[] } {
  const mmtt = heute.slice(5, 10)
  return {
    aktiv: ETSY_SAISONS.filter((s) => imFenster(mmtt, s.von, s.bis)),
    vorbei: ETSY_SAISONS.filter((s) => imFenster(mmtt, naechsterTag(s.bis), s.endeBis)),
  }
}

// ---------------------------------------------------------------------------
// Text-Helfer
// ---------------------------------------------------------------------------

const GENERISCH = new Set(
  ['holz', 'handgemacht', 'handmade', 'geschenk', 'deko', 'dekoration', 'unikat', 'wood', 'wooden', 'natur']
    .map(stemWort),
)
const ANLASS_RE =
  /geschenk|mama|papa|mutter|vater|oma|opa|hochzeit|geburtstag|jubil|einzug|richtfest|dankeschön|danke|freundin|freund|frau|mann|kollege|abschied|ruhestand|rente|taufe|weihnacht|ostern|valentin|muttertag|vatertag|jahrestag/
const STOP = new Set(['und', 'mit', 'aus', 'fur', 'fuer', 'der', 'die', 'das', 'von', 'zum', 'zur', 'im', 'in', 'als', 'for', 'the', 'and', 'of'])

function stems(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-zäöüß0-9]+/)
    .filter((w) => w.length >= 3 && !STOP.has(w))
    .map(stemWort)
    .filter(Boolean)
}

export function normTag(t: string): string {
  return t.trim().toLowerCase().replace(/\s+/g, ' ')
}

function tagIstVorhanden(tags: string[], tag: string): boolean {
  const n = normTag(tag)
  const s = stems(tag).join(' ')
  return tags.some((t) => normTag(t) === n || (s.length > 0 && stems(t).join(' ') === s))
}

export function istGueltigerTag(tag: string): boolean {
  const t = normTag(tag)
  return t.length >= 3 && t.length <= ETSY_SEO_TAG_MAX && /^[\p{L}\p{N} '’-]+$/u.test(t)
}

// ---------------------------------------------------------------------------
// Welcher Tag darf raus?
// ---------------------------------------------------------------------------

export type ErsatzWahl = { alt: string | null; grund: string } | null

/**
 * Wählt den verzichtbarsten Tag eines Listings. Nie: geschützte Tags (Hauptbegriff,
 * aktive Saison-Tags, gerade ergänzte). null = nichts sinnvoll ersetzbar.
 */
export function waehleErsatzTag(
  tags: string[],
  opts: { schuetzen?: string[]; title?: string; saisonVorbei?: EtsySaison[]; saisonAktiv?: EtsySaison[] } = {},
): ErsatzWahl {
  if (tags.length < ETSY_SEO_TAG_COUNT) return { alt: null, grund: 'freier Tag-Platz' }
  const geschuetzt = new Set((opts.schuetzen ?? []).map(normTag))
  const eigeneHolz = erkenneHolzGruppen(`${opts.title ?? ''} ${tags.join(' ')}`)
  const titelHolz = erkenneHolzGruppen(opts.title ?? '')
  const fremd = tags.filter((t) => tagSprache(t) === 'fremd')
  const breit = tags.filter((t) => klassifiziereTag(t) === 'breit')
  const stemListe = tags.map((t) => new Set(stems(t)))

  let best: { alt: string; grund: string; punkte: number } | null = null
  tags.forEach((tag, i) => {
    const n = normTag(tag)
    if (geschuetzt.has(n)) return
    if (opts.saisonAktiv?.some((s) => s.re.test(n))) return
    let punkte = 0
    let grund = ''
    let grundGewicht = 0
    const setze = (p: number, g: string) => {
      punkte += p
      if (p > grundGewicht) {
        grund = g
        grundGewicht = p
      }
    }
    if (opts.saisonVorbei?.some((s) => s.re.test(n))) setze(80, 'Saison vorbei')
    if (titelHolz.size > 0 && nenntFremdeHolzart(tag, titelHolz)) setze(60, 'andere Holzart als im Titel')
    if (tagSprache(tag) === 'fremd') setze(fremd.length > ETSY_MAX_FREMDSPRACHIGE_TAGS ? 50 : 12, 'englisch')
    const eigene = stemListe[i]!
    const redundant =
      eigene.size > 0 &&
      stemListe.some((andere, j) => j !== i && andere.size > eigene.size && [...eigene].every((w) => andere.has(w)))
    if (redundant) setze(30, 'steckt schon in längerem Tag')
    if (!istTagLongtail(tag)) setze(28, 'Einzelwort')
    if (klassifiziereTag(tag) === 'breit' && breit.length > 4) setze(15, 'zu viele breite Tags')
    if (eigeneHolz.size === 0 && /holz|wood/.test(n) && n.split(' ').length === 1) setze(10, 'zu allgemein')
    punkte += i * 0.1
    if (punkte >= 10 && (!best || punkte > best.punkte)) best = { alt: tag, grund, punkte }
  })
  const b = best as { alt: string; grund: string; punkte: number } | null
  return b ? { alt: b.alt, grund: b.grund } : null
}

// ---------------------------------------------------------------------------
// Welches Listing passt zu einem Keyword?
// ---------------------------------------------------------------------------

export type CockpitListing = {
  listingId: number
  title: string
  tags: string[]
  url: string | null
  views: number | null
  numFavorers: number | null
}

export function passendeListings(
  keyword: string,
  listings: CockpitListing[],
  max = 3,
): Array<{ listing: CockpitListing; punkte: number }> {
  const kwStems = stems(keyword)
  if (!kwStems.length) return []
  const spezifisch = kwStems.filter((s) => !GENERISCH.has(s))
  const anlass =
    spezifisch.length === 0 ||
    (klassifiziereTag(keyword) !== 'praezise' && ANLASS_RE.test(keyword.toLowerCase()))
  return listings
    .filter((l) => !tagIstVorhanden(l.tags, keyword))
    .filter((l) => !nenntFremdeHolzart(keyword, erkenneHolzGruppen(`${l.title} ${l.tags.join(' ')}`)))
    .map((l) => {
      const blob = new Set(stems(`${l.title} ${l.tags.join(' ')}`))
      let punkte = 0
      for (const s of kwStems) if (blob.has(s)) punkte += GENERISCH.has(s) ? 0.4 : 1
      // Anlass-Keywords ohne Produktbezug (z. B. „geschenk für mama“): passen zu jeder Schale,
      // Reichweite entscheidet.
      if (anlass && !spezifisch.some((s) => blob.has(s))) {
        punkte = Math.max(punkte, 0.5) + 0.4 + Math.min(0.5, Math.log10(1 + (l.views ?? 0)) / 8)
      }
      return { listing: l, punkte }
    })
    .filter((x) => x.punkte >= 0.9)
    .sort((a, b) => b.punkte - a.punkte || (b.listing.views ?? 0) - (a.listing.views ?? 0))
    .slice(0, max)
}

/** Konkreter Tausch-Plan für Keyword → Listing (oder null, wenn kein Platz). */
export function planeTagTausch(
  listing: CockpitListing,
  neu: string,
  opts: { schuetzen?: string[]; saisonAktiv?: EtsySaison[]; saisonVorbei?: EtsySaison[] } = {},
): EtsyTagTausch | null {
  const tag = normTag(neu)
  if (!istGueltigerTag(tag) || tagIstVorhanden(listing.tags, tag)) return null
  const wahl = waehleErsatzTag(listing.tags, { ...opts, title: listing.title })
  if (!wahl) return null
  return { listingId: listing.listingId, listingTitle: listing.title, alt: wahl.alt, altGrund: wahl.grund, neu: tag }
}

// ---------------------------------------------------------------------------
// Messung
// ---------------------------------------------------------------------------

export type StatPunkt = { tag: string; views: number | null; favoriten: number | null }

/** Letzter Snapshot ≤ tag. */
function stand(reihe: StatPunkt[], tag: string): StatPunkt | null {
  let treffer: StatPunkt | null = null
  for (const p of reihe) if (p.tag <= tag) treffer = p
  return treffer
}

export function tagMinus(tag: string, n: number): string {
  const d = new Date(`${tag}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() - n)
  return d.toISOString().slice(0, 10)
}

function tageZwischen(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86_400_000)
}

/**
 * Zuwachs eines Lebenszeit-Zählers im Fenster (von, bis]. Gibt den Wert nur zurück,
 * wenn beide Snapshots existieren und höchstens 2 Tage vom Soll abweichen.
 */
export function zuwachsImFenster(
  reihe: StatPunkt[],
  von: string,
  bis: string,
  feld: 'views' | 'favoriten',
): { wert: number; tage: number } | null {
  const a = stand(reihe, von)
  const b = stand(reihe, bis)
  if (!a || !b || a.tag === b.tag) return null
  if (tageZwischen(a.tag, von) > 2 || tageZwischen(b.tag, bis) > 2) return null
  const va = a[feld]
  const vb = b[feld]
  if (va == null || vb == null) return null
  return { wert: Math.max(0, vb - va), tage: tageZwischen(a.tag, b.tag) }
}

export function bewerteWirkung(w: Omit<EtsyWirkung, 'urteil'>): EtsyWirkung['urteil'] {
  if (w.tageSeither < 7 || w.viewsProTagVorher == null || w.viewsProTagNachher == null) return 'messung'
  const vorher = w.viewsProTagVorher
  const nachher = w.viewsProTagNachher
  if (vorher < 0.5 && nachher < 0.5) return w.verkaeufeNachher > w.verkaeufeVorher ? 'besser' : 'gleich'
  const faktor = (nachher + 0.2) / (vorher + 0.2)
  if (faktor >= 1.2 || w.verkaeufeNachher > w.verkaeufeVorher) return 'besser'
  if (faktor <= 0.8) return 'schlechter'
  return 'gleich'
}

// ---------------------------------------------------------------------------
// Aufgaben
// ---------------------------------------------------------------------------

export type CockpitRegelInput = {
  heute: string
  listings: CockpitListing[]
  /** listingId → Score */
  scores: Map<number, number>
  vorschlaege: Array<{
    listingId: number
    listingTitle: string
    grund: string
    scoreVorher: number | null
    before: { title: string; tags: string[] }
    after: { title: string; tags: string[] }
  }>
  rankVerluste: Array<{
    listingId: number
    keyword: string
    vorher: { page: number | null; position: number | null; found: boolean }
    jetzt: { page: number | null; position: number | null; found: boolean }
  }>
  hauptbegriffe: Map<number, string>
  merkliste: Array<{ keyword: string; chance: string | null; nachfrage: number | null }>
  /** Konkurrenz-Tag → Anzahl Shops (ohne eigenen) */
  konkurrenzTags: Map<string, number>
  konkurrenzShops: number
  /** listingId → Views/Favoriten 7 Tage jetzt vs. Vorwoche (null = keine Messung) */
  statistik: Map<number, { views7: number | null; views7Vorher: number | null; fav30: number | null; views30: number | null }>
  /** listingId → letzte Änderung (ISO) */
  letzteAenderung: Map<number, string>
  konkurrenzSpikes: Array<{ shopName: string; plus7: number; normal7: number }>
}

function rangText(r: { page: number | null; position: number | null; found: boolean }): string {
  return r.found && r.page != null ? `Seite ${r.page}${r.position != null ? `, Platz ${r.position}` : ''}` : 'nicht gefunden'
}

function kurz(t: string, n = 60): string {
  return t.length > n ? `${t.slice(0, n - 1)}…` : t
}

export function baueCockpitAufgaben(input: CockpitRegelInput): EtsyCockpitAufgabe[] {
  const aufgaben: EtsyCockpitAufgabe[] = []
  const byId = new Map(input.listings.map((l) => [l.listingId, l]))
  const { aktiv: saisonAktiv, vorbei: saisonVorbei } = saisonStatus(input.heute)
  const schutz = (id: number) => {
    const hb = input.hauptbegriffe.get(id)
    return hb ? [hb] : []
  }
  const vorschlagIds = new Set(input.vorschlaege.map((v) => v.listingId))
  // Virtueller Tag-Stand je Listing: jede geplante Aufgabe wird sofort „angewendet“,
  // damit zwei Aufgaben nie denselben Tag/Platz verplanen und neue Tags geschützt bleiben.
  const virtuell = new Map<number, string[]>(input.listings.map((l) => [l.listingId, [...l.tags]]))
  const neuGeplant = new Map<number, string[]>()
  const planOpts = (id: number) => ({
    schuetzen: [...schutz(id), ...(neuGeplant.get(id) ?? [])],
    saisonAktiv,
    saisonVorbei,
  })
  const plane = (l: CockpitListing, neu: string): EtsyTagTausch | null =>
    planeTagTausch({ ...l, tags: virtuell.get(l.listingId) ?? l.tags }, neu, planOpts(l.listingId))
  const reserviere = (t: EtsyTagTausch) => {
    const tags = virtuell.get(t.listingId) ?? []
    const neu = wendeTagTauschAn(tags, t.alt, t.neu)
    if (neu) virtuell.set(t.listingId, neu)
    neuGeplant.set(t.listingId, [...(neuGeplant.get(t.listingId) ?? []), t.neu])
  }

  // 1) Aufrufe eingebrochen
  for (const l of input.listings) {
    const s = input.statistik.get(l.listingId)
    if (!s || s.views7 == null || s.views7Vorher == null || s.views7Vorher < 15) continue
    if (s.views7 > s.views7Vorher * 0.5) continue
    const minus = Math.round((1 - s.views7 / s.views7Vorher) * 100)
    const aenderung = input.letzteAenderung.get(l.listingId)
    const nachAenderung = aenderung && Date.parse(aenderung) > Date.now() - 16 * 86_400_000
    aufgaben.push({
      key: `views_einbruch:${l.listingId}:${input.heute.slice(0, 7)}`,
      typ: 'views_einbruch',
      prioritaet: 90 + Math.min(8, Math.round(minus / 10)),
      titel: `Aufrufe −${minus} %: ${kurz(l.title)}`,
      detail:
        `${s.views7Vorher} → ${s.views7} Aufrufe (7 Tage vs. Vorwoche).` +
        (nachAenderung
          ? ` Kurz nach deiner Änderung am ${new Date(aenderung!).toLocaleDateString('de-DE')} — prüfen, ob sie geschadet hat.`
          : ' Frischer KI-Check zeigt, woran es liegt.'),
      listingId: l.listingId,
      listingTitle: l.title,
      aktion: { art: 'audit', listingId: l.listingId },
      zweitAktion: { art: 'oeffnen', modul: 'seo', listingId: l.listingId },
    })
  }

  // 2) Ranking-Verluste (je Listing gebündelt)
  const verlustProListing = new Map<number, CockpitRegelInput['rankVerluste']>()
  for (const v of input.rankVerluste) {
    if (!byId.has(v.listingId)) continue
    verlustProListing.set(v.listingId, [...(verlustProListing.get(v.listingId) ?? []), v])
  }
  for (const [id, liste] of verlustProListing) {
    const l = byId.get(id)!
    const v = liste[0]!
    aufgaben.push({
      key: `rank_verlust:${id}:${v.keyword}`,
      typ: 'rank_verlust',
      prioritaet: 85 + Math.min(5, liste.length - 1),
      titel: `Ranking verloren: „${v.keyword}“`,
      detail:
        `${kurz(l.title, 50)}: ${rangText(v.vorher)} → ${rangText(v.jetzt)}` +
        (liste.length > 1 ? ` (+${liste.length - 1} weitere Keywords)` : '') +
        (vorschlagIds.has(id) ? ' — ein KI-Vorschlag liegt schon bereit.' : ''),
      listingId: id,
      listingTitle: l.title,
      aktion: vorschlagIds.has(id) ? { art: 'oeffnen', modul: 'seo', listingId: id } : { art: 'audit', listingId: id },
    })
  }

  // 3) Fertige KI-Vorschläge (Cron) — 1 Klick übernehmen
  for (const v of input.vorschlaege) {
    if (!byId.has(v.listingId)) continue
    const alt = new Set(v.before.tags.map(normTag))
    const neu = new Set(v.after.tags.map(normTag))
    const titelNeu = v.after.title.trim() !== v.before.title.trim() ? v.after.title : undefined
    aufgaben.push({
      key: `vorschlag:${v.listingId}`,
      typ: 'vorschlag',
      prioritaet: 80 + (v.scoreVorher != null && v.scoreVorher < 60 ? 4 : 0),
      titel: `KI-Vorschlag bereit: ${kurz(v.listingTitle)}`,
      detail: v.grund || 'Automatisch vorbereitete Optimierung.',
      listingId: v.listingId,
      listingTitle: v.listingTitle,
      aktion: { art: 'vorschlag', listingId: v.listingId },
      zweitAktion: { art: 'oeffnen', modul: 'seo', listingId: v.listingId },
      diff: {
        plus: [...neu].filter((t) => !alt.has(t)),
        minus: [...alt].filter((t) => !neu.has(t)),
        titelNeu,
        titelAlt: titelNeu ? v.before.title : undefined,
      },
    })
  }

  // 4) Festgelegter Hauptbegriff fehlt in Tags / Titel
  for (const [id, hb] of input.hauptbegriffe) {
    const l = byId.get(id)
    if (!l || vorschlagIds.has(id)) continue
    const check = pruefeHauptbegriff(hb, { title: l.title, tags: l.tags, description: '' })
    if (!check.imTag && istGueltigerTag(hb)) {
      const plan = plane(l, hb)
      if (plan) {
        reserviere(plan)
        aufgaben.push({
          key: `hauptbegriff:${id}:${normTag(hb)}`,
          typ: 'hauptbegriff',
          prioritaet: 72,
          titel: `Hauptbegriff „${hb}“ fehlt als Tag`,
          detail: `${kurz(l.title, 50)} — Etsy gewichtet exakte Tag-Treffer am stärksten.`,
          listingId: id,
          listingTitle: l.title,
          aktion: { art: 'tag_tausch', tausch: [plan] },
        })
      }
    } else if (!check.titelVorne) {
      aufgaben.push({
        key: `hauptbegriff_titel:${id}:${normTag(hb)}`,
        typ: 'hauptbegriff',
        prioritaet: 62,
        titel: `Hauptbegriff „${hb}“ nicht vorne im Titel`,
        detail: `${kurz(l.title, 50)} — auf dem Handy sieht man nur die ersten ~50 Zeichen.`,
        listingId: id,
        listingTitle: l.title,
        aktion: { art: 'oeffnen', modul: 'seo', listingId: id },
      })
    }
  }

  // 5) Saison: Tag rein (aktiv) bzw. wieder raus (vorbei) — gebündelt für alle Listings
  for (const s of saisonAktiv) {
    const tausch: EtsyTagTausch[] = []
    for (const l of input.listings) {
      if (l.tags.some((t) => s.re.test(normTag(t)))) continue
      const plan = plane(l, s.tag)
      if (plan) {
        reserviere(plan)
        tausch.push(plan)
      }
    }
    if (!tausch.length) continue
    aufgaben.push({
      key: `saison:${s.id}:${input.heute.slice(0, 4)}`,
      typ: 'saison',
      prioritaet: 66 + Math.min(10, tausch.length),
      titel: `${s.name}: ${tausch.length} Listing${tausch.length === 1 ? '' : 's'} ohne Saison-Tag`,
      detail: `Tag „${s.tag}“ ergänzen — ersetzt jeweils den schwächsten Tag. Nach der Saison schlägt das Cockpit das Zurücktauschen vor.`,
      aktion: { art: 'tag_tausch', tausch },
    })
  }
  for (const s of saisonVorbei) {
    const tausch: EtsyTagTausch[] = []
    for (const l of input.listings) {
      const saisonTag = l.tags.find((t) => s.re.test(normTag(t)))
      if (!saisonTag) continue
      const ersatz = [...input.merkliste.map((m) => m.keyword), ...input.konkurrenzTags.keys()].find(
        (kw) =>
          istGueltigerTag(kw) &&
          !s.re.test(kw) &&
          !tagIstVorhanden(virtuell.get(l.listingId) ?? l.tags, kw) &&
          passendeListings(kw, [l], 1).length > 0,
      )
      if (!ersatz) continue
      tausch.push({ listingId: l.listingId, listingTitle: l.title, alt: saisonTag, altGrund: 'Saison vorbei', neu: normTag(ersatz) })
    }
    if (!tausch.length) continue
    tausch.forEach(reserviere)
    aufgaben.push({
      key: `saison_ende:${s.id}:${input.heute.slice(0, 4)}`,
      typ: 'saison_ende',
      prioritaet: 64,
      titel: `${s.name} vorbei: Saison-Tag in ${tausch.length} Listing${tausch.length === 1 ? '' : 's'} ersetzen`,
      detail: 'Der Platz bringt jetzt mit einem ganzjährigen Keyword mehr Aufrufe.',
      aktion: { art: 'tag_tausch', tausch },
    })
  }

  // 6) Gemerkte Keywords, die noch in keinem Listing stecken
  const alleTags = input.listings.flatMap((l) => l.tags)
  for (const m of input.merkliste) {
    if (!istGueltigerTag(m.keyword) || tagIstVorhanden(alleTags, m.keyword)) continue
    const passend = passendeListings(m.keyword, input.listings, 4)
    const plan = passend.map((p) => plane(p.listing, m.keyword)).find((p): p is EtsyTagTausch => p != null)
    if (!plan) continue
    reserviere(plan)
    aufgaben.push({
      key: `keyword:${normTag(m.keyword)}`,
      typ: 'keyword',
      prioritaet: 58 + (m.chance === 'hoch' ? 6 : m.chance === 'mittel' ? 3 : 0),
      titel: `Gemerktes Keyword einbauen: „${m.keyword}“`,
      detail:
        `Passt am besten zu „${kurz(plan.listingTitle, 45)}“.` +
        (m.nachfrage != null ? ` Nachfrage ${m.nachfrage}/100.` : ''),
      listingId: plan.listingId,
      listingTitle: plan.listingTitle,
      aktion: {
        art: 'tag_tausch',
        tausch: [plan],
        listingOptionen: passend.map((p) => ({ listingId: p.listing.listingId, title: p.listing.title })),
      },
    })
  }

  // 7) Tag-Lücken: nutzen ≥3 Top-Drechsler, du nirgends
  const merkSet = new Set(input.merkliste.map((m) => normTag(m.keyword)))
  const mindestShops = Math.max(2, Math.min(3, Math.ceil(input.konkurrenzShops * 0.3)))
  const luecken = [...input.konkurrenzTags.entries()]
    .filter(([t, n]) => n >= mindestShops && istGueltigerTag(t) && tagSprache(t) !== 'fremd')
    .filter(([t]) => !merkSet.has(normTag(t)) && !tagIstVorhanden(alleTags, t))
    .filter(([t]) => !ETSY_SAISONS.some((s) => s.re.test(t)) || saisonAktiv.some((s) => s.re.test(t)))
    .sort((a, b) => b[1] - a[1])
  let lueckenAnzahl = 0
  for (const [tag, n] of luecken) {
    if (lueckenAnzahl >= 5) break
    const passend = passendeListings(tag, input.listings, 4)
    const plan = passend.map((p) => plane(p.listing, tag)).find((p): p is EtsyTagTausch => p != null)
    if (!plan) continue
    reserviere(plan)
    lueckenAnzahl++
    aufgaben.push({
      key: `tag_luecke:${normTag(tag)}`,
      typ: 'tag_luecke',
      prioritaet: 52 + Math.min(6, n),
      titel: `${n} Top-Drechsler nutzen „${tag}“ — du nicht`,
      detail: `Vorschlag: bei „${kurz(plan.listingTitle, 45)}“ ergänzen.`,
      listingId: plan.listingId,
      listingTitle: plan.listingTitle,
      aktion: {
        art: 'tag_tausch',
        tausch: [plan],
        listingOptionen: passend.map((p) => ({ listingId: p.listing.listingId, title: p.listing.title })),
      },
      zweitAktion: { art: 'merken', keyword: tag },
    })
  }

  // 8) Schwache Scores ohne bereiten Vorschlag
  for (const l of input.listings) {
    const score = input.scores.get(l.listingId)
    if (score == null || score >= 70 || vorschlagIds.has(l.listingId) || verlustProListing.has(l.listingId)) continue
    aufgaben.push({
      key: `schwach:${l.listingId}:${score}`,
      typ: 'schwach',
      prioritaet: 48 + Math.round((70 - score) / 5),
      titel: `SEO-Score ${score}: ${kurz(l.title)}`,
      detail: 'Neu auditieren → der KI-Check liefert Titel, 13 Tags und Einstieg zum Übernehmen.',
      listingId: l.listingId,
      listingTitle: l.title,
      aktion: { art: 'audit', listingId: l.listingId },
      zweitAktion: { art: 'oeffnen', modul: 'seo', listingId: l.listingId },
    })
  }

  // 9) Noch nie auditierte Listings
  const ohneAudit = input.listings.filter((l) => !input.scores.has(l.listingId))
  if (ohneAudit.length) {
    aufgaben.push({
      key: `kein_audit:${ohneAudit.length}`,
      typ: 'kein_audit',
      prioritaet: 45,
      titel: `${ohneAudit.length} Listing${ohneAudit.length === 1 ? '' : 's'} noch ohne SEO-Check`,
      detail: 'Einmal alle prüfen — danach findet das Cockpit Schwachstellen automatisch.',
      aktion: { art: 'batch_audit', anzahl: Math.min(15, ohneAudit.length) },
    })
  }

  // 10) Aufrufe ohne Favoriten → Foto/Preis
  for (const l of input.listings) {
    const s = input.statistik.get(l.listingId)
    const viel = s?.views30 != null ? s.views30 >= 60 && (s.fav30 ?? 0) === 0 : (l.views ?? 0) >= 250 && (l.numFavorers ?? 0) === 0
    if (!viel) continue
    aufgaben.push({
      key: `keine_favoriten:${l.listingId}`,
      typ: 'keine_favoriten',
      prioritaet: 40,
      titel: `Wird gesehen, aber nicht gemerkt: ${kurz(l.title, 50)}`,
      detail:
        (s?.views30 != null ? `${s.views30} Aufrufe in 30 Tagen, 0 Favoriten.` : `${l.views} Aufrufe gesamt, 0 Favoriten.`) +
        ' SEO wirkt — Hauptfoto (Maserung, heller Hintergrund) und Preis prüfen.',
      listingId: l.listingId,
      listingTitle: l.title,
      aktion: { art: 'oeffnen', modul: 'seo', listingId: l.listingId },
    })
  }

  // 11) Konkurrenz zieht an
  for (const k of input.konkurrenzSpikes) {
    aufgaben.push({
      key: `konkurrenz:${k.shopName}:${input.heute}`,
      typ: 'konkurrenz',
      prioritaet: 20,
      titel: `${k.shopName}: ${k.plus7} Verkäufe in 7 Tagen`,
      detail: `Sonst ~${k.normal7} pro Woche — schau, welche Tags/Listings gerade laufen.`,
      aktion: { art: 'oeffnen', modul: 'konkurrenz' },
    })
  }

  return aufgaben.sort((a, b) => b.prioritaet - a.prioritaet)
}

/** Tausch auf Tag-Liste anwenden (Server-seitig vor dem Etsy-Update). */
export function wendeTagTauschAn(tags: string[], alt: string | null, neu: string): string[] | null {
  const tag = normTag(neu)
  if (!istGueltigerTag(tag) || tagIstVorhanden(tags, tag)) return null
  if (alt == null) return tags.length < ETSY_SEO_TAG_COUNT ? [...tags, tag] : null
  const i = tags.findIndex((t) => normTag(t) === normTag(alt))
  if (i < 0) return null
  const out = [...tags]
  out[i] = tag
  return out
}
