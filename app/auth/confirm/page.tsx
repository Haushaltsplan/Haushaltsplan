'use client'

/**
 * Magic-Link-Callback.
 * Auf Android außerhalb der Omnia-App: Code NICHT verbrauchen, sondern an die App
 * weiterreichen (Chrome-Session ≠ App-Session). In der App: Session tauschen.
 */

import { istCapacitorNative } from '@/lib/fitnessdaten/omnia-ble-shim'
import { istOmniaNativeApp } from '@/lib/fitnessdaten/omnia-native'
import { loginZielFuerRolle, omniaRolleAusUser, ownerEmailsPublic } from '@/lib/zugriff-rollen'
import { supabase } from '@/lib/supabase'
import type { EmailOtpType, Session } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'

const LS_LAST_EMAIL = 'omnia-auth-last-email'
const LS_DEVICE_TRUSTED = 'omnia-auth-device-trusted'

function speichereNachLogin(email: string | null | undefined) {
  try {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(LS_DEVICE_TRUSTED, '1')
    if (email) window.localStorage.setItem(LS_LAST_EMAIL, email)
  } catch {
    /* ignore */
  }
}

function hatAuthPayload(url: URL): boolean {
  if (url.searchParams.get('code')) return true
  if (url.searchParams.get('token_hash')) return true
  const h = url.hash || ''
  return h.includes('access_token') || h.includes('code=')
}

function androidChromeZuOmnia(url: URL): boolean {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''
  const android = /Android/i.test(ua)
  const inApp = istOmniaNativeApp() || istCapacitorNative()
  if (!android || inApp) return false
  if (!hatAuthPayload(url)) return false

  const qs = url.search || ''
  const hash = url.hash || ''
  // Intent öffnet die installierte Omnia-App und übergibt Query/Hash unverbraucht.
  const intent =
    `intent://auth/confirm${qs}${hash}` +
    '#Intent;scheme=de.omnia.haushalt;package=de.omnia.haushalt;end'
  window.location.replace(intent)
  return true
}

export default function AuthConfirmPage() {
  const [status, setStatus] = useState('Anmeldung wird abgeschlossen …')
  const [fehler, setFehler] = useState<string | null>(null)
  const [warteAufApp, setWarteAufApp] = useState(false)

  useEffect(() => {
    let cancelled = false

    const fertig = (ok: boolean, message?: string, session?: Session | null) => {
      if (cancelled) return
      if (!ok) {
        setFehler(message || 'Anmeldung fehlgeschlagen.')
        setStatus('Login fehlgeschlagen')
        return
      }
      setStatus('Angemeldet — Sitzung gespeichert. Weiterleitung …')
      const ziel = loginZielFuerRolle(omniaRolleAusUser(session?.user, ownerEmailsPublic()))
      window.location.replace(ziel)
    }

    const run = async () => {
      try {
        const url = new URL(window.location.href)

        if (androidChromeZuOmnia(url)) {
          if (cancelled) return
          setWarteAufApp(true)
          setStatus('Omnia-App wird geöffnet …')
          return
        }

        const tokenHash = url.searchParams.get('token_hash')
        const typeRaw = url.searchParams.get('type')
        const code = url.searchParams.get('code')

        if (tokenHash && typeRaw) {
          const { data, error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: typeRaw as EmailOtpType,
          })
          if (error) {
            fertig(false, error.message)
            return
          }
          speichereNachLogin(data.session?.user?.email ?? data.user?.email)
          fertig(true, undefined, data.session ?? null)
          return
        }

        if (code) {
          const { data, error } = await supabase.auth.exchangeCodeForSession(code)
          if (error) {
            fertig(false, error.message)
            return
          }
          speichereNachLogin(data.session?.user?.email)
          fertig(true, undefined, data.session)
          return
        }

        const warteAufSession = async (): Promise<Session | null> => {
          const first = await supabase.auth.getSession()
          if (first.data.session) return first.data.session
          return await new Promise((resolve) => {
            const timer = window.setTimeout(() => {
              sub.subscription.unsubscribe()
              void supabase.auth.getSession().then(({ data }) => resolve(data.session ?? null))
            }, 2500)
            const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
              if (event === 'SIGNED_IN' || next) {
                window.clearTimeout(timer)
                sub.subscription.unsubscribe()
                resolve(next ?? null)
              }
            })
          })
        }

        const session = await warteAufSession()
        if (session) {
          speichereNachLogin(session.user?.email)
          fertig(true, undefined, session)
          return
        }

        fertig(
          false,
          'Kein gültiger Login-Link. Bitte den Link aus der aktuellen E-Mail erneut tippen.',
        )
      } catch (e) {
        fertig(false, e instanceof Error ? e.message : 'Unbekannter Fehler')
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="mx-auto mt-16 max-w-md px-4 text-center">
      <p className="text-sm text-[var(--app-text-muted)]">{status}</p>
      {warteAufApp ? (
        <p className="mt-4 text-[13px] leading-relaxed text-[var(--app-text-muted)]">
          Wenn Omnia nicht von selbst öffnet: oben „Mit Omnia öffnen“ wählen — nicht Chrome.
        </p>
      ) : null}
      {fehler && (
        <div className="mt-4 space-y-3">
          <p className="rounded-lg border border-rose-700/50 bg-rose-950/30 px-3 py-2 text-[13px] text-rose-200">
            {fehler}
          </p>
          <a
            href="/"
            className="inline-block text-[13px] font-medium text-teal-400 underline-offset-2 hover:underline"
          >
            Zurück zur Anmeldung
          </a>
        </div>
      )}
    </div>
  )
}
