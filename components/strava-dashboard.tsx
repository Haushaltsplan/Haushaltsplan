'use client'

import { StravaAnalyticsView } from '@/components/strava/strava-analytics-view'
import { STRAVA_COLORS, STRAVA_INTERACTIVE } from '@/components/strava/design-tokens'
import { StravaCard } from '@/components/strava/strava-card'
import { WhoopWeeklyBarChart } from '@/components/fitnessdaten/whoop-charts'
import { PageChrome, PageHero, PageSection, PageSectionPanel, ResponsiveTableWrap, appTableScrollInlineClassName } from '@/components/page-shell'
import { istOmniaNativeApp } from '@/lib/fitnessdaten/omnia-native'
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
import type { StravaSegmentEffortRow } from '@/lib/strava/strava-segments'
import type { BackfillStatus } from '@/lib/strava/strava-backfill-status'
import { supabase } from '@/lib/supabase'
import { useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'

type Tab = 'analytics' | 'entwicklung' | 'prs'

type Status = {
  configured: boolean
  connected: boolean
  athlete?: StravaAthleteProfile | null
  activityCount?: number
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
  const [segmentEfforts, setSegmentEfforts] = useState<StravaSegmentEffortRow[]>([])
  const [segmentBacklog, setSegmentBacklog] = useState(0)
  const [backfill, setBackfill] = useState<BackfillStatus | null>(null)
  const [backfillRound, setBackfillRound] = useState<number | null>(null)
  const [athlete, setAthlete] = useState<StravaAthleteProfile | null>(null)
  const [busy, setBusy] = useState(false)
  const [dataLoading, setDataLoading] = useState(false)
  const [redirectUri, setRedirectUri] = useState<string | null>(null)
  const [callbackDomain, setCallbackDomain] = useState<string | null>(null)
  const [nativeApp] = useState(() => istOmniaNativeApp())
  const [gewichtInput, setGewichtInput] = useState('')
  const [gewichtSpeichern, setGewichtSpeichern] = useState(false)

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
      const body = (await res.json()) as {
        auswertung?: StravaAuswertung
        athlete?: StravaAthleteProfile | null
        activities?: StravaActivityRow[]
        segmentEfforts?: StravaSegmentEffortRow[]
        segmentBacklog?: number
        backfill?: BackfillStatus
      }
      if (body.auswertung) setAuswertung(body.auswertung)
      if (body.activities) setAllActivities(body.activities)
      if (body.segmentEfforts) setSegmentEfforts(body.segmentEfforts)
      setSegmentBacklog(body.segmentBacklog ?? 0)
      if (body.backfill) setBackfill(body.backfill)
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
  }, [])

  useEffect(() => {
    void ladeStatus()
    const { data: sub } = supabase.auth.onAuthStateChange(() => void ladeStatus())
    return () => sub.subscription.unsubscribe()
  }, [ladeStatus])

  useEffect(() => {
    if (status.connected) void ladeDaten()
  }, [status.connected, ladeDaten])

  const sync = useCallback(
    async (opts: { fullImport?: boolean } = {}) => {
      setBusy(true)
      try {
        const res = await stravaApiFetch('/api/strava/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ full: opts.fullImport ?? false }),
        })
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
    },
    [ladeDaten, ladeStatus],
  )

  const startBackfill = useCallback(async () => {
    setBusy(true)
    setBackfillRound(1)
    try {
      const res = await stravaApiFetch('/api/strava/backfill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ maxRounds: 15 }),
      })
      const body = (await res.json()) as {
        ok?: boolean
        message?: string
        fehler?: string
        rounds?: number
        backfill?: BackfillStatus
      }
      if (body.ok) {
        toast.success(body.message ?? 'Backfill abgeschlossen')
        if (body.backfill) setBackfill(body.backfill)
        if (body.rounds) setBackfillRound(body.rounds)
        await ladeDaten()
      } else {
        toast.error(body.fehler ?? body.message ?? 'Backfill fehlgeschlagen')
      }
    } finally {
      setBusy(false)
      setBackfillRound(null)
    }
  }, [ladeDaten])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('strava') === 'connected') {
      toast.success('Strava verbunden — Aktivitäten werden synchronisiert.')
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
        body: JSON.stringify({ omnia_weight_kg: parsed }),
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
  }, [gewichtInput, ladeDaten])

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
    <PageChrome density="compact" className="max-w-full overflow-x-hidden">
      <PageHero
        density="compact"
        eyebrow="Rennrad"
        title="Athletic Analytics"
        description={
          <>
            Professionelle Performance-Auswertung deiner Strava-Aktivitäten — Volume, Intensität und Progression.
            {athlete?.ftp ? (
              <span className="mt-1 block text-[var(--app-text-muted)]">
                Strava FTP: <strong className="text-[var(--app-text-muted)]">{athlete.ftp} W</strong>
              </span>
            ) : null}
          </>
        }
      />

      <PageSection titleId="strava-connect" title="Strava">
        <PageSectionPanel className="border-[var(--app-border)] bg-[var(--app-surface-muted)]">
          {!status.configured ? (
            <div className="space-y-3 text-sm text-[var(--app-text-muted)]">
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
                eine App anlegen und in <code className="text-xs text-[var(--app-text)]">.env.local</code> + Vercel eintragen:
              </p>
              <pre className={`app-break-anywhere ${appTableScrollInlineClassName} rounded-xl bg-black/60 p-3 text-xs text-[var(--app-text)]`}>
                {`STRAVA_CLIENT_ID=deine_client_id
STRAVA_CLIENT_SECRET=dein_client_secret`}
              </pre>
              {redirectUri ? (
                <div className="space-y-1 text-xs text-[var(--app-text-muted)]">
                  <p>
                    In Strava unter <strong className="text-[var(--app-text-muted)]">Authorization Callback Domain</strong> nur den
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
            <p className="text-sm text-[var(--app-text-muted)]">Status wird geladen…</p>
          ) : !status.connected ? (
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => void verbinden()}
                className={[
                  'rounded-xl px-4 py-2.5 text-sm font-semibold text-white',
                  STRAVA_INTERACTIVE,
                ].join(' ')}
                style={{ background: STRAVA_COLORS.orange }}
              >
                Mit Strava verbinden
              </button>
              <p className="text-xs text-[var(--app-text-muted)]">Lesezugriff auf Profil und alle Aktivitäten.</p>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-medium text-emerald-300">
                Verbunden · {status.activityCount ?? 0} Aktivitäten
              </span>
              <button
                type="button"
                disabled={busy}
                onClick={() => void sync({})}
                className={[
                  'rounded-xl border border-white/10 bg-[var(--app-surface-muted)] px-4 py-2 text-sm text-[var(--app-text)] hover:bg-[var(--app-surface-hover)] disabled:opacity-50',
                  STRAVA_INTERACTIVE,
                ].join(' ')}
              >
                {busy ? 'Synchronisiere…' : 'Jetzt synchronisieren'}
              </button>
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
                className="text-xs text-[var(--app-text-muted)] underline transition-colors hover:text-[var(--app-text)]"
              >
                Trennen
              </button>
            </div>
          )}
        </PageSectionPanel>
      </PageSection>

      {status.connected ? (
        <PageSection titleId="strava-gewicht" title="Gewicht für W/kg">
          <PageSectionPanel className="border-[var(--app-border)] bg-[var(--app-surface-muted)]">
            <p className="mb-3 text-xs text-[var(--app-text-muted)]">
              W/kg wird mit deinem Omnia-Gewicht berechnet (nicht Strava). Beim Sync werden Watt- + HF-Streams
              geladen (max. 25 Streams pro Sync).
            </p>
            <div className="flex flex-wrap items-end gap-3">
              <label className="block">
                <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--app-text-muted)]">Körpergewicht (kg)</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={gewichtInput}
                  onChange={(e) => setGewichtInput(e.target.value)}
                  placeholder="z. B. 72,5"
                  className="mt-1.5 w-32 rounded-xl border border-white/10 bg-black/60 px-3 py-2 text-sm text-[var(--app-text)] transition-colors focus:border-[#FC4C02]/40 focus:outline-none"
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
                    : 'bg-[var(--app-surface-muted)] text-[var(--app-text-muted)] hover:text-[var(--app-text)]',
                ].join(' ')}
              >
                {t.label}
              </button>
            ))}
          </div>

          {dataLoading ? (
            <p className="text-sm text-[var(--app-text-muted)]">Auswertung wird geladen…</p>
          ) : tab === 'analytics' ? (
            <StravaAnalyticsView
              activities={allActivities}
              athlete={athlete}
              segmentEfforts={segmentEfforts}
              segmentBacklog={segmentBacklog}
              backfill={backfill}
              backfillBusy={busy}
              backfillRound={backfillRound}
              onBackfill={() => void startBackfill()}
              onGoalsSaved={() => void ladeDaten()}
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
              <StravaCard padding="sm">
                <ResponsiveTableWrap>
                <table className="w-full min-w-[520px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-white/[0.06] text-[10px] uppercase tracking-wider text-[var(--app-text-muted)]">
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
                      <tr key={j.year} className="border-b border-white/[0.04] text-[var(--app-text)] transition-colors hover:bg-white/[0.02]">
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
                </ResponsiveTableWrap>
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
                        <p className="mt-2 text-xl font-semibold text-[var(--app-text)]">{b.value}</p>
                        {b.detail ? <p className="mt-1 text-sm text-[var(--app-text-muted)]">{b.detail}</p> : null}
                        {b.date ? <p className="mt-1 text-xs text-[var(--app-text-muted)]">{b.date}</p> : null}
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
          <PageSectionPanel className="border-[var(--app-border)] bg-[var(--app-surface-muted)]">
            <p className="text-sm text-[var(--app-text-muted)]">
              Noch keine Aktivitäten gespeichert. Klicke auf „Jetzt synchronisieren“, um deine Strava-Fahrten zu
              importieren.
            </p>
          </PageSectionPanel>
        </PageSection>
      ) : null}
    </PageChrome>
  )
}
