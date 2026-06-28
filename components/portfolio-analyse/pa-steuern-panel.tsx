'use client'

import { appTableScrollClassName } from '@/components/page-shell'
import { useEffect, useMemo, useState } from 'react'
import { formatEur } from '@/lib/portfolio-analyse/berechnung'
import { ermittlePortfolioBuchungSpalten } from '@/lib/portfolio-analyse/portfolio-analyse-db'
import {
  quellensteuerProJahr,
  steuernProJahr,
  type SteuerJahrZeile,
  verfuegbareSteuerJahre,
} from '@/lib/portfolio-analyse/steuern-auswertung'
import type { PortfolioBuchung } from '@/lib/portfolio-analyse/types'
import { PaCard } from '@/components/portfolio-analyse/pa-ui'

function SteuerZelle({ wert }: { wert: number }) {
  return (
    <td className="px-3 py-2.5 text-right tabular-nums text-[var(--app-text)]">
      {formatEur(wert)}
    </td>
  )
}

function SteuernProJahrTabelle({ zeilen }: { zeilen: SteuerJahrZeile[] }) {
  if (zeilen.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-[var(--app-text-muted)]">
        Keine Steuerdaten — Parqet-CSV erneut importieren (Spalte „tax“).
      </p>
    )
  }

  return (
    <div className={appTableScrollClassName}>
      <table className="app-data-table w-full min-w-[640px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-[var(--app-border)] text-xs text-[var(--app-text-muted)]">
            <th className="py-2 pr-4 text-left font-medium">Jahr</th>
            <th className="px-3 py-2 text-right font-medium">Kauf</th>
            <th className="px-3 py-2 text-right font-medium">Verkauf</th>
            <th className="px-3 py-2 text-right font-medium">Dividende</th>
            <th className="px-3 py-2 text-right font-medium">Sonstige</th>
            <th className="px-3 py-2 text-right font-medium">Summe</th>
          </tr>
        </thead>
        <tbody>
          {zeilen.map((z) => (
            <tr key={z.jahr} className="border-b border-[var(--app-border)]/50">
              <td className="py-2.5 pr-4 font-medium text-[var(--app-text)]">{z.jahr}</td>
              <SteuerZelle wert={z.kaufEur} />
              <SteuerZelle wert={z.verkaufEur} />
              <SteuerZelle wert={z.dividendeEur} />
              <SteuerZelle wert={z.sonstigeEur} />
              <td className="px-3 py-2.5 text-right tabular-nums font-medium text-[var(--app-text)]">
                {formatEur(z.summeEur)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function JahrNav({
  jahr,
  jahre,
  onChange,
}: {
  jahr: number
  jahre: number[]
  onChange: (j: number) => void
}) {
  const idx = jahre.indexOf(jahr)
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        disabled={idx >= jahre.length - 1}
        onClick={() => onChange(jahre[idx + 1]!)}
        className="rounded-lg border border-[var(--app-border)] px-2 py-1 text-[var(--app-text-muted)] hover:text-[var(--app-text)] disabled:opacity-30"
        aria-label="Vorheriges Jahr"
      >
        ‹
      </button>
      <span className="min-w-[3rem] text-center text-sm font-medium tabular-nums text-[var(--app-text)]">
        {jahr}
      </span>
      <button
        type="button"
        disabled={idx <= 0}
        onClick={() => onChange(jahre[idx - 1]!)}
        className="rounded-lg border border-[var(--app-border)] px-2 py-1 text-[var(--app-text-muted)] hover:text-[var(--app-text)] disabled:opacity-30"
        aria-label="Nächstes Jahr"
      >
        ›
      </button>
    </div>
  )
}

function QuellensteuerTabelle({
  buchungen,
  jahr,
}: {
  buchungen: PortfolioBuchung[]
  jahr: number
}) {
  const zeilen = useMemo(() => quellensteuerProJahr(buchungen, jahr), [buchungen, jahr])

  if (zeilen.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-[var(--app-text-muted)]">
        Keine ausländischen Dividenden mit Quellensteuer in {jahr}.
      </p>
    )
  }

  return (
    <div className={appTableScrollClassName}>
      <table className="app-data-table w-full min-w-[560px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-[var(--app-border)] text-xs text-[var(--app-text-muted)]">
            <th className="py-2 pr-4 text-left font-medium">Land</th>
            <th className="px-3 py-2 text-right font-medium">Erhaltene Dividenden</th>
            <th className="px-3 py-2 text-right font-medium">Gezahlte Steuern</th>
            <th className="px-3 py-2 text-right font-medium">Rückerstattung</th>
          </tr>
        </thead>
        <tbody>
          {zeilen.map((z) => (
            <tr key={z.landCode} className="border-b border-[var(--app-border)]/50">
              <td className="py-2.5 pr-4 text-[var(--app-text)]">
                <span className="mr-2" aria-hidden>
                  {z.flag}
                </span>
                {z.landName}
              </td>
              <SteuerZelle wert={z.dividendenBruttoEur} />
              <SteuerZelle wert={z.steuernGezahltEur} />
              <td className="px-3 py-2.5 text-right tabular-nums text-[var(--app-text)]">
                {formatEur(z.rueckerstattungEur)}
                {z.rueckerstattungProzent != null ? (
                  <span className="ml-1 text-xs text-[var(--app-text-muted)]">
                    ({z.rueckerstattungProzent.toLocaleString('de-DE', { maximumFractionDigits: 1 })}%)
                  </span>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function PaSteuernPanel({ buchungen }: { buchungen: PortfolioBuchung[] }) {
  const jahresZeilen = useMemo(() => steuernProJahr(buchungen), [buchungen])
  const steuerJahre = useMemo(() => verfuegbareSteuerJahre(buchungen), [buchungen])
  const [quellenJahr, setQuellenJahr] = useState(() => steuerJahre[0] ?? new Date().getFullYear())
  const [steuerSpalteFehlt, setSteuerSpalteFehlt] = useState<boolean | null>(null)

  useEffect(() => {
    let aktiv = true
    void ermittlePortfolioBuchungSpalten(true).then((spalten) => {
      if (aktiv) setSteuerSpalteFehlt(!spalten.steuerEur)
    })
    return () => {
      aktiv = false
    }
  }, [buchungen.length])

  const quellenJahre =
    steuerJahre.length > 0 ? steuerJahre : [new Date().getFullYear()]
  const aktivesQuellenJahr = quellenJahre.includes(quellenJahr)
    ? quellenJahr
    : quellenJahre[0]!

  return (
    <div className="space-y-8">
      {steuerSpalteFehlt ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-100/90">
          Die Spalte <strong className="font-medium">steuer_eur</strong> fehlt in Supabase (die Tabelle
          selbst ist da). Im{' '}
          <a
            href="https://supabase.com/dashboard/project/vkxsmplcmojybuauffyz/sql/new"
            target="_blank"
            rel="noreferrer"
            className="text-amber-200 underline hover:text-amber-100"
          >
            SQL-Editor
          </a>{' '}
          ausführen:{' '}
          <code className="rounded bg-black/20 px-1 py-0.5 text-[11px]">
            ALTER TABLE portfolio_analyse_buchung ADD COLUMN IF NOT EXISTS steuer_eur numeric(14,2);
          </code>{' '}
          — danach Parqet-CSV erneut importieren.
        </div>
      ) : null}

      <div>
        <h2 className="text-base font-semibold text-[var(--app-text)]">Steuern pro Jahr</h2>
        <p className="mt-1 text-xs text-[var(--app-text-muted)]">
          Summe der gezahlten Steuern pro Jahr, getrennt nach Aktivitäten-Typ
        </p>
        <PaCard variant="elevated" className="mt-4 p-4 sm:p-6">
          <SteuernProJahrTabelle zeilen={jahresZeilen} />
        </PaCard>
      </div>

      <div>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-[var(--app-text)]">Quellensteuer</h2>
            <p className="mt-1 max-w-xl text-xs text-[var(--app-text-muted)]">
              Summe an erhaltenen Dividenden pro Land und Jahr mit zu erwartender
              Quellensteuer-Rückerstattung (DBA-Schätzung).
            </p>
          </div>
          <JahrNav jahr={aktivesQuellenJahr} jahre={quellenJahre} onChange={setQuellenJahr} />
        </div>
        <PaCard variant="elevated" className="mt-4 p-4 sm:p-6">
          <QuellensteuerTabelle buchungen={buchungen} jahr={aktivesQuellenJahr} />
        </PaCard>
      </div>

      <p className="text-[11px] text-[var(--app-text-muted)]">
        Nur zur Information — für die Steuererklärung bitte an die Depotbank wenden. Steuerbeträge
        stammen aus der Import-Spalte „tax“; bei älteren Importen CSV erneut hochladen.
      </p>
    </div>
  )
}
