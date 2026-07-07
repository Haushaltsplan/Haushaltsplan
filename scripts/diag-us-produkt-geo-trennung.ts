/**
 * Offline: Produkt/Geo-Trennung für US-Whitelist (ohne server-only).
 * npx tsx scripts/diag-us-produkt-geo-trennung.ts
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
  filterJahreNachArt,
  filterSegmentHistorie,
  parseGeoSegmente,
  segmentIstGeo,
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

function baueHistorie(art: 'produkt' | 'geo', jahre: SecSegmentJahrEintrag[]): SecSegmentHistorie | null {
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

function mapAusRecords(m: Map<number, SecSegmentRoh[]>): SecSegmentJahrEintrag[] {
  return [...m.entries()].sort((a, b) => a[0] - b[0]).map(([jahr, segmente]) => ({ jahr, segmente }))
}

function waehleProdukt(
  kategorieMaps: Map<string, Map<number, SecSegmentRoh[]>>,
  berichtJahr: number,
): SecSegmentHistorie | null {
  for (const id of PRODUKT_IDS) {
    const m = kategorieMaps.get(id)
    if (!m || m.size < 2) continue
    const jahre = mapAusRecords(m)
    if (id === 'umsatz_detail' || id === 'franchise_umsatz') {
      const split = teileUmsatzDetailInProduktUndGeo(jahre)
      const prod = baueHistorie('produkt', filterJahreNachArt(split.produkt, 'produkt'))
      if (prod) return prod
    }
    const hist = baueHistorie('produkt', jahre)
    const clean = filterSegmentHistorie(hist, 'produkt')
    if (clean) return clean
  }
  return null
}

function waehleGeo(kategorieMaps: Map<string, Map<number, SecSegmentRoh[]>>): SecSegmentHistorie | null {
  for (const id of GEO_IDS) {
    const m = kategorieMaps.get(id)
    if (!m || m.size < 2) continue
    const hist = baueHistorie('geo', mapAusRecords(m))
    const clean = filterSegmentHistorie(hist, 'geo')
    if (clean) return clean
  }
  const disagg = kategorieMaps.get('umsatz_detail')
  if (disagg && disagg.size >= 2) {
    const split = teileUmsatzDetailInProduktUndGeo(mapAusRecords(disagg))
    const geo = baueHistorie('geo', filterJahreNachArt(split.geo, 'geo'))
    if (geo) return geo
  }
  return null
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

  const kategorieMaps = new Map<string, Map<number, SecSegmentRoh[]>>()
  const kategorieMeta = new Map<string, Map<number, number>>()
  const narrativeGeoProJahr = new Map<number, { usPct: number; intlPct: number }>()
  let htmlNeu = ''
  let berichtJahr = 0
  const umsatzProJahr = new Map<number, number>()

  for (const fil of filings) {
    const html = await pickHtml(cik, fil.acc, fil.doc)
    if (html.length < 5000) continue
    const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')
    const reportJahr = parseInt(fil.report, 10) || 0
    const narrPct = extrahiereNarrativeGeoProzent(text)
    if (narrPct && reportJahr > 2000) narrativeGeoProJahr.set(reportJahr, narrPct)
    for (const [jahr, pct] of extrahiereDomesticForeignEinkommenSplit(html)) {
      if (!narrativeGeoProJahr.has(jahr)) narrativeGeoProJahr.set(jahr, pct)
    }
    if (!htmlNeu) {
      htmlNeu = html
      berichtJahr = reportJahr
    }
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

  let produkt = waehleProdukt(kategorieMaps, berichtJahr)
  let geo = waehleGeo(kategorieMaps)

  if (htmlNeu) {
    const hist = extrahiereSegmentHistorieAus10kHtml(htmlNeu)
    if (!produkt && hist.produkt) {
      produkt = filterSegmentHistorie(
        baueHistorie('produkt', filterJahreNachArt(hist.produkt.jahre, 'produkt')),
        'produkt',
      )
    }
    if (!geo && hist.geo) {
      geo = filterSegmentHistorie(
        baueHistorie('geo', filterJahreNachArt(hist.geo.jahre, 'geo')),
        'geo',
      )
    }
    const disagg = kategorieMaps.get('umsatz_detail')
    if (disagg) {
      const split = teileUmsatzDetailInProduktUndGeo(mapAusRecords(disagg))
      const splitP = baueHistorie('produkt', filterJahreNachArt(split.produkt, 'produkt'))
      const splitG = baueHistorie('geo', filterJahreNachArt(split.geo, 'geo'))
      if (splitP && (!produkt || produkt.jahre.some((j) => j.segmente.some((s) => segmentIstGeo(s.name))))) {
        produkt = splitP
      }
      if (splitG && (!geo || (splitG.anzahlJahre >= geo.anzahlJahre))) geo = splitG
    }
  }

  produkt = filterSegmentHistorie(produkt, 'produkt')
  geo = filterSegmentHistorie(geo, 'geo')

  if (!geo && narrativeGeoProJahr.size >= 2) {
    for (const [id, m] of kategorieMaps) {
      if (!/umsatz_detail|segment_reporting|produkte_services/.test(id)) continue
      for (const [jahr, seg] of m) {
        const sum = seg.reduce((s, x) => s + (x.umsatzMio ?? 0), 0)
        if (sum > 0) umsatzProJahr.set(jahr, Math.max(umsatzProJahr.get(jahr) ?? 0, sum))
      }
    }
    const nar = baueNarrativeGeoHistorie(narrativeGeoProJahr, umsatzProJahr)
    geo = filterSegmentHistorie(baueHistorie('geo', nar), 'geo')
  }

  return { sym, produkt, geo }
}

function geoLeaks(produkt: SecSegmentHistorie | null): string[] {
  if (!produkt) return ['kein Produkt']
  const leaks: string[] = []
  for (const j of produkt.jahre) {
    for (const s of j.segmente) {
      if (segmentIstGeo(s.name)) leaks.push(`${j.jahr}:${s.name}`)
    }
  }
  return leaks
}

function prodLeaks(geo: SecSegmentHistorie | null): string[] {
  if (!geo) return ['keine Region']
  const leaks: string[] = []
  for (const j of geo.jahre) {
    for (const s of j.segmente) {
      const n = s.name.trim()
      if (segmentIstGeo(n) || /^(commercial|personal)$/i.test(n)) continue
      leaks.push(`${j.jahr}:${s.name}`)
    }
  }
  return leaks
}

async function main() {
  const only = process.argv.slice(2).map((s) => s.toUpperCase())
  const us = NACHKAUF_RADAR_WHITELIST.filter((p) => p.cik)
  const ok: string[] = []
  const fehler: string[] = []

  for (const pos of us) {
    const sym = ISIN_KENNTNISSE[pos.isin]?.symbolYahoo?.split('.')[0]?.toUpperCase()
    if (!sym || !pos.cik) continue
    if (only.length > 0 && !only.includes(sym)) continue
    try {
      const r = await ladeBeide(sym, pos.cik.replace(/^0+/, '').padStart(10, '0'))
      const gLeaks = geoLeaks(r.produkt)
      const pLeaks = prodLeaks(r.geo)
      const prodJ = r.produkt?.anzahlJahre ?? 0
      const geoJ = r.geo?.anzahlJahre ?? 0
      const hatGeoLeak = gLeaks.some((l) => !l.startsWith('kein'))
      const hatProdLeak = pLeaks.some((l) => !l.startsWith('keine'))
      const unvoll = prodJ < 2 || geoJ < 2

      if (!hatGeoLeak && !hatProdLeak && !unvoll) {
        ok.push(
          `${sym.padEnd(6)} P${prodJ}J [${r.produkt!.segmentNamen.slice(0, 4).join(', ')}…] G${geoJ}J`,
        )
      } else {
        fehler.push(
          `${sym}: P${prodJ}/G${geoJ}${hatGeoLeak ? ` | Geo→Prod: ${gLeaks.slice(0, 4).join('; ')}` : ''}${hatProdLeak ? ` | Prod→Geo: ${pLeaks.slice(0, 4).join('; ')}` : ''}\n    Produkt: ${r.produkt?.segmentNamen.join(' | ') ?? '—'}\n    Geo: ${r.geo?.segmentNamen.join(' | ') ?? '—'}`,
        )
      }
    } catch (e) {
      fehler.push(`${sym}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  console.log(`\n✅ ${ok.length}/${us.length} sauber getrennt:\n`)
  ok.forEach((l) => console.log(' ', l))
  if (fehler.length) {
    console.log(`\n⚠️ ${fehler.length} Probleme:\n`)
    fehler.forEach((l) => console.log(' ', l))
    process.exit(1)
  }
}

main().catch(console.error)
