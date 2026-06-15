'use client'

import { useCallback, useEffect, useState } from 'react'
import { EarningsCallAnalyseDarstellung } from '@/components/portfolio-analyse/pa-earnings-call-analyse'
import { PaCard } from '@/components/portfolio-analyse/pa-ui'
import type { MaterialEventEintrag, MaterialEventsPaket } from '@/lib/portfolio-analyse/material-events-types'

const KAT_LABEL: Record<MaterialEventEintrag['kategorie'], string> = {
  guidance: 'Guidance',
  management: 'Management',
  m_a: 'M&A',
  restrukturierung: 'Restrukturierung',
  finanzergebnis: 'Ergebnis',
  regulatorisch: 'Regulatorisch',
  sonstiges: 'Sonstiges',
}

function EventZeile({ e }: { e: MaterialEventEintrag }) {
  return (
    <article className="rounded-xl border border-zinc-800/90 bg-zinc-950/40 px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-200">
          {KAT_LABEL[e.kategorie]}
        </span>
        <span className="text-[10px] text-zinc-500">{e.quelle === 'sec_8k' ? 'SEC 8-K' : 'EU Ad-hoc'}</span>
        {e.datum ? <span className="text-[10px] text-zinc-500">{e.datum}</span> : null}
      </div>
      <p className="mt-2 text-sm font-medium text-white">{e.titel}</p>
      <p className="mt-2 line-clamp-4 text-sm leading-relaxed text-zinc-400">{e.textAuszug}</p>
      <a
        href={e.url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 inline-block text-xs text-teal-400 hover:text-teal-300"
      >
        Original öffnen →
      </a>
    </article>
  )
}

export function PaFundamentalMaterialEvents({
  ticker,
  firmenname,
  isin,
  selectionKey,
}: {
  ticker: string | null
  firmenname: string | null
  isin?: string | null
  selectionKey?: string
}) {
  const [daten, setDaten] = useState<MaterialEventsPaket | null>(null)
  const [laden, setLaden] = useState(false)
  const [fehler, setFehler] = useState<string | null>(null)

  const lade = useCallback(async () => {
    if (!ticker?.trim()) return
    setLaden(true)
    setFehler(null)
    try {
      const res = await fetch('/api/portfolio-analyse/material-events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker, firmenname, isin, force: false }),
        signal: AbortSignal.timeout(90_000),
      })
      const j = (await res.json()) as MaterialEventsPaket
      setDaten(j)
      if (j.fehler) setFehler(j.fehler)
    } catch (e) {
      setFehler(e instanceof Error ? e.message : 'Abruf fehlgeschlagen')
    } finally {
      setLaden(false)
    }
  }, [ticker, firmenname, isin])

  useEffect(() => {
    setDaten(null)
    setFehler(null)
    if (ticker?.trim()) void lade()
  }, [selectionKey, ticker, lade])

  if (!ticker?.trim()) return null

  return (
    <PaCard className="space-y-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-white">Material Events</h3>
          <p className="text-xs text-zinc-500">SEC 8-K (US) · Ad-hoc / Pflichtmitteilungen (EU IR, DGAP/eQS, MAR)</p>
        </div>
        <button
          type="button"
          onClick={() => void lade()}
          disabled={laden}
          className="rounded-lg border border-zinc-700 px-2.5 py-1 text-xs text-zinc-300 hover:bg-zinc-800 disabled:opacity-50"
        >
          {laden ? 'Lädt…' : 'Aktualisieren'}
        </button>
      </div>

      {fehler ? <p className="text-sm text-amber-200/90">{fehler}</p> : null}
      {daten?.hinweis && !daten.events.length ? (
        <p className="text-sm text-zinc-500">{daten.hinweis}</p>
      ) : null}

      <div className="space-y-3">
        {(daten?.events ?? []).map((e) => (
          <EventZeile key={e.id} e={e} />
        ))}
      </div>
    </PaCard>
  )
}
