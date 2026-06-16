'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { EarningsCallAnalyseDarstellung } from '@/components/portfolio-analyse/pa-earnings-call-analyse'
import { PaFundamentalQuartalsDiff } from '@/components/portfolio-analyse/pa-fundamental-quartals-diff'
import { PaCard } from '@/components/portfolio-analyse/pa-ui'
import {
  erneuereSecBerichteKi,
  ladeSecBerichteAusLocalCache,
  ladeSecBerichteKiFuerBericht,
  ladeSecBerichteListe,
} from '@/lib/portfolio-analyse/sec-berichte-client'
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
        const prio = (f: SecBerichtEintrag['formular']) =>
          f === '10-K' || f === 'IR-FY' ? 0 : f === '10-Q' || f === 'IR-Q' ? 1 : 2
        const pa = prio(a.formular)
        const pb = prio(b.formular)
        if (pa !== pb) return pa - pb
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
  const hatAnalyse = Boolean(b.zusammenfassung)
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
      <div className="flex shrink-0 items-center gap-1.5">
        {hatAnalyse ? (
          <span className="rounded-full bg-teal-500/15 px-1.5 py-0.5 text-[9px] font-medium text-teal-300">KI</span>
        ) : null}
        {laden ? (
          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-zinc-600 border-t-teal-400" />
        ) : (
          <span className={`text-zinc-500 transition ${offen ? 'rotate-90 text-teal-400' : ''}`}>›</span>
        )}
      </div>
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
  const [berichtLaden, setBerichtLaden] = useState<string | null>(null)
  const [fehler, setFehler] = useState<string | null>(null)
  const [detailTab, setDetailTab] = useState<'ki' | 'diff'>('ki')
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
      const hadDaten = Boolean(datenRef.current?.berichte?.length)
      if (!force) {
        const cached = ladeSecBerichteAusLocalCache(anfrageBasis)
        if (cached) {
          setDaten(cached)
          setFehler(null)
        }
      }
      if (force || !hadDaten) {
        setLaden(true)
        setFehler(null)
      }
      try {
        const res = await ladeSecBerichteListe({ ...anfrageBasis, force }, datenRef.current)
        setDaten(res)
        if (res.fehler) setFehler(res.fehler)
      } catch (e) {
        if (!hadDaten && !datenRef.current?.berichte?.length) {
          setFehler(e instanceof Error ? e.message : 'Abruf fehlgeschlagen')
        }
      } finally {
        setLaden(false)
      }
    },
    [anfrageBasis],
  )

  const ladeKiFuerBericht = useCallback(
    async (berichtId: string, opts?: { forceKi?: boolean }) => {
      if (!anfrageBasis.ticker) return
      setBerichtLaden(berichtId)
      setFehler(null)
      try {
        const fn = opts?.forceKi ? erneuereSecBerichteKi : ladeSecBerichteKiFuerBericht
        const res = await fn({ ...anfrageBasis, berichtId }, datenRef.current)
        setDaten(res)
        if (res.fehler) setFehler(res.fehler)
      } catch (e) {
        setFehler(e instanceof Error ? e.message : 'KI-Analyse fehlgeschlagen')
      } finally {
        setBerichtLaden(null)
      }
    },
    [anfrageBasis],
  )

  useEffect(() => {
    datenRef.current = null
    setDaten(null)
    setOffeneId(null)
    setBerichtLaden(null)
    setFehler(null)
    setDetailTab('ki')
    if (!anfrageBasis.ticker) return

    const cached = ladeSecBerichteAusLocalCache(anfrageBasis)
    if (cached) {
      setDaten(cached)
      datenRef.current = cached
    }

    void ladeListe(false)
  }, [selectionKey, anfrageBasis, ladeListe])

  const jahrGruppen = useMemo(() => gruppiereBerichte(daten?.berichte ?? []), [daten?.berichte])
  const offenerBericht = useMemo(
    () => daten?.berichte.find((b) => b.id === offeneId) ?? null,
    [daten, offeneId],
  )

  const vorherBerichtMitKi = useMemo(() => {
    if (!offenerBericht || !daten?.berichte.length) return null
    const sorted = [...daten.berichte].sort((a, b) =>
      (b.filingDatum ?? '').localeCompare(a.filingDatum ?? ''),
    )
    const idx = sorted.findIndex((b) => b.id === offenerBericht.id)
    for (let i = idx + 1; i < sorted.length; i++) {
      if (sorted[i].zusammenfassung) return sorted[i]
    }
    return null
  }, [offenerBericht, daten?.berichte])

  const toggleBericht = (b: SecBerichtEintrag) => {
    if (offeneId === b.id) {
      setOffeneId(null)
      return
    }
    setOffeneId(b.id)
    setDetailTab('ki')
    if (!b.zusammenfassung) void ladeKiFuerBericht(b.id)
  }

  if (!ticker?.trim()) {
    return (
      <PaCard variant="glass" className="p-8 text-center text-sm text-zinc-500">
        Kein Ticker — SEC-Berichte nur für US-Melder.
      </PaCard>
    )
  }

  const initialLaden = laden && !daten?.berichte.length
  const berichtWirdGeladen = offenerBericht && berichtLaden === offenerBericht.id

  return (
    <div className="flex h-full min-h-[320px] flex-col space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2 border-b border-white/[0.06] pb-3">
        <div>
          <h2 className="text-base font-medium text-zinc-100">Quartals- & Jahresberichte</h2>
          <p className="mt-0.5 text-xs text-zinc-500">Finanzberichte (SEC / IR-PDF) · KI-Analyse (Gemini)</p>
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
                        laden={berichtLaden === b.id}
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
              <div className="flex h-full max-h-[420px] flex-col space-y-2">
                <div className="flex flex-wrap items-start justify-between gap-2 px-0.5">
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

                <div className="flex gap-1 border-b border-white/[0.05] px-0.5 pb-1">
                  <button
                    type="button"
                    onClick={() => setDetailTab('ki')}
                    className={`rounded-md px-2 py-1 text-[10px] font-medium transition ${
                      detailTab === 'ki'
                        ? 'bg-teal-500/15 text-teal-200'
                        : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    KI-Analyse
                  </button>
                  {offenerBericht.zusammenfassung && vorherBerichtMitKi ? (
                    <button
                      type="button"
                      onClick={() => setDetailTab('diff')}
                      className={`rounded-md px-2 py-1 text-[10px] font-medium transition ${
                        detailTab === 'diff'
                          ? 'bg-violet-500/15 text-violet-200'
                          : 'text-zinc-500 hover:text-zinc-300'
                      }`}
                    >
                      Quartals-Diff
                    </button>
                  ) : null}
                </div>

                {detailTab === 'ki' ? (
                  berichtWirdGeladen ? (
                    <PaCard variant="glass" className="flex flex-1 items-center justify-center p-8">
                      <p className="text-sm text-zinc-500">Gemini analysiert 10-Q/10-K …</p>
                    </PaCard>
                  ) : fehler && !offenerBericht.zusammenfassung ? (
                    <PaCard variant="glass" className="p-4 text-sm text-amber-200/90">{fehler}</PaCard>
                  ) : offenerBericht.zusammenfassung ? (
                    <PaCard variant="glass" className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
                      <div className="mb-3 flex items-center justify-between gap-2 border-b border-white/[0.05] pb-2">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                          Quality-Analyse
                        </p>
                        <button
                          type="button"
                          disabled={berichtLaden === offenerBericht.id}
                          onClick={() => void ladeKiFuerBericht(offenerBericht.id, { forceKi: true })}
                          className="text-[10px] text-zinc-600 hover:text-zinc-400 disabled:opacity-50"
                        >
                          Neu
                        </button>
                      </div>
                      <EarningsCallAnalyseDarstellung text={offenerBericht.zusammenfassung} />
                    </PaCard>
                  ) : (
                    <PaCard variant="glass" className="flex flex-1 items-center justify-center p-6">
                      <p className="text-sm text-zinc-500">Analyse wird vorbereitet …</p>
                    </PaCard>
                  )
                ) : offenerBericht.zusammenfassung && vorherBerichtMitKi ? (
                  <PaFundamentalQuartalsDiff
                    ticker={anfrageBasis.ticker}
                    firmenname={firmenname}
                    typ="sec_bericht"
                    aktuellId={offenerBericht.id}
                    vorherId={vorherBerichtMitKi.id}
                    aktuellLabel={offenerBericht.label}
                    vorherLabel={vorherBerichtMitKi.label}
                  />
                ) : (
                  <PaCard variant="glass" className="flex flex-1 items-center justify-center p-6">
                    <p className="text-sm text-zinc-500">
                      Quartals-Diff benötigt KI-Summaries für aktuellen und vorherigen Bericht.
                    </p>
                  </PaCard>
                )}
              </div>
            )}
          </div>
        </div>
      ) : null}

      {daten?.hinweis ? <p className="text-[10px] text-zinc-600">{daten.hinweis}</p> : null}
    </div>
  )
}
