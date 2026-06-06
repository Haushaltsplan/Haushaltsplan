'use client'

import { WhoopHrChart } from '@/components/fitnessdaten/whoop-hr-chart'
import { FitnessWhoopBlePanel } from '@/components/fitnessdaten/fitness-whoop-ble-panel'
import {
  recoveryColor,
  recoveryLabelDe,
  WhoopRing,
} from '@/components/fitnessdaten/whoop-ring'
import { formatZoneAnteil, ladeFitnessHistory } from '@/lib/fitnessdaten/history-storage'
import type { FitnessSnapshot } from '@/lib/fitnessdaten/types'
import { HR_ZONE_COLORS, HR_ZONE_LABELS } from '@/lib/fitnessdaten/types'
import type { WhoopWebBlePhase } from '@/lib/fitnessdaten/web-bluetooth-whoop'
import { useMemo, useState } from 'react'

type Tab = 'home' | 'strain' | 'recovery' | 'health' | 'connect'

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

function MetricTile({
  label,
  value,
  unit,
  accent,
  hint,
}: {
  label: string
  value: string
  unit?: string
  accent?: string
  hint?: string
}) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] px-4 py-3.5">
      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-500">{label}</p>
      <p className="mt-1.5 text-2xl font-bold tabular-nums text-white">
        {value}
        {unit ? <span className="ml-1 text-sm font-semibold text-zinc-500">{unit}</span> : null}
      </p>
      {hint ? <p className="mt-1 text-[11px] leading-snug text-zinc-600">{hint}</p> : null}
      {accent ? (
        <div className="mt-2 h-0.5 w-8 rounded-full" style={{ backgroundColor: accent }} />
      ) : null}
    </div>
  )
}

