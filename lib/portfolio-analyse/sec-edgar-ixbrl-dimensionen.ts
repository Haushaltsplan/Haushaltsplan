/**
 * Umsatz nach iXBRL-Dimensionen (ProductOrServiceAxis, StatementGeographicalAxis).
 * Fallback wenn keine TableTextBlocks (ODFL, UNP, KNSL …).
 */

import {
  anteileBerechnen,
  type SecSegmentJahrEintrag,
  type SecSegmentRoh,
} from '@/lib/portfolio-analyse/sec-edgar-segment-extraktion'

type Ctx = { dims: Record<string, string>; endYear?: number }

const REVENUE_TAGS =
  /^(RevenueFromContractWithCustomer(?:Excluding|Including)AssessedTax|Revenues|SalesRevenueNet|PremiumsWrittenGross)$/i

const PCT_TAGS = /^PercentageOfRevenue/i

const MEMBER_LABELS: Record<string, string> = {
  US: 'United States',
  MX: 'Mexico',
  NonUs: 'Non-U.S.',
  Bulk: 'Bulk',
  Industrial: 'Industrial',
  Premium: 'Premium',
  LTLServiceRevenue: 'LTL services',
  OtherServiceRevenue: 'Other services',
}

const SKIP_MEMBERS =
  /^(ReportableSegment|CargoAndFreight|ProductAndServiceOther|Consolidated|Elimination|Parent|Total|AllOther)$/i

function memberLabel(raw: string): string {
  const key = raw.replace(/^[^:]+:/, '').replace(/Member$/i, '')
  if (MEMBER_LABELS[key]) return MEMBER_LABELS[key]!
  return key
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/InsuranceProductLine$/i, '')
    .replace(/ProductLine$/i, '')
    .trim()
}

function parseContexts(html: string): Map<string, Ctx> {
  const out = new Map<string, Ctx>()
  for (const m of html.matchAll(/<xbrli:context id="([^"]+)"[^>]*>([\s\S]*?)<\/xbrli:context>/gi)) {
    const dims: Record<string, string> = {}
    for (const em of m[2].matchAll(/dimension="([^"]+)"[^>]*>([^<]+)</gi)) {
      const axis = em[1]!.split(':').pop()!
      dims[axis] = em[2]!.replace(/^[^:]+:/, '')
    }
    const end = m[2].match(/<xbrli:endDate>(\d{4})/)?.[1]
    const instant = m[2].match(/<xbrli:instant>(\d{4})/)?.[1]
    const y = parseInt(end ?? instant ?? '0', 10)
    out.set(m[1]!, { dims, endYear: y > 2000 ? y : undefined })
  }
  return out
}

function scaledVal(attrs: string, raw: string): number {
  const scale = parseInt(attrs.match(/scale="(-?\d+)"/)?.[1] ?? '0', 10)
  const n = parseFloat(raw.replace(/<[^>]+>/g, '').replace(/,/g, '').replace(/\(([^)]+)\)/, '-$1'))
  if (!Number.isFinite(n)) return NaN
  return n * 10 ** scale
}

type Fact = { tag: string; val: number; geo?: string; prod?: string; year: number }

function parseFacts(html: string, contexts: Map<string, Ctx>): Fact[] {
  const facts: Fact[] = []
  for (const m of html.matchAll(
    /<ix:nonFraction([^>]*)contextRef="([^"]+)"([^>]*)name="([^"]+)"([^>]*)>([\s\S]*?)<\/ix:nonFraction>/gi,
  )) {
    const attrs = m[1] + m[3] + m[5]
    if (/xsi:nil="true"/i.test(attrs)) continue
    const ctx = contexts.get(m[2]!)
    if (!ctx?.endYear) continue
    const tag = m[4]!.replace(/^[^:]+:/, '')
    if (!REVENUE_TAGS.test(tag) && !PCT_TAGS.test(tag)) continue
    const val = scaledVal(attrs, m[6]!)
    if (!Number.isFinite(val) || val <= 0) continue

    const geo = Object.entries(ctx.dims).find(([k]) => /Geographical|Geographic|Country/i.test(k))
    const prod = Object.entries(ctx.dims).find(([k]) => /Product|Service|Commodity|LineOfBusiness/i.test(k))
    if (!geo && !prod) {
      if (REVENUE_TAGS.test(tag)) {
        facts.push({ tag, val, year: ctx.endYear })
      }
      continue
    }
    if (geo) {
      facts.push({ tag, val, geo: geo[1], year: ctx.endYear })
    } else if (prod) {
      facts.push({ tag, val, prod: prod[1], year: ctx.endYear })
    }
  }
  return facts
}

