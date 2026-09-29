'use client'

/**
 * Übernimmt access/refresh Token aus Deep-Link oder Hash in die App-Session
 * (ohne neuen Magic-Link / ohne E-Mail).
 */

import { istOmniaNativeApp, istOmniaWhoopApp } from '@/lib/omnia-native/omnia-native'
import { decodeOmniaSessionCode } from '@/lib/omnia-native/omnia-session-code'
import { supabase } from '@/lib/supabase'
import { loginZielFuerRolle, omniaRolleAusUser, ownerEmailsPublic } from '@/lib/zugriff-rollen'
import { useEffect, useState } from 'react'

function tokensAusUrl(): { access_token: string; refresh_token: string } | null {
  try {
    const url = new URL(window.location.href)
    const code =
      url.searchParams.get('omnia_code') || url.searchParams.get('code') || ''
    if (code.startsWith('omnia1.')) {
      const decoded = decodeOmniaSessionCode(code)
      if (decoded) return decoded
    }

    let access = url.searchParams.get('access_token')
    let refresh = url.searchParams.get('refresh_token')

    if ((!access || !refresh) && url.hash.length > 1) {
      const hash = new URLSearchParams(url.hash.replace(/^#/, ''))
      access = access || hash.get('access_token')
      refresh = refresh || hash.get('refresh_token')
      const hashCode = hash.get('omnia_code') || hash.get('code') || ''
      if ((!access || !refresh) && hashCode.startsWith('omnia1.')) {
        const decoded = decodeOmniaSessionCode(hashCode)
        if (decoded) return decoded
      }
    }

    if (access && refresh) return { access_token: access, refresh_token: refresh }
  } catch {
    /* ignore */
  }
  return null
}

function zielNachLogin(rolle: ReturnType<typeof omniaRolleAusUser>): string {
  if (istOmniaWhoopApp()) return '/fitnessdaten'
  return loginZielFuerRolle(rolle)
}

export default function AuthSessionPage() {
  const [status, setStatus] = useState('Sitzung wird übernommen …')
  const [fehler, setFehler] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const tokens = tokensAusUrl()
      if (!tokens) {
        setFehler('Keine Sitzungsdaten in der URL. Bitte erneut „In Omnia öffnen“ tippen.')
        setStatus('Fehlgeschlagen')
        return
      }
      const { data, error } = await supabase.auth.setSession({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
      })
      if (cancelled) return
      if (error || !data.session) {
        setFehler(error?.message || 'Sitzung ungültig oder abgelaufen.')
        setStatus('Fehlgeschlagen')
        return
      }
      try {
        window.localStorage.setItem('omnia-auth-device-trusted', '1')
        const mail = data.session.user.email
        if (mail) window.localStorage.setItem('omnia-auth-last-email', mail)
      } catch {
        /* ignore */
      }
      setStatus('Angemeldet — weiter …')
      const ziel = zielNachLogin(omniaRolleAusUser(data.session.user, ownerEmailsPublic()))
      // Hash aus Adresszeile entfernen
      window.history.replaceState(null, '', '/auth/session')
      window.location.replace(ziel)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="mx-auto mt-16 max-w-md px-4 text-center">
      <p className="text-sm text-[var(--app-text-muted)]">{status}</p>
      {istOmniaNativeApp() ? null : (
        <p className="mt-2 text-[12px] text-[var(--app-text-muted)]">
          Diese Seite ist für die Omnia-App gedacht.
        </p>
      )}
      {fehler ? (
        <p className="mt-4 rounded-lg border border-rose-700/50 bg-rose-950/30 px-3 py-2 text-[13px] text-rose-200">
          {fehler}
        </p>
      ) : null}
    </div>
  )
}
