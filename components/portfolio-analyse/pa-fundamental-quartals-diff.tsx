'use client'

import { useCallback, useEffect, useState } from 'react'
import { EarningsCallAnalyseDarstellung } from '@/components/portfolio-analyse/pa-earnings-call-analyse'
import { PaCard } from '@/components/portfolio-analyse/pa-ui'
import {
  ladeQuartalsKiDiffAusLocalCache,
  speichereQuartalsKiDiffLocal,
} from '@/lib/portfolio-analyse/quartals-ki-diff-client'
import type { QuartalsKiDiffPaket, QuartalsKiDiffTyp } from '@/lib/portfolio-analyse/quartals-ki-diff-types'

export function PaFundamentalQuartalsDiff({
  ticker,
  firmenname,
  typ,
  aktuellId,
  vorherId,
  aktuellLabel,
  vorherLabel,
}: {
  ticker: string
  firmenname: string | null
  typ: QuartalsKiDiffTyp
  aktuellId: string
  vorherId: string
  aktuellLabel: string
  vorherLabel: string
}) {
  const [daten, setDaten] = useState<QuartalsKiDiffPaket | null>(null)
  const [laden, setLaden] = useState(false)
  const [fehler, setFehler] = useState<string | null>(null)

  const lade = useCallback(
    async (force?: boolean) => {
      if (!force) {
        const hit = ladeQuartalsKiDiffAusLocalCache({
          ticker,
          typ,
          aktuellId,
          vorherId,
          aktuellLabel,
          vorherLabel,
        })
        if (hit?.diff) {
          setDaten(hit)
          setFehler(null)
          return
        }
      }

      setLaden(true)
      setFehler(null)
      try {
        const res = await fetch('/api/portfolio-analyse/quartals-ki-diff', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ticker,
            firmenname,
            typ,
            aktuellId,
            vorherId,
            force: Boolean(force),
          }),
          signal: AbortSignal.timeout(120_000),
        })
        const j = (await res.json()) as QuartalsKiDiffPaket & { fehler?: string }
        if (!j.ok && j.fehler) {
          setFehler(j.fehler)
          return
        }

        const paket: QuartalsKiDiffPaket = {
          ...j,
          aktuellLabel: aktuellLabel,
          vorherLabel: vorherLabel,
        }
        if (paket.diff?.trim()) {
          speichereQuartalsKiDiffLocal(paket)
        }
        setDaten(paket)
      } catch (e) {
        setFehler(e instanceof Error ? e.message : 'Diff fehlgeschlagen')
      } finally {
        setLaden(false)
      }
    },
    [ticker, firmenname, typ, aktuellId, vorherId, aktuellLabel, vorherLabel],
  )

  useEffect(() => {
    setDaten(null)
    void lade(false)
  }, [aktuellId, vorherId, typ, lade])

  return (
    <PaCard className="space-y-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-white">Quartals-Diff (KI)</h3>
          <p className="text-xs text-zinc-500">
            {vorherLabel} → {aktuellLabel}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void lade(true)}
          disabled={laden}
          className="rounded-lg border border-zinc-700 px-2.5 py-1 text-xs text-zinc-300 hover:bg-zinc-800 disabled:opacity-50"
        >
          {laden ? 'Analysiert…' : 'Neu berechnen'}
        </button>
      </div>

      {fehler ? <p className="text-sm text-amber-200/90">{fehler}</p> : null}

      {daten?.diff ? (
        <EarningsCallAnalyseDarstellung text={daten.diff} />
      ) : laden ? (
        <p className="text-sm text-zinc-500">Vergleiche KI-Summaries …</p>
      ) : null}

      {daten?.ausCache ? (
        <p className="text-[10px] text-zinc-600">Lokal gespeichert · Sync zur Cloud</p>
      ) : daten?.diff ? (
        <p className="text-[10px] text-zinc-600">Neu berechnet · lokal gespeichert</p>
      ) : null}
    </PaCard>
  )
}
