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
const LS_OTP_COOLDOWN_UNTIL = 'omnia-auth-otp-cooldown-until'
/** Nach Rate-Limit länger warten (Supabase Free-SMTP ist oft ~stündlich begrenzt). */
const COOLDOWN_NACH_SEND_MS = 60_000
const COOLDOWN_NACH_RATE_LIMIT_MS = 15 * 60_000

function istRateLimitFehler(message: string): boolean {
  return /rate.?limit|too many|zu viele/i.test(message)
}

function leseCooldownUntil(): number {
  try {
    const raw = typeof window !== 'undefined' ? window.localStorage.getItem(LS_OTP_COOLDOWN_UNTIL) : null
    const n = raw ? Number(raw) : 0
    return Number.isFinite(n) ? n : 0
  } catch {
    return 0
  }
}

function setzeCooldown(ms: number) {
  try {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(LS_OTP_COOLDOWN_UNTIL, String(Date.now() + ms))
  } catch {
    /* ignore */
  }
}

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
  // Immer die aktuelle Origin — sonst landet der Magic-Link auf einer anderen URL
  // (z. B. falsches NEXT_PUBLIC_APP_URL) und die Session ist „weg“.
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin.replace(/\/+$/, '')
  }
  if (APP_URL.startsWith('https://') || APP_URL.startsWith('http://')) {
    return APP_URL.replace(/\/+$/, '')
  }
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
  const [passwort, setPasswort] = useState('')
  const [sending, setSending] = useState(false)
  const [nativeApp] = useState(() => istOmniaNativeApp())
  const [verweigert, setVerweigert] = useState(false)
  const [linkGesendet, setLinkGesendet] = useState(false)
  const [zeigePasswort, setZeigePasswort] = useState(true)
  const [cooldownSec, setCooldownSec] = useState(0)

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
    const tick = () => {
      const left = Math.max(0, Math.ceil((leseCooldownUntil() - Date.now()) / 1000))
      setCooldownSec(left)
    }
    tick()
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    let mounted = true

    const init = async () => {
      // Nur getSession — refreshSession ohne Session kann Magic-Link-Tokens in der URL stören.
      const session: Session | null = (await supabase.auth.getSession()).data.session ?? null
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
      speichereEmail(clean)
      markiereGeraetVertraut()
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
    if (cooldownSec > 0) {
      toast.error(`Bitte noch ${cooldownSec}s warten (E-Mail-Limit).`)
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
        const msg = error.message || 'Login-Link konnte nicht gesendet werden.'
        if (istRateLimitFehler(msg)) {
          setzeCooldown(COOLDOWN_NACH_RATE_LIMIT_MS)
          setCooldownSec(Math.ceil(COOLDOWN_NACH_RATE_LIMIT_MS / 1000))
          setZeigePasswort(true)
          toast.error(
            'E-Mail-Limit erreicht (Supabase). Ca. 15 Min. warten — oder unten mit Passwort anmelden.',
          )
          return
        }
        toast.error(msg)
        return
      }
      speichereEmail(clean)
      setLinkGesendet(true)
      setzeCooldown(COOLDOWN_NACH_SEND_MS)
      setCooldownSec(Math.ceil(COOLDOWN_NACH_SEND_MS / 1000))
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
        {cooldownSec > 0 && (
          <p className="mt-3 rounded-lg border border-amber-700/40 bg-amber-950/20 px-3 py-2 text-[13px] text-amber-100/90">
            Nächster Magic-Link erst in {Math.floor(cooldownSec / 60)}:
            {String(cooldownSec % 60).padStart(2, '0')} Min. möglich (Supabase E-Mail-Limit).
          </p>
        )}
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              if (zeigePasswort) void loginMitPasswort()
              else void sendMagicLink()
            }
          }}
          placeholder="deine@email.de"
          autoComplete="email"
          className={`${appInputClass} mt-4 focus:ring-cyan-500/40`}
        />
        {zeigePasswort && (
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
          disabled={sending || (!zeigePasswort && cooldownSec > 0)}
          onClick={() => void (zeigePasswort ? loginMitPasswort() : sendMagicLink())}
          className="mt-3 w-full rounded-[0.875rem] bg-gradient-to-b from-teal-500 to-teal-600 py-2.5 text-sm font-bold text-white shadow-md shadow-teal-950/25 ring-1 ring-white/10 transition hover:from-teal-400 hover:to-teal-500 disabled:opacity-40"
        >
          {sending
            ? 'Bitte warten …'
            : zeigePasswort
              ? 'Mit Passwort anmelden'
              : cooldownSec > 0
                ? `Warten (${cooldownSec}s)`
                : 'Login-Link senden'}
        </button>
        <button
          type="button"
          onClick={() => setZeigePasswort((v) => !v)}
          className="mt-3 w-full text-center text-[13px] text-[var(--app-text-muted)] hover:text-[var(--app-text)]"
        >
          {zeigePasswort
            ? 'Stattdessen Magic-Link per E-Mail'
            : 'Stattdessen mit Passwort anmelden (wenn Limit greift)'}
        </button>
        {zeigePasswort && (
          <p className="mt-2 text-[12px] text-[var(--app-text-muted)]">
            Passwort einmalig in Supabase setzen: Authentication → Users → dein Konto → Set
            password.
          </p>
        )}
      </div>
    )
  }

  return <>{children}</>
}
