/** Portfolio-EU — IR-PDFs via HTML, AEM-JSON & Contenthub (MUM, Straumann, Sika, Halma, WKL, ATD). */

import 'server-only'

import { euPortfolioIrConfig, type EuPortfolioIrConfig } from '@/lib/portfolio-analyse/eu-portfolio-ir-config'
import { istPresseMitteilung, istWebcastDokumentText } from '@/lib/portfolio-analyse/earnings-call-transcript-heuristik'
import type { IrRohesTranskript } from '@/lib/portfolio-analyse/ir-earnings-types'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

type PdfKandidat = { url: string; titel: string; score: number; art: 'webcast' | 'bericht' }

async function pdfZuText(buffer: Buffer): Promise<string> {
  try {
    const pdfParse = (await import('pdf-parse/lib/pdf-parse.js')).default
    const data = await pdfParse(buffer)
    return (data.text || '').replace(/\s+/g, ' ').trim()
  } catch {
    return ''
  }
}

async function ladePdfText(url: string, referer: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/pdf,*/*', Referer: referer },
      cache: 'no-store',
      signal: AbortSignal.timeout(25_000),
    })
    if (!res.ok) return ''
    const ct = res.headers.get('content-type') ?? ''
    if (!ct.includes('pdf') && !/\.pdf|contenthub\.wolterskluwer|filecache\.investorroom/i.test(url)) return ''
    return pdfZuText(Buffer.from(await res.arrayBuffer()))
  } catch {
    return ''
  }
}

async function fetchHtml(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(18_000),
    })
    if (!res.ok) return ''
    return await res.text()
  } catch {
    return ''
  }
}

function dateinameAusUrl(url: string): string {
  try {
    return decodeURIComponent(url.split('/').pop()?.split('?')[0] ?? '')
  } catch {
    return url.split('/').pop()?.split('?')[0] ?? ''
  }
}

function absolutUrl(href: string, origin: string): string | null {
  const h = href.trim().replace(/&amp;/g, '&')
  if (!h || h.startsWith('#') || h.startsWith('mailto:') || h.startsWith('javascript:')) return null
  try {
    if (h.startsWith('http://') || h.startsWith('https://')) return h
    if (h.startsWith('//')) return `https:${h}`
    return new URL(h, origin).toString()
  } catch {
    return null
  }
}

function extrahiereUrlsAusHtml(html: string, origin: string): string[] {
  const out = new Set<string>()
  const patterns = [
    /href="([^"]+)"/gi,
    /"(https:\/\/assets\.contenthub\.wolterskluwer\.com[^"]+)"/gi,
    /"(https:\/\/filecache\.investorroom\.com[^"]+)"/gi,
    /(\/content\/dam\/[^"'\\s]+\.pdf)/gi,
    /(\/download\/[^"'\\s]+\.pdf[^"'\\s]*)/gi,
    /(\/-\/media\/[^"'\\s]+\.pdf[^"'\\s]*)/gi,
    /(\/~\/media\/[^"'\\s]+\.pdf[^"'\\s]*)/gi,
  ]
  for (const pat of patterns) {
    for (const m of html.matchAll(pat)) {
      const raw = m[1] ?? m[0]
      const abs = absolutUrl(raw, origin)
      if (abs) out.add(abs)
    }
  }
  for (const m of html.matchAll(/downloads\.listing\.json/gi)) {
    const ctx = html.slice(Math.max(0, (m.index ?? 0) - 120), (m.index ?? 0) + 80)
    const pathM = ctx.match(/data-search-api-url="([^"]+)"/) ?? ctx.match(/"([^"]*downloads\.listing\.json)"/)
    if (pathM?.[1]) {
      const abs = absolutUrl(pathM[1].replace(/&#34;/g, '"'), origin)
      if (abs) out.add(abs)
    }
  }
  return [...out]
}

function parseAemListing(json: unknown): string[] {
  const root = json as Record<string, unknown>
  const items = (root.results ?? root.items) as unknown[] | undefined
  if (!Array.isArray(items)) return []
  const paths: string[] = []
  for (const it of items) {
    if (typeof it === 'string') paths.push(it)
    else if (it && typeof it === 'object') {
      const row = it as Record<string, unknown>
      for (const k of ['path', 'url', 'downloadUrl', 'link', 'assetPath']) {
        if (typeof row[k] === 'string') paths.push(row[k] as string)
      }
    }
  }
  return paths
}

function scoreWebcast(url: string, titelHint = ''): number {
  const kombi = `${dateinameAusUrl(url)} ${titelHint}`.toLowerCase()
  if (/sustainability|esg|governance|compensation|proxy|circular|factsheet|xbrl|workbook|\.xlsx|\.zip/i.test(kombi)) {
    return 0
  }
  if (/presentation|webcast|praesentation|pres|contenthub|full.?year.?results|quarter|quartal|q[1-4]|fy20|half.?year|halbjahr|cmd/i.test(kombi)) {
    let s = 6
    if (/webcast|presentation|praesentation|pres/i.test(kombi)) s += 6
    if (/q[1-4]|quarter|quartal/i.test(kombi)) s += 4
    if (/20\d{2}/.test(kombi)) s += 2
    return s
  }
  if (/press.?release|medienmitteilung|earnings release/i.test(kombi) && /20\d{2}/.test(kombi)) return 5
  return 0
}

function scoreBericht(url: string, titelHint = ''): number {
  const kombi = `${dateinameAusUrl(url)} ${titelHint}`.toLowerCase()
  if (/sustainability|esg|proxy|circular|factsheet|xbrl|workbook|\.xlsx|\.zip|compensation.?report/i.test(kombi)) {
    return 0
  }
  if (/annual.?report|geschäftsbericht|geschaeftsbericht|financial.?statements|consolidated|quarterly.?report|md&a|interim|half.?year|halbjahr|10-k|finanzbericht|gb20|_ar/i.test(kombi)) {
    let s = 7
    if (/annual|geschäfts|jahres|gb20|_ar/i.test(kombi)) s += 4
    if (/quarter|quartal|q[1-4]|interim|half/i.test(kombi)) s += 3
    if (/20\d{2}/.test(kombi)) s += 2
    return s
  }
  if (/management discussion|mda|aif/i.test(kombi)) return 5
  return 0
}

function titelAusUrl(url: string, art: 'webcast' | 'bericht'): string {
  const name = dateinameAusUrl(url).replace(/\.pdf$/i, '').replace(/[_-]+/g, ' ')
  if (/presentation|webcast|praesentation/i.test(name)) return `Investor Presentation — ${name.slice(0, 60)}`
  if (/press.?release|medienmitteilung/i.test(name)) return `Ergebnismitteilung — ${name.slice(0, 60)}`
  if (/annual|geschäfts|_ar|gb20/i.test(name)) return `Jahresbericht — ${name.slice(0, 60)}`
  if (/quarter|q[1-4]|interim|half/i.test(name)) return `Quartals-/Halbjahresbericht — ${name.slice(0, 60)}`
  return art === 'webcast' ? `Investor Presentation — ${name.slice(0, 70)}` : `Finanzbericht — ${name.slice(0, 70)}`
}

function parseDatumAusUrl(url: string, titel: string): string | null {
  const c = `${url} ${titel}`.toLowerCase()
  const iso = c.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/)
  if (iso) return iso[0]
  const ymd = c.match(/(20\d{2})(\d{2})(\d{2})/)
  if (ymd) return `${ymd[1]}-${ymd[2]}-${ymd[3]}`
  const jahr = c.match(/\b(20\d{2})\b/)?.[1]
  if (!jahr) return null
  if (/q1|_q1|first.?quarter|jan|mar/.test(c)) return `${jahr}-03-31`
  if (/q2|_q2|half|h1|jun|semest/.test(c)) return `${jahr}-06-30`
  if (/q3|_q3|sep/.test(c)) return `${jahr}-09-30`
  if (/q4|_q4|fy|annual|full.?year|dec/.test(c)) return `${jahr}-12-31`
  return `${jahr}-06-15`
}

async function sammleDokumentUrls(cfg: EuPortfolioIrConfig): Promise<PdfKandidat[]> {
  const byUrl = new Map<string, PdfKandidat>()
  const add = (href: string, art: 'webcast' | 'bericht', titelHint = '') => {
    const abs = absolutUrl(href, cfg.origin) ?? (href.startsWith('http') ? href : null)
    if (!abs) return
    const score = art === 'webcast' ? scoreWebcast(abs, titelHint) : scoreBericht(abs, titelHint)
    if (score <= 0) return
    const titel = titelAusUrl(abs, art)
    const cur = byUrl.get(abs)
    if (!cur || score > cur.score) byUrl.set(abs, { url: abs, titel, score, art })
  }

  const jsonUrls = new Set(cfg.listingJsonUrls ?? [])
  for (const seed of cfg.seedUrls) {
    const html = await fetchHtml(seed)
    if (!html) continue
    for (const m of html.matchAll(/data-search-api-url="([^"]+)"/gi)) {
      const abs = absolutUrl(m[1].replace(/&#34;/g, '"'), cfg.origin)
      if (abs?.includes('.listing.json')) jsonUrls.add(abs)
    }
    for (const u of extrahiereUrlsAusHtml(html, cfg.origin)) {
      if (u.includes('.listing.json')) jsonUrls.add(u)
      const ws = scoreWebcast(u)
      const bs = scoreBericht(u)
      if (ws >= bs && ws > 0) add(u, 'webcast')
      else if (bs > 0) add(u, 'bericht')
    }
  }

  for (const jsonUrl of jsonUrls) {
    const absJson = absolutUrl(jsonUrl, cfg.origin)
    if (!absJson) continue
    try {
      const res = await fetch(absJson, { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' } })
      if (!res.ok) continue
      for (const path of parseAemListing(await res.json())) {
        const ws = scoreWebcast(path)
        const bs = scoreBericht(path)
        if (ws >= bs && ws > 0) add(path, 'webcast')
        else if (bs > 0) add(path, 'bericht')
      }
    } catch {
      /* skip */
    }
  }

  return [...byUrl.values()].sort((a, b) => b.score - a.score)
}

