/** SEC 10-K / DEF 14A — Segmente, Pension/Lease, CEO-Vergütung (Heuristik). */

import 'server-only'

import type { SecSegmentEintrag, SecStrukturPaket } from '@/lib/portfolio-analyse/fundamentaldaten-erweitert-types'
import { ladeLesbarenBerichtText } from '@/lib/portfolio-analyse/sec-edgar-bericht-text-server'
import { cikFuerTicker, ladeSecSubmissionsRecent, secFetch } from '@/lib/portfolio-analyse/sec-edgar-common-server'
import { htmlZuFliesstext } from '@/lib/html/text-aus-html'

const CACHE_MS = 24 * 60 * 60 * 1000
const cache = new Map<string, { at: number; data: SecStrukturPaket | null }>()

const SEGMENT_SECTION_RES = [
  /net revenue[s]? by geographic/i,
  /revenue[s]? by geographic/i,
  /revenues? by geographic region/i,
  /revenue[s]? by country/i,
  /revenue[s]? by region/i,
  /segment information/i,
  /information about geographic areas/i,
]

const SKIP_SEGMENT_NAMES =
  /^(net revenue[s]?|total revenue[s]?|total[s]?|consolidated|eliminations?|intercompany|corporate|other\s*\d*)$/i

const JUNK_SEGMENT_NAME =
  /incorporated|recognized|privacy|platforms|union\s*\(|&#|payments,|software|technology/i

const BALANCE_SHEET_JUNK =
  /receivable|prepaid|other assets|other current|other liabilities|liabilit|net income|goodwill|intangible|property|equipment|cash and/i

const GEO_SEGMENT_HINT =
  /america|europe|asia|pacific|africa|middle east|international|united states|u\.s\.|emea|latin|canada|china|japan|global|regional|country|markets?$/i

function parseMioUsd(text: string, patterns: RegExp[]): number | null {
  for (const re of patterns) {
    const m = text.match(re)
    if (!m?.[1]) continue
    const raw = m[1].replace(/,/g, '').trim()
    let n = Number(raw)
    if (!Number.isFinite(n)) continue
    const ctx = (m[0] + (m[2] ?? '')).toLowerCase()
    if (/billion|milliard|mrd/i.test(ctx)) n *= 1_000
    if (/thousand|tausend/i.test(ctx) && n < 1_000_000) n /= 1_000
    return Math.round(n)
  }
  return null
}

function zellenText(tdHtml: string): string {
  return tdHtml
    .replace(/<ix:nonfraction[^>]*>([\s\S]*?)<\/ix:nonfraction>/gi, '$1')
    .replace(/<ix:nonnumeric[^>]*>([\s\S]*?)<\/ix:nonnumeric>/gi, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function betraegeAusIxZeile(trHtml: string): number[] {
  const betraege: number[] = []
  const amtRe = /<ix:nonfraction[^>]*>([\s\S]*?)<\/ix:nonfraction>/gi
  let am: RegExpExecArray | null
  while ((am = amtRe.exec(trHtml)) !== null) {
    const s = am[1].replace(/&#(\d+);/g, '').replace(/,/g, '').trim()
    if (!/^\d+(?:\.\d+)?$/.test(s)) continue
    const n = Number(s)
    if (Number.isFinite(n) && n > 0) betraege.push(n)
  }
  return betraege
}

function parseBetragMioAusZellen(zellen: string[], abIdx = 1): number | null {
  for (let i = abIdx; i < zellen.length; i++) {
    const s = zellen[i].replace(/[$,()]/g, '').trim()
    if (!/^\d+(?:\.\d+)?$/.test(s)) continue
    const n = Number(s)
    if (!Number.isFinite(n) || n <= 0) continue
    if (n > 50_000_000) return Math.round(n / 1_000_000)
    return Math.round(n)
  }
  return null
}

function bereinigeSegmentName(raw: string): string {
  return raw
    .replace(/\s+\$\s*$/g, '')
    .replace(/\s+\d{1,2}\s*$/g, '')
    .replace(/\s*\(\s*in\s+millions?\s*\)\s*/gi, '')
    .trim()
}

function istGueltigerSegmentName(name: string, geoAbschnitt: boolean): boolean {
  if (name.length < 3 || name.length > 72) return false
  if (SKIP_SEGMENT_NAMES.test(name)) return false
  if (JUNK_SEGMENT_NAME.test(name)) return false
  if (BALANCE_SHEET_JUNK.test(name)) return false
  if (/^\d{4}$/.test(name)) return false
  if (/^\(in /i.test(name)) return false
  if (/[,(]$/.test(name)) return false
  if (!/[a-zA-Z]{3,}/.test(name)) return false
  if (geoAbschnitt && !GEO_SEGMENT_HINT.test(name)) return false
  return true
}

function validiereUndAnteile(segmente: SecSegmentEintrag[]): SecSegmentEintrag[] {
  const mitUmsatz = segmente.filter((s) => (s.umsatzMio ?? 0) >= 50)
  if (mitUmsatz.length < 2) return []

  const summe = mitUmsatz.reduce((s, e) => s + (e.umsatzMio ?? 0), 0)
  if (summe < 200) return []

  for (const s of mitUmsatz) {
    s.anteilPct = Math.round(((s.umsatzMio ?? 0) / summe) * 1000) / 10
  }

  const anteile = mitUmsatz.map((s) => s.anteilPct ?? 0)
  if (mitUmsatz.length > 6) return []
  if (anteile.some((a) => a < 5 || a > 95)) return []
  const summeAnteil = anteile.reduce((a, b) => a + b, 0)
  if (summeAnteil < 85 || summeAnteil > 115) return []

  return mitUmsatz
}

/** Geo-/Produktsegmente aus iXBRL-Tabellen im 10-K (nicht Freitext-Regex). */
function extrahiereSegmenteAusHtml(html: string): SecSegmentEintrag[] {
  let fensterStart = -1
  for (const re of SEGMENT_SECTION_RES) {
    const m = re.exec(html)
    if (m && (fensterStart < 0 || m.index < fensterStart)) fensterStart = m.index
  }
  if (fensterStart < 0) return []

  let fensterEnd = 30_000
  const endMarkers = [
    /receivables from contracts with customers/i,
    /notes to consolidated financial statements/i,
    /item\s+7a\./i,
  ]
  const fensterVoll = html.slice(fensterStart, fensterStart + fensterEnd)
  for (const re of endMarkers) {
    const m = re.exec(fensterVoll)
    if (m && m.index > 150 && m.index < fensterEnd) fensterEnd = m.index
  }
  const fenster = fensterVoll.slice(0, fensterEnd)
  const geoAbschnitt = /geographic|country|region/i.test(fenster.slice(0, 600))

  const segmente: SecSegmentEintrag[] = []
  const seen = new Set<string>()
  let nachSummenzeile = false

  const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi
  let row: RegExpExecArray | null
  while ((row = rowRe.exec(fenster)) !== null && segmente.length < 8) {
    if (nachSummenzeile) break

    const trHtml = row[1]!
    const ixBetraege = betraegeAusIxZeile(trHtml)

    let name: string
    let umsatzMio: number | null

    if (ixBetraege.length > 0) {
      const labelPart = trHtml.split(/<ix:nonfraction/i)[0] ?? ''
      name = bereinigeSegmentName(zellenText(labelPart))
      umsatzMio = Math.round(ixBetraege[0]!)
    } else {
      const zellen = [...trHtml.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((m) => zellenText(m[1]!))
      if (zellen.length < 2) continue
      name = bereinigeSegmentName(zellen[0]!)
      umsatzMio = parseBetragMioAusZellen(zellen, 1)
    }

    if (SKIP_SEGMENT_NAMES.test(name)) {
      if (/^net revenue/i.test(name)) nachSummenzeile = true
      continue
    }
    if (!istGueltigerSegmentName(name, geoAbschnitt)) continue
    if (umsatzMio == null) continue

    const key = name.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)

    segmente.push({ name, umsatzMio, anteilPct: null })
  }

  return validiereUndAnteile(segmente)
}

function extrahiereCeoVerguetung(text: string): { usd: number | null; jahr: number | null } {
  const fenster = text.slice(0, 120_000)
  const ceoBlock = fenster.match(/chief executive officer[\s\S]{0,2500}/i)?.[0] ?? fenster
  const totalRe = /total\s*\$?\s*([\d,]+)/i.exec(ceoBlock)
  if (totalRe) {
    const n = Number(totalRe[1].replace(/,/g, ''))
    if (Number.isFinite(n) && n > 100_000) return { usd: n, jahr: null }
  }
  const compRe = /\$\s*([\d,]{6,})/g
  let best = 0
  let cm: RegExpExecArray | null
  while ((cm = compRe.exec(ceoBlock)) !== null) {
    const n = Number(cm[1].replace(/,/g, ''))
    if (n > best) best = n
  }
  const jahrM = /(20\d{2})/.exec(fenster.slice(0, 5000))
  return { usd: best > 0 ? best : null, jahr: jahrM ? parseInt(jahrM[1], 10) : null }
}

async function ladeProxyText(
  cik: number,
  accession: string,
  primaryDocument: string,
): Promise<string> {
  const accPath = accession.replace(/-/g, '')
  const url = `https://www.sec.gov/Archives/edgar/data/${cik}/${accPath}/${primaryDocument}`
  const res = await secFetch(url)
  if (!res.ok) return ''
  const html = await res.text()
  return htmlZuFliesstext(html).slice(0, 200_000)
}

async function neuestesFiling(
  cik: number,
  formular: string,
): Promise<{ accession: string; primaryDocument: string; reportDate: string | null } | null> {
  const recent = await ladeSecSubmissionsRecent(cik)
  if (!recent?.form?.length) return null

  for (let i = 0; i < recent.form.length; i++) {
    if (recent.form[i] !== formular) continue
    const accession = recent.accessionNumber?.[i]
    const doc = recent.primaryDocument?.[i]
    if (!accession || !doc) continue
    return { accession, primaryDocument: doc, reportDate: recent.reportDate?.[i] ?? null }
  }
  return null
}

export async function ladeSecStrukturExtraktion(ticker: string): Promise<SecStrukturPaket | null> {
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
    const [filing10k, filingProxy] = await Promise.all([
      neuestesFiling(cik, '10-K'),
      neuestesFiling(cik, 'DEF 14A'),
    ])

    let text10k = ''
    let html10k = ''
    let textProxy = ''
    if (filing10k) {
      const hit = await ladeLesbarenBerichtText(cik, filing10k.accession, '10-K', filing10k.primaryDocument)
      text10k = hit?.text ?? ''
      if (hit?.url) {
        const hres = await secFetch(hit.url)
        html10k = hres.ok ? await hres.text() : ''
      }
    }
    if (filingProxy) {
      textProxy = await ladeProxyText(cik, filingProxy.accession, filingProxy.primaryDocument)
    }

    const segmente = html10k ? extrahiereSegmenteAusHtml(html10k) : []
    const pension = text10k
      ? parseMioUsd(text10k, [
          /pension\s+obligation[s]?[^$\d]{0,60}\$?\s*([\d,]+)\s*(million|billion)?/i,
          /projected benefit obligation[^$\d]{0,60}\$?\s*([\d,]+)\s*(million|billion)?/i,
        ])
      : null
    const lease = text10k
      ? parseMioUsd(text10k, [
          /lease\s+liabilit(?:y|ies)[^$\d]{0,60}\$?\s*([\d,]+)\s*(million|billion)?/i,
          /operating lease[^$\d]{0,80}\$?\s*([\d,]+)\s*(million|billion)?/i,
        ])
      : null
    const ceo = textProxy ? extrahiereCeoVerguetung(textProxy) : { usd: null, jahr: null }

    const data: SecStrukturPaket = {
      segmente,
      segmentHinweis:
        segmente.length === 0
          ? 'Keine Geo-/Produktsegmente automatisch erkannt (10-K prüfen).'
          : null,
      pensionVerpflichtungMio: pension,
      leaseVerpflichtungMio: lease,
      ceoVerguetungUsd: ceo.usd,
      proxyJahr: ceo.jahr,
      berichtJahr: filing10k?.reportDate ? parseInt(filing10k.reportDate.slice(0, 4), 10) : null,
      quelle: 'sec_edgar',
    }

    if (
      segmente.length === 0 &&
      pension == null &&
      lease == null &&
      ceo.usd == null
    ) {
      cache.set(sym, { at: Date.now(), data: null })
      return null
    }

    cache.set(sym, { at: Date.now(), data })
    return data
  } catch {
    cache.set(sym, { at: Date.now(), data: null })
    return null
  }
}
