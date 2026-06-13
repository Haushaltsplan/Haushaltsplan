'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { PaCard } from '@/components/portfolio-analyse/pa-ui'
import { ladeSecBerichte, ladeSecBerichteAusLocalCache } from '@/lib/portfolio-analyse/sec-berichte-client'
import type { SecBerichtEintrag, SecBerichtePaket } from '@/lib/portfolio-analyse/sec-berichte-types'

function gruppiereBerichte(list: SecBerichtEintrag[]): { jahr: string; eintraege: SecBerichtEintrag[] }[] {
  const map = new Map<string, SecBerichtEintrag[]>()
  for (const e of list) {
    const jahr = e.berichtszeitraum?.slice(0, 4) ?? e.filingDatum?.slice(0, 4) ?? '—'
    const arr = map.get(jahr) ?? []
    arr.push(e)
    map.set(jahr, arr)
  }
  return [...map.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([jahr, eintraege]) => ({
      jahr,
      eintraege: eintraege.sort((a, b) => {
        if (a.formular !== b.formular) return a.formular === '10-K' ? -1 : 1
        return (b.filingDatum ?? '').localeCompare(a.filingDatum ?? '')
      }),
    }))
}

function BerichtZeile({
  b,
  offen,
  onClick,
  laden,
}: {
  b: SecBerichtEintrag
  offen: boolean
  onClick: () => void
  laden: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={laden}
      aria-expanded={offen}
      className={`flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-left transition ${
        offen
          ? 'border-teal-500/30 bg-teal-500/[0.08]'
          : 'border-white/[0.05] bg-zinc-950/30 hover:border-zinc-600/40 hover:bg-zinc-900/50'
      }`}
    >
      <div className="min-w-0">
        <span className={`text-sm font-medium ${offen ? 'text-teal-100' : 'text-zinc-200'}`}>{b.label}</span>
        <span className="mt-0.5 block truncate text-[11px] text-zinc-500">
          {b.formular} · {b.filingDatum ?? '—'}
        </span>
      </div>
      {laden ? (
        <span className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-zinc-600 border-t-teal-400" />
      ) : (
        <span className={`shrink-0 text-zinc-500 transition ${offen ? 'rotate-90 text-teal-400' : ''}`}>›</span>
      )}
    </button>
  )
}

