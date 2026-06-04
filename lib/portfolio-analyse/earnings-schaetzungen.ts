import { berichtszeitLabel } from '@/lib/portfolio-analyse/earnings-berichtszeit'
import type { Berichtszeit } from '@/lib/portfolio-analyse/earnings-berichtszeit'
import { heuteIsoUtc } from '@/lib/portfolio-analyse/dividenden-datum-hilfen'
import type { EarningsKennzahlPrognose, EarningsKennzahlSchluessel } from '@/lib/portfolio-analyse/earnings-kennzahlen'
import { kennzahlAusSpanne } from '@/lib/portfolio-analyse/earnings-kennzahlen'
import {
  epsZeileMitIst,
  ladeFinnhubEpsIst,
} from '@/lib/portfolio-analyse/finnhub-earnings-ist-server'
import type { EarningsQuartalsPrognose } from '@/lib/portfolio-analyse/earnings-quartals-prognose'
import {
  bauePrognoseZeile,
  QUARTALS_METRIK_REIHENFOLGE,
  type QuartalsPrognoseMetrik,
  type QuartalsPrognoseZeile,
} from '@/lib/portfolio-analyse/earnings-quartals-prognose'
import { brokerSymbolKandidaten } from '@/lib/portfolio-analyse/dividenden-datum-hilfen'
import { ladeFinnhubQuartalsEpsVergleich } from '@/lib/portfolio-analyse/finnhub-earnings-vergleich-server'
import { ladeFinnhubEarningsSchaetzungenKandidaten } from '@/lib/portfolio-analyse/finnhub-earnings-schaetzungen-server'
import { ladeInvestorRelationsUrl } from '@/lib/portfolio-analyse/investor-relations-url'
import {
  jahresSchaetzungAusWallstreet,
  type JahresEarningsSchaetzung,
} from '@/lib/portfolio-analyse/jahres-earnings-schaetzung'
import { isinKenntnis } from '@/lib/portfolio-analyse/isin-kenntnisse'
import {
  ladeMarketscreenerQuartalsPrognose,
  prognoseMitMarketscreenerIst,
} from '@/lib/portfolio-analyse/marketscreener-quartals-schaetzungen-server'
import { portfolioLogoQuellen } from '@/lib/portfolio-analyse/portfolio-logos'
import {
  ladeWallstreetEarningsSchaetzungen,
  wallstreetZuQuartalsPrognose,
} from '@/lib/portfolio-analyse/wallstreet-earnings-schaetzungen-server'
import {
  ladeYahooEarningsHistoryIst,
  prognoseZeilenMitYahooIst,
} from '@/lib/portfolio-analyse/yahoo-earnings-history-server'
import {
  ladeYahooEarningsTrend,
  ladeYahooQuartalsPrognose,
} from '@/lib/portfolio-analyse/yahoo-earnings-trend-server'

export type EarningsSchaetzungSpanne = {
  low: number | null
  high: number | null
  average: number | null
  averageAnzeige: string | null
}

export type EarningsSchaetzungen = {
  quelle: 'yahoo' | 'finnhub' | 'wallstreet' | 'marketscreener' | 'kombiniert'
  terminDatumIso: string | null
  isEarningsDateEstimate: boolean
  earningsCallDateIso: string | null
  eps: EarningsSchaetzungSpanne
  umsatz: EarningsSchaetzungSpanne
  quartal?: number | null
  jahr?: number | null
  berichtszeit?: string | null
  prognosePeriode?: string | null
  /** Quartr-artige Quartalstabelle (nur Quartalszahlen). */
  quartalsPrognose: EarningsQuartalsPrognose | null
  /** Jahres-Konsens Umsatz/EPS (Wallstreet o. ä.). */
  jahresSchaetzung?: JahresEarningsSchaetzung | null
  /** Investor Relations — Berichte & Earnings. */
  investorRelationsUrl?: string | null
  /** Earnings-Termin liegt in der Vergangenheit (Istwerte möglich). */
  berichtVeroeffentlicht?: boolean
  kennzahlen: EarningsKennzahlPrognose[]
  weitereKennzahlen: EarningsKennzahlPrognose[]
}

