'use client'

import { STRAVA_COLORS, STRAVA_INTERACTIVE } from '@/components/strava/design-tokens'
import { StravaCard } from '@/components/strava/strava-card'
import { STRAVA_PANEL_INFO } from '@/lib/strava/strava-panel-info'
import type { CoachMood, CoachSummary, CoachTssGuide } from '@/lib/strava/strava-coach-summary'
import { useState } from 'react'

const MOOD_STYLE: Record<
  CoachMood,
  { border: string; glow: string; badge: string; badgeText: string }
> = {
  excellent: {
    border: 'border-emerald-500/25',
    glow: 'from-emerald-500/[0.08]',
    badge: 'bg-emerald-500/15 text-emerald-200',
    badgeText: 'Topform',
  },
  good: {
    border: 'border-cyan-500/20',
    glow: 'from-cyan-500/[0.06]',
    badge: 'bg-cyan-500/15 text-cyan-200',
    badgeText: 'Stabil',
  },
  neutral: {
    border: 'border-white/[0.08]',
    glow: 'from-orange-500/[0.05]',
    badge: 'bg-white/[0.06] text-zinc-400',
    badgeText: 'Ausgewertet',
  },
  caution: {
    border: 'border-amber-500/25',
    glow: 'from-amber-500/[0.08]',
    badge: 'bg-amber-500/15 text-amber-200',
    badgeText: 'Achtung',
  },
  recovery: {
    border: 'border-rose-500/25',
    glow: 'from-rose-500/[0.08]',
    badge: 'bg-rose-500/15 text-rose-200',
    badgeText: 'Erholung',
  },
}

const TSS_STATUS_COLOR: Record<CoachTssGuide['status'], string> = {
  on_track: STRAVA_COLORS.positive,
  under: STRAVA_COLORS.cyan,
  high: STRAVA_COLORS.yellow,
  spike: STRAVA_COLORS.negative,
  recovery_needed: STRAVA_COLORS.negative,
}

function TssGauge({ guide }: { guide: CoachTssGuide }) {
  const pct = guide.userTarget > 0 ? Math.min(100, (guide.thisWeekTss / guide.userTarget) * 100) : 0
  const recLeft = guide.userTarget > 0 ? (guide.recommendedMin / guide.userTarget) * 100 : 0
  const recWidth =
    guide.userTarget > 0
      ? Math.min(100, ((guide.recommendedMax - guide.recommendedMin) / guide.userTarget) * 100)
      : 0

  return (
    <div className="mt-3">
      <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">TSS diese Woche</p>
          <p className="mt-0.5 text-2xl font-light tabular-nums text-zinc-100">
            {guide.thisWeekTss}
            <span className="text-base text-zinc-500"> / {guide.userTarget}</span>
          </p>
        </div>
        <span
          className="rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide"
          style={{
            color: TSS_STATUS_COLOR[guide.status],
            background: `${TSS_STATUS_COLOR[guide.status]}18`,
          }}
        >
          {guide.statusLabel}
        </span>
      </div>

      <div className="relative h-2.5 overflow-hidden rounded-full bg-white/[0.06]">
        {recWidth > 0 ? (
          <div
            className="absolute inset-y-0 rounded-full bg-emerald-500/15"
            style={{ left: `${Math.min(recLeft, 100)}%`, width: `${Math.min(recWidth, 100 - recLeft)}%` }}
          />
        ) : null}
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-all duration-700"
          style={{
            width: `${pct}%`,
            background: `linear-gradient(90deg, ${STRAVA_COLORS.orange}99, ${STRAVA_COLORS.orange})`,
          }}
        />
      </div>

      <div className="mt-2 flex flex-wrap justify-between gap-2 text-[10px] text-zinc-600">
        <span>
          Empfohlen: {guide.recommendedMin}–{guide.recommendedMax} TSS/Woche
        </span>
        <span>Vorwoche: {guide.lastWeekTss} TSS</span>
      </div>
    </div>
  )
}

