import { qualityCompounderScore } from '@/lib/portfolio-analyse/screener/screener-quality-compounder'
import type {
  ScreenerFilter,
  ScreenerKennzahl,
  ScreenerSort,
  ScreenerSpanne,
  ScreenerZeile,
} from '@/lib/portfolio-analyse/screener/screener-types'

export function leerScreenerFilter(): ScreenerFilter {
  return {
    suche: '',
    boerse: 'alle',
    nurGewinn: false,
    fcfPositiv: false,
    aktienSinkend: false,
    ekPositiv: false,
    lueckenErlaubt: false,
    conversionOderRo40: null,
    sort: 'umsatzCagr5y',
    sortAsc: false,
    spannen: {},
  }
}

function hatSpanne(sp: ScreenerSpanne | undefined): boolean {
  if (!sp) return false
  return (sp.min != null && Number.isFinite(sp.min)) || (sp.max != null && Number.isFinite(sp.max))
}

function zahlPasst(wert: number | null | undefined, sp: ScreenerSpanne | undefined, lueckenErlaubt: boolean): boolean {
  if (!hatSpanne(sp)) return true
  if (wert == null || !Number.isFinite(wert)) return lueckenErlaubt
  if (sp!.min != null && Number.isFinite(sp!.min) && wert < sp!.min) return false
  if (sp!.max != null && Number.isFinite(sp!.max) && wert > sp!.max) return false
  return true
}

function kennzahl(z: ScreenerZeile, k: ScreenerKennzahl): number | null {
  const v = z[k]
  return v != null && Number.isFinite(v) ? v : null
}

export function passtScreenerFilter(z: ScreenerZeile, f: ScreenerFilter): boolean {
  if (f.boerse !== 'alle' && z.boerse !== f.boerse) return false
  if (f.nurGewinn && !(z.niMio != null && z.niMio > 0)) return false
  if (f.fcfPositiv && !(z.fcfMio != null && z.fcfMio > 0)) return false
  if (f.ekPositiv && !(z.ekMio != null && z.ekMio > 0)) return false
  if (f.aktienSinkend) {
    const v = z.aktienVerwaesserungJaehrlichPct
    if (v == null) return f.lueckenErlaubt
    if (!(v < 0)) return false
  }

  const q = f.suche.trim().toLowerCase()
  if (q) {
    const hit =
      z.ticker.toLowerCase().includes(q) ||
      z.name.toLowerCase().includes(q) ||
      (z.sektor?.toLowerCase().includes(q) ?? false) ||
      (z.industrie?.toLowerCase().includes(q) ?? false)
    if (!hit) return false
  }

  if (f.conversionOderRo40) {
    const conv = z.fcfConversionPct
    const ro40 = z.ruleOf40
    const convOk = conv != null && conv >= f.conversionOderRo40.conversionMin
    const ro40Ok = ro40 != null && ro40 >= f.conversionOderRo40.ruleOf40Min
    if (!convOk && !ro40Ok) {
      if (f.lueckenErlaubt && conv == null && ro40 == null) {
        /* beide fehlen — durchlassen */
      } else return false
    }
  }

  for (const [key, sp] of Object.entries(f.spannen) as [ScreenerKennzahl, ScreenerSpanne | undefined][]) {
    if (!zahlPasst(kennzahl(z, key), sp, f.lueckenErlaubt)) return false
  }
  return true
}

const SORT_ASC_DEFAULT = new Set<ScreenerSort>(['kgv', 'kuv', 'kbv', 'name', 'ticker', 'aktienVerwaesserungJaehrlichPct', 'netDebtEbitda', 'capexSalesPct', 'sbcOcfPct'])

export function sortierungIstAufsteigendDefault(sort: ScreenerSort): boolean {
  return SORT_ASC_DEFAULT.has(sort)
}

