'use client'

import { useMemo, useState } from 'react'
import { CollapsibleRowHeaderEnd, LABEL_EINKLAPPEN } from '@/components/collapsible-ui'
import { mhdVollLabel, tageBisMhd } from '@/lib/lager-mhd'

export type AblaufItem = {
  id: string
  name: string
  menge: number
  einheit: string
  mhd?: string | null
}

type Props = { items: AblaufItem[]; onOeffnen: (id: string) => void }

type Bucket = { key: string; titel: string; ton: string; punkt: string; von: number; bis: number }

const BUCKETS: Bucket[] = [
  { key: 'ueberfaellig', titel: 'Überfällig', ton: 'border-rose-800/45 bg-rose-950/20', punkt: 'bg-rose-400', von: -100000, bis: -1 },
  { key: 'woche', titel: 'Diese Woche (≤ 7 Tage)', ton: 'border-amber-800/45 bg-amber-950/20', punkt: 'bg-amber-400', von: 0, bis: 7 },
  { key: 'monat', titel: 'In 8–30 Tagen', ton: 'border-sky-800/40 bg-sky-950/15', punkt: 'bg-sky-400', von: 8, bis: 30 },
  { key: 'spaeter', titel: 'In 31–90 Tagen', ton: 'border-[var(--app-border-strong)] bg-[var(--app-surface-muted)]/50', punkt: 'bg-[var(--app-text-muted)]', von: 31, bis: 90 },
]

export function LagerAblaufTimeline({ items, onOeffnen }: Props) {
  const [offen, setOffen] = useState(false)

  const { gruppen, gesamt } = useMemo(() => {
    const mit = items
      .filter((it) => it.menge > 0 && it.mhd)
      .map((it) => ({ ...it, tage: tageBisMhd(it.mhd) }))
      .filter((it): it is AblaufItem & { tage: number } => it.tage != null && it.tage <= 90)
      .sort((a, b) => a.tage - b.tage)
    const gruppen = BUCKETS.map((b) => ({
      ...b,
      eintraege: mit.filter((it) => it.tage >= b.von && it.tage <= b.bis),
    })).filter((g) => g.eintraege.length > 0)
    return { gruppen, gesamt: mit.length }
  }, [items])

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-muted)] shadow-md shadow-black/20">
      <button
        type="button"
        onClick={() => setOffen((o) => !o)}
        className="group flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left transition hover:bg-[var(--app-surface-hover)] sm:px-4"
        aria-expanded={offen}
      >
        <div className="min-w-0">
          <h2 className="text-sm font-bold text-[var(--app-text)] sm:text-base">Ablauf-Kalender</h2>
          <p className="text-[10px] text-[var(--app-text-muted)] sm:text-[11px]">Was in den nächsten 90 Tagen abläuft</p>
        </div>
        <div className="flex shrink-0 items-center gap-2.5">
          <span className="rounded-md border border-[var(--app-border-strong)] bg-[var(--app-surface-muted)] px-2 py-0.5 text-[11px] font-bold tabular-nums text-[var(--app-text)]">{gesamt}</span>
          <CollapsibleRowHeaderEnd open={offen} labels={LABEL_EINKLAPPEN} tone="neutral" size="sm" />
        </div>
      </button>

      {offen && (
        <div className="space-y-2.5 border-t border-[var(--app-border)] px-3 pb-3 pt-2.5 sm:px-4">
          {gruppen.length === 0 ? (
            <p className="py-3 text-center text-xs text-[var(--app-text-muted)]">
              Keine Artikel mit Haltbarkeitsdatum in den nächsten 90 Tagen. MHD im Bearbeiten-Dialog pflegen.
            </p>
          ) : (
            gruppen.map((g) => (
              <div key={g.key} className={`rounded-xl border px-3 py-2.5 ${g.ton}`}>
                <div className="mb-2 flex items-center gap-2">
                  <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${g.punkt}`} aria-hidden />
                  <span className="text-[12px] font-bold uppercase tracking-wide text-[var(--app-text)]">{g.titel}</span>
                  <span className="text-[11px] font-semibold tabular-nums text-[var(--app-text-muted)]">{g.eintraege.length}</span>
                </div>
                <div className="space-y-1">
                  {g.eintraege.map((it) => (
                    <button
                      key={it.id}
                      type="button"
                      onClick={() => onOeffnen(it.id)}
                      className="flex w-full items-center justify-between gap-2 rounded-lg border border-[var(--app-border-strong)]/50 bg-[var(--app-surface-muted)] px-2.5 py-1.5 text-left transition hover:bg-[var(--app-surface-hover)]"
                    >
                      <span className="min-w-0 truncate text-[13px] font-semibold text-[var(--app-text)]">{it.name}</span>
                      <span className="shrink-0 text-[11px] font-semibold tabular-nums text-[var(--app-text-muted)]">
                        {mhdVollLabel(it.mhd)} · {it.tage < 0 ? `vor ${Math.abs(it.tage)} T` : it.tage === 0 ? 'heute' : `in ${it.tage} T`}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
