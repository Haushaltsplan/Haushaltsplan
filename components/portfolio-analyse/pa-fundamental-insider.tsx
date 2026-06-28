'use client'

import { useCallback, useEffect, useState } from 'react'
import { PaCard } from '@/components/portfolio-analyse/pa-ui'
import type { InsiderTransaktionenPaket } from '@/lib/portfolio-analyse/insider-transaktionen-types'

function fmtUsd(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return '–'
  if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toLocaleString('de-DE', { maximumFractionDigits: 1 })} M`
  return `$${v.toLocaleString('de-DE', { maximumFractionDigits: 0 })}`
}

const TYP_CLASS = {
  kauf: 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/30',
  verkauf: 'bg-red-500/15 text-red-300 ring-red-500/30',
  sonstiges: 'bg-[var(--app-surface-muted)]/40 text-[var(--app-text-muted)] ring-[var(--app-border-strong)]/40',
} as const

export function PaFundamentalInsider({
  ticker,
  symbolYahoo,
  firmenname,
  isin,
  selectionKey,
}: {
  ticker: string
  symbolYahoo?: string | null
  firmenname?: string | null
  isin?: string | null
  selectionKey?: string
}) {
  const [daten, setDaten] = useState<InsiderTransaktionenPaket | null>(null)
  const [laden, setLaden] = useState(false)

  const lade = useCallback(async () => {
    if (!ticker?.trim()) return
    setLaden(true)
    try {
      const res = await fetch('/api/portfolio-analyse/insider-transaktionen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker, symbolYahoo, firmenname, isin }),
        signal: AbortSignal.timeout(90_000),
      })
      setDaten((await res.json()) as InsiderTransaktionenPaket)
    } catch {
      setDaten(null)
    } finally {
      setLaden(false)
    }
  }, [ticker, symbolYahoo, firmenname, isin])

  useEffect(() => {
    setDaten(null)
    if (ticker?.trim()) void lade()
  }, [selectionKey, ticker, lade])

  return (
    <PaCard className="space-y-3 p-4">
      <div>
        <h3 className="text-sm font-semibold text-white">Insider-Käufe / -Verkäufe</h3>
        <p className="text-xs text-[var(--app-text-muted)]">
          US: SEC Form 4 (Open Market) · EU: Directors Dealings (begrenzt)
        </p>
      </div>

      {laden && !daten ? <p className="text-sm text-[var(--app-text-muted)]">Lädt …</p> : null}

      {daten?.nettoKaufUsd != null || daten?.kaufSummeUsd != null ? (
        <div className="flex flex-wrap gap-2 text-xs">
          {daten.kaufSummeUsd != null ? (
            <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-emerald-300">
              Käufe: {fmtUsd(daten.kaufSummeUsd)}
            </span>
          ) : null}
          {daten.verkaufSummeUsd != null ? (
            <span className="rounded-full bg-red-500/10 px-2.5 py-0.5 text-red-300">
              Verkäufe: {fmtUsd(daten.verkaufSummeUsd)}
            </span>
          ) : null}
          {daten.nettoKaufUsd != null ? (
            <span className="rounded-full bg-[var(--app-surface-hover)] px-2.5 py-0.5 text-[var(--app-text)]">
              Netto: {fmtUsd(daten.nettoKaufUsd)}
            </span>
          ) : null}
        </div>
      ) : null}

      {daten?.hinweis && !daten.transaktionen.length ? (
        <p className="text-sm text-[var(--app-text-muted)]">{daten.hinweis}</p>
      ) : null}

      <div className="space-y-2">
        {(daten?.transaktionen ?? []).map((t) => (
          <article key={t.id} className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-muted)] px-3 py-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${TYP_CLASS[t.typ]}`}>
                {t.typ === 'kauf' ? 'Kauf' : t.typ === 'verkauf' ? 'Verkauf' : 'Sonstiges'}
              </span>
              <span className="text-[10px] text-[var(--app-text-muted)]">{t.quelle === 'sec_form4' ? 'Form 4' : 'EU IR'}</span>
              {t.datum ? <span className="text-[10px] text-[var(--app-text-muted)]">{t.datum}</span> : null}
            </div>
            <p className="mt-1 text-sm font-medium text-white">
              {t.person}
              {t.titel ? <span className="font-normal text-[var(--app-text-muted)]"> · {t.titel}</span> : null}
            </p>
            <p className="mt-0.5 text-xs text-[var(--app-text-muted)]">
              {t.aktien != null ? `${t.aktien.toLocaleString('de-DE')} Aktien` : '–'}
              {t.preisUsd != null ? ` @ $${t.preisUsd.toLocaleString('de-DE', { maximumFractionDigits: 2 })}` : ''}
              {t.wertUsd != null ? ` · ${fmtUsd(t.wertUsd)}` : ''}
            </p>
            <a href={t.url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-[11px] text-teal-400 hover:underline">
              Filing öffnen →
            </a>
          </article>
        ))}
      </div>

      {daten?.hinweis && daten.transaktionen.length ? (
        <p className="text-[10px] text-[var(--app-text-muted)]">{daten.hinweis}</p>
      ) : null}
    </PaCard>
  )
}
