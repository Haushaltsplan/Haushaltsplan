/** SEC XBRL — Backlog / RPO / Deferred Revenue (Company Facts + 10-K-Text). */

import 'server-only'

import type { SecBacklogHistorie } from '@/lib/portfolio-analyse/fundamentaldaten-erweitert-types'
import { ladeCompanyFactsJson } from '@/lib/portfolio-analyse/sec-edgar-companyfacts-server'

type FactsUnit = {
  end?: string
  val?: number
  fy?: number
  fp?: string
  form?: string
  filed?: string
}

type CompanyFactsJson = {
  facts?: {
    'us-gaap'?: Record<string, { units?: Record<string, FactsUnit[]> }>
    dei?: Record<string, { units?: Record<string, FactsUnit[]> }>
  }
}

const MAX_JAHRE = 16

function zuMioUsd(val: number): number {
  const abs = Math.abs(val)
  if (abs >= 1_000_000_000) return Math.round((val / 1_000_000) * 10) / 10
  if (abs >= 10_000_000) return Math.round((val / 1_000_000) * 10) / 10
  return Math.round(val * 10) / 10
}

/** Geschäftsjahr = Kalenderjahr des Periodenendes (end), nicht SEC-Filing-Feld fy. */
function jahrAusEintrag(e: FactsUnit): number | null {
  const iso = e.end
  if (iso) {
    const y = parseInt(iso.slice(0, 4), 10)
    if (Number.isFinite(y) && y >= 1990 && y <= 2035) return y
  }
  if (e.fy != null && e.fy >= 1990 && e.fy <= 2035) return e.fy
  return null
}

function extrahiereJahresreiheMio(facts: CompanyFactsJson, tags: string[]): Map<number, number> {
  const map = new Map<number, { val: number; filed: string }>()
  for (const tag of tags) {
    for (const ns of ['us-gaap', 'dei'] as const) {
      const einheiten = facts.facts?.[ns]?.[tag]?.units
      if (!einheiten) continue
      for (const liste of Object.values(einheiten)) {
        for (const e of liste ?? []) {
          if (e.form && e.form !== '10-K') continue
          if (e.fp && e.fp !== 'FY') continue
          const jahr = jahrAusEintrag(e)
          const val = e.val
          if (jahr == null || val == null || !Number.isFinite(val) || val <= 0) continue
          const norm = zuMioUsd(val)
          const filed = e.filed ?? e.end ?? ''
          const prev = map.get(jahr)
          if (
            !prev ||
            filed > prev.filed ||
            (filed === prev.filed && Math.abs(norm) > Math.abs(prev.val))
          ) {
            map.set(jahr, { val: norm, filed })
          }
        }
      }
    }
    if (map.size >= 3) break
  }
  return new Map([...map.entries()].map(([j, { val }]) => [j, val]))
}

function findeExpliziteBacklogTags(facts: CompanyFactsJson): string[] {
  const gaap = facts.facts?.['us-gaap'] ?? {}
  return Object.keys(gaap).filter(
    (k) =>
      /backlog/i.test(k) &&
      !/ratio|percent|change|turnover|unpriced|order for long/i.test(k) &&
      extrahiereJahresreiheMio(facts, [k]).size >= 2,
  )
}

function mapZuHistorie(
  map: Map<number, number>,
  art: SecBacklogHistorie['art'],
  label: string,
  quelleTag: string,
  minJahre = 1,
): SecBacklogHistorie | null {
  if (map.size < minJahre) return null
  const eintraege = [...map.entries()]
    .sort((a, b) => a[0] - b[0])
    .slice(-MAX_JAHRE)
    .map(([jahr, wertMio]) => ({ jahr, wertMio }))
  return {
    art,
    label,
    quelleTag,
    eintraege,
    anzahlJahre: eintraege.length,
    aeltestesJahr: eintraege[0]!.jahr,
    juengstesJahr: eintraege[eintraege.length - 1]!.jahr,
  }
}

/** Backlog-Kennzahl aus bereits geladenen Company Facts. */
export function extrahiereBacklogAusCompanyFacts(facts: CompanyFactsJson): SecBacklogHistorie | null {
  if (!facts.facts) return null

  const explizit = findeExpliziteBacklogTags(facts)
  if (explizit.length > 0) {
    const best = explizit
      .map((tag) => ({ tag, map: extrahiereJahresreiheMio(facts, [tag]) }))
      .sort((a, b) => b.map.size - a.map.size)[0]
    if (best && best.map.size >= 1) {
      return mapZuHistorie(best.map, 'backlog', 'Auftragsbestand (Backlog)', best.tag)
    }
  }

  let rpo = extrahiereJahresreiheMio(facts, ['RevenueRemainingPerformanceObligation'])
  // Auch Custom-/verwandte Tags mit RPO im Namen
  if (rpo.size < 2) {
    const gaap = facts.facts?.['us-gaap'] ?? {}
    for (const tag of Object.keys(gaap)) {
      if (
        /remainingperformanceobligation/i.test(tag) &&
        !/percentage|timing|yearone|yeartwo|expected/i.test(tag)
      ) {
        const m = extrahiereJahresreiheMio(facts, [tag])
        if (m.size > rpo.size) rpo = m
      }
    }
  }
  if (rpo.size >= 1) {
    return mapZuHistorie(
      rpo,
      'rpo',
      'Verbleibende Leistungsverpflichtungen (RPO)',
      'RevenueRemainingPerformanceObligation',
    )
  }

  const deferred = extrahiereJahresreiheMio(facts, ['DeferredRevenue', 'ContractWithCustomerLiability'])
  if (deferred.size >= 1) {
    return mapZuHistorie(deferred, 'deferred_revenue', 'Deferred Revenue', 'DeferredRevenue')
  }

  const contractTotal = extrahiereJahresreiheMio(facts, ['ContractWithCustomerLiability'])
  if (contractTotal.size >= 1) {
    return mapZuHistorie(
      contractTotal,
      'deferred_revenue',
      'Vertragsverbindlichkeiten (Contract Liabilities)',
      'ContractWithCustomerLiability',
    )
  }

  const current = extrahiereJahresreiheMio(facts, ['ContractWithCustomerLiabilityCurrent'])
  const noncurrent = extrahiereJahresreiheMio(facts, ['ContractWithCustomerLiabilityNoncurrent'])
  const contractLiab = new Map<number, number>()
  for (const teil of [current, noncurrent]) {
    for (const [jahr, wert] of teil) {
      contractLiab.set(jahr, Math.round(((contractLiab.get(jahr) ?? 0) + wert) * 10) / 10)
    }
  }
  if (contractLiab.size >= 1) {
    return mapZuHistorie(
      contractLiab,
      'deferred_revenue',
      'Vertragsverbindlichkeiten (Contract Liabilities)',
      'ContractWithCustomerLiability*',
    )
  }

  return null
}

