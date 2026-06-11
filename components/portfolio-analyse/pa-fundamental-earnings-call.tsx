'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { EarningsCallAnalyseDarstellung } from '@/components/portfolio-analyse/pa-earnings-call-analyse'
import { PaCard } from '@/components/portfolio-analyse/pa-ui'
import {
  erneuereEarningsCallKi,
  ladeEarningsCallAusLocalCache,
  ladeEarningsCallKiFuerQuartal,
  ladeEarningsCallTranskripte,
} from '@/lib/portfolio-analyse/earnings-call-client'
import type {
  EarningsCallPaket,
  EarningsCallQuartalEintrag,
  EarningsCallQuelle,
} from '@/lib/portfolio-analyse/earnings-call-types'

const QUELLE_LABEL: Record<EarningsCallQuelle, string> = {
  sec_edgar: 'SEC EDGAR',
  finnhub: 'Finnhub',
  ir_scrape: 'Investor Relations',
  motley_fool: 'Motley Fool',
}

function gruppiereNachJahr(list: EarningsCallQuartalEintrag[]): { jahr: number; eintraege: EarningsCallQuartalEintrag[] }[] {
  const map = new Map<number, EarningsCallQuartalEintrag[]>()
  for (const e of list) {
    const arr = map.get(e.jahr) ?? []
    arr.push(e)
    map.set(e.jahr, arr)
  }
  return [...map.entries()]
    .sort(([a], [b]) => b - a)
    .map(([jahr, eintraege]) => ({
      jahr,
      eintraege: eintraege.sort((a, b) => b.quartal - a.quartal),
    }))
}

function QuartalZeile({
  q,
  offen,
  onClick,
  laden,
}: {
  q: EarningsCallQuartalEintrag
  offen: boolean
  onClick: () => void
  laden: boolean
}) {
  const hatAnalyse = Boolean(q.zusammenfassung)
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={laden}
      aria-expanded={offen}
      className={`flex w-full items-center justify-between gap-3 rounded-lg border px-4 py-3 text-left transition ${
        offen
          ? 'border-teal-500/30 bg-teal-500/[0.08]'
          : 'border-white/[0.05] bg-zinc-950/30 hover:border-zinc-600/40 hover:bg-zinc-900/50'
      }`}
    >
      <div className="min-w-0">
        <span className={`text-base font-medium ${offen ? 'text-teal-100' : 'text-zinc-200'}`}>{q.label}</span>
        <span className="mt-0.5 block truncate text-xs text-zinc-500">
          {q.callDatum ?? '—'} · {QUELLE_LABEL[q.quelle]}
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {hatAnalyse ? (
          <span className="rounded-full bg-teal-500/15 px-2 py-0.5 text-[10px] font-medium text-teal-300">
            Analyse
          </span>
        ) : (
          <span className="text-[10px] text-zinc-600">Antippen</span>
        )}
        {laden ? (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-600 border-t-teal-400" />
        ) : (
          <span className={`text-zinc-500 transition ${offen ? 'rotate-90 text-teal-400' : ''}`}>›</span>
        )}
      </div>
    </button>
  )
}

