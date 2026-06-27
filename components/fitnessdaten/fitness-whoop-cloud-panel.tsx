'use client'

import { istOmniaNativeApp } from '@/lib/fitnessdaten/omnia-native'
import { whoopApiFetch } from '@/lib/fitnessdaten/whoop-api-fetch'
import { oeffneWhoopOAuthUrl } from '@/lib/fitnessdaten/whoop-oauth-open'
import { ladeWhoopCloudMeta, syncWhoopCloudVomServer } from '@/lib/fitnessdaten/whoop-cloud-merge'
import { versucheWhoopCloudAutoSync } from '@/lib/fitnessdaten/whoop-cloud-auto-sync'
import type { WhoopCloudSyncResult } from '@/lib/fitnessdaten/whoop-cloud-types'
import { whoopRedirectUri } from '@/lib/fitnessdaten/whoop-cloud-types'
import { supabase } from '@/lib/supabase'
import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'

type Props = {
  onSyncComplete?: () => void
  embedded?: boolean
}

type Status = { configured: boolean; connected: boolean }

export function FitnessWhoopCloudPanel({ onSyncComplete, embedded = false }: Props) {
  const [status, setStatus] = useState<Status>({ configured: false, connected: false })
  const [statusLoading, setStatusLoading] = useState(true)
  const [statusError, setStatusError] = useState<string | null>(null)
  const [meta, setMeta] = useState(() => ladeWhoopCloudMeta())
  const [busy, setBusy] = useState(false)
  const [ergebnis, setErgebnis] = useState<WhoopCloudSyncResult | null>(null)
  const [hostname, setHostname] = useState<string | null>(null)
  const [redirectUri, setRedirectUri] = useState<string | null>(null)
  const [nativeApp] = useState(() => istOmniaNativeApp())

  useEffect(() => {
    setHostname(window.location.hostname)
    setRedirectUri(whoopRedirectUri(window.location.origin))
  }, [])

  const ladeStatus = useCallback(async () => {
    setStatusLoading(true)
    setStatusError(null)
    try {
      const pingRes = await fetch('/api/fitnessdaten/whoop/ping', { cache: 'no-store', credentials: 'include' })
      const ping = pingRes.ok
        ? ((await pingRes.json()) as { configured?: boolean })
        : { configured: false }
      const configured = Boolean(ping.configured)

      let connected = false
      const { data } = await supabase.auth.getSession()
      if (data.session?.access_token) {
        const res = await whoopApiFetch('/api/fitnessdaten/whoop/status')
        if (res.ok) {
          connected = Boolean(((await res.json()) as Status).connected)
        }
      }

      setStatus({ configured, connected })
    } catch {
      setStatusError('WHOOP-Status konnte nicht geladen werden.')
    } finally {
      setStatusLoading(false)
    }
  }, [])

  useEffect(() => {
    void ladeStatus()
    setMeta(ladeWhoopCloudMeta())
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      void ladeStatus()
    })
    return () => sub.subscription.unsubscribe()
  }, [ladeStatus])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('whoop') === 'connected') {
      toast.success('WHOOP-Konto verbunden — Daten werden automatisch synchronisiert.')
      void ladeStatus()
      void versucheWhoopCloudAutoSync(true).then((ok) => {
        if (ok) {
          setMeta(ladeWhoopCloudMeta())
          onSyncComplete?.()
        }
      })
      window.history.replaceState({}, '', window.location.pathname)
    }
    const err = params.get('whoop_error')
    if (err) {
      toast.error(`WHOOP-Verbindung: ${decodeURIComponent(err)}`)
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [ladeStatus, onSyncComplete])

  /** Native: OAuth kann im Browser enden — nach Rückkehr Status + Sync aktualisieren. */
  useEffect(() => {
    if (!nativeApp) return
    const onResume = () => {
      void ladeStatus().then(() =>
        versucheWhoopCloudAutoSync(true).then((ok) => {
          if (ok) {
            setMeta(ladeWhoopCloudMeta())
            onSyncComplete?.()
          }
        }),
      )
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible') onResume()
    }
    document.addEventListener('resume', onResume)
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onResume)
    return () => {
      document.removeEventListener('resume', onResume)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onResume)
    }
  }, [ladeStatus, nativeApp, onSyncComplete])

  const verbinden = useCallback(async () => {
    const { data } = await supabase.auth.getSession()
    if (!data.session?.access_token) {
      toast.error('Bitte zuerst in Omnia einloggen.')
      return
    }
    try {
      const res = await whoopApiFetch('/api/fitnessdaten/whoop/auth/start', { method: 'POST' })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        toast.error(body.error ?? 'WHOOP-Verbindung konnte nicht gestartet werden.')
        return
      }
      const { url } = (await res.json()) as { url?: string }
      if (!url) {
        toast.error('Keine WHOOP-Anmelde-URL erhalten.')
        return
      }
      await oeffneWhoopOAuthUrl(url)
      if (nativeApp) {
        toast(
          'WHOOP-Anmeldung öffnet sich im Browser. Nach dem Login Omnia-App wieder öffnen — Verbindung wird automatisch erkannt.',
          { duration: 9000 },
        )
      }
    } catch {
      toast.error('WHOOP-Verbindung konnte nicht gestartet werden.')
    }
  }, [])

  const trennen = useCallback(async () => {
    await whoopApiFetch('/api/fitnessdaten/whoop/disconnect', { method: 'POST' })
    setStatus((s) => ({ ...s, connected: false }))
    toast.success('WHOOP-Konto getrennt.')
  }, [])

  const sync = useCallback(async () => {
    setBusy(true)
    setErgebnis(null)
    try {
      const res = await syncWhoopCloudVomServer()
      setErgebnis(res)
      setMeta(ladeWhoopCloudMeta())
      if (res.ok) {
        toast.success(res.message)
        onSyncComplete?.()
      } else {
        toast.error(res.fehler ?? res.message)
      }
    } finally {
      setBusy(false)
    }
  }, [onSyncComplete])

  return (
    <div
      className={`rounded-2xl border border-violet-500/20 bg-[#111113] ${embedded ? 'p-4' : 'p-5'}`}
    >
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-violet-200">WHOOP Cloud</p>
      <p className="mt-2 text-xs leading-relaxed text-zinc-500">
        Recovery (SpO₂, Hauttemp.), Schlaf, Strain, Workouts — automatisch alle ~15 Min, sobald WHOOP
        verbunden ist. Manueller Sync unten optional.
      </p>
      {nativeApp ? (
        <p className="mt-2 rounded-lg border border-violet-900/30 bg-violet-950/15 px-3 py-2 text-[11px] leading-relaxed text-violet-200/80">
          Omnia-App: „WHOOP-Konto verbinden“ öffnet die offizielle WHOOP-Anmeldung im Browser (nicht die
          Omnia-Seite). Nach dem Login zurück zur App wechseln — die Verbindung wird dann automatisch
          übernommen.
        </p>
      ) : null}
      <p className="mt-2 text-[10px] leading-relaxed text-zinc-600">
        Blutdruck (WHOOP Life/MG) liefert die öffentliche WHOOP-API nicht — Werte im Tab Gerät unter
        Vitalwerte eintragen.
      </p>

      {!statusLoading && statusError ? (
        <p className="mt-3 rounded-xl border border-red-900/40 bg-red-950/20 p-3 text-xs text-red-100/90">
          {statusError}
        </p>
      ) : null}

      {!statusLoading && !statusError && !status.configured ? (
        <p className="mt-3 rounded-xl border border-amber-900/40 bg-amber-950/20 p-3 text-xs text-amber-100/90">
          {hostname && hostname !== 'localhost' && hostname !== '127.0.0.1' ? (
            <>
              Du nutzt <strong className="text-amber-100">{hostname}</strong> — dort kennt der Server deine
              Keys aus <code className="text-amber-200">.env.local</code> nicht. In{' '}
              <strong className="text-amber-100">Vercel → Environment Variables</strong>{' '}
              <code className="text-amber-200">WHOOP_CLIENT_ID</code> und{' '}
              <code className="text-amber-200">WHOOP_CLIENT_SECRET</code> setzen und redeployen.
            </>
          ) : (
            <>
              Server sieht keine WHOOP-Keys. In <code className="text-amber-200">.env.local</code>:{' '}
              <code className="text-amber-200">WHOOP_CLIENT_ID</code> und{' '}
              <code className="text-amber-200">WHOOP_CLIENT_SECRET</code> — danach Dev-Server komplett neu
              starten (<code className="text-amber-200">Ctrl+C</code>, dann{' '}
              <code className="text-amber-200">npm run dev</code>).
            </>
          )}
        </p>
      ) : null}

      {!statusLoading && status.configured && redirectUri ? (
        <p className="mt-3 rounded-xl border border-zinc-800 bg-zinc-900/40 p-3 text-[11px] leading-relaxed text-zinc-500">
          <span className="font-medium text-zinc-400">Redirect-URI im WHOOP Developer Dashboard</span>{' '}
          (Zeichen für Zeichen, ohne Slash am Ende):
          <code className="mt-2 block break-all rounded-lg bg-black/30 px-2 py-1.5 text-[10px] text-violet-200">
            {redirectUri}
          </code>
        </p>
      ) : null}

      <div className="mt-4 space-y-2">
        {status.connected ? (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={() => void sync()}
              className="w-full rounded-xl border border-violet-500/40 bg-violet-950/40 py-3 text-sm font-semibold text-violet-100 transition hover:bg-violet-950/60 disabled:opacity-50"
            >
              {busy ? 'Synchronisiere …' : 'Jetzt synchronisieren'}
            </button>
            <button
              type="button"
              onClick={() => void trennen()}
              className="w-full rounded-xl border border-white/[0.06] py-2 text-xs text-zinc-500 hover:text-zinc-300"
            >
              WHOOP-Konto trennen
            </button>
          </>
        ) : (
          <button
            type="button"
            disabled={!status.configured || statusLoading}
            onClick={verbinden}
            className="w-full rounded-xl border border-violet-500/40 bg-violet-950/40 py-3 text-sm font-semibold text-violet-100 transition hover:bg-violet-950/60 disabled:opacity-40"
          >
            WHOOP-Konto verbinden
          </button>
        )}
      </div>

      {meta.lastSpo2 != null ? (
        <p className="mt-3 text-xs text-zinc-400">
          Letzte SpO₂: {meta.lastSpo2.toFixed(1).replace('.', ',')} %{' '}
          {meta.lastSpo2Date ? `(${meta.lastSpo2Date})` : ''}
        </p>
      ) : null}

      {ergebnis ? (
        <p
          className={`mt-3 rounded-xl border p-3 text-xs ${
            ergebnis.ok
              ? 'border-emerald-900/40 bg-emerald-950/20 text-emerald-100/90'
              : 'border-red-900/40 bg-red-950/20 text-red-100/90'
          }`}
        >
          {ergebnis.message}
        </p>
      ) : null}
    </div>
  )
}
