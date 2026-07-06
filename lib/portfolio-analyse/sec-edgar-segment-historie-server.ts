/** SEC 10-K — Geo-/Produktsegment-Historie + Zusatz-Risikofelder (10+ Jahre). */

import 'server-only'

import type {
  SecSegmentHistorie,
  SecSegmentHistoriePaket,
  SecZusatzRisikoFelder,
} from '@/lib/portfolio-analyse/fundamentaldaten-erweitert-types'
import { leseAlsJson } from '@/lib/http/safe-json-response'
import { ladeLesbarenBerichtText } from '@/lib/portfolio-analyse/sec-edgar-bericht-text-server'
import { ladeSecCompanyFacts } from '@/lib/portfolio-analyse/sec-edgar-companyfacts-server'
import {
  cikFuerTicker,
  padCik,
  secFetch,
  type SecSubmissionsRecent,
} from '@/lib/portfolio-analyse/sec-edgar-common-server'
import {
  extrahiereBeideSegmentartenAus10kHtml,
  extrahiereSegmentHistorieAus10kHtml,
  extrahiereSegmenteFuerJahr,
  type SecSegmentJahrEintrag,
  type SecSegmentRoh,
} from '@/lib/portfolio-analyse/sec-edgar-segment-extraktion'

const CACHE_MS = 24 * 60 * 60 * 1000
/** Ziel: mindestens 12 Geschäftsjahre Segmentdaten. */
const ZIEL_JAHRE = 12
/** Max. 10-K-Filings laden (je ~3 Jahre pro Filing → 12+ Jahre). */
const MAX_10K_FILINGS = 14
const PAUSE_MS = 350

const cache = new Map<string, { at: number; data: SecSegmentHistoriePaket | null }>()

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

function mergeJahrEintrag(
  map: Map<number, SecSegmentRoh[]>,
  jahr: number,
  segmente: SecSegmentRoh[],
): void {
  if (segmente.length < 2 || map.has(jahr)) return
  map.set(jahr, segmente.map((s) => ({ ...s })))
}

function baueHistorie(
  art: 'produkt' | 'geo',
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

function mergeMehrjahresInMap(
  map: Map<number, SecSegmentRoh[]>,
  eintraege: SecSegmentJahrEintrag[],
): void {
  for (const e of eintraege) {
    mergeJahrEintrag(map, e.jahr, e.segmente)
  }
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

function mergeZusatzHistorie(
  basis: SecZusatzRisikoFelder,
  proFiling: { jahr: number; text: string }[],
): SecZusatzRisikoFelder {
  const maMap = new Map<number, number>()
  const kundenMap = new Map<number, { anteilPct: number; name: string | null }>()

  for (const { jahr, text } of proFiling) {
    const ma = extrahiereMitarbeiterAusText(text)
    if (ma != null && !maMap.has(jahr)) maMap.set(jahr, ma)
    const k = extrahiereKundenKonzentration(text)
    if (k != null && !kundenMap.has(jahr)) kundenMap.set(jahr, k)
  }

  return {
    ...basis,
    mitarbeiterHistorie: [...maMap.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([jahr, anzahl]) => ({ jahr, anzahl })),
    kundenKonzentrationHistorie: [...kundenMap.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([jahr, k]) => ({ jahr, anteilPct: k.anteilPct, name: k.name })),
  }
}

export async function ladeSecSegmentHistorie(ticker: string): Promise<SecSegmentHistoriePaket | null> {
  const sym = ticker.trim().toUpperCase()
  if (!sym || sym.includes('.')) return null

  const hit = cache.get(sym)
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.data

  const cik = await cikFuerTicker(sym)
  if (!cik) {
    cache.set(sym, { at: Date.now(), data: null })
    return null
  }

  try {
    const [filings, kennzahlen] = await Promise.all([
      liste10kFilings(cik, MAX_10K_FILINGS),
      ladeSecCompanyFacts(cik),
    ])

    if (filings.length === 0 && !kennzahlen) {
      cache.set(sym, { at: Date.now(), data: null })
      return null
    }

    const produktMap = new Map<number, SecSegmentRoh[]>()
    const geoMap = new Map<number, SecSegmentRoh[]>()
    const textProFiling: { jahr: number; text: string }[] = []
    let geladene10k = 0
    let text10k = ''
    let html10k = ''
    let berichtJahr: number | null = null

    for (let i = 0; i < filings.length; i++) {
      const f = filings[i]!
      const jahreBisher = Math.max(produktMap.size, geoMap.size)
      if (jahreBisher >= ZIEL_JAHRE) break
      if (i > 0) await pause(PAUSE_MS)

      const hitDoc = await lade10kHtml(cik, f)
      if (!hitDoc) continue
      geladene10k++

      const { html, text } = hitDoc
      const jahr = jahrAusFiling(f)
      if (jahr != null && text.length > 1_000) textProFiling.push({ jahr, text })

      if (i === 0) {
        html10k = html
        text10k = text
        berichtJahr = jahr
      }

      if (html.length > 5_000) {
        const hist = extrahiereSegmentHistorieAus10kHtml(html)
        if (hist.produkt) mergeMehrjahresInMap(produktMap, hist.produkt.jahre)
        if (hist.geo) mergeMehrjahresInMap(geoMap, hist.geo.jahre)

        if (jahr != null) {
          const einzel = extrahiereSegmenteFuerJahr(html, jahr)
          mergeJahrEintrag(produktMap, jahr, einzel.produkt)
          mergeJahrEintrag(geoMap, jahr, einzel.geo)
        }
      }
    }

    if (produktMap.size === 0 && geoMap.size === 0 && html10k.length > 5_000) {
      const beide = extrahiereBeideSegmentartenAus10kHtml(html10k)
      const jahr = berichtJahr ?? new Date().getFullYear() - 1
      mergeJahrEintrag(produktMap, jahr, beide.produkt.segmente)
      mergeJahrEintrag(geoMap, jahr, beide.geo.segmente)
    }

    const produkt = baueHistorie('produkt', produktMap)
    const geo = baueHistorie('geo', geoMap)
    const zusatzBasis = extrahiereSecZusatzRisiko(text10k, html10k)
    const zusatz = mergeZusatzHistorie(zusatzBasis, textProFiling)

    if (!produkt && !geo && !kennzahlen && !zusatz.mitarbeiterAnzahl && zusatz.hauptkunden.length === 0) {
      cache.set(sym, { at: Date.now(), data: null })
      return null
    }

    const data: SecSegmentHistoriePaket = {
      produkt,
      geo,
      zusatz,
      kennzahlen,
      berichtJahr,
      anzahl10k: geladene10k,
      geladenAm: new Date().toISOString(),
      quelle: 'sec_edgar',
    }

    cache.set(sym, { at: Date.now(), data })
    return data
  } catch {
    cache.set(sym, { at: Date.now(), data: null })
    return null
  }
}
