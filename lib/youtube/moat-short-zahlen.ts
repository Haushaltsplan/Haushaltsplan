import type { FundamentaldatenPaket } from '@/lib/portfolio-analyse/fundamentaldaten-types'
import type { MoatShortMetrik } from '@/lib/youtube/moat-short-types'

type Format = 'pct' | 'pctVorzeichen' | 'pp' | 'multiple' | 'nettoverschuldung'

/** Nur Kennzahlen mit numerischem `zahl`-Feld — `wert` ist deutsch formatiert und wird nie geparst. */
const KATALOG: { id: string; label: string; format: Format; hook: boolean }[] = [
  { id: 'ltm_brutto', label: 'Gross margin', format: 'pct', hook: true },
  { id: 'ltm_ebit', label: 'Operating margin', format: 'pct', hook: true },
  { id: 'ltm_roic', label: 'Return on capital', format: 'pct', hook: true },
  { id: 'roic_5y_avg', label: '5-year avg. ROIC', format: 'pct', hook: true },
  { id: 'incremental_roic', label: 'Return on new capital', format: 'pct', hook: false },
  { id: 'fcf_conversion', label: 'FCF conversion', format: 'pct', hook: true },
  { id: 'nrr', label: 'Net revenue retention', format: 'pct', hook: true },
  { id: 'rev_cagr_5y', label: 'Revenue growth, 5y CAGR', format: 'pct', hook: true },
  { id: 'brutto_std_10y', label: '10y gross margin swing', format: 'pp', hook: false },
  { id: 'net_debt_ebitda', label: 'Net debt / EBITDA', format: 'nettoverschuldung', hook: false },
  { id: 'interest_coverage', label: 'Interest coverage', format: 'multiple', hook: false },
  { id: 'aktien_verwaesserung', label: 'Share count change per year', format: 'pctVorzeichen', hook: false },
]

function runde(zahl: number): string {
  return String(Math.abs(zahl) >= 100 ? Math.round(zahl) : Math.round(zahl * 10) / 10)
}

function formatiere(zahl: number, format: Format): { value: string; label?: string } {
  switch (format) {
    case 'pct':
      return { value: `${runde(zahl)}%` }
    case 'pctVorzeichen':
      return { value: `${zahl > 0 ? '+' : ''}${runde(zahl)}%` }
    case 'pp':
      return { value: `${runde(zahl)} pts` }
    case 'multiple':
      return { value: `${runde(zahl)}x` }
    case 'nettoverschuldung':
      return zahl < 0 ? { value: `${runde(Math.abs(zahl))}x`, label: 'Net cash / EBITDA' } : { value: `${runde(zahl)}x` }
  }
}

export function metrikenAusPaket(paket: FundamentaldatenPaket): MoatShortMetrik[] {
  const out: MoatShortMetrik[] = []
  for (const k of KATALOG) {
    const m = paket.keyMetrics.find((x) => x.id === k.id)
    if (m?.zahl == null || !Number.isFinite(m.zahl)) continue
    const f = formatiere(m.zahl, k.format)
    out.push({ id: k.id, label: f.label ?? k.label, value: f.value, hook: k.hook })
  }
  return out
}

function zahlenIn(text: string): string[] {
  return text.match(/\d+(?:\.\d+)?/g) ?? []
}

const KONTRAST_PAAR: Record<string, string[]> = {
  ltm_roic: ['roic_5y_avg', 'incremental_roic'],
  roic_5y_avg: ['ltm_roic'],
  incremental_roic: ['ltm_roic', 'roic_5y_avg'],
  ltm_brutto: ['ltm_ebit'],
  ltm_ebit: ['ltm_brutto'],
  fcf_conversion: ['ltm_ebit'],
  nrr: ['rev_cagr_5y'],
  rev_cagr_5y: ['ltm_ebit', 'ltm_brutto'],
}

/** Zweite echte Kennzahl derselben Firma. Kein erfundener Peer- oder Indexwert. */
export function kontrastMetrik(heroId: string, metriken: MoatShortMetrik[]): MoatShortMetrik | null {
  const hero = metriken.find((m) => m.id === heroId)
  if (!hero) return null
  const ids = KONTRAST_PAAR[heroId] ?? []
  for (const id of ids) {
    const m = metriken.find((x) => x.id === id)
    if (m && m.value !== hero.value) return m
  }
  return metriken.find((m) => m.id !== heroId && m.value !== hero.value && /%$/.test(m.value)) ?? null
}

/** Zahlen im Script, die weder aus den Kennzahlen noch aus den Scores stammen. */
export function fremdeZahlen(text: string, metriken: MoatShortMetrik[], scores: number[]): string[] {
  const erlaubt = new Set<string>(['10'])
  for (const m of metriken) for (const z of zahlenIn(m.value)) erlaubt.add(z)
  for (const s of scores) erlaubt.add(String(s))
  return [...new Set(zahlenIn(text).filter((z) => !erlaubt.has(z)))]
}
