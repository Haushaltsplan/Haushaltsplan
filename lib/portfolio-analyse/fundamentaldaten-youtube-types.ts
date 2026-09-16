export type YoutubeKanalVideo = {
  videoId: string
  channelId: string
  creator: string
  titel: string
  beschreibung: string
  publishedAt: string | null
  thumbnailUrl: string
}

export type YoutubeVideoTreffer = {
  videoId: string
  titel: string
  creator: string
  channelId: string
  publishedAt: string | null
  thumbnailUrl: string
  titelTreffer: boolean
}

export type YoutubeVideoPaket = {
  ok: boolean
  ticker: string
  videos: YoutubeVideoTreffer[]
}
