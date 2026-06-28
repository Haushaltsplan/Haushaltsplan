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

/** Erlaubte E-Mail(s) — nur diese Konten dürfen die App nutzen (leer = keine zusätzliche Einschränkung). */
const ALLOWED_EMAILS = (process.env.NEXT_PUBLIC_ALLOWED_EMAILS || '')
  .split(/[,;\s]+/)
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean)

function emailErlaubt(email: string | null | undefined): boolean {
  if (ALLOWED_EMAILS.length === 0) return true
  return ALLOWED_EMAILS.includes(String(email || '').toLowerCase())
}

function loginRedirectUrl(): string {
  if (APP_URL.startsWith('https://') || APP_URL.startsWith('http://')) {
    return APP_URL.replace(/\/+$/, '')
  }
  if (typeof window !== 'undefined') return window.location.origin
  return ''
}

export function AuthGate({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const oeffentlich = istOeffentlicheRoute(pathname)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [passwort, setPasswort] = useState('')
  const [sending, setSending] = useState(false)
  const [nativeApp] = useState(() => istOmniaNativeApp())
  const [loginModus, setLoginModus] = useState<'passwort' | 'magic'>(() =>
    istOmniaNativeApp() ? 'passwort' : 'magic',
  )
  const [verweigert, setVerweigert] = useState(false)

  const uebernehmeSession = (next: Session | null) => {
    if (next && !emailErlaubt(next.user?.email)) {
      setVerweigert(true)
      setSession(null)
      void supabase.auth.signOut()
      return
    }
    setVerweigert(false)
    setSession(next ?? null)
  }

  useEffect(() => {
    let mounted = true

    const init = async () => {
      const { data } = await supabase.auth.getSession()
      if (!mounted) return
      uebernehmeSession(data.session ?? null)
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

  const loginMitPasswort = async () => {
    const clean = email.trim()
    if (!clean || !passwort) {
      toast.error('E-Mail und Passwort eingeben.')
      return
    }
    if (!emailErlaubt(clean)) {
      toast.error('Diese E-Mail ist für diese App nicht freigeschaltet.')
      return
    }
    setSending(true)
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: clean,
        password: passwort,
      })
      if (error) {
        toast.error(error.message || 'Anmeldung fehlgeschlagen.')
        return
      }
      toast.success('Angemeldet.')
    } finally {
      setSending(false)
    }
  }

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
    setSending(true)
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: clean,
        options: { emailRedirectTo: loginRedirectUrl(), shouldCreateUser: false },
      })
      if (error) {
        toast.error(error.message || 'Login-Link konnte nicht gesendet werden.')
        return
      }
      toast.success('Login-Link gesendet. Bitte E-Mail öffnen.')
    } finally {
      setSending(false)
    }
  }

  if (loading) {
    return <div className="py-10 text-center text-sm text-[var(--app-text-muted)]">Anmeldung wird geprüft …</div>
  }

  if (!session) {
    return (
      <div className={`${appSectionCardClass} mx-auto mt-8 max-w-md`}>
        <h2 className="text-lg font-bold text-[var(--app-text)]">Anmeldung erforderlich</h2>
        <p className="mt-2 text-sm text-[var(--app-text-muted)]">
          Für Datenschutz: Zugriff nur nach Login.
          {nativeApp
            ? ' In der Omnia-App bitte mit Passwort anmelden — der E-Mail-Link öffnet sich sonst in Chrome und bleibt nicht in der App gespeichert.'
            : ' Auf dem Handy reicht das normalerweise einmal pro Gerät.'}
        </p>
        {verweigert && (
          <p className="mt-3 rounded-lg border border-rose-700/50 bg-rose-950/30 px-3 py-2 text-[13px] text-rose-200">
            Dieses Konto hat keinen Zugriff auf diese App.
          </p>
        )}
        {nativeApp && loginModus === 'passwort' && (
          <p className="mt-3 rounded-lg border border-amber-700/40 bg-amber-950/20 px-3 py-2 text-[13px] text-amber-100/90">
            Einmalig in Supabase ein Passwort setzen: Dashboard → Authentication → Users → dein
            Konto → Passwort vergeben. Danach hier anmelden — bleibt auf dem Handy gespeichert.
          </p>
        )}
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              if (loginModus === 'passwort') void loginMitPasswort()
              else void sendMagicLink()
            }
          }}
          placeholder="deine@email.de"
          autoComplete="email"
          className={`${appInputClass} mt-4 focus:ring-cyan-500/40`}
        />
        {loginModus === 'passwort' && (
          <input
            type="password"
            value={passwort}
            onChange={(e) => setPasswort(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void loginMitPasswort()
            }}
            placeholder="Passwort"
            autoComplete="current-password"
            className={`${appInputClass} mt-3 focus:ring-cyan-500/40`}
          />
        )}
        <button
          type="button"
          disabled={sending}
          onClick={() => void (loginModus === 'passwort' ? loginMitPasswort() : sendMagicLink())}
          className="mt-3 w-full rounded-xl bg-cyan-600 py-2.5 text-sm font-bold text-white hover:bg-cyan-500 disabled:opacity-40"
        >
          {sending ? 'Bitte warten …' : loginModus === 'passwort' ? 'Anmelden' : 'Login-Link senden'}
        </button>
        {nativeApp && (
          <button
            type="button"
            onClick={() => setLoginModus((m) => (m === 'passwort' ? 'magic' : 'passwort'))}
            className="mt-3 w-full text-center text-[13px] text-[var(--app-text-muted)] hover:text-[var(--app-text)]"
          >
            {loginModus === 'passwort' ? 'Stattdessen Login-Link per E-Mail' : 'Stattdessen mit Passwort anmelden'}
          </button>
        )}
      </div>
    )
  }

  return <>{children}</>
}
