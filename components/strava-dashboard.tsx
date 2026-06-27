'use client'

import { StravaAnalyticsView } from '@/components/strava/strava-analytics-view'
import { StravaAthleteSwitcher } from '@/components/strava/strava-athlete-switcher'
import { STRAVA_COLORS, STRAVA_INTERACTIVE } from '@/components/strava/design-tokens'
import { StravaCard } from '@/components/strava/strava-card'
import { WhoopWeeklyBarChart } from '@/components/fitnessdaten/whoop-charts'
import { PageChrome, PageHero, PageSection, PageSectionPanel } from '@/components/page-shell'
import { istOmniaNativeApp } from '@/lib/fitnessdaten/omnia-native'
import type { StravaConnectionPublic } from '@/lib/strava/strava-connections'
import { stravaApiFetch } from '@/lib/strava/strava-api-fetch'
import { oeffneStravaOAuthUrl } from '@/lib/strava/strava-oauth-open'
import { stravaRedirectUri } from '@/lib/strava/strava-types'
import type {
  StravaActivityRow,
  StravaAthleteProfile,
  StravaAuswertung,
  StravaPersoenlicheBestleistung,
  StravaPrKategorie,
} from '@/lib/strava/strava-types'
import { supabase } from '@/lib/supabase'
import { useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'

type Tab = 'analytics' | 'entwicklung' | 'prs'

type Status = {
  configured: boolean
  connected: boolean
  athlete?: StravaAthleteProfile | null
  activityCount?: number
  connections?: StravaConnectionPublic[]
}

const PR_KATEGORIE_TITEL: Record<StravaPrKategorie, string> = {
  distanz: 'Distanz & Tempo',
  hoehe: 'Höhe & Steigung',
  leistung: 'Leistung & W/kg',
  kalorien: 'Kalorien',
  puls: 'Herzfrequenz',
  jahr: 'Jahresrekorde',
}

const PR_REIHENFOLGE: StravaPrKategorie[] = ['distanz', 'hoehe', 'leistung', 'kalorien', 'puls', 'jahr']

export function StravaDashboard() {
  const [tab, setTab] = useState<Tab>('analytics')
  const [status, setStatus] = useState<Status>({ configured: false, connected: false })
  const [statusLoading, setStatusLoading] = useState(true)
  const [auswertung, setAuswertung] = useState<StravaAuswertung | null>(null)
  const [allActivities, setAllActivities] = useState<StravaActivityRow[]>([])
  const [athlete, setAthlete] = useState<StravaAthleteProfile | null>(null)
  const [busy, setBusy] = useState(false)
  const [dataLoading, setDataLoading] = useState(false)
  const [redirectUri, setRedirectUri] = useState<string | null>(null)
  const [callbackDomain, setCallbackDomain] = useState<string | null>(null)
  const [nativeApp] = useState(() => istOmniaNativeApp())
  const [gewichtInput, setGewichtInput] = useState('')
  const [gewichtSpeichern, setGewichtSpeichern] = useState(false)
  const [connections, setConnections] = useState<StravaConnectionPublic[]>([])
  const [activeConnectionId, setActiveConnectionId] = useState<string | null>(null)

  useEffect(() => {
    void fetch('/api/strava/ping', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((p: { redirectUri?: string; callbackDomain?: string } | null) => {
        setRedirectUri(p?.redirectUri ?? stravaRedirectUri(window.location.origin))
        setCallbackDomain(p?.callbackDomain ?? null)
      })
      .catch(() => setRedirectUri(stravaRedirectUri(window.location.origin)))
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
      let conns: StravaConnectionPublic[] = []
      const { data } = await supabase.auth.getSession()
      if (data.session?.access_token) {
        const res = await stravaApiFetch('/api/strava/status')
        if (res.ok) {
          const s = (await res.json()) as Status
          connected = Boolean(s.connected)
          athleteProfil = s.athlete ?? null
          activityCount = s.activityCount ?? 0
          conns = s.connections ?? []
          if (conns.length) {
            setConnections(conns)
            setActiveConnectionId((prev) => {
              if (prev && conns.some((c) => c.id === prev)) return prev
              return conns.find((c) => c.isPrimary)?.id ?? conns[0].id
            })
          }
        }
      }
      setStatus({ configured, connected, athlete: athleteProfil, activityCount, connections: conns })
      setAthlete(athleteProfil)
    } catch {
      toast.error('Strava-Status konnte nicht geladen werden.')
    } finally {
      setStatusLoading(false)
    }
  }, [])

  const ladeDaten = useCallback(async (connectionId?: string | null) => {
    setDataLoading(true)
    try {
      const cid = connectionId ?? activeConnectionId
      const qs = cid ? `?connection=${encodeURIComponent(cid)}` : ''
      const res = await stravaApiFetch(`/api/strava/activities${qs}`)
      if (!res.ok) return
      const body = (await res.json()) as {
        auswertung?: StravaAuswertung
        athlete?: StravaAthleteProfile | null
        activities?: StravaActivityRow[]
        connectionId?: string | null
      }
      if (body.auswertung) setAuswertung(body.auswertung)
      if (body.activities) setAllActivities(body.activities)
      if (body.connectionId) setActiveConnectionId(body.connectionId)
      if (body.athlete) {
        setAthlete(body.athlete)
        const kg = body.athlete.omnia_weight_kg
        setGewichtInput(kg != null ? String(kg) : '')
      }
    } catch {
      toast.error('Strava-Auswertung konnte nicht geladen werden.')
    } finally {
      setDataLoading(false)
    }
  }, [activeConnectionId])

  useEffect(() => {
    void ladeStatus()
    const { data: sub } = supabase.auth.onAuthStateChange(() => void ladeStatus())
    return () => sub.subscription.unsubscribe()
  }, [ladeStatus])

  useEffect(() => {
    if (status.connected) void ladeDaten(activeConnectionId)
  }, [status.connected, activeConnectionId, ladeDaten])

  const sync = useCallback(
    async (opts: { fullImport?: boolean; syncAll?: boolean; connectionId?: string | null } = {}) => {
      setBusy(true)
      try {
        const res = await stravaApiFetch('/api/strava/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            full: opts.fullImport ?? false,
            syncAll: opts.syncAll ?? false,
            connectionId: opts.connectionId ?? activeConnectionId,
          }),
        })
        const body = (await res.json()) as { ok?: boolean; message?: string; fehler?: string }
        if (body.ok) {
          toast.success(body.message ?? 'Synchronisiert')
          await ladeStatus()
          await ladeDaten(opts.connectionId ?? activeConnectionId)
        } else {
          toast.error(body.fehler ?? body.message ?? 'Sync fehlgeschlagen')
        }
      } finally {
      setBusy(false)
    }
  }, [activeConnectionId, ladeDaten, ladeStatus])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('strava') === 'connected') {
      toast.success(
        params.get('guest') === '1'
          ? 'Freund verbunden — Daten werden synchronisiert.'
          : 'Strava verbunden — Aktivitäten werden synchronisiert.',
      )
      void ladeStatus().then(() => sync({}))
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
        if (status.connected) void sync({})
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

  const verbinden = useCallback(
    async (mode: 'primary' | 'guest' = 'primary', label?: string) => {
      const { data } = await supabase.auth.getSession()
      if (!data.session?.access_token) {
        toast.error('Bitte zuerst in Omnia einloggen.')
        return
      }
      try {
        const res = await stravaApiFetch('/api/strava/auth/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode, label }),
        })
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
        toast(
          mode === 'guest'
            ? 'Freund:in meldet sich bei Strava an. Danach Omnia wieder öffnen.'
            : 'Strava-Anmeldung im Browser. Danach Omnia wieder öffnen.',
          { duration: 9000 },
        )
      }
    } catch {
      toast.error('Strava-Verbindung konnte nicht gestartet werden.')
    }
  }, [nativeApp])

  const entferneVerbindung = useCallback(
    async (connectionId: string) => {
      await stravaApiFetch('/api/strava/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionId }),
      })
      toast.success('Verbindung entfernt.')
      await ladeStatus()
      await ladeDaten()
    },
    [ladeDaten, ladeStatus],
  )

  const speichereGewicht = useCallback(async () => {
    const parsed = Number.parseFloat(gewichtInput.replace(',', '.'))
    if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 300) {
      toast.error('Bitte ein gültiges Gewicht in kg eingeben (1–300).')
      return
    }
    setGewichtSpeichern(true)
    try {
      const res = await stravaApiFetch('/api/strava/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ omnia_weight_kg: parsed, connectionId: activeConnectionId }),
      })
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string }
        toast.error(err.error ?? 'Gewicht konnte nicht gespeichert werden.')
        return
      }
      const body = (await res.json()) as { athlete?: StravaAthleteProfile | null }
      if (body.athlete) setAthlete(body.athlete)
      toast.success('Gewicht gespeichert — W/kg wird neu berechnet.')
      await ladeDaten()
    } finally {
      setGewichtSpeichern(false)
    }
  }, [gewichtInput, ladeDaten, activeConnectionId])

  const trennen = useCallback(async () => {
    await stravaApiFetch('/api/strava/disconnect', { method: 'POST' })
    setStatus((s) => ({ ...s, connected: false, activityCount: 0 }))
    setAuswertung(null)
    setAllActivities([])
    toast.success('Strava getrennt.')
  }, [])

  const weightKg = athlete?.omnia_weight_kg ?? null

  const prGruppen = useMemo(
    () =>
      PR_REIHENFOLGE.map((kat) => ({
        kat,
        titel: PR_KATEGORIE_TITEL[kat],
        items: (auswertung?.bestleistungen ?? []).filter((b) => b.kategorie === kat),
      })).filter((g) => g.items.length > 0),
    [auswertung?.bestleistungen],
  )

  const tabs: { id: Tab; label: string }[] = [
    { id: 'analytics', label: 'Performance' },
    { id: 'entwicklung', label: 'Entwicklung' },
    { id: 'prs', label: 'Bestleistungen' },
  ]

  return (
    <PageChrome density="compact" className="max-w-full overflow-x-hidden bg-[#050506]">
      <PageHero
        density="compact"
        eyebrow="Rennrad"
        title="Athletic Analytics"
        description={
          <>
            Professionelle Performance-Auswertung deiner Strava-Aktivitäten — Volume, Intensität und Progression.
            {athlete?.ftp ? (
              <span className="mt-1 block text-zinc-500">
                Strava FTP: <strong className="text-zinc-400">{athlete.ftp} W</strong>
              </span>
            ) : null}
          </>
        }
      />

      <PageSection titleId="strava-connect" title="Strava">
        <PageSectionPanel className="border-slate-500/15 bg-[#0c0d0f]">
          {!status.configured ? (
            <div className="space-y-3 text-sm text-zinc-400">
              <p>
                Strava API ist noch nicht konfiguriert. In{' '}
                <a
                  href="https://www.strava.com/settings/api"
                  target="_blank"
                  rel="noreferrer"
                  className="text-orange-400 underline transition-colors hover:text-orange-300"
                >
                  strava.com/settings/api
                </a>{' '}
                eine App anlegen und in <code className="text-xs text-zinc-300">.env.local</code> + Vercel eintragen:
              </p>
              <pre className="overflow-x-auto rounded-xl bg-black/60 p-3 text-xs text-zinc-300">
                {`STRAVA_CLIENT_ID=deine_client_id
STRAVA_CLIENT_SECRET=dein_client_secret`}
              </pre>
              {redirectUri ? (
                <div className="space-y-1 text-xs text-zinc-500">
                  <p>
                    In Strava unter <strong className="text-zinc-400">Authorization Callback Domain</strong> nur den
                    Hostnamen eintragen (ohne https://, ohne Pfad):
                  </p>
                  {callbackDomain ? (
                    <code className="block rounded bg-black/60 px-2 py-1 text-orange-300">{callbackDomain}</code>
                  ) : null}
                  <p className="pt-1">
                    Redirect URI (wird von der App gesendet):{' '}
                    <code className="text-orange-300">{redirectUri}</code>
                  </p>
                </div>
              ) : null}
            </div>
          ) : statusLoading ? (
            <p className="text-sm text-zinc-500">Status wird geladen…</p>
          ) : !status.connected ? (
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => void verbinden('primary')}
                className={[
                  'rounded-xl px-4 py-2.5 text-sm font-semibold text-white',
                  STRAVA_INTERACTIVE,
                ].join(' ')}
                style={{ background: STRAVA_COLORS.orange }}
              >
                Mit Strava verbinden
              </button>
              <p className="text-xs text-zinc-500">Lesezugriff auf Profil und alle Aktivitäten.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-medium text-emerald-300">
                  Verbunden · {status.activityCount ?? 0} Aktivitäten gesamt
                </span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void sync({})}
                  className={[
                    'rounded-xl border border-white/10 bg-zinc-900 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-800 disabled:opacity-50',
                    STRAVA_INTERACTIVE,
                  ].join(' ')}
                >
                  {busy ? 'Synchronisiere…' : 'Aktiven Athlet syncen'}
                </button>
                {connections.length > 1 ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void sync({ syncAll: true })}
                    className={[
                      'rounded-xl border border-cyan-500/20 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-200 hover:bg-cyan-500/15 disabled:opacity-50',
                      STRAVA_INTERACTIVE,
                    ].join(' ')}
                  >
                    Alle syncen
                  </button>
                ) : null}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void sync({ fullImport: true })}
                  className={[
                    'rounded-xl border border-orange-500/20 bg-orange-500/10 px-3 py-2 text-xs text-orange-200 hover:bg-orange-500/15 disabled:opacity-50',
                    STRAVA_INTERACTIVE,
                  ].join(' ')}
                  title="Alle Aktivitäten + Polylines neu laden"
                >
                  Vollimport
                </button>
                <button
                  type="button"
                  onClick={() => void trennen()}
                  className="text-xs text-zinc-500 underline transition-colors hover:text-zinc-300"
                >
                  Alles trennen
                </button>
              </div>
              {connections.length > 0 ? (
                <StravaAthleteSwitcher
                  connections={connections}
                  activeId={activeConnectionId}
                  onSelect={(id) => {
                    setActiveConnectionId(id)
                    void ladeDaten(id)
                  }}
                  onAddGuest={(label) => void verbinden('guest', label)}
                  onRemove={(id) => void entferneVerbindung(id)}
                  busy={busy}
                />
              ) : null}
            </div>
          )}
        </PageSectionPanel>
      </PageSection>

      {status.connected ? (
        <PageSection titleId="strava-gewicht" title="Gewicht für W/kg">
          <PageSectionPanel className="border-slate-500/15 bg-[#0c0d0f]">
            <p className="mb-3 text-xs text-zinc-500">
              W/kg wird mit deinem Omnia-Gewicht berechnet (nicht Strava). Beim Sync werden Watt- + HF-Streams
              geladen (max. 12 Streams pro Athlet/Sync).
            </p>
            <div className="flex flex-wrap items-end gap-3">
              <label className="block">
                <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-500">Körpergewicht (kg)</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={gewichtInput}
                  onChange={(e) => setGewichtInput(e.target.value)}
                  placeholder="z. B. 72,5"
                  className="mt-1.5 w-32 rounded-xl border border-white/10 bg-black/60 px-3 py-2 text-sm text-zinc-100 transition-colors focus:border-[#FC4C02]/40 focus:outline-none"
                />
              </label>
              <button
                type="button"
                disabled={gewichtSpeichern}
                onClick={() => void speichereGewicht()}
                className={[
                  'rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-50',
                  STRAVA_INTERACTIVE,
                ].join(' ')}
                style={{ background: STRAVA_COLORS.orange }}
              >
                {gewichtSpeichern ? 'Speichern…' : 'Gewicht speichern'}
              </button>
              {weightKg ? (
                <span className="text-xs text-emerald-400/90">Aktiv: {weightKg.toFixed(1)} kg</span>
              ) : (
                <span className="text-xs text-amber-400/90">Noch kein Gewicht — W/kg fehlt</span>
              )}
            </div>
          </PageSectionPanel>
        </PageSection>
      ) : null}

      {status.connected && auswertung ? (
        <>
          <div className="mb-4 flex flex-wrap gap-2">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={[
                  'rounded-full px-4 py-1.5 text-sm font-medium',
                  STRAVA_INTERACTIVE,
                  tab === t.id
                    ? 'bg-[#FC4C02]/20 text-orange-200 ring-1 ring-[#FC4C02]/40'
                    : 'bg-zinc-900/80 text-zinc-400 hover:text-zinc-200',
                ].join(' ')}
              >
                {t.label}
              </button>
            ))}
          </div>

          {dataLoading ? (
            <p className="text-sm text-zinc-500">Auswertung wird geladen…</p>
          ) : tab === 'analytics' ? (
            <StravaAnalyticsView
              activities={allActivities}
              athlete={athlete}
              connectionId={activeConnectionId}
              onGoalsSaved={() => void ladeDaten(activeConnectionId)}
            />
          ) : tab === 'entwicklung' ? (
            <div className="space-y-6">
              {auswertung.wkgMonat.some((m) => m.rides > 0) ? (
                <WhoopWeeklyBarChart
                  title="W/kg — letzte 24 Monate (Ø pro Monat, ≥20 min mit Leistung)"
                  points={auswertung.wkgMonat.map((m) => ({
                    label: m.label,
                    value: m.wkg,
                    highlight: false,
                  }))}
                  formatValue={(v) => (v > 0 ? `${v.toFixed(2)}` : '—')}
                  color={STRAVA_COLORS.orange}
                />
              ) : null}
              <WhoopWeeklyBarChart
                title="Kilometer pro Jahr"
                points={auswertung.jahre.map((j) => ({
                  label: String(j.year),
                  value: Math.round(j.km),
                }))}
                formatValue={(v) => `${v} km`}
                color={STRAVA_COLORS.orange}
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
              <StravaCard padding="sm" className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-white/[0.06] text-[10px] uppercase tracking-wider text-zinc-500">
                      <th className="px-4 py-3">Jahr</th>
                      <th className="px-4 py-3">Fahrten</th>
                      <th className="px-4 py-3">km</th>
                      <th className="px-4 py-3">hm</th>
                      <th className="px-4 py-3">kcal</th>
                      <th className="px-4 py-3">Ø W</th>
                      <th className="px-4 py-3">Ø W/kg</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...auswertung.jahre].reverse().map((j) => (
                      <tr key={j.year} className="border-b border-white/[0.04] text-zinc-300 transition-colors hover:bg-white/[0.02]">
                        <td className="px-4 py-2.5 font-medium">{j.year}</td>
                        <td className="px-4 py-2.5 tabular-nums">{j.rides}</td>
                        <td className="px-4 py-2.5 tabular-nums">
                          {j.km.toLocaleString('de-DE', { maximumFractionDigits: 0 })}
                        </td>
                        <td className="px-4 py-2.5 tabular-nums">{Math.round(j.hm).toLocaleString('de-DE')}</td>
                        <td className="px-4 py-2.5 tabular-nums text-xs">
                          {j.kcal > 0 ? Math.round(j.kcal).toLocaleString('de-DE') : '—'}
                        </td>
                        <td className="px-4 py-2.5 tabular-nums">{j.avgWatts ? `${Math.round(j.avgWatts)} W` : '—'}</td>
                        <td className="px-4 py-2.5 tabular-nums">
                          {j.avgWkg ? `${j.avgWkg.toFixed(2)} W/kg` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </StravaCard>
            </div>
          ) : (
            <div className="space-y-8">
              {prGruppen.map((gruppe) => (
                <div key={gruppe.kat}>
                  <h3 className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-orange-300/90">
                    {gruppe.titel}
                  </h3>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {gruppe.items.map((b: StravaPersoenlicheBestleistung) => (
                      <StravaCard
                        key={b.key}
                        padding="md"
                        hover
                        className="border-orange-500/15 bg-gradient-to-br from-[#FC4C02]/8 to-transparent"
                      >
                        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-orange-300/80">
                          {b.label}
                        </p>
                        <p className="mt-2 text-xl font-semibold text-zinc-100">{b.value}</p>
                        {b.detail ? <p className="mt-1 text-sm text-zinc-400">{b.detail}</p> : null}
                        {b.date ? <p className="mt-1 text-xs text-zinc-500">{b.date}</p> : null}
                        {b.activityId ? (
                          <a
                            href={`https://www.strava.com/activities/${b.activityId}`}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-2 inline-block text-xs text-orange-400 transition-colors hover:underline"
                          >
                            Auf Strava öffnen →
                          </a>
                        ) : null}
                      </StravaCard>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      ) : status.connected && !auswertung && !dataLoading ? (
        <PageSection titleId="strava-empty" title="Keine Daten">
          <PageSectionPanel className="border-slate-500/15 bg-[#0c0d0f]">
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
