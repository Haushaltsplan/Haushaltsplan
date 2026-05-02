import { InvestmentMoverKarte } from '@/components/investment-mover-karte'
import { DetailsDisclosureTriggerEnd } from '@/components/collapsible-ui'
import type { PortfolioKurseBericht } from '@/lib/portfolio-kurse'

export function PortfolioHoldingsSection({
  bericht,
  embedded = false,
}: {
  bericht: PortfolioKurseBericht
  embedded?: boolean
}) {
  const shell = embedded ? 'space-y-2' : 'rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4'

  return (
    <section className={shell}>
      <details className="group" open>
        <summary className="flex cursor-pointer list-none items-start justify-between gap-3 rounded-lg py-1 outline-none hover:bg-zinc-900/50 [&::-webkit-details-marker]:hidden">
          <div className="min-w-0 pr-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Portfolio</p>
            <h2 className="mt-1 text-base font-semibold tracking-tight text-white">Meine Unternehmen</h2>
            <p className="mt-1 text-xs leading-relaxed text-zinc-400">{bericht.sessionLabel}</p>
          </div>
          <DetailsDisclosureTriggerEnd size="sm" />
        </summary>

        {bericht.fehler ? (
          <p className="mt-3 rounded-lg border border-orange-900/35 bg-orange-950/15 px-3 py-2 text-xs leading-relaxed text-orange-100/95">
            {bericht.fehler}
          </p>
        ) : null}

        <ul className="mt-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {bericht.positionen.map((z) => (
            <InvestmentMoverKarte key={z.symbol} z={z} />
          ))}
        </ul>
      </details>
    </section>
  )
}
