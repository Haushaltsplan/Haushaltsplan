'use client'

import { useEffect, useState } from 'react'
import { hatYoutubeCreators } from '@/lib/portfolio-analyse/youtube-creator-whitelist'
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
  const [aktivId, setAktivId] = useState<string | null>(null)

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

  if (videos.length === 0) return null

  const aktiv = videos.find((v) => v.videoId === aktivId) ?? null

  return (
    <section className="overflow-hidden rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-muted)] ring-1 ring-white/[0.03]">
      <div className="border-b border-white/[0.05] px-4 py-3">
        <h3 className="text-sm font-semibold text-[var(--app-text)]">Videos</h3>
        <p className="mt-0.5 text-[11px] text-[var(--app-text-muted)]">
          Ausgewählte Kanäle · Klick startet den Player
        </p>
      </div>
      <div className="app-h-scroll flex gap-3 overflow-x-auto px-4 py-3 [scrollbar-width:thin]">
        {videos.map((v) => {
          const an = v.videoId === aktivId
          return (
            <button
              key={v.videoId}
              type="button"
              aria-pressed={an}
              onClick={() => setAktivId((id) => (id === v.videoId ? null : v.videoId))}
              className={`w-[13.5rem] shrink-0 overflow-hidden rounded-lg border text-left transition ${
                an
                  ? 'border-teal-500/50 ring-1 ring-teal-400/40'
                  : 'border-[var(--app-border)] hover:border-teal-500/30 hover:bg-[var(--app-surface-hover)]'
              }`}
            >
              <span className="relative block aspect-video bg-black/40">
                {/* eslint-disable-next-line @next/next/no-img-element -- YouTube-Thumbnails */}
                <img
                  src={v.thumbnailUrl}
                  alt=""
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
                <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/25">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-black/70 text-white ring-1 ring-white/20">
                    <svg viewBox="0 0 24 24" className="ml-0.5 h-4 w-4 fill-current" aria-hidden>
                      <path d="M8 5.14v13.72L19.5 12 8 5.14z" />
                    </svg>
                  </span>
                </span>
              </span>
              <span className="block space-y-1 px-2.5 py-2">
                <span className="line-clamp-2 text-[12px] font-medium leading-snug text-[var(--app-text)]">
                  {v.titel}
                </span>
                <span className="flex flex-wrap gap-x-2 text-[10px] text-[var(--app-text-muted)]">
                  <span>{v.creator}</span>
                  {v.publishedAt ? <span>{formatVideoDatum(v.publishedAt)}</span> : null}
                </span>
              </span>
            </button>
          )
        })}
      </div>
      {aktiv ? (
        <div className="border-t border-white/[0.05] px-4 py-3">
          <div className="mx-auto aspect-video max-w-3xl overflow-hidden rounded-lg bg-black">
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(aktiv.videoId)}?autoplay=1`}
              title={aktiv.titel}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              className="h-full w-full border-0"
            />
          </div>
        </div>
      ) : null}
    </section>
  )
}
