import {
  fcfConversionSchwelle,
  fcfMargeSchwelle,
  roicHuerdePct,
  verwässerungMaxPct,
} from '@/lib/portfolio-analyse/kapital-profil'
import { leerScreenerFilter } from '@/lib/portfolio-analyse/screener/screener-filter'
import type { ScreenerFilter, ScreenerKennzahl, ScreenerSpanne, ScreenerVorlage } from '@/lib/portfolio-analyse/screener/screener-types'

function filterAus(teil: {
  spannen?: Partial<Record<ScreenerKennzahl, ScreenerSpanne>>
  nurGewinn?: boolean
  fcfPositiv?: boolean
  aktienSinkend?: boolean
  ekPositiv?: boolean
  conversionOderRo40?: ScreenerFilter['conversionOderRo40']
  sort?: ScreenerFilter['sort']
  sortAsc?: boolean
}): ScreenerFilter {
  const leer = leerScreenerFilter()
  return {
    ...leer,
    suche: '',
    boerse: 'alle',
    nurGewinn: teil.nurGewinn ?? true,
    fcfPositiv: teil.fcfPositiv ?? false,
    aktienSinkend: teil.aktienSinkend ?? false,
    ekPositiv: teil.ekPositiv ?? false,
    lueckenErlaubt: false,
    conversionOderRo40: teil.conversionOderRo40 ?? null,
    sort: teil.sort ?? 'umsatzCagr5y',
    sortAsc: teil.sortAsc ?? false,
    spannen: teil.spannen ?? {},
  }
}

const QUALITY_ROIC = roicHuerdePct('quality_default')
const QUALITY_FCF_MARGE = fcfMargeSchwelle('quality_default').erfuellt
const QUALITY_CONV = fcfConversionSchwelle('quality_default')
const SOFTWARE_ROIC = roicHuerdePct('software')
const SOFTWARE_VERW = verwässerungMaxPct('software')
const SOFTWARE_MARGE = fcfMargeSchwelle('software').erfuellt
const ASSET_ROIC = roicHuerdePct('asset_heavy')
const QUALITY_VERW = verwässerungMaxPct('quality_default')

export function qualityCompounderFilter(): ScreenerFilter {
  return filterAus({
    fcfPositiv: true,
    sort: 'quality',
    spannen: {
      jahreAnzahl: { min: 8 },
      marktkapMio: { min: 2000 },
    },
  })
}

