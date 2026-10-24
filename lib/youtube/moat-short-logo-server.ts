/**
 * Wählt ein drucktaugliches Firmenlogo (kein Favicon) und legt es lokal ab,
 * damit Vorschau und Remotion-Export dieselbe Datei nutzen.
 */
import { existsSync } from 'node:fs'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { portfolioLogoQuellen } from '@/lib/portfolio-analyse/portfolio-logos'
import { alleLogoUrls } from '@/lib/stock-logo-urls'
import { originaleLogoQuelle } from '@/lib/youtube/moat-short-media-src'

const CACHE_ORDNER = 'youtube-logos'
const MIN_BYTES = 4_000
const MAX_BYTES = 2_000_000

const LOGO_HOSTS = new Set([
  'static2.finnhub.io',
  'companiesmarketcap.com',
  'www.companiesmarketcap.com',
  'financialmodelingprep.com',
  'images.financialmodelingprep.com',
  'logo.clearbit.com',
])

export function istErlaubteLogoQuelle(url: string): boolean {
  try {
    const u = new URL(url)
    if (u.protocol !== 'https:') return false
    return LOGO_HOSTS.has(u.hostname.toLowerCase())
  } catch {
    return false
  }
}

export function logoProxyPfad(url: string): string {
  return `/api/youtube/logo?u=${encodeURIComponent(originaleLogoQuelle(url))}`
}

function hostAusWebsite(website: string | null | undefined): string | null {
  if (!website?.trim()) return null
  try {
    return new URL(website.includes('://') ? website : `https://${website}`).hostname.replace(/^www\./, '') || null
  } catch {
    return null
  }
}

function publicPfad(rel: string): string {
  return path.join(process.cwd(), 'public', ...rel.replace(/^\/+/, '').split('/'))
}

function istLokaleDatei(rel: string | undefined): string | null {
  if (!rel) return null
  const norm = rel.replace(/^\/+/, '')
  return existsSync(publicPfad(norm)) ? norm : null
}

async function ladeBild(url: string): Promise<{ bytes: Buffer; ext: string } | null> {
  if (url.startsWith('/')) {
    const rel = url.replace(/^\/+/, '')
    if (!existsSync(publicPfad(rel))) return null
    const bytes = await fs.readFile(publicPfad(rel))
    return bytes.length >= MIN_BYTES ? { bytes, ext: path.extname(rel).slice(1) || 'png' } : null
  }
  try {
    const res = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(8_000) })
    if (!res.ok) return null
    const typ = (res.headers.get('content-type') ?? '').toLowerCase()
    if (typ && !typ.includes('image') && !typ.includes('octet-stream')) return null
    const bytes = Buffer.from(await res.arrayBuffer())
    if (bytes.length < MIN_BYTES || bytes.length > MAX_BYTES) return null
    const ext = typ.includes('jpeg') || typ.includes('jpg') ? 'jpg' : typ.includes('webp') ? 'webp' : typ.includes('svg') ? 'svg' : 'png'
    return { bytes, ext }
  } catch {
    return null
  }
}

async function speichereCache(ticker: string, bild: { bytes: Buffer; ext: string }): Promise<string | null> {
  if (process.env.VERCEL) return null
  const name = `${ticker.replace(/[^A-Z0-9]/gi, '').toUpperCase() || 'LOGO'}.${bild.ext}`
  const rel = `${CACHE_ORDNER}/${name}`
  try {
    await fs.mkdir(path.join(process.cwd(), 'public', CACHE_ORDNER), { recursive: true })
    await fs.writeFile(publicPfad(rel), bild.bytes)
    return rel
  } catch {
    return null
  }
}

/** Öffentlicher Pfad relativ zu `public/` oder null. */
export async function findeMoatShortLogo(opts: {
  ticker: string
  firmenname: string
  isin: string | null
  website: string | null
  symbolYahoo: string | null
}): Promise<string | null> {
  const ticker = (opts.symbolYahoo?.split('.')[0] || opts.ticker).trim().toUpperCase()
  const yahoo = opts.symbolYahoo?.trim() || ticker
  const quelle = portfolioLogoQuellen(opts.isin, yahoo, opts.firmenname)
  const host = hostAusWebsite(opts.website)
  const domains = [...(quelle.clearbitDomains ?? [])]
  if (host && !domains.includes(host)) domains.push(host)

  const lokal = istLokaleDatei(quelle.localPath)
  if (lokal) return lokal

  const cacheTreffer = ['png', 'jpg', 'webp', 'svg']
    .map((ext) => `${CACHE_ORDNER}/${ticker}.${ext}`)
    .find((rel) => istLokaleDatei(rel))
  if (cacheTreffer) return cacheTreffer

  const kandidaten = alleLogoUrls(yahoo, {
    finnhubSlug: quelle.finnhubSlug || ticker,
    clearbitDomains: domains,
  }).filter((u) => u.startsWith('http'))

  const treffer = (
    await Promise.all(
      kandidaten.map(async (url) => {
        const bild = await ladeBild(url)
        return bild ? { url, ...bild } : null
      }),
    )
  ).filter((x): x is { url: string; bytes: Buffer; ext: string } => x != null)
  treffer.sort((a, b) => b.bytes.length - a.bytes.length)
  const best = treffer[0]
  if (!best) return null
  return (await speichereCache(ticker, best)) ?? logoProxyPfad(best.url)
}

export async function ladeLogoProxy(url: string): Promise<{ bytes: Buffer; typ: string } | null> {
  if (!istErlaubteLogoQuelle(url)) return null
  const bild = await ladeBild(url)
  if (!bild) return null
  const typ = bild.ext === 'jpg' ? 'image/jpeg' : bild.ext === 'webp' ? 'image/webp' : bild.ext === 'svg' ? 'image/svg+xml' : 'image/png'
  return { bytes: bild.bytes, typ }
}
