import type { Metadata } from 'next'
import { PortfolioBoerseClient } from '@/components/portfolio-analyse/portfolio-boerse.client'
import { ladeBoersenSaison } from '@/lib/portfolio-analyse/boersen-saison-server'
import type { BoersenSaisonPaket } from '@/lib/portfolio-analyse/boersen-saison-types'

export const metadata: Metadata = {
  title: 'Börse · Portfolioanalyse',
}

export const dynamic = 'force-dynamic'
export const maxDuration = 60

function ohneMonatsliste(paket: BoersenSaisonPaket): BoersenSaisonPaket {
  return {
    ...paket,
    indezes: paket.indezes.map((idx) => ({ ...idx, renditen: [] })),
  }
}

export default async function PortfolioBoersePage() {
  let paket: BoersenSaisonPaket = {
    ok: false,
    indezes: [],
    geladenAm: new Date().toISOString(),
    fehler: 'Saisondaten konnten nicht geladen werden.',
  }
  try {
    paket = ohneMonatsliste(await ladeBoersenSaison())
  } catch (e) {
    console.error('boerse-saison page', e)
    paket = {
      ...paket,
      fehler: e instanceof Error ? e.message : paket.fehler,
    }
  }
  return <PortfolioBoerseClient initial={paket} />
}