/** Heuristik: „total backlog was $X billion“ im 10-K-Fließtext. */
export function extrahiereBacklogMioAusText(text: string): number | null {
  const fenster = text.slice(0, 250_000)
  const patterns = [
    /(?:total\s+)?backlog\s+(?:was|of|at|amounted to|totaled|reached|approximately)\s+(?:approximately\s+|about\s+|roughly\s+)?\$?\s*([\d,.]+)\s*(billion|million|mrd\.?|milliard)/i,
    /\$?\s*([\d,.]+)\s*(billion|million|mrd\.?|milliard)\s+(?:in\s+)?(?:total\s+)?backlog/i,
    /backlog\s+(?:of\s+)?\$?\s*([\d,.]+)\s*(billion|million|mrd\.?|milliard)/i,
    /(?:recorded|reported)\s+(?:a\s+)?backlog\s+of\s+\$?\s*([\d,.]+)\s*(billion|million)/i,
  ]

  for (const re of patterns) {
    const m = fenster.match(re)
    if (!m?.[1]) continue
    const n = parseFloat(m[1].replace(/,/g, ''))
    if (!Number.isFinite(n) || n <= 0) continue
    const unit = (m[2] ?? '').toLowerCase()
    const mio = unit.startsWith('b') || unit.includes('mrd') || unit.includes('milliard') ? n * 1_000 : n
    if (mio >= 10 && mio < 5_000_000) return Math.round(mio * 10) / 10
  }
  return null
}

export function mergeBacklogMitTextHistorie(
  xbrl: SecBacklogHistorie | null,
  proFiling: { jahr: number; text: string }[],
): SecBacklogHistorie | null {
  const textMap = new Map<number, number>()
  for (const { jahr, text } of proFiling) {
    const mio = extrahiereBacklogMioAusText(text)
    if (mio != null && !textMap.has(jahr)) textMap.set(jahr, mio)
  }

  if (xbrl && xbrl.eintraege.length >= 2) {
    const merged = new Map(xbrl.eintraege.map((e) => [e.jahr, e.wertMio]))
    for (const [jahr, wert] of textMap) {
      if (!merged.has(jahr)) merged.set(jahr, wert)
    }
    return mapZuHistorie(merged, xbrl.art, xbrl.label, xbrl.quelleTag)
  }

  if (textMap.size >= 2) {
    return mapZuHistorie(textMap, 'backlog', 'Auftragsbestand (10-K-Text)', 'text')
  }

  if (xbrl && xbrl.eintraege.length === 1 && textMap.size === 1) {
    const merged = new Map<number, number>([
      ...xbrl.eintraege.map((e) => [e.jahr, e.wertMio] as const),
      ...textMap.entries(),
    ])
    return mapZuHistorie(merged, xbrl.art, xbrl.label, xbrl.quelleTag)
  }

  return xbrl
}

export function mergeBacklogMitJahrWerten(
  xbrl: SecBacklogHistorie | null,
  jahrWerte: Map<number, number>,
): SecBacklogHistorie | null {
  if (jahrWerte.size === 0) return xbrl
  if (xbrl && xbrl.eintraege.length >= 2) {
    const merged = new Map(xbrl.eintraege.map((e) => [e.jahr, e.wertMio]))
    for (const [jahr, wert] of jahrWerte) {
      if (!merged.has(jahr)) merged.set(jahr, wert)
    }
    return mapZuHistorie(merged, xbrl.art, xbrl.label, xbrl.quelleTag)
  }
  if (jahrWerte.size >= 2) {
    return mapZuHistorie(jahrWerte, 'backlog', 'Auftragsbestand (10-K-Text)', 'text')
  }
  if (xbrl && xbrl.eintraege.length === 1 && jahrWerte.size === 1) {
    const merged = new Map<number, number>([
      ...xbrl.eintraege.map((e) => [e.jahr, e.wertMio] as const),
      ...jahrWerte.entries(),
    ])
    return mapZuHistorie(merged, xbrl.art, xbrl.label, xbrl.quelleTag)
  }
  return xbrl
}

export async function ladeSecBacklogHistorie(
  cik: number,
  proFiling: { jahr: number; text: string }[] = [],
): Promise<SecBacklogHistorie | null> {
  const facts = await ladeCompanyFactsJson(cik)
  const xbrl = facts ? extrahiereBacklogAusCompanyFacts(facts) : null
  return mergeBacklogMitTextHistorie(xbrl, proFiling)
}
