'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'

type AnalyseAbschnitt = {
  id: string
  titel: string
  kurzTitel: string
  body: string
}

const ABSCHNITT_META: Record<string, { kurz: string; icon: string; accent: string }> = {
  'executive summary': { kurz: 'Summary', icon: '◆', accent: 'border-amber-400/30 bg-amber-500/[0.07]' },
  'finanzielle performance': { kurz: 'Zahlen', icon: '€', accent: 'border-sky-400/25 bg-sky-500/[0.06]' },
  'qualitative analyse': { kurz: 'Quality', icon: '◎', accent: 'border-violet-400/25 bg-violet-500/[0.06]' },
  'deep dive': { kurz: 'Q&A', icon: '?', accent: 'border-orange-400/25 bg-orange-500/[0.06]' },
  fazit: { kurz: 'Fazit', icon: '→', accent: 'border-teal-400/30 bg-teal-500/[0.07]' },
}

function normalisiereTitel(titel: string): string {
  return titel
    .replace(/^\d+\.\s*/, '')
    .replace(/\([^)]*\)/g, '')
    .trim()
    .toLowerCase()
}

function metaFuerTitel(titel: string) {
  const n = normalisiereTitel(titel)
  for (const [key, meta] of Object.entries(ABSCHNITT_META)) {
    if (n.includes(key)) return meta
  }
  return { kurz: titel.slice(0, 12), icon: '·', accent: 'border-zinc-600/30 bg-zinc-900/40' }
}

function parseAnalyseAbschnitte(text: string): AnalyseAbschnitt[] {
  const blocks = text.split(/\n(?=##\s)/)
  const out: AnalyseAbschnitt[] = []

  for (const block of blocks) {
    const trimmed = block.trim()
    if (!trimmed) continue
    const lines = trimmed.split('\n')
    const first = lines[0] ?? ''
    const isHeading = /^##\s/.test(first)
    const titel = isHeading ? first.replace(/^##\s*/, '').trim() : 'Analyse'
    const body = (isHeading ? lines.slice(1) : lines).join('\n').trim()
    if (!body && !isHeading) continue
    const id = normalisiereTitel(titel).replace(/[^a-z0-9]+/g, '-')
    const meta = metaFuerTitel(titel)
    out.push({ id, titel: normalisiereTitel(titel) || titel, kurzTitel: meta.kurz, body })
  }

  if (out.length === 0 && text.trim()) {
    out.push({ id: 'analyse', titel: 'Analyse', kurzTitel: 'Analyse', body: text.trim() })
  }

  return out
}

function AbschnittInhalt(body: string): ReactNode {
  return (
    <div className="space-y-3 text-[13px] leading-relaxed text-zinc-300">
      {body.split(/\n\n+/).map((para, j) => {
        if (/^[-*•]\s/m.test(para)) {
          const items = para.split(/\n/).filter((l) => l.trim())
          return (
            <ul key={j} className="space-y-2 pl-0.5">
              {items.map((item, k) => (
                <li key={k} className="flex gap-2.5 text-zinc-400">
                  <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-zinc-500" />
                  <span>{item.replace(/^[-*•]\s*/, '')}</span>
                </li>
              ))}
            </ul>
          )
        }
        if (/^\d+\.\s/m.test(para)) {
          const items = para.split(/\n/).filter((l) => l.trim())
          return (
            <ol key={j} className="list-decimal space-y-2 pl-5 text-zinc-400">
              {items.map((item, k) => (
                <li key={k}>{item.replace(/^\d+\.\s*/, '')}</li>
              ))}
            </ol>
          )
        }
        return (
          <p key={j} className="text-zinc-300">
            {para}
          </p>
        )
      })}
    </div>
  )
}

export function EarningsCallAnalyseDarstellung({ text }: { text: string }) {
  const abschnitte = useMemo(() => parseAnalyseAbschnitte(text), [text])
  const summary = abschnitte.find((a) => normalisiereTitel(a.titel).includes('executive summary'))
  const rest = abschnitte.filter((a) => a.id !== summary?.id)
  const [aktivId, setAktivId] = useState(() => rest[0]?.id ?? abschnitte[0]?.id ?? '')

  useEffect(() => {
    setAktivId(rest[0]?.id ?? abschnitte[0]?.id ?? '')
  }, [text, rest, abschnitte])

  const aktiv = abschnitte.find((a) => a.id === aktivId) ?? rest[0] ?? abschnitte[0]

  if (abschnitte.length <= 1) {
    return (
      <div className="rounded-xl border border-white/[0.06] bg-zinc-950/50 p-5">
        {AbschnittInhalt(text)}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {summary ? (
        <div className="rounded-xl border border-amber-400/20 bg-gradient-to-br from-amber-500/[0.08] to-zinc-950/80 p-5">
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-300/80">
            Executive Summary
          </p>
          {AbschnittInhalt(summary.body)}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,200px)_1fr]">
        <nav
          className="flex flex-row gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0"
          aria-label="Analyse-Abschnitte"
        >
          {rest.map((a) => {
            const meta = metaFuerTitel(a.titel)
            const aktivChip = aktiv?.id === a.id
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => setAktivId(a.id)}
                className={`flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-xs transition ${
                  aktivChip
                    ? 'border-teal-500/35 bg-teal-500/10 text-teal-100'
                    : 'border-transparent bg-zinc-900/30 text-zinc-500 hover:border-zinc-700/50 hover:text-zinc-300'
                }`}
              >
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[11px] font-medium ${
                    aktivChip ? 'bg-teal-500/20 text-teal-200' : 'bg-zinc-800 text-zinc-500'
                  }`}
                >
                  {meta.icon}
                </span>
                <span className="font-medium">{meta.kurz}</span>
              </button>
            )
          })}
        </nav>

        {aktiv && aktiv.id !== summary?.id ? (
          <article className={`rounded-xl border p-5 ${metaFuerTitel(aktiv.titel).accent}`}>
            <h4 className="mb-4 text-sm font-medium capitalize text-zinc-100">{aktiv.titel}</h4>
            {AbschnittInhalt(aktiv.body)}
          </article>
        ) : aktiv && !summary ? (
          <article className={`rounded-xl border p-5 ${metaFuerTitel(aktiv.titel).accent}`}>
            <h4 className="mb-4 text-sm font-medium capitalize text-zinc-100">{aktiv.titel}</h4>
            {AbschnittInhalt(aktiv.body)}
          </article>
        ) : null}
      </div>
    </div>
  )
}
