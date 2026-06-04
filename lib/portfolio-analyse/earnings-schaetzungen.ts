import { brokerSymbolKandidaten } from '@/lib/portfolio-analyse/dividenden-datum-hilfen'
import { ladeFinnhubEarningsSchaetzungenKandidaten } from '@/lib/portfolio-analyse/finnhub-earnings-schaetzungen-server'
import { isinKenntnis } from '@/lib/portfolio-analyse/isin-kenntnisse'
import { portfolioLogoQuellen } from '@/lib/portfolio-analyse/portfolio-logos'
import { ladeYahooEarningsSchaetzungenKandidaten } from '@/lib/portfolio-analyse/yahoo-earnings-schaetzungen-server'

export type EarningsSchaetzungSpanne = {
  low: number | null
  high: number | null
  average: number | null
  averageAnzeige: string | null
}

export type EarningsSchaetzungen = {
  quelle: 'yahoo' | 'finnhub'
  terminDatumIso: string | null
  isEarningsDateEstimate: boolean
  earningsCallDateIso: string | null
  eps: EarningsSchaetzungSpanne
  umsatz: EarningsSchaetzungSpanne
  quartal?: number | null
  jahr?: number | null
  berichtszeit?: string | null
}

export type EarningsSchaetzungenAnfrage = {
  isin?: string | null
  name?: string
  symbolYahoo?: string | null
  symbolCandidates?: string[]
  terminDatumIso?: string
}

function symboleFuerAnfrage(req: EarningsSchaetzungenAnfrage): string[] {
  const out: string[] = []
  const add = (s: string | null | undefined) => {
    for (const t of brokerSymbolKandidaten(s ?? '')) {
      if (t && !out.includes(t)) out.push(t)
    }
  }
  add(req.symbolYahoo)
  for (const c of req.symbolCandidates ?? []) add(c)

  const isin = req.isin?.trim().toUpperCase() ?? ''
  if (isin.length >= 10) {
    const k = isinKenntnis(isin)
    add(k?.symbolYahoo)
    for (const c of k?.symbolCandidates ?? []) add(c)
    const logo = portfolioLogoQuellen(isin, k?.symbolYahoo, k?.name ?? req.name ?? '')
    if (logo.finnhubSlug) {
      const slug = logo.finnhubSlug.trim().toUpperCase()
      if (slug && !out.includes(slug)) out.push(slug)
    }
  }
  return out
}

export async function ladeEarningsSchaetzungen(
  req: EarningsSchaetzungenAnfrage,
): Promise<EarningsSchaetzungen | null> {
  const symbole = symboleFuerAnfrage(req)
  if (symbole.length === 0) return null

  const yahoo = await ladeYahooEarningsSchaetzungenKandidaten(symbole)
  if (yahoo) return yahoo

  return ladeFinnhubEarningsSchaetzungenKandidaten(symbole, req.terminDatumIso)
}
