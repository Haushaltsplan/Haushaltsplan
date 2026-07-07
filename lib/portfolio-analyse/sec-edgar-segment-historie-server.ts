/** SEC 10-K — Geo-/Produktsegment-Historie + Zusatz-Risikofelder (10+ Jahre). */

import 'server-only'

import type {
  SecSegmentHistorie,
  SecSegmentHistorieKategorie,
  SecSegmentHistoriePaket,
  SecZusatzRisikoFelder,
} from '@/lib/portfolio-analyse/fundamentaldaten-erweitert-types'
import {
  extrahiereAlleDetailBloeckeAus10kHtml,
  mergeDetailInMap,
  mergeJahrSmart,
  SEC_DETAIL_BLOCKS,
  type SecDetailBlockDef,
} from '@/lib/portfolio-analyse/sec-edgar-detail-extraktion'
import { leseAlsJson } from '@/lib/http/safe-json-response'
import { ladeLesbarenBerichtText } from '@/lib/portfolio-analyse/sec-edgar-bericht-text-server'
import { ladeCompanyFactsJson, ladeSecCompanyFacts } from '@/lib/portfolio-analyse/sec-edgar-companyfacts-server'
import { extrahiereBacklogAusCompanyFacts, extrahiereBacklogMioAusText, mergeBacklogMitJahrWerten } from '@/lib/portfolio-analyse/sec-edgar-backlog-server'
import {
  ladeSecSegmentHistorieAusCloud,
  speichereSecSegmentHistorieInCloud,
} from '@/lib/portfolio-analyse/sec-edgar-segment-historie-cloud-server'
import type { SecSegmentHistorieRohZustand } from '@/lib/portfolio-analyse/sec-edgar-segment-historie-roh-types'
import {
  cikFuerTicker,
  padCik,
  secFetch,
  type SecSubmissionsRecent,
} from '@/lib/portfolio-analyse/sec-edgar-common-server'
import { extrahiereUmsatzAusIxbrlDimensionen } from '@/lib/portfolio-analyse/sec-edgar-ixbrl-dimensionen'
import {
  baueNarrativeGeoHistorie,
  extrahiereDomesticForeignEinkommenSplit,
  extrahiereNarrativeGeoProzent,
} from '@/lib/portfolio-analyse/sec-edgar-narrative-geo-server'
import {
  bereinigeHistorieGegenJahresumsatz,
  ergaenzeJahresluecken,
  interpoliereJahresluecken,
} from '@/lib/portfolio-analyse/sec-edgar-segment-normalisierung'
import { extrahiereNarrativeSegmentTabellen } from '@/lib/portfolio-analyse/sec-edgar-narrative-tabellen'
import {
  extrahiereBeideSegmentartenAus10kHtml,
  ergaenzeSegmentHistorieMitMargen,
  extrahiereErstenGeoBlock,
  extrahiereOperatingIncomeHistorieAus10kHtml,
  extrahiereSegmentHistorieAus10kHtml,
  filterJahreNachArt,
  filterSegmentHistorie,
  mergeOiJahrSmart,
  segmentIstGeo,
  extrahiereSegmenteFuerJahr,
  parseGeoSegmente,
  teileUmsatzDetailInProduktUndGeo,
  validiereSegmente,
  type SecSegmentJahrEintrag,
  type SecSegmentRoh,
} from '@/lib/portfolio-analyse/sec-edgar-segment-extraktion'

const CACHE_MS = 24 * 60 * 60 * 1000
/** Parser-Version — bei Extraktions-Fixes erhöhen (invalidiert Server- + Cloud-Cache). */
export const SEC_SEGMENT_HISTORIE_CACHE_VERSION = 16
const CACHE_VERSION = SEC_SEGMENT_HISTORIE_CACHE_VERSION
/** Ziel: mindestens 12 Geschäftsjahre Segmentdaten. */
const ZIEL_JAHRE = 12
/** Max. 10-K-Filings laden (je ~3 Jahre pro Filing → 12+ Jahre). */
const MAX_10K_FILINGS = 14
const PAUSE_MS = 350

const cache = new Map<string, { at: number; v: number; data: SecSegmentHistoriePaket | null }>()

type Arbeitszustand = {
  kategorieMaps: Map<string, Map<number, SecSegmentRoh[]>>
  kategorieMeta: Map<string, Map<number, number>>
  kategorieDefs: Map<string, SecDetailBlockDef>
  oiMap: Map<number, SecSegmentRoh[]>
  oiMeta: Map<number, number>
  mitarbeiterProJahr: Map<number, number>
  kundenProJahr: Map<number, { name: string | null; anteilPct: number } | null>
  backlogProJahr: Map<number, number>
  narrativeGeoProJahr: Map<number, { usPct: number; intlPct: number }>
  verarbeiteteAccessions: string[]
}

function leererArbeitszustand(): Arbeitszustand {
  return {
    kategorieMaps: new Map(),
    kategorieMeta: new Map(),
    kategorieDefs: new Map(),
    oiMap: new Map(),
    oiMeta: new Map(),
    mitarbeiterProJahr: new Map(),
    kundenProJahr: new Map(),
    backlogProJahr: new Map(),
    narrativeGeoProJahr: new Map(),
    verarbeiteteAccessions: [],
  }
}

function jahrMapToRecord(m: Map<number, SecSegmentRoh[]>): Record<string, SecSegmentRoh[]> {
  return Object.fromEntries([...m.entries()].map(([k, v]) => [String(k), v]))
}

function recordToJahrMap(r: Record<string, SecSegmentRoh[]>): Map<number, SecSegmentRoh[]> {
  return new Map(Object.entries(r).map(([k, v]) => [parseInt(k, 10), v]))
}

function metaMapToRecord(m: Map<number, number>): Record<string, number> {
  return Object.fromEntries([...m.entries()].map(([k, v]) => [String(k), v]))
}

function recordToMetaMap(r: Record<string, number>): Map<number, number> {
  return new Map(Object.entries(r).map(([k, v]) => [parseInt(k, 10), v]))
}