export function sortWert(z: ScreenerZeile, sort: ScreenerSort): number | string {
  if (sort === 'name') return z.name.toLowerCase()
  if (sort === 'ticker') return z.ticker.toLowerCase()
  if (sort === 'mantra') return zaehleMantraTreffer(z)
  if (sort === 'quality') return qualityCompounderScore(z).ok
  const v = kennzahl(z, sort as ScreenerKennzahl)
  if (v == null) return sortierungIstAufsteigendDefault(sort) ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY
  return v
}

export function sortiereScreenerZeilen(zeilen: ScreenerZeile[], sort: ScreenerSort, sortAsc: boolean): ScreenerZeile[] {
  const out = [...zeilen]
  out.sort((a, b) => {
    const av = sortWert(a, sort)
    const bv = sortWert(b, sort)
    if (typeof av === 'string' && typeof bv === 'string') {
      const c = av.localeCompare(bv, 'de')
      return sortAsc ? c : -c
    }
    const d = (av as number) - (bv as number)
    return sortAsc ? d : -d
  })
  return out
}

/** Fünf quantitative Mantra-Punkte (ohne LTV/CAC). */
export function zaehleMantraTreffer(z: ScreenerZeile): number {
  let n = 0
  if (z.roicPct != null && z.roicPct >= 15) n++
  const convOk = z.fcfConversionPct != null && z.fcfConversionPct >= 90
  const ro40Ok = z.ruleOf40 != null && z.ruleOf40 >= 40
  if (convOk || ro40Ok) n++
  if (z.netDebtEbitda != null && z.netDebtEbitda < 2) n++
  if (z.aktienVerwaesserungJaehrlichPct != null && z.aktienVerwaesserungJaehrlichPct < 2) n++
  if (z.fcfMargePct != null && z.fcfMargePct >= 12) n++
  return n
}

export function filterGleich(a: ScreenerFilter, b: ScreenerFilter): boolean {
  return JSON.stringify(normalisiereFilter(a)) === JSON.stringify(normalisiereFilter(b))
}

export function normalisiereFilter(f: ScreenerFilter): ScreenerFilter {
  const spannen: ScreenerFilter['spannen'] = {}
  for (const [k, sp] of Object.entries(f.spannen) as [ScreenerKennzahl, ScreenerSpanne | undefined][]) {
    if (!hatSpanne(sp)) continue
    spannen[k] = {
      min: sp!.min != null && Number.isFinite(sp!.min) ? sp!.min : null,
      max: sp!.max != null && Number.isFinite(sp!.max) ? sp!.max : null,
    }
  }
  return {
    suche: f.suche,
    boerse: f.boerse,
    nurGewinn: f.nurGewinn,
    fcfPositiv: f.fcfPositiv,
    aktienSinkend: f.aktienSinkend,
    ekPositiv: f.ekPositiv,
    lueckenErlaubt: f.lueckenErlaubt,
    conversionOderRo40: f.conversionOderRo40
      ? {
          conversionMin: f.conversionOderRo40.conversionMin,
          ruleOf40Min: f.conversionOderRo40.ruleOf40Min,
        }
      : null,
    sort: f.sort,
    sortAsc: f.sortAsc,
    spannen,
  }
}

export function kloneFilter(f: ScreenerFilter): ScreenerFilter {
  return structuredClone(normalisiereFilter(f))
}

export function setzeSpanne(f: ScreenerFilter, k: ScreenerKennzahl, teil: ScreenerSpanne): ScreenerFilter {
  const next = kloneFilter(f)
  const alt = next.spannen[k] ?? {}
  const gemergt: ScreenerSpanne = { ...alt, ...teil }
  if (!hatSpanne(gemergt)) delete next.spannen[k]
  else next.spannen[k] = gemergt
  return next
}

