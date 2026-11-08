import 'server-only'

import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { firmenKurzname, phrasePasst } from '@/lib/youtube/youtube-keywords'
import {
  abstandTage,
  chanceStufe,
  chanceWert,
  engagementQuote,
  median,
  nachfragePunkte,
  outlierGegen,
  tempoAusDelta,
  tempoSeitUpload,
  wettbewerbPunkte,
  type VidiqVideo,
} from '@/lib/youtube/vidiq-engine'
import { frischesYoutubeAccessToken } from '@/lib/youtube/youtube-oauth-server'

const DATA = 'https://www.googleapis.com/youtube/v3'
const ANALYTICS = 'https://youtubeanalytics.googleapis.com/v2/reports'

type Roh = Record<string, unknown>

export class VidiqFehler extends Error {
  constructor(
    message: string,
    readonly brauchtReconnect = false,
  ) {
    super(message)
  }
}

async function googleJson(url: string, accessToken: string): Promise<Roh> {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } })
  const text = await res.text()
  let json: Roh = {}
  try {
    json = text ? (JSON.parse(text) as Roh) : {}
  } catch {
    json = {}
  }
  if (!res.ok) {
    const fehler = json.error as { message?: string; errors?: { reason?: string }[] } | undefined
    const reason = fehler?.errors?.[0]?.reason ?? ''
    const msg = fehler?.message || text.slice(0, 240) || `YouTube ${res.status}`
    const reconnect = res.status === 403 && /insufficient|scope|permission/i.test(`${reason} ${msg}`)
    throw new VidiqFehler(msg, reconnect)
  }
  return json
}

