'use client'

import {
  bauMomentumNotification,
  erinnerungNotifyKey,
  filterNotifyErinnerungen,
  heuteAlsIsoDatumLocal,
  ladeMomentumErinnerungenEinstellungen,
  MOMENTUM_ERINNERUNGEN_EVENT,
  speichereMomentumErinnerungenEinstellungen,
  type MomentumErinnerungenSettings,
} from '@/lib/portfolio-analyse/momentum-trader/momentum-erinnerungen-client'
import type { MomentumErinnerung } from '@/lib/portfolio-analyse/momentum-trader/momentum-trader-types'
import { useCallback, useEffect, useState } from 'react'

const TICK_MS = 60_000

function darfWebNotifications() {
  return typeof window !== 'undefined' && (window.isSecureContext || window.location?.hostname === 'localhost')
}

function istIosGeraet() {
  if (typeof navigator === 'undefined') return false
  return /iPhone|iPad|iPod/i.test(navigator.userAgent || '')
}

function istStandalonePwa() {
  if (typeof window === 'undefined') return false
  try {
    return window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true
  } catch {
    return false
  }
}

type Props = {
  erinnerungen: MomentumErinnerung[]
}

/** Browser-Benachrichtigungen für Earnings-Tag, Pre-Event und Trade-Setups. */
export function MomentumErinnerungenNotifier({ erinnerungen }: Props) {
  const pruef = useCallback(() => {
    if (!darfWebNotifications() || typeof Notification === 'undefined') return
    const einst = ladeMomentumErinnerungenEinstellungen()
    if (!einst.enabled || Notification.permission !== 'granted') return

    const heute = heuteAlsIsoDatumLocal()
    const relevant = filterNotifyErinnerungen(erinnerungen)
    if (relevant.length === 0) return

    const gesendet = new Set(einst.gesendet)
    let neu = false

    for (const e of relevant) {
      const key = erinnerungNotifyKey(e, heute)
      if (gesendet.has(key)) continue
      const { title, body, tag } = bauMomentumNotification(e)
      try {
        new Notification(title, { body, tag })
        gesendet.add(key)
        neu = true
      } catch {
        // ignore
      }
    }

    if (neu) {
      speichereMomentumErinnerungenEinstellungen({
        ...einst,
        gesendet: [...gesendet],
      })
    }
  }, [erinnerungen])

  useEffect(() => {
    if (!darfWebNotifications() || typeof Notification === 'undefined') return
    pruef()
    const t = window.setInterval(pruef, TICK_MS)
    return () => window.clearInterval(t)
  }, [pruef])

  return null
}

export function MomentumErinnerungenEinstellungen() {
  const [einst, setEinst] = useState<MomentumErinnerungenSettings | null>(null)

  const refresh = useCallback(() => {
    setEinst(ladeMomentumErinnerungenEinstellungen())
  }, [])

  useEffect(() => {
    refresh()
    const onE = () => refresh()
    window.addEventListener(MOMENTUM_ERINNERUNGEN_EVENT, onE)
    return () => window.removeEventListener(MOMENTUM_ERINNERUNGEN_EVENT, onE)
  }, [refresh])

  if (!einst) return null

  const sicher = darfWebNotifications()
  const perm = typeof Notification === 'undefined' ? 'unsupported' : Notification.permission
  const ios = istIosGeraet()
  const standalone = istStandalonePwa()
  const iosHinweis = ios && !standalone
  const kannAktivieren = sicher && perm !== 'unsupported' && !iosHinweis

  async function erlaubnisAnfragen() {
    if (!kannAktivieren || typeof Notification === 'undefined') return
    try {
      await Notification.requestPermission()
      refresh()
    } catch {
      // ignore
    }
  }

  function toggleEnabled() {
    if (einst == null) return
    const next: MomentumErinnerungenSettings = {
      enabled: !einst.enabled,
      gesendet: einst.gesendet,
    }
    speichereMomentumErinnerungenEinstellungen(next)
    setEinst(next)
  }

  return (
    <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-muted)]/40 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-[var(--app-text)]">Browser-Erinnerungen</p>
          <p className="mt-0.5 text-[10px] text-[var(--app-text-muted)]">
            Earnings heute/morgen, Pre-Event, Trade-Setups, Top-Signal ≥65%
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {perm === 'default' && kannAktivieren && (
            <button
              type="button"
              onClick={() => void erlaubnisAnfragen()}
              className="rounded-lg bg-violet-500/15 px-3 py-1.5 text-xs font-medium text-violet-300 ring-1 ring-violet-500/25"
            >
              Erlauben
            </button>
          )}
          <button
            type="button"
            disabled={!kannAktivieren || perm !== 'granted'}
            onClick={toggleEnabled}
            className={
              'rounded-lg px-3 py-1.5 text-xs font-medium ring-1 disabled:opacity-40 ' +
              (einst.enabled
                ? 'bg-teal-500/15 text-teal-300 ring-teal-500/25'
                : 'bg-[var(--app-surface-muted)] text-[var(--app-text-muted)] ring-[var(--app-border)]')
            }
          >
            {einst.enabled ? 'An' : 'Aus'}
          </button>
        </div>
      </div>
      {iosHinweis && (
        <p className="mt-2 text-[10px] text-amber-300">
          iOS: Benachrichtigungen nur zuverlässig als installierte PWA (Zum Home-Bildschirm).
        </p>
      )}
      {!sicher && (
        <p className="mt-2 text-[10px] text-[var(--app-text-muted)]">HTTPS oder localhost erforderlich.</p>
      )}
    </div>
  )
}
