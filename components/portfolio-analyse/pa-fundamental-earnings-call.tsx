'use client'

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { PaCard } from '@/components/portfolio-analyse/pa-ui'
import {
  ladeEarningsCallAusLocalCache,
  ladeEarningsCallClient,
} from '@/lib/portfolio-analyse/earnings-call-client'
import type { EarningsCallPaket } from '@/lib/portfolio-analyse/earnings-call-types'

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
          <section key={i}>
            {title ? (
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-teal-300/90">{title}</h3>
            ) : null}
            <div className="space-y-2 text-sm leading-relaxed text-zinc-300">
              {body.split(/\n\n+/).map((para, j) => {
                if (/^[-*•]\s/m.test(para)) {
                  const items = para.split(/\n/).filter((l) => l.trim())
                  return (
                    <ul key={j} className="list-inside list-disc space-y-1 text-zinc-400">
                      {items.map((item, k) => (
                        <li key={k}>{item.replace(/^[-*•]\s*/, '')}</li>
                      ))}
                    </ul>
                  )
                }
                if (/^\d+\.\s/m.test(para)) {
                  const items = para.split(/\n/).filter((l) => l.trim())
                  return (
                    <ol key={j} className="list-inside list-decimal space-y-1 text-zinc-400">
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

export function PaFundamentalEarningsCall({
  ticker,
  firmenname,
}: {
  ticker: string | null
  firmenname: string | null
}) {
  const [daten, setDaten] = useState<EarningsCallPaket | null>(null)
  const [laden, setLaden] = useState(false)
  const [fehler, setFehler] = useState<string | null>(null)

  const lade = useCallback(
    async (force = false) => {
      if (!ticker?.trim()) return
      const anfrage = { ticker: ticker.trim(), firmenname, force }
      if (!force) {
        const cached = ladeEarningsCallAusLocalCache(anfrage)
        if (cached) {
          setDaten(cached)
          setFehler(null)
          return
        }
      }
      setLaden(true)
      setFehler(null)
      try {
        const res = await ladeEarningsCallClient(anfrage)
        setDaten(res)
        if (!res.ok) setFehler(res.fehler ?? 'Abruf fehlgeschlagen')
      } catch (e) {
        setFehler(e instanceof Error ? e.message : 'Abruf fehlgeschlagen')
      } finally {
        setLaden(false)
      }
    },
    [ticker, firmenname],
  )

  useEffect(() => {
    setDaten(null)
    setFehler(null)
    if (ticker?.trim()) void lade(false)
  }, [ticker, firmenname, lade])

  if (!ticker?.trim()) {
    return (
      <PaCard className="p-8 text-center text-sm text-zinc-500">
        Kein Ticker — Earnings Call benötigt ein US-Symbol (z. B. aus Macrotrends/Yahoo).
      </PaCard>
    )
  }

  return (
    <div className="space-y-4">
      <PaCard className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-500">Earnings Call</p>
          <p className="mt-1 text-sm text-zinc-400">
            Letztes Transkript von Seeking Alpha · Zusammenfassung per KI (Gemini/OpenAI)
          </p>
        </div>
        <button
          type="button"
          disabled={laden}
          onClick={() => void lade(true)}
          className="rounded-lg border border-teal-500/30 bg-teal-500/10 px-4 py-2 text-sm font-medium text-teal-200 hover:bg-teal-500/20 disabled:opacity-50"
        >
          {laden ? 'Scrape & Analyse …' : 'Neu laden'}
        </button>
      </PaCard>

      {laden && !daten?.ok ? (
        <PaCard className="p-8 text-center text-sm text-zinc-500">
          Playwright lädt Seeking Alpha und erstellt die KI-Zusammenfassung — kann 1–3 Minuten dauern …
        </PaCard>
      ) : null}

      {fehler && !daten?.ok ? (
        <PaCard className="space-y-3 p-6">
          <p className="text-sm text-amber-200/90">{fehler}</p>
          <p className="text-xs text-zinc-500">
            Lokal: <code className="text-zinc-400">npm install playwright</code> und{' '}
            <code className="text-zinc-400">npx playwright install chromium</code>. Seeking Alpha blockiert oft
            einfaches HTTP — deshalb Playwright.
          </p>
        </PaCard>
      ) : null}

      {daten?.ok && daten.zusammenfassung ? (
        <>
          <PaCard variant="elevated" className="space-y-2 p-5">
            <h3 className="text-base font-semibold text-zinc-100">{daten.titel}</h3>
            <div className="flex flex-wrap gap-2 text-xs text-zinc-500">
              {daten.callDatum ? <span>{daten.callDatum}</span> : null}
              <span>{daten.transcriptZeichen.toLocaleString('de-DE')} Zeichen Transkript</span>
              {daten.ausCache ? <span>Cache</span> : null}
            </div>
            {daten.transcriptUrl ? (
              <a
                href={daten.transcriptUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block text-xs text-teal-400 hover:underline"
              >
                Original auf Seeking Alpha ↗
              </a>
            ) : null}
          </PaCard>

          <PaCard className="p-5 sm:p-6">
            {MarkdownAbschnitte(daten.zusammenfassung)}
          </PaCard>

          <p className="text-[10px] text-zinc-600">
            Quelle: Seeking Alpha (Playwright) · KI wie Finanz-Coach · Stand{' '}
            {new Date(daten.geladenAm).toLocaleString('de-DE')}
          </p>
        </>
      ) : null}
    </div>
  )
}