export type EarningsSchaetzungenAnfrage = {
  isin?: string | null
  name?: string
  symbolYahoo?: string | null
  symbolCandidates?: string[]
  terminDatumIso?: string
  berichtszeit?: Berichtszeit | null
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
    const logo = portfolioLogoQuellen(isin, k?.symbolYahoo, req.name ?? '')
    if (logo.finnhubSlug) {
      const slug = logo.finnhubSlug.trim().toUpperCase()
      if (slug && !out.includes(slug)) out.push(slug)
    }
  }
  return out
}

function mergeZeilen(
  primary: QuartalsPrognoseZeile[],
  extra: QuartalsPrognoseZeile[],
): QuartalsPrognoseZeile[] {
  const out = [...primary]
  for (const z of extra) {
    const i = out.findIndex((r) => r.metrik === z.metrik)
    if (i < 0) {
      out.push(z)
      continue
    }
    const cur = out[i]
    out[i] = {
      ...cur,
      schaetzung: cur.schaetzung ?? z.schaetzung,
      schaetzungAnzeige: cur.schaetzungAnzeige ?? z.schaetzungAnzeige,
      vorjahr: cur.vorjahr ?? z.vorjahr,
      vorjahrAnzeige: cur.vorjahrAnzeige ?? z.vorjahrAnzeige,
      wachstumProzent: cur.wachstumProzent ?? z.wachstumProzent,
      wachstumAnzeige: cur.wachstumAnzeige ?? z.wachstumAnzeige,
      waehrung: cur.waehrung || z.waehrung,
    }
  }
  out.sort(
    (a, b) =>
      QUARTALS_METRIK_REIHENFOLGE.indexOf(a.metrik) - QUARTALS_METRIK_REIHENFOLGE.indexOf(b.metrik),
  )
  return out
}

function hatKernDaten(q: EarningsQuartalsPrognose | null): boolean {
  if (!q || q.zeilen.length === 0) return false
  const u = q.zeilen.find((z) => z.metrik === 'umsatz')
  const e = q.zeilen.find((z) => z.metrik === 'eps')
  return (u?.schaetzung != null && u.schaetzung > 0) || (e?.schaetzung != null && e.schaetzung !== 0)
}

function metrikAusSchluessel(s: EarningsKennzahlSchluessel): QuartalsPrognoseMetrik | null {
  if (s === 'eps') return 'eps'
  if (s === 'umsatz' || s === 'umsatz_je_aktie') return 'umsatz'
  if (s === 'ebitda') return 'ebitda'
  if (s === 'ebit') return 'ebit'
  return null
}

function ergaenzeZeilenAusKennzahlen(
  zeilen: QuartalsPrognoseZeile[],
  kennzahlen: EarningsKennzahlPrognose[],
  waehrung: string,
): QuartalsPrognoseZeile[] {
  const out = [...zeilen]
  for (const k of kennzahlen) {
    const metrik = metrikAusSchluessel(k.schluessel)
    if (!metrik || out.some((z) => z.metrik === metrik)) continue
    const row = bauePrognoseZeile(
      metrik,
      k.label,
      waehrung,
      k.spanne.average,
      k.vorjahrWert,
      k.wachstumProzent,
    )
    if (row) out.push(row)
  }
  out.sort(
    (a, b) =>
      QUARTALS_METRIK_REIHENFOLGE.indexOf(a.metrik) - QUARTALS_METRIK_REIHENFOLGE.indexOf(b.metrik),
  )
  return out
}

function terminIstVergangen(termin: string | undefined): boolean {
  if (!termin) return false
  return termin.slice(0, 10) <= heuteIsoUtc()
}

