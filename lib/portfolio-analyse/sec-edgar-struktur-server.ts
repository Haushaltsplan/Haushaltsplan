/** SEC 10-K / DEF 14A — Segmente, Pension/Lease, CEO-Vergütung (Heuristik). */

import 'server-only'

import type { SecSegmentEintrag, SecStrukturPaket } from '@/lib/portfolio-analyse/fundamentaldaten-erweitert-types'
import { ladeLesbarenBerichtText } from '@/lib/portfolio-analyse/sec-edgar-bericht-text-server'
import { cikFuerTicker, ladeSecSubmissionsRecent, secFetch } from '@/lib/portfolio-analyse/sec-edgar-common-server'
import {
  extrahiereSegmenteAus10kHtml,
  segmentHinweisFuerErgebnis,
} from '@/lib/portfolio-analyse/sec-edgar-segment-extraktion'
import { htmlZuFliesstext } from '@/lib/html/text-aus-html'

const CACHE_MS = 24 * 60 * 60 * 1000
const cache = new Map<string, { at: number; data: SecStrukturPaket | null }>()

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
      const bericht = await ladeLesbarenBerichtText(cik, filing10k.accession, '10-K', filing10k.primaryDocument)
      text10k = bericht?.text ?? ''
      if (bericht?.url) {
        const hres = await secFetch(bericht.url)
        html10k = hres.ok ? await hres.text() : ''
      }
    }
    if (filingProxy) {
      textProxy = await ladeProxyText(cik, filingProxy.accession, filingProxy.primaryDocument)
    }

    const segmentErgebnis = html10k ? extrahiereSegmenteAus10kHtml(html10k) : { segmente: [], art: null, quelle: null }
    const segmente: SecSegmentEintrag[] = segmentErgebnis.segmente.map((s) => ({
      name: s.name,
      umsatzMio: s.umsatzMio,
      anteilPct: s.anteilPct,
    }))

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
      segmentHinweis: segmentHinweisFuerErgebnis(segmentErgebnis),
      pensionVerpflichtungMio: pension,
      leaseVerpflichtungMio: lease,
      ceoVerguetungUsd: ceo.usd,
      proxyJahr: ceo.jahr,
      berichtJahr: filing10k?.reportDate ? parseInt(filing10k.reportDate.slice(0, 4), 10) : null,
      quelle: 'sec_edgar',
    }

    if (segmente.length === 0 && pension == null && lease == null && ceo.usd == null) {
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
