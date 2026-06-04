import { brokerSymbolKandidaten } from '@/lib/portfolio-analyse/dividenden-datum-hilfen'
import type { EarningsKennzahlPrognose } from '@/lib/portfolio-analyse/earnings-kennzahlen'
import { kennzahlAusSpanne } from '@/lib/portfolio-analyse/earnings-kennzahlen'
import { ladeFinnhubQuartalsEpsVergleich } from '@/lib/portfolio-analyse/finnhub-earnings-vergleich-server'
import { ladeFinnhubEarningsSchaetzungenKandidaten } from '@/lib/portfolio-analyse/finnhub-earnings-schaetzungen-server'
import { isinKenntnis } from '@/lib/portfolio-analyse/isin-kenntnisse'
import { portfolioLogoQuellen } from '@/lib/portfolio-analyse/portfolio-logos'
import { ladeWallstreetEarningsSchaetzungen } from '@/lib/portfolio-analyse/wallstreet-earnings-schaetzungen-server'
import { ladeYahooEarningsSchaetzungenKandidaten } from '@/lib/portfolio-analyse/yahoo-earnings-schaetzungen-server'
import { ladeYahooEarningsTrend } from '@/lib/portfolio-analyse/yahoo-earnings-trend-server'

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
  /** z. B. „Aktuelles Quartal“ oder „Geschäftsjahr 2026e“. */
  prognosePeriode?: string | null
  kennzahlen: EarningsKennzahlPrognose[]
  weitereKennzahlen: EarningsKennzahlPrognose[]
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

function mergeSpanne(
  a: EarningsSchaetzungSpanne,
  b: EarningsSchaetzungSpanne,
): EarningsSchaetzungSpanne {
  if (a.average != null) return a
  if (b.average != null) return b
  return a
}

function mergeKennzahlen(
  primaer: EarningsKennzahlPrognose[],
  ergaenzung: EarningsKennzahlPrognose[],
): EarningsKennzahlPrognose[] {
  const out = [...primaer]
  for (const k of ergaenzung) {
    if (out.some((x) => x.schluessel === k.schluessel)) continue
    out.push(k)
  }
  return out
}

function mergeSchaetzungen(
  primaer: EarningsSchaetzungen,
  ergaenzung: EarningsSchaetzungen,
): EarningsSchaetzungen {
  const kombiniert = primaer.quelle !== ergaenzung.quelle
  const kennzahlen = mergeKennzahlen(primaer.kennzahlen, ergaenzung.kennzahlen)
  const weitereKennzahlen = mergeKennzahlen(
    primaer.weitereKennzahlen,
    ergaenzung.weitereKennzahlen,
  ).filter((k) => !kennzahlen.some((h) => h.schluessel === k.schluessel))

  return {
    ...primaer,
    quelle: kombiniert ? 'kombiniert' : primaer.quelle,
    eps: mergeSpanne(primaer.eps, ergaenzung.eps),
    umsatz: mergeSpanne(primaer.umsatz, ergaenzung.umsatz),
    quartal: primaer.quartal ?? ergaenzung.quartal,
    jahr: primaer.jahr ?? ergaenzung.jahr,
    prognosePeriode: primaer.prognosePeriode ?? ergaenzung.prognosePeriode,
    kennzahlen,
    weitereKennzahlen,
    berichtszeit: kombiniert
      ? `${primaer.quelle} + ${ergaenzung.quelle}`
      : primaer.berichtszeit,
  }
}

function basisAusYahoo(yahoo: EarningsSchaetzungen): EarningsSchaetzungen {
  return {
    ...yahoo,
    kennzahlen: [],
    weitereKennzahlen: [],
  }
}

