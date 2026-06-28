'use client'

import { STRAVA_INTERACTIVE } from '@/components/strava/design-tokens'
import { StravaCard, StravaSectionTitle } from '@/components/strava/strava-card'
import { STRAVA_PANEL_INFO } from '@/lib/strava/strava-panel-info'
import type { RouteAnalytics } from '@/lib/strava/strava-route-analytics'
import type { SegmentAnalytics } from '@/lib/strava/strava-segments'
import { useState } from 'react'

type Tab = 'segments' | 'routes'

export function StravaStreckenPrPanel({
  segments,
  routes,
}: {
  segments: SegmentAnalytics
  routes: RouteAnalytics
}) {
  const [tab, setTab] = useState<Tab>(segments.clusters.length > 0 ? 'segments' : 'routes')
  const [openKey, setOpenKey] = useState<string | null>(
    segments.clusters[0]?.segmentId != null
      ? `seg-${segments.clusters[0].segmentId}`
      : routes.clusters[0]?.routeKey ?? null,
  )

  const chip = (active: boolean) =>
    [
      'rounded-lg border px-2.5 py-1 text-[11px] font-medium',
      STRAVA_INTERACTIVE,
      active
        ? 'border-orange-500/40 bg-orange-500/15 text-orange-300'
        : 'border-white/10 text-[var(--app-text-muted)]',
    ].join(' ')

  return (
    <StravaCard padding="md">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <StravaSectionTitle className="mb-0 min-w-0 flex-1" title="Strecken & Segmente" subtitle="Strava-Segmente + GPS-Routen" info={STRAVA_PANEL_INFO.segmentsRoutes} />
        <div className="flex gap-2">
          <button type="button" className={chip(tab === 'segments')} onClick={() => setTab('segments')}>
            Segmente ({segments.clusters.length})
          </button>
          <button type="button" className={chip(tab === 'routes')} onClick={() => setTab('routes')}>
            Routen ({routes.clusters.length})
          </button>
        </div>
      </div>

      {segments.komHighlights.length > 0 ? (
        <div className="mt-3 rounded-xl border border-amber-500/15 bg-amber-500/5 px-3 py-2.5">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-amber-300/80">
            KOM / Top-Rankings
          </p>
          <div className="flex flex-wrap gap-2">
            {segments.komHighlights.map((k) => (
              <a
                key={k.segmentId}
                href={`https://www.strava.com/segments/${k.segmentId}`}
                target="_blank"
                rel="noreferrer"
                className={`rounded-lg border border-white/10 bg-black/30 px-2.5 py-1.5 text-[11px] ${STRAVA_INTERACTIVE}`}
              >
                <span className="font-medium text-[var(--app-text)]">{k.name}</span>
                <span className="ml-1.5 tabular-nums text-amber-300">#{k.bestKomRank}</span>
                {k.bestElapsedLabel ? (
                  <span className="ml-1 text-[var(--app-text-muted)]">· {k.bestElapsedLabel}</span>
                ) : null}
              </a>
            ))}
          </div>
        </div>
      ) : null}

      {segments.backlog > 0 ? (
        <p className="mt-2 text-[11px] text-[var(--app-text-muted)]">
          {segments.backlog} Aktivitäten ohne Segment-Sync — beim nächsten Sync bis zu 15 pro Lauf.
        </p>
      ) : null}

      {tab === 'segments' ? (
        segments.clusters.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--app-text-muted)]">
            Noch keine Strava-Segmente — Sync ausführen (Activity-Details mit segment_efforts).
          </p>
        ) : (
          <div className="mt-3 space-y-2">
            {segments.clusters.map((c) => {
              const key = `seg-${c.segmentId}`
              const open = openKey === key
              return (
                <div key={key} className="rounded-xl border border-white/[0.06] bg-black/30">
                  <button
                    type="button"
                    className={`flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-xs ${STRAVA_INTERACTIVE}`}
                    onClick={() => setOpenKey(open ? null : key)}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-[var(--app-text)]">{c.name}</p>
                      <p className="mt-0.5 text-[10px] text-[var(--app-text-muted)]">
                        {c.efforts}×
                        {c.distanceKm != null ? ` · ${c.distanceKm} km` : ''}
                        {c.avgGrade != null ? ` · ${c.avgGrade}%` : ''}
                        {c.bestElapsedLabel ? ` · PR ${c.bestElapsedLabel}` : ''}
                        {c.bestWatts != null ? ` · ${c.bestWatts} W` : ''}
                        {c.bestKomRank != null ? (
                          <span className=" text-amber-300"> · KOM #{c.bestKomRank}</span>
                        ) : null}
                        {c.trendPct != null ? (
                          <span className={c.trendPct >= 0 ? ' text-emerald-400' : ' text-amber-400'}>
                            {' '}
                            · {c.trendPct > 0 ? '+' : ''}
                            {c.trendPct}%
                          </span>
                        ) : null}
                      </p>
                    </div>
                    <span className="text-[var(--app-text-muted)]">{open ? '▾' : '▸'}</span>
                  </button>
                  {open ? (
                    <div className="border-t border-white/[0.06] px-3 py-2">
                      <table className="w-full text-[11px]">
                        <thead>
                          <tr className="text-[var(--app-text-muted)]">
                            <th className="pb-1 text-left font-normal">Datum</th>
                            <th className="pb-1 text-right font-normal">Zeit</th>
                            <th className="pb-1 text-right font-normal">W</th>
                            <th className="pb-1 text-right font-normal">PR</th>
                            <th className="pb-1 text-right font-normal">KOM</th>
                          </tr>
                        </thead>
                        <tbody>
                          {c.entries.map((e) => (
                            <tr
                              key={`${e.activityId}-${e.date}`}
                              className={e.isPr ? 'text-emerald-300' : 'text-[var(--app-text-muted)]'}
                            >
                              <td className="py-1">
                                {e.dateLabel}
                                {e.isPr ? ' ★' : ''}
                              </td>
                              <td className="py-1 text-right tabular-nums">{e.elapsedLabel}</td>
                              <td className="py-1 text-right tabular-nums">{e.avgWatts ?? '—'}</td>
                              <td className="py-1 text-right tabular-nums">{e.prRank ?? '—'}</td>
                              <td className="py-1 text-right tabular-nums">{e.komRank ?? '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <a
                        href={`https://www.strava.com/segments/${c.segmentId}`}
                        target="_blank"
                        rel="noreferrer"
                        className={`mt-2 inline-block text-[10px] text-orange-400 underline ${STRAVA_INTERACTIVE}`}
                      >
                        Segment auf Strava →
                      </a>
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        )
      ) : routes.clusters.length === 0 ? (
        <p className="mt-3 text-sm text-[var(--app-text-muted)]">
          Mindestens zwei Fahrten ≥8 km mit GPS-Polyline oder gleichem Namen nötig.
        </p>
      ) : (
        <div className="mt-3 space-y-2">
          {routes.clusters.map((c) => {
            const open = openKey === c.routeKey
            return (
              <div key={c.routeKey} className="rounded-xl border border-white/[0.06] bg-black/30">
                <button
                  type="button"
                  className={`flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-xs ${STRAVA_INTERACTIVE}`}
                  onClick={() => setOpenKey(open ? null : c.routeKey)}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-[var(--app-text)]">{c.label}</p>
                    <p className="mt-0.5 text-[10px] text-[var(--app-text-muted)]">
                      {c.rides}× · Ø {c.avgDistanceKm} km
                      {c.bestWatts != null ? ` · Best ${c.bestWatts} W` : ''}
                    </p>
                  </div>
                  <span className="text-[var(--app-text-muted)]">{open ? '▾' : '▸'}</span>
                </button>
                {open ? (
                  <div className="border-t border-white/[0.06] px-3 py-2">
                    <table className="w-full text-[11px]">
                      <thead>
                        <tr className="text-[var(--app-text-muted)]">
                          <th className="pb-1 text-left font-normal">Datum</th>
                          <th className="pb-1 text-right font-normal">km</th>
                          <th className="pb-1 text-right font-normal">W</th>
                          <th className="pb-1 text-right font-normal">km/h</th>
                        </tr>
                      </thead>
                      <tbody>
                        {c.entries.map((e) => (
                          <tr
                            key={e.activityId}
                            className={e.isBest ? 'text-emerald-300' : 'text-[var(--app-text-muted)]'}
                          >
                            <td className="py-1">
                              {e.dateLabel}
                              {e.isBest ? ' ★' : ''}
                            </td>
                            <td className="py-1 text-right tabular-nums">{e.distanceKm}</td>
                            <td className="py-1 text-right tabular-nums">{e.avgWatts ?? '—'}</td>
                            <td className="py-1 text-right tabular-nums">{e.avgSpeedKmh ?? '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      )}
    </StravaCard>
  )
}
