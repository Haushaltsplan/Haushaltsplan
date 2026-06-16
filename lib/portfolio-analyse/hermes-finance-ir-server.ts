/** Hermès finance.hermes.com — Webcast- & Ergebnis-PDFs aus Drupal-Hidden-Fields. */

import 'server-only'

import { istPresseMitteilung, istWebcastDokumentText } from '@/lib/portfolio-analyse/earnings-call-transcript-heuristik'
import type { IrRohesTranskript } from '@/lib/portfolio-analyse/ir-earnings-types'

export const HERMES_ISIN = 'FR0000052292'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

async function pdfZuText(buffer: Buffer): Promise<string> {
  try {
    const pdfParse = (await import('pdf-parse/lib/pdf-parse.js')).default
    const data = await pdfParse(buffer)
    return (data.text || '').replace(/\s+/g, ' ').trim()
  } catch {
    return ''
  }
}

async function ladePdfText(url: string): Promise<string> {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, cache: 'no-store' })
    if (!res.ok) return ''
    return pdfZuText(Buffer.from(await res.arrayBuffer()))
  } catch {
    return ''
  }
}

const BASE = 'https://finance.hermes.com'

const SEED_URLS = [`${BASE}/en/`, `${BASE}/en/publications/`, `${BASE}/fr/publications/`]

const SLUG_MUSTER =
  /revenue|message|half|annual|webcast|result|publishing|executive|quarter|semest|financial|conf/i

type PdfKandidat = { url: string; titel: string; score: number }

export function extrahiereHermesPdfUrls(html: string): string[] {
  const out = new Set<string>()
  for (const m of html.matchAll(/value="(https:\/\/assets-finance\.hermes\.com\/s3fs-public\/[^"]+\.pdf[^"]*)"/gi)) {
    out.add(m[1].replace(/&amp;/g, '&'))
  }
  for (const m of html.matchAll(/href="(https:\/\/assets-finance\.hermes\.com\/s3fs-public\/[^"]+\.pdf[^"]*)"/gi)) {
    out.add(m[1].replace(/&amp;/g, '&'))
  }
  return [...out]
}

function extrahierePublicationSlugs(html: string): string[] {
  return [
    ...new Set([
      ...html.matchAll(/\/en\/publications\/([a-z0-9-]+)/gi),
      ...html.matchAll(/\/fr\/publications\/([a-z0-9-]+)/gi),
    ].map((m) => m[1]!)),
  ].filter((s) => SLUG_MUSTER.test(s))
}

function dateinameAusUrl(url: string): string {
  try {
    return decodeURIComponent(url.split('/').pop()?.split('?')[0] ?? '')
  } catch {
    return url.split('/').pop()?.split('?')[0] ?? ''
  }
}

function istStorePressePdf(kombi: string): boolean {
  return /press-release|communique-de-presse|press release/i.test(kombi) &&
    /maison|store|nagoya|berlin|osaka|hong-kong|loupes|bond-street|northampton|sogo|elements|nominations-comex|executive-committee|appointments|john-lobb/i.test(
      kombi,
    ) &&
    !/revenue|webcast|presentation|message|result|urd|ca_t|ca_s|publishing|semest|half/i.test(kombi)
}

export function istHermesFinanzWebcastPdf(url: string, slugHint?: string): boolean {
  const name = dateinameAusUrl(url)
  const kombi = `${name} ${slugHint ?? ''}`.toLowerCase()
  if (istStorePressePdf(kombi)) return false
  return /webcast|replay|presentation|message|executive.?management|revenue|ca_t|ca_s|chiffre|half.?year|semest|annual|result|publishing|urd|analyst|conf/i.test(
    kombi,
  )
}

function scoreHermesPdf(url: string, slugHint?: string): number {
  if (!istHermesFinanzWebcastPdf(url, slugHint)) return 0
  const name = dateinameAusUrl(url).toLowerCase()
  let score = 5
  if (/webcast|presentation|replay/i.test(name)) score += 8
  if (/message|executive/i.test(name)) score += 7
  if (/revenue|ca_t|ca_s|chiffre/i.test(name)) score += 6
  if (/half|semest|annual|result|publishing/i.test(name)) score += 5
  const dm = name.match(/(20\d{2})(\d{2})(\d{2})/)
  if (dm) score += 2
  if (slugHint && SLUG_MUSTER.test(slugHint)) score += 2
  return score
}

