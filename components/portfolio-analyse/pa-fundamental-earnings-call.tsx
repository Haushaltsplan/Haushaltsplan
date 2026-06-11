'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
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

function MarkdownAbschnitte(text: string): ReactNode {
  const blocks = text.split(/\n(?=##\s)/)
  return (
    <div className="space-y-6">
      {blocks.map((block, i) => {
        const lines = block.trim().split('\n')
        const first = lines[0] ?? ''
        const isHeading = /^##\s/.test(first)
        const title = isHeading ? first.replace(/^##\s*/, '').trim() : null
        const body = (isHeading ? lines.slice(1) : lines).join('\n').trim()
        return (
          <section
            key={i}
            className="relative rounded-xl border border-white/[0.04] bg-zinc-950/30 p-4 pl-5 before:absolute before:left-0 before:top-3 before:h-[calc(100%-1.5rem)] before:w-0.5 before:rounded-full before:bg-gradient-to-b before:from-amber-400/50 before:via-teal-400/25 before:to-transparent"
          >
            {title ? (
              <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-200/85">
                {title}
              </h3>
            ) : null}
            <div className="space-y-3 text-sm leading-relaxed text-zinc-300">
              {body.split(/\n\n+/).map((para, j) => {
                if (/^[-*•]\s/m.test(para)) {
                  const items = para.split(/\n/).filter((l) => l.trim())
                  return (
                    <ul key={j} className="space-y-2 text-zinc-400">
                      {items.map((item, k) => (
                        <li key={k} className="flex gap-2.5">
                          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-teal-400/70" />
                          <span>{item.replace(/^[-*•]\s*/, '')}</span>
                        </li>
                      ))}
                    </ul>
                  )
                }
                if (/^\d+\.\s/m.test(para)) {
                  const items = para.split(/\n/).filter((l) => l.trim())
                  return (
                    <ol key={j} className="list-inside list-decimal space-y-2 text-zinc-400">
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

function QuartalChip({
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
      className={`group relative shrink-0 rounded-xl border px-4 py-3 text-left transition-all duration-300 ${
        offen
          ? 'border-amber-400/40 bg-gradient-to-br from-amber-500/12 via-zinc-900/85 to-teal-500/10 shadow-lg shadow-amber-950/25 ring-1 ring-amber-400/25'
          : hatAnalyse
            ? 'border-teal-500/20 bg-zinc-950/50 hover:border-teal-500/35 hover:bg-zinc-900/60'
            : 'border-white/[0.06] bg-zinc-950/40 hover:border-zinc-500/30 hover:bg-zinc-900/60'
      }`}
    >
      <span
        className={`text-lg font-light tracking-tight ${offen ? 'text-amber-100' : 'text-zinc-300 group-hover:text-zinc-100'}`}
      >
        {q.label}
      </span>
      <span className="mt-1 block text-[10px] uppercase tracking-wider text-zinc-500">
        {hatAnalyse ? 'Analyse gespeichert' : offen ? 'Wird geladen …' : 'Klicken für Analyse'}
      </span>
      {hatAnalyse ? (
        <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-teal-500/90 text-[9px] text-zinc-950 shadow-[0_0_10px_rgba(45,212,191,0.45)]">
          ✓
        </span>
      ) : null}
      {laden ? (
        <span className="absolute bottom-2 right-2 h-3.5 w-3.5 animate-spin rounded-full border border-zinc-600 border-t-teal-400" />
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
    setDaten(null)
    setOffenesQuartalId(null)
    setFehler(null)
    if (anfrageBasis.ticker) void ladeTranskripte(false)
  }, [anfrageBasis, ladeTranskripte])

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
    <div className="space-y-5">
      <PaCard variant="elevated" className="relative overflow-hidden p-6 sm:p-7">
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-amber-500/5 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-12 -left-12 h-40 w-40 rounded-full bg-teal-500/5 blur-3xl" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-amber-400/70">Earnings Call</p>
            <h2 className="mt-2 font-serif text-xl font-light tracking-tight text-zinc-100 sm:text-2xl">
              Quartals-Transkripte & KI-Analyse
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-zinc-500">
              KI-Analysen werden dauerhaft gespeichert — ein Quartal antippen, Analyse öffnet sich. Kein erneutes
              Generieren beim nächsten Besuch.
            </p>
          </div>
          <button
            type="button"
            disabled={laden}
            onClick={() => void ladeTranskripte(true)}
            className="rounded-xl border border-white/[0.08] bg-zinc-950/50 px-4 py-2.5 text-sm font-medium text-zinc-300 backdrop-blur-sm transition hover:border-teal-500/30 hover:text-teal-200 disabled:opacity-50"
          >
            {laden ? 'Lädt …' : 'Transkripte aktualisieren'}
          </button>
        </div>
      </PaCard>

      {initialLaden ? (
        <PaCard variant="glass" className="p-12 text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-zinc-700 border-t-amber-400/80" />
          <p className="text-sm text-zinc-400">Transkripte werden gesucht …</p>
          <p className="mt-1 text-xs text-zinc-600">IR · Motley Fool · SEC · kann 30–120 Sekunden dauern</p>
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
          <PaCard variant="glass" className="overflow-hidden p-0">
            <div className="border-b border-white/[0.05] px-5 py-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">Quartale</p>
              <p className="mt-1 text-xs text-zinc-600">Grünes Häkchen = gespeicherte KI-Analyse</p>
            </div>
            <div className="space-y-6 p-5">
              {jahrGruppen.map(({ jahr, eintraege }) => (
                <div key={jahr}>
                  <div className="mb-3 flex items-center gap-3">
                    <span className="font-serif text-2xl font-light text-zinc-600">{jahr}</span>
                    <span className="h-px flex-1 bg-gradient-to-r from-zinc-700/80 to-transparent" />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {eintraege.map((q) => (
                      <QuartalChip
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

          {offenesQuartal ? (
            <div className="animate-in fade-in slide-in-from-top-2 duration-300 space-y-4">
              <PaCard variant="elevated" className="space-y-3 p-5 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-teal-400/80">
                      {offenesQuartal.label}
                    </p>
                    <h3 className="mt-1 text-base font-medium text-zinc-100">{offenesQuartal.titel}</h3>
                  </div>
                  <span className="rounded-lg border border-white/[0.06] bg-zinc-950/50 px-2.5 py-1 text-[10px] uppercase tracking-wider text-zinc-500">
                    {QUELLE_LABEL[offenesQuartal.quelle]}
                  </span>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500">
                  {offenesQuartal.callDatum ? <span>{offenesQuartal.callDatum}</span> : null}
                  <span>{offenesQuartal.transcriptZeichen.toLocaleString('de-DE')} Zeichen</span>
                </div>
                {daten.hinweis ? <p className="text-xs text-amber-200/60">{daten.hinweis}</p> : null}
                <a
                  href={offenesQuartal.transcriptUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-teal-400/90 hover:text-teal-300 hover:underline"
                >
                  Original-Transkript ↗
                </a>
              </PaCard>

              {quartalLaden === offenesQuartal.id ? (
                <PaCard variant="glass" className="p-10 text-center">
                  <div className="mx-auto mb-3 h-6 w-6 animate-spin rounded-full border-2 border-zinc-700 border-t-teal-400/80" />
                  <p className="text-sm text-zinc-500">KI-Analyse wird erstellt …</p>
                  <p className="mt-1 text-xs text-zinc-600">Einmalig — danach dauerhaft gespeichert</p>
                </PaCard>
              ) : fehler && !offenesQuartal.zusammenfassung ? (
                <PaCard variant="glass" className="p-6 text-sm text-amber-200/90">{fehler}</PaCard>
              ) : offenesQuartal.zusammenfassung ? (
                <PaCard variant="elevated" className="overflow-hidden p-0">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.05] bg-gradient-to-r from-amber-500/[0.06] via-transparent to-teal-500/[0.04] px-6 py-4">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400">
                      KI-Analyse · gespeichert
                    </p>
                    <button
                      type="button"
                      disabled={quartalLaden === offenesQuartal.id}
                      onClick={() => void ladeKiFuerQuartal(offenesQuartal.id, { forceKi: true })}
                      className="text-[11px] text-zinc-500 underline-offset-2 transition hover:text-zinc-300 hover:underline disabled:opacity-50"
                    >
                      Neu generieren
                    </button>
                  </div>
                  <div className="p-6 sm:p-8">{MarkdownAbschnitte(offenesQuartal.zusammenfassung)}</div>
                </PaCard>
              ) : null}

              <p className="text-center text-[10px] text-zinc-600">
                Stand {new Date(daten.geladenAm).toLocaleString('de-DE')} · Keine Anlageberatung
              </p>
            </div>
          ) : (
            <PaCard variant="glass" className="p-8 text-center">
              <p className="text-sm text-zinc-500">Quartal wählen — die KI-Analyse klappt auf.</p>
            </PaCard>
          )}
        </>
      ) : null}
    </div>
  )
}
