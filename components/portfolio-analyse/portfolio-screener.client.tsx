'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { appTableScrollClassName } from '@/components/page-shell'
import { PortfolioAnalyseShell } from '@/components/portfolio-analyse/portfolio-analyse-shell.client'
import { PaCard, PA_SCROLL_ELEGANT, PA_TABLE_COMPACT, PA_TABLE_FRAME } from '@/components/portfolio-analyse/pa-ui'
import { CLIENT_STATE_APPLIED_EVENT, CLIENT_STATE_KEYS } from '@/lib/client-state/client-state-keys'
import { fundamentaldatenHref } from '@/lib/portfolio-analyse/fundamentaldaten-navigation'
import {
  aktiveFilterChips,
  diagnostiziereFilter,
  filterGleich,
  hatAktiveFilterAusserSuche,
  kennzahlAbdeckungPct,
  kloneFilter,
  leerScreenerFilter,
  passtScreenerFilter,
  SCREENER_KENNZAHL_LABEL,
  setzeSpanne,
  sortiereScreenerZeilen,
  sortierungIstAufsteigendDefault,
  zaehleMantraTreffer,
} from '@/lib/portfolio-analyse/screener/screener-filter'
import {
  SCREENER_SCHEMA_VERSION,
  type ScreenerEigeneVorlage,
  type ScreenerFilter,
  type ScreenerKennzahl,
  type ScreenerSort,
  type ScreenerZeile,
} from '@/lib/portfolio-analyse/screener/screener-types'
import { bewerteQualityCompounder } from '@/lib/portfolio-analyse/screener/screener-quality-compounder'
import {
  benenneScreenerVorlageUm,
  leseScreenerVorlagen,
  loescheScreenerVorlage,
  SCREENER_VORLAGEN_EVENT,
  speichereScreenerVorlage,
} from '@/lib/portfolio-analyse/screener/screener-vorlagen-store'
import {
  findeWatchlistIdx,
  fuegeZurWatchlistHinzu,
  ladeWatchlist,
  WATCHLIST_CHANGED_EVENT,
} from '@/lib/portfolio-analyse/watchlist-client'

type ApiAntwort = {
  ok: boolean
  leer?: boolean
  periode?: string | null
  aktualisiertAm?: string | null
  n?: number
  schemaVersion?: number
  zeilen?: ScreenerZeile[]
  cloudGespeichert?: boolean
  cloudWarnung?: string | null
  message?: string
  gestartet?: boolean
  schonAktiv?: boolean
  build?: {
    laeuft: boolean
    gestartetAm: string | null
    fertigAm: string | null
    fehler: string | null
    n: number | null
    periode: string | null
    schemaVersion: number | null
  }
}

type SpalteId =
  | 'ticker'
  | 'name'
  | 'boerse'
  | 'sektor'
  | 'industrie'
  | 'jahre'
  | 'umsatz'
  | 'marktkap'
  | 'cagr3'
  | 'cagr5'
  | 'cagr10'
  | 'wachstum'
  | 'epsCagr5'
  | 'fcfCagr5'
  | 'fcfJeAktieCagr'
  | 'niMarge'
  | 'ebitMarge'
  | 'roe'
  | 'roic'
  | 'fcfMarge'
  | 'conv'
  | 'ruleOf40'
  | 'capex'
  | 'verw'
  | 'ndEbitda'
  | 'kgv'
  | 'kuv'
  | 'kbv'
  | 'mantra'
  | 'quality'
  | 'iroic'
  | 'wacc'
  | 'iSpread'
  | 'brutto'
  | 'reinvest'
  | 'zins'
  | 'sbcOcf'
  | 'kurs'
  | 'watch'

type FilterTabId = 'universum' | 'profit' | 'wachstum' | 'cash' | 'bilanz' | 'bewertung' | 'spalten'

const SPALTEN_KEY = 'pa-screener-spalten-v3'
const SPALTEN_LAYOUT_KEY = 'pa-screener-spalten-layout-v1'
const INPUT =
  'w-full rounded-md border border-[var(--app-border)] bg-[var(--app-surface-muted)] px-2 py-1 text-sm text-[var(--app-text)]'
const CHIP =
  'rounded-md border px-2.5 py-1 text-[11px] font-medium transition'
const CHIP_AN = 'border-teal-400/70 bg-teal-500/20 text-teal-100'
const CHIP_AUS = 'border-[var(--app-border)] text-[var(--app-text-muted)] hover:border-teal-500/40'
const CHIP_TWEAK = 'border-amber-400/60 bg-amber-500/15 text-amber-100'
const BTN =
  'rounded-md border border-[var(--app-border)] px-3 py-1.5 text-xs text-[var(--app-text)] transition hover:border-teal-500/40 disabled:opacity-50'
const BTN_PRIM =
  'rounded-md border border-teal-500/40 bg-teal-500/15 px-3 py-1.5 text-xs text-teal-100 transition hover:bg-teal-500/25 disabled:opacity-50'
const BTN_WARN =
  'rounded-md border border-amber-500/40 bg-amber-500/20 px-3 py-1.5 text-xs font-medium text-amber-100 transition hover:bg-amber-500/30 disabled:opacity-50'

const SPALTEN: {
  id: SpalteId
  label: string
  sort?: ScreenerSort
  defaultOn: boolean
  immer?: boolean
}[] = [
  { id: 'ticker', label: 'Ticker', sort: 'ticker', defaultOn: true, immer: true },
  { id: 'name', label: 'Name', sort: 'name', defaultOn: true },
  { id: 'boerse', label: 'Börse', defaultOn: false },
  { id: 'sektor', label: 'Sektor', defaultOn: false },
  { id: 'industrie', label: 'Industrie', defaultOn: false },
  { id: 'jahre', label: 'Jahre', sort: 'jahreAnzahl', defaultOn: true },
  { id: 'umsatz', label: 'Umsatz', sort: 'umsatzMio', defaultOn: true },
  { id: 'marktkap', label: 'Marktkap', sort: 'marktkapMio', defaultOn: false },
  { id: 'cagr3', label: 'CAGR 3J', sort: 'umsatzCagr3y', defaultOn: false },
  { id: 'cagr5', label: 'CAGR 5J', sort: 'umsatzCagr5y', defaultOn: true },
  { id: 'cagr10', label: 'CAGR 10J', sort: 'umsatzCagr10y', defaultOn: false },
  { id: 'wachstum', label: 'Umsatz 1J', sort: 'umsatzWachstumPct', defaultOn: false },
  { id: 'epsCagr5', label: 'EPS-CAGR 5J', sort: 'epsCagr5y', defaultOn: false },
  { id: 'fcfCagr5', label: 'FCF-CAGR 5J', sort: 'fcfCagr5y', defaultOn: false },
  { id: 'fcfJeAktieCagr', label: 'FCF/Aktie-CAGR', sort: 'fcfJeAktieCagr5y', defaultOn: false },
  { id: 'niMarge', label: 'NI-Marge', sort: 'niMargePct', defaultOn: false },
  { id: 'ebitMarge', label: 'EBIT-Marge', sort: 'ebitMargePct', defaultOn: false },
  { id: 'roe', label: 'ROE', sort: 'roePct', defaultOn: false },
  { id: 'roic', label: 'ROIC', sort: 'roicPct', defaultOn: true },
  { id: 'fcfMarge', label: 'FCF-Marge', sort: 'fcfMargePct', defaultOn: true },
  { id: 'conv', label: 'FCF/NI', sort: 'fcfConversionPct', defaultOn: true },
  { id: 'ruleOf40', label: 'Rule of 40', sort: 'ruleOf40', defaultOn: false },
  { id: 'capex', label: 'CapEx/Umsatz', sort: 'capexSalesPct', defaultOn: false },
  { id: 'verw', label: 'Verw. p.a.', sort: 'aktienVerwaesserungJaehrlichPct', defaultOn: false },
  { id: 'ndEbitda', label: 'ND/EBITDA', sort: 'netDebtEbitda', defaultOn: false },
  { id: 'iroic', label: 'iROIC', sort: 'iroicPct', defaultOn: true },
  { id: 'wacc', label: 'WACC', sort: 'waccPct', defaultOn: false },
  { id: 'iSpread', label: 'iROIC−WACC', sort: 'incrementalValueSpreadPct', defaultOn: false },
  { id: 'brutto', label: 'Brutto', sort: 'bruttoMargePct', defaultOn: false },
  { id: 'reinvest', label: 'Reinvest', sort: 'reinvestitionsquotePct', defaultOn: false },
  { id: 'zins', label: 'Zinsdeckung', sort: 'interestCoverage', defaultOn: false },
  { id: 'sbcOcf', label: 'SBC/OCF', sort: 'sbcOcfPct', defaultOn: false },
  { id: 'kgv', label: 'KGV', sort: 'kgv', defaultOn: true },
  { id: 'kuv', label: 'KUV', sort: 'kuv', defaultOn: false },
  { id: 'kbv', label: 'KBV', sort: 'kbv', defaultOn: false },
  { id: 'mantra', label: 'Mantra', sort: 'mantra', defaultOn: false },
  { id: 'quality', label: 'Quality', sort: 'quality', defaultOn: true },
  { id: 'kurs', label: 'Kurs', defaultOn: false },
  { id: 'watch', label: '', defaultOn: true, immer: true },
]

