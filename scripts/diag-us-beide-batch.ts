/**
 * Batch: Produkt- UND Geo-Umsatz für alle US-Whitelist-Titel.
 * npx tsx scripts/diag-us-beide-batch.ts
 */
import {
  extrahiereAlleDetailBloeckeAus10kHtml,
  mergeDetailInMap,
} from '../lib/portfolio-analyse/sec-edgar-detail-extraktion.ts'
import {
  extrahiereBeideSegmentartenAus10kHtml,
  extrahiereErstenGeoBlock,
  extrahiereSegmenteFuerJahr,
  extrahiereSegmentHistorieAus10kHtml,
  parseGeoSegmente,
  teileUmsatzDetailInProduktUndGeo,
  validiereSegmente,
} from '../lib/portfolio-analyse/sec-edgar-segment-extraktion.ts'
import { extrahiereUmsatzAusIxbrlDimensionen } from '../lib/portfolio-analyse/sec-edgar-ixbrl-dimensionen.ts'
import { extrahiereNarrativeSegmentTabellen } from '../lib/portfolio-analyse/sec-edgar-narrative-tabellen.ts'
import { NACHKAUF_RADAR_WHITELIST } from '../lib/portfolio-analyse/nachkauf-radar/nachkauf-radar-whitelist'
import { ISIN_KENNTNISSE } from '../lib/portfolio-analyse/isin-kenntnisse'

const UA = process.env.SEC_EDGAR_USER_AGENT || 'Omnia Haushalt test@example.com'
const MAX_FILINGS = 12
const PRODUKT_IDS = ['umsatz_detail', 'segment_reporting', 'franchise_umsatz', 'produkte_services'] as const
const GEO_IDS = ['geo_umsatz', 'geo_kombiniert', 'revenues_geo_alt'] as const

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

function jahreAusMap(m: Map<number, unknown[]> | undefined): number {
  return m?.size ?? 0
}

function maxJahr(m: Map<number, unknown[]> | undefined): number {
  if (!m || m.size === 0) return 0
  return Math.max(...m.keys())
}

