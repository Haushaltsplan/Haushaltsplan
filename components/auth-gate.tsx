'use client'

import { istOeffentlicheRoute } from '@/lib/public-routes'
import { appInputClass, appSectionCardClass } from '@/lib/app-ui'
import { decodeOmniaSessionCode } from '@/lib/fitnessdaten/omnia-session-code'
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
/** Supabase Free-Tier E-Mail-Limit ist oft ~1 Stunde, nicht 15 Min. */
const COOLDOWN_NACH_RATE_LIMIT_MS = 60 * 60_000

function istRateLimitFehler(message: string): boolean {
  return /rate.?limit|too many|zu viele|email.?rate|over_email/i.test(message)
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

function loescheLokalenCooldown() {
  try {
    if (typeof window === 'undefined') return
    window.localStorage.removeItem(LS_OTP_COOLDOWN_UNTIL)
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
  const [otpCode, setOtpCode] = useState('')
  const [sessionCode, setSessionCode] = useState('')
  const [sending, setSending] = useState(false)
  const [verifying, setVerifying] = useState(false)
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
          toast.error(
            'Supabase E-Mail-Limit — oft erst nach ~1 Stunde wieder. Sitzung vom Browser übernehmen, falls dort noch eingeloggt.',
            { duration: 8000 },
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
      toast.success(
        nativeApp
          ? 'Link gesendet — in der Mail tippen und Omnia öffnen (nicht Chrome).'
          : 'Login-Link gesendet — im gleichen Browser öffnen.',
      )
    } finally {
      setSending(false)
    }
  }

  const uebernehmeSessionCode = async () => {
    const payload = decodeOmniaSessionCode(sessionCode)
    if (!payload) {
      toast.error('Ungültiger Sitzungscode. Bitte neu kopieren von /auth/app-uebernehmen.')
      return
    }
    setVerifying(true)
    try {
      const { data, error } = await supabase.auth.setSession({
        access_token: payload.access_token,
        refresh_token: payload.refresh_token,
      })
      if (error || !data.session) {
        toast.error(error?.message || 'Sitzung ungültig.')
        return
      }
      uebernehmeSession(data.session)
      toast.success('Angemeldet')
    } finally {
      setVerifying(false)
    }
  }

  const verifyOtpCode = async () => {
    const clean = email.trim()
    const token = otpCode.replace(/\s/g, '')
    if (!clean) {
      toast.error('Bitte E-Mail eingeben.')
      return
    }
    if (!/^\d{6,8}$/.test(token)) {
      toast.error('Bitte den 6-stelligen Code aus der E-Mail eingeben.')
      return
    }
    setVerifying(true)
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email: clean,
        token,
        type: 'email',
      })
      if (error) {
        const second = await supabase.auth.verifyOtp({
          email: clean,
          token,
          type: 'magiclink',
        })
        if (second.error) {
          toast.error(error.message || 'Code ungültig oder abgelaufen.')
          return
        }
        uebernehmeSession(second.data.session ?? null)
        toast.success('Angemeldet')
        return
      }
      uebernehmeSession(data.session ?? null)
      toast.success('Angemeldet')
    } finally {
      setVerifying(false)
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
          {nativeApp
            ? 'Login-Link senden, dann in der E-Mail den Link tippen und „Omnia“ wählen (nicht Chrome). Die Anmeldung landet in der App.'
            : schonVertraut
              ? 'Die Sitzung auf diesem Gerät ist weg. Einmalig den Magic-Link bestätigen — danach merkt sich dieses Gerät dich wieder dauerhaft.'
              : 'Einmal E-Mail eingeben und Magic-Link bestätigen. Danach bleibt dieses Gerät angemeldet.'}
        </p>
        {verweigert && (
          <p className="mt-3 rounded-lg border border-rose-700/50 bg-rose-950/30 px-3 py-2 text-[13px] text-rose-200">
            Dieses Konto hat keinen Zugriff auf diese App.
          </p>
        )}
        {linkGesendet && (
          <p className="mt-3 rounded-lg border border-teal-700/40 bg-teal-950/20 px-3 py-2 text-[13px] text-teal-100/90">
            {nativeApp
              ? 'E-Mail ist unterwegs. Link tippen → Omnia öffnen (nicht Chrome). Es gibt keinen Extra-Code — der Link reicht.'
              : 'Link unterwegs. Im gleichen Browser tippen — fertig.'}
          </p>
        )}
        {cooldownSec > 0 && (
          <div className="mt-3 space-y-2 rounded-lg border border-amber-700/40 bg-amber-950/20 px-3 py-2 text-[13px] text-amber-100/90">
            <p>
              Nächster E-Mail-Versuch in ca. {Math.floor(cooldownSec / 60)}:
              {String(cooldownSec % 60).padStart(2, '0')} Min. (Supabase-Limit, oft 1 Stunde).
            </p>
            <button
              type="button"
              className="text-[12px] font-semibold underline underline-offset-2"
              onClick={() => {
                loescheLokalenCooldown()
                setCooldownSec(0)
                toast.success('Lokale Wartezeit gelöscht — Supabase kann trotzdem noch blocken.')
              }}
            >
              Nur lokale Wartezeit zurücksetzen
            </button>
          </div>
        )}

        <div className="mt-3 rounded-lg border border-teal-800/40 bg-teal-950/20 px-3 py-2 text-[13px] leading-relaxed text-teal-100/90">
          <strong className="font-semibold">Ohne neue E-Mail (empfohlen):</strong>
          <ol className="mt-1 list-decimal space-y-1 pl-4">
            <li>
              Im Browser (PC/Chrome) anmelden →{' '}
              <a href="/auth/app-uebernehmen" className="font-semibold underline underline-offset-2">
                Sitzungscode kopieren
              </a>
            </li>
            <li>Hier in der App einfügen → „Sitzung übernehmen“</li>
          </ol>
        </div>

        <div className="mt-4 space-y-2">
          <label className="block text-xs font-semibold text-[var(--app-text-muted)]">
            Sitzungscode einfügen
          </label>
          <textarea
            value={sessionCode}
            onChange={(e) => setSessionCode(e.target.value)}
            placeholder="omnia1.…"
            className={`${appInputClass} min-h-[5.5rem] break-all font-mono text-[10px] focus:ring-cyan-500/40`}
          />
          <button
            type="button"
            disabled={verifying || !sessionCode.trim().startsWith('omnia1.')}
            onClick={() => void uebernehmeSessionCode()}
            className="w-full rounded-[0.875rem] border border-teal-500/40 bg-teal-950/40 py-2.5 text-sm font-bold text-teal-100 transition hover:bg-teal-900/50 disabled:opacity-40"
          >
            {verifying ? 'Übernehme …' : 'Sitzung übernehmen'}
          </button>
        </div>

        <p className="mt-5 text-center text-[11px] text-[var(--app-text-muted)]">— oder Magic-Link —</p>

        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void sendMagicLink()
          }}
          placeholder="deine@email.de"
          autoComplete="email"
          className={`${appInputClass} mt-3 focus:ring-cyan-500/40`}
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
              ? `Warten (${Math.ceil(cooldownSec / 60)} Min.)`
              : 'Login-Link senden'}
        </button>

        {linkGesendet && !nativeApp ? (
          <div className="mt-4 space-y-2 border-t border-white/10 pt-4">
            <label className="block text-xs font-semibold text-[var(--app-text-muted)]">
              Optional: Code aus der E-Mail (falls vorhanden)
            </label>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value.replace(/[^\d]/g, '').slice(0, 8))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void verifyOtpCode()
              }}
              placeholder="123456"
              className={`${appInputClass} tracking-[0.35em] focus:ring-cyan-500/40`}
            />
            <button
              type="button"
              disabled={verifying || otpCode.replace(/\s/g, '').length < 6}
              onClick={() => void verifyOtpCode()}
              className="w-full rounded-[0.875rem] border border-teal-500/40 bg-teal-950/40 py-2.5 text-sm font-bold text-teal-100 transition hover:bg-teal-900/50 disabled:opacity-40"
            >
              {verifying ? 'Prüfe …' : 'Mit Code anmelden'}
            </button>
          </div>
        ) : null}
      </div>
    )
  }

  return <>{children}</>
}