/** Kurze Formeln / Definitionen für Spaltenköpfe (title). */
const SPALTEN_TOOLTIP: Partial<Record<SpalteId, string>> = {
  cagr5: 'Umsatz-CAGR exakt über 5 Kalenderjahre (Ende − 5 → Ende)',
  cagr3: 'Umsatz-CAGR exakt über 3 Kalenderjahre',
  cagr10: 'Umsatz-CAGR exakt über 10 Kalenderjahre',
  jahre: 'Kontinuierliche Umsatz-Jahre vom aktuellen Ende rückwärts',
  roic: 'ROIC = NOPAT / (EK + Debt) — Brutto-IC, ohne Cash-Abzug; Anzeige: letztes GJ + 5J-Schnitt',
  iroic: 'iROIC = ΔNOPAT / ΔIC (IC um 1 Jahr versetzt, Brutto-IC)',
  fcfMarge: 'FCF-Marge = Free Cashflow / Umsatz (FCF = OCF − CapEx inkl. Software)',
  conv: 'FCF-Conversion = FCF / Net Income',
  ndEbitda: 'Net Debt / EBITDA (Quality-Soll: < 1,5×)',
  ruleOf40: 'Rule of 40 = Umsatzwachstum % + FCF-Marge %',
  kgv: 'KGV = Kurs / EPS letztes GJ; 5J = Kurs heute / Ø-EPS der letzten 5 Kalenderjahre',
  wacc: 'WACC = gewichtete Kapitalkosten (Eigen- + Fremdkapital)',
  quality: 'Quality-Compounder: 11 Kriterien (✓/✗/?), kein Ausschlussfilter',
  reinvest: 'Reinvestitionsquote = (CapEx − D&A) / |FCF|',
  sbcOcf: 'SBC/OCF = aktienbasierte Vergütung / operativer Cashflow',
  zins: 'Zinsdeckung = EBIT / |Zinsaufwand| — ohne Zinsaufwand: keine Fake-999',
}

/** Welche Spalten erscheinen automatisch, wenn die Kennzahl gefiltert wird. */
const KENNZAHL_ZU_SPALTEN: Partial<Record<ScreenerKennzahl, SpalteId[]>> = {
  umsatzMio: ['umsatz'],
  marktkapMio: ['marktkap'],
  jahreAnzahl: ['jahre'],
  roePct: ['roe'],
  roicPct: ['roic'],
  roic5yAvgPct: ['roic'],
  ebitMargePct: ['ebitMarge'],
  niMargePct: ['niMarge'],
  fcfMargePct: ['fcfMarge'],
  umsatzWachstumPct: ['wachstum'],
  umsatzCagr3y: ['cagr3'],
  umsatzCagr5y: ['cagr5'],
  umsatzCagr10y: ['cagr10'],
  epsCagr5y: ['epsCagr5'],
  fcfCagr5y: ['fcfCagr5'],
  fcfJeAktieCagr5y: ['fcfJeAktieCagr'],
  ruleOf40: ['ruleOf40'],
  fcfConversionPct: ['conv'],
  capexSalesPct: ['capex'],
  aktienVerwaesserungJaehrlichPct: ['verw'],
  netDebtEbitda: ['ndEbitda'],
  iroicPct: ['iroic'],
  incrementalValueSpreadPct: ['iSpread'],
  bruttoMargePct: ['brutto'],
  reinvestitionsquotePct: ['reinvest'],
  interestCoverage: ['zins'],
  sbcOcfPct: ['sbcOcf'],
  kgv: ['kgv'],
  kuv: ['kuv'],
  kbv: ['kbv'],
  kgv5y: ['kgv'],
  kuv5y: ['kuv'],
  kbv5y: ['kbv'],
  waccPct: ['wacc'],
}

function spaltenAusFilter(f: ScreenerFilter): Set<SpalteId> {
  const out = new Set<SpalteId>()
  for (const [k, sp] of Object.entries(f.spannen) as [ScreenerKennzahl, { min?: number | null; max?: number | null } | undefined][]) {
    if (!sp) continue
    if (sp.min == null && sp.max == null) continue
    for (const id of KENNZAHL_ZU_SPALTEN[k] ?? []) out.add(id)
  }
  if (f.nurGewinn) out.add('niMarge')
  if (f.fcfPositiv) out.add('fcfMarge')
  if (f.aktienSinkend) out.add('verw')
  if (f.conversionOderRo40) {
    out.add('conv')
    out.add('ruleOf40')
  }
  return out
}

const FILTER_TABS: { id: FilterTabId; label: string }[] = [
  { id: 'universum', label: 'Universum' },
  { id: 'profit', label: 'Profitabilität' },
  { id: 'wachstum', label: 'Wachstum' },
  { id: 'cash', label: 'Cash & Kapital' },
  { id: 'bilanz', label: 'Bilanz' },
  { id: 'bewertung', label: 'Bewertung' },
  { id: 'spalten', label: 'Spalten' },
]

const SORT_OPTIONEN: { id: ScreenerSort; label: string }[] = [
  { id: 'umsatzCagr5y', label: 'CAGR 5J' },
  { id: 'roicPct', label: 'ROIC' },
  { id: 'iroicPct', label: 'iROIC' },
  { id: 'fcfMargePct', label: 'FCF-Marge' },
  { id: 'fcfConversionPct', label: 'FCF/NI' },
  { id: 'quality', label: 'Quality' },
  { id: 'mantra', label: 'Mantra' },
  { id: 'kgv', label: 'KGV' },
  { id: 'marktkapMio', label: 'Marktkap' },
  { id: 'umsatzMio', label: 'Umsatz' },
  { id: 'name', label: 'Name' },
  { id: 'ticker', label: 'Ticker' },
]

function defaultSpalten(): Set<SpalteId> {
  return new Set(SPALTEN.filter((s) => s.defaultOn || s.immer).map((s) => s.id))
}

function defaultSpaltenOrder(): SpalteId[] {
  return SPALTEN.map((s) => s.id)
}

type SpaltenLayout = { order: SpalteId[]; widths: Partial<Record<SpalteId, number>> }

function leseSpaltenLayout(): SpaltenLayout {
  const fallback: SpaltenLayout = { order: defaultSpaltenOrder(), widths: {} }
  if (typeof window === 'undefined') return fallback
  try {
    const raw = window.localStorage.getItem(SPALTEN_LAYOUT_KEY)
    if (!raw) return fallback
    const j = JSON.parse(raw) as Partial<SpaltenLayout>
    const order: SpalteId[] = []
    const seen = new Set<SpalteId>()
    for (const id of j.order ?? []) {
      if (typeof id === 'string' && SPALTEN.some((s) => s.id === id) && !seen.has(id as SpalteId)) {
        order.push(id as SpalteId)
        seen.add(id as SpalteId)
      }
    }
    for (const s of SPALTEN) if (!seen.has(s.id)) order.push(s.id)
    const widths: Partial<Record<SpalteId, number>> = {}
    if (j.widths && typeof j.widths === 'object') {
      for (const [k, v] of Object.entries(j.widths)) {
        if (SPALTEN.some((s) => s.id === k) && typeof v === 'number' && v >= 48 && v <= 480) {
          widths[k as SpalteId] = Math.round(v)
        }
      }
    }
    return { order, widths }
  } catch {
    return fallback
  }
}

function speichereSpaltenLayout(layout: SpaltenLayout) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(SPALTEN_LAYOUT_KEY, JSON.stringify(layout))
  } catch {
    /* quota */
  }
}

function leseSpalten(): Set<SpalteId> {
  const basis = defaultSpalten()
  if (typeof window === 'undefined') return basis
  try {
    const raw = window.localStorage.getItem(SPALTEN_KEY) ?? window.localStorage.getItem('pa-screener-spalten-v2')
    if (!raw) return basis
    const ids = JSON.parse(raw) as unknown
    if (!Array.isArray(ids)) return basis
    const out = new Set<SpalteId>()
    for (const id of ids) {
      if (typeof id === 'string' && SPALTEN.some((s) => s.id === id)) out.add(id as SpalteId)
    }
    for (const s of SPALTEN) if (s.immer) out.add(s.id)
    return out.size >= 3 ? out : basis
  } catch {
    return basis
  }
}

function speichereSpaltenLokal(next: Set<SpalteId>) {
  try {
    window.localStorage.setItem(SPALTEN_KEY, JSON.stringify([...next]))
  } catch {
    /* quota */
  }
}

function spaltenAusVorlage(ids: string[] | undefined): Set<SpalteId> | null {
  if (!ids?.length) return null
  const out = new Set<SpalteId>()
  for (const id of ids) {
    if (SPALTEN.some((s) => s.id === id)) out.add(id as SpalteId)
  }
  for (const s of SPALTEN) if (s.immer) out.add(s.id)
  return out.size >= 3 ? out : null
}

function gleichOhneSuche(a: ScreenerFilter, b: ScreenerFilter): boolean {
  return filterGleich({ ...a, suche: '' }, { ...b, suche: '' })
}