export function PaFundamentalSecBerichte({
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
  const [daten, setDaten] = useState<SecBerichtePaket | null>(null)
  const [offeneId, setOffeneId] = useState<string | null>(null)
  const [laden, setLaden] = useState(false)
  const [detailLaden, setDetailLaden] = useState<string | null>(null)
  const [fehler, setFehler] = useState<string | null>(null)
  const datenRef = useRef<SecBerichtePaket | null>(null)
  datenRef.current = daten

  const anfrageBasis = useMemo(
    () => ({
      ticker: ticker?.trim() ?? '',
      firmenname,
      isin: isin ?? null,
    }),
    [ticker, firmenname, isin],
  )

  const ladeListe = useCallback(
    async (force?: boolean) => {
      if (!anfrageBasis.ticker) return
      if (!force) {
        const cached = ladeSecBerichteAusLocalCache(anfrageBasis)
        if (cached) {
          setDaten(cached)
          setFehler(null)
          return
        }
      }
      setLaden(true)
      setFehler(null)
      try {
        const res = await ladeSecBerichte({ ...anfrageBasis, force }, datenRef.current)
        setDaten(res)
        if (res.fehler) setFehler(res.fehler)
      } catch (e) {
        setFehler(e instanceof Error ? e.message : 'Abruf fehlgeschlagen')
      } finally {
        setLaden(false)
      }
    },
    [anfrageBasis],
  )

  const ladeVolltext = useCallback(
    async (accession: string) => {
      if (!anfrageBasis.ticker) return
      setDetailLaden(accession)
      try {
        const res = await ladeSecBerichte({ ...anfrageBasis, accession }, datenRef.current)
        setDaten(res)
      } catch (e) {
        setFehler(e instanceof Error ? e.message : 'Volltext fehlgeschlagen')
      } finally {
        setDetailLaden(null)
      }
    },
    [anfrageBasis],
  )

  useEffect(() => {
    datenRef.current = null
    setDaten(null)
    setOffeneId(null)
    setFehler(null)
    if (!anfrageBasis.ticker) return
    const cached = ladeSecBerichteAusLocalCache(anfrageBasis)
    if (cached) {
      setDaten(cached)
      datenRef.current = cached
      return
    }
    void ladeListe(false)
  }, [selectionKey, anfrageBasis, ladeListe])

  const jahrGruppen = useMemo(() => gruppiereBerichte(daten?.berichte ?? []), [daten?.berichte])
  const offenerBericht = useMemo(
    () => daten?.berichte.find((b) => b.id === offeneId) ?? null,
    [daten, offeneId],
  )

  const toggleBericht = (b: SecBerichtEintrag) => {
    if (offeneId === b.id) {
      setOffeneId(null)
      return
    }
    setOffeneId(b.id)
    if (!b.textVollstaendig) void ladeVolltext(b.accession)
  }

  if (!ticker?.trim()) {
    return (
      <PaCard variant="glass" className="p-8 text-center text-sm text-zinc-500">
        Kein Ticker — SEC-Berichte nur für US-Melder.
      </PaCard>
    )
  }

  const initialLaden = laden && !daten?.berichte.length

  return (
    <div className="flex h-full min-h-[320px] flex-col space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2 border-b border-white/[0.06] pb-3">
        <div>
          <h2 className="text-base font-medium text-zinc-100">Quartals- & Jahresberichte</h2>
          <p className="mt-0.5 text-xs text-zinc-500">SEC 10-Q / 10-K · Basis für Nachkauf-Radar</p>
        </div>
        <button
          type="button"
          disabled={laden}
          onClick={() => void ladeListe(true)}
          className="rounded-lg border border-zinc-700/60 bg-zinc-900/50 px-2.5 py-1.5 text-[11px] text-zinc-400 transition hover:border-zinc-600 hover:text-zinc-200 disabled:opacity-50"
        >
          {laden ? 'Lädt …' : 'Aktualisieren'}
        </button>
      </div>

      {initialLaden ? (
        <PaCard variant="glass" className="flex flex-1 items-center justify-center p-8">
          <p className="text-sm text-zinc-400">SEC EDGAR wird durchsucht …</p>
        </PaCard>
      ) : null}

      {fehler && !daten?.berichte.length ? (
        <PaCard variant="glass" className="p-4 text-sm text-amber-200/90">{fehler}</PaCard>
      ) : null}

      {daten?.berichte.length ? (
        <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[minmax(0,200px)_1fr]">
          <div className="max-h-[420px] overflow-y-auto rounded-xl border border-white/[0.05] bg-zinc-950/40 p-2">
            <div className="space-y-3">
              {jahrGruppen.map(({ jahr, eintraege }) => (
                <div key={jahr}>
                  <p className="mb-1 px-1 text-[10px] font-medium text-zinc-600">{jahr}</p>
                  <div className="space-y-1">
                    {eintraege.map((b) => (
                      <BerichtZeile
                        key={b.id}
                        b={b}
                        offen={offeneId === b.id}
                        laden={detailLaden === b.accession}
                        onClick={() => toggleBericht(b)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="min-h-0 min-w-0">
            {!offenerBericht ? (
              <PaCard variant="glass" className="flex h-full min-h-[200px] items-center justify-center p-6">
                <p className="text-sm text-zinc-500">Bericht wählen</p>
              </PaCard>
            ) : (
              <PaCard variant="glass" className="flex h-full max-h-[420px] flex-col p-4">
                <div className="mb-3 flex flex-wrap items-start justify-between gap-2 border-b border-white/[0.05] pb-3">
                  <div>
                    <h3 className="text-sm font-medium text-zinc-100">{offenerBericht.label}</h3>
                    <p className="text-[11px] text-zinc-500">
                      {offenerBericht.formular} · {offenerBericht.berichtszeitraum ?? offenerBericht.filingDatum}
                    </p>
                  </div>
                  <a
                    href={offenerBericht.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-teal-400 hover:underline"
                  >
                    SEC ↗
                  </a>
                </div>
                <div className="flex-1 overflow-y-auto whitespace-pre-wrap text-xs leading-relaxed text-zinc-400">
                  {detailLaden === offenerBericht.accession ? (
                    <p className="text-zinc-500">Volltext wird geladen …</p>
                  ) : (
                    offenerBericht.textAuszug
                  )}
                </div>
              </PaCard>
            )}
          </div>
        </div>
      ) : null}

      {daten?.hinweis ? <p className="text-[10px] text-zinc-600">{daten.hinweis}</p> : null}
    </div>
  )
}