function titelAusPdf(url: string, slugHint?: string): string {
  const name = dateinameAusUrl(url)
  const slug = slugHint?.replace(/-/g, ' ') ?? ''
  if (/revenue_q1|ca_t1|_t1_/i.test(name)) return slug ? `${slug} (Q1)` : 'Quartalsumsatz Q1'
  if (/revenue_q2|ca_t2|_t2_/i.test(name)) return slug ? `${slug} (Q2)` : 'Quartalsumsatz Q2'
  if (/revenue_q3|ca_t3|_t3_/i.test(name)) return slug ? `${slug} (Q3)` : 'Quartalsumsatz Q3'
  if (/revenue_q4|ca_t4|_t4_/i.test(name)) return slug ? `${slug} (Q4)` : 'Quartalsumsatz Q4'
  if (/webcast|replay/i.test(name)) return slug ? `${slug} (Webcast)` : 'Analyst Webcast'
  if (/presentation/i.test(name)) return slug ? `${slug} (Präsentation)` : 'Investor Presentation'
  if (/message|executive/i.test(name)) return slug || 'Message from Executive Management'
  if (/half|semest/i.test(name)) return slug || 'Halbjahresergebnisse'
  if (/annual|urd|publishing/i.test(name)) return slug || 'Jahresergebnisse'
  if (slug) return slug
  return name.replace(/[_-]+/g, ' ').replace(/\.pdf$/i, '').slice(0, 80)
}

function parseDatumAusHermes(url: string, titel: string): string | null {
  const c = `${url} ${titel}`
  const iso = c.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/)
  if (iso) return iso[0]

  const ymd = c.match(/(20\d{2})(\d{2})(\d{2})/)
  if (ymd) return `${ymd[1]}-${ymd[2]}-${ymd[3]}`

  const dmy = c.match(/(\d{2})\.(\d{2})\.(20\d{2})/)
  if (dmy) return `${dmy[3]}-${dmy[2]}-${dmy[1]}`

  const jahr = c.match(/\b(20\d{2})\b/)?.[1]
  if (jahr && /q1|_t1_|first.?quarter|ca_t1/i.test(c)) return `${jahr}-03-15`
  if (jahr && /q2|_t2_|half|semest|h1/i.test(c)) return `${jahr}-06-30`
  if (jahr && /q3|_t3_/i.test(c)) return `${jahr}-09-30`
  if (jahr && /q4|_t4_|annual|urd|publishing|message/i.test(c)) return `${jahr}-12-15`
  return jahr ? `${jahr}-06-15` : null
}

async function fetchHtml(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,application/xhtml+xml' },
      cache: 'no-store',
      signal: AbortSignal.timeout(18_000),
    })
    if (!res.ok) return ''
    return await res.text()
  } catch {
    return ''
  }
}

async function sammlePdfKandidaten(): Promise<PdfKandidat[]> {
  const byUrl = new Map<string, PdfKandidat>()
  const slugPages = new Set<string>()

  for (const seed of SEED_URLS) {
    const html = await fetchHtml(seed)
    if (!html) continue
    for (const slug of extrahierePublicationSlugs(html)) {
      slugPages.add(`${BASE}/en/publications/${slug}`)
      slugPages.add(`${BASE}/fr/publications/${slug}`)
    }
    for (const url of extrahiereHermesPdfUrls(html)) {
      const score = scoreHermesPdf(url)
      if (score <= 0) continue
      const cur = byUrl.get(url)
      if (!cur || score > cur.score) {
        byUrl.set(url, { url, titel: titelAusPdf(url), score })
      }
    }
  }

  for (const pageUrl of slugPages) {
    const html = await fetchHtml(pageUrl)
    if (!html) continue
    const slug = pageUrl.split('/').pop() ?? ''
    for (const url of extrahiereHermesPdfUrls(html)) {
      const score = scoreHermesPdf(url, slug)
      if (score <= 0) continue
      const cur = byUrl.get(url)
      if (!cur || score > cur.score) {
        byUrl.set(url, { url, titel: titelAusPdf(url, slug), score })
      }
    }
  }

  return [...byUrl.values()].sort((a, b) => b.score - a.score)
}

/** Webcast-, Präsentations- und Ergebnis-PDFs von finance.hermes.com. */
export async function ladeHermesWebcastHistorie(max = 8): Promise<IrRohesTranskript[]> {
  const kandidaten = await sammlePdfKandidaten()
  const out: IrRohesTranskript[] = []

  for (const k of kandidaten) {
    if (out.length >= max) break
    const text = await ladePdfText(k.url)
    if (text.length < 800) continue
    if (!istWebcastDokumentText(text)) continue
    if (istPresseMitteilung(text) && !/revenue|turnover|chiffre|webcast|presentation|message/i.test(text.slice(0, 5000))) {
      continue
    }
    out.push({
      titel: k.titel,
      url: k.url,
      callDatum: parseDatumAusHermes(k.url, k.titel),
      text,
    })
  }

  out.sort((a, b) => (b.callDatum ?? '').localeCompare(a.callDatum ?? ''))
  return out.slice(0, max)
}