function mio(usd: number): number {
  return Math.round((usd / 1_000_000) * 10) / 10
}

function besteProduktFacts(facts: Fact[]): Map<string, Map<number, number>> {
  const byMember = new Map<string, Map<number, number>>()
  for (const f of facts) {
    if (!f.prod) continue
    const label = memberLabel(f.prod)
    if (SKIP_MEMBERS.test(label.replace(/\s/g, ''))) continue
    if (/Accessorial|OtherSubsidiary|OtherMiscellaneous/i.test(f.prod)) continue
    let ym = byMember.get(label)
    if (!ym) {
      ym = new Map()
      byMember.set(label, ym)
    }
    const prev = ym.get(f.year)
    if (prev == null || f.val > prev) ym.set(f.year, f.val)
  }

  const commodity = ['Bulk', 'Industrial', 'Premium'].filter((n) => byMember.has(n))
  if (commodity.length >= 2) {
    const filtered = new Map<string, Map<number, number>>()
    for (const n of commodity) {
      const m = byMember.get(n)
      if (m) filtered.set(n, m)
    }
    return filtered
  }

  return byMember
}

function jahreAusMap(byMember: Map<string, Map<number, number>>, minSeg = 2): SecSegmentJahrEintrag[] {
  const jahreSet = new Set<number>()
  for (const ym of byMember.values()) {
    for (const y of ym.keys()) jahreSet.add(y)
  }
  const jahre: SecSegmentJahrEintrag[] = []
  for (const jahr of [...jahreSet].sort()) {
    const segmente: SecSegmentRoh[] = []
    for (const [name, ym] of byMember) {
      const v = ym.get(jahr)
      if (v != null && v > 0) segmente.push({ name, umsatzMio: mio(v), anteilPct: null })
    }
    const val = segmente.filter((s) => (s.umsatzMio ?? 0) >= 1)
    if (val.length >= minSeg) {
      jahre.push({ jahr, segmente: anteileBerechnen(val) })
    }
  }
  return jahre
}

function baueGeoAusDollar(facts: Fact[], totals: Map<number, number>): SecSegmentJahrEintrag[] {
  const geoByMember = new Map<string, Map<number, number>>()
  for (const f of facts) {
    if (!f.geo || PCT_TAGS.test(f.tag)) continue
    const label = memberLabel(f.geo)
    let ym = geoByMember.get(label)
    if (!ym) {
      ym = new Map()
      geoByMember.set(label, ym)
    }
    const prev = ym.get(f.year)
    if (prev == null || f.val > prev) ym.set(f.year, f.val)
  }

  const jahreSet = new Set<number>([...totals.keys()])
  for (const ym of geoByMember.values()) {
    for (const y of ym.keys()) jahreSet.add(y)
  }

  const jahre: SecSegmentJahrEintrag[] = []
  for (const jahr of [...jahreSet].sort()) {
    const segmente: SecSegmentRoh[] = []
    const total = totals.get(jahr) ?? 0

    for (const [name, ym] of geoByMember) {
      const v = ym.get(jahr)
      if (v != null && v > 0) segmente.push({ name, umsatzMio: mio(v), anteilPct: null })
    }

    if (total > 0 && geoByMember.size >= 1 && segmente.length < 2) {
      const abroad = [...geoByMember.values()].reduce((s, ym) => s + (ym.get(jahr) ?? 0), 0)
      const us = total - abroad
      if (us > 0 && abroad > 0) {
        segmente.length = 0
        segmente.push({ name: 'United States', umsatzMio: mio(us), anteilPct: null })
        for (const [name, ym] of geoByMember) {
          const v = ym.get(jahr)
          if (v != null) segmente.push({ name, umsatzMio: mio(v), anteilPct: null })
        }
      }
    }

    const pctFacts = facts.filter((f) => f.geo && PCT_TAGS.test(f.tag) && f.year === jahr)
    if (pctFacts.length >= 2 && total > 0) {
      segmente.length = 0
      for (const pf of pctFacts) {
        const pct = pf.val > 1 ? pf.val / 100 : pf.val
        segmente.push({
          name: memberLabel(pf.geo!),
          umsatzMio: mio(total * pct),
          anteilPct: null,
        })
      }
    }

    const val = segmente.filter((s) => (s.umsatzMio ?? 0) >= 1)
    if (val.length >= 2) jahre.push({ jahr, segmente: anteileBerechnen(val) })
  }
  return jahre
}

