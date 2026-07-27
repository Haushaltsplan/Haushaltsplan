'use client'

import { istOeffentlicheRoute } from '@/lib/public-routes'
import { appInputClass, appSectionCardClass } from '@/lib/app-ui'
import { istOmniaNativeApp } from '@/lib/fitnessdaten/omnia-native'
import { supabase } from '@/lib/supabase'
import type { Session } from '@supabase/supabase-js'
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || '').trim()
const LS_LAST_EMAIL = 'omnia-auth-last-email'
const LS_DEVICE_TRUSTED = 'omnia-auth-device-trusted'

/** Erlaubte E-Mail(s) — nur diese Konten dürfen die App nutzen (leer = keine zusätzliche Einschränkung). */
const ALLOWED_EMAILS = (process.env.NEXT_PUBLIC_ALLOWED_EMAILS || '')
  .split(/[,;\s]+/)
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean)

function emailErlaubt(email: string | null | undefined): boolean {
  if (ALLOWED_EMAILS.length === 0) return true
  if (!email) return true // noch keine E-Mail am Token → nicht vorschnell abmelden
  return ALLOWED_EMAILS.includes(String(email).toLowerCase())
}

function appOrigin(): string {
  if (APP_URL.startsWith('https://') || APP_URL.startsWith('http://')) {
    return APP_URL.replace(/\/+$/, '')
  }
  if (typeof window !== 'undefined') return window.location.origin
  return ''
}

/** Ziel nach Klick auf den Magic-Link — Session wird dort in localStorage geschrieben. */
function magicLinkRedirectUrl(): string {
  const origin = appOrigin()
  return origin ? `${origin}/auth/confirm` : ''
}

function leseGespeicherteEmail(): string {
  try {
    return typeof window !== 'undefined' ? window.localStorage.getItem(LS_LAST_EMAIL) || '' : ''
  } catch {
    return ''
  }
}

function speichereEmail(email: string) {
  try {
    if (typeof window !== 'undefined' && email) window.localStorage.setItem(LS_LAST_EMAIL, email)
  } catch {
    /* ignore */
  }
}

function markiereGeraetVertraut() {
  try {
    if (typeof window !== 'undefined') window.localStorage.setItem(LS_DEVICE_TRUSTED, '1')
  } catch {
    /* ignore */
  }
}

function geraetWarSchonAngemeldet(): boolean {
  try {
    return typeof window !== 'undefined' && window.localStorage.getItem(LS_DEVICE_TRUSTED) === '1'
  } catch {
    return false
  }
}

export function AuthGate({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const oeffentlich = istOeffentlicheRoute(pathname)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [nativeApp] = useState(() => istOmniaNativeApp())
  const [verweigert, setVerweigert] = useState(false)
  const [linkGesendet, setLinkGesendet] = useState(false)

  const uebernehmeSession = (next: Session | null) => {
    if (next) {
      const mail = next.user?.email
      if (mail && !emailErlaubt(mail)) {
        setVerweigert(true)
        setSession(null)
        void supabase.auth.signOut()
        return
      }
      setVerweigert(false)
      setSession(next)
      markiereGeraetVertraut()
      if (mail) speichereEmail(mail)
      return
    }
    setSession(null)
  }

  useEffect(() => {
    setEmail(leseGespeicherteEmail())
  }, [])

  useEffect(() => {
    let mounted = true

    const init = async () => {
      // URL-Callback (Hash/Query) zuerst von Supabase auswerten lassen
      let session: Session | null = (await supabase.auth.getSession()).data.session ?? null
      if (!session) {
        const refreshed = await supabase.auth.refreshSession()
        session = refreshed.data.session ?? null
      }
      if (!mounted) return
      uebernehmeSession(session)
      setLoading(false)
    }

    void init()

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      uebernehmeSession(next ?? null)
      setLoading(false)
    })
    return () => {
      mounted = false
      sub.subscription.unsubscribe()
    }
  }, [])

  if (oeffentlich) return <>{children}</>

  const sendMagicLink = async () => {
    const clean = email.trim()
    if (!clean) {
      toast.error('Bitte E-Mail eingeben.')
      return
    }
    if (!emailErlaubt(clean)) {
      toast.error('Diese E-Mail ist für diese App nicht freigeschaltet.')
      return
    }
    const redirectTo = magicLinkRedirectUrl()
    if (!redirectTo) {
      toast.error('Redirect-URL fehlt — Seite neu laden.')
      return
    }
    setSending(true)
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: clean,
        options: { emailRedirectTo: redirectTo, shouldCreateUser: false },
      })
      if (error) {
        toast.error(error.message || 'Login-Link konnte nicht gesendet werden.')
        return
      }
      speichereEmail(clean)
      setLinkGesendet(true)
      toast.success('Login-Link gesendet. Bitte denselben Browser öffnen.')
    } finally {
      setSending(false)
    }
  }

  if (loading) {
    return <div className="py-10 text-center text-sm text-[var(--app-text-muted)]">Anmeldung wird geprüft …</div>
  }

  if (!session) {
    const schonVertraut = geraetWarSchonAngemeldet()
    return (
      <div className={`${appSectionCardClass} mx-auto mt-8 max-w-md`}>
        <h2 className="text-lg font-bold text-[var(--app-text)]">Anmeldung erforderlich</h2>
        <p className="mt-2 text-sm text-[var(--app-text-muted)]">
          {schonVertraut
            ? 'Die gespeicherte Sitzung ist abgelaufen oder wurde gelöscht. Einmalig erneut per Magic-Link anmelden — danach bleibt dieses Gerät wieder angemeldet.'
            : 'Einmal E-Mail eingeben, Magic-Link bestätigen — danach bleibt dieses Gerät angemeldet (Session im Browser).'}
          {nativeApp
            ? ' Wichtig in der Omnia-App: den Link so öffnen, dass er in der App landet (nicht nur in Chrome), sonst speichert Chrome die Sitzung statt der App.'
            : null}
        </p>
        {verweigert && (
          <p className="mt-3 rounded-lg border border-rose-700/50 bg-rose-950/30 px-3 py-2 text-[13px] text-rose-200">
            Dieses Konto hat keinen Zugriff auf diese App.
          </p>
        )}
        {linkGesendet && (
          <p className="mt-3 rounded-lg border border-teal-700/40 bg-teal-950/20 px-3 py-2 text-[13px] text-teal-100/90">
            Link unterwegs. Im <strong className="font-semibold">gleichen Browser</strong> auf den
            Link tippen — danach wirst du nicht mehr nach der E-Mail gefragt.
          </p>
        )}
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void sendMagicLink()
          }}
          placeholder="deine@email.de"
          autoComplete="email"
          className={`${appInputClass} mt-4 focus:ring-cyan-500/40`}
        />
        <button
          type="button"
          disabled={sending}
          onClick={() => void sendMagicLink()}
          className="mt-3 w-full rounded-[0.875rem] bg-gradient-to-b from-teal-500 to-teal-600 py-2.5 text-sm font-bold text-white shadow-md shadow-teal-950/25 ring-1 ring-white/10 transition hover:from-teal-400 hover:to-teal-500 disabled:opacity-40"
        >
          {sending ? 'Bitte warten …' : 'Login-Link senden'}
        </button>
      </div>
    )
  }

  return <>{children}</>
}
