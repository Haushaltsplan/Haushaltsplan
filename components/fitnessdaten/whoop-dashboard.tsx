'use client'

import { formatUhrzeit } from '@/lib/fitnessdaten/activity-detect'
import { WhoopHrChart } from '@/components/fitnessdaten/whoop-hr-chart'
import { FitnessWhoopBlePanel } from '@/components/fitnessdaten/fitness-whoop-ble-panel'
import { FitnessWhoopImportPanel } from '@/components/fitnessdaten/fitness-whoop-import-panel'
import { FitnessUserProfilePanel } from '@/components/fitnessdaten/fitness-user-profile-panel'
import { FitnessWhoopCloudPanel } from '@/components/fitnessdaten/fitness-whoop-cloud-panel'
import { FitnessVitalsPanel } from '@/components/fitnessdaten/fitness-vitals-panel'
import { WhoopBigRing } from '@/components/fitnessdaten/whoop-big-ring'
import {
  WHOOP_ZONE_13,
  WHOOP_ZONE_45,
  WhoopDualLineChart,
  WhoopRestorativeChart,
  WhoopStackedZoneChart,
  WhoopTimeInBedChart,
  WhoopWeeklyBarChart,
  WhoopWeeklyLineChart,
} from '@/components/fitnessdaten/whoop-charts'
import { WhoopCoachBar, WhoopInfoModal, WhoopSyncBanner } from '@/components/fitnessdaten/whoop-info-modal'
import { appModalScrollHiddenClassName } from '@/lib/app-modal-overlay'
import {
  WhoopAgeOrb,
  WhoopAgeTrendChart,
  WhoopAgingScale,
  WhoopAgingTrendChart,
  WhoopHealthspanBar,
  WhoopLiveHrMonitor,
} from '@/components/fitnessdaten/whoop-healthspan'
import { WhoopHealthTile, WhoopInsightCard, WhoopMetricRow } from '@/components/fitnessdaten/whoop-metric-row'
import {
  recoveryColor,
  recoveryLabelDe,
  WhoopRing,
} from '@/components/fitnessdaten/whoop-ring'
import { WhoopActivityModal } from '@/components/fitnessdaten/whoop-activity-modal'
import { WhoopMetricTrendModal } from '@/components/fitnessdaten/whoop-metric-trend-modal'
import { getMetricInfo, type MetricInfo, type MetricInfoId } from '@/lib/fitnessdaten/metric-explanations'
import { baueWhoopDashboard } from '@/lib/fitnessdaten/metrics-engine'
import {
  HOME_METRICS,
  baselineFuerMetrik,
  formatMetricWert,
  heuteWert,
  type HomeMetricId,
} from '@/lib/fitnessdaten/trend-data'
import type { WhoopActivity } from '@/lib/fitnessdaten/daily-records'
import { baseline30, ladeDailyStore } from '@/lib/fitnessdaten/daily-records'
import { zoneSegmenteAusTag } from '@/lib/fitnessdaten/healthspan-engine'
import { formatStundenMin } from '@/lib/fitnessdaten/sleep-detail'
import type { WhoopDayRecord } from '@/lib/fitnessdaten/daily-records'
import { formatZoneAnteil } from '@/lib/fitnessdaten/history-storage'
import type { FitnessSnapshot } from '@/lib/fitnessdaten/types'
import { HR_ZONE_COLORS, HR_ZONE_LABELS } from '@/lib/fitnessdaten/types'
import type { WhoopWebBlePhase } from '@/lib/fitnessdaten/web-bluetooth-whoop'
import { useMemo, useState, useEffect, useCallback } from 'react'
import toast from 'react-hot-toast'
import { useWhoopBle } from '@/components/fitnessdaten/whoop-ble-provider'
import { setzeWhoopBleAlwaysOn } from '@/lib/fitnessdaten/whoop-ble-keepalive'
import { syncWhoopCloudVomServer, WHOOP_CLOUD_SYNC_EVENT } from '@/lib/fitnessdaten/whoop-cloud-merge'
import { migriereStalenVo2AusDaily, vo2MaxQuelle } from '@/lib/fitnessdaten/vo2max-engine'
import { migriereStalenSchritteAusDaily } from '@/lib/fitnessdaten/steps-engine'

type Tab = 'home' | 'sleep' | 'recovery' | 'strain' | 'health' | 'connect'

type Props = {
  snapshot: FitnessSnapshot | null
  phase: WhoopWebBlePhase
  onSnapshot: (s: FitnessSnapshot | null) => void
  onPhaseChange: (p: WhoopWebBlePhase) => void
}

