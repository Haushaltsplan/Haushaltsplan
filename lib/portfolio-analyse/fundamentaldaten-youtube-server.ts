import 'server-only'

import { decodeXmlText } from '@/lib/google-news-rss'
import { isinAusYahooSymbol, isinKenntnis } from '@/lib/portfolio-analyse/isin-kenntnisse'
import {
  hatYoutubeCreators,
  YOUTUBE_CREATORS,
  type YoutubeCreator,
} from '@/lib/portfolio-analyse/youtube-creator-whitelist'
import type {
  YoutubeKanalVideo,
  YoutubeVideoPaket,
  YoutubeVideoTreffer,
} from '@/lib/portfolio-analyse/fundamentaldaten-youtube-types'
import {
  ladeYoutubeKanalSync,
  ladeYoutubeVideosAusCache,
  speichereYoutubeKanalSync,
  speichereYoutubeVideosImCache,
} from '@/lib/portfolio-analyse/fundamentaldaten-youtube-cache-server'

export type { YoutubeVideoPaket, YoutubeVideoTreffer }

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'

const INNERTUBE_VERSION = '2.20250323.01.00'
/** Alte Caches mit englisch übersetzten DE-Titeln neu ziehen. */
const TITEL_ORIGINAL_AB = Date.parse('2026-09-16T18:00:00+02:00')

const JAHR_MS = 365 * 24 * 60 * 60 * 1000
const SYNC_FRISCH_MS = 6 * 60 * 60 * 1000
const MAX_SEITEN_JAHR = 16
const MAX_SEITEN_BACKFILL_PRO_LAUF = 2
const MAX_VIDEOS_PRO_KANAL = 8

/** Kurze/allgemeine Tickersymbole — nie als nacktes Wort in der Beschreibung matchen. */
const MEHRDEUTIGE_TICKER = new Set([
  'V',
  'MA',
  'HD',
  'WM',
  'LIN',
  'NOW',
  'META',
  'IT',
  'ON',
  'ALL',
  'ARE',
  'LOW',
  'KEY',
  'CAT',
  'FAST',
  'WELL',
  'BEST',
  'OPEN',
  'GROW',
  'REAL',
  'PLUS',
  'GOLD',
  'CASH',
  'BOND',
  'FUND',
  'TECH',
  'DATA',
  'AUTO',
  'FOOD',
  'PLAY',
  'LIVE',
  'NEWS',
  'RISK',
  'RATE',
  'PEAK',
  'CORE',
  'EDGE',
])