export const SCREENER_KENNZAHL_LABEL: Record<ScreenerKennzahl, string> = {
  umsatzMio: 'Umsatz Mio',
  marktkapMio: 'Marktkap Mio',
  jahreAnzahl: 'Jahre',
  roePct: 'ROE %',
  roicPct: 'ROIC %',
  ebitMargePct: 'EBIT-Marge %',
  niMargePct: 'NI-Marge %',
  fcfMargePct: 'FCF-Marge %',
  umsatzWachstumPct: 'Umsatz 1J %',
  umsatzCagr3y: 'CAGR 3J %',
  umsatzCagr5y: 'CAGR 5J %',
  umsatzCagr10y: 'CAGR 10J %',
  epsCagr5y: 'EPS-CAGR 5J %',
  fcfCagr5y: 'FCF-CAGR 5J %',
  ruleOf40: 'Rule of 40',
  fcfConversionPct: 'FCF/NI %',
  capexSalesPct: 'CapEx/Umsatz %',
  aktienVerwaesserungJaehrlichPct: 'Verw. p.a. %',
  netDebtEbitda: 'ND/EBITDA',
  iroicPct: 'iROIC %',
  roic5yAvgPct: 'ROIC 5J %',
  incrementalValueSpreadPct: 'iROIC−WACC',
  bruttoMargePct: 'Brutto %',
  reinvestitionsquotePct: 'Reinvest %',
  fcfJeAktieCagr5y: 'FCF/Aktie-CAGR %',
  interestCoverage: 'Zinsdeckung',
  sbcOcfPct: 'SBC/OCF %',
  kgv: 'KGV',
  kuv: 'KUV',
  kbv: 'KBV',
}

export type ScreenerFilterChip = {
  id: string
  label: string
  entferne: (f: ScreenerFilter) => ScreenerFilter
}

function fmtChipZahl(n: number): string {
  return n.toLocaleString('de-DE', { maximumFractionDigits: 2 })
}

/** Aktive Filter als Chips (ohne Freitext-Suche). */
export function aktiveFilterChips(f: ScreenerFilter): ScreenerFilterChip[] {
  const chips: ScreenerFilterChip[] = []
  if (f.boerse !== 'alle') {
    chips.push({
      id: 'boerse',
      label: f.boerse,
      entferne: (x) => ({ ...x, boerse: 'alle' }),
    })
  }
  if (f.nurGewinn) {
    chips.push({
      id: 'nurGewinn',
      label: 'nur Gewinn',
      entferne: (x) => ({ ...x, nurGewinn: false }),
    })
  }
  if (f.fcfPositiv) {
    chips.push({
      id: 'fcfPositiv',
      label: 'FCF > 0',
      entferne: (x) => ({ ...x, fcfPositiv: false }),
    })
  }
  if (f.aktienSinkend) {
    chips.push({
      id: 'aktienSinkend',
      label: 'Aktienzahl sinkt',
      entferne: (x) => ({ ...x, aktienSinkend: false }),
    })
  }
  if (f.ekPositiv) {
    chips.push({
      id: 'ekPositiv',
      label: 'EK > 0',
      entferne: (x) => ({ ...x, ekPositiv: false }),
    })
  }
  if (f.lueckenErlaubt) {
    chips.push({
      id: 'luecken',
      label: 'Lücken erlaubt',
      entferne: (x) => ({ ...x, lueckenErlaubt: false }),
    })
  }
  if (f.conversionOderRo40) {
    const c = f.conversionOderRo40
    chips.push({
      id: 'convOderRo40',
      label: `Conv ≥ ${fmtChipZahl(c.conversionMin)} % ∨ Ro40 ≥ ${fmtChipZahl(c.ruleOf40Min)}`,
      entferne: (x) => ({ ...x, conversionOderRo40: null }),
    })
  }
  for (const [k, sp] of Object.entries(f.spannen) as [ScreenerKennzahl, ScreenerSpanne | undefined][]) {
    if (!hatSpanne(sp)) continue
    const name = SCREENER_KENNZAHL_LABEL[k] ?? k
    const teile: string[] = []
    if (sp!.min != null) teile.push(`≥ ${fmtChipZahl(sp!.min)}`)
    if (sp!.max != null) teile.push(`≤ ${fmtChipZahl(sp!.max)}`)
    chips.push({
      id: `spanne:${k}`,
      label: `${name} ${teile.join(' ')}`,
      entferne: (x) => {
        const next = kloneFilter(x)
        delete next.spannen[k]
        return next
      },
    })
  }
  return chips
}

