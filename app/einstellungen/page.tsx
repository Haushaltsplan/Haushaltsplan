import type { Metadata } from 'next'
import Link from 'next/link'
import { AppLockEinstellungen } from '@/components/app-lock-einstellungen'
import { PageChrome, PageHero, PageSection, PageSectionPanel } from '@/components/page-shell'

export const metadata: Metadata = {
  title: 'Einstellungen',
}

export default function EinstellungenPage() {
  return (
    <PageChrome density="compact" className="max-w-2xl">
      <PageHero
        density="compact"
        eyebrow="Omnia"
        title="Einstellungen"
        description="Sicherheit, App-Sperre und rechtliche Hinweise."
      />

      <PageSection titleId="einstellungen-sicherheit" title="Sicherheit">
        <PageSectionPanel density="compact">
          <AppLockEinstellungen />
        </PageSectionPanel>
      </PageSection>

      <PageSection titleId="einstellungen-rechtliches" title="Rechtliches">
        <PageSectionPanel density="compact">
          <p className="text-sm leading-relaxed text-[var(--app-text-muted)]">
            Datenschutzerklärung für Omnia — wird u. a. beim WHOOP-OAuth angezeigt.
          </p>
          <Link
            href="/datenschutz"
            className="mt-4 inline-flex text-sm font-medium text-teal-600 underline-offset-2 hover:underline dark:text-teal-400"
          >
            Datenschutzerklärung öffnen →
          </Link>
        </PageSectionPanel>
      </PageSection>
    </PageChrome>
  )
}
