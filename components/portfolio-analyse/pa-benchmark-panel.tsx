'use client'

import { useEffect, useState } from 'react'
import { PaBadge, PaCard, PaStatRow } from '@/components/portfolio-analyse/pa-ui'
import type { BenchmarkVergleichErgebnis } from '@/lib/portfolio-analyse/benchmark-vergleich-types'

export function PaBenchmarkPanel({ startDatumIso }: { startDatumIso: string | null }) {
  const [daten, setDaten] = useState<BenchmarkVergleichErgebnis | null>(null)
  const [laden, setLaden] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function run() {
      setLaden(true)
      try {
        const bis = new Date().toISOString().slice(0, 10)
        const von = startDatumIso && startDatumIso < bis ? startDatumIso : undefined
        const qs = new URLSearchParams({ bis })
        if (von) qs.set('von', von)
        const res = await fetch(`/api/portfolio-analyse/benchmark?${qs}`)
        const j = (await res.json()) as { vergleich?: BenchmarkVergleichErgebnis }
        if (!cancelled) setDaten(j.vergleich ?? null)
      } catch {
        if (!cancelled) setDaten(null)
      } finally {
        if (!cancelled) setLaden(false)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [startDatumIso])

  return (
    <PaCard className="relative p-5 lg:bg-gradient-to-br lg:from-white/[0.03] lg:to-transparent">
      <div className="pointer-events-none absolute inset-x-0 top-0 hidden h-px bg-gradient-to-r from-transparent via-teal-400/35 to-transparent lg:block" />
      <h2 className="text-sm font-semibold tracking-tight text-[var(--app-text)]">vs. Benchmark</h2>
      <p className="mt-0.5 text-[11px] leading-relaxed text-[var(--app-text-muted)]">
        SPY &amp; MSCI World (URTH) · Total Return seit {daten?.von ?? '…'}
      </p>
      {laden && !daten ? (
        <p className="mt-3 text-sm text-[var(--app-text-muted)]">Lade Benchmarks…</p>
      ) : null}
      <div className="mt-3 divide-y divide-white/[0.04]">
        {(daten?.benchmarks ?? []).map((b) => (
          <PaStatRow
            key={b.id}
            label={b.label}
            value={
              b.totalReturnPct != null ? (
                <PaBadge variant={b.totalReturnPct >= 0 ? 'positive' : 'negative'}>
                  {b.totalReturnPct >= 0 ? '+' : ''}
                  {b.totalReturnPct.toLocaleString('de-DE', {
                    minimumFractionDigits: 1,
                    maximumFractionDigits: 1,
                  })}
                  %
                </PaBadge>
              ) : (
                '–'
              )
            }
          />
        ))}
      </div>
    </PaCard>
  )
}
