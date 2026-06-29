'use client'

import { WhoopHealthTile } from '@/components/fitnessdaten/whoop-metric-row'
import { WhoopLiveHrMonitor } from '@/components/fitnessdaten/whoop-healthspan'
import type { WhoopDayRecord } from '@/lib/fitnessdaten/daily-records'

type JournalEintrag = { question: string; answer: string }

export function WhoopGesundheitsmonitorPanel({
  heute,
  journal,
  liveHr,
  hrZone,
  hrHistory,
  isLive,
  onBpTap,
  onInfo,
}: {
  heute: WhoopDayRecord
  journal: JournalEintrag[]
  liveHr: number | null
  hrZone: number
  hrHistory: { t: number; bpm: number }[]
  isLive: boolean
  onBpTap?: () => void
  onInfo?: () => void
}) {
  const hatBp = heute.bpSystolic != null && heute.bpDiastolic != null

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-white/[0.06] bg-[#111113] p-4">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--app-text)]">Gesundheitsmonitor</p>
        <div className="mt-3 grid min-w-0 grid-cols-2 gap-2">
          <WhoopHealthTile
            icon="◎"
            label="Atemfrequenz"
            value={heute.respiratoryRate != null ? heute.respiratoryRate.toFixed(1).replace('.', ',') : '—'}
            unit="AZ/min"
            status={
              heute.respiratoryRate != null && heute.respiratoryRate > 15.6 ? '! erhöht > 15,6' : undefined
            }
            statusTone={heute.respiratoryRate != null && heute.respiratoryRate > 15.6 ? 'warn' : 'ok'}
          />
          <WhoopHealthTile
            icon="🩺"
            label="Blutdruck"
            value={hatBp ? `${heute.bpSystolic}/${heute.bpDiastolic}` : '—'}
            unit="mmHg"
            status={
              hatBp
                ? '✓ erfasst'
                : 'Tippen: Manschette-Wert eintragen (WHOOP Life)'
            }
            statusTone={hatBp ? 'ok' : 'warn'}
            onPress={hatBp ? undefined : onBpTap}
          />
          <WhoopHealthTile
            icon="💧"
            label="SpO₂"
            value={heute.spo2Percent != null ? heute.spo2Percent.toFixed(1).replace('.', ',') : '—'}
            unit="%"
            status={
              heute.spo2Percent != null
                ? heute.spo2Percent < 95
                  ? '! unter 95 %'
                  : '✓ automatisch'
                : 'WHOOP Cloud (auto)'
            }
            statusTone={heute.spo2Percent != null ? (heute.spo2Percent < 95 ? 'bad' : 'ok') : 'warn'}
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

      {(liveHr != null || hrHistory.length > 0) && (
        <WhoopLiveHrMonitor bpm={liveHr} zone={hrZone} history={hrHistory} onInfo={onInfo} />
      )}

      {journal.length > 0 ? (
        <div className="rounded-2xl border border-white/[0.06] bg-[#111113] p-4">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--app-text)]">Journal heute</p>
          <ul className="mt-3 space-y-2">
            {journal.slice(0, 8).map((j) => (
              <li key={`${j.question}-${j.answer}`} className="text-xs text-[var(--app-text-muted)]">
                <span className="text-[var(--app-text)]">{j.question.replace(/\([^)]*\)/g, '').trim()}</span>
                <span className="ml-2 font-semibold text-[var(--app-text)]">{j.answer}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
