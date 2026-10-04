import { berichtszeitLabel } from '@/lib/portfolio-analyse/earnings-berichtszeit'
import type { Berichtszeit } from '@/lib/portfolio-analyse/earnings-berichtszeit'
import type { EarningsKennzahlPrognose, EarningsKennzahlSchluessel } from '@/lib/portfolio-analyse/earnings-kennzahlen'
import { kennzahlAusSpanne } from '@/lib/portfolio-analyse/earnings-kennzahlen'
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
import type { JahresEarningsSchaetzung } from '@/lib/portfolio-analyse/jahres-earnings-schaetzung'
import { ladeJahresSchaetzungKombiniert } from '@/lib/portfolio-analyse/marketscreener-jahres-consensus-server'
import { isinKenntnis } from '@/lib/portfolio-analyse/isin-kenntnisse'
import { ladeMarketscreenerQuartalsPrognose } from '@/lib/portfolio-analyse/marketscreener-quartals-schaetzungen-server'
import { portfolioLogoQuellen } from '@/lib/portfolio-analyse/portfolio-logos'
import {
  ladeWallstreetEarningsSchaetzungen,
  wallstreetZuQuartalsPrognose,
} from '@/lib/portfolio-analyse/wallstreet-earnings-schaetzungen-server'
import {
  leereRevisionMeta,
  type EarningsRevisionMeta,
} from '@/lib/portfolio-analyse/earnings-revision-meta'
import { ladeYahooEarningsSchaetzungen } from '@/lib/portfolio-analyse/yahoo-earnings-schaetzungen-server'
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
  quelle: 'yahoo' | 'finnhub' | 'wallstreet' | 'marketscreener' | 'stockanalysis' | 'kombiniert'
  terminDatumIso: string | null
  isEarningsDateEstimate: boolean
  earningsCallDateIso: string | null
  eps: EarningsSchaetzungSpanne
  umsatz: EarningsSchaetzungSpanne
  quartal?: number | null
  jahr?: number | null
  berichtszeit?: string | null
  /** Typisierte Berichtszeit (BMO/AMC). */
  berichtszeitTyp?: Berichtszeit | null
  prognosePeriode?: string | null
  /** Quartr-artige Quartalstabelle (nur Quartalszahlen). */
  quartalsPrognose: EarningsQuartalsPrognose | null
  /** Jahres-Konsens Umsatz/EPS (Wallstreet o. ä.). */
  jahresSchaetzung?: JahresEarningsSchaetzung | null
  /** Investor Relations — Berichte & Earnings. */
  investorRelationsUrl?: string | null
  /** Earnings-Termin liegt in der Vergangenheit (Istwerte möglich). */
  berichtVeroeffentlicht?: boolean
  revisionMeta?: EarningsRevisionMeta | null
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
      low: cur.low ?? z.low,
      high: cur.high ?? z.high,
      numberOfAnalysts: cur.numberOfAnalysts ?? z.numberOfAnalysts,
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

