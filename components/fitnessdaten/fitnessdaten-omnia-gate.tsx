'use client'

import { PageChrome } from '@/components/page-shell'
import { istOmniaHaushaltApp, istOmniaWhoopApp } from '@/lib/omnia-native/omnia-native'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

/**
 * In der Omnia-Haushalt-App ist /fitnessdaten gesperrt.
 * Erlaubt: Omnia Whoop App + normaler Browser (Dev).
 */
export function FitnessdatenOmniaGate({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [blocked, setBlocked] = useState<boolean | null>(null)

  useEffect(() => {
    const haushalt = istOmniaHaushaltApp()
    const whoop = istOmniaWhoopApp()
    if (haushalt && !whoop) {
      setBlocked(true)
      return
    }
    setBlocked(false)
  }, [])

  useEffect(() => {
    if (blocked !== true) return
    const t = window.setTimeout(() => router.replace('/'), 4000)
    return () => window.clearTimeout(t)
  }, [blocked, router])

  if (blocked === null) {
    return (
      <div className="mx-auto flex min-h-[30vh] max-w-lg items-center justify-center px-4">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-teal-400/30 border-t-teal-400" />
      </div>
    )
  }

  if (blocked) {
    return (
      <PageChrome density="compact" className="mx-auto max-w-lg space-y-4 py-10">
        <h1 className="text-xl font-semibold text-[var(--app-text)]">Whoop ist umgezogen</h1>
        <p className="text-sm leading-relaxed text-[var(--app-text-muted)]">
          Fitness und Band-Verbindung laufen nur noch in der App <strong className="text-[var(--app-text)]">Omnia Whoop</strong>.
          In Omnia (Haushalt) gibt es keinen Whoop-Tracker mehr.
        </p>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/auth/app-uebernehmen"
            className="inline-flex rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white"
          >
            Anmeldung an Whoop senden
          </Link>
          <Link
            href="/"
            className="inline-flex rounded-xl bg-white/[0.08] px-4 py-2.5 text-sm font-semibold text-white ring-1 ring-white/[0.08]"
          >
            Zur Startseite
          </Link>
        </div>
      </PageChrome>
    )
  }

  return <>{children}</>
}