function arbeitszustandZuRoh(z: Arbeitszustand): SecSegmentHistorieRohZustand {
  const kategorieMaps: SecSegmentHistorieRohZustand['kategorieMaps'] = {}
  for (const [id, inner] of z.kategorieMaps) {
    kategorieMaps[id] = jahrMapToRecord(inner)
  }
  const kategorieMeta: SecSegmentHistorieRohZustand['kategorieMeta'] = {}
  for (const [id, inner] of z.kategorieMeta) {
    kategorieMeta[id] = metaMapToRecord(inner)
  }
  const mitarbeiterProJahr: Record<string, number> = {}
  for (const [j, v] of z.mitarbeiterProJahr) mitarbeiterProJahr[String(j)] = v
  const kundenProJahr: SecSegmentHistorieRohZustand['kundenProJahr'] = {}
  for (const [j, v] of z.kundenProJahr) kundenProJahr[String(j)] = v
  const backlogProJahr: Record<string, number> = {}
  for (const [j, v] of z.backlogProJahr) backlogProJahr[String(j)] = v
  const narrativeGeoProJahr: SecSegmentHistorieRohZustand['narrativeGeoProJahr'] = {}
  for (const [j, v] of z.narrativeGeoProJahr) narrativeGeoProJahr[String(j)] = v
  return {
    kategorieMaps,
    kategorieMeta,
    kategorieDefs: Object.fromEntries(z.kategorieDefs),
    oiMap: jahrMapToRecord(z.oiMap),
    oiMeta: metaMapToRecord(z.oiMeta),
    mitarbeiterProJahr,
    kundenProJahr,
    backlogProJahr,
    narrativeGeoProJahr,
    verarbeiteteAccessions: [...z.verarbeiteteAccessions],
  }
}

function rohZuArbeitszustand(r: SecSegmentHistorieRohZustand): Arbeitszustand {
  const z = leererArbeitszustand()
  for (const [id, inner] of Object.entries(r.kategorieMaps ?? {})) {
    z.kategorieMaps.set(id, recordToJahrMap(inner))
  }
  for (const [id, inner] of Object.entries(r.kategorieMeta ?? {})) {
    z.kategorieMeta.set(id, recordToMetaMap(inner))
  }
  for (const [id, def] of Object.entries(r.kategorieDefs ?? {})) {
    z.kategorieDefs.set(id, def)
  }
  z.oiMap = recordToJahrMap(r.oiMap ?? {})
  z.oiMeta = recordToMetaMap(r.oiMeta ?? {})
  for (const [k, v] of Object.entries(r.mitarbeiterProJahr ?? {})) {
    z.mitarbeiterProJahr.set(parseInt(k, 10), v)
  }
  for (const [k, v] of Object.entries(r.kundenProJahr ?? {})) {
    if (v) z.kundenProJahr.set(parseInt(k, 10), v)
  }
  for (const [k, v] of Object.entries(r.backlogProJahr ?? {})) {
    z.backlogProJahr.set(parseInt(k, 10), v)
  }
  for (const [k, v] of Object.entries(r.narrativeGeoProJahr ?? {})) {
    if (v) z.narrativeGeoProJahr.set(parseInt(k, 10), v)
  }
  z.verarbeiteteAccessions = [...(r.verarbeiteteAccessions ?? [])]
  return z
}

function baueZusatzAusZustand(
  basis: SecZusatzRisikoFelder,
  zustand: Arbeitszustand,
): SecZusatzRisikoFelder {
  return {
    ...basis,
    mitarbeiterHistorie: [...zustand.mitarbeiterProJahr.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([jahr, anzahl]) => ({ jahr, anzahl })),
    kundenKonzentrationHistorie: [...zustand.kundenProJahr.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([jahr, k]) => ({ jahr, anteilPct: k!.anteilPct, name: k!.name })),
  }
}

function verarbeite10kInZustand(
  zustand: Arbeitszustand,
  html: string,
  text: string,
  filing: Filing10k,
): void {
  const jahr = jahrAusFiling(filing)
  if (jahr != null && text.length > 1_000) {
    const ma = extrahiereMitarbeiterAusText(text)
    if (ma != null) zustand.mitarbeiterProJahr.set(jahr, ma)
    const k = extrahiereKundenKonzentration(text)
    if (k != null) zustand.kundenProJahr.set(jahr, k)
    const bl = extrahiereBacklogMioAusText(text)
    if (bl != null) zustand.backlogProJahr.set(jahr, bl)
    const narrPct = extrahiereNarrativeGeoProzent(text)
    if (narrPct) zustand.narrativeGeoProJahr.set(jahr, narrPct)
  }
  if (html.length > 5_000) {
    for (const [jahr, pct] of extrahiereDomesticForeignEinkommenSplit(html)) {
      if (!zustand.narrativeGeoProJahr.has(jahr)) zustand.narrativeGeoProJahr.set(jahr, pct)
    }
  }

  if (html.length <= 5_000) {
    if (!zustand.verarbeiteteAccessions.includes(filing.accession)) {
      zustand.verarbeiteteAccessions.push(filing.accession)
    }
    return
  }

  const details = extrahiereAlleDetailBloeckeAus10kHtml(html)
  for (const kat of details) {
    zustand.kategorieDefs.set(kat.def.id, kat.def)
    mergeDetailInMap(zustand.kategorieMaps, kat, jahr ?? undefined, zustand.kategorieMeta)
  }

  const oiJahre = extrahiereOperatingIncomeHistorieAus10kHtml(html)
  for (const j of oiJahre) {
    mergeOiJahrSmart(zustand.oiMap, j.jahr, j.segmente, jahr ?? undefined, zustand.oiMeta)
  }

  const hist = extrahiereSegmentHistorieAus10kHtml(html)
  if (hist.produkt) {
    mergeInKategorie(zustand.kategorieMaps, zustand.kategorieMeta, 'segment_reporting', hist.produkt.jahre, jahr ?? undefined)
  }
  if (hist.geo) {
    mergeInKategorie(zustand.kategorieMaps, zustand.kategorieMeta, 'geo_umsatz', hist.geo.jahre, jahr ?? undefined)
  }

  if (jahr != null) {
    const einzel = extrahiereSegmenteFuerJahr(html, jahr)
    mergeEinzelInKategorie(zustand.kategorieMaps, zustand.kategorieMeta, 'segment_reporting', jahr, einzel.produkt, jahr)
    mergeEinzelInKategorie(zustand.kategorieMaps, zustand.kategorieMeta, 'geo_umsatz', jahr, einzel.geo, jahr)

    const geoBlock = extrahiereErstenGeoBlock(html)
    if (geoBlock.length > 200) {
      const geoSpalte = validiereSegmente(parseGeoSegmente(geoBlock, true))
      mergeEinzelInKategorie(zustand.kategorieMaps, zustand.kategorieMeta, 'geo_umsatz', jahr, geoSpalte, jahr)
    }

    const beide = extrahiereBeideSegmentartenAus10kHtml(html)
    mergeEinzelInKategorie(zustand.kategorieMaps, zustand.kategorieMeta, 'segment_reporting', jahr, beide.produkt.segmente, jahr)
    mergeEinzelInKategorie(zustand.kategorieMaps, zustand.kategorieMeta, 'geo_umsatz', jahr, beide.geo.segmente, jahr)
  }

  const ixDim = extrahiereUmsatzAusIxbrlDimensionen(html)
  if (ixDim.produkt.length >= 1) {
    mergeInKategorie(zustand.kategorieMaps, zustand.kategorieMeta, 'segment_reporting', ixDim.produkt, jahr ?? undefined)
  }
  if (ixDim.geo.length >= 1) {
    mergeInKategorie(zustand.kategorieMaps, zustand.kategorieMeta, 'geo_umsatz', ixDim.geo, jahr ?? undefined)
  }

  const narr = extrahiereNarrativeSegmentTabellen(html)
  if (narr.produkt.length >= 1) {
    mergeInKategorie(zustand.kategorieMaps, zustand.kategorieMeta, 'umsatz_detail', narr.produkt, jahr ?? undefined)
  }
  if (narr.geo.length >= 1) {
    mergeInKategorie(zustand.kategorieMaps, zustand.kategorieMeta, 'geo_umsatz', narr.geo, jahr ?? undefined)
  }

  if (!zustand.verarbeiteteAccessions.includes(filing.accession)) {
    zustand.verarbeiteteAccessions.push(filing.accession)
  }
}

