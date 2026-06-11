/** IR-Website-Crawler — folgt Links bis zu Call-Transkripten (Fetch, gleiche Domain). */

import 'server-only'

import { htmlZuFliesstext, linksAusHtml } from '@/lib/html/text-aus-html'
import {
  istEarningsCallTranskript,
  istPresseMitteilung,
  istTranskriptLinkStreng,
} from '@/lib/portfolio-analyse/earnings-call-transcript-heuristik'
import { scoreTranskriptLink } from '@/lib/portfolio-analyse/ir-earnings-sources'
import type { IrRohesTranskript } from '@/lib/portfolio-analyse/ir-earnings-types'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

const MAX_SEITEN = 24
const MAX_TIEFE = 2
const MAX_DOCS = 10

type LinkKandidat = { href: string; text: string; score: number }

function gleicheSite(a: string, b: string): boolean {
  try {
    return new URL(a).hostname.replace(/^www\./, '') === new URL(b).hostname.replace(/^www\./, '')
  } catch {
    return false
  }
}

function istCrawlKandidat(text: string, href: string): boolean {
  if (istTranskriptLinkStreng(text, href)) return true
  const c = `${text} ${href}`.toLowerCase()
  if (/event-details|earnings.*call|conference.*call|quarterly.*results|financial-results/i.test(c)) return true
  return false
}

async function pdfZuText(buffer: Buffer): Promise<string> {
  try {
    const pdfParse = (await import('pdf-parse/lib/pdf-parse.js')).default
    const data = await pdfParse(buffer)
    return (data.text || '').replace(/\s+/g, ' ').trim()
  } catch {
    return ''
  }
}

async function ladeDokumentText(url: string): Promise<string> {
  if (/\.pdf(\?|$)/i.test(url)) {
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, cache: 'no-store' })
    if (!res.ok) return ''
    return pdfZuText(Buffer.from(await res.arrayBuffer()))
  }
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, cache: 'no-store' })
  if (!res.ok) return ''
  return htmlZuFliesstext(await res.text())
}

function parseDatumAusText(text: string): string | null {
  const m =
    text.match(/\b(20\d{2})[-/](0?[1-9]|1[0-2])[-/](0?[1-9]|[12]\d|3[01])\b/) ??
    text.match(/\b(0?[1-9]|[12]\d|3[01])\.\s*(0?[1-9]|1[0-2])\.\s*(20\d{2})\b/)
  if (!m) return null
  if (m[0].includes('-')) return m[0]
  return `${m[3]}-${String(m[2]).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}`
}

export async function crawlIrTranskripte(startUrls: string[], max = 8): Promise<IrRohesTranskript[]> {
  if (!startUrls.length) return []

  const host = startUrls[0]
  const queue: { url: string; tiefe: number }[] = startUrls.map((url) => ({ url, tiefe: 0 }))
  const besucht = new Set<string>()
  const docLinks: LinkKandidat[] = []

  while (queue.length > 0 && besucht.size < MAX_SEITEN) {
    const { url, tiefe } = queue.shift()!
    if (besucht.has(url)) continue
    besucht.add(url)

    let html = ''
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,application/xhtml+xml' },
        cache: 'no-store',
      })
      if (!res.ok) continue
      html = await res.text()
    } catch {
      continue
    }

    for (const l of linksAusHtml(html, url)) {
      if (!gleicheSite(l.href, host) && !/q4cdn\.com/i.test(l.href)) continue

      if (istTranskriptLinkStreng(l.text, l.href) || /\.pdf(\?|$)/i.test(l.href)) {
        docLinks.push({
          href: l.href,
          text: l.text,
          score: scoreTranskriptLink(l.text, l.href),
        })
      } else if (tiefe < MAX_TIEFE && istCrawlKandidat(l.text, l.href) && !besucht.has(l.href)) {
        queue.push({ url: l.href, tiefe: tiefe + 1 })
      }
    }
  }

  docLinks.sort((a, b) => b.score - a.score)
  const seen = new Set<string>()
  const out: IrRohesTranskript[] = []

  for (const k of docLinks) {
    if (out.length >= max) break
    if (seen.has(k.href)) continue
    seen.add(k.href)

    const text = await ladeDokumentText(k.href)
    if (text.length < 800) continue
    if (!istEarningsCallTranskript(text) || istPresseMitteilung(text)) continue

    out.push({
      titel: k.text || k.href,
      url: k.href,
      callDatum: parseDatumAusText(`${k.text} ${k.href}`),
      text,
    })
    if (out.length >= MAX_DOCS) break
  }

  return out
}
