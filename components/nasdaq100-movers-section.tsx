import { InvestmentMoverKarte } from '@/components/investment-mover-karte'
import { DetailsDisclosureTriggerEnd } from '@/components/collapsible-ui'
import type { Nasdaq100MoversBericht } from '@/lib/nasdaq100-tagesmovers'

export function Nasdaq100MoversSection({
  bericht,
  embedded = false,
}: {
  bericht: Nasdaq100MoversBericht
  embedded?: boolean
}) {
  if (bericht.fehler) {
    return (
      <section
        className={
          embedded
            ? 'rounded-lg border border-orange-900/35 bg-orange-950/15 p-3 text-[11px] text-orange-100/95'
            : 'rounded-2xl border border-orange-900/35 bg-orange-950/15 p-4 text-xs text-orange-100/95'
        }
      >
        <p className="font-medium text-orange-200/95">Nasdaq 100 Movers</p>
        <p className="mt-2 text-sm leading-relaxed text-[var(--app-text-muted)]">{bericht.fehler}</p>
      </section>
    )
  }

  const shell = embedded ? 'space-y-2' : 'rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-muted)] p-4'

  return (
    <section className={shell}>
      <details className="group">
        <summary className="flex cursor-pointer list-none items-start justify-between gap-3 rounded-lg py-1 outline-none hover:bg-[var(--app-surface-muted)] [&::-webkit-details-marker]:hidden">
          <div className="min-w-0 pr-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--app-text-muted)]">Nasdaq 100</p>
            <h2 className="mt-1 text-base font-semibold tracking-tight text-white">Top / Flop</h2>
            <p className="mt-1 text-xs leading-relaxed text-[var(--app-text-muted)]">{bericht.sessionLabel}</p>
          </div>
          <DetailsDisclosureTriggerEnd size="sm" />
        </summary>
        <div className="mt-3 flex justify-between gap-3 rounded-lg border border-[var(--app-border)] bg-[var(--app-surface-muted)] px-3 py-2 text-xs">
          <span title="Titel mit positivem Tag">
            <span className="text-[var(--app-text-muted)]">↑ </span>
            <span className="font-semibold text-teal-400">{bericht.anzahlPositiv}</span>
          </span>
          <span title="Titel mit negativem Tag">
            <span className="text-[var(--app-text-muted)]">↓ </span>
            <span className="font-semibold text-red-400/90">{bericht.anzahlNegativ}</span>
          </span>
          <span title="Unverändert" className="text-[var(--app-text-muted)]">
            ∅ {bericht.anzahlUnveraendert}
          </span>
        </div>

        <div className="mt-5 grid gap-6 lg:grid-cols-2">
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--app-text-muted)]">Stärkste</h3>
            <ul className="space-y-2">
              {bericht.top10.map((z) => (
                <InvestmentMoverKarte key={z.symbol} z={z} />
              ))}
            </ul>
          </div>
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--app-text-muted)]">Schwächste</h3>
            <ul className="space-y-2">
              {bericht.flop10.map((z) => (
                <InvestmentMoverKarte key={z.symbol} z={z} />
              ))}
            </ul>
          </div>
        </div>
      </details>
    </section>
  )
}