const TICKER_YOUTUBE_ALIASES: Record<string, string[]> = {
  GOOGL: ['Alphabet', 'Google'],
  GOOG: ['Alphabet', 'Google'],
  MSFT: ['Microsoft'],
  AAPL: ['Apple'],
  AMZN: ['Amazon'],
  META: ['Meta Platforms', 'Facebook'],
  FB: ['Meta Platforms', 'Facebook'],
  NVDA: ['Nvidia', 'NVIDIA'],
  TSLA: ['Tesla'],
  MA: ['Mastercard', 'MasterCard'],
  V: ['Visa'],
  MCD: ["McDonald's", 'McDonalds', 'McDonald'],
  WM: ['Waste Management'],
  HD: ['Home Depot'],
  UNH: ['UnitedHealth', 'United Health'],
  TMO: ['Thermo Fisher'],
  ASML: ['ASML'],
  RMS: ['Hermès', 'Hermes'],
  HRMS: ['Hermès', 'Hermes'],
  HESAY: ['Hermès', 'Hermes'],
  LIN: ['Linde'],
  NOW: ['ServiceNow'],
  SPGI: ['S&P Global', 'S&P'],
  MSCI: ['MSCI'],
  ODFL: ['Old Dominion'],
  UNP: ['Union Pacific'],
  ROL: ['Rollins'],
  CTAS: ['Cintas'],
  ANET: ['Arista'],
  DDOG: ['Datadog'],
  BCPC: ['Balchem'],
  ZTS: ['Zoetis'],
  RMD: ['ResMed', 'Resmed'],
  VEEV: ['Veeva'],
  KNSL: ['Kinsale'],
  GGG: ['Graco'],
  ATD: ['Couche-Tard', 'Couche Tard'],
  WKL: ['Wolters Kluwer'],
  SIKA: ['Sika'],
  STMN: ['Straumann'],
  HLMA: ['Halma'],
  SAUHY: ['Straumann'],
  SXYAY: ['Sika'],
  WTKWY: ['Wolters Kluwer'],
  LVMUY: ['LVMH', 'Louis Vuitton'],
  MC: ['LVMH', 'Louis Vuitton'],
  BRK: ['Berkshire Hathaway'],
  BRK_A: ['Berkshire Hathaway'],
  BRK_B: ['Berkshire Hathaway'],
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function normalisiere(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/['’]/g, '')
    .toLowerCase()
}

function tickerBasis(symbol: string): string {
  return symbol.trim().toUpperCase().split('.')[0] ?? ''
}

function istMehrdeutig(ticker: string): boolean {
  const t = tickerBasis(ticker)
  return t.length <= 2 || MEHRDEUTIGE_TICKER.has(t)
}

function baueYoutubeReferenzen(
  ticker: string,
  firmenname: string,
  symbolYahoo?: string | null,
): { ticker: string; aliases: string[] } {
  const basis = tickerBasis(ticker)
  const yahooBasis = tickerBasis(symbolYahoo ?? '')
  const isin =
    isinAusYahooSymbol(symbolYahoo ?? ticker) ??
    isinAusYahooSymbol(basis) ??
    (yahooBasis ? isinAusYahooSymbol(yahooBasis) : null)
  const kenName = isin ? isinKenntnis(isin)?.name?.trim() : null
  const nameClean = firmenname
    .replace(/\s*\([^)]*\)\s*/g, ' ')
    .replace(/\s+(Inc\.?|Corp\.?|Corporation|Ltd\.?|AG|SE|PLC|NV|Holding).*$/i, '')
    .replace(/\s+'[AC]'\s*$/i, '')
    .trim()

  const aliases = [
    ...(TICKER_YOUTUBE_ALIASES[basis] ?? []),
    ...(yahooBasis && yahooBasis !== basis ? (TICKER_YOUTUBE_ALIASES[yahooBasis] ?? []) : []),
    kenName,
    nameClean,
    firmenname.trim(),
  ]
    .filter((s): s is string => Boolean(s && s.trim().length >= 3))
    .filter((s) => normalisiere(s) !== normalisiere(basis))

  const unique: string[] = []
  const seen = new Set<string>()
  for (const a of aliases) {
    const k = normalisiere(a)
    if (!k || seen.has(k)) continue
    seen.add(k)
    unique.push(a.trim())
  }
  return { ticker: basis, aliases: unique }
}

function titelHatTicker(text: string, ticker: string): boolean {
  const t = tickerBasis(ticker)
  if (!t) return false
  if (istMehrdeutig(t)) {
    return new RegExp(
      `(?:\\$|\\(|\\[)${escapeRegex(t)}(?:\\)|\\]|\\b)|\\b${escapeRegex(t)}\\s*[:\\-]`,
      'i',
    ).test(text)
  }
  return new RegExp(`\\b${escapeRegex(t)}\\b`, 'i').test(text)
}

function textHatAlias(text: string, aliases: string[]): boolean {
  const n = normalisiere(text)
  if (!n) return false
  for (const alias of aliases) {
    const r = normalisiere(alias)
    if (r.length < 3) continue
    if (r.length <= 5) {
      if (new RegExp(`\\b${escapeRegex(r)}\\b`, 'i').test(n)) return true
    } else if (n.includes(r)) {
      return true
    }
  }
  return false
}

function videoPasst(
  titel: string,
  beschreibung: string,
  ticker: string,
  aliases: string[],
): { ok: boolean; titelTreffer: boolean } {
  const titelTreffer = titelHatTicker(titel, ticker) || textHatAlias(titel, aliases)
  if (titelTreffer) return { ok: true, titelTreffer: true }
  const descOk = istMehrdeutig(ticker)
    ? textHatAlias(beschreibung, aliases)
    : titelHatTicker(beschreibung, ticker) || textHatAlias(beschreibung, aliases)
  return { ok: descOk, titelTreffer: false }
}

function parseIso(raw: string | undefined): string | null {
  if (!raw) return null
  const s = decodeXmlText(raw)
  const t = Date.parse(s)
  return Number.isFinite(t) ? new Date(t).toISOString() : null
}

const RELATIV_MS: Record<string, number> = {
  second: 1000,
  minute: 60_000,
  hour: 3_600_000,
  day: 86_400_000,
  week: 7 * 86_400_000,
  month: Math.round(30.44 * 86_400_000),
  year: Math.round(365.25 * 86_400_000),
}

function parseRelativDatum(raw: string, now = Date.now()): string | null {
  const t = raw
    .toLowerCase()
    .replace(/^(streamed|premiered|edited|published)\s+/i, '')
    .trim()
  if (/^(just now|moments ago|now)$/i.test(t)) return new Date(now).toISOString()
  const en = t.match(/(\d+)\s*(second|minute|hour|day|week|month|year)s?\s+ago/)
  if (en) {
    const n = Number(en[1])
    const ms = RELATIV_MS[en[2] ?? '']
    if (!n || !ms) return null
    return new Date(now - n * ms).toISOString()
  }
  const de = t.match(/vor\s+(\d+)\s*(sekunde|minute|stunde|tag|woche|monat|jahr)/)
  if (de) {
    const n = Number(de[1])
    const map: Record<string, string> = {
      sekunde: 'second',
      minute: 'minute',
      stunde: 'hour',
      tag: 'day',
      woche: 'week',
      monat: 'month',
      jahr: 'year',
    }
    const ms = RELATIV_MS[map[de[2] ?? ''] ?? '']
    if (!n || !ms) return null
    return new Date(now - n * ms).toISOString()
  }
  return null
}

function textAusRuns(runs: unknown): string {
  if (!Array.isArray(runs)) return ''
  return runs
    .map((r) => (r && typeof r === 'object' && 'text' in r ? String((r as { text?: unknown }).text ?? '') : ''))
    .join('')
    .trim()
}

function uploadsPlaylistBrowseId(channelId: string): string {
  return `VLUU${channelId.trim().slice(2)}`
}

function walkSammeln(root: unknown, onNode: (obj: Record<string, unknown>) => void): void {
  const stack: unknown[] = [root]
  const seen = new Set<unknown>()
  while (stack.length) {
    const cur = stack.pop()
    if (!cur || typeof cur !== 'object') continue
    if (seen.has(cur)) continue
    seen.add(cur)
    onNode(cur as Record<string, unknown>)
    if (Array.isArray(cur)) {
      for (const v of cur) stack.push(v)
    } else {
      for (const v of Object.values(cur)) stack.push(v)
    }
  }
}

function datumAusLockup(meta: Record<string, unknown> | undefined): string | null {
  const rows = (
    meta?.lockupMetadataViewModel as
      | { metadata?: { contentMetadataViewModel?: { metadataRows?: Array<{ metadataParts?: Array<{ text?: { content?: string } }> }> } } }
      | undefined
  )?.metadata?.contentMetadataViewModel?.metadataRows
  if (!Array.isArray(rows)) return null
  for (const row of rows) {
    for (const part of row.metadataParts ?? []) {
      const content = part.text?.content?.trim() ?? ''
      const iso = parseRelativDatum(content)
      if (iso) return iso
    }
  }
  return null
}

function videoAusLockup(lockup: Record<string, unknown>, channelId: string, creatorName: string): YoutubeKanalVideo | null {
  if (lockup.contentType && lockup.contentType !== 'LOCKUP_CONTENT_TYPE_VIDEO') return null
  const videoId = String(lockup.contentId ?? '').trim()
  if (!videoId) return null
  const meta = lockup.metadata as Record<string, unknown> | undefined
  const titel = String(
    (meta?.lockupMetadataViewModel as { title?: { content?: string } } | undefined)?.title?.content ?? '',
  ).trim()
  if (!titel) return null
  const creator =
    String(
      (meta?.lockupMetadataViewModel as { metadata?: { contentMetadataViewModel?: { metadataRows?: Array<{ metadataParts?: Array<{ text?: { content?: string } }> }> } } } | undefined)
        ?.metadata?.contentMetadataViewModel?.metadataRows?.[0]?.metadataParts?.[0]?.text?.content ?? '',
    ).trim() || creatorName
  return {
    videoId,
    channelId,
    creator,
    titel,
    beschreibung: '',
    publishedAt: datumAusLockup(meta),
    thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,
  }
}

function videoAusPlaylistRenderer(
  renderer: Record<string, unknown>,
  channelId: string,
  creatorName: string,
): YoutubeKanalVideo | null {
  const videoId = String(renderer.videoId ?? '').trim()
  if (!videoId) return null
  const titel = textAusRuns((renderer.title as { runs?: unknown } | undefined)?.runs) || String((renderer.title as { simpleText?: string })?.simpleText ?? '').trim()
  if (!titel) return null
  const info = textAusRuns((renderer.videoInfo as { runs?: unknown } | undefined)?.runs)
  const byline = textAusRuns((renderer.shortBylineText as { runs?: unknown } | undefined)?.runs)
  return {
    videoId,
    channelId,
    creator: byline || creatorName,
    titel,
    beschreibung: '',
    publishedAt: parseRelativDatum(info.split('•').pop()?.trim() ?? info),
    thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,
  }
}

function parseInnertubeSeite(
  root: unknown,
  channelId: string,
  creatorName: string,
): { videos: YoutubeKanalVideo[]; continuation: string | null } {
  const videos: YoutubeKanalVideo[] = []
  const seen = new Set<string>()
  let continuation: string | null = null
  walkSammeln(root, (obj) => {
    if (obj.lockupViewModel && typeof obj.lockupViewModel === 'object') {
      const v = videoAusLockup(obj.lockupViewModel as Record<string, unknown>, channelId, creatorName)
      if (v && !seen.has(v.videoId)) {
        seen.add(v.videoId)
        videos.push(v)
      }
    }
    if (obj.playlistVideoRenderer && typeof obj.playlistVideoRenderer === 'object') {
      const v = videoAusPlaylistRenderer(obj.playlistVideoRenderer as Record<string, unknown>, channelId, creatorName)
      if (v && !seen.has(v.videoId)) {
        seen.add(v.videoId)
        videos.push(v)
      }
    }
    const cmd = obj.continuationCommand
    if (cmd && typeof cmd === 'object' && typeof (cmd as { token?: unknown }).token === 'string') {
      continuation = String((cmd as { token: string }).token)
    }
  })
  return { videos, continuation }
}

function kanalSprache(creator: YoutubeCreator): 'de' | 'en' {
  return creator.sprache === 'de' ? 'de' : 'en'
}

function innertubeClient(sprache: 'de' | 'en') {
  return sprache === 'de'
    ? { clientName: 'WEB' as const, clientVersion: INNERTUBE_VERSION, hl: 'de', gl: 'DE' }
    : { clientName: 'WEB' as const, clientVersion: INNERTUBE_VERSION, hl: 'en', gl: 'US' }
}

async function innertubeBrowse(body: Record<string, unknown>, sprache: 'de' | 'en'): Promise<unknown> {
  const res = await fetch('https://www.youtube.com/youtubei/v1/browse?prettyPrint=false', {
    method: 'POST',
    headers: {
      'User-Agent': USER_AGENT,
      'Content-Type': 'application/json',
      'Accept-Language': sprache === 'de' ? 'de-DE,de;q=0.9' : 'en-US,en;q=0.9',
      Origin: 'https://www.youtube.com',
      Referer: 'https://www.youtube.com/',
    },
    body: JSON.stringify({ context: { client: innertubeClient(sprache) }, ...body }),
  })
  if (!res.ok) return null
  return res.json()
}

function istAelterAlsEinJahr(publishedAt: string | null, now: number): boolean {
  if (!publishedAt) return false
  const t = Date.parse(publishedAt)
  return Number.isFinite(t) && now - t > JAHR_MS
}

async function ladeKanalRss(
  channelId: string,
  creatorName: string,
  sprache: 'de' | 'en',
): Promise<YoutubeKanalVideo[]> {
  const id = channelId.trim()
  if (!/^UC[\w-]{20,}$/.test(id)) return []
  const url = `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(id)}`
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.8',
        'Accept-Language': sprache === 'de' ? 'de-DE,de;q=0.9' : 'en-US,en;q=0.9',
      },
      next: { revalidate: 6 * 60 * 60 },
    })
    if (!res.ok) return []
    const xml = await res.text()
    const out: YoutubeKanalVideo[] = []
    const re = /<entry\b[^>]*>([\s\S]*?)<\/entry>/gi
    let m: RegExpExecArray | null
    while ((m = re.exec(xml)) && out.length < 20) {
      const block = m[1] ?? ''
      const videoId =
        decodeXmlText(block.match(/<yt:videoId>([^<]+)<\/yt:videoId>/i)?.[1] ?? '') ||
        (block.match(/watch\?v=([\w-]{6,})/i)?.[1] ?? '')
      if (!videoId) continue
      const titel = decodeXmlText(block.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '')
      if (!titel) continue
      const beschreibung = decodeXmlText(
        block.match(/<media:description\b[^>]*>([\s\S]*?)<\/media:description>/i)?.[1] ?? '',
      )
      const publishedAt = parseIso(block.match(/<published\b[^>]*>([\s\S]*?)<\/published>/i)?.[1])
      const author = decodeXmlText(block.match(/<author\b[^>]*>[\s\S]*?<name>([\s\S]*?)<\/name>/i)?.[1] ?? '')
      out.push({
        videoId,
        channelId: id,
        creator: author || creatorName,
        titel,
        beschreibung,
        publishedAt,
        thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,
      })
    }
    return out
  } catch {
    return []
  }
}

