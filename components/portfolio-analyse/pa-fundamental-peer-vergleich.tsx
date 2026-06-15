'use client'

import { useEffect, useState } from 'react'
import { PaCard } from '@/components/portfolio-analyse/pa-ui'
import type { PeerKennzahlen, PeerVergleichPaket } from '@/lib/portfolio-analyse/peer-vergleich-server'

function fmtPct(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return '–'
  return `${v.toLocaleString('de-DE', { maximumFractionDigits: 1 })} %`
}

function fmtMult(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return '–'
  return `${v.toLocaleString('de-DE', { maximumFractionDigits: 2 })}×`
}

function vsPeer(subject: number | null, peer: number | null, higherIsBetter = true): string {
  if (subject == null || peer == null) return 'text-zinc-400'
  if (subject === peer) return 'text-zinc-300'
  const besser = higherIsBetter ? subject > peer : subject < peer
  return besser ? 'text-emerald-300' : 'text-red-300'
}

function Zeile({
  label,
  subject,
  median,
  higherIsBetter = true,
  format = 'pct',
}: {
  label: string
  subject: number | null
  median: number | null
  higherIsBetter?: boolean
  format?: 'pct' | 'mult'
}) {
  const fmt = format === 'mult' ? fmtMult : fmtPct
  return (
    <tr className="align-top">
      <td className="px-3 py-2.5 text-sm text-zinc-300">{label}</td>
      <td className={`px-3 py-2.5 text-sm font-medium ${vsPeer(subject, median, higherIsBetter)}`}>
        {fmt(subject)}
      </td>
      <td className="px-3 py-2.5 text-sm text-zinc-400">{fmt(median)}</td>
    </tr>
  )
}

export function PaFundamentalPeerVergleich({
  ticker,
  isin,
  subject,
}: {
  ticker: string
  isin?: string | null
  subject?: PeerKennzahlen | null
}) {
  const [daten, setDaten] = useState<PeerVergleichPaket | null>(null)
  const [laden, setLaden] = useState(false)

  useEffect(() => {
    if (!ticker?.trim()) return
    let cancelled = false
    async function run() {
      setLaden(true)
      try {
        const res = await fetch('/api/portfolio-analyse/peer-vergleich', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ticker, isin, subject: subject ?? undefined }),
          signal: AbortSignal.timeout(90_000),
        })
        const j = (await res.json()) as PeerVergleichPaket
        if (!cancelled) setDaten(j)
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
  }, [ticker, isin, subject])

  if (laden && !daten) {
    return (
      <PaCard className="p-4 text-sm text-zinc-500">Peer-Benchmark wird geladen …</PaCard>
    )
  }

  if (!daten?.ok) {
    return (
      <PaCard className="p-4 text-sm text-zinc-500">
        {daten?.fehler ?? 'Peer-Vergleich nicht verfügbar.'}
      </PaCard>
    )
  }

  const m = daten.median

  return (
    <PaCard className="space-y-3 overflow-hidden p-4">
      <div>
        <h3 className="text-sm font-semibold text-white">Peer-Vergleich (Sektor-Benchmark)</h3>
        <p className="text-xs text-zinc-500">
          vs. Median ({daten.peers.length} Peers): {daten.peers.map((p) => p.ticker).join(', ') || '–'}
        </p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-800/80">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-zinc-900/60 text-xs uppercase tracking-wide text-zinc-400">
            <tr>
              <th className="px-3 py-2 font-semibold">Kennzahl</th>
              <th className="px-3 py-2 font-semibold">{daten.ticker}</th>
              <th className="px-3 py-2 font-semibold">Peer-Median</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/70">
            <Zeile label="ROIC (adjustiert)" subject={daten.subject.roicAdjustiert} median={m.roicAdjustiert} />
            <Zeile label="FCF-Marge" subject={daten.subject.fcfMarge} median={m.fcfMarge} />
            <Zeile label="Rule of 40" subject={daten.subject.ruleOf40} median={m.ruleOf40} />
            <Zeile
              label="Net Debt / EBITDA"
              subject={daten.subject.netDebtEbitda}
              median={m.netDebtEbitda}
              higherIsBetter={false}
              format="mult"
            />
          </tbody>
        </table>
      </div>
    </PaCard>
  )
}