function ausQuartalsPrognose(
  q: EarningsQuartalsPrognose,
  berichtszeitExtern: Berichtszeit | null,
  quelle: EarningsSchaetzungen['quelle'],
  extras: {
    jahresSchaetzung: JahresEarningsSchaetzung | null
    investorRelationsUrl: string | null
    berichtVeroeffentlicht: boolean
    zusaetzlicheKennzahlen?: EarningsKennzahlPrognose[]
  },
): EarningsSchaetzungen {
  const umsatzZ = q.zeilen.find((z) => z.metrik === 'umsatz')
  const epsZ = q.zeilen.find((z) => z.metrik === 'eps')
  const berichtszeit = berichtszeitExtern ?? q.berichtszeit

  const umsatz = {
    low: null,
    high: null,
    average: umsatzZ?.schaetzung ?? null,
    averageAnzeige: umsatzZ?.schaetzungAnzeige ?? null,
  }
  const eps = {
    low: null,
    high: null,
    average: epsZ?.schaetzung ?? null,
    averageAnzeige: epsZ?.schaetzungAnzeige ?? null,
  }

  const kennzahlen: EarningsKennzahlPrognose[] = []
  for (const z of q.zeilen) {
    const spanne = {
      low: null,
      high: null,
      average: z.schaetzung,
      averageAnzeige: z.schaetzungAnzeige,
    }
    const schluessel =
      z.metrik === 'eps'
        ? 'eps'
        : z.metrik === 'umsatz'
          ? 'umsatz'
          : z.metrik === 'ebitda'
            ? 'ebitda'
            : z.metrik === 'ebit'
              ? 'ebit'
              : 'sonstiges'
    const k = kennzahlAusSpanne(schluessel, z.label, spanne, {
      vorjahrWert: z.vorjahr,
      vorjahrAnzeige: z.vorjahrAnzeige,
      wachstumProzent: z.wachstumProzent,
      vergleichArt: q.quartalLabel.includes('Geschäftsjahr')
        ? 'vorjahr_geschaeftsjahr'
        : 'vorjahr_quartal',
      vergleichLabel: `vs. ${q.vorjahrQuartalLabel}`,
    })
    if (k) kennzahlen.push(k)
  }

  const waehrung = q.zeilen[0]?.waehrung ?? 'USD'
  const zeilenVoll = ergaenzeZeilenAusKennzahlen(
    q.zeilen,
    [...kennzahlen, ...(extras.zusaetzlicheKennzahlen ?? [])],
    waehrung,
  )

  return {
    quelle,
    terminDatumIso: q.terminDatumIso,
    isEarningsDateEstimate: false,
    earningsCallDateIso: null,
    eps,
    umsatz,
    prognosePeriode: q.quartalLabel,
    berichtszeit: berichtszeitLabel(berichtszeit) ?? q.berichtszeitLabel,
    quartalsPrognose: {
      ...q,
      zeilen: zeilenVoll,
      berichtszeit: berichtszeit ?? q.berichtszeit,
      berichtszeitLabel: berichtszeitLabel(berichtszeit) ?? q.berichtszeitLabel,
    },
    jahresSchaetzung: extras.jahresSchaetzung,
    investorRelationsUrl: extras.investorRelationsUrl,
    berichtVeroeffentlicht: extras.berichtVeroeffentlicht,
    kennzahlen,
    weitereKennzahlen: kennzahlen.filter(
      (k) => k.schluessel !== 'eps' && k.schluessel !== 'umsatz',
    ),
  }
}