async function ladeInnertubeSeite(
  channelId: string,
  creatorName: string,
  continuation: string | null,
  sprache: 'de' | 'en',
): Promise<{ videos: YoutubeKanalVideo[]; continuation: string | null; ok: boolean }> {
  const data = continuation
    ? await innertubeBrowse({ continuation }, sprache)
    : await innertubeBrowse({ browseId: uploadsPlaylistBrowseId(channelId) }, sprache)
  if (!data) return { videos: [], continuation: null, ok: false }
  const parsed = parseInnertubeSeite(data, channelId, creatorName)
  return { ...parsed, ok: true }
}

async function syncKanalJahrUndBackfill(creator: YoutubeCreator, now: number): Promise<YoutubeKanalVideo[]> {
  const channelId = creator.channelId.trim()
  const sprache = kanalSprache(creator)
  const gesammelt: YoutubeKanalVideo[] = []
  const sync = (await ladeYoutubeKanalSync(channelId)) ?? {
    channelId,
    creator: creator.name,
    letzterJahrSyncAm: null,
    backfillFertig: false,
    backfillContinuation: null,
  }

  const jahrFrisch =
    sync.letzterJahrSyncAm != null &&
    now - sync.letzterJahrSyncAm < SYNC_FRISCH_MS &&
    sync.letzterJahrSyncAm >= TITEL_ORIGINAL_AB
  let backfillContinuation = sync.backfillContinuation
  let backfillFertig = sync.backfillFertig
  let jahrSyncAm = sync.letzterJahrSyncAm

  if (jahrFrisch && backfillFertig) return []

  if (!jahrFrisch) {
    let continuation: string | null = null
    let erste = true
    let seiten = 0
    let aelterGesehen = false
    let jahrOk = false
    while (seiten < MAX_SEITEN_JAHR && !aelterGesehen) {
      const seite = await ladeInnertubeSeite(channelId, creator.name, erste ? null : continuation, sprache)
      erste = false
      seiten++
      if (!seite.ok) break
      jahrOk = true
      gesammelt.push(...seite.videos)
      continuation = seite.continuation
      if (seite.videos.some((v) => istAelterAlsEinJahr(v.publishedAt, now))) aelterGesehen = true
      if (!continuation) {
        backfillFertig = true
        backfillContinuation = null
        break
      }
      if (aelterGesehen) {
        backfillContinuation = continuation
        break
      }
    }
    if (jahrOk) {
      jahrSyncAm = now
      if (!backfillFertig && continuation) backfillContinuation = continuation
    }
  }

  if (!backfillFertig && backfillContinuation) {
    let continuation: string | null = backfillContinuation
    let seiten = 0
    while (continuation && seiten < MAX_SEITEN_BACKFILL_PRO_LAUF) {
      const seite = await ladeInnertubeSeite(channelId, creator.name, continuation, sprache)
      seiten++
      if (!seite.ok) break
      gesammelt.push(...seite.videos)
      continuation = seite.continuation
      if (!continuation) {
        backfillFertig = true
        backfillContinuation = null
        break
      }
      backfillContinuation = continuation
    }
  }

  if (!jahrFrisch) {
    const rss = await ladeKanalRss(channelId, creator.name, sprache)
    gesammelt.push(...rss)
  }

  if (gesammelt.length) await speichereYoutubeVideosImCache(gesammelt)
  await speichereYoutubeKanalSync({
    channelId,
    creator: creator.name,
    letzterJahrSyncAm: jahrSyncAm,
    backfillFertig,
    backfillContinuation,
  })
  return gesammelt
}

