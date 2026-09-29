'use client'

import Link from 'next/link'
import { istOmniaHaushaltApp } from '@/lib/omnia-native/omnia-native'
import { useEffect, useState } from 'react'

/** Nur in Omnia-Haushalt: einmalige Sitzungs-Übergabe an die separate Whoop-App. */
export function OmniaWhoopLoginHinweis() {
  const [zeigen, setZeigen] = useState(false)

  useEffect(() => {
    setZeigen(istOmniaHaushaltApp())
  }, [])

  if (!zeigen) return null

  return (
    <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-3">
      <p className="text-sm font-semibold text-[var(--app-text)]">Omnia Whoop anmelden</p>
      <p className="mt-1 text-[12px] leading-relaxed text-[var(--app-text-muted)]">
        Whoop ist eine eigene App ohne Haushalt-Menü. Sitzungscode einmalig übernehmen — ohne neue E-Mail.
      </p>
      <Link
        href="/auth/app-uebernehmen"
        className="mt-2.5 inline-flex rounded-xl bg-teal-600/90 px-3.5 py-2 text-[13px] font-bold text-white hover:bg-teal-500"
      >
        Sitzung an Omnia Whoop
      </Link>
    </div>
  )
}