function sammleProduktQuellen(kategorien: SecSegmentHistorieKategorie[]): SecSegmentJahrEintrag[][] {
  const quellen: SecSegmentJahrEintrag[][] = []
  for (const k of kategorien) {
    if (k.metrik !== 'umsatz') continue
    if (k.id === 'umsatz_detail' || k.id === 'franchise_umsatz' || (k.id.startsWith('dyn_') && /disaggregat/i.test(k.id))) {
      const split = teileUmsatzDetailInProduktUndGeo(k.historie.jahre)
      if (split.produkt.length >= 1) quellen.push(filterJahreNachArt(split.produkt, 'produkt'))
    } else if (k.art === 'produkt' || k.art === 'produkte_services' || k.art === 'umsatz_detail') {
      quellen.push(filterJahreNachArt(k.historie.jahre, 'produkt'))
    }
  }
  return quellen
}

function sammleGeoQuellen(kategorien: SecSegmentHistorieKategorie[]): SecSegmentJahrEintrag[][] {
  const quellen: SecSegmentJahrEintrag[][] = []
  for (const k of kategorien) {
    if (k.metrik !== 'umsatz') continue
    if (k.art === 'geo' || k.id.startsWith('geo_') || k.id === 'revenues_geo_alt') {
      quellen.push(filterJahreNachArt(k.historie.jahre, 'geo'))
    } else if (k.id === 'umsatz_detail' || k.id === 'franchise_umsatz') {
      const split = teileUmsatzDetailInProduktUndGeo(k.historie.jahre)
      if (split.geo.length >= 1) quellen.push(filterJahreNachArt(split.geo, 'geo'))
    }
  }
  return quellen
}

function finalisiereSegmentHistorie(
  hist: SecSegmentHistorie | null,
  quellen: SecSegmentJahrEintrag[][],
): SecSegmentHistorie | null {
  if (!hist && quellen.length === 0) return null
  return interpoliereJahresluecken(ergaenzeJahresluecken(hist, quellen))
}

