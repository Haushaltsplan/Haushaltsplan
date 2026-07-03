'use client'

import { finanzMonatPickerClass, finanzMonatSliderClass } from '@/components/finanzen/finanzen-ui'
import { PageSection, PageSectionPanel } from '@/components/page-shell'

type Props = {
  ansichtMonat: string
  monatsListeNavigation: string[]
  sliderValue: number
  formatMonatsLabelDe: (yyyymm: string) => string
  onMonatChange: (yyyymm: string) => void
  onMonatDelta: (delta: number) => void
  onHeute: () => void
}

export function FinanzenMonatswahl({
  ansichtMonat,
  monatsListeNavigation,
  sliderValue,
  formatMonatsLabelDe,
  onMonatChange,
  onMonatDelta,
  onHeute,
}: Props) {
  return (
    <PageSection titleId="finanzen-monatswahl" title="Ansichtsmonat" density="compact">
      <PageSectionPanel density="compact">
        <div className="space-y-3">
          <div className="flex flex-col gap-2 sm:gap-3 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              <p className="text-base font-semibold tracking-tight text-[var(--app-text)] sm:text-lg">
                {formatMonatsLabelDe(ansichtMonat)}
              </p>
            </div>
            <div className="flex w-full min-w-0 flex-col gap-2 sm:w-auto sm:max-w-full md:shrink-0">
              <div className={finanzMonatPickerClass}>
                <button
                  type="button"
                  onClick={() => onMonatDelta(-1)}
                  className="shrink-0 rounded-lg px-3 py-2.5 text-sm font-semibold text-[var(--app-text-muted)] transition hover:bg-[var(--app-surface-hover)] sm:px-3.5"
                  aria-label="Vorheriger Monat"
                >
                  ◀
                </button>
                <input
                  type="month"
                  value={ansichtMonat}
                  onChange={(e) => {
                    const v = e.target.value
                    if (v) onMonatChange(v)
                  }}
                  className="min-h-[2.75rem] min-w-0 flex-1 rounded-lg border-0 bg-transparent px-1 py-2 text-sm font-semibold text-[var(--app-text)] outline-none ring-0 sm:min-w-[9.5rem] sm:flex-none sm:px-2"
                />
                <button
                  type="button"
                  onClick={() => onMonatDelta(1)}
                  className="shrink-0 rounded-lg px-3 py-2.5 text-sm font-semibold text-[var(--app-text-muted)] transition hover:bg-[var(--app-surface-hover)] sm:px-3.5"
                  aria-label="Nächster Monat"
                >
                  ▶
                </button>
                <button
                  type="button"
                  onClick={onHeute}
                  className="w-full rounded-lg bg-emerald-600/90 px-3 py-2.5 text-xs font-bold text-white shadow-sm shadow-emerald-950/30 transition hover:bg-emerald-500 sm:w-auto sm:px-4"
                >
                  Heute
                </button>
              </div>
            </div>
          </div>
          {monatsListeNavigation.length > 1 && (
            <div className={finanzMonatSliderClass}>
              <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wide text-[var(--app-text-muted)]">
                Schnellwahl über alle Monate mit Buchungen
              </label>
              <input
                type="range"
                min={0}
                max={Math.max(0, monatsListeNavigation.length - 1)}
                value={sliderValue}
                onChange={(e) => {
                  const i = Number(e.target.value)
                  const yyyymm = monatsListeNavigation[i]
                  if (yyyymm) onMonatChange(yyyymm)
                }}
                className="h-2.5 w-full cursor-pointer accent-sky-500"
              />
              <div className="mt-2 flex justify-between text-[11px] font-medium text-[var(--app-text-muted)]">
                <span>{formatMonatsLabelDe(monatsListeNavigation[0] || ansichtMonat)}</span>
                <span>
                  {formatMonatsLabelDe(monatsListeNavigation[monatsListeNavigation.length - 1] || ansichtMonat)}
                </span>
              </div>
            </div>
          )}
        </div>
      </PageSectionPanel>
    </PageSection>
  )
}
