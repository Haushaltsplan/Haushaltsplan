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
import { baseline30 } from '@/lib/fitnessdaten/daily-records'
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
  const { heute, woche, metriken, aktivitaeten, aktivitaetenHistorie, journal, schlafdefizit } = model

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'home', label: 'Home', icon: '◉' },
    { id: 'sleep', label: 'Schlaf', icon: '☾' },
    { id: 'recovery', label: 'Erholung', icon: '◐' },
    { id: 'strain', label: 'Belastung', icon: '◎' },
    { id: 'health', label: 'Gesundheit', icon: '♡' },
    { id: 'connect', label: 'Gerät', icon: '⬡' },
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
    <div className="relative min-h-[calc(100dvh-4rem)] overflow-hidden rounded-3xl border border-white/[0.06] bg-[#050505] text-white shadow-2xl shadow-black/60">
      <div
        className="pointer-events-none absolute -left-32 -top-32 h-64 w-64 rounded-full opacity-30 blur-3xl"
        style={{ background: recoveryColor(heute.recoveryPercent) }}
      />
      <div className="pointer-events-none absolute -right-24 top-1/3 h-48 w-48 rounded-full bg-[#009dff]/10 blur-3xl" />

      <div
        className={`relative max-h-[calc(100dvh-4rem)] px-4 pb-28 pt-5 sm:px-6 sm:pt-6 ${appModalScrollHiddenClassName}`}
      >
        <header className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">WHOOP</p>
            <h1 className="mt-1 text-lg font-semibold capitalize text-white sm:text-xl">{formatDatum()}</h1>
            <p className="mt-0.5 text-xs text-zinc-500">
              {snapshot?.deviceName ?? 'Nicht verbunden'}
              {deviceInfo?.batteryPercent != null ? ` · ${deviceInfo.batteryPercent}% Akku` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void onStatusTap()}
            disabled={statusBusy || isConnecting}
            title={
              isLive
                ? 'Daten synchronisieren'
                : isConnecting
                  ? 'Verbindung läuft …'
                  : 'Verbinden & synchronisieren'
            }
            className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-semibold transition active:scale-[0.97] disabled:cursor-default disabled:opacity-70 ${
              isLive
                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20'
                : isConnecting
                  ? 'border-amber-500/30 bg-amber-500/10 text-amber-200'
                  : 'border-zinc-700/60 bg-zinc-900/80 text-zinc-400 hover:border-zinc-600 hover:bg-zinc-800/90 hover:text-zinc-200'
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                isLive || statusBusy
                  ? 'animate-pulse bg-emerald-400'
                  : isConnecting
                    ? 'animate-pulse bg-amber-400'
                    : 'bg-zinc-600'
              }`}
            />
            {statusLabel}
          </button>
        </header>

        <WhoopSyncBanner
          status={model.sync.status}
          message={model.sync.message}
          lastSyncedAt={model.sync.lastSyncedAt}
          historicalCount={model.sync.historicalPacketsTotal}
          onInfo={() => showInfo('sync')}
        />

        {tab === 'home' && (
          <>
            <div className="mt-6 flex items-start justify-around gap-2">
              <WhoopRing
                value={heute.recoveryPercent ?? 0}
                label="Erholung"
                sublabel={recoveryLabelDe(scores?.recoveryLabel)}
                color={recoveryColor(heute.recoveryPercent)}
                unavailable={heute.recoveryPercent == null}
                onPress={() => setTab('recovery')}
              />
              <WhoopRing
                value={heute.strain ?? 0}
                max={21}
                label="Belastung"
                sublabel="Heute"
                color="#009dff"
                unavailable={heute.strain == null}
                onPress={() => setTab('strain')}
              />
              <WhoopRing
                value={heute.sleepScore ?? 0}
                label="Schlaf"
                sublabel={
                  heute.sleepMinutes ? `${Math.floor(heute.sleepMinutes / 60)}h ${heute.sleepMinutes % 60}m` : 'Nacht'
                }
                color="#7b61ff"
                unavailable={heute.sleepScore == null}
                onPress={() => setTab('sleep')}
              />
            </div>

            <section className="mt-6 space-y-4">
              <div className="rounded-2xl border border-white/[0.06] bg-[#141618] p-4">
                <button type="button" onClick={() => showInfo('behavior')} className="w-full text-left">
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-500">Verhaltenseinblicke</p>
                  <p className="mt-2 text-xs leading-relaxed text-zinc-500">
                    Verhaltenstags (Alkohol, Koffein …) kommen aus der WHOOP-Cloud — lokal nicht verfügbar. Tippe
                    für Details.
                  </p>
                </button>
              </div>

              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-500">Herzfrequenz live</p>
                <p className="mt-1 text-5xl font-bold tabular-nums text-white">
                  {model.liveHr ?? '—'}
                  <span className="ml-2 text-xl font-semibold text-zinc-500">bpm</span>
                </p>
                <WhoopHrChart points={snapshot?.hrHistory ?? []} live={isLive} />
              </div>

              <div className="rounded-2xl border border-white/[0.06] bg-[#141618] p-4">
                <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-500">
                  Vitalwerte — tippe für Verlauf
                </p>
                <ul className="grid grid-cols-2 gap-2">
                  {HOME_METRICS.map((m) => {
                    const val = heuteWert(m.id, heute)
                    const base = baselineFuerMetrik(m.id)
                    return (
                      <li key={m.id}>
                        <button
                          type="button"
                          onClick={() => setTrendMetric(m.id)}
                          className="w-full rounded-xl border border-white/[0.04] bg-black/25 px-3 py-2.5 text-left transition hover:border-[#009dff]/30"
                        >
                          <span className="text-[9px] font-bold uppercase text-zinc-500">{m.label}</span>
                          <p className="mt-1 text-base font-bold tabular-nums text-white">
                            {formatMetricWert(m.id, val, m.decimals ?? 0)}
                            {m.unit && val != null ? (
                              <span className="ml-1 text-[10px] font-normal text-zinc-500">{m.unit}</span>
                            ) : null}
                          </p>
                          {base != null ? (
                            <p className="mt-0.5 text-[9px] text-zinc-600">
                              Monats-Ø: {formatMetricWert(m.id, base, m.decimals ?? 0)}
                              {m.unit ? ` ${m.unit}` : ''}
                            </p>
                          ) : null}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </div>

              {aktivitaetenHistorie.length > 0 ? (
                <div className="rounded-2xl border border-white/[0.06] bg-[#141618] p-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-500">
                    Letzte Aktivitäten
                  </p>
                  <ul className="mt-3 space-y-2">
                    {aktivitaetenHistorie.slice(0, 6).map((a) => (
                      <li key={a.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedActivity(a)}
                          className="flex w-full items-center gap-3 rounded-xl border border-white/[0.04] bg-black/30 px-3 py-2.5 text-left transition hover:border-[#009dff]/25"
                        >
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#009dff]/20 text-xs font-bold text-[#009dff]">
                            {a.strain.toFixed(1)}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-xs font-bold uppercase">{a.label}</span>
                            <span className="text-[10px] text-zinc-500">
                              {new Date(a.startMs).toLocaleDateString('de-DE', {
                                weekday: 'short',
                                day: 'numeric',
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

              {model.insightRecovery ? <WhoopInsightCard text={model.insightRecovery} /> : null}
            </section>
          </>
        )}

        {tab === 'sleep' && (
          <section className="mt-6 space-y-4">
            <button type="button" onClick={() => showInfo('sleep_score')} className="w-full">
              <WhoopBigRing
                value={heute.sleepScore}
                label="Schlafleistung"
                sublabel={
                  heute.sleepMinutes ? `${Math.floor(heute.sleepMinutes / 60)}h ${heute.sleepMinutes % 60}m` : undefined
                }
                color="#7b61ff"
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
              color="#7b61ff"
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

            <div className="rounded-2xl border border-white/[0.06] bg-[#141618] px-4">
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
              color="#7b61ff"
              onInfo={() => showInfo('sleep_score')}
            />
          </section>
        )}

        {tab === 'strain' && (
          <section className="mt-4 space-y-4">
            <WhoopBigRing value={heute.strain} max={21} label="Belastung" color="#009dff" />

            <div className="rounded-2xl border border-white/[0.06] bg-[#141618] px-4">
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
              <div className="rounded-2xl border border-white/[0.06] bg-[#141618] p-4">
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
              <div className="rounded-2xl border border-white/[0.06] bg-[#141618] p-4">
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
              <div className="rounded-2xl border border-white/[0.06] bg-[#141618] p-4">
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

            <div className="rounded-2xl border border-white/[0.06] bg-[#141618] px-4">
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

            <div className="rounded-2xl border border-white/[0.06] bg-[#141618] px-4">
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

            <div className="rounded-2xl border border-white/[0.06] bg-[#141618] px-4">
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

            <div className="rounded-2xl border border-white/[0.06] bg-[#141618] p-4">
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
              <div className="rounded-2xl border border-white/[0.06] bg-[#141618] p-4">
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
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/[0.08] bg-[#141618] py-3.5 text-[11px] font-bold uppercase tracking-wider text-zinc-300"
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
              <div className="rounded-2xl border border-white/[0.06] bg-[#141618] p-4 font-mono text-[11px] text-zinc-500">
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

      <nav className="absolute bottom-0 left-0 right-0 border-t border-white/[0.06] bg-[#050505]/95 px-1 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl">
        <ul className="flex justify-around">
          {tabs.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => setTab(t.id)}
                className={`flex flex-col items-center gap-0.5 rounded-xl px-2 py-2 text-[9px] font-semibold transition sm:px-3 sm:text-[10px] ${
                  tab === t.id ? 'text-white' : 'text-zinc-600 hover:text-zinc-400'
                }`}
              >
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
