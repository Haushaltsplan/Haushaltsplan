'use client'

import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import {
  APP_LOCK_CHANGED_EVENT,
  appLockAktiv,
  appLockHatBiometrie,
  appLockHatPin,
  entferneAppLock,
  entferneBiometrie,
  platformBiometrieVerfuegbar,
  registriereBiometrie,
  setzePin,
} from '@/lib/app-lock'

export function AppLockEinstellungen() {
  const [bereit, setBereit] = useState(false)
  const [aktiv, setAktiv] = useState(false)
  const [hatBio, setHatBio] = useState(false)
  const [hatPin, setHatPin] = useState(false)
  const [bioMoeglich, setBioMoeglich] = useState(false)

  const [pin1, setPin1] = useState('')
  const [pin2, setPin2] = useState('')
  const [speichert, setSpeichert] = useState(false)

  const sync = useCallback(() => {
    setAktiv(appLockAktiv())
    setHatBio(appLockHatBiometrie())
    setHatPin(appLockHatPin())
  }, [])

  useEffect(() => {
    setBereit(true)
    sync()
    void platformBiometrieVerfuegbar().then(setBioMoeglich)
    window.addEventListener(APP_LOCK_CHANGED_EVENT, sync)
    return () => window.removeEventListener(APP_LOCK_CHANGED_EVENT, sync)
  }, [sync])

  const pinSpeichern = useCallback(async () => {
    if (pin1.length < 4) {
      toast.error('PIN muss mindestens 4 Ziffern haben.')
      return
    }
    if (pin1 !== pin2) {
      toast.error('Die PINs stimmen nicht überein.')
      return
    }
    setSpeichert(true)
    try {
      await setzePin(pin1)
      setPin1('')
      setPin2('')
      toast.success('PIN gespeichert. App-Sperre ist aktiv.')
      sync()
    } catch {
      toast.error('PIN konnte nicht gespeichert werden.')
    } finally {
      setSpeichert(false)
    }
  }, [pin1, pin2, sync])

  const fingerHinzufuegen = useCallback(async () => {
    const r = await registriereBiometrie()
    if (r.ok) {
      toast.success('Fingerabdruck/Face-ID eingerichtet.')
      sync()
    } else {
      toast.error(r.error || 'Einrichtung fehlgeschlagen.')
    }
  }, [sync])

  const fingerEntfernen = useCallback(() => {
    entferneBiometrie()
    toast.success('Biometrie entfernt.')
    sync()
  }, [sync])

  const sperreDeaktivieren = useCallback(() => {
    if (!window.confirm('App-Sperre wirklich deaktivieren? Dann öffnet die App ohne Fingerabdruck/PIN.')) return
    entferneAppLock()
    toast.success('App-Sperre deaktiviert.')
    sync()
  }, [sync])

  if (!bereit) {
    return <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-muted)] p-5 text-sm text-[var(--app-text-muted)]">Laden …</div>
  }

  return (
    <section className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-muted)] p-5">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--app-surface-muted)] text-xl" aria-hidden>
          🔒
        </span>
        <div>
          <h2 className="text-base font-bold text-[var(--app-text)]">App-Sperre</h2>
          <p className="text-[13px] text-[var(--app-text-muted)]">
            Zusätzlicher Schutz beim Öffnen — per Fingerabdruck/Face-ID, PIN als Rückfall.
          </p>
        </div>
        <span
          className={`ml-auto rounded-full px-3 py-1 text-xs font-bold ${
            aktiv ? 'bg-emerald-900/40 text-emerald-300' : 'bg-[var(--app-surface-muted)] text-[var(--app-text-muted)]'
          }`}
        >
          {aktiv ? 'Aktiv' : 'Inaktiv'}
        </span>
      </div>

      {!aktiv && (
        <div className="mt-5 space-y-3">
          <p className="text-sm text-[var(--app-text)]">
            Lege zuerst eine <strong>PIN</strong> fest (immer als Rückfall nötig). Den Fingerabdruck kannst du danach hinzufügen.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              type="password"
              inputMode="numeric"
              value={pin1}
              onChange={(e) => setPin1(e.target.value.replace(/\D/g, '').slice(0, 12))}
              placeholder="PIN (mind. 4 Ziffern)"
              className="rounded-xl border border-[var(--app-border-strong)] bg-[var(--app-surface-muted)] px-3 py-2.5 text-sm text-[var(--app-text)] outline-none focus:ring-2 focus:ring-cyan-500/40"
            />
            <input
              type="password"
              inputMode="numeric"
              value={pin2}
              onChange={(e) => setPin2(e.target.value.replace(/\D/g, '').slice(0, 12))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void pinSpeichern()
              }}
              placeholder="PIN wiederholen"
              className="rounded-xl border border-[var(--app-border-strong)] bg-[var(--app-surface-muted)] px-3 py-2.5 text-sm text-[var(--app-text)] outline-none focus:ring-2 focus:ring-cyan-500/40"
            />
          </div>
          <button
            type="button"
            disabled={speichert}
            onClick={() => void pinSpeichern()}
            className="w-full rounded-xl bg-cyan-600 py-2.5 text-sm font-bold text-white transition hover:bg-cyan-500 disabled:opacity-50 sm:w-auto sm:px-6"
          >
            {speichert ? 'Speichere …' : 'Sperre aktivieren'}
          </button>
        </div>
      )}

      {aktiv && (
        <div className="mt-5 space-y-4">
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-3">
            <span className="text-xl" aria-hidden>👆</span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[var(--app-text)]">Fingerabdruck / Face-ID</p>
              <p className="text-[13px] text-[var(--app-text-muted)]">
                {hatBio ? 'Eingerichtet auf diesem Gerät.' : bioMoeglich ? 'Auf diesem Gerät möglich.' : 'Auf diesem Gerät nicht verfügbar.'}
              </p>
            </div>
            <div className="ml-auto">
              {hatBio ? (
                <button
                  type="button"
                  onClick={fingerEntfernen}
                  className="rounded-lg border border-[var(--app-border-strong)] px-3 py-2 text-[13px] font-medium text-[var(--app-text)] transition hover:bg-[var(--app-surface-hover)]"
                >
                  Entfernen
                </button>
              ) : (
                <button
                  type="button"
                  disabled={!bioMoeglich}
                  onClick={() => void fingerHinzufuegen()}
                  className="rounded-lg bg-cyan-600 px-3 py-2 text-[13px] font-bold text-white transition hover:bg-cyan-500 disabled:opacity-40"
                >
                  Hinzufügen
                </button>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-3">
            <p className="text-sm font-semibold text-[var(--app-text)]">PIN ändern</p>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              <input
                type="password"
                inputMode="numeric"
                value={pin1}
                onChange={(e) => setPin1(e.target.value.replace(/\D/g, '').slice(0, 12))}
                placeholder="Neue PIN"
                className="rounded-xl border border-[var(--app-border-strong)] bg-[var(--app-surface-muted)] px-3 py-2.5 text-sm text-[var(--app-text)] outline-none focus:ring-2 focus:ring-cyan-500/40"
              />
              <input
                type="password"
                inputMode="numeric"
                value={pin2}
                onChange={(e) => setPin2(e.target.value.replace(/\D/g, '').slice(0, 12))}
                placeholder="Neue PIN wiederholen"
                className="rounded-xl border border-[var(--app-border-strong)] bg-[var(--app-surface-muted)] px-3 py-2.5 text-sm text-[var(--app-text)] outline-none focus:ring-2 focus:ring-cyan-500/40"
              />
            </div>
            <button
              type="button"
              disabled={speichert}
              onClick={() => void pinSpeichern()}
              className="mt-3 rounded-lg border border-[var(--app-border-strong)] px-4 py-2 text-[13px] font-medium text-[var(--app-text)] transition hover:bg-[var(--app-surface-hover)] disabled:opacity-50"
            >
              PIN aktualisieren
            </button>
          </div>

          <button
            type="button"
            onClick={sperreDeaktivieren}
            className="text-[13px] font-medium text-rose-300 underline-offset-2 hover:text-rose-200 hover:underline"
          >
            App-Sperre deaktivieren
          </button>
        </div>
      )}

      <p className="mt-5 text-[12px] leading-relaxed text-[var(--app-text-muted)]">
        Hinweis: Die Sperre gilt pro Gerät/Browser. Auf einem neuen Gerät richtest du sie dort separat ein.
        Wer die Website-Daten löscht, muss sich anschließend ohnehin wieder per Login anmelden.
      </p>
    </section>
  )
}
