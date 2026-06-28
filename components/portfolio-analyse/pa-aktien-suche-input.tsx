'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import type { AktienSuchTreffer } from '@/lib/portfolio-analyse/aktien-suche-server'
import { loeseAktieAusSucheClient, sucheAktienClient } from '@/lib/portfolio-analyse/aktien-suche-client'
import { istGueltigeIsin } from '@/lib/portfolio-analyse/watchlist-client'
import { ladeIsinMetadaten } from '@/lib/portfolio-analyse/isin-metadata-client'
import type { IsinMetadata } from '@/lib/portfolio-analyse/isin-lookup-server'

export type AktienSucheAuswahl = {
  meta: IsinMetadata
  isin: string | null
}

export function PaAktienSucheInput({
  onAuswahl,
  laden,
  fehler,
  onFehler,
}: {
  onAuswahl: (auswahl: AktienSucheAuswahl) => void | Promise<void>
  laden?: boolean
  fehler?: string | null
  onFehler?: (msg: string | null) => void
}) {
  const listId = useId()
  const wrapRef = useRef<HTMLDivElement>(null)
  const [query, setQuery] = useState('')
  const [treffer, setTreffer] = useState<AktienSuchTreffer[]>([])
  const [sucheLaden, setSucheLaden] = useState(false)
  const [offen, setOffen] = useState(false)
  const [aktivIdx, setAktivIdx] = useState(-1)

  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) {
      setTreffer([])
      setOffen(false)
      return
    }
    if (istGueltigeIsin(q)) {
      setTreffer([])
      setOffen(false)
      return
    }

    let cancelled = false
    const timer = window.setTimeout(() => {
      async function run() {
        setSucheLaden(true)
        try {
          const res = await sucheAktienClient(q)
          if (!cancelled) {
            setTreffer(res)
            setOffen(res.length > 0)
            setAktivIdx(-1)
          }
        } catch {
          if (!cancelled) setTreffer([])
        } finally {
          if (!cancelled) setSucheLaden(false)
        }
      }
      void run()
    }, 280)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [query])

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOffen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  const waehleTreffer = useCallback(
    async (t: AktienSuchTreffer) => {
      onFehler?.(null)
      setOffen(false)
      setQuery(t.name)
      const aufgeloest = await loeseAktieAusSucheClient(t.symbol, t.name)
      if (!aufgeloest) {
        onFehler?.('Aktie konnte nicht aufgelöst werden.')
        return
      }
      await onAuswahl(aufgeloest)
      setQuery('')
    },
    [onAuswahl, onFehler],
  )

  const waehleIsin = useCallback(
    async (isin: string) => {
      onFehler?.(null)
      setOffen(false)
      const map = await ladeIsinMetadaten([isin])
      const meta = map.get(isin)
      if (!meta?.symbolYahoo && !meta?.name) {
        onFehler?.('ISIN nicht gefunden — prüfe die Eingabe.')
        return
      }
      const assetType = meta.assetType?.toLowerCase() ?? ''
      if (assetType.includes('etf') || assetType.includes('fund')) {
        onFehler?.('ETFs/Fonds eignen sich nicht für Macrotrends-Fundamentaldaten.')
        return
      }
      await onAuswahl({ meta, isin })
      setQuery('')
    },
    [onAuswahl, onFehler],
  )

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    const q = query.trim()
    if (!q) return

    if (istGueltigeIsin(q)) {
      await waehleIsin(q.toUpperCase())
      return
    }

    if (aktivIdx >= 0 && treffer[aktivIdx]) {
      await waehleTreffer(treffer[aktivIdx])
      return
    }

    if (treffer.length === 1) {
      await waehleTreffer(treffer[0])
      return
    }

    if (treffer.length > 1) {
      setOffen(true)
      onFehler?.('Bitte einen Treffer aus der Liste wählen.')
      return
    }

    onFehler?.('Keine Aktie gefunden — anderen Namen oder Ticker versuchen.')
  }

  return (
    <div className="relative" ref={wrapRef}>
    <form onSubmit={(e) => void onSubmit(e)}>
      <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-[var(--app-text-muted)]">
        Aktie suchen
      </label>
      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              onFehler?.(null)
            }}
            onFocus={() => {
              if (treffer.length > 0) setOffen(true)
            }}
            onKeyDown={(e) => {
              if (!offen || treffer.length === 0) return
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                setAktivIdx((i) => Math.min(treffer.length - 1, i + 1))
              } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                setAktivIdx((i) => Math.max(0, i - 1))
              } else if (e.key === 'Escape') {
                setOffen(false)
              }
            }}
            placeholder="Apple, Microsoft, AAPL …"
            autoComplete="off"
            aria-autocomplete="list"
            aria-controls={listId}
            aria-expanded={offen}
            className="w-full rounded-lg border border-[var(--app-border-strong)] bg-[var(--app-surface-muted)] px-3 py-2 text-sm text-[var(--app-text)] placeholder:text-[var(--app-text-muted)]"
          />
          {sucheLaden ? (
            <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-[var(--app-text-muted)]">
              …
            </span>
          ) : null}
          {offen && treffer.length > 0 ? (
            <ul
              id={listId}
              role="listbox"
              className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-[var(--app-border-strong)] bg-[var(--app-surface-muted)] py-1 shadow-xl shadow-black/40"
            >
              {treffer.map((t, i) => (
                <li key={t.symbol} role="option" aria-selected={i === aktivIdx}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => void waehleTreffer(t)}
                    className={`flex w-full flex-col px-3 py-2 text-left transition ${
                      i === aktivIdx ? 'bg-teal-500/15' : 'hover:bg-white/[0.04]'
                    }`}
                  >
                    <span className="truncate text-sm font-medium text-[var(--app-text)]">{t.name}</span>
                    <span className="mt-0.5 text-[11px] text-[var(--app-text-muted)]">
                      {t.symbol}
                      {t.exchange ? ` · ${t.exchange}` : ''}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <button
          type="submit"
          disabled={laden || !query.trim()}
          className="shrink-0 rounded-lg bg-teal-600/90 px-3 py-2 text-sm font-medium text-white hover:bg-teal-500 disabled:opacity-50"
        >
          +
        </button>
      </div>
      {fehler ? (
        <p className="mt-2 text-[11px] text-amber-400/90">{fehler}</p>
      ) : (
        <p className="mt-2 text-[10px] text-[var(--app-text-muted)]">Name, Ticker oder ISIN · nur Einzelaktien</p>
      )}
    </form>
    </div>
  )
}
