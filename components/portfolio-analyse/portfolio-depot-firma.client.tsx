'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { PortfolioAnalyseShell } from '@/components/portfolio-analyse/portfolio-analyse-shell.client'
import { PaCard, PaTextTabs } from '@/components/portfolio-analyse/pa-ui'
import type { DepotFirmaAntwort, DepotFirmaKennzahl, DepotFirmaModus, DepotFirmaModell } from '@/lib/portfolio-analyse/depot-firma'
import { PaFundamentalBereichTabs } from '@/components/portfolio-analyse/pa-fundamental-bereich-tabs'

function KennzahlZeile({ k }: { k: DepotFirmaKennzahl }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <dt className="text-[12px] text-[var(--app-text-muted)]">{k.label}</dt>
      <dd className="text-right">
        <span className="text-[13px] font-semibold tabular-nums text-[var(--app-text)]">{k.wertText}</span>
        {k.n > 0 ? (
          <span className="ml-2 text-[10px] tabular-nums text-[var(--app-text-muted)]">
            {k.n} Tit. · {k.abdeckungPct.toLocaleString('de-DE', { maximumFractionDigits: 0 })} %
          </span>
        ) : null}
      </dd>
    </div>
  )
}

function FirmaAnsicht({ modell }: { modell: DepotFirmaModell }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {modell.sektionen.map((s) => (
        <PaCard key={s.id} variant="elevated" className="p-4">
          <h3 className="mb-2 border-b border-amber-500/30 pb-1 text-[11px] font-bold uppercase tracking-wide text-amber-500">
            {s.titel}
          </h3>
          <dl>
            {s.kennzahlen.map((k) => (
              <KennzahlZeile key={k.id} k={k} />
            ))}
          </dl>
        </PaCard>
      ))}
      <PaCard variant="elevated" className="p-4 lg:col-span-2">
        <h3 className="mb-2 border-b border-amber-500/30 pb-1 text-[11px] font-bold uppercase tracking-wide text-amber-500">
          Größte Bausteine
        </h3>
        <ul className="grid gap-1 sm:grid-cols-2">
          {modell.groesste.map((g) => (
            <li key={g.isin} className="flex justify-between gap-3 text-[12px]">
              <Link
                href={`/portfolioanalyse/fundamentaldaten?isin=${encodeURIComponent(g.isin)}`}
                className="truncate text-teal-300 hover:underline"
              >
                {g.name}
              </Link>
              <span className="tabular-nums text-[var(--app-text-muted)]">
                {g.anteilPct.toLocaleString('de-DE', { maximumFractionDigits: 1 })} %
              </span>
            </li>
          ))}
        </ul>
      </PaCard>
    </div>
  )
}

export function PortfolioDepotFirmaClient() {
  const [daten, setDaten] = useState<DepotFirmaAntwort | null>(null)
  const [fehler, setFehler] = useState<string | null>(null)
  const [laden, setLaden] = useState(true)
  const [modus, setModus] = useState<DepotFirmaModus>('depotgewicht')

  useEffect(() => {
    let alive = true
    setLaden(true)
    void (async () => {
      try {
        const res = await fetch('/api/portfolio-analyse/depot-firma', { cache: 'no-store' })
        const j = (await res.json()) as DepotFirmaAntwort | { ok: false; message?: string }
        if (!alive) return
        if (!j.ok) {
          setFehler('message' in j ? (j.message ?? 'Laden fehlgeschlagen.') : 'Laden fehlgeschlagen.')
          setDaten(null)
          return
        }
        setFehler(null)
        setDaten(j)
      } catch (e) {
        if (!alive) return
        setFehler(e instanceof Error ? e.message : 'Laden fehlgeschlagen.')
      } finally {
        if (alive) setLaden(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  const modell = daten ? (modus === 'depotgewicht' ? daten.depotgewicht : daten.gleichgewicht) : null

  return (
    <PortfolioAnalyseShell
      title="Depot als Firma"
      description="Alle Aktien (ohne ETFs) zu einem Unternehmen zusammengezogen — dein Anteil an Umsatz, Gewinn und Cashflow."
    >
      <PaFundamentalBereichTabs aktiv="firma" />

      {laden ? (
        <p className="py-12 text-center text-sm text-[var(--app-text-muted)]">Kennzahlen werden addiert …</p>
      ) : fehler ? (
        <PaCard className="p-6 text-sm text-[var(--app-text-muted)]">{fehler}</PaCard>
      ) : modell && daten ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <p className="text-sm text-[var(--app-text-muted)]">
              {modell.mitLookthrough} von {modell.aktienAnzahl} Aktien · {modell.abdeckungPct.toLocaleString('de-DE')} %
              Abdeckung · {modell.depotwertEur.toLocaleString('de-DE', { maximumFractionDigits: 0 })} € Aktienwert
            </p>
            <PaTextTabs
              tabs={[
                { id: 'depotgewicht', label: 'Wie im Depot', shortLabel: 'Gewichtet' },
                { id: 'gleichgewicht', label: 'Jede Aktie gleich', shortLabel: 'Gleich' },
              ]}
              active={modus}
              onChange={setModus}
            />
          </div>
          <p className="text-[11px] text-[var(--app-text-muted)]">
            {modus === 'depotgewicht'
              ? 'Look-through: Depotwert ÷ Marktkapitalisierung (gleiche Währung), dann GuV addiert. KGV nur über Titel mit Gewinn. Dual-Class (z. B. Alphabet) kann vom Einzel-KGV abweichen.'
              : 'Gleiches Prinzip, aber so tun als wäre jede Aktie gleich schwer — kleine Titel zählen voll.'}
          </p>
          <FirmaAnsicht modell={modell} />
          {daten.fehlend.length > 0 ? (
            <p className="text-[11px] text-amber-200/80">
              Ohne Cache (unter Fundamentaldaten einmal öffnen):{' '}
              {daten.fehlend.map((f) => f.name).join(', ')}
            </p>
          ) : null}
        </div>
      ) : null}
    </PortfolioAnalyseShell>
  )
}