function ergaenzeGeoAusProzent(
  html: string,
  totals: Map<number, number>,
  geo: SecSegmentJahrEintrag[],
): SecSegmentJahrEintrag[] {
  if (geo.length >= 2) return geo

  let usPct: number | null = null
  let intlPct: number | null = null

  if (geo.length === 1) {
    const j = geo[0]!
    const sum = j.segmente.reduce((s, x) => s + (x.umsatzMio ?? 0), 0)
    const us = j.segmente.find((s) => /united states|^us$/i.test(s.name))
    const intl = j.segmente.find((s) => /non-u\.?s|international|foreign/i.test(s.name))
    if (us && sum > 0) {
      usPct = (us.umsatzMio ?? 0) / sum
      intlPct = intl ? (intl.umsatzMio ?? 0) / sum : 1 - usPct
    }
  }

  if (usPct == null) {
    const text = html.replace(/<[^>]+>/g, ' ')
    const m1 = text.match(
      /(\d{1,3}(?:\.\d+)?)\s*%\s+of\s+our\s+revenue[^.]{0,100}united\s+states/i,
    )
    if (m1) usPct = parseFloat(m1[1]!) / 100
    const m2 = text.match(/less\s+than\s+(\d{1,2})\s*%\s+[^.]{0,40}international/i)
    if (m2) intlPct = parseFloat(m2[1]!) / 100
    if (usPct != null && intlPct == null) intlPct = 1 - usPct
  }

  if (usPct == null || intlPct == null || totals.size < 2) return geo

  const jahre: SecSegmentJahrEintrag[] = []
  for (const [jahr, totalUsd] of [...totals.entries()].sort((a, b) => a[0] - b[0])) {
    const totalMio = mio(totalUsd)
    jahre.push({
      jahr,
      segmente: anteileBerechnen([
        { name: 'United States', umsatzMio: Math.round(totalMio * usPct * 10) / 10, anteilPct: null },
        { name: 'Non-U.S.', umsatzMio: Math.round(totalMio * intlPct * 10) / 10, anteilPct: null },
      ]),
    })
  }
  return jahre.length >= 2 ? jahre : geo
}

export function extrahiereUmsatzAusIxbrlDimensionen(html: string): {
  produkt: SecSegmentJahrEintrag[]
  geo: SecSegmentJahrEintrag[]
} {
  if (html.length < 5_000) return { produkt: [], geo: [] }

  const contexts = parseContexts(html)
  const facts = parseFacts(html, contexts)

  const totals = new Map<number, number>()
  for (const f of facts) {
    if (!f.geo && !f.prod && REVENUE_TAGS.test(f.tag)) {
      const prev = totals.get(f.year)
      if (prev == null || f.val > prev) totals.set(f.year, f.val)
    }
  }
  for (const f of facts) {
    if (f.prod && /ReportableSegment/i.test(f.prod) && REVENUE_TAGS.test(f.tag)) {
      const prev = totals.get(f.year)
      if (prev == null || f.val > prev) totals.set(f.year, f.val)
    }
  }
  const prodMap = besteProduktFacts(facts)
  for (const ym of prodMap.values()) {
    for (const [year, v] of ym) {
      if (!totals.has(year)) {
        let summe = 0
        for (const m of prodMap.values()) summe += m.get(year) ?? 0
        if (summe > 0) totals.set(year, summe)
      } else if (totals.get(year)! < v) {
        let summe = 0
        for (const m of prodMap.values()) summe += m.get(year) ?? 0
        if (summe > totals.get(year)!) totals.set(year, summe)
      }
    }
  }

  const produkt = jahreAusMap(prodMap)
  let geo = baueGeoAusDollar(facts, totals)
  geo = ergaenzeGeoAusProzent(html, totals, geo)

  return { produkt, geo }
}
