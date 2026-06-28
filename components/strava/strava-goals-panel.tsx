'use client'

import { STRAVA_COLORS, STRAVA_INTERACTIVE } from '@/components/strava/design-tokens'
import { StravaCard, StravaSectionTitle } from '@/components/strava/strava-card'
import { STRAVA_PANEL_INFO } from '@/lib/strava/strava-panel-info'
import { stravaApiFetch } from '@/lib/strava/strava-api-fetch'
import type { GoalProgress } from '@/lib/strava/strava-goals'
import type { StravaAthleteProfile } from '@/lib/strava/strava-types'
import { useCallback, useState } from 'react'
import toast from 'react-hot-toast'

type Props = {
  goals: GoalProgress[]
  athlete: StravaAthleteProfile | null
  onSaved: () => void
}

export function StravaGoalsPanel({ goals, athlete, onSaved }: Props) {
  const [open, setOpen] = useState(goals.length === 0)
  const [km, setKm] = useState(athlete?.goal_km_year != null ? String(athlete.goal_km_year) : '')
  const [hm, setHm] = useState(athlete?.goal_hm_year != null ? String(athlete.goal_hm_year) : '')
  const [freq, setFreq] = useState(athlete?.goal_rides_per_week != null ? String(athlete.goal_rides_per_week) : '')
  const [tssWeek, setTssWeek] = useState(athlete?.goal_tss_week != null ? String(athlete.goal_tss_week) : '')
  const [eventName, setEventName] = useState(athlete?.goal_event_name ?? '')
  const [eventDate, setEventDate] = useState(athlete?.goal_event_date ?? '')
  const [weatherLat, setWeatherLat] = useState(
    athlete?.weather_home_lat != null ? String(athlete.weather_home_lat) : '',
  )
  const [weatherLon, setWeatherLon] = useState(
    athlete?.weather_home_lon != null ? String(athlete.weather_home_lon) : '',
  )
  const [busy, setBusy] = useState(false)

  const speichern = useCallback(async () => {
    setBusy(true)
    try {
      const res = await stravaApiFetch('/api/strava/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          goal_km_year: km ? Number.parseFloat(km.replace(',', '.')) : null,
          goal_hm_year: hm ? Number.parseFloat(hm.replace(',', '.')) : null,
          goal_rides_per_week: freq ? Number.parseInt(freq, 10) : null,
          goal_tss_week: tssWeek ? Number.parseFloat(tssWeek.replace(',', '.')) : null,
          goal_event_name: eventName || null,
          goal_event_date: eventDate || null,
          weather_home_lat: weatherLat ? Number.parseFloat(weatherLat.replace(',', '.')) : null,
          weather_home_lon: weatherLon ? Number.parseFloat(weatherLon.replace(',', '.')) : null,
        }),
      })
      if (!res.ok) {
        toast.error('Ziele konnten nicht gespeichert werden.')
        return
      }
      toast.success('Saisonziele gespeichert.')
      setOpen(false)
      onSaved()
    } finally {
      setBusy(false)
    }
  }, [km, hm, freq, tssWeek, eventName, eventDate, weatherLat, weatherLon, onSaved])

  return (
    <StravaCard padding="md" accent="orange">
      <div className="flex items-center justify-between gap-2">
        <StravaSectionTitle className="mb-0 min-w-0 flex-1" title="Saisonziele" subtitle="Fortschritt & Event-Countdown" info={STRAVA_PANEL_INFO.seasonGoals} />
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={`text-[11px] text-orange-400 underline ${STRAVA_INTERACTIVE}`}
        >
          {open ? 'Schließen' : 'Bearbeiten'}
        </button>
      </div>

      {goals.length > 0 ? (
        <div className="mt-3 space-y-3">
          {goals.map((g) => (
            <div key={g.key}>
              <div className="mb-1 flex justify-between text-xs">
                <span className="text-[var(--app-text-muted)]">{g.label}</span>
                <span className={g.onTrack ? 'text-emerald-400' : 'text-amber-400'}>{g.detail}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-[var(--app-surface-muted)]">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(100, g.pct)}%`,
                    background: g.onTrack ? STRAVA_COLORS.green : STRAVA_COLORS.orange,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-xs text-[var(--app-text-muted)]">Noch keine Ziele — unten definieren.</p>
      )}

      {open ? (
        <div className="mt-4 grid gap-3 border-t border-white/[0.06] pt-4 sm:grid-cols-2">
          <label className="block text-xs">
            <span className="text-[var(--app-text-muted)]">Jahres-km</span>
            <input value={km} onChange={(e) => setKm(e.target.value)} placeholder="5000" className="mt-1 w-full rounded-lg border border-white/10 bg-black/50 px-2 py-1.5 text-sm" />
          </label>
          <label className="block text-xs">
            <span className="text-[var(--app-text-muted)]">Jahres-hm</span>
            <input value={hm} onChange={(e) => setHm(e.target.value)} placeholder="50000" className="mt-1 w-full rounded-lg border border-white/10 bg-black/50 px-2 py-1.5 text-sm" />
          </label>
          <label className="block text-xs">
            <span className="text-[var(--app-text-muted)]">TSS / Woche</span>
            <input value={tssWeek} onChange={(e) => setTssWeek(e.target.value)} placeholder="300" className="mt-1 w-full rounded-lg border border-white/10 bg-black/50 px-2 py-1.5 text-sm" />
          </label>
          <label className="block text-xs">
            <span className="text-[var(--app-text-muted)]">Fahrten / Woche</span>
            <input value={freq} onChange={(e) => setFreq(e.target.value)} placeholder="3" className="mt-1 w-full rounded-lg border border-white/10 bg-black/50 px-2 py-1.5 text-sm" />
          </label>
          <label className="block text-xs">
            <span className="text-[var(--app-text-muted)]">Event-Datum</span>
            <input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-black/50 px-2 py-1.5 text-sm" />
          </label>
          <label className="block text-xs sm:col-span-2">
            <span className="text-[var(--app-text-muted)]">Event-Name</span>
            <input value={eventName} onChange={(e) => setEventName(e.target.value)} placeholder="Gran Fondo …" className="mt-1 w-full rounded-lg border border-white/10 bg-black/50 px-2 py-1.5 text-sm" />
          </label>
          <label className="block text-xs">
            <span className="text-[var(--app-text-muted)]">Wetter Heimat Lat</span>
            <input value={weatherLat} onChange={(e) => setWeatherLat(e.target.value)} placeholder="48.45" className="mt-1 w-full rounded-lg border border-white/10 bg-black/50 px-2 py-1.5 text-sm" />
          </label>
          <label className="block text-xs">
            <span className="text-[var(--app-text-muted)]">Wetter Heimat Lon</span>
            <input value={weatherLon} onChange={(e) => setWeatherLon(e.target.value)} placeholder="12.78" className="mt-1 w-full rounded-lg border border-white/10 bg-black/50 px-2 py-1.5 text-sm" />
          </label>
          <p className="text-[10px] text-[var(--app-text-muted)] sm:col-span-2">
            Fallback-Koordinaten für Wetter, wenn GPS-Polyline fehlt (z. B. Haarbach).
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={() => void speichern()}
            className={`rounded-lg px-4 py-2 text-sm font-semibold text-white sm:col-span-2 ${STRAVA_INTERACTIVE}`}
            style={{ background: STRAVA_COLORS.orange }}
          >
            {busy ? 'Speichern…' : 'Ziele speichern'}
          </button>
        </div>
      ) : null}
    </StravaCard>
  )
}
