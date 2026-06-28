'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { EarningsCallAnalyseDarstellung } from '@/components/portfolio-analyse/pa-earnings-call-analyse'
import { PaFundamentalQuartalsDiff } from '@/components/portfolio-analyse/pa-fundamental-quartals-diff'
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
  marketbeat: 'MarketBeat',
  investing_com: 'Investing.com',
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
      className={`flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2.5 text-left transition ${
        offen
          ? 'border-teal-500/30 bg-teal-500/[0.08]'
          : 'border-white/[0.05] bg-[var(--app-surface-muted)]/30 hover:border-[var(--app-border-strong)]/40 hover:bg-[var(--app-surface-muted)]'
      }`}
    >
      <div className="min-w-0">
        <span className={`text-sm font-medium ${offen ? 'text-teal-100' : 'text-[var(--app-text)]'}`}>{q.label}</span>
        <span className="mt-0.5 block truncate text-[11px] text-[var(--app-text-muted)]">
          {q.callDatum ?? '—'} · {QUELLE_LABEL[q.quelle]}
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {hatAnalyse ? (
          <span className="rounded-full bg-teal-500/15 px-1.5 py-0.5 text-[9px] font-medium text-teal-300">KI</span>
        ) : null}
        {laden ? (
          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[var(--app-border-strong)] border-t-teal-400" />
        ) : (
          <span className={`text-[var(--app-text-muted)] transition ${offen ? 'rotate-90 text-teal-400' : ''}`}>›</span>
        )}
      </div>
    </button>
  )
}

