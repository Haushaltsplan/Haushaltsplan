'use client'

import { DonutChart } from '@/components/finanzen/donut-chart'
import { PaBadge } from '@/components/portfolio-analyse/pa-ui'
import type {
  BeatBalkenEintrag,
  OwnershipSegment,
  StrukturRisikoSignal,
  StrukturSignalSchwere,
} from '@/lib/portfolio-analyse/fundamentaldaten-struktur-hilfen'

const SCHWERE_BADGE: Record<StrukturSignalSchwere, 'positive' | 'neutral' | 'sell' | 'negative'> = {
  gut: 'positive',
  neutral: 'neutral',
  warnung: 'sell',
  kritisch: 'negative',
}

const SCORE_RING: Record<string, string> = {
  niedrig: '#34d399',
  moderat: '#2dd4bf',
  erhöht: '#fbbf24',
  hoch: '#f87171',
  unbekannt: '#71717a',
}

export function PaStrukturRisikoGauge({
  score,
  label,
  hinweis,
}: {
  score: number
  label: string
  hinweis: string
}) {
  const farbe = SCORE_RING[label] ?? SCORE_RING.unbekannt
  const r = 52
  const c = 2 * Math.PI * r
  const offset = c * (1 - score / 100)

  return (
    <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start sm:gap-6">
      <div className="relative shrink-0">
        <svg width={128} height={128} viewBox="0 0 128 128" className="-rotate-90">
          <circle cx={64} cy={64} r={r} fill="none" stroke="var(--app-border-strong)" strokeWidth={10} opacity={0.35} />
          <circle
            cx={64}
            cy={64}
            r={r}
            fill="none"
            stroke={farbe}
            strokeWidth={10}
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={offset}
            className="transition-[stroke-dashoffset] duration-700"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold tabular-nums text-white">{score}</span>
          <span className="text-[10px] uppercase tracking-wide text-[var(--app-text-muted)]">Score</span>
        </div>
      </div>
      <div className="min-w-0 text-center sm:text-left">
        <p className="text-sm font-semibold capitalize text-white">Strukturrisiko: {label}</p>
        <p className="mt-1 text-xs leading-relaxed text-[var(--app-text-muted)]">{hinweis}</p>
        <p className="mt-2 text-[10px] text-[var(--app-text-muted)]">
          0 = hohes Risiko · 100 = solide Struktur (Bilanz, Markt, Konzentration)
        </p>
      </div>
    </div>
  )
}

export function PaStrukturSignalChips({ signale }: { signale: StrukturRisikoSignal[] }) {
  if (signale.length === 0) return null
  return (
    <div className="flex flex-wrap gap-2">
      {signale.map((s) => (
        <div
          key={s.id}
          className="rounded-lg border border-[var(--app-border)] bg-[var(--app-surface-muted)]/40 px-2.5 py-1.5"
          title={s.hinweis}
        >
          <div className="flex items-center gap-2">
            <PaBadge variant={SCHWERE_BADGE[s.schwere]}>{s.wert}</PaBadge>
            <span className="text-[11px] text-[var(--app-text-muted)]">{s.label}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

export function PaStrukturOwnershipDonut({ segmente }: { segmente: OwnershipSegment[] }) {
  if (segmente.length === 0) {
    return <p className="text-sm text-[var(--app-text-muted)]">Keine Eigentümerdaten verfügbar.</p>
  }

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start sm:gap-6">
      <DonutChart
        segmente={segmente.map((s) => ({
          key: s.key,
          label: s.label,
          farbe: s.farbe,
          betrag: s.anteilPct,
        }))}
        groesse={148}
        dicke={24}
        mitte={{ wert: '100 %', label: 'STRUKTUR' }}
      />
      <ul className="min-w-0 flex-1 space-y-2 text-xs">
        {segmente.map((s) => (
          <li key={s.key} className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-[var(--app-text-muted)]">
              <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: s.farbe }} />
              {s.label}
            </span>
            <span className="tabular-nums font-medium text-[var(--app-text)]">{s.anteilPct.toFixed(1)} %</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function PaStrukturSegmentDonut({
  segmente,
  titel,
}: {
  segmente: { name: string; anteilPct: number | null; farbe: string }[]
  titel: string
}) {
  const positiv = segmente.filter((s) => (s.anteilPct ?? 0) > 0)
  if (positiv.length === 0) return null

  return (
    <div className="flex flex-col items-center gap-4 lg:flex-row lg:items-start">
      <DonutChart
        segmente={positiv.map((s, i) => ({
          key: `${s.name}-${i}`,
          label: s.name,
          farbe: s.farbe,
          betrag: s.anteilPct ?? 0,
        }))}
        groesse={160}
        dicke={26}
        mitte={{ wert: titel, label: 'SEGMENTE' }}
      />
      <div className="min-w-0 flex-1 space-y-1">
        {positiv.map((s, i) => (
          <div key={`${s.name}-${i}`} className="flex items-center gap-2 text-xs">
            <span className="inline-block h-2 w-2 shrink-0 rounded-sm" style={{ backgroundColor: s.farbe }} />
            <span className="min-w-0 flex-1 truncate text-[var(--app-text)]">{s.name}</span>
            <span className="shrink-0 tabular-nums text-[var(--app-text-muted)]">
              {s.anteilPct != null ? `${s.anteilPct.toFixed(1)} %` : '–'}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function PaStrukturHorizontalBars({ eintraege }: { eintraege: BeatBalkenEintrag[] }) {
  if (eintraege.length === 0) return null
  const max = Math.max(100, ...eintraege.map((e) => e.wert))

  return (
    <div className="space-y-3">
      {eintraege.map((e) => (
        <div key={e.label}>
          <div className="mb-1 flex justify-between text-xs">
            <span className="text-[var(--app-text-muted)]">{e.label}</span>
            <span className="tabular-nums font-medium text-[var(--app-text)]">{Math.round(e.wert)} %</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-[var(--app-surface-muted)]">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${(e.wert / max) * 100}%`, backgroundColor: e.farbe }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

export function PaStrukturKennzahl({
  label,
  wert,
  hinweis,
  accent,
}: {
  label: string
  wert: string | number | null | undefined
  hinweis?: string
  accent?: 'emerald' | 'amber' | 'red' | 'default'
}) {
  if (wert == null || wert === '') return null
  const accentClass =
    accent === 'emerald'
      ? 'border-emerald-500/20 bg-emerald-500/5'
      : accent === 'amber'
        ? 'border-amber-500/20 bg-amber-500/5'
        : accent === 'red'
          ? 'border-red-500/20 bg-red-500/5'
          : 'border-[var(--app-border-strong)]/50 bg-[var(--app-surface-muted)]/30'

  return (
    <div className={`rounded-xl border px-3 py-2.5 ${accentClass}`}>
      <p className="text-[10px] uppercase tracking-wide text-[var(--app-text-muted)]">{label}</p>
      <p className="text-sm font-semibold tabular-nums text-[var(--app-text)]">{wert}</p>
      {hinweis ? <p className="mt-0.5 text-[10px] text-[var(--app-text-muted)]">{hinweis}</p> : null}
    </div>
  )
}

export function PaStrukturSectionHeader({
  titel,
  untertitel,
}: {
  titel: string
  untertitel?: string
}) {
  return (
    <div className="border-b border-[var(--app-border)]/60 pb-3">
      <h3 className="text-sm font-semibold text-white">{titel}</h3>
      {untertitel ? <p className="mt-0.5 text-xs text-[var(--app-text-muted)]">{untertitel}</p> : null}
    </div>
  )
}
