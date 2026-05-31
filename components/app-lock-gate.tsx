'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import {
  APP_LOCK_CHANGED_EVENT,
  appLockAktiv,
  appLockHatBiometrie,
  appLockHatPin,
  entsperreMitBiometrie,
  pruefePin,
} from '@/lib/app-lock'

/** Nach so viel Zeit im Hintergrund wird beim Zurückkehren erneut gesperrt. */
const SPERRE_NACH_MS = 15000

export function AppLockGate({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false)
  const [aktiv, setAktiv] = useState(false)
  const [gesperrt, setGesperrt] = useState(false)
  const [pin, setPin] = useState('')
  const [fehler, setFehler] = useState('')
  const [biometrieLaeuft, setBiometrieLaeuft] = useState(false)
  const [pinModus, setPinModus] = useState(false)
  const verstecktSeit = useRef<number | null>(null)

  const syncStatus = useCallback(() => {
    const an = appLockAktiv()
    setAktiv(an)
    if (!an) setGesperrt(false)
  }, [])

  useEffect(() => {
    setMounted(true)
    const an = appLockAktiv()
    setAktiv(an)
    setGesperrt(an) // beim Öffnen sofort sperren, wenn aktiviert
  }, [])

  useEffect(() => {
    window.addEventListener(APP_LOCK_CHANGED_EVENT, syncStatus)
    return () => window.removeEventListener(APP_LOCK_CHANGED_EVENT, syncStatus)
  }, [syncStatus])

  // Beim App-/Tab-Wechsel merken; bei Rückkehr nach Schwelle erneut sperren.
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        verstecktSeit.current = Date.now()
      } else if (document.visibilityState === 'visible') {
        if (!appLockAktiv()) return
        const weg = verstecktSeit.current
        verstecktSeit.current = null
        if (weg != null && Date.now() - weg >= SPERRE_NACH_MS) {
          setGesperrt(true)
          setPinModus(false)
          setPin('')
          setFehler('')
        }
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  const biometrieEntsperren = useCallback(async () => {
    setFehler('')
    setBiometrieLaeuft(true)
    try {
      const r = await entsperreMitBiometrie()
      if (r.ok) {
        setGesperrt(false)
        setPin('')
      } else {
        setFehler(r.error || 'Entsperren fehlgeschlagen.')
        setPinModus(appLockHatPin())
      }
    } finally {
      setBiometrieLaeuft(false)
    }
  }, [])

  const pinEntsperren = useCallback(async () => {
    setFehler('')
    const ok = await pruefePin(pin)
    if (ok) {
      setGesperrt(false)
      setPin('')
    } else {
      setFehler('Falsche PIN.')
      setPin('')
    }
  }, [pin])

  // Biometrie beim Anzeigen der Sperre einmal automatisch anbieten (Tap startet sie sicher).
  const hatBiometrie = mounted && appLockHatBiometrie()
  const hatPin = mounted && appLockHatPin()

  const overlay =
    mounted && aktiv && gesperrt
      ? createPortal(
          <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-[#0b0d13] px-5 pt-[env(safe-area-inset-top,0px)] pb-[env(safe-area-inset-bottom,0px)]">
            <div className="w-full max-w-sm text-center">
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-800 text-3xl">
                🔒
              </div>
              <h1 className="text-lg font-bold text-slate-100">App gesperrt</h1>
              <p className="mt-1 text-sm text-slate-400">
                Bitte entsperren, um auf deine Daten zuzugreifen.
              </p>

              {fehler && (
                <p className="mt-4 rounded-lg border border-rose-700/50 bg-rose-950/30 px-3 py-2 text-[13px] text-rose-200">
                  {fehler}
                </p>
              )}

              {!pinModus && hatBiometrie && (
                <button
                  type="button"
                  disabled={biometrieLaeuft}
                  onClick={() => void biometrieEntsperren()}
                  className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-600 py-3 text-sm font-bold text-white transition hover:bg-cyan-500 disabled:opacity-50"
                >
                  <span aria-hidden>👆</span>
                  {biometrieLaeuft ? 'Warte auf Bestätigung …' : 'Mit Fingerabdruck entsperren'}
                </button>
              )}

              {(pinModus || !hatBiometrie) && hatPin && (
                <div className="mt-6 text-left">
                  <label className="text-[13px] font-medium text-slate-300">PIN eingeben</label>
                  <input
                    type="password"
                    inputMode="numeric"
                    autoComplete="off"
                    value={pin}
                    autoFocus
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 12))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void pinEntsperren()
                    }}
                    placeholder="••••"
                    className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-center text-lg tracking-[0.4em] text-slate-100 outline-none focus:ring-2 focus:ring-cyan-500/40"
                  />
                  <button
                    type="button"
                    onClick={() => void pinEntsperren()}
                    className="mt-3 w-full rounded-xl bg-cyan-600 py-3 text-sm font-bold text-white transition hover:bg-cyan-500"
                  >
                    Entsperren
                  </button>
                </div>
              )}

              {hatBiometrie && hatPin && (
                <button
                  type="button"
                  onClick={() => {
                    setFehler('')
                    setPinModus((v) => !v)
                  }}
                  className="mt-5 text-[13px] font-medium text-slate-400 underline-offset-2 hover:text-slate-200 hover:underline"
                >
                  {pinModus ? 'Stattdessen Fingerabdruck verwenden' : 'Stattdessen PIN verwenden'}
                </button>
              )}
            </div>
          </div>,
          document.body,
        )
      : null

  return (
    <>
      {children}
      {overlay}
    </>
  )
}
