/** IR — Quartalsseiten & PDF-Transkripte (typisch EU, z. B. ASML, Wolters Kluwer). */

import 'server-only'

import { linksAusHtml } from '@/lib/html/text-aus-html'
import {
  istEarningsCallTranskript,
  istPresseMitteilung,
  istWebcastDokumentText,
} from '@/lib/portfolio-analyse/earnings-call-transcript-heuristik'
import { ladeDokumentText } from '@/lib/portfolio-analyse/ir-earnings-scraper'
import type { IrRohesTranskript } from '@/lib/portfolio-analyse/ir-earnings-types'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

const MAX_QUARTER_PAGES = 10
const MAX_PDF_PRO_SEITE = 4

function istQuartalsSeite(text: string, href: string): boolean {
  const c = `${text} ${href}`.toLowerCase()
  if (/q[1-4][\s-/_]20\d{2}|20\d{2}[\s-/_]q[1-4]|quarter.*20\d{2}|half-year|half year|h1-20|h2-20|fy-20/i.test(c)) {
    return true
  }
  if (/financial-results|results-and-presentations|finanzberichte|publications\/.*20\d{2}/i.test(href)) {
    return /q[1-4]|quarter|half|h1|h2|fy/i.test(c)
  }
  return false
}

function istTranskriptPdf(href: string, text: string): boolean {
  const c = `${text} ${href}`.toLowerCase()
  if (!/\.pdf(\?|$)/i.test(href)) return false
  if (/transcript|transkript|investor-call|investor call|conference call|results-video-transcript|earnings call/i.test(c)) {
    return true
  }
  if (/webcast|replay|presentation|revenue_q|ca_t[1-4]|message.*executive|analyst conference/i.test(c)) return true
  if (/press release|financial-statements|financial statements/i.test(c) && !/transcript|webcast|revenue/i.test(c)) {
    return false
  }
  return false
}

function parseDatumAusText(text: string): string | null {
  const m =
    text.match(/\b(20\d{2})[-_](0?[1-9]|1[0-2])[-_](0?[1-9]|[12]\d|3[01])\b/) ??
    text.match(/\b(20\d{2})[-/](0?[1-9]|1[0-2])[-/](0?[1-9]|[12]\d|3[01])\b/) ??
    text.match(/\bq([1-4])\s*20(\d{2})\b/i)
  if (!m) return null
  if (m[0].startsWith('Q') || m[0].startsWith('q')) {
    const q = Number(m[1])
    const jahr = 2000 + Number(m[2])
    const monat = q === 1 ? '03' : q === 2 ? '06' : q === 3 ? '09' : '12'
    return `${jahr}-${monat}-15`
  }
  return `${m[1]}-${String(m[2]).padStart(2, '0')}-${String(m[3]).padStart(2, '0')}`
}

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' },
    cache: 'no-store',
    signal: AbortSignal.timeout(18_000),
  })
  if (!res.ok) return ''
  return res.text()
}

async function sammleQuartalsUrls(listenUrls: string[]): Promise<string[]> {
  const quartale: { url: string; score: number }[] = []
  const seen = new Set<string>()

  for (const listenUrl of listenUrls) {
    const html = await fetchHtml(listenUrl)
    if (!html) continue

    for (const l of linksAusHtml(html, listenUrl)) {
      if (!istQuartalsSeite(l.text, l.href)) continue
      if (seen.has(l.href)) continue
      seen.add(l.href)
      let score = 0
      if (/q[1-4]/i.test(l.href)) score += 5
      if (/20\d{2}/.test(l.href)) score += 3
      if (/transcript|call/i.test(l.href)) score += 2
      quartale.push({ url: l.href, score })
    }
  }

  quartale.sort((a, b) => b.score - a.score)
  return quartale.slice(0, MAX_QUARTER_PAGES).map((q) => q.url)
}

async function transkripteAusQuartalsseite(seitenUrl: string, max: number): Promise<IrRohesTranskript[]> {
  const html = await fetchHtml(seitenUrl)
  if (!html) return []

  const pdfs = linksAusHtml(html, seitenUrl)
    .filter((l) => istTranskriptPdf(l.href, l.text))
    .slice(0, MAX_PDF_PRO_SEITE)

  const out: IrRohesTranskript[] = []
  for (const pdf of pdfs) {
    if (out.length >= max) break
    const text = await ladeDokumentText(pdf.href)
    if (text.length < 600) continue
    if (!istEarningsCallTranskript(text) && !istWebcastDokumentText(text)) continue
    if (istPresseMitteilung(text) && !istWebcastDokumentText(text)) continue
    out.push({
      titel: pdf.text || pdf.href.split('/').pop() || 'Earnings Call Transcript',
      url: pdf.href,
      callDatum: parseDatumAusText(`${pdf.text} ${pdf.href} ${seitenUrl}`),
      text,
    })
  }
  return out
}

/** Quartals-Unterseiten auf IR-Seiten durchsuchen (PDF-Transkripte). */
export async function ladeIrQuartalsTranskriptHistorie(
  listenUrls: string[],
  max = 8,
): Promise<IrRohesTranskript[]> {
  if (!listenUrls.length) return []

  const quartalsUrls = await sammleQuartalsUrls(listenUrls)
  const out: IrRohesTranskript[] = []
  const seenUrl = new Set<string>()

  for (const seite of quartalsUrls) {
    if (out.length >= max) break
    const batch = await transkripteAusQuartalsseite(seite, max - out.length)
    for (const t of batch) {
      if (seenUrl.has(t.url)) continue
      seenUrl.add(t.url)
      out.push(t)
    }
  }

  out.sort((a, b) => (b.callDatum ?? '').localeCompare(a.callDatum ?? ''))
  return out.slice(0, max)
}
