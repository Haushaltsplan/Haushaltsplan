'use client'

import Link from 'next/link'
import { istOmniaHaushaltApp } from '@/lib/omnia-native/omnia-native'
import { useEffect, useState } from 'react'

/** Hinweis in Omnia-Haushalt: Whoop-App braucht eigene Anmeldung. */
export function OmniaWhoopLoginHinweis() {
  const [zeigen, setZeigen] = useState(false)

  useEffect(() => {
    setZeigen(istOmniaHaushaltApp())
  }, [])

  if (!zeigen) return null

  return (
    <div className="mx-4 mb-3 rounded-2xl border border-emerald-500/25 bg-emerald-950/30 px-4 py-3 sm:mx-5">
      <p className="text-sm font-semibold text-emerald-100">Omnia Whoop — eigene Anmeldung</p>
      <p className="mt-1 text-[12px] leading-relaxed text-emerald-100/75">
        Die Whoop-App speichert die Sitzung getrennt. Einmal Sitzungscode aus Omnia übernehmen.
      </p>
      <Link
        href="/auth/app-uebernehmen"
        className="mt-2.5 inline-flex rounded-xl bg-emerald-600/90 px-3.5 py-2 text-[13px] font-bold text-white hover:bg-emerald-500"
      >
        An Omnia Whoop übergeben
      </Link>
    </div>
  )
}
