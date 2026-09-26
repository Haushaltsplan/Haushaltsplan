'use client'

/**
 * Magic-Link-Callback in der Omnia-App.
 * Wartet kurz auf Deep-Link-Parameter; leitet Android-Chrome an die App weiter,
 * ohne den Code im Browser zu verbrauchen.
 */

import { istCapacitorNative } from '@/lib/fitnessdaten/omnia-ble-shim'
import { istOmniaNativeApp } from '@/lib/fitnessdaten/omnia-native'
import { loginZielFuerRolle, omniaRolleAusUser, ownerEmailsPublic } from '@/lib/zugriff-rollen'
import { supabase } from '@/lib/supabase'
import type { EmailOtpType, Session } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'

const LS_LAST_EMAIL = 'omnia-auth-last-email'
const LS_DEVICE_TRUSTED = 'omnia-auth-device-trusted'
const SS_PENDING = 'omnia-pending-auth-url'

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
  if (url.searchParams.get('access_token') && url.searchParams.get('refresh_token')) return true
  const h = url.hash || ''
  return h.includes('access_token') || h.includes('code=') || h.includes('token_hash')
}

function mergePendingIntoLocation(): URL {
  const url = new URL(window.location.href)
  if (hatAuthPayload(url)) return url
  try {
    const pending = sessionStorage.getItem(SS_PENDING)
    if (!pending) return url
    const p = new URL(pending)
    p.searchParams.forEach((v, k) => {
      if (!url.searchParams.has(k)) url.searchParams.set(k, v)
    })
    if (!url.hash && p.hash) url.hash = p.hash
    sessionStorage.removeItem(SS_PENDING)
  } catch {
    /* ignore */
  }
  return url
}

function androidChromeZuOmnia(url: URL): boolean {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''
  const android = /Android/i.test(ua)
  const inApp = istOmniaNativeApp() || istCapacitorNative()
  if (!android || inApp) return false
  if (!hatAuthPayload(url)) return false

  const qs = url.search || ''
  // Kurzer Magic-Link-Code passt in Intents; JWTs nicht.
  const intent =
    `intent://auth/confirm${qs}` +
    '#Intent;scheme=de.omnia.haushalt;package=de.omnia.haushalt;end'
  window.location.replace(intent)
  return true
}

async function sessionAusUrl(url: URL): Promise<{ ok: true; session: Session | null } | { ok: false; message: string }> {
  const tokenHash = url.searchParams.get('token_hash')
  const typeRaw = url.searchParams.get('type')
  const code = url.searchParams.get('code')
  const access = url.searchParams.get('access_token')
  const refresh = url.searchParams.get('refresh_token')

  if (access && refresh) {
    const { data, error } = await supabase.auth.setSession({
      access_token: access,
      refresh_token: refresh,
    })
    if (error) return { ok: false, message: error.message }
    return { ok: true, session: data.session }
  }

  if (tokenHash && typeRaw) {
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: typeRaw as EmailOtpType,
    })
    if (error) return { ok: false, message: error.message }
    return { ok: true, session: data.session ?? null }
  }

  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) return { ok: false, message: error.message }
    return { ok: true, session: data.session }
  }

  if (url.hash.includes('access_token')) {
    const hash = new URLSearchParams(url.hash.replace(/^#/, ''))
    const a = hash.get('access_token')
    const r = hash.get('refresh_token')
    if (a && r) {
      const { data, error } = await supabase.auth.setSession({
        access_token: a,
        refresh_token: r,
      })
      if (error) return { ok: false, message: error.message }
      return { ok: true, session: data.session }
    }
  }

  return { ok: false, message: 'no-payload' }
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
        let url = new URL(window.location.href)

        if (androidChromeZuOmnia(url)) {
          if (cancelled) return
          setWarteAufApp(true)
          setStatus('Omnia-App wird geöffnet …')
          return
        }

        // Native: Deep-Link-Parameter können einen Moment später kommen
        const inApp = istOmniaNativeApp() || istCapacitorNative()
        if (inApp && !hatAuthPayload(url)) {
          setStatus('Warte auf Login-Daten …')
          const ende = Date.now() + 4000
          while (Date.now() < ende && !cancelled) {
            url = mergePendingIntoLocation()
            if (hatAuthPayload(url)) {
              window.history.replaceState(null, '', url.pathname + url.search + url.hash)
              break
            }
            await new Promise((r) => setTimeout(r, 200))
          }
        } else {
          url = mergePendingIntoLocation()
        }

        const result = await sessionAusUrl(url)
        if (result.ok) {
          speichereNachLogin(result.session?.user?.email)
          fertig(true, undefined, result.session)
          return
        }
        if (result.message !== 'no-payload') {
          fertig(false, result.message)
          return
        }

        const first = await supabase.auth.getSession()
        if (first.data.session) {
          speichereNachLogin(first.data.session.user.email)
          fertig(true, undefined, first.data.session)
          return
        }

        fertig(
          false,
          inApp
            ? 'Kein Login in der URL. Am besten: Browser → /auth/app-uebernehmen → Sitzungscode kopieren → hier in der App einfügen. Oder frischen Magic-Link tippen und „Omnia“ wählen.'
            : 'Kein gültiger Login-Link. Bitte den Link aus der aktuellen E-Mail erneut tippen.',
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
          Wenn Omnia nicht von selbst öffnet: „Mit Omnia öffnen“ wählen — nicht Chrome.
        </p>
      ) : null}
      {fehler && (
        <div className="mt-4 space-y-3">
          <p className="rounded-lg border border-rose-700/50 bg-rose-950/30 px-3 py-2 text-[13px] text-rose-200">
            {fehler}
          </p>
          <a
            href="/auth/app-uebernehmen"
            className="inline-block text-[13px] font-medium text-teal-400 underline-offset-2 hover:underline"
          >
            Sitzungscode erzeugen →
          </a>
          <a
            href="/"
            className="ml-3 inline-block text-[13px] font-medium text-teal-400 underline-offset-2 hover:underline"
          >
            Zur Anmeldung
          </a>
        </div>
      )}
    </div>
  )
}
