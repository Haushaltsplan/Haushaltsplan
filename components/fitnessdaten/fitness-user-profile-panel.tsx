'use client'

import { ladeFitnessHistory, speichereFitnessHistory } from '@/lib/fitnessdaten/history-storage'
import {
  ladeFitnessProfil,
  profilAlter,
  profilBmi,
  profilMaxHr,
  speichereFitnessProfil,
  wendeProfilAufHistory,
  type FitnessGender,
  type FitnessUserProfile,
} from '@/lib/fitnessdaten/user-profile'
import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'

type Props = {
  onSaved?: () => void
  embedded?: boolean
}

const GENDER_OPTIONS: { value: FitnessGender; label: string }[] = [
  { value: 'male', label: 'Männlich' },
  { value: 'female', label: 'Weiblich' },
  { value: 'diverse', label: 'Divers / neutral' },
]

export function FitnessUserProfilePanel({ onSaved, embedded = false }: Props) {
  const [profile, setProfile] = useState<FitnessUserProfile>(() => ladeFitnessProfil())
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    setProfile(ladeFitnessProfil())
  }, [])

  const setField = useCallback(<K extends keyof FitnessUserProfile>(key: K, value: FitnessUserProfile[K]) => {
    setProfile((p) => ({ ...p, [key]: value }))
    setDirty(true)
  }, [])

  const speichern = useCallback(() => {
    speichereFitnessProfil(profile)
    const history = ladeFitnessHistory()
    wendeProfilAufHistory(history, profile)
    speichereFitnessHistory(history)
    setDirty(false)
    toast.success('Profil gespeichert.')
    onSaved?.()
  }, [profile, onSaved])

  const alter = profilAlter(profile)
  const bmi = profilBmi(profile)
  const maxHr = profilMaxHr(profile)
  const jahrJetzt = new Date().getFullYear()

  return (
    <div
      className={`rounded-2xl border border-white/[0.08] bg-[#111113] ${embedded ? 'p-4' : 'p-5'}`}
    >
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--app-text)]">Dein Profil</p>
      <p className="mt-2 text-xs leading-relaxed text-[var(--app-text-muted)]">
        Für Kalorienschätzung, HF-Zonen, Strain und Omnia Age. Alles bleibt lokal auf dem Gerät.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--app-text-muted)]">Geburtsjahr</span>
          <input
            type="number"
            min={1920}
            max={jahrJetzt}
            placeholder={`z. B. ${jahrJetzt - 30}`}
            value={profile.birthYear ?? ''}
            onChange={(e) => setField('birthYear', e.target.value ? Number(e.target.value) : null)}
            className="mt-1 w-full rounded-xl border border-white/[0.08] bg-black/30 px-3 py-2.5 text-sm text-[var(--app-text)] outline-none focus:border-sky-500/40"
          />
          <span className="mt-1 block text-[10px] text-[var(--app-text-muted)]">Alter: {alter} Jahre</span>
        </label>

        <label className="block">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--app-text-muted)]">Geschlecht</span>
          <select
            value={profile.gender ?? ''}
            onChange={(e) => setField('gender', (e.target.value || null) as FitnessGender | null)}
            className="mt-1 w-full rounded-xl border border-white/[0.08] bg-black/30 px-3 py-2.5 text-sm text-[var(--app-text)] outline-none focus:border-sky-500/40"
          >
            <option value="">— wählen —</option>
            {GENDER_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-[10px] text-[var(--app-text-muted)]">Beeinflusst Kalorienformel</span>
        </label>

        <label className="block">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--app-text-muted)]">Größe (cm)</span>
          <input
            type="number"
            min={100}
            max={250}
            placeholder="175"
            value={profile.heightCm ?? ''}
            onChange={(e) => setField('heightCm', e.target.value ? Number(e.target.value) : null)}
            className="mt-1 w-full rounded-xl border border-white/[0.08] bg-black/30 px-3 py-2.5 text-sm text-[var(--app-text)] outline-none focus:border-sky-500/40"
          />
        </label>

        <label className="block">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--app-text-muted)]">Gewicht (kg)</span>
          <input
            type="number"
            min={30}
            max={300}
            step={0.1}
            placeholder="75"
            value={profile.weightKg ?? ''}
            onChange={(e) => setField('weightKg', e.target.value ? Number(e.target.value) : null)}
            className="mt-1 w-full rounded-xl border border-white/[0.08] bg-black/30 px-3 py-2.5 text-sm text-[var(--app-text)] outline-none focus:border-sky-500/40"
          />
          {bmi != null ? (
            <span className="mt-1 block text-[10px] text-[var(--app-text-muted)]">BMI: {bmi.toFixed(1).replace('.', ',')}</span>
          ) : null}
        </label>

        <label className="block sm:col-span-2">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--app-text-muted)]">
            Max. Herzfrequenz (optional)
          </span>
          <input
            type="number"
            min={100}
            max={230}
            placeholder={`Standard: ${maxHr} (220 − Alter)`}
            value={profile.maxHrOverride ?? ''}
            onChange={(e) => setField('maxHrOverride', e.target.value ? Number(e.target.value) : null)}
            className="mt-1 w-full rounded-xl border border-white/[0.08] bg-black/30 px-3 py-2.5 text-sm text-[var(--app-text)] outline-none focus:border-sky-500/40"
          />
          <span className="mt-1 block text-[10px] text-[var(--app-text-muted)]">Aktiv für Zonen & Strain: {maxHr} bpm</span>
        </label>
      </div>

      <button
        type="button"
        onClick={speichern}
        disabled={!dirty}
        className="mt-4 w-full rounded-xl border border-emerald-500/30 bg-emerald-950/30 py-3 text-sm font-semibold text-emerald-200 transition hover:bg-emerald-950/50 disabled:opacity-40"
      >
        Profil speichern
      </button>
    </div>
  )
}
