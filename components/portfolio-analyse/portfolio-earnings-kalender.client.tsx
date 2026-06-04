'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { PaEarningsKalender } from '@/components/portfolio-analyse/pa-earnings-kalender'
import { usePortfolioAnalyse } from '@/components/portfolio-analyse/pa-data-provider'
import { PortfolioAnalyseShell } from '@/components/portfolio-analyse/portfolio-analyse-shell.client'
import { ladeAnkuendigteEarningsDepot } from '@/lib/portfolio-analyse/ankuendigte-earnings-client'
import type { AnkuendigteEarningsErgebnis } from '@/lib/portfolio-analyse/ankuendigte-earnings'

export function PortfolioEarningsKalenderClient() {
  const { live, meta, hatDaten, laden: paLaden } = usePortfolioAnalyse()
  const [daten, setDaten] = useState<AnkuendigteEarningsErgebnis | null>(null)
  const [laden, setLaden] = useState(false)
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

  useEffect(() => {
    const pos = live?.positionen ?? []
    if (!hatDaten || pos.length === 0) {
      setDaten(null)
      setFehler(null)
      return
    }
    let cancelled = false
    async function run() {
      setLaden(true)
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
        if (!cancelled) setLaden(false)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [depotKey, metaKey, hatDaten, live, meta])

  const jahr = new Date().getUTCFullYear()

  return (
    <PortfolioAnalyseShell
      title={`Earnings-Kalender ${jahr}`}
      description={
        <>
          Quartalstermine deines Depots (±1 Jahr) —{' '}
          <Link href="/portfolioanalyse/earnings" className="text-teal-400 hover:underline">
            Zurück zum Dashboard
          </Link>
        </>
      }
    >
      {!paLaden && !hatDaten ? null : (
        <PaEarningsKalender daten={daten} meta={meta} laden={laden || paLaden} fehler={fehler} />
      )}
    </PortfolioAnalyseShell>
  )
}
