'use client'

import { istOeffentlicheRoute } from '@/lib/public-routes'
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
  const [sending, setSending] = useState(false)
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
    return <div className="py-10 text-center text-sm text-slate-400">Anmeldung wird geprüft …</div>
  }

  if (!session) {
    return (
      <div className="mx-auto mt-8 max-w-md rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl shadow-black/30">
        <h2 className="text-lg font-bold text-slate-100">Anmeldung erforderlich</h2>
        <p className="mt-2 text-sm text-slate-400">
          Für Datenschutz: Zugriff nur nach Login. Auf dem Handy reicht das normalerweise einmal pro Gerät.
        </p>
        {verweigert && (
          <p className="mt-3 rounded-lg border border-rose-700/50 bg-rose-950/30 px-3 py-2 text-[13px] text-rose-200">
            Dieses Konto hat keinen Zugriff auf diese App.
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
          className="mt-4 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-cyan-500/40"
        />
        <button
          type="button"
          disabled={sending}
          onClick={() => void sendMagicLink()}
          className="mt-3 w-full rounded-xl bg-cyan-600 py-2.5 text-sm font-bold text-white hover:bg-cyan-500 disabled:opacity-40"
        >
          {sending ? 'Sende …' : 'Login-Link senden'}
        </button>
      </div>
    )
  }

  return <>{children}</>
}