function trefferAusVideos(
  videos: YoutubeKanalVideo[],
  basis: string,
  aliases: string[],
): YoutubeVideoTreffer[] {
  const seen = new Set<string>()
  const treffer: YoutubeVideoTreffer[] = []
  for (const v of videos) {
    if (seen.has(v.videoId)) continue
    const match = videoPasst(v.titel, v.beschreibung, basis, aliases)
    if (!match.ok) continue
    seen.add(v.videoId)
    treffer.push({
      videoId: v.videoId,
      titel: v.titel,
      creator: v.creator,
      channelId: v.channelId,
      publishedAt: v.publishedAt,
      thumbnailUrl: v.thumbnailUrl,
      titelTreffer: match.titelTreffer,
    })
  }
  treffer.sort((a, b) => {
    if (a.titelTreffer !== b.titelTreffer) return a.titelTreffer ? -1 : 1
    const ta = a.publishedAt ? Date.parse(a.publishedAt) : 0
    const tb = b.publishedAt ? Date.parse(b.publishedAt) : 0
    return tb - ta
  })

  const jeKanal = new Map<string, YoutubeVideoTreffer[]>()
  for (const t of treffer) {
    const list = jeKanal.get(t.channelId) ?? []
    if (list.length >= MAX_VIDEOS_PRO_KANAL) continue
    list.push(t)
    jeKanal.set(t.channelId, list)
  }
  const geordnet: YoutubeVideoTreffer[] = []
  const gesehen = new Set<string>()
  for (const c of YOUTUBE_CREATORS) {
    const list = jeKanal.get(c.channelId)
    if (!list?.length) continue
    gesehen.add(c.channelId)
    geordnet.push(...list)
  }
  for (const [id, list] of jeKanal) {
    if (gesehen.has(id)) continue
    geordnet.push(...list)
  }
  return geordnet
}

