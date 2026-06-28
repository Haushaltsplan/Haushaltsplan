/** Strava — Segment-Efforts (aus Activity-Detail-API). */

import { wattProKg } from '@/lib/strava/strava-auswertung'

export type StravaSegmentEffortRow = {
  strava_activity_id: number
  segment_id: number
  segment_name: string
  elapsed_time_s: number | null
  distance_m: number | null
  average_grade: number | null
  average_watts: number | null
  max_watts: number | null
  average_heartrate: number | null
  activity_start_date: string
  pr_rank: number | null
  kom_rank: number | null
}

export type SegmentPrEntry = {
  activityId: number
  date: string
  dateLabel: string
  elapsedSec: number
  elapsedLabel: string
  avgWatts: number | null
  avgWkg: number | null
  prRank: number | null
  komRank: number | null
  isPr: boolean
}

export type SegmentCluster = {
  segmentId: number
  name: string
  efforts: number
  distanceKm: number | null
  avgGrade: number | null
  bestElapsedSec: number | null
  bestElapsedLabel: string | null
  bestWatts: number | null
  bestWkg: number | null
  bestKomRank: number | null
  komEfforts: number
  trendPct: number | null
  entries: SegmentPrEntry[]
}

export type SegmentAnalytics = {
  clusters: SegmentCluster[]
  totalEfforts: number
  backlog: number
  komHighlights: SegmentKomHighlight[]
}

export type SegmentKomHighlight = {
  segmentId: number
  name: string
  bestKomRank: number
  bestElapsedLabel: string | null
  dateLabel: string
  efforts: number
}

function formatElapsed(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  if (m >= 60) {
    const h = Math.floor(m / 60)
    const rm = m % 60
    return `${h}:${String(rm).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }
  return `${m}:${String(s).padStart(2, '0')}`
}

export function berechneSegmentAnalytics(
  efforts: StravaSegmentEffortRow[],
  weightKg: number | null,
  segmentBacklog = 0,
): SegmentAnalytics {
  const map = new Map<number, StravaSegmentEffortRow[]>()

  for (const e of efforts) {
    const list = map.get(e.segment_id) ?? []
    list.push(e)
    map.set(e.segment_id, list)
  }

  const clusters: SegmentCluster[] = []

  for (const [segmentId, list] of map) {
    const sorted = [...list].sort(
      (a, b) => Date.parse(a.activity_start_date) - Date.parse(b.activity_start_date),
    )
    const name = sorted[0]?.segment_name || `Segment #${segmentId}`

    let bestElapsed: number | null = null
    let bestWatts: number | null = null

    const entries: SegmentPrEntry[] = sorted.map((e) => {
      const elapsed = e.elapsed_time_s ?? 0
      if (elapsed > 0 && (bestElapsed == null || elapsed < bestElapsed)) bestElapsed = elapsed
      const w = e.average_watts
      if (w != null && w > 0 && (bestWatts == null || w > bestWatts)) bestWatts = w
      const wkg = w != null ? wattProKg(w, weightKg) : null
      const isPr = e.pr_rank === 1
      return {
        activityId: e.strava_activity_id,
        date: e.activity_start_date,
        dateLabel: new Date(e.activity_start_date).toLocaleDateString('de-DE', {
          day: 'numeric',
          month: 'short',
          year: '2-digit',
        }),
        elapsedSec: elapsed,
        elapsedLabel: elapsed > 0 ? formatElapsed(elapsed) : '—',
        avgWatts: w != null ? Math.round(w) : null,
        avgWkg: wkg,
        prRank: e.pr_rank,
        komRank: e.kom_rank,
        isPr,
      }
    })

    const komRanks = sorted
      .map((e) => e.kom_rank)
      .filter((r): r is number => r != null && r > 0)
    const bestKomRank = komRanks.length > 0 ? Math.min(...komRanks) : null
    const komEfforts = komRanks.length

    const withTime = entries.filter((e) => e.elapsedSec > 0)
    if (withTime.length > 0) {
      const minT = Math.min(...withTime.map((e) => e.elapsedSec))
      for (const e of entries) {
        if (e.elapsedSec === minT) e.isPr = true
      }
    }

    let trendPct: number | null = null
    if (withTime.length >= 3) {
      const first = withTime[0].elapsedSec
      const last = withTime[withTime.length - 1].elapsedSec
      if (first > 0) trendPct = Math.round(((first - last) / first) * 100)
    }

    const dist = sorted[0]?.distance_m
    const grade = sorted[0]?.average_grade

    clusters.push({
      segmentId,
      name,
      efforts: list.length,
      distanceKm: dist != null ? Math.round((dist / 1000) * 10) / 10 : null,
      avgGrade: grade != null ? Math.round(grade * 10) / 10 : null,
      bestElapsedSec: bestElapsed,
      bestElapsedLabel: bestElapsed != null ? formatElapsed(bestElapsed) : null,
      bestWatts: bestWatts != null ? Math.round(bestWatts) : null,
      bestWkg: bestWatts != null ? wattProKg(bestWatts, weightKg) : null,
      bestKomRank,
      komEfforts,
      trendPct,
      entries: entries.slice(-8).reverse(),
    })
  }

  clusters.sort((a, b) => b.efforts - a.efforts)

  const komHighlights: SegmentKomHighlight[] = clusters
    .filter((c) => c.bestKomRank != null && c.bestKomRank <= 100)
    .sort((a, b) => (a.bestKomRank ?? 999) - (b.bestKomRank ?? 999))
    .slice(0, 8)
    .map((c) => ({
      segmentId: c.segmentId,
      name: c.name,
      bestKomRank: c.bestKomRank!,
      bestElapsedLabel: c.bestElapsedLabel,
      dateLabel: c.entries.find((e) => e.komRank === c.bestKomRank)?.dateLabel ?? '—',
      efforts: c.efforts,
    }))

  return {
    clusters: clusters.slice(0, 20),
    totalEfforts: efforts.length,
    backlog: segmentBacklog,
    komHighlights,
  }
}
