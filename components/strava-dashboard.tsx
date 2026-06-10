'use client'

import { WhoopWeeklyBarChart } from '@/components/fitnessdaten/whoop-charts'
import { PageChrome, PageHero, PageSection, PageSectionPanel } from '@/components/page-shell'
import { istOmniaNativeApp } from '@/lib/fitnessdaten/omnia-native'
import { formatDate, formatHm, formatHours, formatKm, leistungWatts, wattProKg } from '@/lib/strava/strava-auswertung'
import { stravaApiFetch } from '@/lib/strava/strava-api-fetch'
import { oeffneStravaOAuthUrl } from '@/lib/strava/strava-oauth-open'
import { stravaRedirectUri } from '@/lib/strava/strava-types'
import type { StravaAthleteProfile, StravaAuswertung } from '@/lib/strava/strava-types'
import { supabase } from '@/lib/supabase'
import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'

type Tab = 'uebersicht' | 'entwicklung' | 'prs' | 'aktivitaeten'

type Status = {
  configured: boolean
  connected: boolean
  athlete?: StravaAthleteProfile | null
  activityCount?: number
}

const STRAVA_ORANGE = '#FC4C02'

function StatKarte({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-[#141618] p-4">
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-zinc-100">{value}</p>
      {sub ? <p className="mt-1 text-xs text-zinc-500">{sub}</p> : null}
    </div>
  )
}

export function StravaDashboard() {
  const [tab, setTab] = useState<Tab>('uebersicht')
  const [status, setStatus] = useState<Status>({ configured: false, connected: false })
  const [statusLoading, setStatusLoading] = useState(true)
  const [auswertung, setAuswertung] = useState<StravaAuswertung | null>(null)
  const [athlete, setAthlete] = useState<StravaAthleteProfile | null>(null)
  const [busy, setBusy] = useState(false)
  const [dataLoading, setDataLoading] = useState(false)
  const [redirectUri, setRedirectUri] = useState<string | null>(null)
  const [nativeApp] = useState(() => istOmniaNativeApp())

  useEffect(() => {
    setRedirectUri(stravaRedirectUri(window.location.origin))
  }, [])

  const ladeStatus = useCallback(async () => {
    setStatusLoading(true)
    try {
      const pingRes = await fetch('/api/strava/ping', { cache: 'no-store', credentials: 'include' })
      const ping = pingRes.ok ? ((await pingRes.json()) as { configured?: boolean }) : { configured: false }
      const configured = Boolean(ping.configured)

      let connected = false
      let athleteProfil: StravaAthleteProfile | null = null
      let activityCount = 0
      const { data } = await supabase.auth.getSession()
      if (data.session?.access_token) {
        const res = await stravaApiFetch('/api/strava/status')
        if (res.ok) {
          const s = (await res.json()) as Status
          connected = Boolean(s.connected)
          athleteProfil = s.athlete ?? null
          activityCount = s.activityCount ?? 0
        }
      }
      setStatus({ configured, connected, athlete: athleteProfil, activityCount })
      setAthlete(athleteProfil)
    } catch {
      toast.error('Strava-Status konnte nicht geladen werden.')
    } finally {
      setStatusLoading(false)
    }
  }, [])

  const ladeDaten = useCallback(async () => {
    setDataLoading(true)
    try {
      const res = await stravaApiFetch('/api/strava/activities')
      if (!res.ok) return
      const body = (await res.json()) as { auswertung?: StravaAuswertung; athlete?: StravaAthleteProfile | null }
      if (body.auswertung) setAuswertung(body.auswertung)
      if (body.athlete) setAthlete(body.athlete)
    } catch {
      toast.error('Strava-Auswertung konnte nicht geladen werden.')
    } finally {
      setDataLoading(false)
    }
  }, [])

  useEffect(() => {
    void ladeStatus()
    const { data: sub } = supabase.auth.onAuthStateChange(() => void ladeStatus())
    return () => sub.subscription.unsubscribe()
  }, [ladeStatus])

  useEffect(() => {
    if (status.connected) void ladeDaten()
  }, [status.connected, ladeDaten])

  const sync = useCallback(async () => {
    setBusy(true)
    try {
      const res = await stravaApiFetch('/api/strava/sync', { method: 'POST' })
      const body = (await res.json()) as { ok?: boolean; message?: string; fehler?: string }
      if (body.ok) {
        toast.success(body.message ?? 'Synchronisiert')
        await ladeStatus()
        await ladeDaten()
      } else {
        toast.error(body.fehler ?? body.message ?? 'Sync fehlgeschlagen')
      }
    } finally {
      setBusy(false)
    }
  }, [ladeDaten, ladeStatus])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('strava') === 'connected') {
      toast.success('Strava verbunden — Aktivitäten werden synchronisiert.')
      void ladeStatus().then(() => sync())
      window.history.replaceState({}, '', window.location.pathname)
    }
    const err = params.get('strava_error')
    if (err) {
      toast.error(`Strava: ${decodeURIComponent(err)}`)
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [ladeStatus, sync])

  useEffect(() => {
    if (!nativeApp) return
    const onResume = () => {
      void ladeStatus().then(() => {
        if (status.connected) void sync()
      })
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
  }, [ladeStatus, nativeApp, status.connected, sync])

  const verbinden = useCallback(async () => {
    const { data } = await supabase.auth.getSession()
    if (!data.session?.access_token) {
      toast.error('Bitte zuerst in Omnia einloggen.')
      return
    }
    try {
      const res = await stravaApiFetch('/api/strava/auth/start', { method: 'POST' })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        toast.error(body.error ?? 'Strava-Verbindung konnte nicht gestartet werden.')
        return
      }
      const { url } = (await res.json()) as { url?: string }
      if (!url) {
        toast.error('Keine Strava-Anmelde-URL erhalten.')
        return
      }
      await oeffneStravaOAuthUrl(url)
      if (nativeApp) {
        toast('Strava-Anmeldung im Browser. Danach Omnia wieder öffnen.', { duration: 9000 })
      }
    } catch {
      toast.error('Strava-Verbindung konnte nicht gestartet werden.')
    }
  }, [nativeApp])

  const trennen = useCallback(async () => {
    await stravaApiFetch('/api/strava/disconnect', { method: 'POST' })
    setStatus((s) => ({ ...s, connected: false, activityCount: 0 }))
    setAuswertung(null)
    toast.success('Strava getrennt.')
  }, [])

  const weightKg = athlete?.weight_kg ?? null
  const tabs: { id: Tab; label: string }[] = [
    { id: 'uebersicht', label: 'Übersicht' },
    { id: 'entwicklung', label: 'Entwicklung' },
    { id: 'prs', label: 'Bestleistungen' },
    { id: 'aktivitaeten', label: 'Aktivitäten' },
  ]

  return (
    <PageChrome density="compact" className="max-w-full overflow-x-hidden">
      <PageHero
        density="compact"
        eyebrow="Rennrad"
        title="Strava Auswertung"
        description={
          <>
            Deine Rad-Aktivitäten aus Strava: Jahrestrends, persönliche Rekorde und Watt pro Kilogramm.
            {weightKg ? (
              <span className="mt-1 block text-zinc-500">
                Gewicht aus Strava: <strong className="text-zinc-400">{weightKg.toFixed(1)} kg</strong>
                {athlete?.ftp ? ` · FTP ${athlete.ftp} W` : ''}
              </span>
            ) : null}
          </>
        }
      />

      <PageSection titleId="strava-connect" title="Strava">
        <PageSectionPanel>
          {!status.configured ? (
            <div className="space-y-3 text-sm text-zinc-400">
              <p>
                Strava API ist noch nicht konfiguriert. In{' '}
                <a
                  href="https://www.strava.com/settings/api"
                  target="_blank"
                  rel="noreferrer"
                  className="text-orange-400 underline"
                >
                  strava.com/settings/api
                </a>{' '}
                eine App anlegen und in <code className="text-xs text-zinc-300">.env.local</code> + Vercel eintragen:
              </p>
              <pre className="overflow-x-auto rounded-xl bg-zinc-950 p-3 text-xs text-zinc-300">
                {`STRAVA_CLIENT_ID=deine_client_id
STRAVA_CLIENT_SECRET=dein_client_secret`}
              </pre>
              {redirectUri ? (
                <p className="text-xs text-zinc-500">
                  Authorization Callback Domain: deine Domain · Redirect URI:{' '}
                  <code className="text-orange-300">{redirectUri}</code>
                </p>
              ) : null}
            </div>
          ) : statusLoading ? (
            <p className="text-sm text-zinc-500">Status wird geladen…</p>
          ) : !status.connected ? (
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => void verbinden()}
                className="rounded-xl bg-[#FC4C02] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#e04400]"
              >
                Mit Strava verbinden
              </button>
              <p className="text-xs text-zinc-500">Lesezugriff auf Profil und alle Aktivitäten.</p>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-medium text-emerald-300">
                Verbunden · {status.activityCount ?? 0} Aktivitäten
              </span>
              <button
                type="button"
                disabled={busy}
                onClick={() => void sync()}
                className="rounded-xl border border-white/10 bg-zinc-900 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-800 disabled:opacity-50"
              >
                {busy ? 'Synchronisiere…' : 'Jetzt synchronisieren'}
              </button>
              <button
                type="button"
                onClick={() => void trennen()}
                className="text-xs text-zinc-500 underline hover:text-zinc-300"
              >
                Trennen
              </button>
            </div>
          )}
        </PageSectionPanel>
      </PageSection>

      {status.connected && auswertung ? (
        <>
          <div className="mb-4 flex flex-wrap gap-2">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                  tab === t.id
                    ? 'bg-[#FC4C02]/20 text-orange-200 ring-1 ring-[#FC4C02]/40'
                    : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {dataLoading ? (
            <p className="text-sm text-zinc-500">Auswertung wird geladen…</p>
          ) : tab === 'uebersicht' ? (
            <div className="space-y-6">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <StatKarte label="Fahrten" value={String(auswertung.totalRides)} />
                <StatKarte
                  label="Gesamt"
                  value={`${auswertung.totalKm.toLocaleString('de-DE', { maximumFractionDigits: 0 })} km`}
                  sub={formatHours(auswertung.totalHours * 3600)}
                />
                <StatKarte label="Höhenmeter" value={formatHm(auswertung.totalHm)} />
                <StatKarte
                  label="Ø W/kg (Jahre mit Leistung)"
                  value={
                    auswertung.jahre.filter((j) => j.avgWkg).length
                      ? `${(
                          auswertung.jahre.filter((j) => j.avgWkg).reduce((s, j) => s + (j.avgWkg ?? 0), 0) /
                          auswertung.jahre.filter((j) => j.avgWkg).length
                        ).toFixed(2)} W/kg`
                      : weightKg
                        ? 'Keine Leistungsdaten'
                        : 'Gewicht in Strava setzen'
                  }
                />
              </div>
              {auswertung.wkgMonat.some((m) => m.rides > 0) ? (
                <WhoopWeeklyBarChart
                  title="W/kg — letzte 24 Monate (Ø pro Monat, ≥20 min mit Leistung)"
                  points={auswertung.wkgMonat.map((m) => ({
                    label: m.label,
                    value: m.wkg,
                    highlight: false,
                  }))}
                  formatValue={(v) => (v > 0 ? `${v.toFixed(2)}` : '—')}
                  color={STRAVA_ORANGE}
                />
              ) : null}
            </div>
          ) : tab === 'entwicklung' ? (
            <div className="space-y-6">
              <WhoopWeeklyBarChart
                title="Kilometer pro Jahr"
                points={auswertung.jahre.map((j) => ({
                  label: String(j.year),
                  value: Math.round(j.km),
                }))}
                formatValue={(v) => `${v} km`}
                color={STRAVA_ORANGE}
              />
              <WhoopWeeklyBarChart
                title="Fahrten pro Jahr"
                points={auswertung.jahre.map((j) => ({
                  label: String(j.year),
                  value: j.rides,
                }))}
                color="#f97316"
              />
              <WhoopWeeklyBarChart
                title="Höhenmeter pro Jahr"
                points={auswertung.jahre.map((j) => ({
                  label: String(j.year),
                  value: Math.round(j.hm),
                }))}
                formatValue={(v) => `${v} hm`}
                color="#fb923c"
              />
              <div className="overflow-x-auto rounded-2xl border border-white/[0.06] bg-[#141618]">
                <table className="w-full min-w-[520px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-white/[0.06] text-[10px] uppercase tracking-wider text-zinc-500">
                      <th className="px-4 py-3">Jahr</th>
                      <th className="px-4 py-3">Fahrten</th>
                      <th className="px-4 py-3">km</th>
                      <th className="px-4 py-3">hm</th>
                      <th className="px-4 py-3">Ø W</th>
                      <th className="px-4 py-3">Ø W/kg</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...auswertung.jahre].reverse().map((j) => (
                      <tr key={j.year} className="border-b border-white/[0.04] text-zinc-300">
                        <td className="px-4 py-2.5 font-medium">{j.year}</td>
                        <td className="px-4 py-2.5 tabular-nums">{j.rides}</td>
                        <td className="px-4 py-2.5 tabular-nums">
                          {j.km.toLocaleString('de-DE', { maximumFractionDigits: 0 })}
                        </td>
                        <td className="px-4 py-2.5 tabular-nums">{Math.round(j.hm).toLocaleString('de-DE')}</td>
                        <td className="px-4 py-2.5 tabular-nums">{j.avgWatts ? `${Math.round(j.avgWatts)} W` : '—'}</td>
                        <td className="px-4 py-2.5 tabular-nums">
                          {j.avgWkg ? `${j.avgWkg.toFixed(2)} W/kg` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : tab === 'prs' ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {auswertung.bestleistungen.map((b) => (
                <div
                  key={b.key}
                  className="rounded-2xl border border-orange-500/15 bg-gradient-to-br from-[#FC4C02]/8 to-transparent p-4"
                >
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-orange-300/80">{b.label}</p>
                  <p className="mt-2 text-xl font-semibold text-zinc-100">{b.value}</p>
                  {b.detail ? <p className="mt-1 text-sm text-zinc-400">{b.detail}</p> : null}
                  {b.date ? <p className="mt-1 text-xs text-zinc-500">{b.date}</p> : null}
                  {b.activityId ? (
                    <a
                      href={`https://www.strava.com/activities/${b.activityId}`}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-block text-xs text-orange-400 hover:underline"
                    >
                      Auf Strava öffnen →
                    </a>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-white/[0.06] bg-[#141618]">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06] text-[10px] uppercase tracking-wider text-zinc-500">
                    <th className="px-4 py-3">Datum</th>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Distanz</th>
                    <th className="px-4 py-3">Zeit</th>
                    <th className="px-4 py-3">hm</th>
                    <th className="px-4 py-3">W</th>
                    <th className="px-4 py-3">W/kg</th>
                  </tr>
                </thead>
                <tbody>
                  {auswertung.recent.map((a) => {
                    const w = leistungWatts(a)
                    const wkg = wattProKg(w, weightKg)
                    return (
                      <tr key={a.strava_id} className="border-b border-white/[0.04] text-zinc-300">
                        <td className="whitespace-nowrap px-4 py-2.5 text-xs text-zinc-500">
                          {formatDate(a.start_date)}
                        </td>
                        <td className="max-w-[200px] truncate px-4 py-2.5">
                          <a
                            href={`https://www.strava.com/activities/${a.strava_id}`}
                            target="_blank"
                            rel="noreferrer"
                            className="hover:text-orange-300"
                          >
                            {a.name}
                          </a>
                        </td>
                        <td className="px-4 py-2.5 tabular-nums">{formatKm(a.distance_m)}</td>
                        <td className="px-4 py-2.5 tabular-nums text-xs">{formatHours(a.moving_time_s)}</td>
                        <td className="px-4 py-2.5 tabular-nums text-xs">{formatHm(a.elevation_gain_m)}</td>
                        <td className="px-4 py-2.5 tabular-nums text-xs">{w ? `${Math.round(w)}` : '—'}</td>
                        <td className="px-4 py-2.5 tabular-nums text-xs">
                          {wkg ? wkg.toFixed(2) : '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : status.connected && !auswertung && !dataLoading ? (
        <PageSection titleId="strava-empty" title="Keine Daten">
          <PageSectionPanel>
            <p className="text-sm text-zinc-400">
              Noch keine Aktivitäten gespeichert. Klicke auf „Jetzt synchronisieren“, um deine Strava-Fahrten zu
              importieren.
            </p>
          </PageSectionPanel>
        </PageSection>
      ) : null}
    </PageChrome>
  )
}
