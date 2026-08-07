'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { StartSektion } from '@/components/start-home-ui'
import { berechneAbendCheckStreak } from '@/lib/fuehrung/streak'
import { FUEHRUNG_PLAN_SLOTS, FUEHRUNG_WOCHEN } from '@/lib/fuehrung/content'
import {
  abendCheckOffen,
  aktuelleWochenNr,
  heuteIso,
  ladeFuehrungState,
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
  const slot = aktuelleWochenNr(state.challengeStart, heute, FUEHRUNG_PLAN_SLOTS)
  const lern = FUEHRUNG_WOCHEN.find((w) => w.nr === slot)?.lernNr
  const fragenHeute = state.mitarbeiterFragen.filter((f) => f.datum === heute).length
  const streak = berechneAbendCheckStreak(state.tage, heute)
  const abend = abendCheckOffen(state)
  const review = baueWochenReview(state, heute)
  const sonntagOffen = istSonntag() && state.lastWochenReviewKey !== review.wochenKey

  return (
    <StartSektion
      titel="Führung"
      icon="🧭"
      href={
        abend
          ? '/fuehrung?tab=heute'
          : sonntagOffen
            ? '/fuehrung?tab=plan'
            : '/fuehrung?tab=mitarbeiter'
      }
      akzent="slate"
    >
      {sonntagOffen ? (
        <Link
          href="/fuehrung?tab=plan"
          className="mb-3 block rounded-xl border border-teal-500/35 bg-teal-500/10 px-3 py-2.5"
        >
          <p className="text-[10px] font-bold uppercase tracking-wide text-teal-700 dark:text-teal-300">
            Wochen-Review
          </p>
          <p className="mt-0.5 text-sm font-medium text-[var(--app-text)]">Unter Plan → Lernwoche 6</p>
        </Link>
      ) : null}
      {abend ? (
        <Link
          href="/fuehrung?tab=heute"
          className="mb-3 block rounded-xl border border-amber-500/35 bg-amber-500/10 px-3 py-2.5"
        >
          <p className="text-[10px] font-bold uppercase tracking-wide text-amber-700 dark:text-amber-300">
            Abend-Check offen
          </p>
          <p className="mt-0.5 text-sm font-medium text-[var(--app-text)]">Tag abschließen</p>
        </Link>
      ) : null}

      <div className="grid grid-cols-3 gap-2">
        <MiniKpi label="Lernwoche" value={lern != null ? `${lern}/6` : 'Pause'} />
        <MiniKpi label="Fragen" value={String(fragenHeute)} />
        <MiniKpi label="Streak" value={`${streak}d`} />
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Link
          href="/fuehrung?tab=mitarbeiter"
          className="rounded-lg bg-[var(--app-surface-muted)] px-2.5 py-1.5 text-[11px] font-semibold text-[var(--app-text)] ring-1 ring-[var(--app-border)]"
        >
          + Frage erfassen
        </Link>
        <Link
          href="/fuehrung?tab=plan"
          className="rounded-lg bg-[var(--app-surface-muted)] px-2.5 py-1.5 text-[11px] font-semibold text-[var(--app-text)] ring-1 ring-[var(--app-border)]"
        >
          Plan
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