function fmtMio(v: number | null | undefined): string {
  if (v == null) return '–'
  const abs = Math.abs(v)
  if (abs >= 1000) return `${(v / 1000).toLocaleString('de-DE', { maximumFractionDigits: 1 })} Mrd`
  return `${v.toLocaleString('de-DE', { maximumFractionDigits: 0 })} Mio`
}

function fmtZahl(v: number | null | undefined, stellen = 1): string {
  if (v == null) return '–'
  return v.toLocaleString('de-DE', { maximumFractionDigits: stellen })
}

function fmtPct(v: number | null | undefined): string {
  if (v == null) return '–'
  return `${v.toLocaleString('de-DE', { maximumFractionDigits: 1 })} %`
}

/** Aktueller Wert + optionaler 5J-/Historien-Zusatz darunter. */
function WertMitHist({
  aktuell,
  hist,
  histLabel = '5J',
  ton,
  fmt = fmtPct,
}: {
  aktuell: number | null | undefined
  hist?: number | null
  histLabel?: string
  ton?: string
  fmt?: (v: number | null | undefined) => string
}) {
  return (
    <span className={`inline-block text-right ${ton ?? ''}`}>
      <span className="block">{fmt(aktuell)}</span>
      {hist != null && Number.isFinite(hist) ? (
        <span className="block text-[10px] font-normal leading-tight text-[var(--app-text-muted)]">
          {histLabel} {fmt(hist)}
        </span>
      ) : null}
    </span>
  )
}

function pctTon(v: number | null | undefined): string {
  if (v == null) return 'text-[var(--app-text-muted)]'
  if (v > 0) return 'text-emerald-400'
  if (v < 0) return 'text-rose-400'
  return 'text-[var(--app-text)]'
}

function qcKlasse(ok: boolean | null | undefined, fallback: string): string {
  if (ok === true) return 'text-emerald-400'
  if (ok === false) return 'text-rose-400'
  if (ok === null) return 'text-amber-300/85'
  return fallback
}