export function PaFundamentalEarningsCallSpalte({
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
  const [detailTab, setDetailTab] = useState<'ki' | 'diff'>('ki')
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
      const hadDaten = Boolean(datenRef.current?.quartale?.length)
      if (!force) {
        const cached = ladeEarningsCallAusLocalCache(anfrageBasis)
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
        const res = await ladeEarningsCallTranskripte({ ...anfrageBasis, force }, datenRef.current)
        setDaten(res)
        if (res.fehler) setFehler(res.fehler)
        else if (!res.ok && !res.quartale.length) setFehler(res.fehler ?? 'Abruf fehlgeschlagen')
      } catch (e) {
        if (!hadDaten && !datenRef.current?.quartale?.length) {
          setFehler(e instanceof Error ? e.message : 'Abruf fehlgeschlagen')
        }
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
    setDetailTab('ki')
    if (!anfrageBasis.ticker) return

    const cached = ladeEarningsCallAusLocalCache(anfrageBasis)
    if (cached) {
      setDaten(cached)
      datenRef.current = cached
    }

    void ladeTranskripte(false)
  }, [selectionKey, anfrageBasis, ladeTranskripte])

  const jahrGruppen = useMemo(() => gruppiereNachJahr(daten?.quartale ?? []), [daten?.quartale])
  const offenesQuartal = useMemo(
    () => daten?.quartale.find((q) => q.id === offenesQuartalId) ?? null,
    [daten, offenesQuartalId],
  )

  const vorherQuartalMitKi = useMemo(() => {
    if (!offenesQuartal || !daten?.quartale.length) return null
    const sorted = [...daten.quartale].sort((a, b) => {
      if (a.jahr !== b.jahr) return b.jahr - a.jahr
      return b.quartal - a.quartal
    })
    const idx = sorted.findIndex((q) => q.id === offenesQuartal.id)
    for (let i = idx + 1; i < sorted.length; i++) {
      if (sorted[i].zusammenfassung) return sorted[i]
    }
    return null
  }, [offenesQuartal, daten?.quartale])

  const toggleQuartal = (id: string) => {
    if (offenesQuartalId === id) {
      setOffenesQuartalId(null)
      return
    }
    setOffenesQuartalId(id)
    setDetailTab('ki')
    const q = daten?.quartale.find((x) => x.id === id)
    if (!q?.zusammenfassung) void ladeKiFuerQuartal(id)
  }

  if (!ticker?.trim()) {
    return (
      <PaCard variant="glass" className="p-8 text-center text-sm text-[var(--app-text-muted)]">
        Kein Ticker — Earnings Calls benötigen ein Börsensymbol.
      </PaCard>
    )
  }

  const irUrl = daten?.investorRelationsUrl
  const initialLaden = laden && !daten?.quartale.length
  const quartalWirdGeladen = offenesQuartal && quartalLaden === offenesQuartal.id
  const hatWebcastPdf = daten?.quartale.some((q) => q.istWebcastPdf) ?? false
  const dokLabel = hatWebcastPdf ? 'Webcast-PDF' : 'Transkript'

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2 border-b border-white/[0.06] pb-3">
        <div>
          <h2 className="text-base font-medium text-[var(--app-text)]">Earnings Call</h2>
          <p className="mt-0.5 text-xs text-[var(--app-text-muted)]">{dokLabel} · KI-Analyse (Gemini)</p>
        </div>
        <button
          type="button"
          disabled={laden}
          onClick={() => void ladeTranskripte(true)}
          className="rounded-lg border border-[var(--app-border-strong)] bg-[var(--app-surface-muted)] px-2.5 py-1.5 text-[11px] text-[var(--app-text-muted)] transition hover:border-[var(--app-border-strong)] hover:text-[var(--app-text)] disabled:opacity-50"
        >
          {laden ? 'Lädt …' : 'Aktualisieren'}
        </button>
      </div>

      {initialLaden ? (
        <PaCard variant="glass" className="flex flex-1 items-center justify-center p-8">
          <p className="text-sm text-[var(--app-text-muted)]">{dokLabel} werden gesucht …</p>
        </PaCard>
      ) : null}

      {fehler && !daten?.quartale.length ? (
        <PaCard variant="glass" className="space-y-2 p-4">
          <p className="text-sm text-amber-200/90">{fehler}</p>
          {irUrl ? (
            <a href={irUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-teal-400 hover:underline">
              Investor Relations ↗
            </a>
          ) : null}
        </PaCard>
      ) : null}

      {daten?.quartale.length ? (
        <div className="grid gap-3 lg:grid-cols-[minmax(0,200px)_1fr] lg:items-start">
          <div className="rounded-xl border border-white/[0.05] bg-[var(--app-surface-muted)] p-2 lg:sticky lg:top-0 lg:max-h-[min(60vh,28rem)] lg:overflow-y-auto">
            <div className="space-y-3">
              {jahrGruppen.map(({ jahr, eintraege }) => (
                <div key={jahr}>
                  <p className="mb-1 px-1 text-[10px] font-medium text-[var(--app-text-muted)]">{jahr}</p>
                  <div className="space-y-1">
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
          </div>

          <div className="min-h-0 min-w-0">
            {!offenesQuartal ? (
              <PaCard variant="glass" className="flex h-full min-h-[200px] items-center justify-center p-6">
                <p className="text-sm text-[var(--app-text-muted)]">Quartal wählen</p>
              </PaCard>
            ) : (
              <div className="space-y-2">
                <div className="flex flex-wrap items-start justify-between gap-2 px-0.5">
                  <div>
                    <h3 className="text-sm font-medium text-[var(--app-text)]">{offenesQuartal.label}</h3>
                    <p className="text-[11px] text-[var(--app-text-muted)]">
                      {offenesQuartal.callDatum ?? '—'} · {QUELLE_LABEL[offenesQuartal.quelle]}
                    </p>
                  </div>
                  <a
                    href={offenesQuartal.transcriptUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-teal-400 hover:underline"
                  >
                    {offenesQuartal.istWebcastPdf ? 'Webcast-PDF ↗' : 'Transkript ↗'}
                  </a>
                </div>

                <div className="flex gap-1 border-b border-white/[0.05] px-0.5 pb-1">
                  <button
                    type="button"
                    onClick={() => setDetailTab('ki')}
                    className={`rounded-md px-2 py-1 text-[10px] font-medium transition ${
                      detailTab === 'ki'
                        ? 'bg-teal-500/15 text-teal-200'
                        : 'text-[var(--app-text-muted)] hover:text-[var(--app-text)]'
                    }`}
                  >
                    KI-Analyse
                  </button>
                  {offenesQuartal.zusammenfassung && vorherQuartalMitKi ? (
                    <button
                      type="button"
                      onClick={() => setDetailTab('diff')}
                      className={`rounded-md px-2 py-1 text-[10px] font-medium transition ${
                        detailTab === 'diff'
                          ? 'bg-violet-500/15 text-violet-200'
                          : 'text-[var(--app-text-muted)] hover:text-[var(--app-text)]'
                      }`}
                    >
                      Quartals-Diff
                    </button>
                  ) : null}
                </div>

                {detailTab === 'ki' ? (
                  quartalWirdGeladen ? (
                    <PaCard variant="glass" className="flex flex-1 items-center justify-center p-8">
                      <p className="text-sm text-[var(--app-text-muted)]">Gemini analysiert Earnings Call …</p>
                    </PaCard>
                  ) : fehler && !offenesQuartal.zusammenfassung ? (
                    <PaCard variant="glass" className="p-4 text-sm text-amber-200/90">{fehler}</PaCard>
                  ) : offenesQuartal.zusammenfassung ? (
                    <PaCard variant="glass" className="p-3 sm:p-4">
                      <div className="mb-3 flex items-center justify-between gap-2 border-b border-white/[0.05] pb-2">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--app-text-muted)]">
                          Quality-Analyse
                        </p>
                        <button
                          type="button"
                          disabled={quartalLaden === offenesQuartal.id}
                          onClick={() => void ladeKiFuerQuartal(offenesQuartal.id, { forceKi: true })}
                          className="text-[10px] text-[var(--app-text-muted)] hover:text-[var(--app-text-muted)] disabled:opacity-50"
                        >
                          Neu
                        </button>
                      </div>
                      <EarningsCallAnalyseDarstellung text={offenesQuartal.zusammenfassung} />
                    </PaCard>
                  ) : (
                    <PaCard variant="glass" className="flex flex-1 items-center justify-center p-6">
                      <p className="text-sm text-[var(--app-text-muted)]">Analyse wird vorbereitet …</p>
                    </PaCard>
                  )
                ) : offenesQuartal.zusammenfassung && vorherQuartalMitKi ? (
                  <PaFundamentalQuartalsDiff
                    ticker={anfrageBasis.ticker}
                    firmenname={firmenname}
                    typ="earnings_call"
                    aktuellId={offenesQuartal.id}
                    vorherId={vorherQuartalMitKi.id}
                    aktuellLabel={offenesQuartal.label}
                    vorherLabel={vorherQuartalMitKi.label}
                  />
                ) : (
                  <PaCard variant="glass" className="flex flex-1 items-center justify-center p-6">
                    <p className="text-sm text-[var(--app-text-muted)]">
                      Quartals-Diff benötigt KI-Summaries für aktuelles und vorheriges Quartal.
                    </p>
                  </PaCard>
                )}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
