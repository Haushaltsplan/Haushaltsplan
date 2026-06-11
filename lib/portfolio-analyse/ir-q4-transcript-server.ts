/** Q4 Investor-Relations Platform — Earnings-Call-Transkripte via JSON-API (Vercel-tauglich). */

import 'server-only'

import {
  istEarningsCallTranskript,
  istPresseMitteilung,
} from '@/lib/portfolio-analyse/earnings-call-transcript-heuristik'
import type { IrRohesTranskript } from '@/lib/portfolio-analyse/ir-earnings-types'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

type Q4Attachment = {
  Title?: string
  Url?: string
  DocumentPath?: string
  Extension?: string
}

type Q4Event = {
  Title?: string
  StartDate?: string
  Body?: string
  Attachments?: Q4Attachment[]
  WebCastLink?: string
  WebcastLink?: string
}

export function q4BasisKandidaten(listenUrls: string[], extra: string[] = []): string[] {
  const out = new Set<string>()
  for (const raw of [...listenUrls, ...extra]) {
    try {
      const url = new URL(raw)
      out.add(url.origin)
      const seg = url.pathname.split('/').filter(Boolean)
      if (seg[0]) out.add(`${url.origin}/${seg[0]}`)
      if (seg[0] && seg[1]) out.add(`${url.origin}/${seg[0]}/${seg[1]}`)
    } catch {
      /* */
    }
  }
  return [...out]
}

async function testQ4Basis(basis: string): Promise<boolean> {
  try {
    const u = `${basis.replace(/\/$/, '')}/feed/Event.svc/GetEventList?LanguageId=1&eventListViewType=1`
    const res = await fetch(u, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      cache: 'no-store',
    })
    if (!res.ok) return false
    const t = await res.text()
    return t.includes('GetEventListResult')
  } catch {
    return false
  }
}

async function ladeQ4Events(basis: string): Promise<Q4Event[]> {
  const u = `${basis.replace(/\/$/, '')}/feed/Event.svc/GetEventList?LanguageId=1&eventListViewType=1`
  const res = await fetch(u, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
    cache: 'no-store',
  })
  if (!res.ok) return []
  const t = await res.text()
  if (t.trimStart().startsWith('<!')) return []
  const data = JSON.parse(t) as { GetEventListResult?: Q4Event[] }
  return data.GetEventListResult ?? []
}

function istEarningsCallEvent(title: string): boolean {
  const t = title.toLowerCase()
  if (/stockholder meeting|shareholders meeting|annual meeting|investor presentation|fireside|moffett|goldman sachs|morgan stanley conference|data center energy/i.test(t)) {
    if (!/earnings call|earnings conference call|results call/.test(t)) return false
  }
  return /earnings call|earnings conference call|results call|quarter.*earnings.*call|q[1-4]\s*\d{4}.*earnings/i.test(t)
}

function parseQ4Datum(raw?: string): string | null {
  if (!raw?.trim()) return null
  const m = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (!m) return null
  return `${m[3]}-${String(m[2]).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}`
}

function attachmentUrl(a: Q4Attachment): string | null {
  return (a.Url || a.DocumentPath || '').trim() || null
}

function istTranskriptAnhang(a: Q4Attachment): boolean {
  const meta = `${a.Title || ''} ${attachmentUrl(a) || ''}`.toLowerCase()
  if (!/transcript/i.test(meta)) return false
  if (/presentation|press release|earnings release|supplemental|10-q|10-k|10q|10k/i.test(meta)) {
    if (!/\btranscript\b/i.test(a.Title || '')) return false
  }
  return true
}

function urlsAusEventBody(body: string, basis: string): string[] {
  const urls: string[] = []
  const re = /href=["']([^"']+)["']/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(body)) !== null) {
    const href = m[1]
    if (!/transcript/i.test(href)) continue
    try {
      urls.push(new URL(href, basis).href)
    } catch {
      urls.push(href)
    }
  }
  return urls
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

async function ladeDokument(url: string): Promise<string> {
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, cache: 'no-store' })
  if (!res.ok) return ''
  if (/\.pdf(\?|$)/i.test(url)) {
    return pdfZuText(Buffer.from(await res.arrayBuffer()))
  }
  const html = await res.text()
  return html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

async function validiereTranskript(url: string): Promise<string | null> {
  const text = await ladeDokument(url)
  if (text.length < 800) return null
  if (!istEarningsCallTranskript(text) || istPresseMitteilung(text)) return null
  return text
}

type Q4Kandidat = { titel: string; url: string; callDatum: string | null; sortKey: string }

function kandidatenAusEvents(events: Q4Event[], basis: string): Q4Kandidat[] {
  const out: Q4Kandidat[] = []

  for (const e of events) {
    const titel = e.Title?.trim()
    if (!titel || !istEarningsCallEvent(titel)) continue

    const callDatum = parseQ4Datum(e.StartDate)
    const sortKey = callDatum || e.StartDate || ''

    for (const a of e.Attachments ?? []) {
      if (!istTranskriptAnhang(a)) continue
      const url = attachmentUrl(a)
      if (!url) continue
      out.push({
        titel: `${titel} — ${a.Title || 'Transcript'}`,
        url,
        callDatum,
        sortKey,
      })
    }

    if (e.Body) {
      for (const url of urlsAusEventBody(e.Body, basis)) {
        out.push({ titel: `${titel} — Transcript`, url, callDatum, sortKey })
      }
    }
  }

  out.sort((a, b) => b.sortKey.localeCompare(a.sortKey))
  const seen = new Set<string>()
  return out.filter((k) => {
    if (seen.has(k.url)) return false
    seen.add(k.url)
    return true
  })
}

export async function ladeQ4TranskriptHistorie(
  listenUrls: string[],
  q4BasisUrls: string[] = [],
  max = 8,
): Promise<IrRohesTranskript[]> {
  const basen = q4BasisKandidaten(listenUrls, q4BasisUrls)
  const out: IrRohesTranskript[] = []

  for (const basis of basen) {
    if (!(await testQ4Basis(basis))) continue
    const events = await ladeQ4Events(basis)
    if (!events.length) continue

    const kandidaten = kandidatenAusEvents(events, basis)
    for (const k of kandidaten) {
      if (out.length >= max) break
      const text = await validiereTranskript(k.url)
      if (!text) continue
      out.push({
        titel: k.titel,
        url: k.url,
        callDatum: k.callDatum,
        text,
      })
    }
    if (out.length >= max) return out
  }

  return out
}

export async function findeQ4Basis(listenUrls: string[], extra: string[] = []): Promise<string | null> {
  for (const basis of q4BasisKandidaten(listenUrls, extra)) {
    if (await testQ4Basis(basis)) return basis
  }
  return null
}