export function PaFundamentalEarningsCall({
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
  const [daten, setDaten] = useState<EarningsCallPaket | null>(null)
  const [offenesQuartalId, setOffenesQuartalId] = useState<string | null>(null)
  const [laden, setLaden] = useState(false)
  const [quartalLaden, setQuartalLaden] = useState<string | null>(null)
  const [fehler, setFehler] = useState<string | null>(null)
  const datenRef = useRef<EarningsCallPaket | null>(null)
  datenRef.current = daten

  const anfrageBasis = useMemo(
    () => ({
      ticker: ticker?.trim() ?? '',
      firmenname,
      isin: isin ?? null,
    }),
    [ticker, firmenname, isin],
  )

  const ladeTranskripte = useCallback(
    async (force?: boolean) => {
      if (!anfrageBasis.ticker) return
      if (!force) {
        const cached = ladeEarningsCallAusLocalCache(anfrageBasis)
        if (cached) {
          setDaten(cached)
          setFehler(null)
          return
        }
      }
      setLaden(true)
      setFehler(null)
      try {
        const res = await ladeEarningsCallTranskripte({ ...anfrageBasis, force }, datenRef.current)
        setDaten(res)
        if (res.fehler) setFehler(res.fehler)
        else if (!res.ok && !res.quartale.length) setFehler(res.fehler ?? 'Abruf fehlgeschlagen')
      } catch (e) {
        setFehler(e instanceof Error ? e.message : 'Abruf fehlgeschlagen')
      } finally {
        setLaden(false)
      }
    },
    [anfrageBasis],
  )

  const ladeKiFuerQuartal = useCallback(
    async (quartalId: string, opts?: { forceKi?: boolean }) => {
      if (!anfrageBasis.ticker) return
      setQuartalLaden(quartalId)
      setFehler(null)
      try {
        const fn = opts?.forceKi ? erneuereEarningsCallKi : ladeEarningsCallKiFuerQuartal
        const res = await fn({ ...anfrageBasis, quartalId }, datenRef.current)
        setDaten(res)
        if (res.fehler) setFehler(res.fehler)
      } catch (e) {
        setFehler(e instanceof Error ? e.message : 'KI-Analyse fehlgeschlagen')
      } finally {
        setQuartalLaden(null)
      }
    },
    [anfrageBasis],
  )

  useEffect(() => {
    datenRef.current = null
    setDaten(null)
    setOffenesQuartalId(null)
    setQuartalLaden(null)
    setFehler(null)
    if (!anfrageBasis.ticker) return

    const cached = ladeEarningsCallAusLocalCache(anfrageBasis)
    if (cached) {
      setDaten(cached)
      datenRef.current = cached
      return
    }

    void ladeTranskripte(false)
  }, [selectionKey, anfrageBasis, ladeTranskripte])

  const jahrGruppen = useMemo(() => gruppiereNachJahr(daten?.quartale ?? []), [daten?.quartale])
  const offenesQuartal = useMemo(
    () => daten?.quartale.find((q) => q.id === offenesQuartalId) ?? null,
    [daten, offenesQuartalId],
  )

  const toggleQuartal = (id: string) => {
    if (offenesQuartalId === id) {
      setOffenesQuartalId(null)
      return
    }
    setOffenesQuartalId(id)
    const q = daten?.quartale.find((x) => x.id === id)
    if (!q?.zusammenfassung) void ladeKiFuerQuartal(id)
  }

  if (!ticker?.trim()) {
    return (
      <PaCard variant="glass" className="p-10 text-center text-sm text-zinc-500">
        Kein Ticker — für Earnings-Transkripte ein Börsensymbol nötig.
      </PaCard>
    )
  }

  const irUrl = daten?.investorRelationsUrl
  const initialLaden = laden && !daten?.quartale.length

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-white/[0.06] pb-4">
        <div>
          <h2 className="text-lg font-medium text-zinc-100">Earnings Call</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Quartal wählen · KI-Analyse wird dauerhaft gespeichert
          </p>
        </div>
        <button
          type="button"
          disabled={laden}
          onClick={() => void ladeTranskripte(true)}
          className="rounded-lg border border-zinc-700/60 bg-zinc-900/50 px-3 py-2 text-xs text-zinc-400 transition hover:border-zinc-600 hover:text-zinc-200 disabled:opacity-50"
        >
          {laden ? 'Lädt …' : 'Transkripte aktualisieren'}
        </button>
      </div>

      {initialLaden ? (
        <PaCard variant="glass" className="p-10 text-center">
          <div className="mx-auto mb-3 h-7 w-7 animate-spin rounded-full border-2 border-zinc-700 border-t-teal-400" />
          <p className="text-sm text-zinc-400">Transkripte werden gesucht …</p>
          <p className="mt-1 text-xs text-zinc-600">Motley Fool · IR · SEC</p>
        </PaCard>
      ) : null}

      {fehler && !daten?.quartale.length ? (
        <PaCard variant="glass" className="space-y-3 p-5">
          <p className="text-sm text-amber-200/90">{fehler}</p>
          {irUrl ? (
            <a href={irUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-teal-400 hover:underline">
              Investor Relations ↗
            </a>
          ) : null}
        </PaCard>
      ) : null}

      {daten?.quartale.length ? (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,280px)_1fr]">
          <PaCard variant="glass" className="h-fit p-3">
            <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Quartale</p>
            <div className="space-y-4">
              {jahrGruppen.map(({ jahr, eintraege }) => (
                <div key={jahr}>
                  <p className="mb-1.5 px-1 text-xs font-medium text-zinc-600">{jahr}</p>
                  <div className="space-y-1.5">
                    {eintraege.map((q) => (
                      <QuartalZeile
                        key={q.id}
                        q={q}
                        offen={offenesQuartalId === q.id}
                        laden={quartalLaden === q.id}
                        onClick={() => toggleQuartal(q.id)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </PaCard>

          <div className="min-w-0">
            {!offenesQuartal ? (
              <PaCard variant="glass" className="flex min-h-[200px] items-center justify-center p-8">
                <p className="text-sm text-zinc-500">Links ein Quartal wählen</p>
              </PaCard>
            ) : (
              <div className="space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-2 px-1">
                  <div>
                    <h3 className="text-base font-medium text-zinc-100">{offenesQuartal.label}</h3>
                    <p className="mt-0.5 line-clamp-2 text-xs text-zinc-500">{offenesQuartal.titel}</p>
                  </div>
                  <a
                    href={offenesQuartal.transcriptUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 text-xs text-teal-400 hover:underline"
                  >
                    Transkript ↗
                  </a>
                </div>

                {quartalLaden === offenesQuartal.id ? (
                  <PaCard variant="glass" className="p-12 text-center">
                    <div className="mx-auto mb-3 h-6 w-6 animate-spin rounded-full border-2 border-zinc-700 border-t-teal-400" />
                    <p className="text-sm text-zinc-500">Gemini analysiert …</p>
                    <p className="mt-1 text-xs text-zinc-600">Einmalig — danach gespeichert</p>
                  </PaCard>
                ) : fehler && !offenesQuartal.zusammenfassung ? (
                  <PaCard variant="glass" className="p-5 text-sm text-amber-200/90">
                    {fehler}
                  </PaCard>
                ) : offenesQuartal.zusammenfassung ? (
                  <PaCard variant="glass" className="p-4 sm:p-5">
                    <div className="mb-4 flex items-center justify-between gap-2 border-b border-white/[0.05] pb-3">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                        KI-Analyse · Gemini
                      </p>
                      <button
                        type="button"
                        disabled={quartalLaden === offenesQuartal.id}
                        onClick={() => void ladeKiFuerQuartal(offenesQuartal.id, { forceKi: true })}
                        className="text-[11px] text-zinc-600 hover:text-zinc-400 disabled:opacity-50"
                      >
                        Neu generieren
                      </button>
                    </div>
                    <EarningsCallAnalyseDarstellung text={offenesQuartal.zusammenfassung} />
                  </PaCard>
                ) : null}

                <p className="px-1 text-[10px] text-zinc-600">
                  Stand {new Date(daten.geladenAm).toLocaleString('de-DE')} · Keine Anlageberatung
                </p>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
