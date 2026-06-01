'use client'

import Link from 'next/link'
import { usePortfolioAnalyse } from '@/components/portfolio-analyse/pa-data-provider'
import { PaSubNav } from '@/components/portfolio-analyse/pa-ui'
import { PageChrome, PageHero, PageSection, PageSectionPanel } from '@/components/page-shell'
import { PORTFOLIO_MAX_BUCHUNGEN } from '@/lib/portfolio-analyse/limits'
import type { ReactNode } from 'react'

export function PortfolioAnalyseShell({
  children,
  title,
  description,
}: {
  children: ReactNode
  title: string
  description?: ReactNode
}) {
  const { schemaFehlt, dbFehler, buchungenLimit, hatDaten, laden } = usePortfolioAnalyse()

  return (
    <PageChrome density="compact" className="max-w-full overflow-x-hidden">
      <PageHero
        density="compact"
        eyebrow="Portfolioanalyse"
        title={title}
        description={
          description ?? (
            <>
              <span className="hidden sm:inline">
                Analysiere dein Portfolio, deine Aktivitäten und deine persönliche Investment-Strategie — lokal aus
                Parqet-CSV und Trade-Republic-Daten.
              </span>
              <span className="sm:hidden">Parqet-CSV &amp; Trade-Republic — lokal im Browser.</span>
            </>
          )
        }
      />

      <div className="mb-4 sm:mb-6">
        <PaSubNav />
      </div>

      {schemaFehlt ? (
        <PageSection titleId="pa-schema-heading" title="Datenbank">
          <PageSectionPanel>
            <p className="text-sm leading-relaxed text-amber-100/90">
              Tabellen oder Spalten fehlen — Migration im Supabase SQL-Editor oder{' '}
              <code className="rounded bg-zinc-950 px-1.5 py-0.5 font-mono text-xs text-teal-400">
                npm run db:portfolio-analyse
              </code>
              {' '}
              (Dateien unter <code className="font-mono text-xs text-zinc-400">supabase/migrations/</code>
              ).
            </p>
          </PageSectionPanel>
        </PageSection>
      ) : null}

      {dbFehler && !schemaFehlt ? (
        <PageSection titleId="pa-dbfehler-heading" title="Datenbank">
          <PageSectionPanel>
            <p className="text-sm text-red-200/90">{dbFehler}</p>
          </PageSectionPanel>
        </PageSection>
      ) : null}

      {buchungenLimit && !schemaFehlt ? (
        <PageSection titleId="pa-limit-heading" title="Hinweis">
          <PageSectionPanel>
            <p className="text-sm text-amber-100/90">
              Angezeigt werden höchstens {PORTFOLIO_MAX_BUCHUNGEN.toLocaleString('de-DE')} Buchungen (neueste zuerst).
            </p>
          </PageSectionPanel>
        </PageSection>
      ) : null}

      {!hatDaten && !laden && !schemaFehlt ? (
        <PageSection titleId="pa-leer-heading" title="Keine Daten">
          <PageSectionPanel>
            <p className="text-sm text-zinc-400">
              Importiere zuerst einen{' '}
              <Link href="/portfolioanalyse/import" className="text-teal-400 hover:underline">
                Parqet-CSV-Export
              </Link>{' '}
              oder optional einen Trade-Republic-PDF-Snapshot.
            </p>
          </PageSectionPanel>
        </PageSection>
      ) : null}

      {children}
    </PageChrome>
  )
}