export function StravaCoachSummaryPanel({ summary }: { summary: CoachSummary }) {
  const [tssInfoOpen, setTssInfoOpen] = useState(false)
  const [panelInfoOpen, setPanelInfoOpen] = useState(false)
  const style = MOOD_STYLE[summary.mood]

  return (
    <StravaCard
      padding="lg"
      accent="orange"
      className={`relative overflow-hidden bg-gradient-to-br ${style.glow} to-transparent ${style.border}`}
    >
      <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-orange-500/[0.04] blur-3xl" />

      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500">Coach-Analyse</p>
            <span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${style.badge}`}>
              {style.badgeText}
            </span>
          </div>
          <h2 className="mt-2 text-xl font-light tracking-tight text-zinc-100">{summary.headline}</h2>
          <p className="mt-1 text-[11px] text-zinc-600">{summary.updatedLabel}</p>
          <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-zinc-400">{summary.narrative}</p>
        </div>
        <button
          type="button"
          aria-expanded={panelInfoOpen}
          aria-label="Was ist die Coach-Analyse?"
          onClick={() => setPanelInfoOpen((v) => !v)}
          className={[
            'flex h-7 w-7 shrink-0 items-center justify-center rounded-full',
            'border border-white/[0.08] bg-gradient-to-b from-white/[0.07] to-transparent',
            'text-[11px] font-medium italic text-zinc-500 hover:border-orange-500/30 hover:text-orange-200/85',
            STRAVA_INTERACTIVE,
            panelInfoOpen ? 'border-orange-500/35 bg-orange-500/10 text-orange-200/90' : '',
          ].join(' ')}
          style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
        >
          i
        </button>
      </div>

      {panelInfoOpen ? (
        <p
          className="mt-3 border-l-2 pl-3.5 text-[12px] leading-relaxed text-zinc-400/95"
          style={{ borderLeftColor: `${STRAVA_COLORS.orange}55` }}
        >
          {STRAVA_PANEL_INFO.coachSummary}
        </p>
      ) : null}

      {summary.highlights.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {summary.highlights.map((h) => (
            <div
              key={h.label}
              className="rounded-xl border border-white/[0.06] bg-black/20 px-3 py-2 backdrop-blur-sm"
            >
              <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-zinc-600">{h.label}</p>
              <p
                className="mt-0.5 text-sm font-semibold tabular-nums"
                style={{
                  color:
                    h.tone === 'positive'
                      ? STRAVA_COLORS.positive
                      : h.tone === 'warning'
                        ? STRAVA_COLORS.negative
                        : h.tone === 'accent'
                          ? STRAVA_COLORS.orange
                          : '#d4d4d8',
                }}
              >
                {h.value}
              </p>
            </div>
          ))}
        </div>
      ) : null}

      {summary.bullets.length > 1 ? (
        <ul className="mt-4 space-y-2 border-t border-white/[0.05] pt-4">
          {summary.bullets.slice(1).map((b) => (
            <li key={b} className="flex gap-2.5 text-[12px] leading-relaxed text-zinc-400">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-orange-500/70" />
              {b}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-5 rounded-xl border border-white/[0.06] bg-black/25 p-4 backdrop-blur-sm">
        <div className="flex items-start justify-between gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">TSS — Was ist gut?</p>
          <button
            type="button"
            aria-expanded={tssInfoOpen}
            onClick={() => setTssInfoOpen((v) => !v)}
            className={`text-[10px] text-orange-400/90 underline ${STRAVA_INTERACTIVE}`}
          >
            {tssInfoOpen ? 'Weniger' : 'Mehr erklären'}
          </button>
        </div>

        <TssGauge guide={summary.tssGuide} />

        <p className="mt-3 text-[12px] leading-relaxed text-zinc-400">{summary.tssGuide.weekAdvice}</p>

        {tssInfoOpen ? (
          <p className="mt-3 border-l-2 border-orange-500/30 pl-3 text-[11px] leading-relaxed text-zinc-500">
            {summary.tssGuide.rangeExplanation}
            {summary.tssGuide.ctl != null ? (
              <span className="mt-2 block">
                Dein CTL (langfristige Fitness) liegt bei ~{summary.tssGuide.ctl} — das entspricht grob{' '}
                {summary.tssGuide.ctl} TSS pro Woche Erhaltungsniveau.
              </span>
            ) : null}
            {!summary.tssGuide.isUserDefined ? (
              <span className="mt-2 block text-zinc-400">
                Standard-Wochenziel: {summary.tssGuide.userTarget} TSS — passe es unter Saisonziele an.
              </span>
            ) : null}
          </p>
        ) : null}
      </div>
    </StravaCard>
  )
}
