import type { Metadata } from 'next'
import { PortfolioBoerseClient } from '@/components/portfolio-analyse/portfolio-boerse.client'
import { ladeBoersenSaison } from '@/lib/portfolio-analyse/boersen-saison-server'

export const metadata: Metadata = {
  title: 'Börse · Portfolioanalyse',
}

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export default async function PortfolioBoersePage() {
  let paket = null
  try {
    paket = await ladeBoersenSaison()
  } catch (e) {
    console.error('boerse-saison page', e)
    paket = {
      ok: false,
      indezes: [],
      geladenAm: new Date().toISOString(),
      fehler: e instanceof Error ? e.message : 'Saisondaten konnten nicht geladen werden.',
    }
  }
  return <PortfolioBoerseClient initial={paket} />
}
