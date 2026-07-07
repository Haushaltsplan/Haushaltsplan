/**
 * Geo-Split aus 10-K-Fließtext (CTAS: „>90 % US“, UNH: „substantially all“ …).
 */

import { anteileBerechnen, type SecSegmentJahrEintrag, type SecSegmentRoh } from '@/lib/portfolio-analyse/sec-edgar-segment-extraktion'

export type NarrativeGeoProzent = { usPct: number; intlPct: number }

export function extrahiereNarrativeGeoProzent(text: string): NarrativeGeoProzent | null {
  const fenster = text.slice(0, 800_000)

  let usPct: number | null = null
  let intlPct: number | null = null

  const usOver = fenster.match(/over\s+(\d{1,3})\s*%[^.]{0,120}consolidated\s+revenu/i)
  if (usOver) usPct = parseInt(usOver[1]!, 10) / 100

  const usDirect = fenster.match(
    /(\d{1,3})\s*%[^.]{0,80}consolidated\s+revenu[^.]{0,80}(?:united states|u\.s\.|domestic)/i,
  )
  if (usDirect && usPct == null) usPct = parseInt(usDirect[1]!, 10) / 100

  const intlUnder = fenster.match(/less\s+than\s+(\d{1,2})\s*%[^.]{0,120}consolidated\s+revenu/i)
  if (intlUnder) intlPct = parseInt(intlUnder[1]!, 10) / 100

  const intlDirect = fenster.match(
    /(\d{1,3})\s*%[^.]{0,80}consolidated\s+revenu[^.]{0,80}(?:foreign|international)/i,
  )
  if (intlDirect && intlPct == null) intlPct = parseInt(intlDirect[1]!, 10) / 100

  if (/substantially all[^.]{0,100}revenu[^.]{0,100}(?:united states|u\.s\.|domestic)/i.test(fenster)) {
    if (usPct == null) usPct = 0.97
    if (intlPct == null) intlPct = 0.03
  }

  if (usPct != null && intlPct == null) intlPct = Math.max(0, 1 - usPct)
  if (intlPct != null && usPct == null) usPct = Math.max(0, 1 - intlPct)

  if (usPct == null || intlPct == null || usPct + intlPct < 0.85 || usPct + intlPct > 1.05) return null
  const sum = usPct + intlPct
  return { usPct: usPct / sum, intlPct: intlPct / sum }
}

export function baueNarrativeGeoJahr(
  jahr: number,
  totalMio: number,
  pct: NarrativeGeoProzent,
): SecSegmentJahrEintrag | null {
  if (totalMio <= 0) return null
  const segmente: SecSegmentRoh[] = [
    { name: 'United States', umsatzMio: Math.round(totalMio * pct.usPct * 10) / 10, anteilPct: null },
    { name: 'International', umsatzMio: Math.round(totalMio * pct.intlPct * 10) / 10, anteilPct: null },
  ]
  return { jahr, segmente: anteileBerechnen(segmente) }
}

export function baueNarrativeGeoHistorie(
  proJahr: Map<number, NarrativeGeoProzent>,
  umsatzProJahr: Map<number, number>,
): SecSegmentJahrEintrag[] {
  const out: SecSegmentJahrEintrag[] = []
  for (const [jahr, pct] of [...proJahr.entries()].sort((a, b) => a[0] - b[0])) {
    const total = umsatzProJahr.get(jahr)
    if (total == null) continue
    const j = baueNarrativeGeoJahr(jahr, total, pct)
    if (j) out.push(j)
  }
  return out
}

/** UNH & Co.: kein Geo-Umsatz — Domestic/Foreign-Ergebnis vor Steuern als Proxy-Split. */
export function extrahiereDomesticForeignEinkommenSplit(html: string): Map<number, NarrativeGeoProzent> {
  const out = new Map<number, NarrativeGeoProzent>()
  const contexts = new Map<string, number>()
  for (const m of html.matchAll(/<xbrli:context id="([^"]+)"[^>]*>[\s\S]*?<\/xbrli:context>/gi)) {
    const y = parseInt(m[0].match(/<xbrli:endDate>(\d{4})/)?.[1] ?? '0', 10)
    if (y > 2000) contexts.set(m[1]!, y)
  }

  const byJahr = new Map<number, { domestic: number | null; foreign: number | null }>()
  for (const m of html.matchAll(
    /<ix:nonFraction[^>]*contextRef="([^"]+)"[^>]*name="[^"]*:(IncomeLossFromContinuingOperationsBeforeIncomeTaxes(?:Domestic|Foreign))"[^>]*>([^<]+)/gi,
  )) {
    const jahr = contexts.get(m[1]!)
    if (!jahr) continue
    const tag = m[2]!
    const val = parseFloat(m[3]!.replace(/,/g, ''))
    if (!Number.isFinite(val)) continue
    let row = byJahr.get(jahr)
    if (!row) {
      row = { domestic: null, foreign: null }
      byJahr.set(jahr, row)
    }
    if (tag.endsWith('Domestic')) row.domestic = val
    else row.foreign = val
  }

  for (const [jahr, row] of byJahr) {
    if (row.domestic == null || row.foreign == null) continue
    const absD = Math.abs(row.domestic)
    const absF = Math.abs(row.foreign)
    const sum = absD + absF
    if (sum <= 0) continue
    const intlPct = absF / sum
    if (intlPct < 0.003 || intlPct > 0.45) continue
    out.set(jahr, { usPct: 1 - intlPct, intlPct })
  }
  return out
}
