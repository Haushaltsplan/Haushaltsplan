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
  'quality dashboard': { kurz: 'Dashboard', icon: '▣', accent: 'border-emerald-400/25 bg-emerald-500/[0.06]' },
  'geschäftsmodell': { kurz: 'Moat', icon: '◎', accent: 'border-violet-400/25 bg-violet-500/[0.06]' },
  risiken: { kurz: 'Risiken', icon: '!', accent: 'border-rose-400/25 bg-rose-500/[0.06]' },
  nachkauf: { kurz: 'Radar', icon: '→', accent: 'border-teal-400/30 bg-teal-500/[0.07]' },
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
  return { kurz: titel.slice(0, 12), icon: '·', accent: 'border-[var(--app-border-strong)]/30 bg-[var(--app-surface-muted)]' }
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

function formatInlineMarkdown(text: string): ReactNode[] {
  const parts: ReactNode[] = []
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*)/g
  let last = 0
  let m: RegExpExecArray | null
  let key = 0
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index))
    const token = m[0]
    if (token.startsWith('**')) {
      parts.push(
        <strong key={key++} className="font-semibold text-[var(--app-text)]">
          {token.slice(2, -2)}
        </strong>,
      )
    } else {
      parts.push(
        <em key={key++} className="text-[var(--app-text)]">
          {token.slice(1, -1)}
        </em>,
      )
    }
    last = m.index + token.length
  }
  if (last < text.length) parts.push(text.slice(last))
  return parts.length ? parts : [text]
}

function AbschnittInhalt(body: string): ReactNode {
  return (
    <div className="space-y-3 text-[13px] leading-relaxed text-[var(--app-text)]">
      {body.split(/\n\n+/).map((para, j) => {
        if (/^[-*•]\s/m.test(para)) {
          const items = para.split(/\n/).filter((l) => l.trim())
          return (
            <ul key={j} className="space-y-2 pl-0.5">
              {items.map((item, k) => (
                <li key={k} className="flex gap-2.5 text-[var(--app-text-muted)]">
                  <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[var(--app-surface-muted)]" />
                  <span>{formatInlineMarkdown(item.replace(/^[-*•]\s*/, ''))}</span>
                </li>
              ))}
            </ul>
          )
        }
        if (/^\d+\.\s/m.test(para)) {
          const items = para.split(/\n/).filter((l) => l.trim())
          return (
            <ol key={j} className="list-decimal space-y-2 pl-5 text-[var(--app-text-muted)]">
              {items.map((item, k) => (
                <li key={k}>{formatInlineMarkdown(item.replace(/^\d+\.\s*/, ''))}</li>
              ))}
            </ol>
          )
        }
        return (
          <p key={j} className="text-[var(--app-text)]">
            {formatInlineMarkdown(para)}
          </p>
        )
      })}
    </div>
  )
}

export function EarningsCallAnalyseDarstellung({ text }: { text: string }) {
  const abschnitte = useMemo(() => parseAnalyseAbschnitte(text), [text])
  const summary = useMemo(
    () => abschnitte.find((a) => normalisiereTitel(a.titel).includes('executive summary')),
    [abschnitte],
  )
  const rest = useMemo(
    () => abschnitte.filter((a) => a.id !== summary?.id),
    [abschnitte, summary?.id],
  )
  const [aktivId, setAktivId] = useState(() => rest[0]?.id ?? abschnitte[0]?.id ?? '')

  useEffect(() => {
    const parsed = parseAnalyseAbschnitte(text)
    const sum = parsed.find((a) => normalisiereTitel(a.titel).includes('executive summary'))
    const r = parsed.filter((a) => a.id !== sum?.id)
    setAktivId(r[0]?.id ?? parsed[0]?.id ?? '')
  }, [text])

  const aktiv = abschnitte.find((a) => a.id === aktivId) ?? rest[0] ?? abschnitte[0]

  if (abschnitte.length <= 1) {
    return (
      <div className="rounded-xl border border-white/[0.06] bg-[var(--app-surface-muted)] p-5">
        {AbschnittInhalt(text)}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {summary ? (
        <div className="rounded-xl border border-amber-400/20 bg-gradient-to-br from-amber-500/[0.08] to-[var(--app-surface)] p-5">
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
                    : 'border-transparent bg-[var(--app-surface-muted)]/30 text-[var(--app-text-muted)] hover:border-[var(--app-border-strong)] hover:text-[var(--app-text)]'
                }`}
              >
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[11px] font-medium ${
                    aktivChip ? 'bg-teal-500/20 text-teal-200' : 'bg-[var(--app-surface-muted)] text-[var(--app-text-muted)]'
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
            <h4 className="mb-4 text-sm font-medium capitalize text-[var(--app-text)]">{aktiv.titel}</h4>
            {AbschnittInhalt(aktiv.body)}
          </article>
        ) : aktiv && !summary ? (
          <article className={`rounded-xl border p-5 ${metaFuerTitel(aktiv.titel).accent}`}>
            <h4 className="mb-4 text-sm font-medium capitalize text-[var(--app-text)]">{aktiv.titel}</h4>
            {AbschnittInhalt(aktiv.body)}
          </article>
        ) : null}
      </div>
    </div>
  )
}
