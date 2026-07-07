/**
 * Batch: Segment-Namen + Jahreslücken nach Normalisierung.
 * npx tsx scripts/diag-segment-normalisierung-batch.ts
 */
import { NACHKAUF_RADAR_WHITELIST } from '../lib/portfolio-analyse/nachkauf-radar/nachkauf-radar-whitelist'
import { ISIN_KENNTNISSE } from '../lib/portfolio-analyse/isin-kenntnisse'
import {
  extrahiereAlleDetailBloeckeAus10kHtml,
  mergeDetailInMap,
} from '../lib/portfolio-analyse/sec-edgar-detail-extraktion.ts'
import {
  extrahiereBeideSegmentartenAus10kHtml,
  extrahiereErstenGeoBlock,
  extrahiereSegmenteFuerJahr,
  extrahiereSegmentHistorieAus10kHtml,
  filterJahreNachArt,
  parseGeoSegmente,
  teileUmsatzDetailInProduktUndGeo,
  validiereSegmente,
  type SecSegmentHistorie,
  type SecSegmentJahrEintrag,
  type SecSegmentRoh,
} from '../lib/portfolio-analyse/sec-edgar-segment-extraktion.ts'
import { extrahiereUmsatzAusIxbrlDimensionen } from '../lib/portfolio-analyse/sec-edgar-ixbrl-dimensionen.ts'
import { extrahiereNarrativeSegmentTabellen } from '../lib/portfolio-analyse/sec-edgar-narrative-tabellen.ts'
import {
  baueNarrativeGeoHistorie,
  extrahiereDomesticForeignEinkommenSplit,
  extrahiereNarrativeGeoProzent,
} from '../lib/portfolio-analyse/sec-edgar-narrative-geo-server.ts'
import {
  ergaenzeJahresluecken,
  interpoliereJahresluecken,
  vereinheitlicheSegmentHistorie,
} from '../lib/portfolio-analyse/sec-edgar-segment-normalisierung.ts'

const UA = process.env.SEC_EDGAR_USER_AGENT || 'Omnia Haushalt test@example.com'
const MAX_FILINGS = 12

async function secFetch(url: string) {
  await new Promise((r) => setTimeout(r, 350))
  return fetch(url, { headers: { 'User-Agent': UA }, cache: 'no-store' })
}

async function pickHtml(cik: number, acc: string, primary: string): Promise<string> {
  const accPath = acc.replace(/-/g, '')
  const base = `https://www.sec.gov/Archives/edgar/data/${cik}/${accPath}/`
  let pick = primary
  try {
    const idx = await (await secFetch(`${base}${acc}-index.json`)).json()
    const sorted = (idx.directory?.item ?? [])
      .filter((i: { name: string }) => /\.htm/i.test(i.name) && !/index/i.test(i.name))
      .sort((a: { size: string }, b: { size: string }) => parseInt(b.size || '0') - parseInt(a.size || '0'))
    if (sorted[0]?.name) pick = sorted[0].name
  } catch { /* */ }
  return await (await secFetch(`${base}${pick}`)).text()
}

