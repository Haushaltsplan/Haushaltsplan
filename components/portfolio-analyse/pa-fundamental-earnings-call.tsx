'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { PaCard } from '@/components/portfolio-analyse/pa-ui'
import {
  ladeEarningsCallAusLocalCache,
  ladeEarningsCallClient,
} from '@/lib/portfolio-analyse/earnings-call-client'
import type {
  EarningsCallPaket,
  EarningsCallQuartalEintrag,
  EarningsCallQuelle,
} from '@/lib/portfolio-analyse/earnings-call-types'

function MarkdownAbschnitte(text: string): ReactNode {
  const blocks = text.split(/\n(?=##\s)/)
  return (
    <div className="space-y-7">
      {blocks.map((block, i) => {
        const lines = block.trim().split('\n')
        const first = lines[0] ?? ''
        const isHeading = /^##\s/.test(first)
        const title = isHeading ? first.replace(/^##\s*/, '').trim() : null
        const body = (isHeading ? lines.slice(1) : lines).join('\n').trim()
        return (
          <section key={i} className="relative pl-4 before:absolute before:left-0 before:top-1 before:h-[calc(100%-0.25rem)] before:w-px before:bg-gradient-to-b before:from-amber-400/40 before:via-teal-400/20 before:to-transparent">
            {title ? (
              <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-200/80">
                {title}
              </h3>
            ) : null}
            <div className="space-y-3 text-sm leading-relaxed text-zinc-300">
              {body.split(/\n\n+/).map((para, j) => {
                if (/^[-*•]\s/m.test(para)) {
                  const items = para.split(/\n/).filter((l) => l.trim())
                  return (
                    <ul key={j} className="space-y-1.5 text-zinc-400">
                      {items.map((item, k) => (
                        <li key={k} className="flex gap-2">
                          <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-teal-400/60" />
                          <span>{item.replace(/^[-*•]\s*/, '')}</span>
                        </li>
                      ))}
                    </ul>
                  )
                }
                if (/^\d+\.\s/m.test(para)) {
                  const items = para.split(/\n/).filter((l) => l.trim())
                  return (
                    <ol key={j} className="list-inside list-decimal space-y-1.5 text-zinc-400">
                      {items.map((item, k) => (
                        <li key={k}>{item.replace(/^\d+\.\s*/, '')}</li>
                      ))}
                    </ol>
                  )
                }
                return <p key={j}>{para}</p>
              })}
            </div>
          </section>
        )
      })}
    </div>
  )
}

const QUELLE_LABEL: Record<EarningsCallQuelle, string> = {
  sec_edgar: 'SEC EDGAR',
  finnhub: 'Finnhub',
  ir_scrape: 'Investor Relations',
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

function QuartalChip({
  q,
  aktiv,
  onClick,
  laden,
}: {
  q: EarningsCallQuartalEintrag
  aktiv: boolean
  onClick: () => void
  laden: boolean
}) {
  const hatSummary = Boolean(q.zusammenfassung)
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={laden && aktiv}
      className={`group relative shrink-0 rounded-xl border px-4 py-3 text-left transition-all duration-300 ${
        aktiv
          ? 'border-amber-400/35 bg-gradient-to-br from-amber-500/10 via-zinc-900/80 to-teal-500/10 shadow-lg shadow-amber-950/20 ring-1 ring-amber-400/20'
          : 'border-white/[0.06] bg-zinc-950/40 hover:border-teal-500/25 hover:bg-zinc-900/60'
      }`}
    >
      <span
        className={`text-lg font-light tracking-tight ${aktiv ? 'text-amber-100' : 'text-zinc-300 group-hover:text-zinc-100'}`}
      >
        {q.label}
      </span>
      <span className="mt-1 block text-[10px] uppercase tracking-wider text-zinc-500">
        {q.callDatum ?? '—'}
      </span>
      {hatSummary ? (
        <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-teal-400/80 shadow-[0_0_8px_rgba(45,212,191,0.5)]" />
      ) : null}
    </button>
  )
}

export function PaFundamentalEarningsCall({
  ticker,
  firmenname,
  isin,
}: {
  ticker: string | null
  firmenname: string | null
  isin?: string | null
}) {
  const [daten, setDaten] = useState<EarningsCallPaket | null>(null)
  const [aktivesQuartalId, setAktivesQuartalId] = useState<string | null>(null)
  const [laden, setLaden] = useState(false)
  const [quartalLaden, setQuartalLaden] = useState<string | null>(null)
  const [fehler, setFehler] = useState<string | null>(null)
  const datenRef = useRef<EarningsCallPaket | null>(null)
  datenRef.current = daten

  const lade = useCallback(
    async (opts?: { force?: boolean; quartalId?: string | null }) => {
      if (!ticker?.trim()) return
      const anfrage = {
        ticker: ticker.trim(),
        firmenname,
        isin: isin ?? null,
        force: opts?.force,
        quartalId: opts?.quartalId,
      }
      const isQuartalWechsel = Boolean(opts?.quartalId)

      if (!opts?.force && !isQuartalWechsel) {
        const cached = ladeEarningsCallAusLocalCache(anfrage)
        if (cached) {
          setDaten(cached)
          setAktivesQuartalId(cached.aktivesQuartalId ?? cached.quartale[0]?.id ?? null)
          setFehler(null)
          return
        }
      }

      if (isQuartalWechsel && opts?.quartalId) setQuartalLaden(opts.quartalId)
      else setLaden(true)
      setFehler(null)

      try {
        const res = await ladeEarningsCallClient(anfrage, datenRef.current)
        setDaten(res)
        setAktivesQuartalId(res.aktivesQuartalId ?? opts?.quartalId ?? res.quartale[0]?.id ?? null)
        if (res.fehler) setFehler(res.fehler)
        else if (!res.ok && !res.quartale.length) setFehler(res.fehler ?? 'Abruf fehlgeschlagen')
      } catch (e) {
        setFehler(e instanceof Error ? e.message : 'Abruf fehlgeschlagen')
      } finally {
        setLaden(false)
        setQuartalLaden(null)
      }
    },
    [ticker, firmenname, isin],
  )

  useEffect(() => {
    setDaten(null)
    setAktivesQuartalId(null)
    setFehler(null)
    if (ticker?.trim()) void lade({ force: false })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- nur bei Ticker/ISIN neu
  }, [ticker, firmenname, isin])

  const jahrGruppen = useMemo(() => gruppiereNachJahr(daten?.quartale ?? []), [daten?.quartale])

  const aktivesQuartal = useMemo(
    () => daten?.quartale.find((q) => q.id === aktivesQuartalId) ?? daten?.quartale[0] ?? null,
    [daten, aktivesQuartalId],
  )

  const waehleQuartal = (id: string) => {
    setAktivesQuartalId(id)
    const q = daten?.quartale.find((x) => x.id === id)
    if (q?.zusammenfassung) return
    void lade({ quartalId: id })
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
    <div className="space-y-5">
      {/* Hero-Header */}
      <PaCard
        variant="elevated"
        className="relative overflow-hidden p-6 sm:p-7"
      >
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-amber-500/5 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-12 -left-12 h-40 w-40 rounded-full bg-teal-500/5 blur-3xl" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-amber-400/70">Earnings Call</p>
            <h2 className="mt-2 font-serif text-xl font-light tracking-tight text-zinc-100 sm:text-2xl">
              Quartals-Transkripte & KI-Analyse
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-zinc-500">
              US: SEC EDGAR · EU/CH: Investor Relations (Scrape) · Zusammenfassung durch Finanz-Coach
            </p>
          </div>
          <button
            type="button"
            disabled={laden}
            onClick={() => void lade({ force: true })}
            className="rounded-xl border border-white/[0.08] bg-zinc-950/50 px-4 py-2.5 text-sm font-medium text-zinc-300 backdrop-blur-sm transition hover:border-teal-500/30 hover:text-teal-200 disabled:opacity-50"
          >
            {laden ? 'Lädt …' : 'Aktualisieren'}
          </button>
        </div>
      </PaCard>

      {initialLaden ? (
        <PaCard variant="glass" className="p-12 text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-zinc-700 border-t-amber-400/80" />
          <p className="text-sm text-zinc-400">Transkripte werden gesucht …</p>
          <p className="mt-1 text-xs text-zinc-600">SEC oder IR-Seite · kann 30–120 Sekunden dauern</p>
        </PaCard>
      ) : null}

      {fehler && !daten?.quartale.length ? (
        <PaCard variant="glass" className="space-y-3 p-6">
          <p className="text-sm text-amber-200/90">{fehler}</p>
          {daten?.hinweis ? <p className="text-xs text-zinc-500">{daten.hinweis}</p> : null}
          {irUrl ? (
            <a
              href={irUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block text-sm text-teal-400 hover:underline"
            >
              Investor Relations öffnen ↗
            </a>
          ) : null}
        </PaCard>
      ) : null}

      {daten?.quartale.length ? (
        <>
          {/* Quartals-Timeline nach Jahren */}
          <PaCard variant="glass" className="overflow-hidden p-0">
            <div className="border-b border-white/[0.05] px-5 py-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">Quartalsübersicht</p>
            </div>
            <div className="space-y-6 p-5">
              {jahrGruppen.map(({ jahr, eintraege }) => (
                <div key={jahr}>
                  <div className="mb-3 flex items-center gap-3">
                    <span className="font-serif text-2xl font-light text-zinc-600">{jahr}</span>
                    <span className="h-px flex-1 bg-gradient-to-r from-zinc-700/80 to-transparent" />
                  </div>
                  <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:thin]">
                    {eintraege.map((q) => (
                      <QuartalChip
                        key={q.id}
                        q={q}
                        aktiv={aktivesQuartalId === q.id}
                        laden={quartalLaden === q.id}
                        onClick={() => waehleQuartal(q.id)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </PaCard>

          {aktivesQuartal ? (
            <>
              <PaCard variant="elevated" className="space-y-3 p-5 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-teal-400/80">
                      {aktivesQuartal.label}
                    </p>
                    <h3 className="mt-1 text-base font-medium text-zinc-100">{aktivesQuartal.titel}</h3>
                  </div>
                  <span className="rounded-lg border border-white/[0.06] bg-zinc-950/50 px-2.5 py-1 text-[10px] uppercase tracking-wider text-zinc-500">
                    {QUELLE_LABEL[aktivesQuartal.quelle]}
                  </span>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500">
                  {aktivesQuartal.callDatum ? <span>{aktivesQuartal.callDatum}</span> : null}
                  <span>{aktivesQuartal.transcriptZeichen.toLocaleString('de-DE')} Zeichen</span>
                  {daten.ausCache ? <span>Gecacht</span> : null}
                </div>
                {daten.hinweis ? <p className="text-xs text-amber-200/60">{daten.hinweis}</p> : null}
                <a
                  href={aktivesQuartal.transcriptUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-teal-400/90 hover:text-teal-300 hover:underline"
                >
                  Original-Dokument ↗
                </a>
              </PaCard>

              {quartalLaden === aktivesQuartal.id || (laden && !aktivesQuartal.zusammenfassung) ? (
                <PaCard variant="glass" className="p-10 text-center">
                  <div className="mx-auto mb-3 h-6 w-6 animate-spin rounded-full border-2 border-zinc-700 border-t-teal-400/80" />
                  <p className="text-sm text-zinc-500">KI-Zusammenfassung wird erstellt …</p>
                </PaCard>
              ) : fehler && !aktivesQuartal.zusammenfassung ? (
                <PaCard variant="glass" className="p-6 text-sm text-amber-200/90">{fehler}</PaCard>
              ) : aktivesQuartal.zusammenfassung ? (
                <PaCard variant="elevated" className="p-6 sm:p-8">
                  <p className="mb-6 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">
                    KI-Zusammenfassung
                  </p>
                  {MarkdownAbschnitte(aktivesQuartal.zusammenfassung)}
                </PaCard>
              ) : null}

              <p className="text-center text-[10px] text-zinc-600">
                Stand {new Date(daten.geladenAm).toLocaleString('de-DE')} · Keine Anlageberatung
              </p>
            </>
          ) : null}
        </>
      ) : null}
    </div>
  )
}
