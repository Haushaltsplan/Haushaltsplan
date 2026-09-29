'use client'

/**
 * Sitzungscode: Browser → Omnia, oder Omnia-Haushalt → Omnia Whoop.
 * Tokens nicht per Intent (zu lang) — Zwischenablage + Whoop öffnen.
 */

import { appInputClass, appSectionCardClass } from '@/lib/app-ui'
import { istOmniaHaushaltApp, istOmniaWhoopApp } from '@/lib/omnia-native/omnia-native'
import { encodeOmniaSessionCode } from '@/lib/omnia-native/omnia-session-code'
import { oeffneOmniaWhoopApp } from '@/lib/omnia-native/omnia-whoop-oeffnen'
import { supabase } from '@/lib/supabase'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'

export default function AuthAppUebernehmenPage() {
  const [ready, setReady] = useState(false)
  const [email, setEmail] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [haushaltApp, setHaushaltApp] = useState(false)
  const [whoopApp, setWhoopApp] = useState(false)

  useEffect(() => {
    setHaushaltApp(istOmniaHaushaltApp())
    setWhoopApp(istOmniaWhoopApp())
    void (async () => {
      const { data } = await supabase.auth.getSession()
      setEmail(data.session?.user?.email ?? null)
      setReady(true)
    })()
  }, [])

  const erstelleCode = async (): Promise<string | null> => {
    const { data, error } = await supabase.auth.getSession()
    if (error || !data.session) {
      toast.error('Keine aktive Sitzung — zuerst anmelden.')
      return null
    }
    const next = encodeOmniaSessionCode({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    })
    setCode(next)
    try {
      await navigator.clipboard.writeText(next)
    } catch {
      /* Nutzer kann manuell kopieren */
    }
    return next
  }

  const fuerBeliebigeApp = async () => {
    setBusy(true)
    try {
      const next = await erstelleCode()
      if (!next) return
      toast.success(
        haushaltApp
          ? 'Code kopiert — Omnia Whoop öffnen und unter Anmeldung einfügen.'
          : 'Code kopiert — jetzt die App öffnen und einfügen.',
      )
    } finally {
      setBusy(false)
    }
  }

  const anWhoopUebergeben = async () => {
    setBusy(true)
    try {
      const next = await erstelleCode()
      if (!next) return
      toast.success('Code kopiert — öffne Omnia Whoop …', { duration: 4000 })
      await oeffneOmniaWhoopApp()
    } finally {
      setBusy(false)
    }
  }

  if (!ready) {
    return (
      <div className="py-16 text-center text-sm text-[var(--app-text-muted)]">Prüfe Sitzung …</div>
    )
  }

  if (whoopApp) {
    return (
      <div className={`${appSectionCardClass} mx-auto mt-10 max-w-md`}>
        <h1 className="text-lg font-bold text-[var(--app-text)]">Du bist in Omnia Whoop</h1>
        <p className="mt-2 text-sm leading-relaxed text-[var(--app-text-muted)]">
          Hier brauchst du keinen Code zum Erzeugen. Stattdessen in der{' '}
          <strong>Omnia</strong>-App (Haushalt) unter „Sitzung an Whoop“ den Code holen und hier
          unter Anmeldung einfügen — oder den 6-stelligen E-Mail-Code nutzen.
        </p>
      </div>
    )
  }

  return (
    <div className={`${appSectionCardClass} mx-auto mt-10 max-w-md`}>
      <h1 className="text-lg font-bold text-[var(--app-text)]">
        {haushaltApp ? 'Sitzung an Omnia Whoop' : 'Sitzung in Omnia-App'}
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-[var(--app-text-muted)]">
        {haushaltApp
          ? 'Omnia und Omnia Whoop speichern die Anmeldung getrennt. Ein Tipp kopiert deine Sitzung und öffnet Whoop — dort „Sitzung übernehmen“ tippen (Zwischenablage).'
          : (
            <>
              Ohne neue E-Mail: Hier einen Code erzeugen, in der <strong>Omnia</strong>- oder{' '}
              <strong>Omnia Whoop</strong>-App unter Anmeldung einfügen.
            </>
          )}
      </p>
      {email ? (
        <>
          <p className="mt-3 text-sm text-teal-200/90">
            Angemeldet als <strong>{email}</strong>
          </p>
          {haushaltApp ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void anWhoopUebergeben()}
              className="mt-4 w-full rounded-xl bg-teal-600 py-2.5 text-sm font-bold text-white hover:bg-teal-500 disabled:opacity-40"
            >
              {busy ? 'Erzeuge …' : 'Code kopieren & Omnia Whoop öffnen'}
            </button>
          ) : null}
          <button
            type="button"
            disabled={busy}
            onClick={() => void fuerBeliebigeApp()}
            className={`mt-3 w-full rounded-xl py-2.5 text-sm font-bold disabled:opacity-40 ${
              haushaltApp
                ? 'border border-teal-500/40 bg-teal-950/40 text-teal-100 hover:bg-teal-900/50'
                : 'bg-teal-600 text-white hover:bg-teal-500'
            }`}
          >
            {busy ? 'Erzeuge …' : 'Nur Sitzungscode kopieren'}
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
            {haushaltApp ? (
              <>
                <li>„Code kopieren & Omnia Whoop öffnen“ tippen</li>
                <li>In Whoop bei Anmeldung: „Aus Zwischenablage“ oder Code einfügen</li>
                <li>„Sitzung übernehmen“ tippen</li>
              </>
            ) : (
              <>
                <li>„Sitzungscode kopieren“ tippen</li>
                <li>Omnia- oder Omnia-Whoop-App öffnen (nicht Chrome)</li>
                <li>Bei Anmeldung: Code einfügen → „Sitzung übernehmen“</li>
              </>
            )}
          </ol>
        </>
      ) : (
        <p className="mt-4 rounded-lg border border-amber-700/40 bg-amber-950/25 px-3 py-2 text-[13px] text-amber-100/90">
          Keine Sitzung. Zuerst in dieser App / im Browser anmelden, dann diese Seite erneut öffnen.
        </p>
      )}
    </div>
  )
}