function num(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function text(v: unknown): string {
  return String(v ?? '').replace(/\s+/g, ' ').trim()
}

async function suggest(q: string): Promise<string[]> {
  try {
    const url = `https://suggestqueries.google.com/complete/search?client=firefox&ds=yt&hl=en&q=${encodeURIComponent(q)}`
    const res = await fetch(url, { signal: AbortSignal.timeout(4_000) })
    if (!res.ok) return []
    const j = (await res.json()) as unknown
    const liste = Array.isArray(j) && Array.isArray(j[1]) ? j[1] : []
    return liste.filter((x): x is string => typeof x === 'string')
  } catch {
    return []
  }
}

async function vorschlaege(ticker: string, firmenname: string, hook: string): Promise<{ begriffe: string[]; fragen: string[] }> {
  const name = firmenKurzname(firmenname) || ticker
  const stuecke = hook
    .replace(/[?]/g, '')
    .split(/\s+/)
    .filter((w) => w.length > 4)
    .slice(0, 3)
  const seeds = [`${name} moat`, `${name} stock`, `${ticker} stock`, `${ticker} moat`, ...stuecke.map((w) => `${name} ${w}`)]
  const einzig = [...new Set(seeds.map((s) => s.trim()).filter((s) => s.length >= 4))].slice(0, 5)
  const listen = await Promise.all(einzig.map((q) => suggest(q)))
  const begriffe: string[] = []
  const fragen: string[] = []
  const merke = (roh: string) => {
    const n = roh.replace(/\s+/g, ' ').trim()
    if (!phrasePasst(n, ticker, firmenname) && !n.toLowerCase().includes(name.toLowerCase())) return
    const ziel = /^(why|how|what|is|can|who)\b/i.test(n) ? fragen : begriffe
    if (ziel.some((u) => u.toLowerCase() === n.toLowerCase())) return
    ziel.push(n)
  }
  for (const liste of listen) {
    for (const s of liste) merke(s)
  }
  return { begriffe: begriffe.slice(0, 24), fragen: fragen.slice(0, 12) }
}

async function sucheShorts(accessToken: string, q: string): Promise<string[]> {
  const seit = new Date(Date.now() - 30 * 86_400_000).toISOString()
  const url = new URL(`${DATA}/search`)
  url.searchParams.set('part', 'snippet')
  url.searchParams.set('type', 'video')
  url.searchParams.set('videoDuration', 'short')
  url.searchParams.set('order', 'viewCount')
  url.searchParams.set('maxResults', '10')
  url.searchParams.set('publishedAfter', seit)
  url.searchParams.set('q', q)
  const json = await googleJson(url.toString(), accessToken)
  const items = Array.isArray(json.items) ? json.items : []
  const ids: string[] = []
  for (const item of items) {
    const id = text((item as Roh).id && ((item as Roh).id as Roh).videoId)
    if (id && !ids.includes(id)) ids.push(id)
  }
  return ids
}

type RohVideo = {
  id: string
  titel: string
  kanalId: string
  kanal: string
  veroeffentlicht: string
  views: number
  likes: number
  comments: number
  tags: string[]
  beschreibung: string
}

async function videosLaden(accessToken: string, ids: string[]): Promise<RohVideo[]> {
  const einzig = [...new Set(ids)].slice(0, 40)
  if (!einzig.length) return []
  const url = new URL(`${DATA}/videos`)
  url.searchParams.set('part', 'snippet,statistics')
  url.searchParams.set('id', einzig.join(','))
  url.searchParams.set('maxResults', '40')
  const json = await googleJson(url.toString(), accessToken)
  const items = Array.isArray(json.items) ? json.items : []
  return items.map((item) => {
    const roh = item as Roh
    const snippet = (roh.snippet ?? {}) as Roh
    const stats = (roh.statistics ?? {}) as Roh
    const tags = Array.isArray(snippet.tags) ? snippet.tags.map((t) => text(t)).filter(Boolean) : []
    return {
      id: text(roh.id),
      titel: text(snippet.title),
      kanalId: text(snippet.channelId),
      kanal: text(snippet.channelTitle),
      veroeffentlicht: text(snippet.publishedAt),
      views: num(stats.viewCount),
      likes: num(stats.likeCount),
      comments: num(stats.commentCount),
      tags,
      beschreibung: text(snippet.description).slice(0, 2000),
    }
  })
}

async function kanaeleLaden(accessToken: string, ids: string[]): Promise<Map<string, number>> {
  const map = new Map<string, number>()
  const einzig = [...new Set(ids)].filter(Boolean).slice(0, 50)
  if (!einzig.length) return map
  const url = new URL(`${DATA}/channels`)
  url.searchParams.set('part', 'statistics')
  url.searchParams.set('id', einzig.join(','))
  url.searchParams.set('maxResults', '50')
  const json = await googleJson(url.toString(), accessToken)
  const items = Array.isArray(json.items) ? json.items : []
  for (const item of items) {
    const roh = item as Roh
    const stats = (roh.statistics ?? {}) as Roh
    map.set(text(roh.id), num(stats.subscriberCount))
  }
  return map
}

function uploadsPlaylist(kanalId: string): string | null {
  if (!kanalId.startsWith('UC') || kanalId.length < 4) return null
  return `UU${kanalId.slice(2)}`
}

async function letzteVideoIds(accessToken: string, kanalId: string): Promise<string[]> {
  const playlist = uploadsPlaylist(kanalId)
  if (!playlist) return []
  const url = new URL(`${DATA}/playlistItems`)
  url.searchParams.set('part', 'contentDetails')
  url.searchParams.set('playlistId', playlist)
  url.searchParams.set('maxResults', '10')
  try {
    const json = await googleJson(url.toString(), accessToken)
    const items = Array.isArray(json.items) ? json.items : []
    return items
      .map((item) => text(((item as Roh).contentDetails as Roh | undefined)?.videoId))
      .filter(Boolean)
  } catch {
    return []
  }
}

async function vergleichsviews(accessToken: string, kanalIds: string[]): Promise<Map<string, number[]>> {
  const map = new Map<string, number[]>()
  const ids = [...new Set(kanalIds)].slice(0, 8)
  const videoIds: { kanalId: string; videoId: string }[] = []
  for (const kanalId of ids) {
    const liste = await letzteVideoIds(accessToken, kanalId)
    for (const videoId of liste) videoIds.push({ kanalId, videoId })
  }
  const geladen = await videosLaden(accessToken, videoIds.map((v) => v.videoId))
  const nachId = new Map(geladen.map((v) => [v.id, v.views]))
  for (const eintrag of videoIds) {
    const views = nachId.get(eintrag.videoId)
    if (views == null) continue
    const bisher = map.get(eintrag.kanalId) ?? []
    bisher.push(views)
    map.set(eintrag.kanalId, bisher)
  }
  return map
}

type Stand = { views: number; at: string }

async function letzterStand(owner: string, videoId: string): Promise<Stand | null> {
  try {
    const { data } = await createSupabaseAdmin()
      .from('youtube_vidiq_snapshot')
      .select('view_count, captured_at')
      .eq('owner_user_id', owner)
      .eq('video_id', videoId)
      .order('captured_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (!data) return null
    return { views: num(data.view_count), at: String(data.captured_at) }
  } catch {
    return null
  }
}

async function standSchreiben(owner: string, videoId: string, views: number, likes: number): Promise<void> {
  try {
    await createSupabaseAdmin().from('youtube_vidiq_snapshot').insert({
      owner_user_id: owner,
      video_id: videoId,
      view_count: views,
      like_count: likes,
    })
  } catch {
    /* Tabelle kann fehlen, der Abruf bleibt nutzbar. */
  }
}

function ohneEigenes(views: number, liste: number[]): number[] {
  const i = liste.indexOf(views)
  if (i < 0) return liste
  return [...liste.slice(0, i), ...liste.slice(i + 1)]
}

async function karteBauen(
  owner: string,
  video: RohVideo,
  abonnenten: number,
  vergleich: number[],
): Promise<VidiqVideo> {
  const vorher = await letzterStand(owner, video.id)
  const delta =
    vorher == null ? null : tempoAusDelta(vorher.views, video.views, (Date.now() - Date.parse(vorher.at)) / 3_600_000)
  await standSchreiben(owner, video.id, video.views, video.likes)
  return {
    id: video.id,
    titel: video.titel,
    kanalId: video.kanalId,
    kanal: video.kanal,
    veroeffentlicht: video.veroeffentlicht,
    views: video.views,
    likes: video.likes,
    comments: video.comments,
    abonnenten,
    tags: video.tags,
    beschreibung: video.beschreibung,
    tempoSeitUpload: tempoSeitUpload(video.views, video.veroeffentlicht),
    tempoDelta: delta,
    engagement: engagementQuote(video.likes, video.comments, video.views),
    outlier: outlierGegen(video.views, ohneEigenes(video.views, vergleich)),
  }
}

async function cacheLesen(owner: string, key: string): Promise<unknown | null> {
  try {
    const { data } = await createSupabaseAdmin()
      .from('youtube_vidiq_cache')
      .select('payload, expires_at')
      .eq('owner_user_id', owner)
      .eq('cache_key', key)
      .maybeSingle()
    if (!data) return null
    if (Date.parse(String(data.expires_at)) < Date.now()) return null
    return data.payload
  } catch {
    return null
  }
}

async function cacheSchreiben(owner: string, key: string, payload: unknown, stunden: number): Promise<void> {
  try {
    await createSupabaseAdmin().from('youtube_vidiq_cache').upsert({
      owner_user_id: owner,
      cache_key: key,
      payload,
      expires_at: new Date(Date.now() + stunden * 3_600_000).toISOString(),
    })
  } catch {
    /* Cache ist optional. */
  }
}

export async function ladeNische(opts: {
  ownerUserId: string
  ticker: string
  firmenname: string
  hook: string
}): Promise<Record<string, unknown>> {
  const name = firmenKurzname(opts.firmenname) || opts.ticker
  const haupt = `${name} moat`
  const zweite = `${name} stock`
  const key = `nische:${opts.ticker}:${haupt}`.toLowerCase()
  const cache = await cacheLesen(opts.ownerUserId, key)
  if (cache && typeof cache === 'object') return { ...(cache as Record<string, unknown>), ausCache: true }

  const token = await frischesYoutubeAccessToken(opts.ownerUserId)
  const phrasen = await vorschlaege(opts.ticker, opts.firmenname, opts.hook)
  const [idsA, idsB] = await Promise.all([
    sucheShorts(token.accessToken, haupt),
    sucheShorts(token.accessToken, zweite),
  ])
  const ids = [...new Set([...idsA, ...idsB])].slice(0, 15)
  const roh = await videosLaden(token.accessToken, ids)
  const kanaele = await kanaeleLaden(token.accessToken, roh.map((v) => v.kanalId))
  const vergleich = await vergleichsviews(token.accessToken, roh.map((v) => v.kanalId))
  const videos: VidiqVideo[] = []
  for (const video of roh) {
    videos.push(await karteBauen(opts.ownerUserId, video, kanaele.get(video.kanalId) ?? 0, vergleich.get(video.kanalId) ?? []))
  }
  const nachfrage = nachfragePunkte(phrasen.begriffe, phrasen.fragen, name)
  const wettbewerb = wettbewerbPunkte(videos)
  const chance = chanceWert(nachfrage, wettbewerb)
  const payload = {
    ok: true,
    haupt,
    begriffe: phrasen.begriffe,
    fragen: phrasen.fragen,
    nachfrage,
    wettbewerb,
    chance,
    stufe: chanceStufe(chance),
    videos,
    luecken: [
      'Monatliches Suchvolumen gibt die API nicht her.',
      'Feed-Impressionen, Swipe-Quote und die Studio-Echtzeit der letzten 48 Stunden fehlen.',
    ],
  }
  await cacheSchreiben(opts.ownerUserId, key, payload, 12)
  return { ...payload, ausCache: false }
}

export async function ladeVideo(opts: { ownerUserId: string; videoId: string }): Promise<Record<string, unknown>> {
  const key = `video:${opts.videoId}`
  const cache = await cacheLesen(opts.ownerUserId, key)
  if (cache && typeof cache === 'object') return { ...(cache as Record<string, unknown>), ausCache: true }
  const token = await frischesYoutubeAccessToken(opts.ownerUserId)
  const roh = await videosLaden(token.accessToken, [opts.videoId])
  const video = roh[0]
  if (!video) throw new VidiqFehler('Dieses Video ist nicht öffentlich oder die ID stimmt nicht.')
  const kanaele = await kanaeleLaden(token.accessToken, [video.kanalId])
  const letzte = await videosLaden(token.accessToken, await letzteVideoIds(token.accessToken, video.kanalId))
  const karte = await karteBauen(
    opts.ownerUserId,
    video,
    kanaele.get(video.kanalId) ?? 0,
    letzte.map((v) => v.views),
  )
  const payload = {
    ok: true,
    video: karte,
    kanal: {
      abonnenten: karte.abonnenten,
      letzteViews: median(letzte.map((v) => v.views)),
      abstandTage: abstandTage(letzte.map((v) => v.veroeffentlicht)),
      letzterUpload: letzte.map((v) => v.veroeffentlicht).sort().at(-1) ?? video.veroeffentlicht,
    },
  }
  await cacheSchreiben(opts.ownerUserId, key, payload, 6)
  return { ...payload, ausCache: false }
}

function isoTag(tageZurueck: number): string {
  const d = new Date(Date.now() - tageZurueck * 86_400_000)
  return d.toISOString().slice(0, 10)
}

type Zeile = Record<string, number | string>

function zeilenAusReport(json: Roh): Zeile[] {
  const headers = Array.isArray(json.columnHeaders) ? json.columnHeaders : []
  const namen = headers.map((h) => text((h as Roh).name))
  const rows = Array.isArray(json.rows) ? json.rows : []
  return rows.map((row) => {
    const werte = Array.isArray(row) ? row : []
    const zeile: Zeile = {}
    namen.forEach((name, i) => {
      const wert = werte[i]
      zeile[name] = typeof wert === 'number' || typeof wert === 'string' ? wert : num(wert)
    })
    return zeile
  })
}

async function report(accessToken: string, channelId: string, params: Record<string, string>): Promise<Zeile[]> {
  const url = new URL(ANALYTICS)
  url.searchParams.set('ids', `channel==${channelId}`)
  url.searchParams.set('startDate', isoTag(28))
  url.searchParams.set('endDate', isoTag(2))
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const json = await googleJson(url.toString(), accessToken)
  return zeilenAusReport(json)
}

const QUELLE: Record<string, string> = {
  SHORTS: 'Shorts-Feed',
  YT_SEARCH: 'Suche',
  RELATED_VIDEO: 'Vorschläge',
  EXT_URL: 'Extern',
  SUBSCRIBER: 'Abonnenten',
  NOTIFICATION: 'Hinweise',
  YT_CHANNEL: 'Kanal',
  END_SCREEN: 'Abspann',
  NO_LINK_OTHER: 'Sonstige',
}

function naechsterPunkt(zeilen: Zeile[], ziel: number): number | null {
  let beste: Zeile | null = null
  let abstand = 1
  for (const zeile of zeilen) {
    const ratio = num(zeile.elapsedVideoTimeRatio)
    const diff = Math.abs(ratio - ziel)
    if (diff < abstand) {
      abstand = diff
      beste = zeile
    }
  }
  if (!beste) return null
  const quote = num(beste.audienceWatchRatio)
  return quote > 0 ? quote : null
}

export async function ladeAnalytics(ownerUserId: string): Promise<Record<string, unknown>> {
  const key = 'analytics:shorts'
  const cache = await cacheLesen(ownerUserId, key)
  if (cache && typeof cache === 'object') return { ...(cache as Record<string, unknown>), ausCache: true }

  const token = await frischesYoutubeAccessToken(ownerUserId)
  if (!token.channelId) throw new VidiqFehler('Kein Kanal am Token. Bitte YouTube erneut verbinden.', true)
  const basis = 'views,estimatedMinutesWatched,averageViewDuration,averageViewPercentage,likes,comments,shares,subscribersGained,subscribersLost'
  let kurz: Zeile[] = []
  try {
    kurz = await report(token.accessToken, token.channelId, {
      dimensions: 'creatorContentType',
      metrics: `engagedViews,${basis}`,
    })
  } catch (e) {
    if (e instanceof VidiqFehler && e.brauchtReconnect) throw e
    kurz = await report(token.accessToken, token.channelId, { dimensions: 'creatorContentType', metrics: basis })
  }
  const shorts = kurz.find((z) => text(z.creatorContentType) === 'SHORTS') ?? {}
  let quellen: { quelle: string; views: number }[] = []
  try {
    const traffic = await report(token.accessToken, token.channelId, {
      dimensions: 'insightTrafficSourceType,creatorContentType',
      metrics: 'views',
      sort: '-views',
      maxResults: '25',
    })
    const nurShorts = traffic.filter((z) => text(z.creatorContentType) === 'SHORTS')
    const quelleMap = new Map<string, number>()
    for (const zeile of nurShorts.length ? nurShorts : traffic) {
      const name = QUELLE[text(zeile.insightTrafficSourceType)] ?? text(zeile.insightTrafficSourceType)
      quelleMap.set(name, (quelleMap.get(name) ?? 0) + num(zeile.views))
    }
    quellen = [...quelleMap.entries()].map(([quelle, views]) => ({ quelle, views })).sort((a, b) => b.views - a.views)
  } catch (e) {
    if (e instanceof VidiqFehler && e.brauchtReconnect) throw e
  }
  let laender: { land: string; views: number }[] = []
  try {
    const land = await report(token.accessToken, token.channelId, {
      dimensions: 'country,creatorContentType',
      metrics: 'views',
      sort: '-views',
      maxResults: '25',
    })
    laender = land
      .filter((z) => text(z.creatorContentType) === 'SHORTS')
      .slice(0, 5)
      .map((z) => ({ land: text(z.country), views: num(z.views) }))
  } catch (e) {
    if (e instanceof VidiqFehler && e.brauchtReconnect) throw e
  }

  let videoId: string | null = null
  let halte: { bei: number; quote: number }[] | null = null
  try {
    const suche = new URL(`${DATA}/search`)
    suche.searchParams.set('part', 'id')
    suche.searchParams.set('forMine', 'true')
    suche.searchParams.set('type', 'video')
    suche.searchParams.set('videoDuration', 'short')
    suche.searchParams.set('order', 'date')
    suche.searchParams.set('maxResults', '1')
    const json = await googleJson(suche.toString(), token.accessToken)
    const erstes = Array.isArray(json.items) ? (json.items[0] as Roh | undefined) : undefined
    videoId = erstes ? text((erstes.id as Roh | undefined)?.videoId) : null
    if (videoId) {
      const kurve = await report(token.accessToken, token.channelId, {
        dimensions: 'elapsedVideoTimeRatio',
        metrics: 'audienceWatchRatio',
        filters: `video==${videoId}`,
      })
      const punkte = [0.25, 0.5, 0.75, 1].map((bei) => {
        const quote = naechsterPunkt(kurve, bei)
        return quote == null ? null : { bei: Math.round(bei * 100), quote }
      })
      halte = punkte.every((p) => p) ? (punkte as { bei: number; quote: number }[]) : null
    }
  } catch {
    videoId = null
    halte = null
  }

  const payload = {
    ok: true,
    verzug: 'Stand von vor 1–2 Tagen',
    shorts: {
      views: num(shorts.views),
      engagedViews: num(shorts.engagedViews),
      averageViewDuration: num(shorts.averageViewDuration),
      averageViewPercentage: num(shorts.averageViewPercentage),
      likes: num(shorts.likes),
      comments: num(shorts.comments),
      shares: num(shorts.shares),
      subscribersGained: num(shorts.subscribersGained),
      subscribersLost: num(shorts.subscribersLost),
      minutes: num(shorts.estimatedMinutesWatched),
    },
    quellen,
    laender,
    halte,
    videoId,
    nichtVerfuegbar: ['Feed-Impressionen', 'Swipe-Quote', 'Echtzeit der letzten 48 Stunden'],
  }
  await cacheSchreiben(ownerUserId, key, payload, 6)
  return { ...payload, ausCache: false }
}

export async function pruefeRanking(opts: { ownerUserId: string; videoId: string; phrase: string }): Promise<Record<string, unknown>> {
  const key = `rank:${opts.videoId}:${opts.phrase}`.toLowerCase()
  const cache = await cacheLesen(opts.ownerUserId, key)
  if (cache && typeof cache === 'object') return { ...(cache as Record<string, unknown>), ausCache: true }
  const token = await frischesYoutubeAccessToken(opts.ownerUserId)
  const ids = await sucheShorts(token.accessToken, opts.phrase)
  const platz = ids.indexOf(opts.videoId)
  const payload = { ok: true, phrase: opts.phrase, platz: platz >= 0 ? platz + 1 : null, geprueft: ids.length }
  await cacheSchreiben(opts.ownerUserId, key, payload, 6)
  return { ...payload, ausCache: false }
}
