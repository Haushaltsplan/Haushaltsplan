'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { PaAnkuendigteEarnings } from '@/components/portfolio-analyse/pa-ankuendigte-earnings'
import { PaEarningsPrognosePanel } from '@/components/portfolio-analyse/pa-earnings-prognose-panel'
import { usePortfolioAnalyse } from '@/components/portfolio-analyse/pa-data-provider'
import { PortfolioAnalyseShell } from '@/components/portfolio-analyse/portfolio-analyse-shell.client'
import { PaCard } from '@/components/portfolio-analyse/pa-ui'
import {
  ladeAnkuendigteEarningsDepot,
  ladeAnkuendigteEarningsDepotAusLocalCache,
} from '@/lib/portfolio-analyse/ankuendigte-earnings-client'
import {
  bevorzugterEarningsEintrag,
  type AnkuendigteEarningsErgebnis,
  type AnkuendigtesEarningsEintrag,
} from '@/lib/portfolio-analyse/ankuendigte-earnings'

export function PortfolioEarningsDashboardClient() {
  const { live, meta, hatDaten, laden: paLaden } = usePortfolioAnalyse()
  const [daten, setDaten] = useState<AnkuendigteEarningsErgebnis | null>(null)
  const [earningsLaden, setEarningsLaden] = useState(false)
  const [fehler, setFehler] = useState<string | null>(null)
  const [selected, setSelected] = useState<AnkuendigtesEarningsEintrag | null>(null)

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

  const eintraege = daten?.eintraege ?? []
  const eintragKey = useMemo(
    () => eintraege.map((e) => `${e.isin}:${e.terminDatumIso}`).join('|'),
    [eintraege],
  )

  useEffect(() => {
    if (eintraege.length === 0) {
      setSelected(null)
      return
    }
    setSelected((prev) => {
      if (prev && eintraege.some((e) => `${e.isin ?? e.symbol}:${e.terminDatumIso}` === `${prev.isin ?? prev.symbol}:${prev.terminDatumIso}`)) {
        return prev
      }
      return bevorzugterEarningsEintrag(eintraege)
    })
  }, [eintragKey, eintraege])

  useEffect(() => {
    const pos = live?.positionen ?? []
    if (!hatDaten || pos.length === 0) {
      setDaten(null)
      setFehler(null)
      return
    }
    const cached = ladeAnkuendigteEarningsDepotAusLocalCache(pos, meta)
    if (cached?.eintraege.length) setDaten(cached)

    let cancelled = false
    async function run() {
      setEarningsLaden(!cached?.eintraege.length)
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
      description="Kommende Quartalstermine (DivvyDiary) und Konsens-Schätzungen."
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

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(300px,380px)] lg:items-stretch">
            <PaCard
              variant="elevated"
              className="flex flex-col border-[#eef0f1]/[0.08] bg-[#0c0c0d] p-5"
            >
              <h2 className="text-sm font-semibold tracking-tight text-[#eef0f1]">Quartalstermine</h2>
              <p className="mt-0.5 text-[11px] text-zinc-500">
                Nächstes Quartal · DivvyDiary · Klick für Konsens
              </p>
              <div className="mt-3 min-h-0 flex-1">
                <PaAnkuendigteEarnings
                  daten={daten}
                  meta={meta}
                  laden={earningsLaden}
                  fehler={fehler}
                  selectedKey={
                    selected ? `${selected.isin ?? selected.symbol}:${selected.terminDatumIso}` : null
                  }
                  onSelect={setSelected}
                />
              </div>
              {daten?.hinweise.length ? (
                <ul className="mt-4 space-y-1 border-t border-white/[0.06] pt-3 text-[10px] leading-relaxed text-zinc-600">
                  {daten.hinweise.map((h) => (
                    <li key={h}>{h}</li>
                  ))}
                </ul>
              ) : null}
            </PaCard>

            <PaEarningsPrognosePanel eintrag={selected} meta={meta} />
          </div>
        </div>
      )}
    </PortfolioAnalyseShell>
  )
}