function baueHistorie(art: SecSegmentHistorie['art'], jahre: SecSegmentJahrEintrag[]): SecSegmentHistorie | null {
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

function jahresluecken(hist: SecSegmentHistorie | null): number[] {
  if (!hist || hist.jahre.length < 2) return []
  const jahre = hist.jahre.map((j) => j.jahr).sort((a, b) => a - b)
  const luecken: number[] = []
  for (let y = jahre[0]!; y <= jahre[jahre.length - 1]!; y++) {
    if (!jahre.includes(y)) luecken.push(y)
  }
  return luecken
}

// Minimal mirror of server pipeline (offline)
async function ladePaket(sym: string, cikStr: string) {
  const cik = parseInt(cikStr, 10)
  const sub = await (await secFetch(`https://data.sec.gov/submissions/CIK${cikStr.padStart(10, '0')}.json`)).json()
  const f = sub.filings.recent
  const filings: { acc: string; doc: string; report: string }[] = []
  for (let i = 0; i < f.form.length && filings.length < MAX_FILINGS; i++) {
    if (f.form[i] !== '10-K') continue
    filings.push({ acc: f.accessionNumber[i], doc: f.primaryDocument[i], report: f.reportDate?.[i]?.slice(0, 4) ?? '0' })
  }

  const kategorieMaps = new Map<string, Map<number, SecSegmentRoh[]>>()
  const kategorieMeta = new Map<string, Map<number, number>>()
  const narrativeGeoProJahr = new Map<number, { usPct: number; intlPct: number }>()

  for (const fil of filings) {
    const html = await pickHtml(cik, fil.acc, fil.doc)
    if (html.length < 5000) continue
    const text = html.replace(/<[^>]+>/g, ' ')
    const reportJahr = parseInt(fil.report, 10) || 0
    const narrPct = extrahiereNarrativeGeoProzent(text)
    if (narrPct && reportJahr > 2000) narrativeGeoProJahr.set(reportJahr, narrPct)
    for (const [jahr, pct] of extrahiereDomesticForeignEinkommenSplit(html)) {
      if (!narrativeGeoProJahr.has(jahr)) narrativeGeoProJahr.set(jahr, pct)
    }
    for (const kat of extrahiereAlleDetailBloeckeAus10kHtml(html)) {
      mergeDetailInMap(kategorieMaps as never, kat, reportJahr, kategorieMeta as never)
    }
    const hist = extrahiereSegmentHistorieAus10kHtml(html)
    for (const j of hist.produkt?.jahre ?? []) {
      const m = kategorieMaps.get('segment_reporting') ?? new Map()
      kategorieMaps.set('segment_reporting', m)
      m.set(j.jahr, j.segmente)
    }
    for (const j of hist.geo?.jahre ?? []) {
      const m = kategorieMaps.get('geo_umsatz') ?? new Map()
      kategorieMaps.set('geo_umsatz', m)
      m.set(j.jahr, j.segmente)
    }
    if (reportJahr > 2000) {
      const einzel = extrahiereSegmenteFuerJahr(html, reportJahr)
      if (einzel.produkt.length >= 2) {
        const m = kategorieMaps.get('segment_reporting') ?? new Map()
        kategorieMaps.set('segment_reporting', m)
        m.set(reportJahr, einzel.produkt)
      }
      const geoBlock = extrahiereErstenGeoBlock(html)
      if (geoBlock.length > 200) {
        const geoSpalte = validiereSegmente(parseGeoSegmente(geoBlock, true))
        if (geoSpalte.length >= 2) {
          const m = kategorieMaps.get('geo_umsatz') ?? new Map()
          kategorieMaps.set('geo_umsatz', m)
          m.set(reportJahr, geoSpalte)
        }
      }
      const beide = extrahiereBeideSegmentartenAus10kHtml(html)
      if (beide.produkt.segmente.length >= 2) {
        const m = kategorieMaps.get('segment_reporting') ?? new Map()
        kategorieMaps.set('segment_reporting', m)
        m.set(reportJahr, beide.produkt.segmente)
      }
      if (beide.geo.segmente.length >= 2) {
        const m = kategorieMaps.get('geo_umsatz') ?? new Map()
        kategorieMaps.set('geo_umsatz', m)
        m.set(reportJahr, beide.geo.segmente)
      }
      const ixDim = extrahiereUmsatzAusIxbrlDimensionen(html)
      for (const j of ixDim.produkt) {
        const m = kategorieMaps.get('segment_reporting') ?? new Map()
        kategorieMaps.set('segment_reporting', m)
        m.set(j.jahr, j.segmente)
      }
      for (const j of ixDim.geo) {
        const m = kategorieMaps.get('geo_umsatz') ?? new Map()
        kategorieMaps.set('geo_umsatz', m)
        m.set(j.jahr, j.segmente)
      }
      const narr = extrahiereNarrativeSegmentTabellen(html)
      for (const j of narr.produkt) {
        const m = kategorieMaps.get('umsatz_detail') ?? new Map()
        kategorieMaps.set('umsatz_detail', m)
        m.set(j.jahr, j.segmente)
      }
      for (const j of narr.geo) {
        const m = kategorieMaps.get('geo_umsatz') ?? new Map()
        kategorieMaps.set('geo_umsatz', m)
        m.set(j.jahr, j.segmente)
      }
    }
  }

  const produktQuellen: SecSegmentJahrEintrag[][] = []
  const geoQuellen: SecSegmentJahrEintrag[][] = []
  for (const [id, m] of kategorieMaps) {
    const jahre = [...m.entries()].sort((a, b) => a[0] - b[0]).map(([jahr, segmente]) => ({ jahr, segmente }))
    if (id === 'umsatz_detail' || id === 'franchise_umsatz') {
      const split = teileUmsatzDetailInProduktUndGeo(jahre)
      produktQuellen.push(filterJahreNachArt(split.produkt, 'produkt'))
      geoQuellen.push(filterJahreNachArt(split.geo, 'geo'))
    } else if (id.includes('geo')) {
      geoQuellen.push(filterJahreNachArt(jahre, 'geo'))
    } else {
      produktQuellen.push(filterJahreNachArt(jahre, 'produkt'))
    }
  }

  let produkt = vereinheitlicheSegmentHistorie(
    interpoliereJahresluecken(
      ergaenzeJahresluecken(
        produktQuellen.reduce<SecSegmentHistorie | null>((best, q) => {
          const h = baueHistorie('produkt', q)
          if (!h) return best
          if (!best || h.anzahlJahre > best.anzahlJahre) return h
          return best
        }, null),
        produktQuellen.filter((q) => q.length > 0),
      ),
    ),
  )
  let geo = vereinheitlicheSegmentHistorie(
    interpoliereJahresluecken(
      ergaenzeJahresluecken(
        geoQuellen.reduce<SecSegmentHistorie | null>((best, q) => {
          const h = baueHistorie('geo', q)
          if (!h) return best
          if (!best || h.anzahlJahre > best.anzahlJahre) return h
          return best
        }, null),
        geoQuellen,
      ),
    ),
  )

  if (!geo && narrativeGeoProJahr.size >= 2) {
    const umsatz = new Map<number, number>()
    for (const [id, m] of kategorieMaps) {
      for (const [jahr, seg] of m) {
        const sum = seg.reduce((s, x) => s + (x.umsatzMio ?? 0), 0)
        if (sum > 0) umsatz.set(jahr, Math.max(umsatz.get(jahr) ?? 0, sum))
      }
    }
    const nar = baueNarrativeGeoHistorie(narrativeGeoProJahr, umsatz)
    geo = interpoliereJahresluecken(ergaenzeJahresluecken(baueHistorie('geo', nar), []))
  }

  const vorProdNamen = new Set(produktQuellen.flat().flatMap((j) => j.segmente.map((s) => s.name)))
  const nachProdNamen = produkt?.segmentNamen.length ?? 0

  return {
    sym,
    produkt,
    geo,
    prodLuecken: jahresluecken(produkt),
    geoLuecken: jahresluecken(geo),
    namenVor: vorProdNamen.size,
    namenNach: nachProdNamen,
  }
}

async function main() {
  const us = NACHKAUF_RADAR_WHITELIST.filter((p) => p.cik)
  const fehler: string[] = []
  const ok: string[] = []

  for (const pos of us) {
    const sym = ISIN_KENNTNISSE[pos.isin]?.symbolYahoo?.split('.')[0]?.toUpperCase()
    if (!sym || !pos.cik) continue
    try {
      const r = await ladePaket(sym, pos.cik.replace(/^0+/, '').padStart(10, '0'))
      const pJ = r.produkt?.anzahlJahre ?? 0
      const gJ = r.geo?.anzahlJahre ?? 0
      const prodL = r.prodLuecken.length
      const geoL = r.geoLuecken.length
      const line = `${sym.padEnd(6)} P${pJ}J G${gJ}J | Namen ${r.namenVor}→${r.namenNach} | Lücken P${prodL} G${geoL}`
      if (pJ >= 2 && gJ >= 2 && prodL <= 2 && geoL <= 2) ok.push(line)
      else fehler.push(line + (prodL > 2 ? ` [Prod-Lücken: ${r.prodLuecken.join(',')}]` : '') + (geoL > 2 ? ` [Geo-Lücken: ${r.geoLuecken.join(',')}]` : ''))
    } catch (e) {
      fehler.push(`${sym}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  console.log(`\n✅ ${ok.length}/${us.length} OK (≤2 Jahreslücken, Namen reduziert):\n`)
  ok.forEach((l) => console.log(' ', l))
  if (fehler.length) {
    console.log(`\n⚠️ ${fehler.length}:\n`)
    fehler.forEach((l) => console.log(' ', l))
  }
}

main().catch(console.error)
