'use client'

import {
  PageChrome,
  PageHero,
  PageSection,
  PageSectionPanel,
  pageSectionShellClass,
  pageSectionTitleClass,
} from '@/components/page-shell'
import {
  ladeFitnessSnapshot,
  parseFitnessSnapshotJson,
  speichereFitnessSnapshot,
} from '@/lib/fitnessdaten/snapshot-storage'
import type { FitnessSnapshot } from '@/lib/fitnessdaten/types'
import { FitnessWhoopBlePanel } from '@/components/fitnessdaten/fitness-whoop-ble-panel'
import { useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'

const WHOOP5_PROTO_URL = 'https://judes.club/writing/cracking-the-whoop-5-bluetooth-protocol/'
const WHOOP_APP_URL = 'https://github.com/project-whoopsie/whoopsie'

const ROADMAP = [
  {
    step: 1,
    title: 'Standard-Puls (WHOOP 5.0)',
    detail:
      'BLE Heart Rate Service 0x180D — Puls + RR ohne Custom-Bond. Erster Meilenstein für dein 5.0.',
  },
  {
    step: 2,
    title: 'Bond + Custom-Service fd4b0001',
    detail: 'Android-Pairing, NOTIFY auf fd4b0003–0007. Basis für IMU, Historie, r22-Stream.',
  },
  {
    step: 3,
    title: 'Gen5-Handshake & Historical Sync',
    detail: 'SET_CONFIG-Flags, GET_DATA_RANGE, Cursor-ACK 0x17 — nicht die 4.0-Init-Pakete.',
  },
  {
    step: 4,
    title: 'Lokale Scores',
    detail: 'RMSSD aus RR, Schlaf aus IMU+HF, Strain aus HF-Zonen — ohne WHOOP-Cloud.',
  },
] as const

function formatZeit(iso?: string | null) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' })
  } catch {
    return iso
  }
}

function MetricCard({
  label,
  value,
  unit,
  hint,
}: {
  label: string
  value: string
  unit?: string
  hint?: string
}) {
  return (
    <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-4 shadow-inner">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-2 text-2xl font-bold tabular-nums tracking-tight text-zinc-100">
        {value}
        {unit ? <span className="ml-1 text-base font-semibold text-zinc-400">{unit}</span> : null}
      </p>
      {hint ? <p className="mt-1.5 text-xs leading-relaxed text-zinc-500">{hint}</p> : null}
    </div>
  )
}

