'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { momentumApiFetch, parseMomentumApiJsonOderFehler, parseMomentumApiJsonOptional } from '@/lib/portfolio-analyse/momentum-trader/momentum-api-fetch'
import type { MomentumWatchlistSuchTreffer } from '@/lib/portfolio-analyse/momentum-trader/momentum-trader-types'
import { istGueltigeIsin } from '@/lib/portfolio-analyse/watchlist-client'
import { ladeIsinMetadaten } from '@/lib/portfolio-analyse/isin-metadata-client'

export type MomentumWatchlistAuswahl = {
  isin: string
  name: string
  symbolYahoo: string | null
  symbolCandidates: string[]
  istPreIpo: boolean
  ipoDatum: string | null
  notiz: string | null
}

export function MomentumWatchlistSucheInput({
  onAuswahl,
  laden,
  fehler,
  onFehler,
}: {
  onAuswahl: (auswahl: MomentumWatchlistAuswahl) => void | Promise<void>
  laden?: boolean
  fehler?: string | null
  onFehler?: (msg: string | null) => void
}) {
  const listId = useId()
  const wrapRef = useRef<HTMLDivElement>(null)
  const waehlenAktivRef = useRef(false)
  const [query, setQuery] = useState('')
  const [treffer, setTreffer] = useState<MomentumWatchlistSuchTreffer[]>([])
  const [sucheLaden, setSucheLaden] = useState(false)
  const [offen, setOffen] = useState(false)
  const [aktivIdx, setAktivIdx] = useState(-1)
  const [manuell, setManuell] = useState(false)
  const [manuellName, setManuellName] = useState('')
  const [manuellSymbol, setManuellSymbol] = useState('')
  const [manuellIpo, setManuellIpo] = useState('')

  useEffect(() => {
    const q = query.trim()
    if (q.length < 2 || manuell) {
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
          const res = await momentumApiFetch(
            '/api/portfolio-analyse/momentum-trader/watchlist-suche?q=' + encodeURIComponent(q),
          )
          const data = await parseMomentumApiJsonOptional<{ treffer?: MomentumWatchlistSuchTreffer[] }>(res)
          if (!cancelled) {
            const liste = data?.treffer ?? []
            setTreffer(liste)
            setOffen(liste.length > 0)
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
  }, [query, manuell])

  useEffect(() => {
    function onDocPointerDown(e: PointerEvent) {
      if (waehlenAktivRef.current) return
      const target = e.target as Node
      if (wrapRef.current?.contains(target)) return
      setOffen(false)
    }
    document.addEventListener('pointerdown', onDocPointerDown)
    return () => document.removeEventListener('pointerdown', onDocPointerDown)
  }, [])

  const loeseUndWaehle = useCallback(
    async (payload: {
      symbol: string
      name: string
      istPreIpo?: boolean
      ipoDatumVorschlag?: string | null
      notiz?: string | null
    }) => {
      onFehler?.(null)
      setOffen(false)
      waehlenAktivRef.current = true
      try {
        const res = await momentumApiFetch('/api/portfolio-analyse/momentum-trader/watchlist-suche', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const data = await parseMomentumApiJsonOderFehler<{ eintrag?: MomentumWatchlistAuswahl }>(
          res,
          'Titel konnte nicht aufgelöst werden.',
        )
        if (!data.eintrag) {
          onFehler?.('Titel konnte nicht aufgelöst werden.')
          return
        }
        await onAuswahl({
          isin: data.eintrag.isin,
          name: data.eintrag.name,
          symbolYahoo: data.eintrag.symbolYahoo,
          symbolCandidates: data.eintrag.symbolCandidates ?? [],
          istPreIpo: data.eintrag.istPreIpo ?? false,
          ipoDatum: data.eintrag.ipoDatum ?? null,
          notiz: data.eintrag.notiz ?? null,
        })
        setQuery('')
        setTreffer([])
        setManuell(false)
        setManuellName('')
        setManuellSymbol('')
        setManuellIpo('')
      } catch (e) {
        onFehler?.(e instanceof Error ? e.message : String(e))
      } finally {
        waehlenAktivRef.current = false
      }
    },
    [onAuswahl, onFehler],
  )

  const waehleTreffer = useCallback(
    (t: MomentumWatchlistSuchTreffer) => {
      void loeseUndWaehle({
        symbol: t.symbol,
        name: t.name,
        istPreIpo: t.istPreIpo,
        ipoDatumVorschlag: t.ipoDatumVorschlag,
        notiz: t.notiz,
      })
    },
    [loeseUndWaehle],
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
      const sym = meta.symbolYahoo?.trim().toUpperCase() || meta.symbolCandidates?.[0]?.trim().toUpperCase()
      if (!sym) {
        onFehler?.('Kein Ticker zur ISIN — manuell als Pre-IPO hinzufügen.')
        return
      }
      await loeseUndWaehle({ symbol: sym, name: meta.name || sym, istPreIpo: false })
    },
    [loeseUndWaehle, onFehler],
  )

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (manuell) {
      const name = manuellName.trim()
      const symbol = (manuellSymbol.trim() || name).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10)
      if (!name || !symbol) {
        onFehler?.('Name und Kurzsymbol angeben (z. B. SpaceX / SPACEX).')
        return
      }
      await loeseUndWaehle({
        symbol,
        name,
        istPreIpo: true,
        ipoDatumVorschlag: manuellIpo.trim() || null,
      })
      return
    }

    const q = query.trim()
    if (!q) return

    if (istGueltigeIsin(q)) {
      await waehleIsin(q.toUpperCase())
      return
    }

    if (aktivIdx >= 0 && treffer[aktivIdx]) {
      waehleTreffer(treffer[aktivIdx])
      return
    }

    if (treffer.length === 1) {
      waehleTreffer(treffer[0])
      return
    }

    if (treffer.length > 1) {
      setOffen(true)
      onFehler?.('Bitte einen Treffer aus der Liste wählen.')
      return
    }

    onFehler?.('Kein Treffer — Pre-IPO manuell hinzufügen oder anderen Namen versuchen.')
  }

  return (
    <div className="relative z-30" ref={wrapRef}>
      <form onSubmit={(e) => void onSubmit(e)}>
        <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-[var(--app-text-muted)]">
          Aktie / Pre-IPO suchen
        </label>

        {manuell ? (
          <div className="space-y-2 rounded-lg border border-violet-500/25 bg-violet-500/5 p-3">
            <input
              value={manuellName}
              onChange={(e) => setManuellName(e.target.value)}
              placeholder="Name (z. B. SpaceX)"
              className="w-full rounded-lg border border-[var(--app-border-strong)] bg-[var(--app-surface-muted)] px-3 py-2 text-sm"
            />
            <input
              value={manuellSymbol}
              onChange={(e) => setManuellSymbol(e.target.value)}
              placeholder="Kurzsymbol (z. B. SPACEX)"
              className="w-full rounded-lg border border-[var(--app-border-strong)] bg-[var(--app-surface-muted)] px-3 py-2 text-sm"
            />
            <input
              type="date"
              value={manuellIpo}
              onChange={(e) => setManuellIpo(e.target.value)}
              className="w-full rounded-lg border border-[var(--app-border-strong)] bg-[var(--app-surface-muted)] px-3 py-2 text-sm"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setManuell(false)}
                className="rounded-lg px-3 py-2 text-xs ring-1 ring-[var(--app-border)]"
              >
                Abbrechen
              </button>
              <button
                type="submit"
                disabled={laden}
                className="flex-1 rounded-lg bg-violet-600/90 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                Pre-IPO hinzufügen
              </button>
            </div>
          </div>
        ) : (
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
                  if (e.key === 'Enter' && offen && treffer.length > 0) {
                    e.preventDefault()
                    const idx = aktivIdx >= 0 ? aktivIdx : 0
                    waehleTreffer(treffer[idx])
                    return
                  }
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
                placeholder="Apple, SpaceX, AAPL …"
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
                  className="absolute left-0 right-0 top-full z-50 mt-1 max-h-[min(70vh,28rem)] overflow-y-auto rounded-xl border border-[var(--app-border-strong)] bg-[var(--app-surface-muted)] py-1.5 shadow-2xl shadow-black/50 ring-1 ring-white/5"
                >
                  {treffer.map((t, i) => (
                    <li key={t.symbol + (t.istPreIpo ? '-pre' : '') + i} role="option" aria-selected={i === aktivIdx}>
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => waehleTreffer(t)}
                        className={
                          'flex w-full flex-col px-4 py-3 text-left transition ' +
                          (i === aktivIdx ? 'bg-teal-500/15' : 'hover:bg-white/[0.06]')
                        }
                      >
                        <span className="flex items-center gap-2 text-sm font-medium text-[var(--app-text)]">
                          <span className="min-w-0 flex-1 truncate">{t.name}</span>
                          {t.istPreIpo ? (
                            <span className="shrink-0 rounded bg-violet-500/20 px-1.5 py-0.5 text-[9px] font-medium uppercase text-violet-300">
                              Pre-IPO
                            </span>
                          ) : null}
                        </span>
                        <span className="mt-1 text-xs text-[var(--app-text-muted)]">
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
        )}

        {!manuell && (
          <button
            type="button"
            onClick={() => {
              setManuell(true)
              onFehler?.(null)
              setManuellName(query.trim())
              setManuellSymbol(query.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10))
            }}
            className="mt-2 text-[10px] text-violet-300/90 underline-offset-2 hover:underline"
          >
            Pre-IPO ohne ISIN manuell hinzufügen
          </button>
        )}

        {fehler ? (
          <p className="mt-2 text-[11px] text-amber-400/90">{fehler}</p>
        ) : (
          <p className="mt-2 text-[10px] text-[var(--app-text-muted)]">
            Börsenaktien + Pre-IPO (SpaceX, Stripe …) · ISIN optional
          </p>
        )}
      </form>
    </div>
  )
}
