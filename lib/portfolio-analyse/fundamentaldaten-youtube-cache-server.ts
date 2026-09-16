import 'server-only'

import { createSupabaseAdmin } from '@/lib/supabase-admin'
import type { YoutubeKanalVideo } from '@/lib/portfolio-analyse/fundamentaldaten-youtube-types'

const TABLE_VIDEOS = 'fundamental_youtube_videos' as const
const TABLE_SYNC = 'fundamental_youtube_kanal_sync' as const

export type YoutubeKanalSync = {
  channelId: string
  creator: string
  letzterJahrSyncAm: number | null
  backfillFertig: boolean
  backfillContinuation: string | null
}

function cloudOk(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim())
}

function videoAusRow(row: Record<string, unknown>): YoutubeKanalVideo | null {
  const videoId = String(row.video_id ?? '').trim()
  const channelId = String(row.channel_id ?? '').trim()
  const titel = String(row.titel ?? '').trim()
  if (!videoId || !channelId || !titel) return null
  const published = row.published_at != null ? String(row.published_at) : null
  const ts = published ? Date.parse(published) : NaN
  return {
    videoId,
    channelId,
    creator: String(row.creator ?? '').trim() || channelId,
    titel,
    beschreibung: String(row.beschreibung ?? ''),
    publishedAt: Number.isFinite(ts) ? new Date(ts).toISOString() : null,
    thumbnailUrl:
      String(row.thumbnail_url ?? '').trim() || `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,
  }
}

export async function ladeYoutubeVideosAusCache(channelIds: string[]): Promise<YoutubeKanalVideo[]> {
  if (!cloudOk() || channelIds.length === 0) return []
  try {
    const { data, error } = await createSupabaseAdmin()
      .from(TABLE_VIDEOS)
      .select('video_id, channel_id, creator, titel, beschreibung, published_at, thumbnail_url')
      .in('channel_id', channelIds)
    if (error || !Array.isArray(data)) return []
    const out: YoutubeKanalVideo[] = []
    for (const row of data) {
      const v = videoAusRow(row as Record<string, unknown>)
      if (v) out.push(v)
    }
    return out
  } catch {
    return []
  }
}

export async function speichereYoutubeVideosImCache(videos: YoutubeKanalVideo[]): Promise<void> {
  if (!cloudOk() || videos.length === 0) return
  const byId = new Map<string, YoutubeKanalVideo>()
  for (const v of videos) {
    const prev = byId.get(v.videoId)
    if (!prev) {
      byId.set(v.videoId, v)
      continue
    }
    byId.set(v.videoId, {
      ...prev,
      ...v,
      beschreibung: v.beschreibung.trim() || prev.beschreibung,
      publishedAt: v.publishedAt ?? prev.publishedAt,
      creator: v.creator || prev.creator,
    })
  }
  const ids = [...byId.keys()]
  const altById = new Map<string, YoutubeKanalVideo>()
  try {
    const { data } = await createSupabaseAdmin()
      .from(TABLE_VIDEOS)
      .select('video_id, channel_id, creator, titel, beschreibung, published_at, thumbnail_url')
      .in('video_id', ids)
    for (const row of data ?? []) {
      const v = videoAusRow(row as Record<string, unknown>)
      if (v) altById.set(v.videoId, v)
    }
  } catch {
    /* Merge ohne Altbestand */
  }
  const rows = [...byId.values()].map((v) => {
    const alt = altById.get(v.videoId)
    return {
      video_id: v.videoId,
      channel_id: v.channelId,
      creator: v.creator || alt?.creator || v.channelId,
      titel: v.titel,
      beschreibung: v.beschreibung.trim() || alt?.beschreibung || '',
      published_at: v.publishedAt ?? alt?.publishedAt ?? null,
      thumbnail_url: v.thumbnailUrl || alt?.thumbnailUrl || `https://i.ytimg.com/vi/${v.videoId}/mqdefault.jpg`,
      aktualisiert_am: new Date().toISOString(),
    }
  })
  try {
    const admin = createSupabaseAdmin()
    for (let i = 0; i < rows.length; i += 80) {
      const { error } = await admin.from(TABLE_VIDEOS).upsert(rows.slice(i, i + 80), { onConflict: 'video_id' })
      if (error) console.error('[youtube-cache] upsert', error.message)
    }
  } catch (e) {
    console.error('[youtube-cache] speichern', e)
  }
}

export async function ladeYoutubeKanalSync(channelId: string): Promise<YoutubeKanalSync | null> {
  if (!cloudOk()) return null
  try {
    const { data, error } = await createSupabaseAdmin()
      .from(TABLE_SYNC)
      .select('channel_id, creator, letzter_jahr_sync_am, backfill_fertig, backfill_continuation')
      .eq('channel_id', channelId)
      .maybeSingle()
    if (error || !data) return null
    const row = data as Record<string, unknown>
    const at = row.letzter_jahr_sync_am != null ? Date.parse(String(row.letzter_jahr_sync_am)) : NaN
    return {
      channelId: String(row.channel_id ?? channelId),
      creator: String(row.creator ?? ''),
      letzterJahrSyncAm: Number.isFinite(at) ? at : null,
      backfillFertig: row.backfill_fertig === true,
      backfillContinuation:
        typeof row.backfill_continuation === 'string' && row.backfill_continuation.trim()
          ? row.backfill_continuation
          : null,
    }
  } catch {
    return null
  }
}

export async function speichereYoutubeKanalSync(sync: YoutubeKanalSync): Promise<void> {
  if (!cloudOk()) return
  try {
    const { error } = await createSupabaseAdmin().from(TABLE_SYNC).upsert(
      {
        channel_id: sync.channelId,
        creator: sync.creator,
        letzter_jahr_sync_am: sync.letzterJahrSyncAm ? new Date(sync.letzterJahrSyncAm).toISOString() : null,
        backfill_fertig: sync.backfillFertig,
        backfill_continuation: sync.backfillContinuation,
        aktualisiert_am: new Date().toISOString(),
      },
      { onConflict: 'channel_id' },
    )
    if (error) console.error('[youtube-cache] sync', error.message)
  } catch (e) {
    console.error('[youtube-cache] sync', e)
  }
}