async function bauePaketAusZustand(
  sym: string,
  cik: number,
  zustand: Arbeitszustand,
  html10k: string,
  text10k: string,
  berichtJahr: number | null,
  geladene10k: number,
  kennzahlen: Awaited<ReturnType<typeof ladeSecCompanyFacts>>,
): Promise<SecSegmentHistoriePaket | null> {
  if (html10k.length > 5_000 && berichtJahr != null) {
    priorisiereNeuestesFiling(zustand.kategorieMaps, zustand.kategorieMeta, zustand.kategorieDefs, html10k, berichtJahr)
  }

  const kategorienRoh = baueKategorienListe(zustand.kategorieMaps, zustand.kategorieDefs)
  const oiJahrEintraege: SecSegmentJahrEintrag[] = [...zustand.oiMap.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([jahr, segmente]) => ({ jahr, segmente }))
  const kategorien = kategorienRoh.map((k) =>
    k.metrik === 'umsatz'
      ? { ...k, historie: ergaenzeSegmentHistorieMitMargen(k.historie, oiJahrEintraege) }
      : k,
  )

  let produkt = waehleProduktHistorie(kategorien, berichtJahr)
  let geo = waehleGeoHistorie(kategorien)
  const ergaenzt = ergaenzeFehlendeProduktGeo(produkt, geo, kategorien, html10k, berichtJahr)
  produkt = finalisiereSegmentHistorie(
    filterSegmentHistorie(ergaenzt.produkt, 'produkt'),
    sammleProduktQuellen(kategorien),
  )
  geo = finalisiereSegmentHistorie(
    filterSegmentHistorie(ergaenzt.geo, 'geo'),
    sammleGeoQuellen(kategorien),
  )

  if (!geo && zustand.narrativeGeoProJahr.size >= 2) {
    const umsatzProJahr = new Map<number, number>()
    for (const e of kennzahlen?.umsatzMio ?? []) umsatzProJahr.set(e.jahr, e.wert)
    if (produkt) {
      for (const j of produkt.jahre) {
        const sum = j.segmente.reduce((s, x) => s + (x.umsatzMio ?? 0), 0)
        if (sum > 0 && !umsatzProJahr.has(j.jahr)) umsatzProJahr.set(j.jahr, sum)
      }
    }
    const narJahre = baueNarrativeGeoHistorie(zustand.narrativeGeoProJahr, umsatzProJahr)
    geo = finalisiereSegmentHistorie(
      filterSegmentHistorie(baueHistorie('geo', mapAusJahrEintraegen(narJahre)), 'geo'),
      [],
    )
  }

  const umsatzProJahr = new Map<number, number>()
  for (const e of kennzahlen?.umsatzMio ?? []) umsatzProJahr.set(e.jahr, e.wert)
  if (produkt) {
    produkt = bereinigeHistorieGegenJahresumsatz(
      produkt,
      umsatzProJahr,
      sammleProduktQuellen(kategorien),
    )
  }
  if (geo) {
    geo = bereinigeHistorieGegenJahresumsatz(geo, umsatzProJahr, sammleGeoQuellen(kategorien))
  }

  if (produkt) produkt = ergaenzeSegmentHistorieMitMargen(produkt, oiJahrEintraege)
  if (geo) geo = ergaenzeSegmentHistorieMitMargen(geo, oiJahrEintraege)

  const zusatzBasis = extrahiereSecZusatzRisiko(text10k, html10k)
  const zusatz = baueZusatzAusZustand(zusatzBasis, zustand)

  const factsJson = await ladeCompanyFactsJson(cik)
  const backlog = mergeBacklogMitJahrWerten(
    factsJson ? extrahiereBacklogAusCompanyFacts(factsJson) : null,
    zustand.backlogProJahr,
  )

  if (
    !produkt &&
    !geo &&
    kategorien.length === 0 &&
    !kennzahlen &&
    !backlog &&
    !zusatz.mitarbeiterAnzahl &&
    zusatz.hauptkunden.length === 0
  ) {
    return null
  }

  return {
    produkt,
    geo,
    kategorien,
    zusatz,
    backlog,
    kennzahlen,
    berichtJahr,
    anzahl10k: geladene10k,
    geladenAm: new Date().toISOString(),
    quelle: 'sec_edgar',
  }
}

function setMemoryCache(sym: string, data: SecSegmentHistoriePaket | null): void {
  cache.set(sym, { at: Date.now(), v: CACHE_VERSION, data })
}

async function speichereInCloud(
  sym: string,
  cik: number,
  zustand: Arbeitszustand,
  paket: SecSegmentHistoriePaket,
  neuesteAccession: string | null,
  neuestesBerichtJahr: number | null,
): Promise<void> {
  await speichereSecSegmentHistorieInCloud({
    ticker: sym,
    cik,
    cacheVersion: CACHE_VERSION,
    verarbeiteteAccessions: zustand.verarbeiteteAccessions,
    neuesteAccession,
    neuestesBerichtJahr,
    roh: arbeitszustandZuRoh(zustand),
    paket,
    aktualisiertAm: new Date().toISOString(),
  })
}

