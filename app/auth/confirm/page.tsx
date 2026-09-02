'use client'

/**
 * Magic-Link-Callback: wandelt token_hash / code / URL-Hash in eine
 * lokale Supabase-Session um (localStorage) und leitet zur App weiter.
 * Ohne diese Seite landet der Mail-Link oft „irgendwo“ — ohne dauerhafte Sitzung.
 */

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

export default function AuthConfirmPage() {
  const [status, setStatus] = useState('Anmeldung wird abgeschlossen …')
  const [fehler, setFehler] = useState<string | null>(null)

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

        // Implicit flow: Tokens im Hash — kurz auf Session warten (detectSessionInUrl).
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
          'Kein gültiger Login-Link. Bitte den Link aus der aktuellen E-Mail verwenden (gleicher Browser).',
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
