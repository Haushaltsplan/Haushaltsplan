/** Strava Phase 4 — Backfill-Fortschritt (Streams, Wetter, Segmente, Dekoupling). */

export type BackfillKategorie = 'streams' | 'weather' | 'segments' | 'decoupling'

export type BackfillKategorieStatus = {
  key: BackfillKategorie
  label: string
  pending: number
  complete: number
  total: number
  pct: number
  perRun: number
}

export type BackfillStatus = {
  categories: BackfillKategorieStatus[]
  totalPending: number
  allComplete: boolean
}

export const BACKFILL_PER_RUN: Record<BackfillKategorie, number> = {
  streams: 25,
  weather: 10,
  segments: 15,
  decoupling: 25,
}

function pct(complete: number, total: number): number {
  if (total <= 0) return 100
  return Math.min(100, Math.round((complete / total) * 100))
}

export function baueBackfillStatus(counts: {
  streamsPending: number
  streamsTotal: number
  weatherPending: number
  weatherTotal: number
  segmentsPending: number
  segmentsTotal: number
  decouplingPending: number
  decouplingTotal: number
}): BackfillStatus {
  const categories: BackfillKategorieStatus[] = [
    {
      key: 'streams',
      label: 'Power-Streams & HR-Zonen',
      pending: counts.streamsPending,
      total: counts.streamsTotal,
      complete: Math.max(0, counts.streamsTotal - counts.streamsPending),
      pct: pct(counts.streamsTotal - counts.streamsPending, counts.streamsTotal),
      perRun: BACKFILL_PER_RUN.streams,
    },
    {
      key: 'weather',
      label: 'Wetter-Anreicherung',
      pending: counts.weatherPending,
      total: counts.weatherTotal,
      complete: Math.max(0, counts.weatherTotal - counts.weatherPending),
      pct: pct(counts.weatherTotal - counts.weatherPending, counts.weatherTotal),
      perRun: BACKFILL_PER_RUN.weather,
    },
    {
      key: 'segments',
      label: 'Strava-Segmente',
      pending: counts.segmentsPending,
      total: counts.segmentsTotal,
      complete: Math.max(0, counts.segmentsTotal - counts.segmentsPending),
      pct: pct(counts.segmentsTotal - counts.segmentsPending, counts.segmentsTotal),
      perRun: BACKFILL_PER_RUN.segments,
    },
    {
      key: 'decoupling',
      label: 'Aerobe Dekoupling',
      pending: counts.decouplingPending,
      total: counts.decouplingTotal,
      complete: Math.max(0, counts.decouplingTotal - counts.decouplingPending),
      pct: pct(counts.decouplingTotal - counts.decouplingPending, counts.decouplingTotal),
      perRun: BACKFILL_PER_RUN.streams,
    },
  ]

  const totalPending = categories.reduce((s, c) => s + c.pending, 0)

  return {
    categories: categories.filter((c) => c.total > 0 || c.pending > 0),
    totalPending,
    allComplete: totalPending === 0,
  }
}
