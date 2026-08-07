'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { StartSektion } from '@/components/start-home-ui'
import { berechneAbendCheckStreak } from '@/lib/fuehrung/streak'
import {
  abendCheckOffen,
  aktuelleWochenNr,
  heuteIso,
  ladeFuehrungState,
  leererTag,
  summeMetriken,
  type FuehrungState,
} from '@/lib/fuehrung/store'
import { baueWochenReview, istSonntag } from '@/lib/fuehrung/wochen-review'

export function StartFuehrungKompakt() {
  const [state, setState] = useState<FuehrungState | null>(null)

  useEffect(() => {
    setState(ladeFuehrungState())
  }, [])

  if (!state) {
    return (
      <StartSektion titel="Führung" icon="🧭" href="/fuehrung" akzent="slate">
        <p className="text-sm text-[var(--app-text-muted)]">Laden …</p>
      </StartSektion>
    )
  }

  const heute = heuteIso()
  const tag = state.tage[heute] ?? leererTag(heute)
  const woche = aktuelleWochenNr(state.challengeStart, heute)
  const m = summeMetriken(state.tage, state.situationen)
  const abend = abendCheckOffen(state)
  const fokusAktiv = Boolean(state.aktiverFokus)
  const streak = berechneAbendCheckStreak(state.tage, heute)
  const review = baueWochenReview(state, heute)
  const sonntagOffen = istSonntag() && state.lastWochenReviewKey !== review.wochenKey

  return (
    <StartSektion
      titel="Führung"
      icon="🧭"
      href={abend ? '/fuehrung?tab=heute' : sonntagOffen ? '/fuehrung?tab=review' : '/fuehrung'}
      akzent="slate"
    >
      {sonntagOffen ? (
        <Link
          href="/fuehrung?tab=review"
          className="mb-3 block rounded-xl border border-teal-500/35 bg-teal-500/10 px-3 py-2.5 transition hover:bg-teal-500/15"
        >
          <p className="text-[10px] font-bold uppercase tracking-wide text-teal-700 dark:text-teal-300">
            Wochen-Review
          </p>
          <p className="mt-0.5 text-sm font-medium text-[var(--app-text)]">Sonntag — Rückblick öffnen</p>
        </Link>
      ) : null}
      {abend ? (
        <Link
          href="/fuehrung?tab=heute"
          className="mb-3 block rounded-xl border border-amber-500/35 bg-amber-500/10 px-3 py-2.5 transition hover:bg-amber-500/15"
        >
          <p className="text-[10px] font-bold uppercase tracking-wide text-amber-700 dark:text-amber-300">
            Abend-Check offen
          </p>
          <p className="mt-0.5 text-sm font-medium text-[var(--app-text)]">
            2 Minuten — Tag abschließen
          </p>
        </Link>
      ) : null}

      <div className="grid grid-cols-3 gap-2">
        <MiniKpi label="Woche" value={`${woche}/6`} />
        <MiniKpi label="Streak" value={`${streak}d`} />
        <MiniKpi label="Redirects" value={String(m.redirects)} />
      </div>

      <p className="mt-3 text-xs leading-relaxed text-[var(--app-text-muted)]">
        {fokusAktiv
          ? 'Fokusblock läuft — Soforthilfe pausieren.'
          : tag.abendCheckErledigt
            ? 'Abend-Check heute erledigt. Gut so.'
            : `Heute: ${tag.redirects} Redirects · ${tag.neins} Nein/Später`}
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <Link
          href="/fuehrung?tab=fokus"
          className="rounded-lg bg-[var(--app-surface-muted)] px-2.5 py-1.5 text-[11px] font-semibold text-[var(--app-text)] ring-1 ring-[var(--app-border)]"
        >
          Fokus
        </Link>
        <Link
          href="/fuehrung?tab=log"
          className="rounded-lg bg-[var(--app-surface-muted)] px-2.5 py-1.5 text-[11px] font-semibold text-[var(--app-text)] ring-1 ring-[var(--app-border)]"
        >
          Situation loggen
        </Link>
        <Link
          href="/fuehrung?tab=bilanz"
          className="rounded-lg bg-[var(--app-surface-muted)] px-2.5 py-1.5 text-[11px] font-semibold text-[var(--app-text)] ring-1 ring-[var(--app-border)]"
        >
          Bilanz
        </Link>
      </div>
    </StartSektion>
  )
}

function MiniKpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-[var(--app-surface-muted)] px-2 py-2 text-center ring-1 ring-[var(--app-border)]">
      <p className="text-sm font-bold tabular-nums text-[var(--app-text)]">{value}</p>
      <p className="text-[9px] font-medium text-[var(--app-text-muted)]">{label}</p>
    </div>
  )
}