export const SCREENER_EINGEBAUTE_VORLAGEN: ScreenerVorlage[] = [
  {
    id: 'quality-compounder',
    name: 'Quality Compounder',
    hinweis:
      'Checkliste, kein Hartfilter: iROIC > 18 %, ROIC-5J > 15 %, iROIC−WACC > 10 Pp., Bruttomarge > 40 % (stabil), Reinvestition > 30 %, Umsatz-CAGR 5–15 %, EPS- oder FCF/Aktie-CAGR > 10 %, FCF/NI > 80 %, ND/EBITDA < 1,5×, Zinsdeckung > 10×, SBC/OCF < 5 %. Verfehlte Punkte bleiben sichtbar.',
    eingebaut: true,
    filter: qualityCompounderFilter(),
  },
  {
    id: 'quality-compounder-weich',
    name: 'Quality Compounder weich',
    hinweis: 'Dieselbe Quality-Logik, aber CAGR 5J ≥ 5 %, Verwässerung ≤ 2 %, Conversion ≥ 75 % oder Rule of 40.',
    eingebaut: true,
    filter: filterAus({
      fcfPositiv: true,
      conversionOderRo40: { conversionMin: 75, ruleOf40Min: 40 },
      sort: 'roicPct',
      spannen: {
        jahreAnzahl: { min: 8 },
        marktkapMio: { min: 2000 },
        roicPct: { min: QUALITY_ROIC },
        fcfMargePct: { min: QUALITY_FCF_MARGE },
        umsatzCagr5y: { min: 5 },
        aktienVerwaesserungJaehrlichPct: { max: QUALITY_VERW },
        netDebtEbitda: { max: 2 },
      },
    }),
  },
  {
    id: 'software-abo',
    name: 'Software / Abo',
    hinweis: 'Software-Profil: ROIC ≥ 12 %, Rule of 40 ≥ 40, Verwässerung ≤ 4 %, FCF-Marge ≥ 10 %.',
    eingebaut: true,
    filter: filterAus({
      fcfPositiv: true,
      sort: 'ruleOf40',
      spannen: {
        jahreAnzahl: { min: 5 },
        marktkapMio: { min: 1000 },
        roicPct: { min: SOFTWARE_ROIC },
        ruleOf40: { min: 40 },
        fcfMargePct: { min: SOFTWARE_MARGE },
        aktienVerwaesserungJaehrlichPct: { max: SOFTWARE_VERW },
      },
    }),
  },
  {
    id: 'kapitalrueckgabe',
    name: 'Kapitalrückgabe',
    hinweis: 'FCF-Conversion ≥ 90 % und sinkende Aktienzahl — ROE aus, weil Buch-EK bei Rückkäufern oft unbrauchbar ist.',
    eingebaut: true,
    filter: filterAus({
      fcfPositiv: true,
      aktienSinkend: true,
      sort: 'fcfConversionPct',
      spannen: {
        jahreAnzahl: { min: 8 },
        marktkapMio: { min: 2000 },
        fcfConversionPct: { min: QUALITY_CONV },
        fcfMargePct: { min: QUALITY_FCF_MARGE },
      },
    }),
  },
  {
    id: 'asset-heavy',
    name: 'Asset Heavy',
    hinweis: 'Kapitalintensives Profil: CapEx/Umsatz ≥ 6 %, ROIC ≥ 10 %, ND/EBITDA < 3,5.',
    eingebaut: true,
    filter: filterAus({
      fcfPositiv: false,
      sort: 'roicPct',
      spannen: {
        jahreAnzahl: { min: 8 },
        marktkapMio: { min: 2000 },
        capexSalesPct: { min: 6 },
        roicPct: { min: ASSET_ROIC },
        netDebtEbitda: { max: 3.5 },
      },
    }),
  },
  {
    id: 'guenstige-qualitaet',
    name: 'Günstige Qualität',
    hinweis: 'Quality-weich plus Bewertungsdeckel: KGV ≤ 22, KUV ≤ 5.',
    eingebaut: true,
    filter: filterAus({
      fcfPositiv: true,
      conversionOderRo40: { conversionMin: 75, ruleOf40Min: 40 },
      sort: 'kgv',
      sortAsc: true,
      spannen: {
        jahreAnzahl: { min: 8 },
        marktkapMio: { min: 2000 },
        roicPct: { min: QUALITY_ROIC },
        fcfMargePct: { min: QUALITY_FCF_MARGE },
        umsatzCagr5y: { min: 5 },
        aktienVerwaesserungJaehrlichPct: { max: QUALITY_VERW },
        netDebtEbitda: { max: 2 },
        kgv: { max: 22 },
        kuv: { max: 5 },
      },
    }),
  },
  {
    id: 'fcf-maschine',
    name: 'FCF-Maschine',
    hinweis: 'FCF-Marge ≥ 18 %, Conversion ≥ 90 %, FCF-CAGR 5J ≥ 5 %.',
    eingebaut: true,
    filter: filterAus({
      fcfPositiv: true,
      sort: 'fcfMargePct',
      spannen: {
        jahreAnzahl: { min: 8 },
        marktkapMio: { min: 2000 },
        fcfMargePct: { min: 18 },
        fcfConversionPct: { min: QUALITY_CONV },
        fcfCagr5y: { min: 5 },
        netDebtEbitda: { max: 2 },
      },
    }),
  },
]

export function findeEingebauteVorlage(id: string | null | undefined): ScreenerVorlage | null {
  if (!id) return null
  return SCREENER_EINGEBAUTE_VORLAGEN.find((v) => v.id === id) ?? null
}
