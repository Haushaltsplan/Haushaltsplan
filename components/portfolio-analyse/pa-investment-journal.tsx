'use client'

import { useCallback, useEffect, useState } from 'react'
import { PaBadge, PaCard } from '@/components/portfolio-analyse/pa-ui'
import type { JournalEintrag } from '@/lib/portfolio-analyse/investment-journal-types'

export function PaInvestmentJournal({
  ticker,
  isin,
  name,
}: {
  ticker?: string | null
  isin?: string | null
  name?: string | null
}) {
  const [eintraege, setEintraege] = useState<JournalEintrag[]>([])
  const [these, setThese] = useState('')
  const [kaufgrund, setKaufgrund] = useState('')
  const [watchpoints, setWatchpoints] = useState('')
  const [tickerInput, setTickerInput] = useState(ticker ?? '')
  const [laden, setLaden] = useState(false)
  const [speichern, setSpeichern] = useState(false)

  const ladenDaten = useCallback(async () => {
    setLaden(true)
    try {
      const qs = ticker ? `?ticker=${encodeURIComponent(ticker)}` : ''
      const res = await fetch(`/api/portfolio-analyse/journal${qs}`)
      const j = (await res.json()) as { eintraege?: JournalEintrag[] }
      const list = j.eintraege ?? []
      setEintraege(list)
      const aktiv = list.find((e) => e.status === 'aktiv')
      if (aktiv) {
        setThese(aktiv.these)
        setKaufgrund(aktiv.kaufgrund)
        setWatchpoints(aktiv.watchpoints)
        setTickerInput(aktiv.ticker)
      }
    } catch {
      /* ignore */
    } finally {
      setLaden(false)
    }
  }, [ticker])

  useEffect(() => {
    void ladenDaten()
  }, [ladenDaten])

  async function speichere() {
    const t = (tickerInput || ticker || '').trim().toUpperCase()
    if (!t) return
    setSpeichern(true)
    try {
      const aktiv = eintraege.find((e) => e.status === 'aktiv' && e.ticker === t)
      await fetch('/api/portfolio-analyse/journal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: aktiv?.id,
          ticker: t,
          isin: isin ?? aktiv?.isin,
          name: name ?? aktiv?.name ?? t,
          these,
          kaufgrund,
          watchpoints,
          status: 'aktiv',
        }),
      })
      await ladenDaten()
    } finally {
      setSpeichern(false)
    }
  }

  return (
    <PaCard className="p-5">
      <h2 className="text-sm font-semibold tracking-tight text-[var(--app-text)]">Investment-Journal</h2>
      <p className="mt-0.5 text-[11px] text-[var(--app-text-muted)]">
        These · Kaufgrund · Review in 6 Monaten
      </p>

      {laden ? <p className="mt-3 text-sm text-[var(--app-text-muted)]">Lade…</p> : null}

      <div className="mt-3 space-y-2">
        {!ticker ? (
          <input
            className="w-full rounded-md border border-[var(--app-border)] bg-[var(--app-surface-muted)] px-2 py-1.5 text-sm"
            placeholder="Ticker"
            value={tickerInput}
            onChange={(e) => setTickerInput(e.target.value.toUpperCase())}
          />
        ) : (
          <p className="text-sm text-[var(--app-text)]">
            {name ?? ticker} <span className="text-[var(--app-text-muted)]">{ticker}</span>
          </p>
        )}
        <textarea
          className="min-h-[64px] w-full rounded-md border border-[var(--app-border)] bg-[var(--app-surface-muted)] px-2 py-1.5 text-sm"
          placeholder="These"
          value={these}
          onChange={(e) => setThese(e.target.value)}
        />
        <textarea
          className="min-h-[48px] w-full rounded-md border border-[var(--app-border)] bg-[var(--app-surface-muted)] px-2 py-1.5 text-sm"
          placeholder="Kaufgrund"
          value={kaufgrund}
          onChange={(e) => setKaufgrund(e.target.value)}
        />
        <textarea
          className="min-h-[48px] w-full rounded-md border border-[var(--app-border)] bg-[var(--app-surface-muted)] px-2 py-1.5 text-sm"
          placeholder="Watchpoints"
          value={watchpoints}
          onChange={(e) => setWatchpoints(e.target.value)}
        />
        <button
          type="button"
          className="rounded-md bg-teal-600/80 px-3 py-1.5 text-xs font-medium text-white hover:bg-teal-600 disabled:opacity-50"
          disabled={speichern}
          onClick={() => void speichere()}
        >
          {speichern ? 'Speichere…' : 'Speichern'}
        </button>
      </div>

      {eintraege.length > 0 ? (
        <ul className="mt-4 space-y-2 border-t border-[var(--app-border)]/50 pt-3">
          {eintraege.map((e) => (
            <li key={e.id} className="text-[12px]">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-[var(--app-text)]">{e.ticker}</span>
                <PaBadge variant={e.status === 'aktiv' ? 'positive' : 'neutral'}>{e.status}</PaBadge>
                {e.reviewAm ? (
                  <span className="text-[var(--app-text-muted)]">Review {e.reviewAm}</span>
                ) : null}
              </div>
              {e.these ? (
                <p className="mt-1 line-clamp-2 text-[var(--app-text-muted)]">{e.these}</p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </PaCard>
  )
}