function pause(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

type Filing10k = {
  accession: string
  primaryDocument: string
  reportDate: string | null
  filingDate: string | null
}

function filingsAusRecent(recent: SecSubmissionsRecent, max: number): Filing10k[] {
  const out: Filing10k[] = []
  const seen = new Set<string>()
  if (!recent.form?.length) return out
  for (let i = 0; i < recent.form.length && out.length < max; i++) {
    if (recent.form[i] !== '10-K') continue
    const accession = recent.accessionNumber?.[i]
    const doc = recent.primaryDocument?.[i]
    if (!accession || !doc || seen.has(accession)) continue
    seen.add(accession)
    out.push({
      accession,
      primaryDocument: doc,
      reportDate: recent.reportDate?.[i] ?? null,
      filingDate: recent.filingDate?.[i] ?? null,
    })
  }
  return out
}

async function liste10kFilings(cik: number, max: number): Promise<Filing10k[]> {
  const subRes = await secFetch(`https://data.sec.gov/submissions/CIK${padCik(cik)}.json`)
  if (!subRes.ok) return []
  const sub = (await leseAlsJson<{
    filings?: { recent?: SecSubmissionsRecent; files?: { name: string }[] }
  }>(subRes)) ?? {}

  const out = filingsAusRecent(sub?.filings?.recent ?? {}, max)
  if (out.length >= max) return out

  const extraFiles = sub?.filings?.files ?? []
  for (const file of extraFiles) {
    if (out.length >= max) break
    if (!file.name?.includes('submissions')) continue
    await pause(PAUSE_MS)
    const fRes = await secFetch(`https://data.sec.gov/submissions/${file.name}`)
    if (!fRes.ok) continue
    const chunk = (await leseAlsJson<{
      form?: string[]
      accessionNumber?: string[]
      primaryDocument?: string[]
      reportDate?: string[]
      filingDate?: string[]
    }>(fRes)) ?? {}
    const merged: SecSubmissionsRecent = {
      form: chunk.form,
      accessionNumber: chunk.accessionNumber,
      primaryDocument: chunk.primaryDocument,
      reportDate: chunk.reportDate,
      filingDate: chunk.filingDate,
    }
    for (const f of filingsAusRecent(merged, max - out.length)) {
      if (!out.some((x) => x.accession === f.accession)) out.push(f)
    }
  }

  return out.slice(0, max)
}

async function lade10kHtml(
  cik: number,
  filing: Filing10k,
): Promise<{ html: string; text: string } | null> {
  const bericht = await ladeLesbarenBerichtText(cik, filing.accession, '10-K', filing.primaryDocument)
  if (!bericht?.url) return bericht ? { html: '', text: bericht.text } : null
  const hres = await secFetch(bericht.url)
  const html = hres.ok ? await hres.text() : ''
  return { html, text: bericht.text }
}

function jahrAusFiling(f: Filing10k): number | null {
  const iso = f.reportDate ?? f.filingDate
  if (!iso) return null
  const y = parseInt(iso.slice(0, 4), 10)
  return Number.isFinite(y) ? y : null
}

function mergeMehrjahresInMap(
  map: Map<number, SecSegmentRoh[]>,
  eintraege: SecSegmentJahrEintrag[],
  filingBerichtJahr?: number,
  meta?: Map<number, number>,
): void {
  for (const e of eintraege) {
    mergeJahrSmart(map, e.jahr, e.segmente, filingBerichtJahr, meta)
  }
}

function baueHistorie(
  art: SecSegmentHistorie['art'],
  jahrMap: Map<number, SecSegmentRoh[]>,
): SecSegmentHistorie | null {
  const jahre = [...jahrMap.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([jahr, segmente]) => ({ jahr, segmente }))
  if (jahre.length < 2) return null

  const segmentNamen = [...new Set(jahre.flatMap((j) => j.segmente.map((s) => s.name)))].sort()

  return {
    art,
    jahre,
    segmentNamen,
    anzahlJahre: jahre.length,
    aeltestesJahr: jahre[0]!.jahr,
    juengstesJahr: jahre[jahre.length - 1]!.jahr,
  }
}

/** Operating-/Disclosure-Segmente — redundant zur Umsatz-Aufschlüsselung. */
const AUSGESCHLOSSENE_KATEGORIE_IDS = new Set(['produkt_segment', 'segment_disclosure'])

function baueKategorienListe(
  kategorieMaps: Map<string, Map<number, SecSegmentRoh[]>>,
  kategorieDefs?: Map<string, SecDetailBlockDef>,
): SecSegmentHistorieKategorie[] {
  const out: SecSegmentHistorieKategorie[] = []
  const erledigt = new Set<string>()

  const pushKategorie = (def: SecDetailBlockDef, map: Map<number, SecSegmentRoh[]>) => {
    if (AUSGESCHLOSSENE_KATEGORIE_IDS.has(def.id)) return
    const historie = baueHistorie(def.art, map)
    if (!historie || historie.anzahlJahre < 2) return
    out.push({
      id: def.id,
      titel: def.titel,
      art: def.art,
      metrik: def.metrik,
      historie,
    })
  }

  for (const def of SEC_DETAIL_BLOCKS) {
    const map = kategorieMaps.get(def.id)
    if (!map) continue
    erledigt.add(def.id)
    pushKategorie(def, map)
  }

  for (const [id, map] of kategorieMaps) {
    if (erledigt.has(id)) continue
    const def = kategorieDefs?.get(id)
    if (!def) continue
    pushKategorie(def, map)
  }

  return out.sort((a, b) => {
    const prio: Record<string, number> = {
      umsatz_detail: 0,
      segment_reporting: 1,
      franchise_umsatz: 2,
      geo_umsatz: 3,
      geo_kombiniert: 4,
      produkte_services: 5,
      geo_assets: 6,
    }
    const pa = prio[a.id] ?? 50
    const pb = prio[b.id] ?? 50
    if (pa !== pb) return pa - pb
    return b.historie.anzahlJahre - a.historie.anzahlJahre
  })
}

function besteHistorie(
  kategorien: SecSegmentHistorieKategorie[],
  filter: (k: SecSegmentHistorieKategorie) => boolean,
): SecSegmentHistorie | null {
  const hits = kategorien.filter(filter)
  if (hits.length === 0) return null
  return hits.sort((a, b) => b.historie.anzahlJahre - a.historie.anzahlJahre)[0]!.historie
}

const PRODUKT_KAT_PRIO = ['umsatz_detail', 'segment_reporting', 'franchise_umsatz', 'produkte_services'] as const
const GEO_KAT_PRIO = ['geo_umsatz', 'geo_kombiniert', 'revenues_geo_alt'] as const

/** Bevorzugt aktuelle Jahre — veraltete Disaggregation (z. B. UNP) nicht über frische Segment-Tabellen. */
function waehleProduktHistorie(
  kategorien: SecSegmentHistorieKategorie[],
  berichtJahr: number | null,
): SecSegmentHistorie | null {
  const refJahr = berichtJahr ?? new Date().getFullYear() - 1
  const hits = PRODUKT_KAT_PRIO.map((id) => kategorien.find((k) => k.id === id)).filter(
    (k): k is SecSegmentHistorieKategorie => k != null,
  )
  const dynDisagg = kategorien.find(
    (k) => k.id.startsWith('dyn_') && /disaggregat/i.test(k.id) && k.metrik === 'umsatz',
  )
  if (dynDisagg && !hits.some((h) => h.id === 'umsatz_detail')) hits.push(dynDisagg)
  if (hits.length === 0) {
    return besteHistorie(
      kategorien,
      (k) => k.art === 'produkt' && k.metrik === 'umsatz' && !k.id.startsWith('dyn_'),
    )
  }

  const sortiert = [...hits].sort((a, b) => {
    const aStale = a.historie.juengstesJahr < refJahr - 1 ? 1 : 0
    const bStale = b.historie.juengstesJahr < refJahr - 1 ? 1 : 0
    if (aStale !== bStale) return aStale - bStale
    if (b.historie.anzahlJahre !== a.historie.anzahlJahre) {
      return b.historie.anzahlJahre - a.historie.anzahlJahre
    }
    if (b.historie.juengstesJahr !== a.historie.juengstesJahr) {
      return b.historie.juengstesJahr - a.historie.juengstesJahr
    }
    return PRODUKT_KAT_PRIO.indexOf(a.id as (typeof PRODUKT_KAT_PRIO)[number]) -
      PRODUKT_KAT_PRIO.indexOf(b.id as (typeof PRODUKT_KAT_PRIO)[number])
  })
  const gewinner = sortiert[0]
  if (!gewinner) return null

  const istGemischteDisagg =
    gewinner.id === 'umsatz_detail' ||
    gewinner.id === 'franchise_umsatz' ||
    (gewinner.id.startsWith('dyn_') && /disaggregat/i.test(gewinner.id))
  if (istGemischteDisagg) {
    const split = teileUmsatzDetailInProduktUndGeo(gewinner.historie.jahre)
    const prodJahre = filterJahreNachArt(split.produkt, 'produkt')
    if (prodJahre.length >= 2) {
      return baueHistorie('produkt', mapAusJahrEintraegen(prodJahre))
    }
  }

  return filterSegmentHistorie(gewinner.historie, 'produkt') ?? gewinner.historie
}

function waehleGeoHistorie(kategorien: SecSegmentHistorieKategorie[]): SecSegmentHistorie | null {
  for (const id of GEO_KAT_PRIO) {
    const hit = kategorien.find((k) => k.id === id)
    if (hit && hit.historie.anzahlJahre >= 2) {
      return filterSegmentHistorie(hit.historie, 'geo') ?? hit.historie
    }
  }
  const dynGeo = kategorien.find(
    (k) => k.id.startsWith('dyn_') && k.art === 'geo' && k.historie.anzahlJahre >= 2,
  )
  if (dynGeo) return filterSegmentHistorie(dynGeo.historie, 'geo') ?? dynGeo.historie
  const hits = kategorien.filter(
    (k) => k.art === 'geo' && k.metrik === 'umsatz' && !k.id.startsWith('dyn_'),
  )
  if (hits.length === 0) return null
  const best = hits.sort((a, b) => b.historie.anzahlJahre - a.historie.anzahlJahre)[0]!.historie
  return filterSegmentHistorie(best, 'geo') ?? best
}

function mapAusJahrEintraegen(jahre: SecSegmentJahrEintrag[]): Map<number, SecSegmentRoh[]> {
  return new Map(jahre.map((j) => [j.jahr, j.segmente]))
}

function mergeInKategorie(
  kategorieMaps: Map<string, Map<number, SecSegmentRoh[]>>,
  kategorieMeta: Map<string, Map<number, number>>,
  id: string,
  eintraege: SecSegmentJahrEintrag[],
  filingJahr?: number,
): void {
  let m = kategorieMaps.get(id)
  if (!m) {
    m = new Map()
    kategorieMaps.set(id, m)
  }
  let meta = kategorieMeta.get(id)
  if (!meta) {
    meta = new Map()
    kategorieMeta.set(id, meta)
  }
  mergeMehrjahresInMap(m, eintraege, filingJahr, meta)
}

function mergeEinzelInKategorie(
  kategorieMaps: Map<string, Map<number, SecSegmentRoh[]>>,
  kategorieMeta: Map<string, Map<number, number>>,
  id: string,
  jahr: number,
  segmente: SecSegmentRoh[],
  filingJahr: number,
): void {
  if (segmente.length < 2) return
  let m = kategorieMaps.get(id)
  if (!m) {
    m = new Map()
    kategorieMaps.set(id, m)
  }
  let meta = kategorieMeta.get(id)
  if (!meta) {
    meta = new Map()
    kategorieMeta.set(id, meta)
  }
  mergeJahrSmart(m, jahr, segmente, filingJahr, meta)
}

/** Produkt-Historie enthält fälschlich Regions-Segmentnamen (MA-Disaggregation). */
function historieEnthaeltGeoLeaks(hist: SecSegmentHistorie): boolean {
  for (const j of hist.jahre) {
    if (j.segmente.some((s) => segmentIstGeo(s.name))) return true
  }
  return false
}

/** Produkt- und Geo-Historie aus Disaggregation, Heuristik und Einzeljahr-Fallbacks ergänzen. */
function ergaenzeFehlendeProduktGeo(
  produkt: SecSegmentHistorie | null,
  geo: SecSegmentHistorie | null,
  kategorien: SecSegmentHistorieKategorie[],
  html10k: string,
  berichtJahr: number | null,
): { produkt: SecSegmentHistorie | null; geo: SecSegmentHistorie | null } {
  let p = produkt
  let g = geo

  const disagg = kategorien.find((k) => k.id === 'umsatz_detail')?.historie
  if (disagg) {
    const split = teileUmsatzDetailInProduktUndGeo(disagg.jahre)
    const splitProd = baueHistorie('produkt', mapAusJahrEintraegen(filterJahreNachArt(split.produkt, 'produkt')))
    const splitGeo = baueHistorie('geo', mapAusJahrEintraegen(filterJahreNachArt(split.geo, 'geo')))
    if (splitProd && (!p || splitProd.anzahlJahre >= p.anzahlJahre || historieEnthaeltGeoLeaks(p))) {
      p = splitProd
    }
    if (splitGeo && (!g || splitGeo.anzahlJahre >= g.anzahlJahre)) {
      g = splitGeo
    }
  }

  if (!p) {
    const fr = kategorien.find((k) => k.id === 'franchise_umsatz')
    if (fr && fr.historie.anzahlJahre >= 2) p = fr.historie
  }
  if (!p) p = waehleProduktHistorie(kategorien, berichtJahr)
  if (!g) g = waehleGeoHistorie(kategorien)

  if (html10k.length > 5_000) {
    const jahr = berichtJahr ?? new Date().getFullYear() - 1
    const hist = extrahiereSegmentHistorieAus10kHtml(html10k)
    if (!p && hist.produkt) {
      p = baueHistorie('produkt', mapAusJahrEintraegen(hist.produkt.jahre))
    }
    if (!g && hist.geo) {
      g = baueHistorie('geo', mapAusJahrEintraegen(hist.geo.jahre))
    }
    if (!p || !g) {
      const beide = extrahiereBeideSegmentartenAus10kHtml(html10k)
      if (!p && beide.produkt.segmente.length >= 2) {
        p = baueHistorie('produkt', new Map([[jahr, beide.produkt.segmente]]))
      }
      if (!g && beide.geo.segmente.length >= 2) {
        g = baueHistorie('geo', new Map([[jahr, beide.geo.segmente]]))
      }
    }
    if (!p || !g) {
      const ix = extrahiereUmsatzAusIxbrlDimensionen(html10k)
      if (!p && ix.produkt.length >= 2) {
        p = baueHistorie('produkt', mapAusJahrEintraegen(ix.produkt))
      }
      if (!g && ix.geo.length >= 2) {
        g = baueHistorie('geo', mapAusJahrEintraegen(ix.geo))
      }
    }
    if (!p || !g) {
      const narr = extrahiereNarrativeSegmentTabellen(html10k)
      if (!p && narr.produkt.length >= 2) {
        p = baueHistorie('produkt', mapAusJahrEintraegen(narr.produkt))
      }
      if (!g && narr.geo.length >= 2) {
        g = baueHistorie('geo', mapAusJahrEintraegen(narr.geo))
      }
    }
  }

  return { produkt: p, geo: g }
}

function extrahiereMitarbeiterAusText(text: string): number | null {
  const fenster = text.slice(0, 300_000)
  const patterns = [
    /approximately\s+([\d,]+)\s+(?:full[- ]time\s+)?employees/i,
    /had\s+([\d,]+)\s+employees/i,
    /employed\s+approximately\s+([\d,]+)\s+(?:people|employees)/i,
    /workforce\s+of\s+approximately\s+([\d,]+)/i,
    /([\d,]+)\s+employees\s+worldwide/i,
    /as of [^,]{0,30},?\s+we had\s+([\d,]+)\s+employees/i,
  ]
  for (const re of patterns) {
    const m = fenster.match(re)
    if (m?.[1]) {
      const n = parseInt(m[1].replace(/,/g, ''), 10)
      if (n >= 50 && n < 10_000_000) return n
    }
  }
  return null
}

function extrahiereKundenKonzentration(text: string): { name: string | null; anteilPct: number } | null {
  const fenster = text.slice(0, 400_000)
  let best: { name: string | null; anteilPct: number } | null = null

  const patterns: RegExp[] = [
    /(?:no|one|a single)\s+(?:individual\s+)?customer\s+(?:accounted\s+for|represented)\s+(?:more\s+than\s+)?(\d{1,2}(?:\.\d+)?)\s*%/i,
    /(\d{1,2}(?:\.\d+)?)\s*%\s+of\s+(?:our\s+)?(?:total\s+)?(?:net\s+)?revenu[e]?[^.]{0,50}(?:from|to|by)\s+(?:a\s+)?(?:single\s+)?customer/i,
    /largest\s+customer[^.]{0,40}(\d{1,2}(?:\.\d+)?)\s*%/i,
  ]
  for (const re of patterns) {
    const m = fenster.match(re)
    if (m?.[1]) {
      const pct = parseFloat(m[1])
      if (pct > 0 && pct <= 80) {
        best = { name: null, anteilPct: Math.round(pct * 10) / 10 }
        break
      }
    }
  }

  const named =
    /([A-Z][A-Za-z0-9&.\- ]{2,35}?)\s+(?:accounted\s+for|represented)\s+(?:approximately\s+)?(\d{1,2}(?:\.\d+)?)\s*%/i.exec(fenster)
  if (named?.[2]) {
    const name = named[1]?.trim().replace(/\s+/g, ' ') ?? null
    const pct = parseFloat(named[2])
    if (pct >= 5 && pct <= 80 && name && !/^(the|our|we|a|an|one|each)\b/i.test(name)) {
      if (!best || pct > best.anteilPct) best = { name, anteilPct: Math.round(pct * 10) / 10 }
    }
  }

  return best
}

export function extrahiereSecZusatzRisiko(text: string, html: string): SecZusatzRisikoFelder {
  const fenster = (text + '\n' + html.replace(/<[^>]+>/g, ' ')).slice(0, 500_000)

  const mitarbeiterAnzahl = extrahiereMitarbeiterAusText(text)

  let auslandsumsatzAnteilPct: number | null = null
  const foreignPatterns = [
    /(\d{1,3}(?:\.\d+)?)\s*%\s+of\s+(?:our\s+)?(?:total\s+)?(?:net\s+)?revenu[e]?[^.]{0,80}foreign/i,
    /foreign\s+countr(?:y|ies)[^.]{0,60}(\d{1,3}(?:\.\d+)?)\s*%/i,
    /(\d{1,3}(?:\.\d+)?)\s*%\s+of\s+total\s+revenu[e]?s?\s+(?:was|were)\s+(?:derived\s+from|from)\s+(?:sales\s+)?(?:in\s+)?(?:international|foreign|outside\s+the\s+u\.?s)/i,
    /international\s+operations[^.]{0,40}(\d{1,3}(?:\.\d+)?)\s*%\s+of/i,
    /(\d{1,3}(?:\.\d+)?)\s*%\s+of\s+(?:our\s+)?revenu[e]?s?\s+(?:was|were)\s+from\s+(?:customers|operations)\s+(?:outside|located\s+outside)/i,
  ]
  for (const re of foreignPatterns) {
    const m = fenster.match(re)
    if (m?.[1]) {
      const p = parseFloat(m[1])
      if (p > 0 && p <= 100) {
        auslandsumsatzAnteilPct = Math.round(p * 10) / 10
        break
      }
    }
  }

  const hauptkunden: SecZusatzRisikoFelder['hauptkunden'] = []
  const kundenRe =
    /([A-Z][A-Za-z0-9&.\- ]{2,40}?)\s+(?:accounted\s+for|represented)\s+(?:approximately\s+)?(\d{1,2}(?:\.\d+)?)\s*%/gi
  let km: RegExpExecArray | null
  const seenK = new Set<string>()
  while ((km = kundenRe.exec(fenster)) !== null && hauptkunden.length < 8) {
    const name = km[1]?.trim().replace(/\s+/g, ' ')
    const pct = parseFloat(km[2]!)
    if (!name || name.length < 3 || pct <= 0 || pct > 80) continue
    if (/^(the|our|we|a|an|one|each|no|all|this|that)\b/i.test(name)) continue
    const key = name.toLowerCase()
    if (seenK.has(key)) continue
    seenK.add(key)
    hauptkunden.push({ name, anteilPct: Math.round(pct * 10) / 10 })
  }

  const kundenRe2 =
    /(\d{1,2}(?:\.\d+)?)\s*%\s+of\s+(?:our\s+)?(?:total\s+)?(?:net\s+)?revenu[e]?[^.]{0,40}(?:from|to)\s+([A-Z][A-Za-z0-9&.\- ]{2,40})/gi
  while ((km = kundenRe2.exec(fenster)) !== null && hauptkunden.length < 8) {
    const pct = parseFloat(km[1]!)
    const name = km[2]?.trim().replace(/\s+/g, ' ')
    if (!name || pct <= 5 || pct > 80) continue
    const key = name.toLowerCase()
    if (seenK.has(key)) continue
    seenK.add(key)
    hauptkunden.push({ name, anteilPct: Math.round(pct * 10) / 10 })
  }

  return {
    mitarbeiterAnzahl,
    auslandsumsatzAnteilPct,
    hauptkunden: hauptkunden.sort((a, b) => b.anteilPct - a.anteilPct),
    mitarbeiterHistorie: [],
    kundenKonzentrationHistorie: [],
  }
}

function priorisiereNeuestesFiling(
  kategorieMaps: Map<string, Map<number, SecSegmentRoh[]>>,
  kategorieMeta: Map<string, Map<number, number>>,
  kategorieDefs: Map<string, SecDetailBlockDef>,
  html: string,
  filingJahr: number,
): void {
  if (html.length < 5_000 || filingJahr < 2010) return
  const details = extrahiereAlleDetailBloeckeAus10kHtml(html)
  for (const kat of details) {
    kategorieDefs.set(kat.def.id, kat.def)
    let map = kategorieMaps.get(kat.def.id)
    if (!map) {
      map = new Map()
      kategorieMaps.set(kat.def.id, map)
    }
    let meta = kategorieMeta.get(kat.def.id)
    if (!meta) {
      meta = new Map()
      kategorieMeta.set(kat.def.id, meta)
    }
    for (const j of kat.jahre) {
      mergeJahrSmart(map, j.jahr, j.segmente, filingJahr, meta, { erzwingen: j.jahr >= filingJahr - 2 })
    }
  }
}

export async function ladeSecSegmentHistorie(ticker: string): Promise<SecSegmentHistoriePaket | null> {
  const sym = ticker.trim().toUpperCase()
  if (!sym || sym.includes('.')) return null

  const hit = cache.get(sym)
  if (hit && hit.v === CACHE_VERSION && Date.now() - hit.at < CACHE_MS) return hit.data

  const cik = await cikFuerTicker(sym)
  if (!cik) {
    setMemoryCache(sym, null)
    return null
  }

  try {
    const [filings, kennzahlen, cloud] = await Promise.all([
      liste10kFilings(cik, MAX_10K_FILINGS),
      ladeSecCompanyFacts(cik),
      ladeSecSegmentHistorieAusCloud(sym),
    ])

    if (filings.length === 0 && !kennzahlen && !cloud?.paket) {
      setMemoryCache(sym, null)
      return null
    }

    const neuestesFiling = filings[0] ?? null
    const neuesteAccession = neuestesFiling?.accession ?? null
    const neuestesBerichtJahr = neuestesFiling ? jahrAusFiling(neuestesFiling) : null

    const cloudAktuell =
      cloud != null &&
      cloud.cacheVersion === CACHE_VERSION &&
      cloud.cik === cik &&
      cloud.paket != null

    if (cloudAktuell) {
      const neueFilings = filings.filter((f) => !cloud.roh.verarbeiteteAccessions.includes(f.accession))
      if (neueFilings.length === 0) {
        const paket = { ...cloud.paket, geladenAm: new Date().toISOString() }
        setMemoryCache(sym, paket)
        return paket
      }

      const zustand = rohZuArbeitszustand(cloud.roh)
      let html10k = ''
      let text10k = ''
      let berichtJahr = neuestesBerichtJahr
      let geladene10k = cloud.paket.anzahl10k

      for (let i = 0; i < neueFilings.length; i++) {
        const f = neueFilings[i]!
        await pause(PAUSE_MS)
        const hitDoc = await lade10kHtml(cik, f)
        if (!hitDoc) continue
        geladene10k++
        const { html, text } = hitDoc
        verarbeite10kInZustand(zustand, html, text, f)
        if (f.accession === neuesteAccession) {
          html10k = html
          text10k = text
          berichtJahr = jahrAusFiling(f)
        }
      }

      if (!html10k && neuestesFiling && cloud.neuesteAccession === neuesteAccession) {
        const hitDoc = await lade10kHtml(cik, neuestesFiling)
        if (hitDoc) {
          html10k = hitDoc.html
          text10k = hitDoc.text
          berichtJahr = jahrAusFiling(neuestesFiling)
        }
      }

      const paket = await bauePaketAusZustand(
        sym,
        cik,
        zustand,
        html10k,
        text10k,
        berichtJahr,
        geladene10k,
        kennzahlen,
      )
      if (paket) {
        await speichereInCloud(sym, cik, zustand, paket, neuesteAccession, neuestesBerichtJahr)
      }
      setMemoryCache(sym, paket)
      return paket
    }

    const zustand = leererArbeitszustand()
    let geladene10k = 0
    let html10k = ''
    let text10k = ''
    let berichtJahr: number | null = null

    for (let i = 0; i < filings.length; i++) {
      const f = filings[i]!
      if (i > 0) await pause(PAUSE_MS)
      const hitDoc = await lade10kHtml(cik, f)
      if (!hitDoc) continue
      geladene10k++
      const { html, text } = hitDoc
      if (i === 0) {
        html10k = html
        text10k = text
        berichtJahr = jahrAusFiling(f)
      }
      verarbeite10kInZustand(zustand, html, text, f)
    }

    const paket = await bauePaketAusZustand(
      sym,
      cik,
      zustand,
      html10k,
      text10k,
      berichtJahr,
      geladene10k,
      kennzahlen,
    )

    if (paket) {
      await speichereInCloud(sym, cik, zustand, paket, neuesteAccession, neuestesBerichtJahr)
    }
    setMemoryCache(sym, paket)
    return paket
  } catch {
    setMemoryCache(sym, null)
    return null
  }
}
