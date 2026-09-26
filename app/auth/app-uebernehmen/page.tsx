'use client'

/**
 * Wenn Magic-Link-Limit greift: bestehende Browser-Session in die Omnia-App übernehmen.
 * Am PC/Handy-Chrome einmal eingeloggt → hier „In Omnia öffnen“.
 */

import { appSectionCardClass } from '@/lib/app-ui'
import { istOmniaNativeApp } from '@/lib/fitnessdaten/omnia-native'
import { supabase } from '@/lib/supabase'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'

export default function AuthAppUebernehmenPage() {
  const [ready, setReady] = useState(false)
  const [email, setEmail] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    void (async () => {
      const { data } = await supabase.auth.getSession()
      setEmail(data.session?.user?.email ?? null)
      setReady(true)
    })()
  }, [])

  const oeffneInOmnia = async () => {
    setBusy(true)
    try {
      const { data, error } = await supabase.auth.getSession()
      if (error || !data.session) {
        toast.error('Keine aktive Sitzung — zuerst im Browser anmelden.')
        return
      }
      const { access_token, refresh_token } = data.session
      // Query statt Hash — Android-Intents verlieren oft das #Fragment
      const qs = new URLSearchParams({
        access_token,
        refresh_token,
      }).toString()

      if (istOmniaNativeApp()) {
        window.location.replace(`/auth/session?${qs}`)
        return
      }

      const intent =
        `intent://auth/session?${qs}` +
        '#Intent;scheme=de.omnia.haushalt;package=de.omnia.haushalt;end'
      window.location.href = intent
      toast.success('Omnia sollte öffnen …')
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
        Wenn das Magic-Link-E-Mail-Limit greift: Hier die aktuelle Browser-Anmeldung ohne neue
        E-Mail in die App übernehmen.
      </p>
      {email ? (
        <>
          <p className="mt-3 text-sm text-teal-200/90">
            Angemeldet als <strong>{email}</strong>
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={() => void oeffneInOmnia()}
            className="mt-4 w-full rounded-xl bg-teal-600 py-2.5 text-sm font-bold text-white hover:bg-teal-500 disabled:opacity-40"
          >
            {busy ? 'Öffne …' : 'In Omnia-App öffnen'}
          </button>
          <p className="mt-3 text-[11px] leading-relaxed text-[var(--app-text-muted)]">
            Wenn nichts passiert: Link lange drücken → Mit Omnia öffnen. App muss installiert sein.
          </p>
        </>
      ) : (
        <p className="mt-4 rounded-lg border border-amber-700/40 bg-amber-950/25 px-3 py-2 text-[13px] text-amber-100/90">
          Du bist hier nicht angemeldet. Warte bis das Supabase-Limit vorbei ist (oft ca. 1 Stunde),
          logge dich einmal im Browser ein, dann diese Seite erneut öffnen.
        </p>
      )}
    </div>
  )
}
