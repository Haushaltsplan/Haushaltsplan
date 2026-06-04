'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { PaAnkuendigteEarnings } from '@/components/portfolio-analyse/pa-ankuendigte-earnings'
import { usePortfolioAnalyse } from '@/components/portfolio-analyse/pa-data-provider'
import { PortfolioAnalyseShell } from '@/components/portfolio-analyse/portfolio-analyse-shell.client'
import { PaCard } from '@/components/portfolio-analyse/pa-ui'
import { ladeAnkuendigteEarningsDepot } from '@/lib/portfolio-analyse/ankuendigte-earnings-client'
import type { AnkuendigteEarningsErgebnis } from '@/lib/portfolio-analyse/ankuendigte-earnings'

export function PortfolioEarningsDashboardClient() {
  const { live, meta, hatDaten, laden: paLaden } = usePortfolioAnalyse()
  const [daten, setDaten] = useState<AnkuendigteEarningsErgebnis | null>(null)
  const [earningsLaden, setEarningsLaden] = useState(false)
  const [fehler, setFehler] = useState<string | null>(null)

  const positionen = live?.positionen ?? []
  const depotKey = useMemo(
    () =>
      positionen
        .filter((p) => p.stueck > 0)
        .map((p) => `${p.isin ?? ''}:${p.symbolYahoo ?? ''}:${p.stueck}`)
        .join('|'),
    [positionen],
  )
  const metaKey = useMemo(() => [...meta.keys()].sort().join('|'), [meta])

  const naechste = useMemo(() => {
    const heute = new Date().toISOString().slice(0, 10)
    return (daten?.eintraege ?? []).filter((e) => e.terminDatumIso >= heute).slice(0, 8)
  }, [daten])

  useEffect(() => {
    const pos = live?.positionen ?? []
    if (!hatDaten || pos.length === 0) {
      setDaten(null)
      setFehler(null)
      return
    }
    let cancelled = false
    async function run() {
      setEarningsLaden(true)
      setFehler(null)
      try {
        const res = await ladeAnkuendigteEarningsDepot(pos, meta)
        if (!cancelled) setDaten(res)
      } catch (e) {
        if (!cancelled) {
          setDaten(null)
          setFehler(e instanceof Error ? e.message : 'Abruf fehlgeschlagen')
        }
      } finally {
        if (!cancelled) setEarningsLaden(false)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [depotKey, metaKey, hatDaten, live, meta])

  return (
    <PortfolioAnalyseShell
      title="Quartalszahlen"
      description="Nächste Earnings-Termine deiner Depot-Aktien (DivvyDiary)."
    >
      {!paLaden && !hatDaten ? null : (
        <div className="min-w-0 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-zinc-500">
              {daten?.treffer ?? 0} Termin(e) für {daten?.abgefragtePositionen ?? 0} Position(en) mit ISIN.
            </p>
            <Link
              href="/portfolioanalyse/earnings/kalender"
              className="rounded-lg border border-teal-500/30 bg-teal-500/10 px-4 py-2 text-sm font-medium text-teal-300 transition hover:bg-teal-500/20"
            >
              Kalender öffnen
            </Link>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <PaCard variant="elevated" className="flex flex-col p-5">
              <h2 className="text-sm font-semibold text-zinc-100">Anstehende Termine</h2>
              <div className="mt-3 min-h-0 flex-1">
                <PaAnkuendigteEarnings
                  daten={daten}
                  meta={meta}
                  laden={earningsLaden}
                  fehler={fehler}
                />
              </div>
            </PaCard>

            <PaCard variant="elevated" className="p-5">
              <h2 className="text-sm font-semibold text-zinc-100">Hinweise</h2>
              <ul className="mt-3 space-y-2 text-[11px] leading-relaxed text-zinc-500">
                {(daten?.hinweise ?? ['Lade Daten …']).map((h) => (
                  <li key={h}>{h}</li>
                ))}
              </ul>
              {naechste.length > 0 ? (
                <p className="mt-4 text-xs text-zinc-400">
                  Nächster Termin:{' '}
                  <span className="font-medium text-zinc-200">{naechste[0].name}</span>
                </p>
              ) : null}
            </PaCard>
          </div>
        </div>
      )}
    </PortfolioAnalyseShell>
  )
}