export function WhoopDashboard({ snapshot, phase, onSnapshot, onPhaseChange }: Props) {
  const [tab, setTab] = useState<Tab>('home')
  const live = snapshot?.live
  const scores = snapshot?.scores
  const deviceInfo = snapshot?.deviceInfo
  const history = useMemo(() => ladeFitnessHistory(), [snapshot?.updatedAt])
  const isLive = phase === 'live'
  const zoneAnteil = scores?.zoneMinutes ? formatZoneAnteil(scores.zoneMinutes) : []

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'home', label: 'Home', icon: '◉' },
    { id: 'strain', label: 'Belastung', icon: '◎' },
    { id: 'recovery', label: 'Recovery', icon: '◐' },
    { id: 'health', label: 'Health', icon: '♡' },
    { id: 'connect', label: 'Gerät', icon: '⬡' },
  ]

  return (
    <div className="relative min-h-[calc(100dvh-4rem)] overflow-hidden rounded-3xl border border-white/[0.06] bg-[#050505] text-white shadow-2xl shadow-black/60">
      {/* Ambient glow */}
      <div
        className="pointer-events-none absolute -left-32 -top-32 h-64 w-64 rounded-full opacity-30 blur-3xl"
        style={{ background: recoveryColor(scores?.recoveryPercent) }}
      />
      <div className="pointer-events-none absolute -right-24 top-1/3 h-48 w-48 rounded-full bg-[#009dff]/10 blur-3xl" />

      <div className="relative px-4 pb-28 pt-5 sm:px-6 sm:pt-6">
        {/* Header */}
        <header className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Omnia · WHOOP</p>
            <h1 className="mt-1 text-lg font-semibold capitalize text-white sm:text-xl">{formatDatum()}</h1>
            <p className="mt-0.5 text-xs text-zinc-500">
              {snapshot?.deviceName ?? 'Nicht verbunden'}
              {deviceInfo?.batteryPercent != null ? ` · ${deviceInfo.batteryPercent}% Akku` : ''}
            </p>
          </div>
          <div
            className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-semibold ${
              isLive
                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                : phase === 'waiting_hr' || phase === 'connecting'
                  ? 'border-amber-500/30 bg-amber-500/10 text-amber-200'
                  : 'border-zinc-700/60 bg-zinc-900/80 text-zinc-400'
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${isLive ? 'animate-pulse bg-emerald-400' : 'bg-zinc-600'}`}
            />
            {isLive ? 'Live' : phase === 'waiting_hr' ? 'Warte …' : phase === 'connecting' ? 'Verbinde' : 'Offline'}
          </div>
        </header>

        {/* Rings — WHOOP classic triad */}
        {(tab === 'home' || tab === 'recovery' || tab === 'strain') && (
          <div className="mt-8 flex items-start justify-around gap-2 sm:gap-4">
            <WhoopRing
              value={scores?.recoveryPercent ?? 0}
              label="Recovery"
              sublabel={recoveryLabelDe(scores?.recoveryLabel)}
              color={recoveryColor(scores?.recoveryPercent)}
              unavailable={scores?.recoveryPercent == null}
            />
            <WhoopRing
              value={scores?.dayStrain ?? scores?.strain ?? 0}
              max={21}
              label="Strain"
              sublabel="Heute"
              color="#009dff"
              unavailable={(scores?.dayStrain ?? scores?.strain) == null}
            />
            <WhoopRing
              value={scores?.sleepScore ?? 0}
              label="Schlaf"
              sublabel={
                scores?.sleepMinutes
                  ? `${Math.floor(scores.sleepMinutes / 60)}h ${scores.sleepMinutes % 60}m`
                  : 'IMU / Nacht'
              }
              color="#7b61ff"
              unavailable={scores?.sleepScore == null}
            />
          </div>
        )}

        {tab === 'home' && (
          <section className="mt-8 space-y-5">
            <div>
              <div className="mb-3 flex items-end justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-500">
                    Herzfrequenz
                  </p>
                  <p className="mt-1 text-5xl font-bold tabular-nums tracking-tighter text-white">
                    {live?.heartRateBpm ?? '—'}
                    <span className="ml-2 text-xl font-semibold text-zinc-500">bpm</span>
                  </p>
                </div>
                {live?.sensorContact != null ? (
                  <span
                    className={`rounded-lg px-2 py-1 text-[10px] font-semibold ${
                      live.sensorContact
                        ? 'bg-emerald-500/15 text-emerald-300'
                        : 'bg-amber-500/15 text-amber-200'
                    }`}
                  >
                    {live.sensorContact ? 'Sensor OK' : 'Kein Kontakt'}
                  </span>
                ) : null}
              </div>
              <WhoopHrChart points={snapshot?.hrHistory ?? []} live={isLive} />
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <MetricTile
                label="HRV (RMSSD)"
                value={scores?.hrvRmssdMs != null ? scores.hrvRmssdMs.toFixed(0) : '—'}
                unit="ms"
                accent="#00ff87"
                hint={`Baseline ~${history.baselines.hrvRmssdMs.toFixed(0)} ms`}
              />
              <MetricTile
                label="Ruhepuls"
                value={scores?.restingHrBpm != null ? String(scores.restingHrBpm) : '—'}
                unit="bpm"
                accent="#a78bfa"
                hint={`Baseline ~${history.baselines.restingHrBpm} bpm`}
              />
              <MetricTile
                label="Kalorien"
                value={scores?.caloriesKcal != null ? String(scores.caloriesKcal) : '—'}
                unit="kcal"
                accent="#f97316"
                hint="Geschätzt aus HF heute"
              />
              <MetricTile
                label="Max HF"
                value={scores?.maxHrToday != null ? String(scores.maxHrToday) : '—'}
                unit="bpm"
                accent="#ef4444"
              />
              <MetricTile
                label="Hauttemp."
                value={live?.skinTempC != null ? live.skinTempC.toFixed(1) : '—'}
                unit="°C"
                accent="#7b61ff"
                hint="Gen5-Events (fd4b)"
              />
              <MetricTile
                label="IMU (g)"
                value={
                  live?.accel
                    ? `${live.accel.x.toFixed(2)}, ${live.accel.y.toFixed(2)}, ${live.accel.z.toFixed(2)}`
                    : '—'
                }
                hint="r22-Stream · Band am Handgelenk"
              />
            </div>

            {live?.rrIntervalsMs && live.rrIntervalsMs.length > 0 ? (
              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-500">
                  RR-Intervalle (letzte)
                </p>
                <p className="mt-2 font-mono text-xs leading-relaxed text-zinc-400">
                  {live.rrIntervalsMs
                    .slice(-8)
                    .map((v) => `${Math.round(v)} ms`)
                    .join(' · ')}
                </p>
              </div>
            ) : null}
          </section>
        )}

        {tab === 'strain' && (
          <section className="mt-8 space-y-5">
            <MetricTile
              label="Tages-Strain"
              value={(scores?.dayStrain ?? scores?.strain)?.toFixed(1) ?? '—'}
              unit="/ 21"
              accent="#009dff"
              hint="Lokal aus HF-Zonen berechnet — WHOOP-Algorithmus approximiert"
            />
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-500">
                Zonenverteilung heute
              </p>
              {zoneAnteil.length === 0 ? (
                <p className="mt-3 text-sm text-zinc-600">Noch keine Zonendaten — Band tragen & verbinden.</p>
              ) : (
                <ul className="mt-4 space-y-3">
                  {zoneAnteil.map(({ key, pct }) => (
                    <li key={key}>
                      <div className="mb-1 flex justify-between text-xs">
                        <span style={{ color: HR_ZONE_COLORS[key] }}>{HR_ZONE_LABELS[key]}</span>
                        <span className="tabular-nums text-zinc-500">{pct}%</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-zinc-900">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${pct}%`, backgroundColor: HR_ZONE_COLORS[key] }}
                        />
                      </div>
                      <p className="mt-0.5 text-[10px] text-zinc-600">
                        {scores?.zoneMinutes?.[key]?.toFixed(1) ?? 0} min
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <MetricTile
              label="Ø Herzfrequenz Session"
              value={scores?.avgHrSession != null ? String(scores.avgHrSession) : '—'}
              unit="bpm"
            />
          </section>
        )}

        {tab === 'recovery' && (
          <section className="mt-8 space-y-5">
            <div className="rounded-2xl border border-white/[0.06] bg-gradient-to-br from-white/[0.04] to-transparent p-5">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-500">Recovery Score</p>
              <p
                className="mt-2 text-6xl font-bold tabular-nums"
                style={{ color: recoveryColor(scores?.recoveryPercent) }}
              >
                {scores?.recoveryPercent != null ? `${scores.recoveryPercent}%` : '—'}
              </p>
              <p className="mt-2 text-sm text-zinc-400">
                {scores?.recoveryPercent != null
                  ? `Einschätzung: ${recoveryLabelDe(scores.recoveryLabel)} — berechnet aus HRV (RMSSD) und Ruhepuls vs. deine Baseline.`
                  : 'Mindestens ~30 RR-Intervalle für stabile HRV nötig.'}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <MetricTile
                label="HRV RMSSD"
                value={scores?.hrvRmssdMs?.toFixed(1) ?? '—'}
                unit="ms"
                accent="#00ff87"
              />
              <MetricTile
                label="Ruhepuls"
                value={scores?.restingHrBpm != null ? String(scores.restingHrBpm) : '—'}
                unit="bpm"
                accent="#a78bfa"
              />
            </div>
            <p className="rounded-xl border border-violet-900/30 bg-violet-950/20 px-4 py-3 text-xs leading-relaxed text-violet-200/80">
              <strong>Schlaf</strong> wird aus IMU-Ruhe nachts geschätzt (Gen5 r22). Für exakte WHOOP-Schlafphasen
              braucht es den vollen Historie-Sync — läuft automatisch, wenn Custom-BLE (fd4b) verbunden ist.
            </p>
            {scores?.sleepMinutes != null && scores.sleepMinutes > 0 ? (
              <div className="grid grid-cols-2 gap-3">
                <MetricTile
                  label="Schlafdauer"
                  value={String(Math.floor(scores.sleepMinutes / 60))}
                  unit="h"
                  accent="#7b61ff"
                />
                <MetricTile
                  label="Effizienz"
                  value={scores.sleepEfficiency != null ? String(scores.sleepEfficiency) : '—'}
                  unit="%"
                  accent="#a78bfa"
                />
              </div>
            ) : null}
          </section>
        )}

        {tab === 'health' && (
          <section className="mt-8 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <MetricTile label="Modell" value={deviceInfo?.model ?? '—'} />
              <MetricTile label="Hardware" value={deviceInfo?.hardwareRevision ?? '—'} />
              <MetricTile label="Firmware" value={deviceInfo?.firmwareRevision ?? '—'} />
              <MetricTile
                label="Akku"
                value={deviceInfo?.batteryPercent != null ? String(deviceInfo.batteryPercent) : '—'}
                unit="%"
              />
              <MetricTile label="Hersteller" value={deviceInfo?.manufacturer ?? 'WHOOP'} />
              <MetricTile
                label="Energie (Band)"
                value={live?.energyExpendedKj != null ? live.energyExpendedKj.toFixed(1) : '—'}
                unit="kJ"
                hint="Falls vom Standard-HR-Profil geliefert"
              />
            </div>
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 text-xs text-zinc-500">
              <p className="font-semibold text-zinc-400">Gen5 Custom-BLE (fd4b0001)</p>
              {snapshot?.gen5 ? (
                <ul className="mt-2 space-y-1 font-mono text-[11px]">
                  <li>Phase: {snapshot.gen5.phase}</li>
                  <li>r22-Pakete: {snapshot.gen5.r22Count}</li>
                  <li>Historie: {snapshot.gen5.historyPackets} Chunks</li>
                  {snapshot.gen5.lastError ? (
                    <li className="text-amber-300">{snapshot.gen5.lastError}</li>
                  ) : null}
                </ul>
              ) : (
                <p className="mt-2 leading-relaxed">
                  Noch nicht aktiv. WHOOP-App einmal koppeln (Android-Bond), dann fd4b-Handshake automatisch.
                </p>
              )}
              {snapshot?.gen5?.phase === 'bond_required' ? (
                <p className="mt-2 text-amber-200/90">
                  Bond fehlt: WHOOP-App öffnen → Strap verbinden → erneut in Omnia verbinden.
                </p>
              ) : null}
            </div>
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 text-xs text-zinc-500">
              <p className="font-semibold text-zinc-400">Noch nicht per Web-BLE</p>
              <ul className="mt-2 list-inside list-disc space-y-1 leading-relaxed">
                <li>PPG-Rohsignal (optisch)</li>
                <li>Exakte WHOOP Recovery/Strain-Modelle (Cloud)</li>
              </ul>
            </div>
          </section>
        )}

        {tab === 'connect' && (
          <section className="mt-6">
            <FitnessWhoopBlePanel
              onSnapshot={onSnapshot}
              onPhaseChange={onPhaseChange}
              embedded
            />
          </section>
        )}
      </div>

      {/* Bottom nav — WHOOP style */}
      <nav className="absolute bottom-0 left-0 right-0 border-t border-white/[0.06] bg-[#050505]/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl">
        <ul className="flex justify-around">
          {tabs.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => setTab(t.id)}
                className={`flex flex-col items-center gap-0.5 rounded-xl px-3 py-2 text-[10px] font-semibold transition ${
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
    </div>
  )
}
