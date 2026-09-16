'use client'

import { useEffect, useMemo, useState, type MouseEvent } from 'react'
import { hatYoutubeCreators, YOUTUBE_CREATORS } from '@/lib/portfolio-analyse/youtube-creator-whitelist'
import type { YoutubeVideoTreffer } from '@/lib/portfolio-analyse/fundamentaldaten-youtube-types'

function formatVideoDatum(iso: string | null): string {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return ''
  }
}

function kanalName(channelId: string, fallback: string): string {
  return YOUTUBE_CREATORS.find((c) => c.channelId === channelId)?.name ?? fallback
}

function youtubeWatchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`
}

function istHandy(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  if (/iPhone|iPod|Android/i.test(ua)) return true
  if (/iPad/i.test(ua)) return true
  return navigator.maxTouchPoints > 1 && /Mac/i.test(ua)
}

function oeffneYoutubeVideo(videoId: string, ev: MouseEvent<HTMLAnchorElement>) {
  if (!istHandy()) return
  ev.preventDefault()
  const web = youtubeWatchUrl(videoId)
  const ua = navigator.userAgent
  if (/Android/i.test(ua)) {
    window.location.href =
      `intent://www.youtube.com/watch?v=${encodeURIComponent(videoId)}#Intent;scheme=https;package=com.google.android.youtube;S.browser_fallback_url=${encodeURIComponent(web)};end`
    return
  }
  window.location.href = `youtube://watch?v=${encodeURIComponent(videoId)}`
  window.setTimeout(() => {
    if (!document.hidden) window.location.href = web
  }, 800)
}

function gruppiereNachKanal(videos: YoutubeVideoTreffer[]): { channelId: string; name: string; videos: YoutubeVideoTreffer[] }[] {
  const buckets = new Map<string, YoutubeVideoTreffer[]>()
  for (const v of videos) {
    const list = buckets.get(v.channelId) ?? []
    list.push(v)
    buckets.set(v.channelId, list)
  }
  const out: { channelId: string; name: string; videos: YoutubeVideoTreffer[] }[] = []
  const gesehen = new Set<string>()
  for (const c of YOUTUBE_CREATORS) {
    const list = buckets.get(c.channelId)
    if (!list?.length) continue
    gesehen.add(c.channelId)
    out.push({ channelId: c.channelId, name: c.name, videos: list })
  }
  for (const [channelId, list] of buckets) {
    if (gesehen.has(channelId) || list.length === 0) continue
    out.push({ channelId, name: kanalName(channelId, list[0]!.creator), videos: list })
  }
  return out
}

export function PaFundamentalYoutubeLeiste({
  ticker,
  firmenname,
  symbolYahoo,
  selectionKey,
}: {
  ticker: string
  firmenname: string
  symbolYahoo?: string | null
  selectionKey?: string
}) {
  const [videos, setVideos] = useState<YoutubeVideoTreffer[]>([])

  useEffect(() => {
    if (!hatYoutubeCreators() || !ticker.trim()) return
    const ac = new AbortController()
    const params = new URLSearchParams({ ticker: ticker.trim() })
    if (firmenname.trim()) params.set('name', firmenname.trim())
    if (symbolYahoo?.trim()) params.set('symbol', symbolYahoo.trim())
    void fetch(`/api/portfolio-analyse/fundamentaldaten/youtube?${params}`, { signal: ac.signal })
      .then(async (res) => {
        const json = (await res.json()) as { ok?: boolean; videos?: YoutubeVideoTreffer[] }
        if (ac.signal.aborted) return
        setVideos(json.ok && Array.isArray(json.videos) ? json.videos : [])
      })
      .catch(() => {
        if (!ac.signal.aborted) setVideos([])
      })
    return () => ac.abort()
  }, [ticker, firmenname, symbolYahoo, selectionKey])

  const gruppen = useMemo(() => gruppiereNachKanal(videos), [videos])

  if (gruppen.length === 0) return null

  return (
    <section className="overflow-hidden rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-muted)] ring-1 ring-white/[0.03]">
      <div className="border-b border-white/[0.05] px-4 py-3">
        <h3 className="text-sm font-semibold text-[var(--app-text)]">Videos</h3>
        <p className="mt-0.5 text-[11px] text-[var(--app-text-muted)]">
          Ausgewählte Kanäle · Originaltitel · öffnet YouTube (am Handy die App)
        </p>
      </div>
      <div className="divide-y divide-white/[0.05]">
        {gruppen.map((g) => (
          <div key={g.channelId} className="px-4 py-3">
            <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-teal-300/90">{g.name}</h4>
            <ul className="space-y-1.5">
              {g.videos.map((v) => (
                  <li key={v.videoId}>
                    <a
                      href={youtubeWatchUrl(v.videoId)}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => oeffneYoutubeVideo(v.videoId, e)}
                      className="flex w-full items-start gap-3 rounded-lg border border-transparent p-1.5 text-left transition hover:border-[var(--app-border)] hover:bg-[var(--app-surface-hover)]"
                    >
                      <span className="relative w-[7.5rem] shrink-0 overflow-hidden rounded-md bg-black/40 sm:w-36">
                        <span className="relative block aspect-video">
                          {/* eslint-disable-next-line @next/next/no-img-element -- YouTube-Thumbnails */}
                          <img
                            src={v.thumbnailUrl}
                            alt=""
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                          <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/25">
                            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-black/70 text-white ring-1 ring-white/20">
                              <svg viewBox="0 0 24 24" className="ml-0.5 h-3.5 w-3.5 fill-current" aria-hidden>
                                <path d="M8 5.14v13.72L19.5 12 8 5.14z" />
                              </svg>
                            </span>
                          </span>
                        </span>
                      </span>
                      <span className="min-w-0 flex-1 py-0.5">
                        <span className="line-clamp-2 text-[13px] font-medium leading-snug text-[var(--app-text)]">
                          {v.titel}
                        </span>
                        {v.publishedAt ? (
                          <span className="mt-1 block text-[10px] text-[var(--app-text-muted)]">
                            {formatVideoDatum(v.publishedAt)}
                          </span>
                        ) : null}
                      </span>
                    </a>
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  )
}
