'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { PaCard } from '@/components/portfolio-analyse/pa-ui'
import type {
  NewsTerminalDepotPosition,
  NewsTerminalPaket,
} from '@/lib/portfolio-analyse/portfolio-news-terminal-server'

export function PaNewsTerminalTeaser({
  positionen,
}: {
  positionen: NewsTerminalDepotPosition[]
}) {
  const [paket, setPaket] = useState<NewsTerminalPaket | null>(null)
  const [laden, setLaden] = useState(true)

  const depotKey = useMemo(
    () => positionen.map((p) => `${p.isin ?? ''}:${p.symbolYahoo ?? ''}`).join('|'),
    [positionen],
  )

  useEffect(() => {
    if (positionen.length === 0) {
      setPaket(null)
      setLaden(false)
      return
    }
    let cancelled = false
    async function run() {
      setLaden(true)
      try {
        const res = await fetch('/api/portfolio-analyse/news-terminal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nurHeute: false, positionen, limit: 12 }),
        })
        const json = (await res.json()) as { ok?: boolean } & Partial<NewsTerminalPaket>
        if (!cancelled && json.ok) {
          setPaket({
            zeilen: json.zeilen ?? [],
            unternehmen: json.unternehmen ?? [],
            fehler: json.fehler ?? null,
            aktualisiertAm: json.aktualisiertAm ?? new Date().toISOString(),
          })
        }
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) setLaden(false)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [depotKey, positionen])

  const top = paket?.zeilen.slice(0, 3) ?? []
  const heuteCount = paket?.zeilen.filter((z) => z.istHeute).length ?? 0

  return (
    <PaCard variant="elevated" className="flex flex-col">
      <div className="flex items-center justify-between border-b border-white/[0.04] px-5 py-3">
        <div>
          <h2 className="text-sm font-semibold text-[var(--app-text)]">News-Terminal</h2>
          <p className="text-[11px] text-[var(--app-text-muted)]">
            {laden ? 'Lade …' : `${paket?.zeilen.length ?? 0} Meldungen (48h)${heuteCount ? ` · ${heuteCount} heute` : ''}`}
          </p>
        </div>
        <Link href="/portfolioanalyse/news" className="text-xs text-teal-400 hover:underline">
          Öffnen →
        </Link>
      </div>
      <ul className="flex-1 divide-y divide-[var(--app-border)]">
        {top.length === 0 && !laden ? (
          <li className="px-5 py-6 text-center text-sm text-[var(--app-text-muted)]">
            Keine aktuellen Portfolio-News.
          </li>
        ) : (
          top.map((z) => (
            <li key={z.id} className="px-4 py-3">
              <p className="line-clamp-2 text-sm leading-snug text-[var(--app-text)]">{z.titel}</p>
              <p className="mt-1 text-[10px] text-[var(--app-text-muted)]">
                {z.unternehmen.map((u) => u.symbol ?? u.name).join(' · ')}
              </p>
            </li>
          ))
        )}
        {laden && top.length === 0 ? (
          <li className="px-5 py-6 text-center text-sm text-[var(--app-text-muted)]">…</li>
        ) : null}
      </ul>
    </PaCard>
  )
}