export async function ladeYoutubeVideosFuerTitel(opts: {
  ticker: string
  firmenname?: string | null
  symbolYahoo?: string | null
}): Promise<YoutubeVideoPaket> {
  const ticker = opts.ticker.trim().toUpperCase()
  if (!ticker || !hatYoutubeCreators()) {
    return { ok: true, ticker, videos: [] }
  }

  const { ticker: basis, aliases } = baueYoutubeReferenzen(
    ticker,
    opts.firmenname ?? ticker,
    opts.symbolYahoo,
  )

  const now = Date.now()
  const live: YoutubeKanalVideo[] = []
  await Promise.all(
    YOUTUBE_CREATORS.map(async (c) => {
      try {
        live.push(...(await syncKanalJahrUndBackfill(c, now)))
      } catch (e) {
        console.error('[youtube] sync', c.handle ?? c.channelId, e)
      }
    }),
  )

  const cached = await ladeYoutubeVideosAusCache(YOUTUBE_CREATORS.map((c) => c.channelId))
  const byId = new Map<string, YoutubeKanalVideo>()
  for (const v of [...cached, ...live]) {
    const prev = byId.get(v.videoId)
    if (!prev) {
      byId.set(v.videoId, v)
      continue
    }
    byId.set(v.videoId, {
      ...prev,
      ...v,
      titel: v.titel.trim() || prev.titel,
      beschreibung: v.beschreibung.trim() || prev.beschreibung,
      publishedAt: v.publishedAt ?? prev.publishedAt,
    })
  }

  return { ok: true, ticker: basis, videos: trefferAusVideos([...byId.values()], basis, aliases) }
}
