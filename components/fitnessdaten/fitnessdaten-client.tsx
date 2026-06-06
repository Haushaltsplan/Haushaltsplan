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
import { useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'

const WHOOP_PROTOCOL_URL = 'https://github.com/project-whoopsie/whoopsie-protocol/blob/main/WHOOP_BLE_PROTOCOL.md'
const WHOOP_APP_URL = 'https://github.com/project-whoopsie/whoopsie'

const ROADMAP = [
  {
    step: 1,
    title: 'BLE Verbindung & Parsing',
    detail: 'Scanner (Name „WHOOP*“), Pairing, NOTIFY auf 61080003–61080007, Frame-Parser (0xAA, CRC8/CRC32).',
  },
  {
    step: 2,
    title: 'Live-Daten-Stream',
    detail: 'HR, RR-Intervalle, Hauttemperatur, IMU aus R10/R21-Payloads in Echtzeit anzeigen.',
  },
  {
    step: 3,
    title: 'Historical Sync & ACK',
    detail: '5-Paket-Handshake, ~1244-Byte-Blöcke puffern, Batch-ACK rechtzeitig zurücksenden.',
  },
  {
    step: 4,
    title: 'Lokale Scores',
    detail: 'RMSSD (HRV), Schlaf aus IMU+HF, Strain 0–21 aus HF-Zonen — alles ohne Cloud.',
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
            WHOOP-Daten per eigener Android-App (Flutter + BLE) auslesen und hier visualisieren. BLE läuft nicht im
            Browser — die Flutter-App synchronisiert Snapshots (später per API oder JSON-Export).
          </>
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <a
              href={WHOOP_PROTOCOL_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-xl border border-orange-500/40 bg-orange-950/30 px-4 py-2.5 text-xs font-semibold text-orange-100 transition hover:bg-orange-900/40"
            >
              WHOOP_BLE_PROTOCOL.md
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
                  hint="Live aus R10-Paket (Byte 21)"
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
                Verbinde zuerst dein WHOOP in der Flutter-App. Sobald dort Live-Daten ankommen, kannst du einen Snapshot
                hier importieren — oder wir schließen später eine Sync-API an.
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
                <h3 className={pageSectionTitleClass}>Zwei Teile</h3>
              </div>
              <div className="space-y-3 px-5 py-5 text-sm leading-relaxed text-zinc-400">
                <p>
                  <strong className="text-zinc-200">Flutter-App (Android):</strong> BLE-Scan, Pairing, Protokoll-Parser,
                  lokale SQLite/Hive, Score-Berechnung. Basis:{' '}
                  <a href={WHOOP_APP_URL} className="text-orange-300 hover:underline" target="_blank" rel="noopener noreferrer">
                    project-whoopsie/whoopsie
                  </a>
                  .
                </p>
                <p>
                  <strong className="text-zinc-200">Diese Seite (mein-haushalt):</strong> Dashboard wie Kalender oder
                  Finanzen — zeigt importierte oder per API synchronisierte Snapshots.
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
          <p className="mt-5 text-sm leading-relaxed text-amber-200/90">
            Hinweis WHOOP 5.0: Die Protokoll-Doku ist für Gen4 (Harvard / 4.0) reverse-engineered. Am Band testen, ob
            Service-UUID <code className="rounded bg-zinc-900 px-1 text-xs">61080001</code> und die Charakteristiken
            identisch sind.
          </p>
        </PageSectionPanel>
      </PageSection>
    </PageChrome>
  )
}
