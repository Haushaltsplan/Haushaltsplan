'use client'

import { ladeWhoopCloudMeta, syncWhoopCloudVomServer } from '@/lib/fitnessdaten/whoop-cloud-merge'
import type { WhoopCloudSyncResult } from '@/lib/fitnessdaten/whoop-cloud-types'
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

  const ladeStatus = useCallback(async () => {
    setStatusLoading(true)
    setStatusError(null)
    try {
      const { data } = await supabase.auth.getSession()
      const token = data.session?.access_token
      if (!token) {
        setStatusError('Login-Token fehlt — bitte Seite neu laden.')
        return
      }
      const res = await fetch('/api/fitnessdaten/whoop/status', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null
        setStatusError(body?.error ?? `Server-Antwort ${res.status}`)
        return
      }
      setStatus((await res.json()) as Status)
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
      toast.success('WHOOP-Konto verbunden — jetzt Cloud-Sync ausführen.')
      void ladeStatus()
      window.history.replaceState({}, '', window.location.pathname)
    }
    const err = params.get('whoop_error')
    if (err) {
      toast.error(`WHOOP-Verbindung: ${decodeURIComponent(err)}`)
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [ladeStatus])

  const verbinden = useCallback(() => {
    window.location.href = '/api/fitnessdaten/whoop/auth'
  }, [])

  const trennen = useCallback(async () => {
    await fetch('/api/fitnessdaten/whoop/disconnect', { method: 'POST', credentials: 'include' })
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
      className={`rounded-2xl border border-violet-500/20 bg-[#141618] ${embedded ? 'p-4' : 'p-5'}`}
    >
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-violet-200">WHOOP Cloud</p>
      <p className="mt-2 text-xs leading-relaxed text-zinc-500">
        Vollsync: Recovery (SpO₂), Schlaf (Stufen, Regelmäßigkeit, Bedarf), Zyklen (Strain), Workouts,
        Körpermaße → Profil. OAuth mit aktivem WHOOP-Abo.
      </p>
      <p className="mt-2 text-[10px] leading-relaxed text-zinc-600">
        Blutdruck-Insights (Life/MG) sind in der WHOOP-App — die öffentliche WHOOP-API liefert sie noch
        nicht. ECG/AFib ebenfalls nur in der App.
      </p>

      {!statusLoading && statusError ? (
        <p className="mt-3 rounded-xl border border-red-900/40 bg-red-950/20 p-3 text-xs text-red-100/90">
          {statusError}
        </p>
      ) : null}

      {!statusLoading && !statusError && !status.configured ? (
        <p className="mt-3 rounded-xl border border-amber-900/40 bg-amber-950/20 p-3 text-xs text-amber-100/90">
          Server sieht keine WHOOP-Keys. In <code className="text-amber-200">.env.local</code> (lokal) bzw.
          Vercel Environment Variables (online):{' '}
          <code className="text-amber-200">WHOOP_CLIENT_ID</code> und{' '}
          <code className="text-amber-200">WHOOP_CLIENT_SECRET</code> — danach Dev-Server neu starten bzw.
          redeployen.
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
              {busy ? 'Synchronisiere …' : 'WHOOP Cloud-Sync (alles)'}
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
