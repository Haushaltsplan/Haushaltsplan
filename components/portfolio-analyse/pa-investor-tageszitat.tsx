'use client'

import { useMemo } from 'react'
import { tageszitatFuerDatum } from '@/lib/portfolio-analyse/investor-tageszitate'
import { heuteIso } from '@/lib/portfolio-analyse/wertentwicklung-tage'

/** Tageswechselndes Investor-Zitat — direkt unter der Dashboard-Subnav. */
export function PaInvestorTageszitat() {
  const zitat = useMemo(() => tageszitatFuerDatum(heuteIso()), [])

  return (
    <figure
      className="mb-4 rounded-2xl border border-white/[0.06] bg-[var(--app-surface-muted)]/80 px-4 py-3.5 shadow-lg shadow-black/20 ring-1 ring-white/[0.03] sm:mb-5 sm:px-5 sm:py-4"
      aria-label="Zitat des Tages"
    >
      <blockquote className="text-sm leading-relaxed text-[var(--app-text)]/90 sm:text-[15px]">
        <span className="text-teal-400/70" aria-hidden>
          „
        </span>
        {zitat.text}
        <span className="text-teal-400/70" aria-hidden>
          “
        </span>
      </blockquote>
      <figcaption className="mt-2 text-xs font-medium tracking-wide text-teal-300/80 sm:text-[13px]">
        — {zitat.autor}
      </figcaption>
    </figure>
  )
}