/** Fehlende EPS- oder Umsatz-Zeile? → Fill-Quellen nutzen. */
function fehltEpsOderUmsatz(q: EarningsQuartalsPrognose | null): boolean {
  if (!q) return true
  const u = q.zeilen.find((z) => z.metrik === 'umsatz')
  const e = q.zeilen.find((z) => z.metrik === 'eps')
  return u?.schaetzung == null || e?.schaetzung == null
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

function ausQuartalsPrognose(
  q: EarningsQuartalsPrognose,
  berichtszeitExtern: Berichtszeit | null,
  quelle: EarningsSchaetzungen['quelle'],
  extras: {
    jahresSchaetzung: JahresEarningsSchaetzung | null
    investorRelationsUrl: string | null
    berichtVeroeffentlicht: boolean
    zusaetzlicheKennzahlen?: EarningsKennzahlPrognose[]
    revisionMeta?: EarningsRevisionMeta | null
    calendarEventsFill?: { eps: EarningsSchaetzungSpanne; umsatz: EarningsSchaetzungSpanne } | null
  },
): EarningsSchaetzungen {
  const umsatzZ = q.zeilen.find((z) => z.metrik === 'umsatz')
  const epsZ = q.zeilen.find((z) => z.metrik === 'eps')
  const berichtszeit = berichtszeitExtern ?? q.berichtszeit
  const cal = extras.calendarEventsFill

  const umsatz = {
    low: umsatzZ?.low ?? cal?.umsatz.low ?? null,
    high: umsatzZ?.high ?? cal?.umsatz.high ?? null,
    average: umsatzZ?.schaetzung ?? cal?.umsatz.average ?? null,
    averageAnzeige: umsatzZ?.schaetzungAnzeige ?? cal?.umsatz.averageAnzeige ?? null,
  }
  const eps = {
    low: epsZ?.low ?? cal?.eps.low ?? null,
    high: epsZ?.high ?? cal?.eps.high ?? null,
    average: epsZ?.schaetzung ?? cal?.eps.average ?? null,
    averageAnzeige: epsZ?.schaetzungAnzeige ?? cal?.eps.averageAnzeige ?? null,
  }

  const kennzahlen: EarningsKennzahlPrognose[] = []
  for (const z of q.zeilen) {
    const spanne = {
      low: z.low ?? null,
      high: z.high ?? null,
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
    berichtszeitTyp: berichtszeit ?? null,
    quartalsPrognose: {
      ...q,
      zeilen: zeilenVoll,
      berichtszeit: berichtszeit ?? q.berichtszeit,
      berichtszeitLabel: berichtszeitLabel(berichtszeit) ?? q.berichtszeitLabel,
      revisionMeta: extras.revisionMeta ?? q.revisionMeta ?? null,
    },
    jahresSchaetzung: extras.jahresSchaetzung,
    investorRelationsUrl: extras.investorRelationsUrl,
    berichtVeroeffentlicht: extras.berichtVeroeffentlicht,
    revisionMeta: extras.revisionMeta ?? q.revisionMeta ?? leereRevisionMeta(),
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

  const [
    yahooQ,
    trend,
    finnhubVergleich,
    marketscreenerPaket,
    finnhubKalender,
    wallstreet,
    investorRelationsUrl,
    yahooCalendarEvents,
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
    primaerSymbol ? ladeYahooEarningsSchaetzungen(primaerSymbol) : null,
  ])

  const marketscreenerQ = marketscreenerPaket?.prognose ?? null
  const jahresPromise =
    isin.length >= 10
      ? ladeJahresSchaetzungKombiniert(isin, name, primaerSymbol, wallstreet)
      : null

  let prognose: EarningsQuartalsPrognose | null = null
  const quellen: string[] = []
  let revisionMeta: EarningsRevisionMeta | null = null

  if (marketscreenerQ && (hatKernDaten(marketscreenerQ) || marketscreenerQ.zeilen.length > 0)) {
    prognose = { ...marketscreenerQ }
    quellen.push('marketscreener')
  }

  // Wallstreet/Finnhub als Feld-Fill, auch wenn MS schon Umsatz hat (EPS-Lücke)
  if (fehltEpsOderUmsatz(prognose) && wallstreet) {
    const wsQ = wallstreetZuQuartalsPrognose(wallstreet, termin ?? null)
    if (wsQ) {
      prognose = prognose
        ? {
            ...prognose,
            zeilen: mergeZeilen(prognose.zeilen, wsQ.zeilen),
            terminDatumIso: prognose.terminDatumIso ?? wsQ.terminDatumIso,
          }
        : wsQ
      if (!quellen.includes('wallstreet')) quellen.push('wallstreet')
    }
  }

  if (fehltEpsOderUmsatz(prognose) && finnhubKalender) {
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
      if (!quellen.includes('finnhub')) quellen.push('finnhub')
    }
  }

  if (yahooQ) {
    if (prognose) {
      prognose = {
        ...prognose,
        zeilen: mergeZeilen(prognose.zeilen, yahooQ.zeilen),
        quartalLabel: prognose.quartalLabel || yahooQ.quartalLabel,
        vorjahrQuartalLabel: prognose.vorjahrQuartalLabel || yahooQ.vorjahrQuartalLabel,
        terminDatumIso: prognose.terminDatumIso ?? yahooQ.terminDatumIso,
        berichtszeit: prognose.berichtszeit ?? yahooQ.berichtszeit,
        berichtszeitLabel: prognose.berichtszeitLabel ?? yahooQ.berichtszeitLabel,
        revisionMeta: prognose.revisionMeta ?? yahooQ.revisionMeta,
      }
      if (!quellen.includes('yahoo')) quellen.push('yahoo')
    } else if (hatKernDaten(yahooQ) || yahooQ.zeilen.length > 0) {
      prognose = { ...yahooQ }
      quellen.push('yahoo')
    }
    revisionMeta = yahooQ.revisionMeta ?? revisionMeta
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

  // calendarEvents Low/High/Avg als Spannen-Fill
  if (yahooCalendarEvents && prognose) {
    const calZeilen: QuartalsPrognoseZeile[] = []
    if (yahooCalendarEvents.umsatz.average != null) {
      calZeilen.push({
        metrik: 'umsatz',
        label: 'Revenue',
        waehrung: 'USD',
        schaetzung: yahooCalendarEvents.umsatz.average,
        schaetzungAnzeige: yahooCalendarEvents.umsatz.averageAnzeige,
        vorjahr: null,
        vorjahrAnzeige: null,
        wachstumProzent: null,
        wachstumAnzeige: null,
        low: yahooCalendarEvents.umsatz.low,
        high: yahooCalendarEvents.umsatz.high,
      })
    }
    if (yahooCalendarEvents.eps.average != null) {
      calZeilen.push({
        metrik: 'eps',
        label: 'EPS',
        waehrung: 'USD',
        schaetzung: yahooCalendarEvents.eps.average,
        schaetzungAnzeige: yahooCalendarEvents.eps.averageAnzeige,
        vorjahr: null,
        vorjahrAnzeige: null,
        wachstumProzent: null,
        wachstumAnzeige: null,
        low: yahooCalendarEvents.eps.low,
        high: yahooCalendarEvents.eps.high,
      })
    }
    if (calZeilen.length > 0) {
      prognose = { ...prognose, zeilen: mergeZeilen(prognose.zeilen, calZeilen) }
      if (!quellen.includes('yahoo')) quellen.push('yahoo')
    }
  }

  const berichtszeitFinal: Berichtszeit | null =
    req.berichtszeit ??
    prognose.berichtszeit ??
    yahooQ?.berichtszeit ??
    null

  if (berichtszeitFinal && prognose && !prognose.berichtszeit) {
    prognose = {
      ...prognose,
      berichtszeit: berichtszeitFinal,
      berichtszeitLabel: berichtszeitLabel(berichtszeitFinal),
    }
  }

  const quelle: EarningsSchaetzungen['quelle'] =
    quellen.length > 1 ? 'kombiniert' : (quellen[0] as EarningsSchaetzungen['quelle']) ?? 'yahoo'

  const jahresSchaetzung = jahresPromise ? await jahresPromise : null

  return ausQuartalsPrognose(prognose, berichtszeitFinal, quelle, {
    jahresSchaetzung,
    investorRelationsUrl,
    berichtVeroeffentlicht: false,
    zusaetzlicheKennzahlen: wallstreet?.kennzahlen,
    revisionMeta: revisionMeta ?? prognose.revisionMeta ?? trend?.revisionMeta ?? null,
    calendarEventsFill: yahooCalendarEvents
      ? { eps: yahooCalendarEvents.eps, umsatz: yahooCalendarEvents.umsatz }
      : null,
  })
}
