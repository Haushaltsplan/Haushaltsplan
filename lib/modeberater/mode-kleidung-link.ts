import type { CoachImagePart } from '@/lib/ki-coach-backend'
import type { ModeKleidungLinkKontext } from '@/lib/modeberater/mode-prompt'

const MAX_LINKS = 4
const FETCH_TIMEOUT_MS = 8_000
const MAX_HTML_BYTES = 220_000
const MAX_IMAGE_BYTES = 1_800_000
const UA = 'OmniaModeberater/1.0 (+private household app)'

function hostnameIstPrivat(host: string): boolean {
  const h = host.toLowerCase().replace(/^\[|\]$/g, '')
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local') || h === '0.0.0.0') return true
  if (h.includes(':')) {
    if (h === '::1' || h.startsWith('fe80:') || h.startsWith('fc') || h.startsWith('fd')) return true
  }
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h)
  if (!m) return false
  const a = Number(m[1])
  const b = Number(m[2])
  if (a === 10 || a === 127 || a === 0) return true
  if (a === 169 && b === 254) return true
  if (a === 192 && b === 168) return true
  if (a === 172 && b >= 16 && b <= 31) return true
  return false
}

export function oeffentlicheHttpsUrl(raw: string): URL | null {
  const t = raw.trim()
  if (!t) return null
  let u: URL
  try {
    u = new URL(t)
  } catch {
    return null
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
  if (hostnameIstPrivat(u.hostname)) return null
  return u
}

function metaInhalt(html: string, keys: string[]): string {
  for (const key of keys) {
    const re = new RegExp(
      `<meta[^>]+(?:property|name)=["']${key}["'][^>]+content=["']([^"']+)["']`,
      'i',
    )
    const m = re.exec(html) || new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${key}["']`,
      'i',
    ).exec(html)
    if (m?.[1]) return decodeHtml(m[1].trim())
  }
  return ''
}

function decodeHtml(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
}

function titelAusHtml(html: string): string {
  const og = metaInhalt(html, ['og:title', 'twitter:title'])
  if (og) return og.slice(0, 180)
  const m = /<title[^>]*>([^<]{1,200})<\/title>/i.exec(html)
  return m?.[1] ? decodeHtml(m[1].trim()).slice(0, 180) : ''
}

async function liesBegrenzt(res: Response, maxBytes: number): Promise<Buffer> {
  const len = Number(res.headers.get('content-length') || 0)
  if (len > 0 && len > maxBytes * 2) {
    throw new Error('zu groß')
  }
  const ab = await res.arrayBuffer()
  const buf = Buffer.from(ab)
  return buf.length > maxBytes ? buf.subarray(0, maxBytes) : buf
}

async function ladeOgBild(pageUrl: URL, imageUrlRaw: string): Promise<CoachImagePart | null> {
  let imgUrl: URL
  try {
    imgUrl = new URL(imageUrlRaw, pageUrl)
  } catch {
    return null
  }
  if (imgUrl.protocol !== 'http:' && imgUrl.protocol !== 'https:') return null
  if (hostnameIstPrivat(imgUrl.hostname)) return null
  try {
    const res = await fetch(imgUrl.toString(), {
      headers: { 'User-Agent': UA, Accept: 'image/jpeg,image/png,image/webp,image/*;q=0.8' },
      redirect: 'follow',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })
    if (!res.ok) return null
    const mime = (res.headers.get('content-type') || '').split(';')[0]?.trim().toLowerCase() || ''
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(mime)) return null
    const buf = await liesBegrenzt(res, MAX_IMAGE_BYTES)
    if (buf.length < 80) return null
    return { mimeType: mime, base64: buf.toString('base64') }
  } catch {
    return null
  }
}

export type ModeLinkFetchErgebnis = {
  kontext: ModeKleidungLinkKontext[]
  bilder: CoachImagePart[]
}

export async function ladeKleidungLinkKontext(urls: string[]): Promise<ModeLinkFetchErgebnis> {
  const gesehen = new Set<string>()
  const unique: URL[] = []
  for (const raw of urls) {
    const u = oeffentlicheHttpsUrl(raw)
    if (!u) continue
    const key = u.toString()
    if (gesehen.has(key)) continue
    gesehen.add(key)
    unique.push(u)
    if (unique.length >= MAX_LINKS) break
  }

  const kontext: ModeKleidungLinkKontext[] = []
  const bilder: CoachImagePart[] = []

  for (const u of unique) {
    const eintrag: ModeKleidungLinkKontext = { url: u.toString() }
    try {
      const res = await fetch(u.toString(), {
        headers: {
          'User-Agent': UA,
          Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
        },
        redirect: 'follow',
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      })
      if (!res.ok) {
        eintrag.beschreibung = `Shop-Seite nicht lesbar (HTTP ${res.status}).`
        kontext.push(eintrag)
        continue
      }
      const buf = await liesBegrenzt(res, MAX_HTML_BYTES)
      const html = buf.toString('utf8')
      eintrag.titel = titelAusHtml(html) || undefined
      const desc = metaInhalt(html, ['og:description', 'description', 'twitter:description'])
      if (desc) eintrag.beschreibung = desc.slice(0, 400)
      const preis =
        metaInhalt(html, ['product:price:amount', 'og:price:amount', 'price']) ||
        metaInhalt(html, ['product:price:currency'])
      if (preis) eintrag.preisHinweis = preis
      const ogImg = metaInhalt(html, ['og:image', 'og:image:url', 'twitter:image'])
      if (ogImg && bilder.length < 3) {
        const img = await ladeOgBild(u, ogImg)
        if (img) bilder.push(img)
      }
    } catch {
      eintrag.beschreibung = 'Shop-Seite konnte nicht geladen werden (Timeout oder blockiert).'
    }
    kontext.push(eintrag)
  }

  return { kontext, bilder }
}
