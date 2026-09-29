'use client'

import { OmniaWhoopLoginHinweis } from '@/components/omnia-whoop-login-hinweis'
import { PageSection, PageSectionPanel } from '@/components/page-shell'
import { istOmniaHaushaltApp } from '@/lib/omnia-native/omnia-native'
import { useEffect, useState } from 'react'

/** Einstellungen-Abschnitt nur in der Omnia-Haushalt-App. */
export function EinstellungenWhoopSection() {
  const [zeigen, setZeigen] = useState(false)
  useEffect(() => {
    setZeigen(istOmniaHaushaltApp())
  }, [])
  if (!zeigen) return null
  return (
    <PageSection titleId="einstellungen-whoop" title="Omnia Whoop">
      <PageSectionPanel density="compact">
        <OmniaWhoopLoginHinweis />
      </PageSectionPanel>
    </PageSection>
  )
}