export function FitnessdatenClient() {
  const [snapshot, setSnapshot] = useState<FitnessSnapshot | null>(null)
  const [importJson, setImportJson] = useState('')
  const [importOffen, setImportOffen] = useState(false)

  useEffect(() => {
    setSnapshot(ladeFitnessSnapshot())
  }, [])

  const live = snapshot?.live ?? null
  const scores = snapshot?.scores ?? null

  const rrVorschau = useMemo(() => {
    if (!live?.rrIntervalsMs?.length) return '—'
    const tail = live.rrIntervalsMs.slice(-5)
    return tail.map((v) => `${Math.round(v)} ms`).join(' · ')
  }, [live?.rrIntervalsMs])

  const accelText = useMemo(() => {
    if (!live?.accel) return '—'
    const { x, y, z } = live.accel
    return `${x.toFixed(2)} / ${y.toFixed(2)} / ${z.toFixed(2)}`
  }, [live?.accel])

  const speichereImport = useCallback(() => {
    try {
      const next = parseFitnessSnapshotJson(importJson)
      speichereFitnessSnapshot(next)
      setSnapshot(next)
      setImportOffen(false)
      setImportJson('')
      toast.success('Fitnessdaten importiert.')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'JSON konnte nicht gelesen werden.')
    }
  }, [importJson])

  const loescheDaten = useCallback(() => {
    if (!window.confirm('Gespeicherte Fitnessdaten in diesem Browser löschen?')) return
    window.localStorage.removeItem('mein-haushalt:fitnessdaten-snapshot')
    setSnapshot(null)
    toast.success('Daten gelöscht.')
  }, [])

  return (
    <PageChrome>
      <PageHero
        eyebrow="Wearable · lokal · abofrei"
        title="Fitnessdaten"
        description={
          <>
            WHOOP 5.0 direkt in <strong className="text-orange-200">Omnia</strong> — wie Finanzen oder Kalender. Puls und
            HRV-Basis per Web Bluetooth im Browser; alles bleibt lokal in deinem Browser (kein WHOOP-Abo).
          </>
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <a
              href={WHOOP5_PROTO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-xl border border-orange-500/40 bg-orange-950/30 px-4 py-2.5 text-xs font-semibold text-orange-100 transition hover:bg-orange-900/40"
            >
              WHOOP 5.0 Protokoll
            </a>
            <a
              href={WHOOP_APP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-xl border border-zinc-600/80 bg-zinc-900/80 px-4 py-2.5 text-xs font-semibold text-zinc-200 transition hover:bg-zinc-800"
            >
              whoopsie (Flutter)
            </a>
          </div>
        }
      />

      <PageSection titleId="fitness-whoop-ble" title="WHOOP verbinden">
        <PageSectionPanel>
          <FitnessWhoopBlePanel onSnapshot={setSnapshot} />
        </PageSectionPanel>
      </PageSection>

      <PageSection titleId="fitness-live" title="Aktueller Stand">
        <PageSectionPanel>
          {snapshot ? (
            <div className="space-y-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-zinc-400">
                  Zuletzt aktualisiert:{' '}
                  <span className="font-medium text-zinc-200">{formatZeit(snapshot.updatedAt)}</span>
                  {snapshot.deviceName ? (
                    <>
                      {' '}
                      · Gerät: <span className="font-medium text-zinc-200">{snapshot.deviceName}</span>
                    </>
                  ) : null}
                </p>
                <button
                  type="button"
                  onClick={loescheDaten}
                  className="rounded-lg border border-zinc-700/80 px-3 py-2 text-xs font-semibold text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-200"
                >
                  Daten löschen
                </button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <MetricCard
                  label="Herzfrequenz"
                  value={live?.heartRateBpm != null ? String(live.heartRateBpm) : '—'}
                  unit="bpm"
                  hint="Live · Standard-BLE 0x180D (WHOOP 5.0)"
                />
                <MetricCard
                  label="RR-Intervalle"
                  value={live?.rrIntervalsMs?.length ? String(live.rrIntervalsMs.length) : '—'}
                  unit={live?.rrIntervalsMs?.length ? 'Werte' : undefined}
                  hint={rrVorschau !== '—' ? `Letzte: ${rrVorschau}` : 'Für RMSSD / HRV'}
                />
                <MetricCard
                  label="Hauttemperatur"
                  value={live?.skinTempC != null ? live.skinTempC.toFixed(1) : '—'}
                  unit="°C"
                />
                <MetricCard
                  label="Beschleunigung (IMU)"
                  value={accelText}
                  hint="3-Achsen, letzter Sample"
                />
              </div>
              {(scores?.hrvRmssdMs != null || scores?.strain != null || scores?.sleepMinutes != null) && (
                <div className="grid gap-3 sm:grid-cols-3">
                  <MetricCard
                    label="HRV (RMSSD)"
                    value={scores?.hrvRmssdMs != null ? scores.hrvRmssdMs.toFixed(1) : '—'}
                    unit="ms"
                  />
                  <MetricCard
                    label="Strain"
                    value={scores?.strain != null ? scores.strain.toFixed(1) : '—'}
                    unit="/ 21"
                  />
                  <MetricCard
                    label="Schlaf"
                    value={scores?.sleepMinutes != null ? String(Math.round(scores.sleepMinutes / 60)) : '—'}
                    unit="h"
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-zinc-700/70 bg-zinc-950/40 px-5 py-10 text-center">
              <p className="text-sm font-medium text-zinc-300">Noch keine Fitnessdaten in diesem Browser.</p>
              <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-zinc-500">
                Oben <strong className="text-zinc-300">WHOOP verbinden</strong> — oder Test-Daten per JSON importieren.
              </p>
              <button
                type="button"
                onClick={() => setImportOffen((v) => !v)}
                className="mt-5 rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-bold text-white shadow-md shadow-orange-950/30 transition hover:bg-orange-500"
              >
                {importOffen ? 'Import schließen' : 'Test-JSON importieren'}
              </button>
            </div>
          )}

          {(importOffen || !snapshot) && (
            <div className={`${snapshot ? 'mt-5 ' : ''}space-y-3 rounded-xl border border-zinc-800/80 bg-zinc-950/50 p-4`}>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Snapshot-Import (Dev)</p>
              <textarea
                value={importJson}
                onChange={(e) => setImportJson(e.target.value)}
                rows={6}
                placeholder={'{\n  "updatedAt": "2026-06-04T12:00:00.000Z",\n  "deviceName": "WHOOP …",\n  "live": { "heartRateBpm": 62, "rrIntervalsMs": [920, 880], "skinTempC": 33.1, "accel": { "x": 0.01, "y": -0.02, "z": 0.98 }, "recordedAt": "…" }\n}'}
                className="w-full rounded-lg border border-zinc-700/80 bg-zinc-950 px-3 py-2.5 font-mono text-xs text-zinc-200 outline-none focus:ring-2 focus:ring-orange-500/30"
              />
              <button
                type="button"
                onClick={speichereImport}
                className="rounded-lg bg-zinc-800 px-4 py-2 text-xs font-semibold text-zinc-100 transition hover:bg-zinc-700"
              >
                JSON speichern
              </button>
            </div>
          )}
        </PageSectionPanel>
      </PageSection>

      <PageSection titleId="fitness-architektur" title="Architektur">
        <PageSectionPanel>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className={pageSectionShellClass}>
              <div className="border-b border-zinc-800/70 px-5 py-4">
                <h3 className={pageSectionTitleClass}>Alles in Omnia</h3>
              </div>
              <div className="space-y-3 px-5 py-5 text-sm leading-relaxed text-zinc-400">
                <p>
                  <strong className="text-zinc-200">Web-App (diese Seite):</strong> Dashboard + Web Bluetooth für Puls/RR
                  am WHOOP 5.0. Daten in <code className="text-xs">localStorage</code> — wie andere Omnia-Bereiche lokal
                  oder später Supabase.
                </p>
                <p>
                  <strong className="text-zinc-200">Optional Flutter-App:</strong> Nur für erweiterte Custom-Daten (IMU,
                  Historie fd4b) — nicht nötig für den Einstieg.
                </p>
              </div>
            </div>
            <div className={pageSectionShellClass}>
              <div className="border-b border-zinc-800/70 px-5 py-4">
                <h3 className={pageSectionTitleClass}>BLE-Logik im whoopsie-Repo</h3>
              </div>
              <ul className="space-y-2 px-5 py-5 font-mono text-xs text-zinc-400">
                <li>
                  <span className="text-orange-300">lib/core/ble/whoop_connection.dart</span> — Scan, Connect, NOTIFY,
                  Init-Sequenz, ACK
                </li>
                <li>
                  <span className="text-orange-300">lib/core/protocol/whoop_protocol.dart</span> — Frames, CRC, R10/R21
                  Decoder
                </li>
                <li>
                  <span className="text-orange-300">lib/features/scan/</span> — UI Scanner & Verbindung
                </li>
                <li>
                  <span className="text-orange-300">lib/features/dashboard/</span> — Live-Anzeige (HR-Ring)
                </li>
              </ul>
            </div>
          </div>
        </PageSectionPanel>
      </PageSection>

      <PageSection titleId="fitness-roadmap" title="Implementierungs-Roadmap">
        <PageSectionPanel>
          <ol className="space-y-3">
            {ROADMAP.map((item) => (
              <li
                key={item.step}
                className="flex gap-4 rounded-xl border border-zinc-800/80 bg-zinc-950/45 px-4 py-4 sm:px-5"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-orange-950/50 text-sm font-bold text-orange-200 ring-1 ring-orange-500/30">
                  {item.step}
                </span>
                <div className="min-w-0">
                  <p className="font-semibold text-zinc-100">{item.title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-zinc-500">{item.detail}</p>
                </div>
              </li>
            ))}
          </ol>
          <p className="mt-5 rounded-xl border border-orange-800/50 bg-orange-950/20 px-4 py-3 text-sm leading-relaxed text-orange-100/90">
            <strong>WHOOP 5.0:</strong> Custom-Service <code className="text-xs">fd4b0001-…</code>, starkes Pairing
            nötig. Sofort nutzbar: Standard-Herzfrequenz <code className="text-xs">0x180D</code> (Puls + RR für HRV).
            Vollständige Sensor-/Historie-Daten folgen in Phase 1b–3 — siehe{' '}
            <code className="text-xs">whoop-app/SCHRITTE.md</code>.
          </p>
        </PageSectionPanel>
      </PageSection>
    </PageChrome>
  )
}