export function hatAktiveFilterAusserSuche(f: ScreenerFilter): boolean {
  return aktiveFilterChips(f).length > 0
}

export const SCREENER_KENNZAHLEN: ScreenerKennzahl[] = [
  'umsatzMio',
  'marktkapMio',
  'jahreAnzahl',
  'roePct',
  'roicPct',
  'ebitMargePct',
  'niMargePct',
  'fcfMargePct',
  'umsatzWachstumPct',
  'umsatzCagr3y',
  'umsatzCagr5y',
  'umsatzCagr10y',
  'epsCagr5y',
  'fcfCagr5y',
  'ruleOf40',
  'fcfConversionPct',
  'capexSalesPct',
  'aktienVerwaesserungJaehrlichPct',
  'netDebtEbitda',
  'iroicPct',
  'roic5yAvgPct',
  'incrementalValueSpreadPct',
  'bruttoMargePct',
  'reinvestitionsquotePct',
  'fcfJeAktieCagr5y',
  'interestCoverage',
  'sbcOcfPct',
  'kgv',
  'kuv',
  'kbv',
]

const KENNZAHL_SET = new Set<string>(SCREENER_KENNZAHLEN)
const SORT_SET = new Set<string>([...SCREENER_KENNZAHLEN, 'name', 'mantra', 'quality', 'ticker'])

function parseZahl(v: unknown): number | null {
  if (v == null || v === '') return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

function parseSpanne(raw: unknown): ScreenerSpanne | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const min = parseZahl(r.min)
  const max = parseZahl(r.max)
  if (min == null && max == null) return null
  return { min, max }
}

export function parseScreenerFilter(raw: unknown): ScreenerFilter {
  const basis = leerScreenerFilter()
  if (!raw || typeof raw !== 'object') return basis
  const r = raw as Record<string, unknown>
  const boerse = r.boerse
  const sort = typeof r.sort === 'string' && SORT_SET.has(r.sort) ? (r.sort as ScreenerSort) : basis.sort
  const spannen: ScreenerFilter['spannen'] = {}
  if (r.spannen && typeof r.spannen === 'object') {
    for (const [k, v] of Object.entries(r.spannen as Record<string, unknown>)) {
      if (!KENNZAHL_SET.has(k)) continue
      const sp = parseSpanne(v)
      if (sp) spannen[k as ScreenerKennzahl] = sp
    }
  }
  let conversionOderRo40: ScreenerFilter['conversionOderRo40'] = null
  if (r.conversionOderRo40 && typeof r.conversionOderRo40 === 'object') {
    const c = r.conversionOderRo40 as Record<string, unknown>
    const conversionMin = parseZahl(c.conversionMin)
    const ruleOf40Min = parseZahl(c.ruleOf40Min)
    if (conversionMin != null && ruleOf40Min != null) {
      conversionOderRo40 = { conversionMin, ruleOf40Min }
    }
  }
  return {
    suche: typeof r.suche === 'string' ? r.suche : '',
    boerse: boerse === 'Nasdaq' || boerse === 'NYSE' || boerse === 'CBOE' || boerse === 'alle' ? boerse : 'alle',
    nurGewinn: r.nurGewinn === true,
    fcfPositiv: r.fcfPositiv === true,
    aktienSinkend: r.aktienSinkend === true,
    ekPositiv: r.ekPositiv === true,
    lueckenErlaubt: r.lueckenErlaubt === true,
    conversionOderRo40,
    sort,
    sortAsc: r.sortAsc === true,
    spannen,
  }
}
