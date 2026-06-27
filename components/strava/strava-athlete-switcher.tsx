'use client'

import { STRAVA_COLORS, STRAVA_INTERACTIVE } from '@/components/strava/design-tokens'
import { MAX_GUEST_CONNECTIONS, MAX_STRAVA_CONNECTIONS } from '@/lib/strava/strava-connections'
import type { StravaConnectionPublic } from '@/lib/strava/strava-connections'
import { useState } from 'react'

type Props = {
  connections: StravaConnectionPublic[]
  activeId: string | null
  onSelect: (id: string) => void
  onAddGuest: (label: string) => void
  onRemove: (id: string) => void
  busy?: boolean
}

export function StravaAthleteSwitcher({
  connections,
  activeId,
  onSelect,
  onAddGuest,
  onRemove,
  busy,
}: Props) {
  const [guestLabel, setGuestLabel] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const canAddGuest = connections.length < MAX_STRAVA_CONNECTIONS

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {connections.map((c) => {
          const active = c.id === activeId
          return (
            <div key={c.id} className="flex items-center gap-1">
              <button
                type="button"
                disabled={busy}
                onClick={() => onSelect(c.id)}
                className={[
                  'rounded-full px-3 py-1.5 text-xs font-semibold',
                  STRAVA_INTERACTIVE,
                  active
                    ? 'bg-[#FC4C02]/25 text-orange-100 ring-1 ring-[#FC4C02]/45'
                    : 'bg-zinc-900/80 text-zinc-400 hover:text-zinc-200',
                ].join(' ')}
              >
                {c.isPrimary ? '★ ' : ''}
                {c.label}
                {c.activityCount != null ? (
                  <span className="ml-1 opacity-60">({c.activityCount})</span>
                ) : null}
              </button>
              {!c.isPrimary ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onRemove(c.id)}
                  className="rounded p-1 text-[10px] text-zinc-600 hover:bg-red-500/10 hover:text-red-400"
                  title="Verbindung entfernen"
                >
                  ✕
                </button>
              ) : null}
            </div>
          )
        })}
      </div>

      {canAddGuest ? (
        showAdd ? (
          <div className="flex flex-wrap items-end gap-2 rounded-xl border border-white/[0.08] bg-black/30 p-3">
            <label className="block flex-1 text-xs">
              <span className="text-zinc-500">Name des Freundes (Anzeige)</span>
              <input
                value={guestLabel}
                onChange={(e) => setGuestLabel(e.target.value)}
                placeholder="z. B. Max"
                className="mt-1 w-full min-w-[120px] rounded-lg border border-white/10 bg-zinc-950 px-2 py-1.5 text-sm"
              />
            </label>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                onAddGuest(guestLabel.trim() || 'Freund')
                setShowAdd(false)
                setGuestLabel('')
              }}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold text-white ${STRAVA_INTERACTIVE}`}
              style={{ background: STRAVA_COLORS.orange }}
            >
              Strava verbinden
            </button>
            <button
              type="button"
              onClick={() => setShowAdd(false)}
              className="text-xs text-zinc-500 underline"
            >
              Abbrechen
            </button>
          </div>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={() => setShowAdd(true)}
            className={`text-xs text-cyan-400 underline ${STRAVA_INTERACTIVE}`}
          >
            + Freund hinzufügen (max. {MAX_GUEST_CONNECTIONS})
          </button>
        )
      ) : (
        <p className="text-[11px] text-zinc-600">
          Maximum {MAX_STRAVA_CONNECTIONS} Athleten erreicht (du + {MAX_GUEST_CONNECTIONS} Freunde).
        </p>
      )}

      <p className="text-[10px] leading-relaxed text-zinc-600">
        Freunde autorisieren einmalig Strava im Browser — du siehst deren Auswertung in deinem Dashboard.
        Sync nur den aktiven Athleten oder „Alle syncen“ für API-Schonung.
      </p>
    </div>
  )
}