export async function ladeEarningsSchaetzungen(
  req: EarningsSchaetzungenAnfrage,
): Promise<EarningsSchaetzungen | null> {
  const symbole = symboleFuerAnfrage(req)
  const primaerSymbol = symbole[0] ?? ''
  const termin = req.terminDatumIso?.slice(0, 10)
  const isin = req.isin?.trim().toUpperCase() ?? ''
  const name = req.name ?? ''

  const berichtVeroeffentlicht = terminIstVergangen(termin)

  const [
    yahooQ,
    trend,
    finnhubVergleich,
    marketscreenerPaket,
    finnhubKalender,
    wallstreet,
    investorRelationsUrl,
    finnhubEpsIst,
  ] = await Promise.all([
    primaerSymbol ? ladeYahooQuartalsPrognose(primaerSymbol, termin) : null,
    primaerSymbol ? ladeYahooEarningsTrend(primaerSymbol, termin) : null,
    primaerSymbol ? ladeFinnhubQuartalsEpsVergleich(primaerSymbol, termin) : null,
    isin.length >= 10
      ? ladeMarketscreenerQuartalsPrognose(isin, name, primaerSymbol, termin)
      : null,
    symbole.length > 0 ? ladeFinnhubEarningsSchaetzungenKandidaten(symbole, termin) : null,
    isin.length >= 10 ? ladeWallstreetEarningsSchaetzungen(isin, name) : null,
    isin.length >= 10 ? ladeInvestorRelationsUrl(isin, name, primaerSymbol) : null,
    primaerSymbol && berichtVeroeffentlicht
      ? ladeFinnhubEpsIst(primaerSymbol, termin)
      : null,
  ])

  const marketscreenerQ = marketscreenerPaket?.prognose ?? null
  const marketscreenerHtml = marketscreenerPaket?.html ?? null
  const jahresSchaetzung = jahresSchaetzungAusWallstreet(wallstreet)

  let prognose: EarningsQuartalsPrognose | null = null
  const quellen: string[] = []

  if (yahooQ && hatKernDaten(yahooQ)) {
    prognose = { ...yahooQ }
    quellen.push('yahoo')
  } else if (yahooQ) {
    prognose = { ...yahooQ }
  }

  if (marketscreenerQ) {
    if (prognose) {
      prognose = {
        ...prognose,
        zeilen: mergeZeilen(prognose.zeilen, marketscreenerQ.zeilen),
        quartalLabel: prognose.quartalLabel || marketscreenerQ.quartalLabel,
        vorjahrQuartalLabel:
          prognose.vorjahrQuartalLabel || marketscreenerQ.vorjahrQuartalLabel,
      }
      quellen.push('marketscreener')
    } else if (hatKernDaten(marketscreenerQ) || marketscreenerQ.zeilen.length > 0) {
      prognose = marketscreenerQ
      quellen.push('marketscreener')
    }
  }

  if (prognose && marketscreenerHtml && berichtVeroeffentlicht) {
    prognose = prognoseMitMarketscreenerIst(prognose, marketscreenerHtml)
  }

  if (!hatKernDaten(prognose) && finnhubKalender) {
    const umsatzZ = finnhubKalender.umsatz.average
    const epsZ = finnhubKalender.eps.average
    const zeilen: QuartalsPrognoseZeile[] = []
    if (umsatzZ != null) {
      const row = prognose?.zeilen.find((z) => z.metrik === 'umsatz')
      if (!row?.schaetzung) {
        zeilen.push({
          metrik: 'umsatz',
          label: 'Revenue',
          waehrung: 'USD',
          schaetzung: umsatzZ,
          schaetzungAnzeige: finnhubKalender.umsatz.averageAnzeige,
          vorjahr: null,
          vorjahrAnzeige: null,
          wachstumProzent: null,
          wachstumAnzeige: null,
        })
      }
    }
    if (epsZ != null) {
      const row = prognose?.zeilen.find((z) => z.metrik === 'eps')
      if (!row?.schaetzung) {
        zeilen.push({
          metrik: 'eps',
          label: 'EPS',
          waehrung: 'USD',
          schaetzung: epsZ,
          schaetzungAnzeige: finnhubKalender.eps.averageAnzeige,
          vorjahr: null,
          vorjahrAnzeige: null,
          wachstumProzent: null,
          wachstumAnzeige: null,
        })
      }
    }
    if (zeilen.length > 0) {
      prognose = prognose
        ? { ...prognose, zeilen: mergeZeilen(prognose.zeilen, zeilen) }
        : {
            quartalLabel: finnhubKalender.prognosePeriode ?? 'Quartal',
            vorjahrQuartalLabel: 'Vorjahr',
            periodEndIso: null,
            terminDatumIso: finnhubKalender.terminDatumIso ?? termin ?? null,
            berichtszeit: req.berichtszeit ?? null,
            berichtszeitLabel: finnhubKalender.berichtszeit ?? null,
            zeilen,
          }
      quellen.push('finnhub')
    }
  }

  if (!hatKernDaten(prognose) && wallstreet) {
    const wsQ = wallstreetZuQuartalsPrognose(wallstreet, termin ?? null)
    if (wsQ) {
      prognose = {
        ...wsQ,
        zeilen: mergeZeilen(wsQ.zeilen, prognose?.zeilen ?? []),
        terminDatumIso: prognose?.terminDatumIso ?? wsQ.terminDatumIso,
      }
      quellen.push('wallstreet')
    }
  }

  if (prognose && finnhubVergleich) {
    const epsIdx = prognose.zeilen.findIndex((z) => z.metrik === 'eps')
    if (epsIdx >= 0) {
      const z = prognose.zeilen[epsIdx]
      if (z.vorjahr == null && finnhubVergleich.kennzahl.vorjahrWert != null) {
        prognose.zeilen[epsIdx] = {
          ...z,
          vorjahr: finnhubVergleich.kennzahl.vorjahrWert,
          vorjahrAnzeige: finnhubVergleich.kennzahl.vorjahrAnzeige,
          wachstumProzent: finnhubVergleich.kennzahl.wachstumProzent,
          wachstumAnzeige: finnhubVergleich.kennzahl.wachstumAnzeige,
        }
      }
    }
  }

  if (!prognose && trend) {
    const umsatzZ = trend.kennzahlen.find((k) => k.schluessel === 'umsatz')
    const epsZ = trend.kennzahlen.find((k) => k.schluessel === 'eps')
    prognose = {
      quartalLabel: trend.periodLabel,
      vorjahrQuartalLabel: epsZ?.vergleichLabel?.replace('vs. ', '') ?? 'Vorjahr',
      periodEndIso: null,
      terminDatumIso: termin ?? null,
      berichtszeit: req.berichtszeit ?? null,
      berichtszeitLabel: berichtszeitLabel(req.berichtszeit) ?? null,
      zeilen: [
        ...(umsatzZ
          ? [
              {
                metrik: 'umsatz' as const,
                label: 'Revenue',
                waehrung: 'USD',
                schaetzung: umsatzZ.spanne.average,
                schaetzungAnzeige: umsatzZ.spanne.averageAnzeige,
                vorjahr: umsatzZ.vorjahrWert,
                vorjahrAnzeige: umsatzZ.vorjahrAnzeige,
                wachstumProzent: umsatzZ.wachstumProzent,
                wachstumAnzeige: umsatzZ.wachstumAnzeige,
              },
            ]
          : []),
        ...(epsZ
          ? [
              {
                metrik: 'eps' as const,
                label: 'EPS',
                waehrung: 'USD',
                schaetzung: epsZ.spanne.average,
                schaetzungAnzeige: epsZ.spanne.averageAnzeige,
                vorjahr: epsZ.vorjahrWert,
                vorjahrAnzeige: epsZ.vorjahrAnzeige,
                wachstumProzent: epsZ.wachstumProzent,
                wachstumAnzeige: epsZ.wachstumAnzeige,
              },
            ]
          : []),
      ],
    }
    quellen.push('yahoo')
  }

  if (!prognose || prognose.zeilen.length === 0) return null

  if (termin && !prognose.terminDatumIso) {
    prognose = { ...prognose, terminDatumIso: termin }
  }

  if (berichtVeroeffentlicht && primaerSymbol) {
    const yahooHistoryIst = await ladeYahooEarningsHistoryIst(
      primaerSymbol,
      prognose.quartalLabel,
    )
    if (yahooHistoryIst) {
      prognose = { ...prognose, zeilen: prognoseZeilenMitYahooIst(prognose.zeilen, yahooHistoryIst) }
    }
    if (finnhubEpsIst) {
      const epsIdx = prognose.zeilen.findIndex((z) => z.metrik === 'eps')
      if (epsIdx >= 0) {
        prognose.zeilen[epsIdx] = epsZeileMitIst(prognose.zeilen[epsIdx], finnhubEpsIst)
      } else {
        const row = bauePrognoseZeile(
          'eps',
          'EPS',
          prognose.zeilen[0]?.waehrung ?? 'USD',
          finnhubEpsIst.schaetzung,
          null,
        )
        if (row) {
          prognose.zeilen.push(epsZeileMitIst(row, finnhubEpsIst))
        }
      }
    }
  }

  const quelle: EarningsSchaetzungen['quelle'] =
    quellen.length > 1 ? 'kombiniert' : (quellen[0] as EarningsSchaetzungen['quelle']) ?? 'yahoo'

  return ausQuartalsPrognose(prognose, req.berichtszeit ?? prognose.berichtszeit, quelle, {
    jahresSchaetzung,
    investorRelationsUrl,
    berichtVeroeffentlicht,
    zusaetzlicheKennzahlen: wallstreet?.kennzahlen,
  })
}
