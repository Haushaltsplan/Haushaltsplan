import { brokerSymbolKandidaten } from '@/lib/portfolio-analyse/dividenden-datum-hilfen'
import { ladeFinnhubEarningsSchaetzungenKandidaten } from '@/lib/portfolio-analyse/finnhub-earnings-schaetzungen-server'
import { isinKenntnis } from '@/lib/portfolio-analyse/isin-kenntnisse'
import { portfolioLogoQuellen } from '@/lib/portfolio-analyse/portfolio-logos'
import { ladeWallstreetEarningsSchaetzungen } from '@/lib/portfolio-analyse/wallstreet-earnings-schaetzungen-server'
import { ladeYahooEarningsSchaetzungenKandidaten } from '@/lib/portfolio-analyse/yahoo-earnings-schaetzungen-server'

export type EarningsSchaetzungSpanne = {
  low: number | null
  high: number | null
  average: number | null
  averageAnzeige: string | null
}

export type EarningsSchaetzungen = {
  quelle: 'yahoo' | 'finnhub' | 'wallstreet' | 'kombiniert'
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

function mergeSchaetzungen(
  primaer: EarningsSchaetzungen,
  ergaenzung: EarningsSchaetzungen,
): EarningsSchaetzungen {
  const eps =
    primaer.eps.average != null
      ? primaer.eps
      : ergaenzung.eps.average != null
        ? ergaenzung.eps
        : primaer.eps
  const umsatz =
    primaer.umsatz.average != null
      ? primaer.umsatz
      : ergaenzung.umsatz.average != null
        ? ergaenzung.umsatz
        : primaer.umsatz

  const kombiniert = primaer.quelle !== ergaenzung.quelle
  return {
    ...primaer,
    quelle: kombiniert ? 'kombiniert' : primaer.quelle,
    eps,
    umsatz,
    berichtszeit: kombiniert
      ? `${primaer.quelle} + ${ergaenzung.quelle}`
      : primaer.berichtszeit,
  }
}

export async function ladeEarningsSchaetzungen(
  req: EarningsSchaetzungenAnfrage,
): Promise<EarningsSchaetzungen | null> {
  const symbole = symboleFuerAnfrage(req)
  const isin = req.isin?.trim().toUpperCase() ?? ''

  const [yahoo, wallstreet, finnhub] = await Promise.all([
    symbole.length > 0 ? ladeYahooEarningsSchaetzungenKandidaten(symbole) : null,
    isin.length >= 10 ? ladeWallstreetEarningsSchaetzungen(isin, req.name ?? '') : null,
    symbole.length > 0
      ? ladeFinnhubEarningsSchaetzungenKandidaten(symbole, req.terminDatumIso)
      : null,
  ])

  if (yahoo && wallstreet) return mergeSchaetzungen(yahoo, wallstreet)
  if (yahoo && finnhub && (yahoo.eps.average == null || yahoo.umsatz.average == null)) {
    return mergeSchaetzungen(yahoo, finnhub)
  }
  if (wallstreet && finnhub && wallstreet.umsatz.average == null) {
    return mergeSchaetzungen(wallstreet, finnhub)
  }

  return yahoo ?? wallstreet ?? finnhub
}
