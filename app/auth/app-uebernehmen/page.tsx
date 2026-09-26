'use client'

/**
 * Wenn Magic-Link-Limit greift: Browser-Sitzung als kopierbaren Code für die Omnia-App.
 * (Android-Intents sind für JWTs zu kurz / unzuverlässig.)
 */

import { appInputClass, appSectionCardClass } from '@/lib/app-ui'
import { encodeOmniaSessionCode } from '@/lib/fitnessdaten/omnia-session-code'
import { supabase } from '@/lib/supabase'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'

export default function AuthAppUebernehmenPage() {
  const [ready, setReady] = useState(false)
  const [email, setEmail] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    void (async () => {
      const { data } = await supabase.auth.getSession()
      setEmail(data.session?.user?.email ?? null)
      setReady(true)
    })()
  }, [])

  const erstelleCode = async () => {
    setBusy(true)
    try {
      const { data, error } = await supabase.auth.getSession()
      if (error || !data.session) {
        toast.error('Keine aktive Sitzung — zuerst im Browser anmelden.')
        return
      }
      const next = encodeOmniaSessionCode({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      })
      setCode(next)
      try {
        await navigator.clipboard.writeText(next)
        toast.success('Code kopiert — jetzt Omnia-App öffnen und einfügen.')
      } catch {
        toast.success('Code erzeugt — kopieren und in der Omnia-App einfügen.')
      }
    } finally {
      setBusy(false)
    }
  }

  if (!ready) {
    return (
      <div className="py-16 text-center text-sm text-[var(--app-text-muted)]">Prüfe Sitzung …</div>
    )
  }

  return (
    <div className={`${appSectionCardClass} mx-auto mt-10 max-w-md`}>
      <h1 className="text-lg font-bold text-[var(--app-text)]">Sitzung in Omnia-App</h1>
      <p className="mt-2 text-sm leading-relaxed text-[var(--app-text-muted)]">
        Ohne neue E-Mail: Hier einen Code erzeugen, in der <strong>Omnia-App</strong> unter Anmeldung
        einfügen.
      </p>
      {email ? (
        <>
          <p className="mt-3 text-sm text-teal-200/90">
            Angemeldet als <strong>{email}</strong>
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={() => void erstelleCode()}
            className="mt-4 w-full rounded-xl bg-teal-600 py-2.5 text-sm font-bold text-white hover:bg-teal-500 disabled:opacity-40"
          >
            {busy ? 'Erzeuge …' : 'Sitzungscode kopieren'}
          </button>
          {code ? (
            <textarea
              readOnly
              value={code}
              className={`${appInputClass} mt-3 min-h-[7rem] break-all font-mono text-[10px]`}
              onFocus={(e) => e.currentTarget.select()}
            />
          ) : null}
          <ol className="mt-4 list-decimal space-y-1.5 pl-4 text-[12px] leading-relaxed text-[var(--app-text-muted)]">
            <li>„Sitzungscode kopieren“ tippen</li>
            <li>Omnia-App öffnen (nicht Chrome)</li>
            <li>Bei Anmeldung: Code einfügen → „Sitzung übernehmen“</li>
          </ol>
        </>
      ) : (
        <p className="mt-4 rounded-lg border border-amber-700/40 bg-amber-950/25 px-3 py-2 text-[13px] text-amber-100/90">
          Du bist im Browser nicht angemeldet. Warte auf das E-Mail-Limit (~1 Std.), logge dich{' '}
          <strong>einmal im Browser</strong> ein (Link in Chrome öffnen), dann diese Seite erneut.
        </p>
      )}
    </div>
  )
}
