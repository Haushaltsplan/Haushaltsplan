import { InvestmentMoverKarte } from '@/components/investment-mover-karte'
import { DetailsDisclosureTriggerEnd } from '@/components/collapsible-ui'
import type { Sp500MoversBericht } from '@/lib/sp500-tagesmovers'

export function Sp500MoversSection({
  bericht,
  embedded = false,
}: {
  bericht: Sp500MoversBericht
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
        <p className="font-medium text-orange-200/95">S&amp;P 500 Movers</p>
        <p className="mt-2 text-sm leading-relaxed text-zinc-400">{bericht.fehler}</p>
      </section>
    )
  }

  const shell = embedded ? 'space-y-2' : 'rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4'

  return (
    <section className={shell}>
      <details className="group">
        <summary className="flex cursor-pointer list-none items-start justify-between gap-3 rounded-lg py-1 outline-none hover:bg-zinc-900/50 [&::-webkit-details-marker]:hidden">
          <div className="min-w-0 pr-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">S&amp;P 500</p>
            <h2 className="mt-1 text-base font-semibold tracking-tight text-white">Top / Flop</h2>
            <p className="mt-1 text-xs leading-relaxed text-zinc-400">{bericht.sessionLabel}</p>
          </div>
          <DetailsDisclosureTriggerEnd size="sm" />
        </summary>
        <div className="mt-3 flex justify-between gap-3 rounded-lg border border-zinc-800/90 bg-zinc-950/40 px-3 py-2 text-xs">
          <span title="Titel mit positivem Tag">
            <span className="text-zinc-500">↑ </span>
            <span className="font-semibold text-teal-400">{bericht.anzahlPositiv}</span>
          </span>
          <span title="Titel mit negativem Tag">
            <span className="text-zinc-500">↓ </span>
            <span className="font-semibold text-red-400/90">{bericht.anzahlNegativ}</span>
          </span>
          <span title="Unverändert" className="text-zinc-400">
            ∅ {bericht.anzahlUnveraendert}
          </span>
        </div>

        <div className="mt-5 grid gap-6 lg:grid-cols-2">
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">Stärkste</h3>
            <ul className="space-y-2">
              {bericht.top10.map((z) => (
                <InvestmentMoverKarte key={z.symbol} z={z} />
              ))}
            </ul>
          </div>
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">Schwächste</h3>
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