function formatDatum() {
  return new Date().toLocaleDateString('de-DE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

function tagLabel(iso: string): string {
  return new Date(iso + 'T12:00:00').toLocaleDateString('de-DE', {
    weekday: 'short',
    day: 'numeric',
  })
}

function wochePunkte(woche: WhoopDayRecord[], field: keyof WhoopDayRecord): { label: string; value: number; highlight?: boolean }[] {
  return woche.map((d, i) => ({
    label: tagLabel(d.date),
    value: typeof d[field] === 'number' ? (d[field] as number) : 0,
    highlight: i === woche.length - 1,
  }))
}

function formatMinuten(m: number): string {
  const h = Math.floor(m / 60)
  const min = Math.round(m % 60)
  return `${h}:${String(min).padStart(2, '0')}`
}

function schlafstressSegmente(d: WhoopDayRecord) {
  const total = d.sleepMinutes ?? 0
  if (total <= 0) {
    return [
      { key: 'high', min: 0, color: '#f39c12' },
      { key: 'med', min: 0, color: '#2ecc71' },
      { key: 'low', min: 0, color: '#5eb3d6' },
    ]
  }
  const score = d.sleepScore ?? 70
  const high = Math.round((total * Math.max(0, 55 - score)) / 100)
  const med = Math.round(total * 0.2)
  const low = Math.max(0, total - high - med)
  return [
    { key: 'high', min: high, color: '#f39c12' },
    { key: 'med', min: med, color: '#2ecc71' },
    { key: 'low', min: low, color: '#5eb3d6' },
  ]
}

export function WhoopDashboard({ snapshot, phase, onSnapshot, onPhaseChange }: Props) {
  const { verbinden, bleOk } = useWhoopBle()
  const [tab, setTab] = useState<Tab>('home')
  const [info, setInfo] = useState<MetricInfo | null>(null)
  const [expandedHealthMetric, setExpandedHealthMetric] = useState<string | null>(null)
  const [coachExpanded, setCoachExpanded] = useState(false)
  const [dataRevision, setDataRevision] = useState(0)
  const [trendMetric, setTrendMetric] = useState<HomeMetricId | null>(null)
  const [selectedActivity, setSelectedActivity] = useState<WhoopActivity | null>(null)
  const [statusBusy, setStatusBusy] = useState(false)
  const showInfo = (id: MetricInfoId) => setInfo(getMetricInfo(id))
  const live = snapshot?.live
  const scores = snapshot?.scores
  const deviceInfo = snapshot?.deviceInfo
  const model = useMemo(() => baueWhoopDashboard(snapshot), [snapshot, dataRevision])

  useEffect(() => {
    // Beim ersten Render: alte Schätz-Werte aus localStorage entfernen
    migriereStalenVo2AusDaily()
    migriereStalenSchritteAusDaily()
    const onSync = () => setDataRevision((r) => r + 1)
    window.addEventListener(WHOOP_CLOUD_SYNC_EVENT, onSync)
    return () => window.removeEventListener(WHOOP_CLOUD_SYNC_EVENT, onSync)
  }, [])

  const isLive = phase === 'live'
  const isConnecting = phase === 'connecting' || phase === 'waiting_hr'

  const cloudSync = useCallback(async (mitToast = false): Promise<boolean> => {
    const res = await syncWhoopCloudVomServer()
    if (res.ok) {
      setDataRevision((r) => r + 1)
      if (mitToast) toast.success(res.message)
      return true
    }
    const fehler = res.fehler ?? res.message ?? ''
    if (mitToast && fehler && !/nicht verbunden/i.test(fehler)) {
      toast.error(fehler)
    }
    return false
  }, [])

  const onStatusTap = useCallback(async () => {
    if (statusBusy || isConnecting) return
    setStatusBusy(true)
    try {
      if (isLive) {
        await cloudSync(true)
        return
      }
      setzeWhoopBleAlwaysOn(true)
      if (!bleOk) {
        toast.error('Bluetooth nicht verfügbar — nur Cloud-Sync wird versucht.')
        await cloudSync(true)
        return
      }
      await Promise.all([verbinden('whoop'), cloudSync(false)])
    } finally {
      setStatusBusy(false)
    }
  }, [bleOk, cloudSync, isConnecting, isLive, statusBusy, verbinden])

  const statusLabel = statusBusy
    ? isLive
      ? 'Sync …'
      : 'Starte …'
    : isLive
      ? 'Live'
      : isConnecting
        ? phase === 'waiting_hr'
          ? 'Warte …'
          : 'Verbinde'
        : 'Offline'

  const zoneAnteil = scores?.zoneMinutes ? formatZoneAnteil(scores.zoneMinutes) : []
  const { heute, woche, metriken, aktivitaeten, aktivitaetenHistorie, journal, schlafdefizit, baselines } = model

  const tabs: { id: Tab; label: string; icon: string; color: string }[] = [
    { id: 'home', label: 'Home', icon: '◉', color: '#ffffff' },
    { id: 'sleep', label: 'Schlaf', icon: '☾', color: '#00E5FF' },
    { id: 'recovery', label: 'Erholung', icon: '◐', color: '#00E676' },
    { id: 'strain', label: 'Belastung', icon: '◎', color: '#009dff' },
    { id: 'health', label: 'Gesundheit', icon: '♡', color: '#a78bfa' },
    { id: 'connect', label: 'Gerät', icon: '⬡', color: '#64748b' },
  ]

  const zone13Points = woche.map((d, i) => {
    const seg = zoneSegmenteAusTag(d)
    return {
      label: tagLabel(d.date),
      highlight: i === woche.length - 1,
      segments: seg.z13,
    }
  })

  const zone45Points = woche.map((d, i) => {
    const seg = zoneSegmenteAusTag(d)
    return {
      label: tagLabel(d.date),
      highlight: i === woche.length - 1,
      segments: seg.z45,
    }
  })

  return (
    <div className="relative min-h-[calc(100dvh-4rem)] overflow-hidden rounded-3xl border border-white/[0.05] bg-black text-white shadow-2xl shadow-black/80">
      <div
        className="pointer-events-none absolute -left-32 -top-32 h-64 w-64 rounded-full opacity-20 blur-3xl"
        style={{ background: recoveryColor(heute.recoveryPercent) }}
      />
      <div className="pointer-events-none absolute -right-24 top-1/3 h-48 w-48 rounded-full bg-[#00E5FF]/[0.06] blur-3xl" />

      <div
        className={`relative max-h-[calc(100dvh-4rem)] px-4 pb-28 pt-5 sm:px-6 sm:pt-6 ${appModalScrollHiddenClassName}`}
      >
        <header className="flex items-center justify-between gap-2">
          {/* Avatar + Streak */}
          <button
            type="button"
            onClick={() => setTab('connect')}
            className="flex shrink-0 items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.04] px-2 py-1.5 transition hover:bg-white/[0.08]"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-700 text-[11px] font-bold text-white">
              {snapshot?.deviceName?.slice(0, 2).toUpperCase() ?? 'WP'}
            </span>
            {heute.strain != null && (
              <>
                <span className="text-sm">🔥</span>
                <span className="text-[12px] font-bold text-white">{Math.round(heute.strain * 10)}</span>
              </>
            )}
          </button>

          {/* Datum-Navigation */}
          <div className="flex items-center gap-1">
            <span className="text-[11px] text-zinc-600">‹</span>
            <span className="rounded-full border border-white/[0.10] bg-white/[0.04] px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-white">
              Heute
            </span>
            <span className="text-[11px] text-zinc-600">›</span>
          </div>

          {/* Akku + Connect */}
          <button
            type="button"
            onClick={() => void onStatusTap()}
            disabled={statusBusy || isConnecting}
            className={`flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[11px] font-semibold transition active:scale-[0.97] disabled:cursor-default disabled:opacity-70 ${
              isLive
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                : isConnecting
                  ? 'border-amber-500/30 bg-amber-500/10 text-amber-200'
                  : 'border-zinc-700/60 bg-zinc-900/80 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200'
            }`}
          >
            {deviceInfo?.batteryPercent != null && (
              <span className="text-[10px] text-zinc-500">{deviceInfo.batteryPercent}%</span>
            )}
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                isLive || statusBusy ? 'animate-pulse bg-emerald-400' : isConnecting ? 'animate-pulse bg-amber-400' : 'bg-zinc-600'
              }`}
            />
            <span>{statusLabel}</span>
          </button>
        </header>

        <WhoopSyncBanner
          status={model.sync.status}
          message={model.sync.message}
          lastSyncedAt={model.sync.lastSyncedAt}
          historicalCount={model.sync.historicalPacketsTotal}
          onInfo={() => showInfo('sync')}
        />

        {tab === 'home' && (() => {
          const stress = berechneStressScore(heute.recoveryPercent, heute.hrvRmssd, baselines.hrv)
          const vitals = vitalsStatus(heute)
          const tageIso = letzte7TageIso()
          const store = ladeDailyStore()
          const journalDates = new Set(store.journal.map((j) => j.date))
          const vo2Quelle = vo2MaxQuelle() // 'cloud' | 'manuell' | 'berechnet' | null

          return (
            <>
              {/* ── DREI RINGE (Schlaf | Erholung | Belastung) ── */}
              <div className="mt-5 flex items-center justify-around gap-1">
                {/* Schlaf */}
                <button
                  type="button"
                  onClick={() => setTab('sleep')}
                  className="flex flex-col items-center gap-1.5 rounded-2xl px-1 transition active:scale-[0.97]"
                  style={{ filter: heute.sleepScore != null ? 'drop-shadow(0 0 14px #00E5FF40)' : 'none' }}
                >
                  <div className="relative" style={{ width: 108, height: 108 }}>
                    <svg width={108} height={108}>
                      <circle cx={54} cy={54} r={47} fill="none" stroke="rgba(255,255,255,0.10)" strokeWidth={8} />
                      {heute.sleepScore != null && (
                        <circle
                          cx={54} cy={54} r={47} fill="none"
                          stroke="#00E5FF" strokeWidth={8}
                          strokeDasharray={2 * Math.PI * 47}
                          strokeDashoffset={2 * Math.PI * 47 * (1 - Math.min(1, heute.sleepScore / 100))}
                          strokeLinecap="round"
                          transform="rotate(-90 54 54)"
                          style={{ filter: 'drop-shadow(0 0 6px #00E5FF80)' }}
                        />
                      )}
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-[22px] font-bold tabular-nums text-white leading-none">
                        {heute.sleepScore != null ? `${Math.round(heute.sleepScore)}%` : '—'}
                      </span>
                    </div>
                  </div>
                  <span className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-[0.12em] text-[#00E5FF]">
                    SCHLAF <span className="text-zinc-600">›</span>
                  </span>
                </button>

                {/* Erholung */}
                <button
                  type="button"
                  onClick={() => setTab('recovery')}
                  className="flex flex-col items-center gap-1.5 rounded-2xl px-1 transition active:scale-[0.97]"
                  style={{ filter: heute.recoveryPercent != null ? `drop-shadow(0 0 14px ${recoveryColor(heute.recoveryPercent)}40)` : 'none' }}
                >
                  <div className="relative" style={{ width: 108, height: 108 }}>
                    <svg width={108} height={108}>
                      <circle cx={54} cy={54} r={47} fill="none" stroke="rgba(255,255,255,0.10)" strokeWidth={8} />
                      {heute.recoveryPercent != null && (
                        <circle
                          cx={54} cy={54} r={47} fill="none"
                          stroke={recoveryColor(heute.recoveryPercent)} strokeWidth={8}
                          strokeDasharray={2 * Math.PI * 47}
                          strokeDashoffset={2 * Math.PI * 47 * (1 - Math.min(1, heute.recoveryPercent / 100))}
                          strokeLinecap="round"
                          transform="rotate(-90 54 54)"
                          style={{ filter: `drop-shadow(0 0 6px ${recoveryColor(heute.recoveryPercent)}80)` }}
                        />
                      )}
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-[22px] font-bold tabular-nums text-white leading-none">
                        {heute.recoveryPercent != null ? `${Math.round(heute.recoveryPercent)}%` : '—'}
                      </span>
                    </div>
                  </div>
                  <span className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-[0.12em]" style={{ color: recoveryColor(heute.recoveryPercent) }}>
                    ERHOLUNG <span className="text-zinc-600">›</span>
                  </span>
                </button>

                {/* Belastung */}
                <button
                  type="button"
                  onClick={() => setTab('strain')}
                  className="flex flex-col items-center gap-1.5 rounded-2xl px-1 transition active:scale-[0.97]"
                  style={{ filter: heute.strain != null ? 'drop-shadow(0 0 14px #009dff40)' : 'none' }}
                >
                  <div className="relative" style={{ width: 108, height: 108 }}>
                    <svg width={108} height={108}>
                      <circle cx={54} cy={54} r={47} fill="none" stroke="rgba(255,255,255,0.10)" strokeWidth={8} />
                      {heute.strain != null && (
                        <circle
                          cx={54} cy={54} r={47} fill="none"
                          stroke="#009dff" strokeWidth={8}
                          strokeDasharray={2 * Math.PI * 47}
                          strokeDashoffset={2 * Math.PI * 47 * (1 - Math.min(1, heute.strain / 21))}
                          strokeLinecap="round"
                          transform="rotate(-90 54 54)"
                          style={{ filter: 'drop-shadow(0 0 6px #009dff80)' }}
                        />
                      )}
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-[22px] font-bold tabular-nums text-white leading-none">
                        {heute.strain != null ? heute.strain.toFixed(1) : '—'}
                      </span>
                    </div>
                  </div>
                  <span className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-[0.12em] text-[#009dff]">
                    BELASTUNG <span className="text-zinc-600">›</span>
                  </span>
                </button>
              </div>

              <section className="mt-4 space-y-3">
                {/* ── GESUNDHEITS-MONITOR + STRESS-MONITOR ── */}
                <div className="grid grid-cols-2 gap-3">
                  {/* Gesundheits-Monitor */}
                  <button
                    type="button"
                    onClick={() => setTab('health')}
                    className="rounded-2xl border border-white/[0.06] bg-[#111113] p-3.5 text-left transition active:scale-[0.97]"
                  >
                    <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-zinc-400">Gesundheits-Monitor</p>
                    <div className="mt-2 flex items-center gap-2">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-sm" style={{ backgroundColor: vitals.ok > 0 && vitals.allOk ? '#00E67620' : vitals.ok > 0 ? '#FFD60020' : '#3f3f4620' }}>
                        {vitals.ok > 0 && vitals.allOk ? '✓' : vitals.ok > 0 ? '!' : '—'}
                      </span>
                      <div>
                        <p className="text-[11px] font-bold" style={{ color: vitals.ok > 0 && vitals.allOk ? '#00E676' : vitals.ok > 0 ? '#FFD600' : '#52525b' }}>
                          {vitals.ok > 0 && vitals.allOk ? 'NORMAL' : vitals.ok > 0 ? 'PRÜFEN' : 'KEINE DATEN'}
                        </p>
                        <p className="text-[10px] text-zinc-600">{vitals.ok}/{vitals.total} Messwerte</p>
                      </div>
                    </div>
                  </button>

                  {/* Stress-Monitor */}
                  <button
                    type="button"
                    onClick={() => showInfo('hrv')}
                    className="rounded-2xl border border-white/[0.06] bg-[#111113] p-3.5 text-left transition active:scale-[0.97]"
                  >
                    <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-zinc-400">Stress-Monitor</p>
                    <div className="mt-2">
                      <p className="text-[22px] font-bold tabular-nums leading-none" style={{ color: stressColor(stress) }}>
                        {stress != null ? stress.toFixed(1).replace('.', ',') : '—'}
                      </p>
                      <p className="mt-0.5 text-[10px] font-bold" style={{ color: stressColor(stress) }}>
                        {stressLabel(stress)}
                      </p>
                    </div>
                  </button>
                </div>

                {/* ── LIVE HR (kompakt) ── */}
                {(model.liveHr != null || (snapshot?.hrHistory ?? []).length > 0) && (
                  <div className="rounded-2xl border border-white/[0.06] bg-[#111113] p-4">
                    <div className="flex items-baseline gap-3">
                      <span className="text-3xl font-bold tabular-nums text-white">{model.liveHr ?? '—'}</span>
                      <span className="text-sm text-zinc-500">bpm live</span>
                      {model.hrZone > 0 && (
                        <span className="ml-auto rounded-full bg-[#009dff]/20 px-2 py-0.5 text-[10px] font-bold text-[#009dff]">
                          Zone {model.hrZone}
                        </span>
                      )}
                    </div>
                    <WhoopHrChart points={snapshot?.hrHistory ?? []} live={isLive} />
                  </div>
                )}

                {/* ── MEIN TAG ── */}
                <div>
                  <div className="flex items-center justify-between">
                    <h2 className="text-base font-bold text-white">Mein Tag</h2>
                    <button
                      type="button"
                      onClick={() => setTab('strain')}
                      className="flex h-8 w-8 items-center justify-center rounded-full border border-white/[0.10] bg-white/[0.05] text-lg font-light text-white transition hover:bg-white/10"
                    >
                      +
                    </button>
                  </div>

                  {/* Täglicher Ausblick / Coach */}
                  {model.insightRecovery || model.insightStrain || model.coachSchlaf ? (
                    <button
                      type="button"
                      onClick={() => setCoachExpanded(!coachExpanded)}
                      className="mt-2 flex w-full items-center gap-3 rounded-2xl border border-white/[0.06] bg-[#111113] px-4 py-3 text-left transition hover:bg-white/[0.03]"
                    >
                      <span className="text-lg">☀</span>
                      <span className="flex-1 text-[12px] text-zinc-300">Dein täglicher Ausblick</span>
                      <span className="text-zinc-600">›</span>
                    </button>
                  ) : null}

                  {/* Schlaf als Aktivität — wie in der echten WHOOP-App */}
                  {heute.sleepMinutes != null && heute.sleepMinutes > 0 && (
                    <button
                      type="button"
                      onClick={() => setTab('sleep')}
                      className="mt-2 flex w-full items-center gap-3 rounded-2xl border border-[#00E5FF]/20 bg-[#00E5FF]/[0.04] px-3.5 py-3 text-left transition active:scale-[0.98] hover:bg-[#00E5FF]/[0.07]"
                    >
                      {/* Schlaf-Icon mit Score-Ring */}
                      <span className="relative flex h-12 w-12 shrink-0 items-center justify-center">
                        <svg viewBox="0 0 48 48" className="absolute inset-0 h-full w-full -rotate-90">
                          <circle cx="24" cy="24" r="20" fill="none" stroke="#00E5FF20" strokeWidth="3.5" />
                          <circle
                            cx="24" cy="24" r="20" fill="none"
                            stroke="#00E5FF"
                            strokeWidth="3.5"
                            strokeLinecap="round"
                            strokeDasharray={`${2 * Math.PI * 20}`}
                            strokeDashoffset={`${2 * Math.PI * 20 * (1 - (heute.sleepScore ?? 0) / 100)}`}
                          />
                        </svg>
                        <span className="text-lg">🌙</span>
                      </span>
                      <span className="flex-1">
                        <span className="block text-[12px] font-bold uppercase text-white">Schlaf</span>
                        <span className="text-[10px] text-zinc-400">
                          {Math.floor(heute.sleepMinutes / 60)}h {heute.sleepMinutes % 60}m
                          {heute.wakeTimeMs != null && heute.bedTimeMs != null && (
                            <> · {new Date(heute.bedTimeMs).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} – {new Date(heute.wakeTimeMs).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</>
                          )}
                        </span>
                      </span>
                      <div className="text-right">
                        {heute.sleepScore != null && (
                          <span className="block text-[18px] font-bold tabular-nums text-[#00E5FF]">
                            {Math.round(heute.sleepScore)}%
                          </span>
                        )}
                        <span className="text-[10px] text-zinc-600">Schlafleistung</span>
                      </div>
                      <span className="text-zinc-600">›</span>
                    </button>
                  )}

                  {/* Heutige Aktivitäten */}
                  {aktivitaeten.length > 0 && (
                    <div className="mt-2 rounded-2xl border border-white/[0.06] bg-[#111113] p-3.5">
                      <div className="flex items-center justify-between">
                        <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-zinc-500">Heutige Aktivitäten</p>
                        <button type="button" onClick={() => setTab('strain')} className="text-[10px] text-zinc-600">↗</button>
                      </div>
                      <ul className="mt-2 space-y-2">
                        {aktivitaeten.slice(0, 3).map((a) => (
                          <li key={a.id}>
                            <button
                              type="button"
                              onClick={() => setSelectedActivity(a)}
                              className="flex w-full items-center gap-3 rounded-xl bg-[#009dff]/10 px-3 py-2.5 text-left transition active:scale-[0.98]"
                            >
                              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#009dff]/20 text-[13px] font-bold text-[#009dff]">
                                {a.strain.toFixed(1)}
                              </span>
                              <span className="flex-1">
                                <span className="block text-[12px] font-bold uppercase text-white">{a.label}</span>
                                <span className="text-[10px] text-zinc-500">
                                  {formatUhrzeit(a.startMs)} – {formatUhrzeit(a.endMs)}
                                </span>
                              </span>
                              <span className="text-zinc-600">›</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                      <div className="mt-2 flex gap-2">
                        <button
                          type="button"
                          onClick={() => setTab('strain')}
                          className="flex-1 rounded-xl border border-white/[0.08] py-2 text-[11px] font-semibold text-zinc-300 hover:bg-white/[0.04]"
                        >
                          + Hinzufügen
                        </button>
                        <button
                          type="button"
                          onClick={() => setTab('strain')}
                          className="flex-1 rounded-xl border border-white/[0.08] py-2 text-[11px] font-semibold text-zinc-300 hover:bg-white/[0.04]"
                        >
                          ⏱ Aktivität starten
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* ── SCHLAF HEUTE NACHT ── */}
                {(heute.sleepNeedMinutes != null || heute.wakeTimeMs != null) && (
                  <div className="rounded-2xl border border-white/[0.06] bg-[#111113] p-4">
                    <div className="flex items-center justify-between">
                      <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-zinc-500">Schlaf für heute Nacht</p>
                      <span className="text-zinc-600">›</span>
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <div>
                        <p className="text-[22px] font-bold tabular-nums text-white leading-none">
                          {empfohleneSchlafzeit(heute.sleepNeedMinutes, heute.wakeTimeMs) ?? formatSchlafbedarf(heute.sleepNeedMinutes)}
                        </p>
                        <p className="mt-0.5 text-[10px] text-zinc-500">
                          Empfohlene Schlafenszeit
                        </p>
                      </div>
                      {heute.wakeTimeMs != null && (
                        <div className="text-right">
                          <p className="text-[17px] font-bold tabular-nums text-zinc-300">{formatUhrzeitShort(heute.wakeTimeMs)}</p>
                          <p className="text-[10px] text-zinc-600">Letztes Aufwachen</p>
                        </div>
                      )}
                    </div>
                    <div className="mt-3 w-full rounded-xl border border-white/[0.08] py-2.5 text-center text-[11px] font-semibold text-zinc-400">
                      Schlafbedarf: {formatSchlafbedarf(heute.sleepNeedMinutes)} Std.
                    </div>
                  </div>
                )}

                {/* ── MEIN LOGBUCH ── */}
                <div className="rounded-2xl border border-white/[0.06] bg-[#111113] p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-zinc-500">Mein Logbuch</p>
                    <span className="text-zinc-600">›</span>
                  </div>
                  <div className="mt-3 flex justify-between">
                    {tageIso.map((iso) => {
                      const hatEintrag = journalDates.has(iso)
                      const istHeute = iso === tageIso[tageIso.length - 1]
                      return (
                        <div key={iso} className="flex flex-col items-center gap-1.5">
                          <span className="text-[9px] font-bold text-zinc-600">
                            {wochentagKurzDe(iso)}
                          </span>
                          <div
                            className="flex h-7 w-7 items-center justify-center rounded-full border-2 text-sm"
                            style={{
                              borderColor: hatEintrag ? '#00E676' : istHeute ? '#ffffff30' : '#27272a',
                              backgroundColor: hatEintrag ? '#00E676' : 'transparent',
                            }}
                          >
                            {hatEintrag && <span className="text-black font-bold text-[11px]">✓</span>}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  <button
                    type="button"
                    onClick={() => showInfo('behavior')}
                    className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-white/[0.08] py-2.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-400 hover:bg-white/[0.03]"
                  >
                    ☀ Verhaltenseinblicke
                  </button>
                </div>

                {/* ── MEIN DASHBOARD (vertikale Liste) ── */}
                <div>
                  <div className="flex items-center justify-between py-1">
                    <h2 className="text-base font-bold text-white">Mein Dashboard</h2>
                    <span className="text-[10px] text-zinc-500">PERSONALISIEREN ✏</span>
                  </div>
                  <div className="rounded-2xl border border-white/[0.06] bg-[#111113] px-4">
                    {[
                      ...HOME_METRICS.map((m) => {
                        const val = heuteWert(m.id, heute)
                        const base = baselineFuerMetrik(m.id)
                        const invertiert = m.id === 'rhr' || m.id === 'respiratory'
                        const diff = val != null && base != null && base > 0 ? (val - base) / base : null
                        const dir = diff == null ? null : Math.abs(diff) < 0.03 ? 'neutral' : diff > 0 ? 'up' : 'down'
                        const good = dir == null || dir === 'neutral' ? null : invertiert ? dir === 'down' : dir === 'up'
                        const arrowColor = good == null ? '#3f3f46' : good ? '#00E676' : '#FF1744'
                        const arrow = dir === 'up' ? '▲' : dir === 'down' ? '▼' : '●'
                        const isVo2 = m.id === 'vo2max'
                        // VO2max-Badge: nur bei Manuell-Override zeigen; bei Cloud = kein Badge
                        const vo2Badge = isVo2
                          ? vo2Quelle === 'manuell'
                            ? 'manuell'
                            : vo2Quelle === null || val == null
                              ? '→ Cloud Sync'
                              : null
                          : null
                        return {
                          id: m.id,
                          label: m.label.toUpperCase(),
                          val,
                          base,
                          unit: m.unit,
                          decimals: m.decimals ?? 0,
                          arrow,
                          arrowColor,
                          onClick: () => setTrendMetric(m.id),
                          badge: vo2Badge,
                        }
                      }),
                      // Tagesbelastung
                      (() => {
                        const val = heute.strain
                        const base = baselines.strain
                        const diff = val != null && base != null && base > 0 ? (val - base) / base : null
                        const dir = diff == null ? null : Math.abs(diff) < 0.03 ? 'neutral' : diff > 0 ? 'up' : 'down'
                        const good = dir == null || dir === 'neutral' ? null : dir === 'up'
                        return {
                          id: 'strain',
                          label: 'TAGESBELASTUNG',
                          val,
                          base,
                          unit: '',
                          decimals: 1,
                          arrow: dir === 'up' ? '▲' : dir === 'down' ? '▼' : '●',
                          arrowColor: good == null ? '#3f3f46' : good ? '#009dff' : '#FF1744',
                          onClick: () => setTab('strain'),
                          badge: null,
                        }
                      })(),
                    ].map((row, idx, arr) => (
                      <button
                        key={row.id}
                        type="button"
                        onClick={row.onClick}
                        className={`flex w-full items-center gap-3 py-3.5 text-left transition hover:bg-white/[0.02] ${idx < arr.length - 1 ? 'border-b border-white/[0.06]' : ''}`}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-[9px] font-bold uppercase tracking-wide text-zinc-500">{row.label}</p>
                        </div>
                        <div className="shrink-0 text-right">
                          <div className="flex items-baseline gap-1.5">
                            <span className="text-[22px] font-bold tabular-nums text-white leading-none">
                              {row.val != null
                                ? row.decimals > 0
                                  ? row.val.toFixed(row.decimals).replace('.', ',')
                                  : formatMetricWert(row.id as HomeMetricId, row.val)
                                : '—'}
                            </span>
                            {row.unit && row.val != null && (
                              <span className="text-[10px] text-zinc-600">{row.unit}</span>
                            )}
                            <span className="text-[11px] font-bold" style={{ color: row.arrowColor }}>{row.arrow}</span>
                          </div>
                          {row.base != null ? (
                            <p className="text-[10px] tabular-nums text-zinc-600">
                              {row.decimals > 0
                                ? row.base.toFixed(row.decimals).replace('.', ',')
                                : formatMetricWert(row.id as HomeMetricId, row.base)}
                              {row.unit ? ` ${row.unit}` : ''}
                            </p>
                          ) : row.badge === '→ Cloud Sync' ? (
                            <p className="text-[9px] text-sky-500/80">{row.badge}</p>
                          ) : row.badge ? (
                            <p className="text-[9px] text-zinc-500">{row.badge}</p>
                          ) : null}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {model.insightRecovery ? <WhoopInsightCard text={model.insightRecovery} /> : null}
              </section>
            </>
          )
        })()}

        {tab === 'sleep' && (
          <section className="mt-6 space-y-4">
            <button type="button" onClick={() => showInfo('sleep_score')} className="w-full">
              <WhoopBigRing
                value={heute.sleepScore}
                label="Schlafleistung"
                sublabel={
                  heute.sleepMinutes ? `${Math.floor(heute.sleepMinutes / 60)}h ${heute.sleepMinutes % 60}m` : undefined
                }
                color="#00E5FF"
              />
            </button>

            <WhoopDualLineChart
              title="Stunden vs. Bedarf (Stunden)"
              labelA="Geschlafene Stunden"
              labelB="Schlafbedarf"
              seriesA={woche.map((d, i) => ({
                label: tagLabel(d.date),
                value: d.sleepMinutes ?? 0,
                highlight: i === woche.length - 1,
              }))}
              seriesB={woche.map((d, i) => ({
                label: tagLabel(d.date),
                value: d.sleepNeedMinutes ?? 480,
                highlight: i === woche.length - 1,
              }))}
              formatValue={(v) => formatStundenMin(v)}
              onInfo={() => showInfo('sleep_hours')}
            />

            <WhoopWeeklyBarChart
              title="Stunden vs. Bedarf (%)"
              points={woche.map((d, i) => ({
                label: tagLabel(d.date),
                value:
                  d.sleepMinutes != null && d.sleepNeedMinutes
                    ? Math.round((d.sleepMinutes / d.sleepNeedMinutes) * 100)
                    : d.sleepScore ?? 0,
                highlight: i === woche.length - 1,
              }))}
              max={100}
              formatValue={(v) => `${v}%`}
              onInfo={() => showInfo('sleep_need')}
            />

            <WhoopRestorativeChart
              title="Erholsamer Schlaf (Stunden)"
              points={woche.map((d, i) => ({
                label: tagLabel(d.date),
                remMin: d.remMinutes ?? 0,
                deepMin: d.deepMinutes ?? 0,
                highlight: i === woche.length - 1,
              }))}
              onInfo={() => showInfo('restorative_sleep')}
            />

            <WhoopWeeklyBarChart
              title="Schlafregelmäßigkeit"
              points={wochePunkte(woche, 'sleepConsistency')}
              max={100}
              formatValue={(v) => `${v}%`}
              onInfo={() => showInfo('sleep_consistency')}
            />

            <WhoopTimeInBedChart
              title="Zeit im Bett"
              points={woche.map((d, i) => ({
                label: tagLabel(d.date),
                bedMs: d.bedTimeMs,
                wakeMs: d.wakeTimeMs,
                highlight: i === woche.length - 1,
              }))}
              onInfo={() => showInfo('time_in_bed')}
            />

            <WhoopWeeklyLineChart
              title="Schlafeffizienz"
              points={wochePunkte(woche, 'sleepEfficiency')}
              onInfo={() => showInfo('sleep_efficiency')}
            />

            <WhoopWeeklyBarChart
              title="Schlafdefizit"
              points={schlafdefizit.map((s, i) => ({
                label: s.label,
                value: s.defizitMin,
                highlight: i === schlafdefizit.length - 1,
              }))}
              formatValue={(v) => formatMinuten(v)}
              color="#5eb3d6"
              onInfo={() => showInfo('sleep_debt')}
            />

            <WhoopStackedZoneChart
              title="Schlafstress"
              zones={[
                { key: 'high', label: 'Hoch', color: '#f39c12' },
                { key: 'med', label: 'Mittel', color: '#2ecc71' },
                { key: 'low', label: 'Niedrig', color: '#5eb3d6' },
              ]}
              points={woche.map((d, i) => ({
                label: tagLabel(d.date),
                highlight: i === woche.length - 1,
                segments: schlafstressSegmente(d),
              }))}
              onInfo={() => showInfo('sleep_stress')}
            />

            <WhoopWeeklyBarChart
              title="Schlafleistung"
              points={wochePunkte(woche, 'sleepScore')}
              max={100}
              formatValue={(v) => `${v}%`}
              color="#00E5FF"
              onInfo={() => showInfo('sleep_score')}
            />

            {model.insightSchlaf ? <WhoopInsightCard text={model.insightSchlaf} /> : null}
          </section>
        )}

        {tab === 'recovery' && (
          <section className="mt-4 space-y-4">
            <WhoopBigRing
              value={heute.recoveryPercent}
              label="Erholung"
              color={recoveryColor(heute.recoveryPercent)}
            />

            <div className="rounded-2xl border border-white/[0.06] bg-[#111113] px-4">
              <WhoopMetricRow icon="〰" label="Herzfrequenzvariabilität" m={metriken.hrv} unit="ms" onPress={() => setTrendMetric('hrv')} onInfo={() => showInfo('hrv')} />
              <WhoopMetricRow icon="♥" label="Ruheherzfrequenz" m={metriken.rhr} onPress={() => setTrendMetric('rhr')} onInfo={() => showInfo('rhr')} />
              <WhoopMetricRow icon="◎" label="Atemfrequenz" m={metriken.respiratory} decimals={1} onPress={() => setTrendMetric('respiratory')} onInfo={() => showInfo('respiratory')} />
              <WhoopMetricRow icon="☾" label="Schlafleistung" m={metriken.sleepPerformance} unit="%" onInfo={() => showInfo('sleep_performance')} />
              <p className="border-t border-white/[0.06] py-2 text-[9px] text-zinc-600">
                ▲ ▼ Heute im Vergleich zu den letzten 30 Tagen
              </p>
            </div>

            {model.insightRecovery ? (
              <WhoopInsightCard text={model.insightRecovery} link="Erkunde deine Erholungsdaten" />
            ) : null}

            <WhoopWeeklyBarChart
              title="Erholung"
              points={wochePunkte(woche, 'recoveryPercent')}
              max={100}
              formatValue={(v) => `${v}%`}
              color={recoveryColor(heute.recoveryPercent ?? 50)}
              onInfo={() => showInfo('recovery')}
            />

            <WhoopWeeklyLineChart title="Herzfrequenzvariabilität" points={wochePunkte(woche, 'hrvRmssd')} onInfo={() => showInfo('hrv')} />
            <WhoopWeeklyLineChart title="Ruheherzfrequenz" points={wochePunkte(woche, 'restingHr')} color="#a78bfa" onInfo={() => showInfo('rhr')} />
            <WhoopWeeklyLineChart
              title="Atemfrequenz"
              points={wochePunkte(woche, 'respiratoryRate')}
              color="#5eb3d6"
              onInfo={() => showInfo('respiratory')}
            />
            <WhoopWeeklyBarChart
              title="Schlafleistung"
              points={wochePunkte(woche, 'sleepScore')}
              max={100}
              formatValue={(v) => `${v}%`}
              color="#00E5FF"
              onInfo={() => showInfo('sleep_score')}
            />
          </section>
        )}

        {tab === 'strain' && (
          <section className="mt-4 space-y-4">
            <WhoopBigRing value={heute.strain} max={21} label="Belastung" color="#009dff" />

            <div className="rounded-2xl border border-white/[0.06] bg-[#111113] px-4">
              <WhoopMetricRow
                icon="♥"
                label="Herzfrequenzzonen 1–3"
                m={{
                  heute: heute.zoneMin13,
                  baseline30: baseline30('zoneMin13'),
                  trend: trendMetricRow(heute.zoneMin13, baseline30('zoneMin13')),
                }}
                unit="min"
                onPress={() => setTrendMetric('avg_hr')}
                onInfo={() => showInfo('zones_13')}
              />
              <WhoopMetricRow
                icon="♥"
                label="Herzfrequenzzonen 4–5"
                m={{
                  heute: heute.zoneMin45,
                  baseline30: baseline30('zoneMin45'),
                  trend: trendMetricRow(heute.zoneMin45, baseline30('zoneMin45')),
                }}
                unit="min"
                onInfo={() => showInfo('zones_45')}
              />
              <WhoopMetricRow
                icon="🏋"
                label="Kraftaktivitätszeit"
                m={{ heute: heute.strengthMin, baseline30: null, trend: 'neutral' }}
                unit="min"
                onInfo={() => showInfo('strength')}
              />
              <WhoopMetricRow
                icon="👟"
                label="Schritte"
                m={{
                  heute: heute.steps,
                  baseline30: baselineFuerMetrik('steps'),
                  trend: trendSteps(heute.steps, baselineFuerMetrik('steps')),
                }}
                onPress={() => setTrendMetric('steps')}
                onInfo={() => showInfo('steps')}
              />
              <WhoopMetricRow
                icon="🔥"
                label="Kalorien"
                m={{
                  heute: heute.calories,
                  baseline30: baselineFuerMetrik('calories'),
                  trend: trendSteps(heute.calories, baselineFuerMetrik('calories')),
                }}
                unit="kcal"
                onPress={() => setTrendMetric('calories')}
                onInfo={() => showInfo('calories')}
              />
              <p className="border-t border-white/[0.06] py-2 text-[9px] text-zinc-600">
                ▲ ▼ Heute im Vergleich zu den letzten 30 Tagen · Schritte geschätzt
              </p>
            </div>

            {model.insightStrain ? (
              <WhoopInsightCard text={model.insightStrain} link="Erkunde deine Belastungsdaten" />
            ) : null}

            {aktivitaeten.length > 0 ? (
              <div className="rounded-2xl border border-white/[0.06] bg-[#111113] p-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-zinc-300">Aktivitäten heute</p>
                <ul className="mt-3 space-y-2">
                  {aktivitaeten.map((a) => (
                    <li key={a.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedActivity(a)}
                        className="flex w-full items-center gap-3 rounded-xl border border-white/[0.04] bg-black/30 px-3 py-2.5 text-left transition hover:border-[#009dff]/25"
                      >
                        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#009dff]/20 text-sm font-bold text-[#009dff]">
                          {a.strain.toFixed(1)}
                        </span>
                        <span className="flex-1 text-xs font-bold uppercase tracking-wide">{a.label}</span>
                        <span className="text-[11px] tabular-nums text-zinc-500">
                          {formatUhrzeit(a.startMs)} – {formatUhrzeit(a.endMs)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {aktivitaetenHistorie.filter((a) => !aktivitaeten.some((t) => t.id === a.id)).length > 0 ? (
              <div className="rounded-2xl border border-white/[0.06] bg-[#111113] p-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-zinc-300">Vorangegangene Aktivitäten</p>
                <ul className="mt-3 space-y-2">
                  {aktivitaetenHistorie
                    .filter((a) => !aktivitaeten.some((t) => t.id === a.id))
                    .slice(0, 10)
                    .map((a) => (
                      <li key={`hist-${a.id}`}>
                        <button
                          type="button"
                          onClick={() => setSelectedActivity(a)}
                          className="flex w-full items-center gap-3 rounded-xl border border-white/[0.04] bg-black/30 px-3 py-2.5 text-left transition hover:border-[#009dff]/25"
                        >
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-800 text-xs font-bold text-zinc-300">
                            {a.strain.toFixed(1)}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-xs font-bold uppercase">{a.label}</span>
                            <span className="text-[10px] text-zinc-500">
                              {new Date(a.startMs).toLocaleDateString('de-DE', {
                                day: 'numeric',
                                month: 'short',
                              })}{' '}
                              · {formatUhrzeit(a.startMs)}
                            </span>
                          </span>
                          <span className="text-zinc-600">›</span>
                        </button>
                      </li>
                    ))}
                </ul>
              </div>
            ) : null}

            <WhoopWeeklyBarChart
              title="Belastung"
              points={wochePunkte(woche, 'strain')}
              max={21}
              formatValue={(v) => v.toFixed(1)}
              onInfo={() => showInfo('strain')}
            />
            <WhoopStackedZoneChart title="HF-Zonen 1–3" zones={WHOOP_ZONE_13} points={zone13Points} onInfo={() => showInfo('zones_13')} />
            <WhoopStackedZoneChart title="HF-Zonen 4–5" zones={WHOOP_ZONE_45} points={zone45Points} onInfo={() => showInfo('zones_45')} />
            <WhoopWeeklyBarChart
              title="Schritte"
              points={wochePunkte(woche, 'steps')}
              formatValue={(v) => v.toLocaleString('de-DE')}
              onInfo={() => showInfo('steps')}
            />
            <WhoopWeeklyBarChart
              title="Kalorien"
              points={wochePunkte(woche, 'calories')}
              formatValue={(v) => v.toLocaleString('de-DE')}
              onInfo={() => showInfo('calories')}
            />
            <WhoopWeeklyBarChart
              title="Kraftaktivitätszeit"
              points={wochePunkte(woche, 'strengthMin')}
              formatValue={(v) => formatMinuten(v)}
              onInfo={() => showInfo('strength')}
            />

            {zoneAnteil.length > 0 ? (
              <div className="rounded-2xl border border-white/[0.06] bg-[#111113] p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-500">Zonen heute</p>
                <ul className="mt-3 space-y-2">
                  {zoneAnteil.map(({ key, pct }) => (
                    <li key={key}>
                      <div className="mb-1 flex justify-between text-xs">
                        <span style={{ color: HR_ZONE_COLORS[key] }}>{HR_ZONE_LABELS[key]}</span>
                        <span className="text-zinc-500">{pct}%</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-zinc-900">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${pct}%`, backgroundColor: HR_ZONE_COLORS[key] }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>
        )}

        {tab === 'health' && (
          <section className="mt-6 space-y-4">
            <p className="text-center text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Gesundheit</p>

            <WhoopAgeOrb
              whoopAge={model.healthspan.whoopAge}
              yearsYounger={model.healthspan.yearsYounger}
              agingProcess={model.healthspan.agingProcess}
              onInfo={() => showInfo('healthspan')}
            />

            <WhoopAgingScale
              value={model.healthspan.agingProcess}
              trend={model.healthspan.agingTrend}
              onInfo={() => showInfo('aging_process')}
            />

            <div className="rounded-2xl border border-white/[0.06] bg-[#111113] px-4">
              <p className="border-b border-white/[0.06] py-3 text-[11px] font-bold uppercase tracking-[0.14em] text-zinc-300">
                Schlaf
              </p>
              {model.healthspan.metrics
                .filter((m) => m.id === 'sleep_consistency' || m.id === 'sleep_hours')
                .map((m) => (
                  <WhoopHealthspanBar
                    key={m.id}
                    metric={m}
                    expanded={expandedHealthMetric === m.id}
                    onToggle={() => setExpandedHealthMetric(expandedHealthMetric === m.id ? null : m.id)}
                    onInfo={() => showInfo(m.id === 'sleep_consistency' ? 'sleep_consistency' : 'sleep_hours')}
                  />
                ))}
            </div>

            <div className="rounded-2xl border border-white/[0.06] bg-[#111113] px-4">
              <p className="border-b border-white/[0.06] py-3 text-[11px] font-bold uppercase tracking-[0.14em] text-zinc-300">
                Belastung
              </p>
              {model.healthspan.metrics
                .filter((m) => m.id.startsWith('zones_') || m.id === 'strength')
                .map((m) => (
                  <WhoopHealthspanBar
                    key={m.id}
                    metric={m}
                    expanded={expandedHealthMetric === m.id}
                    onToggle={() => setExpandedHealthMetric(expandedHealthMetric === m.id ? null : m.id)}
                    onInfo={() =>
                      showInfo(
                        m.id === 'zones_13_weekly'
                          ? 'zones_13'
                          : m.id === 'zones_45_weekly'
                            ? 'zones_45'
                            : 'strength',
                      )
                    }
                  />
                ))}
            </div>

            <div className="rounded-2xl border border-white/[0.06] bg-[#111113] px-4">
              <p className="border-b border-white/[0.06] py-3 text-[11px] font-bold uppercase tracking-[0.14em] text-zinc-300">
                Fitness
              </p>
              {model.healthspan.metrics
                .filter((m) => m.id === 'steps' || m.id === 'vo2max' || m.id === 'rhr')
                .map((m) => (
                  <WhoopHealthspanBar
                    key={m.id}
                    metric={m}
                    expanded={expandedHealthMetric === m.id}
                    onToggle={() => setExpandedHealthMetric(expandedHealthMetric === m.id ? null : m.id)}
                    onInfo={() =>
                      showInfo(m.id === 'vo2max' ? 'vo2max' : m.id === 'rhr' ? 'rhr' : 'steps')
                    }
                  />
                ))}
            </div>

            <WhoopAgeTrendChart model={model.healthspan} />
            <WhoopAgingTrendChart model={model.healthspan} />

            <WhoopLiveHrMonitor
              bpm={model.liveHr}
              zone={model.hrZone}
              history={snapshot?.hrHistory ?? []}
              onInfo={() => showInfo('health_monitor')}
            />

            <div className="rounded-2xl border border-white/[0.06] bg-[#111113] p-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-zinc-300">Gesundheitsmonitor</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <WhoopHealthTile
                  icon="◎"
                  label="Atemfrequenz"
                  value={
                    heute.respiratoryRate != null ? heute.respiratoryRate.toFixed(1).replace('.', ',') : '—'
                  }
                  unit="AZ/min"
                  status={
                    heute.respiratoryRate != null && heute.respiratoryRate > 15.6 ? '! erhöht > 15,6' : undefined
                  }
                  statusTone={heute.respiratoryRate != null && heute.respiratoryRate > 15.6 ? 'warn' : 'ok'}
                />
                <WhoopHealthTile
                  icon="🩺"
                  label="Blutdruck"
                  value={
                    heute.bpSystolic != null && heute.bpDiastolic != null
                      ? `${heute.bpSystolic}/${heute.bpDiastolic}`
                      : '—'
                  }
                  unit="mmHg"
                  status={heute.bpSystolic == null ? 'Nicht in WHOOP-API — Tab Gerät' : '✓ erfasst'}
                  statusTone={heute.bpSystolic != null ? 'ok' : 'warn'}
                />
                <WhoopHealthTile
                  icon="💧"
                  label="SpO₂"
                  value={
                    heute.spo2Percent != null ? heute.spo2Percent.toFixed(1).replace('.', ',') : '—'
                  }
                  unit="%"
                  status={
                    heute.spo2Percent != null
                      ? heute.spo2Percent < 95
                        ? '! unter 95 %'
                        : '✓ automatisch'
                      : 'WHOOP Cloud (auto)'
                  }
                  statusTone={
                    heute.spo2Percent != null ? (heute.spo2Percent < 95 ? 'bad' : 'ok') : 'warn'
                  }
                />
                <WhoopHealthTile
                  icon="♥"
                  label="RHF"
                  value={heute.restingHr != null ? String(heute.restingHr) : '—'}
                  unit="S/min"
                  status={heute.restingHr != null && heute.restingHr > 58 ? '! stark erhöht > 58' : undefined}
                  statusTone={heute.restingHr != null && heute.restingHr > 58 ? 'bad' : 'ok'}
                />
                <WhoopHealthTile
                  icon="〰"
                  label="HFV"
                  value={heute.hrvRmssd != null ? String(Math.round(heute.hrvRmssd)) : '—'}
                  unit="ms"
                  status={heute.hrvRmssd != null && heute.hrvRmssd < 85 ? '! sehr niedrig < 85' : undefined}
                  statusTone={heute.hrvRmssd != null && heute.hrvRmssd < 85 ? 'bad' : 'ok'}
                />
                <WhoopHealthTile
                  icon="🌡"
                  label="Hauttemp."
                  value={
                    heute.skinTempDelta != null
                      ? `${heute.skinTempDelta >= 0 ? '+' : ''}${heute.skinTempDelta.toFixed(1).replace('.', ',')}`
                      : '—'
                  }
                  unit="°C Δ"
                  status={
                    heute.skinTempDelta != null &&
                    heute.skinTempDelta >= -0.4 &&
                    heute.skinTempDelta <= 0.5
                      ? '✓ in der Nähe von -0,4 bis +0,5'
                      : heute.skinTempC != null || heute.skinTempDelta != null
                        ? '! außerhalb Bereich'
                        : 'Cloud / BLE (auto)'
                  }
                  statusTone={
                    heute.skinTempDelta != null &&
                    heute.skinTempDelta >= -0.4 &&
                    heute.skinTempDelta <= 0.5
                      ? 'ok'
                      : 'warn'
                  }
                />
              </div>
            </div>

            {journal.length > 0 ? (
              <div className="rounded-2xl border border-white/[0.06] bg-[#111113] p-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-zinc-300">Journal heute</p>
                <ul className="mt-3 space-y-2">
                  {journal.slice(0, 8).map((j) => (
                    <li key={`${j.question}-${j.answer}`} className="text-xs text-zinc-400">
                      <span className="text-zinc-300">{j.question.replace(/\([^)]*\)/g, '').trim()}</span>
                      <span className="ml-2 font-semibold text-zinc-200">{j.answer}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <button
              type="button"
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/[0.08] bg-[#111113] py-3.5 text-[11px] font-bold uppercase tracking-wider text-zinc-300"
              onClick={() => {
                const text = [
                  'Omnia Gesundheitsbericht',
                  `Omnia Age: ${model.healthspan.whoopAge ?? '—'}`,
                  `HFV: ${heute.hrvRmssd ?? '—'} ms`,
                  `RHF: ${heute.restingHr ?? '—'} bpm`,
                  `Recovery: ${heute.recoveryPercent ?? '—'} %`,
                ].join('\n')
                void navigator.clipboard?.writeText(text)
              }}
            >
              ↗ Teile deinen Gesundheitsbericht
            </button>

            {snapshot?.gen5 ? (
              <div className="rounded-2xl border border-white/[0.06] bg-[#111113] p-4 font-mono text-[11px] text-zinc-500">
                <p className="font-sans text-[10px] font-bold uppercase text-zinc-400">Gen5 fd4b</p>
                <p className="mt-1">Phase: {snapshot.gen5.phase}</p>
                <p>r22: {snapshot.gen5.r22Count} · Historie: {snapshot.gen5.historyPackets}</p>
              </div>
            ) : null}
          </section>
        )}

        {tab === 'connect' && (
          <section className="mt-6 space-y-4">
            <FitnessUserProfilePanel embedded onSaved={() => setDataRevision((r) => r + 1)} />
            <FitnessWhoopCloudPanel embedded onSyncComplete={() => setDataRevision((r) => r + 1)} />
            <FitnessVitalsPanel embedded onSaved={() => setDataRevision((r) => r + 1)} />
            <FitnessWhoopBlePanel embedded />
            <FitnessWhoopImportPanel embedded onImportComplete={() => setDataRevision((r) => r + 1)} />
          </section>
        )}
      </div>

      <nav className="absolute bottom-0 left-0 right-0 border-t border-white/[0.06] bg-black/95 px-1 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1 backdrop-blur-xl">
        <ul className="flex justify-around">
          {tabs.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => setTab(t.id)}
                className="relative flex flex-col items-center gap-0.5 rounded-xl px-2 py-2 text-[9px] font-semibold transition sm:px-3 sm:text-[10px]"
                style={{ color: tab === t.id ? t.color : '#52525b' }}
              >
                {tab === t.id && (
                  <span
                    className="absolute -top-px left-1/2 h-[2px] w-6 -translate-x-1/2 rounded-full"
                    style={{ backgroundColor: t.color, boxShadow: `0 0 8px 1px ${t.color}80` }}
                  />
                )}
                <span className="text-base leading-none">{t.icon}</span>
                {t.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <WhoopInfoModal info={info} onClose={() => setInfo(null)} />
      <WhoopMetricTrendModal metricId={trendMetric} heute={heute} onClose={() => setTrendMetric(null)} />
      <WhoopActivityModal activity={selectedActivity} onClose={() => setSelectedActivity(null)} />

      {model.coachSchlaf && (tab === 'sleep' || tab === 'recovery') ? (
        <WhoopCoachBar
          text={coachExpanded ? model.coachSchlaf : `${model.coachSchlaf.slice(0, 72)}…`}
          onExpand={() => {
            if (coachExpanded) showInfo('sleep_score')
            else setCoachExpanded(true)
          }}
        />
      ) : null}
    </div>
  )
}

function trendMetricRow(heute: number | null, base: number | null): 'up' | 'down' | 'neutral' {
  if (heute == null || base == null || base <= 0) return 'neutral'
  if (heute > base * 1.05) return 'up'
  if (heute < base * 0.95) return 'down'
  return 'neutral'
}

function trendSteps(heute: number | null, base: number | null): 'up' | 'down' | 'neutral' {
  if (heute == null || base == null) return 'neutral'
  if (heute > base * 1.05) return 'up'
  if (heute < base * 0.95) return 'down'
  return 'neutral'
}

function berechneStressScore(rec: number | null, hrvHeute: number | null, hrvBase: number | null): number | null {
  if (rec != null) {
    return Math.round(Math.max(0.1, Math.min(3, 3 - (rec / 100) * 2.6)) * 10) / 10
  }
  if (hrvHeute != null && hrvBase != null && hrvBase > 0) {
    const abw = (hrvBase - hrvHeute) / hrvBase
    return Math.round(Math.max(0.1, Math.min(3, 1.5 + abw * 3)) * 10) / 10
  }
  return null
}

function stressLabel(s: number | null): string {
  if (s == null) return '—'
  if (s < 1.0) return 'NIEDRIG'
  if (s < 2.0) return 'MITTEL'
  if (s < 2.5) return 'ERHÖHT'
  return 'HOCH'
}

function stressColor(s: number | null): string {
  if (s == null) return '#52525b'
  if (s < 1.0) return '#00E676'
  if (s < 2.0) return '#00E5FF'
  if (s < 2.5) return '#FFD600'
  return '#FF6B35'
}

function vitalsStatus(d: WhoopDayRecord): { ok: number; total: number; allOk: boolean } {
  const checks: boolean[] = [
    d.restingHr != null,
    d.hrvRmssd != null,
    d.respiratoryRate != null,
    d.spo2Percent != null,
    d.skinTempDelta != null,
  ]
  const ok = checks.filter(Boolean).length
  const probleme =
    (d.spo2Percent != null && d.spo2Percent < 95) ||
    (d.skinTempDelta != null && (d.skinTempDelta < -0.5 || d.skinTempDelta > 0.7))
  return { ok, total: 5, allOk: !probleme }
}

function wochentagKurzDe(isoOrDate: string | Date): string {
  const d = typeof isoOrDate === 'string' ? new Date(isoOrDate + 'T12:00:00') : isoOrDate
  return d.toLocaleDateString('de-DE', { weekday: 'short' }).toUpperCase().slice(0, 2)
}

function letzte7TageIso(): string[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    return d.toISOString().slice(0, 10)
  })
}

function formatSchlafbedarf(min: number | null): string {
  if (min == null) return '—'
  const h = Math.floor(min / 60)
  const m = Math.round(min % 60)
  return `${h}:${String(m).padStart(2, '0')}`
}

function empfohleneSchlafzeit(schlafbedarfMin: number | null, weckMs: number | null): string | null {
  if (schlafbedarfMin == null) return null
  const weckHour = weckMs != null ? new Date(weckMs).getHours() : 7
  const schlafZeit = new Date()
  schlafZeit.setHours(weckHour, 0, 0, 0)
  schlafZeit.setTime(schlafZeit.getTime() - schlafbedarfMin * 60 * 1000)
  return `${String(schlafZeit.getHours()).padStart(2, '0')}:${String(schlafZeit.getMinutes()).padStart(2, '0')}`
}

function formatUhrzeitShort(ms: number | null): string {
  if (ms == null) return '—'
  const d = new Date(ms)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
