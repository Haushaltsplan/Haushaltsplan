import type { InvestmentMoverKarteDaten } from '@/components/investment-mover-karte-types'
import { InvestmentMoverKarteBodyClient } from '@/components/investment-mover-karte-body.client'

export type { InvestmentMoverKarteDaten } from '@/components/investment-mover-karte-types'

export function InvestmentMoverKarte({ z }: { z: InvestmentMoverKarteDaten }) {
  return (
    <li className="rounded-xl border border-zinc-800/90 bg-zinc-950/50 px-3 py-3">
      <InvestmentMoverKarteBodyClient z={z} />
    </li>
  )
}
