'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { PaCard } from '@/components/portfolio-analyse/pa-ui'
import { formatProzent } from '@/lib/portfolio-analyse/berechnung'
import { fundamentaldatenHref } from '@/lib/portfolio-analyse/fundamentaldaten-navigation'
import {
  bauePerformanceMap,
  performanceFarbe,
  type PerformanceGroesse,
} from '@/lib/portfolio-analyse/performance-map'
import type { LivePosition } from '@/lib/portfolio-analyse/live-bewertung'

export function PaPerformanceMap({
  positionen,
}: {
  positionen: LivePosition[]
}) {
  const router = useRouter()
  const [groesse, setGroesse] = useState<PerformanceGroesse>('markt')
  const sektoren = useMemo(() => bauePerformanceMap(positionen, groesse), [positionen, groesse])

  if (sektoren.length === 0) {
    return <p className="py-12 text-center text-sm text-zinc-500">Keine Positionen für die Performance Map.</p>
  }

  const gesamtH = 420

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-end gap-4">
        <fieldset className="flex items-center gap-4 text-xs text-zinc-400">
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="radio"
              name="pa-perf-groesse"
              checked={groesse === 'markt'}
              onChange={() => setGroesse('markt')}
              className="accent-teal-500"
            />
            Aktueller Wert
          </label>
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="radio"
              name="pa-perf-groesse"
              checked={groesse === 'kauf'}
              onChange={() => setGroesse('kauf')}
              className="accent-teal-500"
            />
            Kaufwert
          </label>
        </fieldset>
        <span className="text-xs text-zinc-500">Performance: Heute (live) bzw. Gesamt-G/V</span>
      </div>

      <PaCard className="overflow-hidden p-1" >
        <div style={{ minHeight: gesamtH }}>
        <div className="flex flex-col" style={{ height: gesamtH }}>
          {sektoren.map((sek) => (
            <div
              key={sek.name}
              className="flex min-h-[3rem] flex-col border border-zinc-950/80"
              style={{ flex: sek.wertEur }}
            >
              <div className="shrink-0 bg-zinc-800/90 px-2 py-1 text-[11px] font-medium text-zinc-200">
                {sek.name}
              </div>
              <div className="flex min-h-0 flex-1">
                {sek.tiles.map((tile) => {
                  const { background, color } = performanceFarbe(tile.performanceProzent)
                  const fundamentalHref =
                    tile.assetKlasse === 'aktie' && tile.isin
                      ? fundamentaldatenHref({ isin: tile.isin })
                      : null
                  return (
                    <div
                      key={tile.id}
                      className={`relative flex min-w-[4rem] flex-col items-center justify-center overflow-hidden border border-zinc-950/60 p-1 text-center ${fundamentalHref ? 'cursor-pointer hover:ring-1 hover:ring-white/20' : ''}`}
                      style={{ flex: tile.wertEur, background, color }}
                      title={`${tile.label}: ${formatProzent(tile.performanceProzent)} · ${tile.gewichtProzent.toFixed(1)} %${fundamentalHref ? ' · Klick für Fundamentaldaten' : ''}`}
                      onClick={fundamentalHref ? () => router.push(fundamentalHref) : undefined}
                      onKeyDown={
                        fundamentalHref
                          ? (e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault()
                                router.push(fundamentalHref)
                              }
                            }
                          : undefined
                      }
                      tabIndex={fundamentalHref ? 0 : undefined}
                      role={fundamentalHref ? 'link' : undefined}
                    >
                      <span className="line-clamp-2 text-[10px] font-medium leading-tight">{tile.label}</span>
                      {tile.performanceProzent != null ? (
                        <span className="mt-0.5 text-[11px] font-semibold tabular-nums">
                          {tile.performanceProzent >= 0 ? '+' : ''}
                          {tile.performanceProzent.toFixed(2)}%
                        </span>
                      ) : (
                        <span className="mt-0.5 text-[10px] opacity-70">—</span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
        </div>
      </PaCard>
    </div>
  )
}