async function ladeBeide(sym: string, cikStr: string) {
  const cik = parseInt(cikStr, 10)
  const sub = await (await secFetch(`https://data.sec.gov/submissions/CIK${cikStr.padStart(10, '0')}.json`)).json()
  const f = sub.filings.recent
  const filings: { acc: string; doc: string; report: string }[] = []
  for (let i = 0; i < f.form.length && filings.length < MAX_FILINGS; i++) {
    if (f.form[i] !== '10-K') continue
    filings.push({
      acc: f.accessionNumber[i],
      doc: f.primaryDocument[i],
      report: f.reportDate?.[i]?.slice(0, 4) ?? '0',
    })
  }

  const kategorieMaps = new Map<string, Map<number, unknown[]>>()
  const kategorieMeta = new Map<string, Map<number, number>>()
  let htmlNeu = ''

  for (const fil of filings) {
    const html = await pickHtml(cik, fil.acc, fil.doc)
    if (html.length < 5000) continue
    if (!htmlNeu) htmlNeu = html
    const reportJahr = parseInt(fil.report, 10) || 0
    for (const kat of extrahiereAlleDetailBloeckeAus10kHtml(html)) {
      mergeDetailInMap(kategorieMaps as never, kat, reportJahr, kategorieMeta as never)
    }
    const hist = extrahiereSegmentHistorieAus10kHtml(html)
    if (hist.produkt) {
      for (const j of hist.produkt.jahre) {
        const m = kategorieMaps.get('segment_reporting') ?? new Map()
        kategorieMaps.set('segment_reporting', m)
        m.set(j.jahr, j.segmente)
      }
    }
    if (hist.geo) {
      for (const j of hist.geo.jahre) {
        const m = kategorieMaps.get('geo_umsatz') ?? new Map()
        kategorieMaps.set('geo_umsatz', m)
        m.set(j.jahr, j.segmente)
      }
    }
    if (reportJahr > 2000) {
      const einzel = extrahiereSegmenteFuerJahr(html, reportJahr)
      if (einzel.produkt.length >= 2) {
        const m = kategorieMaps.get('segment_reporting') ?? new Map()
        kategorieMaps.set('segment_reporting', m)
        m.set(reportJahr, einzel.produkt)
      }
      if (einzel.geo.length >= 2) {
        const m = kategorieMaps.get('geo_umsatz') ?? new Map()
        kategorieMaps.set('geo_umsatz', m)
        m.set(reportJahr, einzel.geo)
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

  let prodJ = 0
  let prodMax = 0
  for (const id of PRODUKT_IDS) {
    const n = jahreAusMap(kategorieMaps.get(id))
    if (n > prodJ) {
      prodJ = n
      prodMax = maxJahr(kategorieMaps.get(id))
    }
  }

  let geoJ = 0
  let geoMax = 0
  for (const id of GEO_IDS) {
    const n = jahreAusMap(kategorieMaps.get(id))
    if (n > geoJ) {
      geoJ = n
      geoMax = maxJahr(kategorieMaps.get(id))
    }
  }

  const disagg = kategorieMaps.get('umsatz_detail')
  if (disagg && (prodJ < 2 || geoJ < 2)) {
    const jahre = [...disagg.entries()].sort((a, b) => a[0] - b[0]).map(([jahr, segmente]) => ({
      jahr,
      segmente: segmente as never,
    }))
    const split = teileUmsatzDetailInProduktUndGeo(jahre)
    if (prodJ < 2 && split.produkt.length >= 2) prodJ = split.produkt.length
    if (geoJ < 2 && split.geo.length >= 2) geoJ = split.geo.length
  }

  if (htmlNeu && (prodJ < 2 || geoJ < 2)) {
    const hist = extrahiereSegmentHistorieAus10kHtml(htmlNeu)
    if (prodJ < 2 && hist.produkt && hist.produkt.jahre.length >= 2) prodJ = hist.produkt.jahre.length
    if (geoJ < 2 && hist.geo && hist.geo.jahre.length >= 2) geoJ = hist.geo.jahre.length
    const beide = extrahiereBeideSegmentartenAus10kHtml(htmlNeu)
    if (prodJ < 2 && beide.produkt.segmente.length >= 2) prodJ = 2
    if (geoJ < 2 && beide.geo.segmente.length >= 2) geoJ = 2
    const ix = extrahiereUmsatzAusIxbrlDimensionen(htmlNeu)
    if (prodJ < 2 && ix.produkt.length >= 2) prodJ = ix.produkt.length
    if (geoJ < 2 && ix.geo.length >= 2) geoJ = ix.geo.length
    const narr = extrahiereNarrativeSegmentTabellen(htmlNeu)
    if (prodJ < 2 && narr.produkt.length >= 2) prodJ = narr.produkt.length
    if (geoJ < 2 && narr.geo.length >= 2) geoJ = narr.geo.length
  }

  return { sym, prodJ, geoJ, prodMax, geoMax }
}

async function main() {
  const us = NACHKAUF_RADAR_WHITELIST.filter((p) => p.cik)
  const ok: string[] = []
  const fehlt: string[] = []

  for (const pos of us) {
    const sym = ISIN_KENNTNISSE[pos.isin]?.symbolYahoo?.split('.')[0]?.toUpperCase()
    if (!sym || !pos.cik) continue
    try {
      const r = await ladeBeide(sym, pos.cik.replace(/^0+/, '').padStart(10, '0'))
      const line = `${r.sym.padEnd(6)} Produkt ${r.prodJ}J  Geo ${r.geoJ}J`
      if (r.prodJ >= 2 && r.geoJ >= 2) ok.push(line)
      else {
        const parts: string[] = []
        if (r.prodJ < 2) parts.push('kein Produkt')
        if (r.geoJ < 2) parts.push('keine Region')
        fehlt.push(`${line}  ⚠️ ${parts.join(' + ')}`)
      }
    } catch (e) {
      fehlt.push(`${sym}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  console.log(`\n✅ ${ok.length}/${us.length} mit Produkt UND Region (≥2J):\n`)
  ok.forEach((l) => console.log(' ', l))
  if (fehlt.length) {
    console.log(`\n⚠️ ${fehlt.length} unvollständig:\n`)
    fehlt.forEach((l) => console.log(' ', l))
  }
}

main().catch(console.error)
