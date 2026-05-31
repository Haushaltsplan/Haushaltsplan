'use client'

import { supabase } from '@/lib/supabase'
import type { Session } from '@supabase/supabase-js'
import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || '').trim()

/** Optionale Dev-Zugangsdaten für automatisches Login auf localhost (nur lokal genutzt). */
const DEV_EMAIL = (process.env.NEXT_PUBLIC_DEV_EMAIL || '').trim()
const DEV_PASSWORD = (process.env.NEXT_PUBLIC_DEV_PASSWORD || '').trim()

function loginRedirectUrl(): string {
  if (APP_URL.startsWith('https://') || APP_URL.startsWith('http://')) {
    return APP_URL.replace(/\/+$/, '')
  }
  if (typeof window !== 'undefined') return window.location.origin
  return ''
}

/** Lokale Entwicklung (kein Login nötig). Die offizielle, deployte App verlangt weiterhin Login. */
function istLokaleEntwicklung(): boolean {
  if (typeof window === 'undefined') return false
  const host = window.location.hostname
  return host === 'localhost' || host === '127.0.0.1' || host === '::1' || host.endsWith('.local')
}

export function AuthGate({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    let mounted = true

    const init = async () => {
      const { data } = await supabase.auth.getSession()
      if (!mounted) return

      // Auf localhost ohne aktive Session: wenn Dev-Zugangsdaten hinterlegt sind, automatisch anmelden,
      // damit kein Passwort nötig ist UND die per RLS geschützten Daten (owner_user_id = auth.uid()) geladen werden.
      // Ohne Dev-Zugangsdaten zeigen wir den Login — sonst bliebe die App leer (RLS blockt unangemeldete Zugriffe).
      if (!data.session && istLokaleEntwicklung() && DEV_EMAIL && DEV_PASSWORD) {
        const { error } = await supabase.auth.signInWithPassword({ email: DEV_EMAIL, password: DEV_PASSWORD })
        if (error) {
          console.warn('[AuthGate] Dev-Auto-Login fehlgeschlagen:', error.message)
          if (mounted) setLoading(false)
          return
        }
        // onAuthStateChange setzt die Session; loading endet dort.
        return
      }

      setSession(data.session ?? null)
      setLoading(false)
    }

    void init()

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next ?? null)
      setLoading(false)
    })
    return () => {
      mounted = false
      sub.subscription.unsubscribe()
    }
  }, [])

  const sendMagicLink = async () => {
    const clean = email.trim()
    if (!clean) {
      toast.error('Bitte E-Mail eingeben.')
      return
    }
    setSending(true)
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: clean,
        options: { emailRedirectTo: loginRedirectUrl() },
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
