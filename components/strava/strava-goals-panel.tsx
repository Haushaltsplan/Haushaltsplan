'use client'

import { STRAVA_COLORS, STRAVA_INTERACTIVE } from '@/components/strava/design-tokens'
import { StravaCard, StravaSectionTitle } from '@/components/strava/strava-card'
import { stravaApiFetch } from '@/lib/strava/strava-api-fetch'
import type { GoalProgress } from '@/lib/strava/strava-goals'
import type { StravaAthleteProfile } from '@/lib/strava/strava-types'
import { useCallback, useState } from 'react'
import toast from 'react-hot-toast'

type Props = {
  goals: GoalProgress[]
  athlete: StravaAthleteProfile | null
  connectionId?: string | null
  onSaved: () => void
}

export function StravaGoalsPanel({ goals, athlete, connectionId, onSaved }: Props) {
  const [open, setOpen] = useState(goals.length === 0)
  const [km, setKm] = useState(athlete?.goal_km_year != null ? String(athlete.goal_km_year) : '')
  const [hm, setHm] = useState(athlete?.goal_hm_year != null ? String(athlete.goal_hm_year) : '')
  const [freq, setFreq] = useState(athlete?.goal_rides_per_week != null ? String(athlete.goal_rides_per_week) : '')
  const [eventName, setEventName] = useState(athlete?.goal_event_name ?? '')
  const [eventDate, setEventDate] = useState(athlete?.goal_event_date ?? '')
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
          goal_event_name: eventName || null,
          goal_event_date: eventDate || null,
          connectionId,
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
  }, [km, hm, freq, eventName, eventDate, connectionId, onSaved])

  return (
    <StravaCard padding="md" accent="orange">
      <div className="flex items-center justify-between gap-2">
        <StravaSectionTitle title="Saisonziele" subtitle="Fortschritt & Event-Countdown" />
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
                <span className="text-zinc-400">{g.label}</span>
                <span className={g.onTrack ? 'text-emerald-400' : 'text-amber-400'}>{g.detail}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
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
        <p className="mt-2 text-xs text-zinc-500">Noch keine Ziele — unten definieren.</p>
      )}

      {open ? (
        <div className="mt-4 grid gap-3 border-t border-white/[0.06] pt-4 sm:grid-cols-2">
          <label className="block text-xs">
            <span className="text-zinc-500">Jahres-km</span>
            <input value={km} onChange={(e) => setKm(e.target.value)} placeholder="5000" className="mt-1 w-full rounded-lg border border-white/10 bg-black/50 px-2 py-1.5 text-sm" />
          </label>
          <label className="block text-xs">
            <span className="text-zinc-500">Jahres-hm</span>
            <input value={hm} onChange={(e) => setHm(e.target.value)} placeholder="50000" className="mt-1 w-full rounded-lg border border-white/10 bg-black/50 px-2 py-1.5 text-sm" />
          </label>
          <label className="block text-xs">
            <span className="text-zinc-500">Fahrten / Woche</span>
            <input value={freq} onChange={(e) => setFreq(e.target.value)} placeholder="3" className="mt-1 w-full rounded-lg border border-white/10 bg-black/50 px-2 py-1.5 text-sm" />
          </label>
          <label className="block text-xs">
            <span className="text-zinc-500">Event-Datum</span>
            <input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-black/50 px-2 py-1.5 text-sm" />
          </label>
          <label className="block text-xs sm:col-span-2">
            <span className="text-zinc-500">Event-Name</span>
            <input value={eventName} onChange={(e) => setEventName(e.target.value)} placeholder="Gran Fondo …" className="mt-1 w-full rounded-lg border border-white/10 bg-black/50 px-2 py-1.5 text-sm" />
          </label>
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