function csvZelle(v: string | number | null | undefined): string {
  if (v == null) return ''
  const s = String(v)
  if (/[";\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

function ZahlInput({
  value,
  onChange,
  placeholder,
}: {
  value: number | null | undefined
  onChange: (n: number | null) => void
  placeholder: string
}) {
  return (
    <input
      type="number"
      inputMode="decimal"
      placeholder={placeholder}
      value={value ?? ''}
      onChange={(e) => {
        const t = e.target.value.trim()
        if (t === '') onChange(null)
        else {
          const n = Number(t)
          onChange(Number.isFinite(n) ? n : null)
        }
      }}
      className={INPUT}
    />
  )
}

function SpanneFeld({
  label,
  kennzahl,
  filter,
  onFilter,
  abdeckung,
}: {
  label: string
  kennzahl: ScreenerKennzahl
  filter: ScreenerFilter
  onFilter: (f: ScreenerFilter) => void
  abdeckung?: Map<ScreenerKennzahl, number>
}) {
  const sp = filter.spannen[kennzahl] ?? {}
  const abdeckungPct = abdeckung?.get(kennzahl)
  const duenn = abdeckungPct != null && abdeckungPct < 15
  return (
    <label className="block text-[11px] text-[var(--app-text-muted)]">
      <span className="flex items-baseline justify-between gap-2">
        <span>{label}</span>
        {abdeckungPct != null ? (
          <span
            className={duenn ? 'text-amber-300/90' : 'text-[var(--app-text-muted)]'}
            title="Anteil der Titel mit Umsatz, die diese Kennzahl haben"
          >
            {abdeckungPct.toLocaleString('de-DE', { maximumFractionDigits: 0 })} % Daten
          </span>
        ) : null}
      </span>
      <div className="mt-1 grid grid-cols-2 gap-1">
        <ZahlInput value={sp.min} placeholder="min" onChange={(min) => onFilter(setzeSpanne(filter, kennzahl, { min }))} />
        <ZahlInput value={sp.max} placeholder="max" onChange={(max) => onFilter(setzeSpanne(filter, kennzahl, { max }))} />
      </div>
    </label>
  )
}

function CheckFeld({
  checked,
  onChange,
  children,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  children: ReactNode
}) {
  return (
    <label className="flex items-center gap-2 text-xs text-[var(--app-text)]">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {children}
    </label>
  )
}

export function PortfolioScreenerClient() {
  const [zeilen, setZeilen] = useState<ScreenerZeile[]>([])
  const [periode, setPeriode] = useState<string | null>(null)
  const [aktualisiertAm, setAktualisiertAm] = useState<string | null>(null)
  const [schemaVersion, setSchemaVersion] = useState(1)
  const [laden, setLaden] = useState(true)
  const [erneuern, setErneuern] = useState(false)
  const [buildProgress, setBuildProgress] = useState<string | null>(null)
  const [fehler, setFehler] = useState<string | null>(null)
  const [cloudWarnung, setCloudWarnung] = useState<string | null>(null)
  const [filter, setFilter] = useState<ScreenerFilter>(() => leerScreenerFilter())
  const [aktiveVorlageId, setAktiveVorlageId] = useState<string | null>(null)
  const [eigen, setEigen] = useState<ScreenerEigeneVorlage[]>([])
  const [saveName, setSaveName] = useState('')
  const [filterTab, setFilterTab] = useState<FilterTabId>('universum')
  const [filterOffen, setFilterOffen] = useState(true)
  const [spalten, setSpalten] = useState<Set<SpalteId>>(defaultSpalten)
  const [spaltenOrder, setSpaltenOrder] = useState<SpalteId[]>(defaultSpaltenOrder)
  const [spaltenWidths, setSpaltenWidths] = useState<Partial<Record<SpalteId, number>>>({})
  const [dragSpalte, setDragSpalte] = useState<SpalteId | null>(null)
  const [dropZiel, setDropZiel] = useState<SpalteId | null>(null)
  const [resizeSpalte, setResizeSpalte] = useState<SpalteId | null>(null)
  const [watchKeys, setWatchKeys] = useState<Set<string>>(new Set())
  const [qualityMarkierung, setQualityMarkierung] = useState(true)

  const uebernehme = useCallback((j: ApiAntwort) => {
    setZeilen(j.zeilen ?? [])
    setPeriode(j.periode ?? null)
    setAktualisiertAm(j.aktualisiertAm ?? null)
    setSchemaVersion(j.schemaVersion ?? 1)
    setCloudWarnung(j.cloudWarnung ?? (j.cloudGespeichert === false ? 'Cloud-Snapshot nicht gespeichert.' : null))
  }, [])

  const lade = useCallback(async () => {
    setLaden(true)
    setFehler(null)
    try {
      const res = await fetch('/api/portfolio-analyse/screener', { cache: 'no-store' })
      const j = (await res.json()) as ApiAntwort
      if (!res.ok || !j.ok) throw new Error(j.message ?? 'Screener konnte nicht geladen werden.')
      uebernehme(j)
    } catch (e) {
      setFehler(e instanceof Error ? e.message : 'Screener konnte nicht geladen werden.')
    } finally {
      setLaden(false)
    }
  }, [uebernehme])

  useEffect(() => {
    void lade()
  }, [lade])

  useEffect(() => {
    setSpalten(leseSpalten())
    const layout = leseSpaltenLayout()
    setSpaltenOrder(layout.order)
    setSpaltenWidths(layout.widths)
  }, [])

  useEffect(() => {
    const sync = () => {
      setWatchKeys(new Set(ladeWatchlist().map((e) => e.symbolYahoo?.trim().toUpperCase()).filter(Boolean) as string[]))
    }
    sync()
    window.addEventListener(WATCHLIST_CHANGED_EVENT, sync)
    return () => window.removeEventListener(WATCHLIST_CHANGED_EVENT, sync)
  }, [])

  useEffect(() => {
    const sync = () => setEigen(leseScreenerVorlagen())
    sync()
    window.addEventListener(SCREENER_VORLAGEN_EVENT, sync)
    const onApplied = (e: Event) => {
      const key = (e as CustomEvent<{ schluessel?: string }>).detail?.schluessel
      if (key === CLIENT_STATE_KEYS.screenerVorlagen) sync()
    }
    window.addEventListener(CLIENT_STATE_APPLIED_EVENT, onApplied)
    return () => {
      window.removeEventListener(SCREENER_VORLAGEN_EVENT, sync)
      window.removeEventListener(CLIENT_STATE_APPLIED_EVENT, onApplied)
    }
  }, [])

  const baueUniversum = useCallback(async () => {
    setErneuern(true)
    setFehler(null)
    setCloudWarnung(null)
    setBuildProgress('Lade SEC-Frames (neueste Jahre zuerst)…')
    try {
      const res = await fetch('/api/portfolio-analyse/screener', { method: 'POST' })
      const text = await res.text()
      let start: ApiAntwort
      try {
        start = JSON.parse(text) as ApiAntwort
      } catch {
        const kurz = text.replace(/\s+/g, ' ').trim().slice(0, 160)
        throw new Error(
          /an error occurred|timeout/i.test(kurz) || res.status >= 500
            ? 'Server-Timeout beim Universum-Aufbau. Bitte in 1 Minute erneut versuchen.'
            : kurz || `Ungültige Server-Antwort (HTTP ${res.status}).`,
        )
      }
      if (!res.ok || !start.ok) throw new Error(start.message ?? 'Universum konnte nicht geladen werden.')

      setBuildProgress('Lade fertiges Universum…')
      const pollRes = await fetch('/api/portfolio-analyse/screener?frisch=1', { cache: 'no-store' })
      const pollText = await pollRes.text()
      let poll: ApiAntwort
      try {
        poll = JSON.parse(pollText) as ApiAntwort
      } catch {
        throw new Error('Universum gespeichert, aber Abruf fehlgeschlagen — Seite neu laden.')
      }
      if (!pollRes.ok || !poll.ok || !(poll.zeilen?.length)) {
        throw new Error(poll.message ?? 'Universum leer nach Aufbau — bitte erneut versuchen.')
      }
      uebernehme(poll)
      setBuildProgress(null)
    } catch (e) {
      const raw = e instanceof Error ? e.message : String(e)
      const netz =
        /failed to fetch|networkerror|load failed|network request failed/i.test(raw) ||
        (e instanceof TypeError && /fetch/i.test(raw))
      setFehler(
        netz
          ? 'Netzwerkabbruch (Verbindung zum Server gerissen). Bitte erneut „Universum neu aufbauen“ — der Lauf ist kürzer und ohne Stream.'
          : raw || 'Universum konnte nicht geladen werden.',
      )
      setBuildProgress(null)
    } finally {
      setErneuern(false)
    }
  }, [uebernehme])

  const vorlageAktiv = useMemo(
    () => (aktiveVorlageId ? eigen.find((v) => v.id === aktiveVorlageId) ?? null : null),
    [aktiveVorlageId, eigen],
  )

  const angepasst = Boolean(vorlageAktiv && !gleichOhneSuche(filter, vorlageAktiv.filter))

  const gefiltert = useMemo(() => {
    const hit = zeilen.filter((z) => passtScreenerFilter(z, filter))
    return sortiereScreenerZeilen(hit, filter.sort, filter.sortAsc)
  }, [zeilen, filter])

  const sichtbar = gefiltert.slice(0, 250)
  const autoSpalten = useMemo(() => spaltenAusFilter(filter), [filter])
  const sichtbareSpalten = useMemo(() => {
    // Manuelle Auswahl + Filter-Spalten (Filter blendet ein, überschreibt nie)
    const basis = SPALTEN.filter((s) => spalten.has(s.id) || s.immer || autoSpalten.has(s.id))
    const rank = new Map(spaltenOrder.map((id, i) => [id, i]))
    return [...basis].sort((a, b) => (rank.get(a.id) ?? 999) - (rank.get(b.id) ?? 999))
  }, [spalten, autoSpalten, spaltenOrder])

  const setzeSpaltenOrder = useCallback((order: SpalteId[]) => {
    setSpaltenOrder(order)
    speichereSpaltenLayout({ order, widths: spaltenWidths })
  }, [spaltenWidths])

  const setzeSpaltenWidth = useCallback((id: SpalteId, width: number) => {
    setSpaltenWidths((prev) => {
      const next = { ...prev, [id]: width }
      speichereSpaltenLayout({ order: spaltenOrder, widths: next })
      return next
    })
  }, [spaltenOrder])

  const onSpalteDrop = useCallback(
    (ziel: SpalteId) => {
      if (!dragSpalte || dragSpalte === ziel) {
        setDragSpalte(null)
        setDropZiel(null)
        return
      }
      const ids = sichtbareSpalten.map((s) => s.id)
      const from = ids.indexOf(dragSpalte)
      const to = ids.indexOf(ziel)
      if (from < 0 || to < 0) {
        setDragSpalte(null)
        setDropZiel(null)
        return
      }
      const nextVis = [...ids]
      nextVis.splice(from, 1)
      nextVis.splice(to, 0, dragSpalte)
      // Volle Order: sichtbare neu, Rest unverändert hinten
      const rest = spaltenOrder.filter((id) => !nextVis.includes(id))
      setzeSpaltenOrder([...nextVis, ...rest])
      setDragSpalte(null)
      setDropZiel(null)
    },
    [dragSpalte, sichtbareSpalten, spaltenOrder, setzeSpaltenOrder],
  )

  const starteSpaltenResize = useCallback(
    (id: SpalteId, startX: number, startW: number) => {
      setResizeSpalte(id)
      const onMove = (e: MouseEvent) => {
        const w = Math.min(480, Math.max(48, startW + (e.clientX - startX)))
        setzeSpaltenWidth(id, w)
      }
      const onUp = () => {
        setResizeSpalte(null)
        window.removeEventListener('mousemove', onMove)
        window.removeEventListener('mouseup', onUp)
      }
      window.addEventListener('mousemove', onMove)
      window.addEventListener('mouseup', onUp)
    },
    [setzeSpaltenWidth],
  )
  const chips = useMemo(() => aktiveFilterChips(filter), [filter])
  const hatFilter = hatAktiveFilterAusserSuche(filter)
  const diagnose = useMemo(() => diagnostiziereFilter(zeilen, filter), [zeilen, filter])
  const abdeckung = useMemo(() => {
    const m = new Map<ScreenerKennzahl, number>()
    if (zeilen.length === 0) return m
    for (const k of Object.keys(SCREENER_KENNZAHL_LABEL) as ScreenerKennzahl[]) {
      m.set(k, kennzahlAbdeckungPct(zeilen, k))
    }
    return m
  }, [zeilen])
  const sektoren = useMemo(() => {
    const set = new Set<string>()
    for (const z of zeilen) {
      const s = z.sektor?.trim()
      if (s) set.add(s)
    }
    return [...set].sort((a, b) => a.localeCompare(b, 'de'))
  }, [zeilen])

  const merke = useCallback((z: ScreenerZeile) => {
    if (findeWatchlistIdx(ladeWatchlist(), { symbol: z.ticker }) >= 0) return
    fuegeZurWatchlistHinzu({
      isin: null,
      name: z.name,
      symbolYahoo: z.ticker,
      symbolCandidates: [z.ticker],
      hinzugefuegtAm: new Date().toISOString(),
    })
  }, [])

  const wendeVorlageAn = useCallback(
    (v: ScreenerEigeneVorlage) => {
      setAktiveVorlageId(v.id)
      setFilter(kloneFilter({ ...v.filter, suche: filter.suche, sektor: v.filter.sektor ?? '' }))
      const ausVorlage = spaltenAusVorlage(v.spalten)
      if (ausVorlage) {
        setSpalten(ausVorlage)
        speichereSpaltenLokal(ausVorlage)
      }
      setSaveName(v.name)
    },
    [filter.suche],
  )

  const toggleSpalte = useCallback((id: SpalteId) => {
    setSpalten((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      for (const s of SPALTEN) if (s.immer) next.add(s.id)
      speichereSpaltenLokal(next)
      return next
    })
  }, [])

  const exportCsv = useCallback(() => {
    const kopf = [
      'Ticker',
      'Name',
      'Börse',
      'Sektor',
      'Industrie',
      'Jahre',
      'Umsatz Mio',
      'Marktkap Mio',
      'CAGR 5J',
      'ROIC',
      'ROIC 5J',
      'iROIC',
      'WACC',
      'iROIC−WACC',
      'Brutto',
      'FCF-Marge',
      'FCF/NI',
      'Rule of 40',
      'Reinvest',
      'ND/EBITDA',
      'Zins',
      'SBC/OCF',
      'KGV',
      'KGV 5J',
      'KUV',
      'KUV 5J',
      'KBV',
      'KBV 5J',
      'Quality',
    ]
    const zeilenCsv = gefiltert.map((z) => {
      const qcListe = bewerteQualityCompounder(z)
      let ok = 0
      for (const e of qcListe) if (e.ok === true) ok++
      return [
        z.ticker,
        z.name,
        z.boerse,
        z.sektor ?? '',
        z.industrie ?? '',
        z.jahreAnzahl,
        z.umsatzMio,
        z.marktkapMio,
        z.umsatzCagr5y,
        z.roicPct,
        z.roic5yAvgPct,
        z.iroicPct,
        z.waccPct,
        z.incrementalValueSpreadPct,
        z.bruttoMargePct,
        z.fcfMargePct,
        z.fcfConversionPct,
        z.ruleOf40,
        z.reinvestitionsquotePct,
        z.netDebtEbitda,
        z.interestCoverage,
        z.sbcOcfPct,
        z.kgv,
        z.kgv5y,
        z.kuv,
        z.kuv5y,
        z.kbv,
        z.kbv5y,
        `${ok}/${qcListe.length}`,
      ]
        .map(csvZelle)
        .join(';')
    })
    const blob = new Blob([[kopf.join(';'), ...zeilenCsv].join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `screener-${periode ?? 'export'}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }, [gefiltert, periode])

  const speichernNeu = useCallback(() => {
    const name = saveName.trim() || vorlageAktiv?.name || 'Meine Vorlage'
    const liste = speichereScreenerVorlage({
      name,
      filter: kloneFilter(filter),
      spalten: [...spalten],
    })
    setEigen(liste)
    const neu = liste[0]
    if (neu) {
      setAktiveVorlageId(neu.id)
      setSaveName(neu.name)
    }
  }, [filter, saveName, spalten, vorlageAktiv?.name])

  const ueberschreiben = useCallback(() => {
    if (!aktiveVorlageId) return
    const name = saveName.trim() || eigen.find((v) => v.id === aktiveVorlageId)?.name || 'Meine Vorlage'
    setEigen(
      speichereScreenerVorlage({
        name,
        filter: kloneFilter(filter),
        spalten: [...spalten],
        id: aktiveVorlageId,
      }),
    )
    setSaveName(name)
  }, [aktiveVorlageId, eigen, filter, saveName, spalten])

  const umbenennen = useCallback(() => {
    if (!aktiveVorlageId || !saveName.trim()) return
    setEigen(benenneScreenerVorlageUm(aktiveVorlageId, saveName.trim()))
  }, [aktiveVorlageId, saveName])

  const zuruecksetzen = useCallback(() => {
    setFilter(leerScreenerFilter())
    setAktiveVorlageId(null)
    setSaveName('')
  }, [])

  const stand = aktualisiertAm
    ? new Date(aktualisiertAm).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })
    : null
  const schemaAlt = zeilen.length > 0 && schemaVersion < SCREENER_SCHEMA_VERSION
  const qcSpalteAn = spalten.has('quality')

  return (
    <PortfolioAnalyseShell
      title="Aktienscreener"
      description="US-gelistete SEC-Filer filtern — eigene Vorlagen, volle Kontrolle über Schwellen und Spalten."
    >
      <PaCard className="space-y-3 p-4 sm:p-5">
        {/* 1 Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-[var(--app-text-muted)]">
            {zeilen.length > 0
              ? `${zeilen.length.toLocaleString('de-DE')} Titel · ${periode ?? '–'} · ${gefiltert.length.toLocaleString('de-DE')} Treffer`
              : 'Noch kein Universum im Cache.'}
            {stand ? ` · Stand ${stand}` : ''}
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={exportCsv} disabled={gefiltert.length === 0} className={BTN}>
              CSV
            </button>
            <button type="button" onClick={() => void baueUniversum()} disabled={erneuern} className={BTN_WARN}>
              {erneuern
                ? buildProgress ?? 'Lade SEC-Universum …'
                : zeilen.length > 0
                  ? 'Universum neu aufbauen'
                  : 'Universum laden'}
            </button>
          </div>
        </div>

        {cloudWarnung ? (
          <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">{cloudWarnung}</p>
        ) : null}
        {schemaAlt ? (
          <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
            Universum-Schema veraltet (v{schemaVersion} &lt; v{SCREENER_SCHEMA_VERSION}). Bitte „Universum neu
            aufbauen“ — sonst bleiben Abdeckung und Kennzahlen auf dem alten Stand.
            Bitte einmal „Universum neu aufbauen“ — sonst liefern Filter auf fehlende Kennzahlen 0 Treffer.
          </p>
        ) : null}

        {hatFilter && diagnose.treffer === 0 && zeilen.length > 0 ? (
          <p className="rounded-md border border-rose-500/35 bg-rose-500/10 px-3 py-2 text-xs text-rose-100">
            {diagnose.toteKennzahlen.length > 0 ? (
              <>
                0 Treffer — Kennzahl(en){' '}
                {diagnose.toteKennzahlen.map((k) => SCREENER_KENNZAHL_LABEL[k]).join(', ')} fehlen im Universum
                (&lt; 5 % Abdeckung). Universum neu aufbauen oder Filter entfernen.
              </>
            ) : diagnose.ohneDaten > 0 && !filter.lueckenErlaubt ? (
              <>
                0 Treffer — {diagnose.ohneDaten.toLocaleString('de-DE')} Titel ohne Daten für aktive Filter (nur{' '}
                {diagnose.mitDaten.toLocaleString('de-DE')} mit Werten). „unvollständige Zeilen behalten“ aktivieren oder
                Schwellen lockern.
              </>
            ) : (
              <>0 Treffer — Schwellen zu eng. Chips oben entfernen oder Min/Max anpassen.</>
            )}
          </p>
        ) : null}

        {/* Fokus-Banner entfernt: Spalten-Checkboxen gelten immer; Filter blenden nur zusätzlich ein. */}

        {/* 2 Eigene Vorlagen */}
        <section className="space-y-2 rounded-lg border border-[var(--app-border)] bg-[var(--app-surface-muted)]/25 px-3 py-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--app-text-muted)]">Meine Vorlagen</p>
            <button type="button" onClick={zuruecksetzen} className="text-[11px] text-[var(--app-text-muted)] hover:text-teal-200">
              Filter zurücksetzen
            </button>
          </div>
          {eigen.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {eigen.map((v) => {
                const an = aktiveVorlageId === v.id
                return (
                  <span key={v.id} className="inline-flex items-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => wendeVorlageAn(v)}
                      className={`${CHIP} ${an ? (angepasst ? CHIP_TWEAK : CHIP_AN) : CHIP_AUS}`}
                    >
                      {v.name}
                      {an && angepasst ? ' · angepasst' : ''}
                    </button>
                    <button
                      type="button"
                      aria-label={`${v.name} löschen`}
                      onClick={() => {
                        setEigen(loescheScreenerVorlage(v.id))
                        if (aktiveVorlageId === v.id) {
                          setAktiveVorlageId(null)
                          setSaveName('')
                        }
                      }}
                      className="px-1 text-[11px] text-[var(--app-text-muted)] hover:text-rose-300"
                    >
                      ×
                    </button>
                  </span>
                )
              })}
            </div>
          ) : (
            <p className="text-[11px] text-[var(--app-text-muted)]">
              Noch keine Vorlage — Filter setzen, Namen vergeben und speichern.
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              placeholder="Name der Vorlage"
              className={`${INPUT} max-w-xs`}
            />
            <button type="button" onClick={speichernNeu} className={BTN_PRIM}>
              Neu speichern
            </button>
            {vorlageAktiv ? (
              <>
                <button type="button" onClick={ueberschreiben} className={BTN}>
                  Überschreiben
                </button>
                <button type="button" onClick={umbenennen} disabled={!saveName.trim()} className={BTN}>
                  Umbenennen
                </button>
              </>
            ) : null}
          </div>
        </section>

        {/* 3 Aktive Filter-Chips */}
        {chips.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-[var(--app-text-muted)]">Aktiv:</span>
            {chips.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setFilter(c.entferne(filter))}
                className="rounded-md border border-teal-500/35 bg-teal-500/10 px-2 py-0.5 text-[11px] text-teal-100 hover:border-rose-400/50 hover:bg-rose-500/10"
                title="Entfernen"
              >
                {c.label} ×
              </button>
            ))}
            <button
              type="button"
              onClick={() =>
                setFilter({
                  ...leerScreenerFilter(),
                  suche: filter.suche,
                  sort: filter.sort,
                  sortAsc: filter.sortAsc,
                  sektor: '',
                })
              }
              className="text-[11px] text-[var(--app-text-muted)] underline hover:text-rose-200"
            >
              alle löschen
            </button>
          </div>
        ) : null}

        {/* 4 Filter-Toolbar */}
        <section className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={filter.suche}
              onChange={(e) => setFilter({ ...filter, sektor: filter.sektor ?? '', suche: e.target.value })}
              placeholder="Suche: Ticker, Name, Sektor …"
              className={`${INPUT} max-w-sm`}
            />
            <label className="flex items-center gap-1.5 text-[11px] text-[var(--app-text-muted)]">
              Sort
              <select
                value={filter.sort}
                onChange={(e) => {
                  const sort = e.target.value as ScreenerSort
                  setFilter({
                    ...filter,
                    sektor: filter.sektor ?? '',
                    sort,
                    sortAsc: sortierungIstAufsteigendDefault(sort),
                  })
                }}
                className={`${INPUT} w-auto min-w-[7rem]`}
              >
                {SORT_OPTIONEN.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={() => setFilter({ ...filter, sektor: filter.sektor ?? '', sortAsc: !filter.sortAsc })}
              className={BTN}
              title="Sortierrichtung"
            >
              {filter.sortAsc ? '↑ aufsteigend' : '↓ absteigend'}
            </button>
            <CheckFeld checked={qualityMarkierung} onChange={setQualityMarkierung}>
              Quality-Markierung
            </CheckFeld>
            <button type="button" onClick={() => setFilterOffen((v) => !v)} className={BTN}>
              {filterOffen ? 'Filter einklappen' : 'Filter ausklappen'}
              {hatFilter ? ` · ${chips.length}` : ''}
            </button>
          </div>

          {filterOffen ? (
            <div className="rounded-lg border border-[var(--app-border)] bg-[var(--app-surface-muted)]/30 px-3 py-2.5">
              <div className="mb-3 flex flex-wrap gap-1">
                {FILTER_TABS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setFilterTab(t.id)}
                    className={`${CHIP} ${filterTab === t.id ? CHIP_AN : CHIP_AUS}`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {filterTab === 'universum' ? (
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  <label className="block text-[11px] text-[var(--app-text-muted)]">
                    Börse
                    <select
                      value={filter.boerse}
                      onChange={(e) =>
                        setFilter({
                          ...filter,
                          sektor: filter.sektor ?? '',
                          boerse: e.target.value as ScreenerFilter['boerse'],
                        })
                      }
                      className={`mt-1 ${INPUT}`}
                    >
                      <option value="alle">Nasdaq + NYSE + CBOE</option>
                      <option value="Nasdaq">Nasdaq</option>
                      <option value="NYSE">NYSE</option>
                      <option value="CBOE">CBOE</option>
                    </select>
                  </label>
                  <label className="block text-[11px] text-[var(--app-text-muted)]">
                    Sektor
                    <select
                      value={filter.sektor ?? ''}
                      onChange={(e) => setFilter({ ...filter, sektor: e.target.value })}
                      className={`mt-1 ${INPUT}`}
                    >
                      <option value="">Alle Sektoren</option>
                      {sektoren.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </label>
                  <SpanneFeld label="Historie (Jahre)" kennzahl="jahreAnzahl" filter={filter} onFilter={setFilter} abdeckung={abdeckung} />
                  <SpanneFeld label="Umsatz (Mio $)" kennzahl="umsatzMio" filter={filter} onFilter={setFilter} abdeckung={abdeckung} />
                  <SpanneFeld label="Marktkap (Mio $)" kennzahl="marktkapMio" filter={filter} onFilter={setFilter} abdeckung={abdeckung} />
                  <CheckFeld
                    checked={filter.lueckenErlaubt}
                    onChange={(v) => setFilter({ ...filter, sektor: filter.sektor ?? '', lueckenErlaubt: v })}
                  >
                    unvollständige Zeilen behalten
                  </CheckFeld>
                </div>
              ) : null}

              {filterTab === 'profit' ? (
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  <SpanneFeld label="ROE %" kennzahl="roePct" filter={filter} onFilter={setFilter} abdeckung={abdeckung} />
                  <SpanneFeld label="ROIC %" kennzahl="roicPct" filter={filter} onFilter={setFilter} abdeckung={abdeckung} />
                  <SpanneFeld label="iROIC 3–5J %" kennzahl="iroicPct" filter={filter} onFilter={setFilter} abdeckung={abdeckung} />
                  <SpanneFeld label="ROIC 5J-Schnitt %" kennzahl="roic5yAvgPct" filter={filter} onFilter={setFilter} abdeckung={abdeckung} />
                  <SpanneFeld label="iROIC − WACC Pp." kennzahl="incrementalValueSpreadPct" filter={filter} onFilter={setFilter} abdeckung={abdeckung} />
                  <SpanneFeld label="Bruttomarge %" kennzahl="bruttoMargePct" filter={filter} onFilter={setFilter} abdeckung={abdeckung} />
                  <SpanneFeld label="EBIT-Marge %" kennzahl="ebitMargePct" filter={filter} onFilter={setFilter} abdeckung={abdeckung} />
                  <SpanneFeld label="NI-Marge %" kennzahl="niMargePct" filter={filter} onFilter={setFilter} abdeckung={abdeckung} />
                  <SpanneFeld label="FCF-Marge %" kennzahl="fcfMargePct" filter={filter} onFilter={setFilter} abdeckung={abdeckung} />
                  <CheckFeld checked={filter.nurGewinn} onChange={(v) => setFilter({ ...filter, nurGewinn: v })}>
                    nur Gewinn
                  </CheckFeld>
                  <CheckFeld checked={filter.fcfPositiv} onChange={(v) => setFilter({ ...filter, fcfPositiv: v })}>
                    FCF &gt; 0
                  </CheckFeld>
                </div>
              ) : null}

              {filterTab === 'wachstum' ? (
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  <SpanneFeld label="Umsatz 1J %" kennzahl="umsatzWachstumPct" filter={filter} onFilter={setFilter} abdeckung={abdeckung} />
                  <SpanneFeld label="CAGR 3J %" kennzahl="umsatzCagr3y" filter={filter} onFilter={setFilter} abdeckung={abdeckung} />
                  <SpanneFeld label="CAGR 5J %" kennzahl="umsatzCagr5y" filter={filter} onFilter={setFilter} abdeckung={abdeckung} />
                  <SpanneFeld label="CAGR 10J %" kennzahl="umsatzCagr10y" filter={filter} onFilter={setFilter} abdeckung={abdeckung} />
                  <SpanneFeld label="EPS-CAGR 5J %" kennzahl="epsCagr5y" filter={filter} onFilter={setFilter} abdeckung={abdeckung} />
                  <SpanneFeld label="FCF-CAGR 5J %" kennzahl="fcfCagr5y" filter={filter} onFilter={setFilter} abdeckung={abdeckung} />
                  <SpanneFeld label="FCF/Aktie-CAGR 5J %" kennzahl="fcfJeAktieCagr5y" filter={filter} onFilter={setFilter} abdeckung={abdeckung} />
                  <SpanneFeld label="Rule of 40" kennzahl="ruleOf40" filter={filter} onFilter={setFilter} abdeckung={abdeckung} />
                </div>
              ) : null}

              {filterTab === 'cash' ? (
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  <SpanneFeld label="FCF-Conversion %" kennzahl="fcfConversionPct" filter={filter} onFilter={setFilter} abdeckung={abdeckung} />
                  <SpanneFeld label="Reinvestitionsquote %" kennzahl="reinvestitionsquotePct" filter={filter} onFilter={setFilter} abdeckung={abdeckung} />
                  <SpanneFeld label="CapEx/Umsatz %" kennzahl="capexSalesPct" filter={filter} onFilter={setFilter} abdeckung={abdeckung} />
                  <SpanneFeld label="SBC / OCF %" kennzahl="sbcOcfPct" filter={filter} onFilter={setFilter} abdeckung={abdeckung} />
                  <SpanneFeld label="Verwässerung p.a. %" kennzahl="aktienVerwaesserungJaehrlichPct" filter={filter} onFilter={setFilter} abdeckung={abdeckung} />
                  <CheckFeld checked={filter.aktienSinkend} onChange={(v) => setFilter({ ...filter, aktienSinkend: v })}>
                    nur sinkende Aktienzahl
                  </CheckFeld>
                  <div className="sm:col-span-2 space-y-2 rounded-md border border-[var(--app-border)]/60 px-2 py-2">
                    <CheckFeld
                      checked={filter.conversionOderRo40 != null}
                      onChange={(an) =>
                        setFilter({
                          ...filter,
                          conversionOderRo40: an ? { conversionMin: 75, ruleOf40Min: 40 } : null,
                        })
                      }
                    >
                      ODER: Conversion ≥ x % oder Rule of 40 ≥ y
                    </CheckFeld>
                    {filter.conversionOderRo40 ? (
                      <div className="grid grid-cols-2 gap-2">
                        <label className="block text-[11px] text-[var(--app-text-muted)]">
                          Conversion min %
                          <ZahlInput
                            value={filter.conversionOderRo40.conversionMin}
                            placeholder="75"
                            onChange={(n) =>
                              setFilter({
                                ...filter,
                                conversionOderRo40:
                                  n == null
                                    ? null
                                    : {
                                        conversionMin: n,
                                        ruleOf40Min: filter.conversionOderRo40?.ruleOf40Min ?? 40,
                                      },
                              })
                            }
                          />
                        </label>
                        <label className="block text-[11px] text-[var(--app-text-muted)]">
                          Rule of 40 min
                          <ZahlInput
                            value={filter.conversionOderRo40.ruleOf40Min}
                            placeholder="40"
                            onChange={(n) =>
                              setFilter({
                                ...filter,
                                conversionOderRo40:
                                  n == null
                                    ? null
                                    : {
                                        conversionMin: filter.conversionOderRo40?.conversionMin ?? 75,
                                        ruleOf40Min: n,
                                      },
                              })
                            }
                          />
                        </label>
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {filterTab === 'bilanz' ? (
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  <SpanneFeld label="Net Debt/EBITDA" kennzahl="netDebtEbitda" filter={filter} onFilter={setFilter} abdeckung={abdeckung} />
                  <SpanneFeld label="Zinsdeckung ×" kennzahl="interestCoverage" filter={filter} onFilter={setFilter} abdeckung={abdeckung} />
                  <CheckFeld checked={filter.ekPositiv} onChange={(v) => setFilter({ ...filter, ekPositiv: v })}>
                    Eigenkapital &gt; 0
                  </CheckFeld>
                </div>
              ) : null}

              {filterTab === 'bewertung' ? (
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  <SpanneFeld label="KGV" kennzahl="kgv" filter={filter} onFilter={setFilter} abdeckung={abdeckung} />
                  <SpanneFeld label="KGV 5J (norm.)" kennzahl="kgv5y" filter={filter} onFilter={setFilter} abdeckung={abdeckung} />
                  <SpanneFeld label="KUV" kennzahl="kuv" filter={filter} onFilter={setFilter} abdeckung={abdeckung} />
                  <SpanneFeld label="KUV 5J (norm.)" kennzahl="kuv5y" filter={filter} onFilter={setFilter} abdeckung={abdeckung} />
                  <SpanneFeld label="KBV" kennzahl="kbv" filter={filter} onFilter={setFilter} abdeckung={abdeckung} />
                  <SpanneFeld label="KBV 5J (norm.)" kennzahl="kbv5y" filter={filter} onFilter={setFilter} abdeckung={abdeckung} />
                  <SpanneFeld label="WACC %" kennzahl="waccPct" filter={filter} onFilter={setFilter} abdeckung={abdeckung} />
                </div>
              ) : null}

              {filterTab === 'spalten' ? (
                <div className="space-y-2">
                  <p className="text-[11px] text-[var(--app-text-muted)]">
                    Haken = Spalte sichtbar. Aktive Filter blenden zugehörige Spalten zusätzlich ein (●). In der Tabelle:
                    am ⠿-Griff ziehen zum Umsortieren, am rechten Spaltenrand (│) ziehen zum Verbreitern. ROIC/NI-Marge und
                    KGV/KUV/KBV zeigen letztes GJ + 5J-Norm.
                  </p>
                  <div className="flex flex-wrap gap-x-3 gap-y-2">
                    {SPALTEN.filter((s) => !s.immer).map((s) => {
                      const auto = autoSpalten.has(s.id)
                      return (
                        <label key={s.id} className="inline-flex items-center gap-1.5 text-xs text-[var(--app-text)]">
                          <input
                            type="checkbox"
                            checked={spalten.has(s.id) || auto}
                            disabled={auto && !spalten.has(s.id)}
                            onChange={() => toggleSpalte(s.id)}
                          />
                          {s.label}
                          {auto && !spalten.has(s.id) ? (
                            <span className="text-[10px] text-teal-300/80">Filter</span>
                          ) : null}
                        </label>
                      )
                    })}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </section>

        {fehler ? <p className="text-sm text-rose-300">{fehler}</p> : null}
        {laden ? <p className="text-sm text-[var(--app-text-muted)]">Lade Snapshot …</p> : null}

        {/* 5 Tabelle */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[var(--app-text-muted)]">
          <span className="inline-flex items-center gap-1">
            <span className="rounded border border-[var(--app-border)] bg-[var(--app-surface)] px-1 font-mono text-[10px] text-teal-200/90">
              ⠿
            </span>
            ziehen = Reihenfolge
          </span>
          <span className="text-[var(--app-border)]">·</span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-3 w-1 rounded-sm bg-teal-400/70" aria-hidden />
            Rand ziehen = Breite
          </span>
          <span className="text-[var(--app-border)]">·</span>
          <span>Klick auf Titel = Sortieren</span>
        </div>
        <div className={`${PA_TABLE_FRAME} ${PA_SCROLL_ELEGANT}`}>
          <div className={appTableScrollClassName}>
            <table className={PA_TABLE_COMPACT}>
              <thead>
                <tr>
                  {sichtbareSpalten.map((s) => {
                    const viaFilter = autoSpalten.has(s.id) && !spalten.has(s.id) && !s.immer
                    const label =
                      s.id === 'roic'
                        ? 'ROIC'
                        : s.id === 'niMarge'
                          ? 'NI-Marge'
                          : s.id === 'kgv'
                            ? 'KGV'
                            : s.id === 'kuv'
                              ? 'KUV'
                              : s.id === 'kbv'
                                ? 'KBV'
                                : s.label
                    const mitHist =
                      s.id === 'roic' || s.id === 'niMarge' || s.id === 'kgv' || s.id === 'kuv' || s.id === 'kbv'
                    const tip = SPALTEN_TOOLTIP[s.id] ?? (viaFilter ? 'Spalte wegen aktivem Filter' : undefined)
                    const w = spaltenWidths[s.id]
                    const wirdGezogen = dragSpalte === s.id
                    const istDropZiel = dropZiel === s.id && dragSpalte != null && dragSpalte !== s.id
                    const wirdResized = resizeSpalte === s.id
                    const rechtsBuendig = !(
                      s.id === 'ticker' ||
                      s.id === 'name' ||
                      s.id === 'sektor' ||
                      s.id === 'industrie' ||
                      s.id === 'quality'
                    )
                    return (
                      <th
                        key={s.id}
                        onDragOver={(e) => {
                          e.preventDefault()
                          if (dragSpalte && dragSpalte !== s.id) setDropZiel(s.id)
                        }}
                        onDragLeave={() => setDropZiel((z) => (z === s.id ? null : z))}
                        onDrop={() => onSpalteDrop(s.id)}
                        className={`relative select-none px-1 py-1.5 transition-colors ${
                          rechtsBuendig ? 'text-right' : 'text-left'
                        } ${wirdGezogen ? 'opacity-45' : ''} ${
                          istDropZiel ? 'bg-teal-500/20 ring-1 ring-inset ring-teal-400/70' : ''
                        } ${wirdResized ? 'bg-teal-500/10' : ''}`}
                        style={w != null ? { width: w, minWidth: w, maxWidth: w } : { minWidth: 72 }}
                      >
                        <div className="flex items-center gap-0.5 pr-2.5">
                          <span
                            draggable
                            onDragStart={(e) => {
                              setDragSpalte(s.id)
                              e.dataTransfer.effectAllowed = 'move'
                              e.dataTransfer.setData('text/plain', s.id)
                            }}
                            onDragEnd={() => {
                              setDragSpalte(null)
                              setDropZiel(null)
                            }}
                            title="Ziehen: Spalte verschieben"
                            aria-label={`${label || s.id} verschieben`}
                            className="inline-flex shrink-0 cursor-grab items-center justify-center rounded px-0.5 text-[11px] leading-none text-[var(--app-text-muted)] hover:bg-teal-500/20 hover:text-teal-200 active:cursor-grabbing"
                          >
                            ⠿
                          </span>
                          <div className={`min-w-0 flex-1 ${rechtsBuendig ? 'text-right' : 'text-left'}`}>
                            {s.sort ? (
                              <button
                                type="button"
                                title={tip ?? 'Klicken zum Sortieren'}
                                onClick={() => {
                                  if (filter.sort === s.sort)
                                    setFilter({ ...filter, sektor: filter.sektor ?? '', sortAsc: !filter.sortAsc })
                                  else {
                                    setFilter({
                                      ...filter,
                                      sektor: filter.sektor ?? '',
                                      sort: s.sort!,
                                      sortAsc: sortierungIstAufsteigendDefault(s.sort!),
                                    })
                                  }
                                }}
                                className={viaFilter ? 'text-teal-200/90 hover:text-teal-100' : 'hover:text-teal-200'}
                              >
                                {label || '·'}
                                {mitHist ? (
                                  <span className="ml-0.5 text-[10px] font-normal text-[var(--app-text-muted)]">/5J</span>
                                ) : null}
                                {viaFilter ? <span className="ml-0.5 text-[9px] text-teal-300/70">●</span> : null}
                                {filter.sort === s.sort ? (filter.sortAsc ? ' ↑' : ' ↓') : ''}
                              </button>
                            ) : (
                              <span title={tip}>{label || '·'}</span>
                            )}
                          </div>
                        </div>
                        <span
                          role="separator"
                          aria-orientation="vertical"
                          aria-label={`${s.label || s.id} Breite ändern`}
                          title="Ziehen: Spaltenbreite ändern"
                          className={`absolute top-1 bottom-1 right-0 z-10 flex w-2.5 cursor-col-resize items-center justify-center rounded-sm ${
                            wirdResized
                              ? 'bg-teal-400'
                              : 'bg-[var(--app-border)]/80 hover:bg-teal-400/80'
                          }`}
                          onMouseDown={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            const th = (e.target as HTMLElement).closest('th')
                            const startW = th?.getBoundingClientRect().width ?? w ?? 80
                            starteSpaltenResize(s.id, e.clientX, startW)
                          }}
                          draggable={false}
                        >
                          <span className="h-3 w-px bg-[var(--app-bg)]/60" aria-hidden />
                        </span>
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {sichtbar.map((z) => {
                  const mantra = zaehleMantraTreffer(z)
                  const qcListe = bewerteQualityCompounder(z)
                  let qcOk = 0
                  let qcFehlN = 0
                  let qcLuecke = 0
                  for (const e of qcListe) {
                    if (e.ok === true) qcOk++
                    else if (e.ok === false) qcFehlN++
                    else qcLuecke++
                  }
                  const qcScore = { ok: qcOk, fehl: qcFehlN, luecke: qcLuecke, n: qcListe.length }
                  const qcFehl = qcListe.filter((e) => e.ok === false)
                  const qc = Object.fromEntries(qcListe.map((e) => [e.id, e])) as Record<
                    string,
                    (typeof qcListe)[number]
                  >
                  const mark = qualityMarkierung && qcSpalteAn
                  const zellen: Record<SpalteId, ReactNode> = {
                    ticker: (
                      <Link
                        href={fundamentaldatenHref({ symbol: z.ticker })}
                        className="font-semibold text-teal-300 hover:underline"
                      >
                        {z.ticker}
                      </Link>
                    ),
                    name: (
                      <span className="block max-w-[14rem] truncate text-[var(--app-text)]" title={z.name}>
                        {z.name}
                      </span>
                    ),
                    boerse: <span className="text-[var(--app-text-muted)]">{z.boerse}</span>,
                    sektor: (
                      <span className="block max-w-[10rem] truncate text-[var(--app-text-muted)]" title={z.sektor ?? undefined}>
                        {z.sektor?.trim() || '–'}
                      </span>
                    ),
                    industrie: (
                      <span
                        className="block max-w-[10rem] truncate text-[var(--app-text-muted)]"
                        title={z.industrie ?? undefined}
                      >
                        {z.industrie?.trim() || '–'}
                      </span>
                    ),
                    jahre: (
                      <span className="text-[var(--app-text-muted)]">
                        {z.jahreAnzahl}
                        {z.vonJahr && z.bisJahr ? (
                          <span className="ml-1 text-[10px]">
                            {z.vonJahr}–{z.bisJahr}
                          </span>
                        ) : null}
                      </span>
                    ),
                    umsatz: fmtMio(z.umsatzMio),
                    marktkap: fmtMio(z.marktkapMio),
                    cagr3: <span className={pctTon(z.umsatzCagr3y)}>{fmtPct(z.umsatzCagr3y)}</span>,
                    cagr5: (
                      <span className={mark ? qcKlasse(qc.umsatzCagr?.ok, pctTon(z.umsatzCagr5y)) : pctTon(z.umsatzCagr5y)}>
                        {fmtPct(z.umsatzCagr5y)}
                      </span>
                    ),
                    cagr10: <span className={pctTon(z.umsatzCagr10y)}>{fmtPct(z.umsatzCagr10y)}</span>,
                    wachstum: <span className={pctTon(z.umsatzWachstumPct)}>{fmtPct(z.umsatzWachstumPct)}</span>,
                    epsCagr5: <span className={pctTon(z.epsCagr5y)}>{fmtPct(z.epsCagr5y)}</span>,
                    fcfCagr5: <span className={pctTon(z.fcfCagr5y)}>{fmtPct(z.fcfCagr5y)}</span>,
                    fcfJeAktieCagr: <span className={pctTon(z.fcfJeAktieCagr5y)}>{fmtPct(z.fcfJeAktieCagr5y)}</span>,
                    niMarge: (
                      <WertMitHist
                        aktuell={z.niMargePct}
                        hist={z.niMargeMedian}
                        histLabel="Med"
                        ton={pctTon(z.niMargePct)}
                      />
                    ),
                    ebitMarge: <span className={pctTon(z.ebitMargePct)}>{fmtPct(z.ebitMargePct)}</span>,
                    roe: <span className={pctTon(z.roePct)}>{fmtPct(z.roePct)}</span>,
                    roic: (
                      <WertMitHist
                        aktuell={z.roicPct}
                        hist={z.roic5yAvgPct}
                        histLabel="5J"
                        ton={pctTon(z.roicPct)}
                      />
                    ),
                    fcfMarge: <span className={pctTon(z.fcfMargePct)}>{fmtPct(z.fcfMargePct)}</span>,
                    conv: (
                      <span className={mark ? qcKlasse(qc.conv?.ok, '') : undefined}>{fmtPct(z.fcfConversionPct)}</span>
                    ),
                    ruleOf40: <span className={pctTon(z.ruleOf40)}>{fmtZahl(z.ruleOf40, 1)}</span>,
                    capex: fmtPct(z.capexSalesPct),
                    verw: (
                      <span
                        className={pctTon(
                          z.aktienVerwaesserungJaehrlichPct != null ? -z.aktienVerwaesserungJaehrlichPct : null,
                        )}
                      >
                        {fmtPct(z.aktienVerwaesserungJaehrlichPct)}
                      </span>
                    ),
                    ndEbitda: (
                      <span className={mark ? qcKlasse(qc.ndEbitda?.ok, '') : undefined}>
                        {fmtZahl(z.netDebtEbitda, 2)}
                      </span>
                    ),
                    iroic: (
                      <span className={mark ? qcKlasse(qc.iroic?.ok, pctTon(z.iroicPct)) : pctTon(z.iroicPct)}>
                        {fmtPct(z.iroicPct)}
                      </span>
                    ),
                    wacc: <span className="text-[var(--app-text-muted)]">{fmtPct(z.waccPct)}</span>,
                    iSpread: (
                      <span className={pctTon(z.incrementalValueSpreadPct)}>
                        {fmtPct(z.incrementalValueSpreadPct)}
                      </span>
                    ),
                    brutto: (
                      <span className={mark ? qcKlasse(qc.brutto?.ok, '') : undefined}>{fmtPct(z.bruttoMargePct)}</span>
                    ),
                    reinvest: (
                      <span className={mark ? qcKlasse(qc.reinvest?.ok, '') : undefined}>
                        {fmtPct(z.reinvestitionsquotePct)}
                      </span>
                    ),
                    zins: (
                      <span className={mark ? qcKlasse(qc.zins?.ok, '') : undefined}>
                        {z.interestCoverage != null ? fmtZahl(z.interestCoverage, 1) : '–'}
                      </span>
                    ),
                    sbcOcf: (
                      <span className={mark ? qcKlasse(qc.sbc?.ok, '') : undefined}>{fmtPct(z.sbcOcfPct)}</span>
                    ),
                    kgv: (
                      <WertMitHist
                        aktuell={z.kgv}
                        hist={z.kgv5y}
                        histLabel="5J"
                        fmt={(v) => fmtZahl(v, 1)}
                      />
                    ),
                    kuv: (
                      <WertMitHist
                        aktuell={z.kuv}
                        hist={z.kuv5y}
                        histLabel="5J"
                        fmt={(v) => fmtZahl(v, 1)}
                      />
                    ),
                    kbv: (
                      <WertMitHist
                        aktuell={z.kbv}
                        hist={z.kbv5y}
                        histLabel="5J"
                        fmt={(v) => fmtZahl(v, 1)}
                      />
                    ),
                    mantra: (
                      <span title="ROIC≥15; Conv≥80 ODER Ro40≥40; ND/EBITDA&lt;1,5; Verw.&lt;2 %; FCF-Marge≥12">
                        {mantra}/5
                      </span>
                    ),
                    quality: (
                      <span
                        className={`block max-w-[14rem] text-left ${qcScore.fehl > 0 ? 'text-rose-300' : qcScore.luecke > 0 ? 'text-amber-200' : 'text-emerald-400'}`}
                        title={qcListe
                          .map(
                            (e) =>
                              `${e.kurz}: ${e.text} (${e.soll})${e.ok === true ? ' ✓' : e.ok === false ? ' ✗' : ' ?'}`,
                          )
                          .join('\n')}
                      >
                        {qcScore.ok}/{qcScore.n}
                        {qcFehl.length > 0 ? (
                          <span className="mt-0.5 block text-[10px] font-normal leading-snug text-rose-300/90">
                            {qcFehl.map((e) => `${e.kurz} ${e.text}`).join(' · ')}
                          </span>
                        ) : null}
                      </span>
                    ),
                    kurs: fmtZahl(z.kurs, 2),
                    watch: (
                      <button
                        type="button"
                        disabled={watchKeys.has(z.ticker)}
                        onClick={() => merke(z)}
                        className="text-[11px] text-amber-200/90 hover:underline disabled:text-[var(--app-text-muted)]"
                      >
                        {watchKeys.has(z.ticker) ? 'gemerkt' : 'Watchlist'}
                      </button>
                    ),
                  }
                  return (
                    <tr key={`${z.cik}-${z.ticker}`}>
                      {sichtbareSpalten.map((s) => (
                        <td
                          key={s.id}
                          className={
                            s.id === 'ticker' ||
                            s.id === 'name' ||
                            s.id === 'boerse' ||
                            s.id === 'sektor' ||
                            s.id === 'industrie' ||
                            s.id === 'quality'
                              ? ''
                              : 'text-right tabular-nums'
                          }
                          style={
                            spaltenWidths[s.id] != null
                              ? {
                                  width: spaltenWidths[s.id],
                                  minWidth: spaltenWidths[s.id],
                                  maxWidth: spaltenWidths[s.id],
                                }
                              : undefined
                          }
                        >
                          {zellen[s.id]}
                        </td>
                      ))}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
        {gefiltert.length > sichtbar.length ? (
          <p className="text-xs text-[var(--app-text-muted)]">
            Zeige 250 von {gefiltert.length.toLocaleString('de-DE')} Treffern — Filter enger setzen.
          </p>
        ) : null}
        <p className="text-xs leading-relaxed text-[var(--app-text-muted)]">
          GuV/Bilanz: SEC EDGAR Kalenderjahr-Frames (CY). Kurs/Multiples: Yahoo. Kennzahlen am frischesten GJ
          (Ende ≥ Vorjahr); CAGR exakt über Kalenderjahre. ROIC: letztes GJ + 5J-Schnitt; NI-Marge: GJ + Median 5J;
          KGV/KUV/KBV: aktuell + normalisiert (Kurs/Marktkap heute ÷ Ø 5J EPS/Umsatz/EK). Quality: 11 Punkte, kein Ausschluss.
        </p>
      </PaCard>
    </PortfolioAnalyseShell>
  )
}
