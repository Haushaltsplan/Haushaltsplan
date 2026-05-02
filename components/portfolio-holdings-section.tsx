import { PortfolioHoldingsInteraktiv } from '@/components/portfolio-holdings-interaktiv.client'
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
      <details className="group">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-lg py-2 outline-none hover:bg-zinc-900/50 [&::-webkit-details-marker]:hidden">
          <div className="min-w-0">
            <h2 className="text-base font-semibold tracking-tight text-white">Meine Unternehmen</h2>
            <p className="mt-0.5 text-[11px] leading-snug text-zinc-500">{bericht.sessionLabel}</p>
          </div>
          <DetailsDisclosureTriggerEnd size="sm" />
        </summary>

        <PortfolioHoldingsInteraktiv bericht={bericht} />
      </details>
    </section>
  )
}
