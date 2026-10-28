/** Startet eine resumable YouTube-Session. Die Datei lädt der Browser direkt zu Google. */
import 'server-only'

import { frischesYoutubeAccessToken } from '@/lib/youtube/youtube-oauth-server'

export type YoutubePrivacy = 'unlisted' | 'private' | 'public'

export async function starteYoutubeUpload(opts: {
  ownerUserId: string
  title: string
  description: string
  tags: string[]
  privacy: YoutubePrivacy
  dateigroesse: number
  origin: string
}): Promise<{ uploadUrl: string }> {
  if (opts.dateigroesse < 8_000 || opts.dateigroesse > 256 * 1024 * 1024) {
    throw new Error('MP4 fehlt oder ist zu groß.')
  }
  const tokens = await frischesYoutubeAccessToken(opts.ownerUserId)
  const meta = {
    snippet: {
      title: opts.title.slice(0, 100),
      description: opts.description.slice(0, 4900),
      tags: opts.tags.slice(0, 30),
      categoryId: '27',
    },
    status: {
      privacyStatus: opts.privacy,
      selfDeclaredMadeForKids: false,
      containsSyntheticMedia: true,
    },
  }

  const url = 'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status'
  const headers = {
    Authorization: `Bearer ${tokens.accessToken}`,
    'Content-Type': 'application/json; charset=UTF-8',
    'X-Upload-Content-Type': 'video/mp4',
    'X-Upload-Content-Length': String(opts.dateigroesse),
    Origin: opts.origin,
  }
  let res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(meta) })
  if (!res.ok && /containsSyntheticMedia|unknown|invalid/i.test(await res.clone().text())) {
    const ohne = { ...meta, status: { privacyStatus: opts.privacy, selfDeclaredMadeForKids: false } }
    res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(ohne) })
  }
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`YouTube Upload-Init ${res.status}: ${text.slice(0, 280)}`)
  }
  const uploadUrl = res.headers.get('location')
  if (!uploadUrl) throw new Error('YouTube lieferte keine Upload-URL.')
  return { uploadUrl }
}