export async function ladeEuPortfolioWebcastHistorie(isin: string, max = 8): Promise<IrRohesTranskript[]> {
  const cfg = euPortfolioIrConfig(isin)
  if (!cfg) return []

  const kandidaten = (await sammleDokumentUrls(cfg)).filter((k) => k.art === 'webcast')
  const out: IrRohesTranskript[] = []

  for (const k of kandidaten) {
    if (out.length >= max) break
    const text = await ladePdfText(k.url, cfg.referer)
    if (text.length < 600) continue
    if (!istWebcastDokumentText(text) && text.length < 2_500) continue
    if (istPresseMitteilung(text) && !istWebcastDokumentText(text)) continue
    out.push({
      titel: k.titel,
      url: k.url,
      callDatum: parseDatumAusUrl(k.url, k.titel),
      text,
    })
  }

  out.sort((a, b) => (b.callDatum ?? '').localeCompare(a.callDatum ?? ''))
  return out.slice(0, max)
}

export async function ladeEuPortfolioFinanzberichteHistorie(
  isin: string,
  max = 12,
): Promise<Array<{ url: string; titel: string; text: string; callDatum: string | null }>> {
  const cfg = euPortfolioIrConfig(isin)
  if (!cfg) return []

  const kandidaten = (await sammleDokumentUrls(cfg)).filter((k) => k.art === 'bericht')
  const out: Array<{ url: string; titel: string; text: string; callDatum: string | null }> = []

  for (const k of kandidaten) {
    if (out.length >= max) break
    const text = await ladePdfText(k.url, cfg.referer)
    if (text.length < 1_500) continue
    out.push({
      url: k.url,
      titel: k.titel,
      text,
      callDatum: parseDatumAusUrl(k.url, k.titel),
    })
  }

  out.sort((a, b) => (b.callDatum ?? '').localeCompare(a.callDatum ?? ''))
  return out.slice(0, max)
}