function anreichernMitTrend(
  basis: EarningsSchaetzungen,
  trend: Awaited<ReturnType<typeof ladeYahooEarningsTrend>>,
  finnhubVergleich: Awaited<ReturnType<typeof ladeFinnhubQuartalsEpsVergleich>>,
): EarningsSchaetzungen {
  const kennzahlen: EarningsKennzahlPrognose[] = []
  let eps = basis.eps
  let umsatz = basis.umsatz
  let prognosePeriode = basis.prognosePeriode
  let quartal = basis.quartal
  let jahr = basis.jahr

  if (trend) {
    prognosePeriode = trend.periodLabel
    if (trend.eps.average != null) eps = trend.eps
    if (trend.umsatz.average != null) umsatz = trend.umsatz
    kennzahlen.push(...trend.kennzahlen)
  }

  if (finnhubVergleich) {
    quartal = finnhubVergleich.quartal ?? quartal
    jahr = finnhubVergleich.jahr ?? jahr
    if (!trend?.kennzahlen.some((k) => k.schluessel === 'eps')) {
      if (eps.average == null) eps = finnhubVergleich.eps
      kennzahlen.unshift(finnhubVergleich.kennzahl)
    } else {
      const epsIdx = kennzahlen.findIndex((k) => k.schluessel === 'eps')
      if (epsIdx >= 0 && kennzahlen[epsIdx].wachstumProzent == null) {
        kennzahlen[epsIdx] = {
          ...kennzahlen[epsIdx],
          vorjahrWert: finnhubVergleich.kennzahl.vorjahrWert,
          vorjahrAnzeige: finnhubVergleich.kennzahl.vorjahrAnzeige,
          wachstumProzent: finnhubVergleich.kennzahl.wachstumProzent,
          wachstumAnzeige: finnhubVergleich.kennzahl.wachstumAnzeige,
          vergleichLabel: finnhubVergleich.kennzahl.vergleichLabel,
        }
      }
    }
  }

  if (kennzahlen.length === 0) {
    const epsK = kennzahlAusSpanne('eps', 'Gewinn je Aktie (EPS)', eps)
    const umsatzK = kennzahlAusSpanne('umsatz', 'Umsatz', umsatz)
    if (epsK) kennzahlen.push(epsK)
    if (umsatzK) kennzahlen.push(umsatzK)
  }

  const highlight = new Set(['eps', 'umsatz'])
  const weitereKennzahlen = [
    ...basis.weitereKennzahlen,
    ...kennzahlen.filter((k) => !highlight.has(k.schluessel)),
  ].filter((k, i, arr) => arr.findIndex((x) => x.schluessel === k.schluessel) === i)

  const hauptKennzahlen = kennzahlen.filter((k) => highlight.has(k.schluessel))

  return {
    ...basis,
    eps,
    umsatz,
    quartal,
    jahr,
    prognosePeriode,
    kennzahlen: hauptKennzahlen.length > 0 ? hauptKennzahlen : kennzahlen.slice(0, 2),
    weitereKennzahlen,
  }
}

function anreichernMitWallstreet(
  basis: EarningsSchaetzungen,
  wallstreet: EarningsSchaetzungen,
): EarningsSchaetzungen {
  const merged = mergeSchaetzungen(basis, wallstreet)
  const hatQuartalsWachstum = merged.kennzahlen.some((k) => k.wachstumProzent != null)
  const wsKennzahlen = wallstreet.kennzahlen.filter((k) => {
    if (hatQuartalsWachstum && (k.schluessel === 'eps' || k.schluessel === 'umsatz_je_aktie')) {
      return false
    }
    return !merged.kennzahlen.some((h) => h.schluessel === k.schluessel)
  })
  return {
    ...merged,
    weitereKennzahlen: mergeKennzahlen(merged.weitereKennzahlen, wsKennzahlen).filter(
      (k, i, arr) => arr.findIndex((x) => x.schluessel === k.schluessel) === i,
    ),
    prognosePeriode: merged.prognosePeriode ?? wallstreet.prognosePeriode,
  }
}

export async function ladeEarningsSchaetzungen(
  req: EarningsSchaetzungenAnfrage,
): Promise<EarningsSchaetzungen | null> {
  const symbole = symboleFuerAnfrage(req)
  const isin = req.isin?.trim().toUpperCase() ?? ''
  const primaerSymbol = symbole[0] ?? ''

  const [yahooRoh, wallstreet, finnhubKalender, trend, finnhubVergleich] = await Promise.all([
    symbole.length > 0 ? ladeYahooEarningsSchaetzungenKandidaten(symbole) : null,
    isin.length >= 10 ? ladeWallstreetEarningsSchaetzungen(isin, req.name ?? '') : null,
    symbole.length > 0
      ? ladeFinnhubEarningsSchaetzungenKandidaten(symbole, req.terminDatumIso)
      : null,
    primaerSymbol ? ladeYahooEarningsTrend(primaerSymbol) : null,
    primaerSymbol ? ladeFinnhubQuartalsEpsVergleich(primaerSymbol, req.terminDatumIso) : null,
  ])

  let basis: EarningsSchaetzungen | null = yahooRoh ? basisAusYahoo(yahooRoh) : null

  if (!basis && finnhubKalender) {
    basis = {
      quelle: 'finnhub',
      terminDatumIso: finnhubKalender.terminDatumIso,
      isEarningsDateEstimate: finnhubKalender.isEarningsDateEstimate,
      earningsCallDateIso: finnhubKalender.earningsCallDateIso,
      eps: finnhubKalender.eps,
      umsatz: finnhubKalender.umsatz,
      quartal: finnhubKalender.quartal,
      jahr: finnhubKalender.jahr,
      kennzahlen: [],
      weitereKennzahlen: [],
    }
  }

  if (!basis && wallstreet) return wallstreet

  if (!basis) return null

  let ergebnis = anreichernMitTrend(basis, trend, finnhubVergleich)

  if (finnhubKalender && (ergebnis.umsatz.average == null || ergebnis.eps.average == null)) {
    ergebnis = mergeSchaetzungen(ergebnis, {
      ...ergebnis,
      quelle: 'finnhub',
      eps: mergeSpanne(ergebnis.eps, finnhubKalender.eps),
      umsatz: mergeSpanne(ergebnis.umsatz, finnhubKalender.umsatz),
      kennzahlen: ergebnis.kennzahlen,
      weitereKennzahlen: ergebnis.weitereKennzahlen,
    })
  }

  if (wallstreet) {
    ergebnis = anreichernMitWallstreet(ergebnis, wallstreet)
  }

  return ergebnis
}
