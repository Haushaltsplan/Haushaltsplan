'use client'

import { istOeffentlicheRoute } from '@/lib/public-routes'
import { appInputClass, appSectionCardClass } from '@/lib/app-ui'
import { istOmniaNativeApp } from '@/lib/fitnessdaten/omnia-native'
import { supabase } from '@/lib/supabase'
import { setzeClientZugriff } from '@/lib/zugriff-client'
import { omniaRolleAusUser, ownerEmailsPublic } from '@/lib/zugriff-rollen'
import type { Session } from '@supabase/supabase-js'
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || '').trim()
const LS_LAST_EMAIL = 'omnia-auth-last-email'
const LS_DEVICE_TRUSTED = 'omnia-auth-device-trusted'
const LS_OTP_COOLDOWN_UNTIL = 'omnia-auth-otp-cooldown-until'
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

function appOrigin(): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin.replace(/\/+$/, '')
  }
  if (APP_URL.startsWith('https://') || APP_URL.startsWith('http://')) {
    return APP_URL.replace(/\/+$/, '')
  }
  return ''
}

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
  const [cooldownSec, setCooldownSec] = useState(0)

  const uebernehmeSession = (next: Session | null) => {
    if (next) {
      const rolle = omniaRolleAusUser(next.user, ownerEmailsPublic())
      if (rolle === 'none') {
        setzeClientZugriff({ userId: null, rolle: 'none' })
        setVerweigert(true)
        setSession(null)
        void supabase.auth.signOut()
        return
      }
      setzeClientZugriff({ userId: next.user.id, rolle })
      setVerweigert(false)
      setSession(next)
      markiereGeraetVertraut()
      const mail = next.user?.email
      if (mail) speichereEmail(mail)
      return
    }
    setzeClientZugriff({ userId: null, rolle: 'none' })
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
      try {
        const { sichereSpeicherplatzFuerAuth } = await import('@/lib/local-storage-safe')
        sichereSpeicherplatzFuerAuth()
      } catch {
        /* ignore */
      }
      // getSession wartet auf IndexedDB-Storage (async)
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

  const sendMagicLink = async () => {
    const clean = email.trim()
    if (!clean) {
      toast.error('Bitte E-Mail eingeben.')
      return
    }
    if (cooldownSec > 0) {
      toast.error(`Bitte noch ${cooldownSec}s warten (E-Mail-Limit).`)
      return
    }
    const redirectTo = magicLinkRedirectUrl()
    if (!redirectTo) {
      toast.error('Seite neu laden und erneut versuchen.')
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
          toast.error('E-Mail-Limit erreicht. Bitte später erneut den Link anfordern.')
          return
        }
        toast.error(msg)
        return
      }
      speichereEmail(clean)
      setLinkGesendet(true)
      setzeCooldown(COOLDOWN_NACH_SEND_MS)
      setCooldownSec(Math.ceil(COOLDOWN_NACH_SEND_MS / 1000))
      toast.success('Login-Link gesendet — im gleichen Browser öffnen.')
    } finally {
      setSending(false)
    }
  }

  if (loading) {
    return (
      <div className="py-10 text-center text-sm text-[var(--app-text-muted)]">
        Gerät wird erkannt …
      </div>
    )
  }

  if (!session) {
    const schonVertraut = geraetWarSchonAngemeldet()
    return (
      <div className={`${appSectionCardClass} mx-auto mt-8 max-w-md`}>
        <h2 className="text-lg font-bold text-[var(--app-text)]">Anmeldung erforderlich</h2>
        <p className="mt-2 text-sm text-[var(--app-text-muted)]">
          {schonVertraut
            ? 'Die Sitzung auf diesem Gerät ist weg. Einmalig den Magic-Link bestätigen — danach merkt sich dieses Gerät dich wieder dauerhaft.'
            : 'Einmal E-Mail eingeben und Magic-Link bestätigen. Danach bleibt dieses Gerät angemeldet — ohne erneute Anmeldung.'}
          {nativeApp
            ? ' In der Omnia-App den Link so öffnen, dass er in der App landet.'
            : null}
        </p>
        {verweigert && (
          <p className="mt-3 rounded-lg border border-rose-700/50 bg-rose-950/30 px-3 py-2 text-[13px] text-rose-200">
            Dieses Konto hat keinen Zugriff auf diese App.
          </p>
        )}
        {linkGesendet && (
          <p className="mt-3 rounded-lg border border-teal-700/40 bg-teal-950/20 px-3 py-2 text-[13px] text-teal-100/90">
            Link unterwegs. Im <strong className="font-semibold">gleichen Browser</strong> tippen —
            fertig. Danach kein erneutes Anmelden auf diesem Gerät.
          </p>
        )}
        {cooldownSec > 0 && (
          <p className="mt-3 rounded-lg border border-amber-700/40 bg-amber-950/20 px-3 py-2 text-[13px] text-amber-100/90">
            Nächster Link in {Math.floor(cooldownSec / 60)}:
            {String(cooldownSec % 60).padStart(2, '0')} Min. (Supabase E-Mail-Limit).
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
          disabled={sending || cooldownSec > 0}
          onClick={() => void sendMagicLink()}
          className="mt-3 w-full rounded-[0.875rem] bg-gradient-to-b from-teal-500 to-teal-600 py-2.5 text-sm font-bold text-white shadow-md shadow-teal-950/25 ring-1 ring-white/10 transition hover:from-teal-400 hover:to-teal-500 disabled:opacity-40"
        >
          {sending
            ? 'Bitte warten …'
            : cooldownSec > 0
              ? `Warten (${cooldownSec}s)`
              : 'Login-Link senden'}
        </button>
      </div>
    )
  }

  return <>{children}</>
}
