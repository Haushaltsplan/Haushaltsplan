/**
 * Segment-Namen über Jahre vereinheitlichen (Umbenennungen, Schreibweisen, Duplikate).
 */

import type { SecSegmentHistorie } from '@/lib/portfolio-analyse/fundamentaldaten-erweitert-types'
import {
  anteileBerechnen,
  brauchtReportingRollup,
  entferneSubtotalZeilen,
  filterPeriodenSegmente,
  istPeriodenLabel,
  istPlausiblerSegmentname,
  kanonisereSegmentNamen,
  rollupZuReportingSegmenten,
  type SecSegmentJahrEintrag,
  type SecSegmentRoh,
} from '@/lib/portfolio-analyse/sec-edgar-segment-extraktion'

/** Normalisierter Vergleichsschlüssel (Kleinbuchstaben, ohne Satzzeichen). */
export function segmentSchluessel(name: string): string {
  return name
    .toLowerCase()
    .replace(/&#\d+;/g, ' ')
    .replace(/&amp;/g, ' and ')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\band\b/g, '&')
    .replace(/\s+/g, '')
}

const ZUSATZ_ALIASE: [RegExp, string][] = [
  [/^optum\s*health$/i, 'Optum Health'],
  [/^optum\s*insight$/i, 'Optum Insight'],
  [/^optum\s*rx$/i, 'Optum Rx'],
  [/^optumhealth$/i, 'Optum Health'],
  [/^optuminsight$/i, 'Optum Insight'],
  [/^optumrx$/i, 'Optum Rx'],
  [/^united\s*health\s*care$/i, 'UnitedHealthcare'],
  [/^international\s+transaction\s+revenues?$/i, 'International transaction revenue'],
  [/^domestic\s+assessments?$/i, 'Domestic assessments'],
  [/^cross[- ]border\s+volume\s+fees?$/i, 'Cross-border volume fees'],
  [/^value[- ]added\s+services?\s+(?:and|&)\s+solutions?$/i, 'Value-added services and solutions'],
  [/^uniform\s+rental\s+and\s+facility\s+services?$/i, 'Uniform Rental and Facility Services'],
  [/^first\s+aids?\s+and\s+safety\s+services?$/i, 'First Aid and Safety Services'],
  [/^fire\s+protection\s+services?$/i, 'Fire Protection Services'],
  [/^uniform\s+direct\s+sales?$/i, 'Uniform Direct Sales'],
  [/^license\s+and\s+service$/i, 'License and service'],
  [/^licenseand\s+service/i, 'License and service'],
  [/^north\s+american\s+markets?$/i, 'North American Markets'],
  [/^international\s+markets?$/i, 'International Markets'],
  [/^asia\s+pacific,?\s+europe,?\s+middle\s+east\s+and\s+africa$/i, 'Asia Pacific, EMEA'],
  [/^non[- ]u\.?s\.?$/i, 'Non-U.S.'],
  [/^united\s+states$/i, 'United States'],
  [/^dynamics\s+products?\s+and\s+cloud\s+services?$/i, 'Dynamics'],
  [/^server\s+products?\s+and\s+cloud\s+services?$/i, 'Intelligent Cloud'],
  [/^office\s+commercial$/i, 'Microsoft 365'],
  [/^office\s+consumer$/i, 'Microsoft 365'],
  [/^google\s+search\s*&?\s*other$/i, 'Google Services'],
  [/^google\s+advertising$/i, 'Google Services'],
  [/^youtube\s+ads?$/i, 'Google Services'],
  [/^google\s+subscriptions?,?\s*platforms?,?\s*(?:and|&)\s*devices$/i, 'Google Services'],
  [/^google\s+network$/i, 'Google Services'],
  [/^commercial\s+revenue$/i, 'Commercial revenue'],
  [/^residential\s+revenue$/i, 'Residential revenue'],
  [/^franchise\s+revenues?$/i, 'Franchise revenues'],
  [/^asset\s+based\s+fees?$/i, 'Asset Based Fees'],
  [/^asset\s+linked\s+fees?$/i, 'Asset Linked Fees'],
]

function wendeZusatzAlias(name: string): string {
  const n = name.trim().replace(/\s+/g, ' ')
  for (const [re, ziel] of ZUSATZ_ALIASE) {
    if (re.test(n)) return ziel
  }
  return n
}

function tokens(name: string): Set<string> {
  const t = segmentSchluessel(name).replace(/&/g, ' and ')
  return new Set(t.split(/\s+/).filter((w) => w.length > 2))
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0
  let inter = 0
  for (const x of a) if (b.has(x)) inter++
  return inter / (a.size + b.size - inter)
}

function istGuVSegmentZeile(name: string): boolean {
  return (
    /\boperating earnings\b/i.test(name) ||
    /earnings before income/i.test(name) ||
    /cost of products sold/i.test(name) ||
    /reportable segment operating/i.test(name)
  )
}

function namenAehnlichkeit(a: string, b: string): number {
  if (istGuVSegmentZeile(a) !== istGuVSegmentZeile(b)) return 0
  const ka = segmentSchluessel(a)
  const kb = segmentSchluessel(b)
  if (!ka || !kb) return 0
  if (ka === kb) return 1
  if (ka.length >= 5 && kb.length >= 5 && (ka.includes(kb) || kb.includes(ka))) return 0.9
  const jac = jaccard(tokens(a), tokens(b))
  if (jac >= 0.72) return jac
  const minLen = Math.min(ka.length, kb.length)
  if (minLen >= 8) {
    let match = 0
    for (let i = 0; i < minLen; i++) {
      if (ka[i] === kb[i]) match++
    }
    if (match / minLen >= 0.88) return 0.85
  }
  return jac
}

type NameCluster = {
  canonical: string
  neuestesJahr: number
  members: Set<string>
}

function waehleAnzeigeName(name: string): string {
  return wendeZusatzAlias(name.trim().replace(/\s+/g, ' '))
}

/** Clustert Segmentnamen über alle Jahre — erkennt Umbenennungen. */
export function aligniereSegmentNamenUeberJahre(
  jahre: SecSegmentJahrEintrag[],
): Map<string, string> {
  const map = new Map<string, string>()
  const clusters: NameCluster[] = []

  const eintraege: { name: string; jahr: number }[] = []
  for (const j of jahre) {
    for (const s of j.segmente) {
      eintraege.push({ name: s.name, jahr: j.jahr })
    }
  }
  eintraege.sort((a, b) => b.jahr - a.jahr)

  for (const { name, jahr } of eintraege) {
    const display = waehleAnzeigeName(name)
    const keys = [...new Set([name, display])]
    if (keys.every((k) => map.has(k))) continue

    let best: NameCluster | null = null
    let bestScore = 0.72
    for (const c of clusters) {
      for (const m of c.members) {
        const score = namenAehnlichkeit(display, m)
        if (score > bestScore) {
          bestScore = score
          best = c
        }
      }
    }

    if (best) {
      best.members.add(display)
      if (jahr >= best.neuestesJahr) {
        best.neuestesJahr = jahr
        best.canonical = display
      }
      for (const k of keys) map.set(k, best.canonical)
    } else {
      const neu: NameCluster = { canonical: display, neuestesJahr: jahr, members: new Set([display]) }
      clusters.push(neu)
      for (const k of keys) map.set(k, display)
    }
  }

  const jahreProCluster = (c: NameCluster): number[] => {
    const ys: number[] = []
    for (const e of eintraege) {
      const d = waehleAnzeigeName(e.name)
      for (const m of c.members) {
        if (d === m || namenAehnlichkeit(d, m) >= 0.72) {
          ys.push(e.jahr)
          break
        }
      }
    }
    return ys
  }

  for (let i = 0; i < clusters.length; i++) {
    for (let j = i + 1; j < clusters.length; j++) {
      const a = clusters[i]!
      const b = clusters[j]!
      let sim = 0
      for (const ma of a.members) {
        for (const mb of b.members) sim = Math.max(sim, namenAehnlichkeit(ma, mb))
      }
      if (sim < 0.78) continue
      const ya = jahreProCluster(a)
      const yb = jahreProCluster(b)
      if (ya.some((y) => yb.includes(y))) continue
      const maxA = Math.max(...ya)
      const minA = Math.min(...ya)
      const maxB = Math.max(...yb)
      const minB = Math.min(...yb)
      if (!(maxA < minB || maxB < minA)) continue
      const keep = a.neuestesJahr >= b.neuestesJahr ? a : b
      const drop = keep === a ? b : a
      for (const m of drop.members) keep.members.add(m)
      if (drop.neuestesJahr > keep.neuestesJahr) {
        keep.neuestesJahr = drop.neuestesJahr
      }
      clusters.splice(clusters.indexOf(drop), 1)
      j--
    }
  }

  for (const c of clusters) {
    for (const m of c.members) map.set(m, c.canonical)
  }
  for (const e of eintraege) {
    const display = waehleAnzeigeName(e.name)
    for (const c of clusters) {
      if ([...c.members].some((m) => m === display || namenAehnlichkeit(display, m) >= 0.72)) {
        map.set(e.name, c.canonical)
        map.set(display, c.canonical)
        break
      }
    }
  }

  return map
}

function fusioniereSegmenteListe(
  segmente: SecSegmentRoh[],
  nameMap: Map<string, string>,
): SecSegmentRoh[] {
  const byName = new Map<string, SecSegmentRoh>()
  for (const s of segmente) {
    const name = nameMap.get(s.name) ?? waehleAnzeigeName(s.name)
    const prev = byName.get(name)
    if (!prev) {
      byName.set(name, { ...s, name })
      continue
    }
    const umsatz = (prev.umsatzMio ?? 0) + (s.umsatzMio ?? 0)
    const oi =
      prev.operatingIncomeMio != null || s.operatingIncomeMio != null
        ? (prev.operatingIncomeMio ?? 0) + (s.operatingIncomeMio ?? 0)
        : null
    byName.set(name, {
      name,
      umsatzMio: umsatz > 0 ? Math.round(umsatz * 10) / 10 : prev.umsatzMio,
      anteilPct: null,
      operatingIncomeMio: oi,
      margePct: null,
      netIncomeMio: prev.netIncomeMio ?? s.netIncomeMio,
    })
  }
  return [...byName.values()]
}

/** Ein Jahr: Aliase + Duplikate zusammenführen. */
export function vereinheitlicheJahrSegmente(
  segmente: SecSegmentRoh[],
  nameMap?: Map<string, string>,
): SecSegmentRoh[] {
  const aliased = kanonisereSegmentNamen(segmente).map((s) => ({
    ...s,
    name: wendeZusatzAlias(s.name),
  }))
  const map = nameMap ?? aligniereSegmentNamenUeberJahre([{ jahr: 0, segmente: aliased }])
  const merged = fusioniereSegmenteListe(aliased, map)
  return anteileBerechnen(merged)
}

/** Mehrjahres-Einträge: Namen angleichen, Duplikate je Jahr mergen. */
export function vereinheitlicheJahrEintraege(jahre: SecSegmentJahrEintrag[]): SecSegmentJahrEintrag[] {
  const mitAlias = jahre.map((j) => ({
    jahr: j.jahr,
    segmente: kanonisereSegmentNamen(filterPeriodenSegmente(j.segmente)).map((s) => ({
      ...s,
      name: wendeZusatzAlias(s.name),
    })),
  }))
  const nameMap = aligniereSegmentNamenUeberJahre(mitAlias)
  return mitAlias
    .map((j) => ({
      jahr: j.jahr,
      segmente: vereinheitlicheJahrSegmente(j.segmente, nameMap),
    }))
    .filter((j) => j.segmente.length >= 2)
}

function kanonischerName(name: string, nameMap: Map<string, string>): string {
  return nameMap.get(name) ?? nameMap.get(waehleAnzeigeName(name)) ?? waehleAnzeigeName(name)
}

function segmentNachName(
  segmente: SecSegmentRoh[],
  name: string,
  nameMap: Map<string, string>,
): SecSegmentRoh | undefined {
  const ziel = kanonischerName(name, nameMap)
  return segmente.find((s) => kanonischerName(s.name, nameMap) === ziel)
}

export function vereinheitlicheSegmentHistorie(hist: SecSegmentHistorie | null): SecSegmentHistorie | null {
  if (!hist || hist.jahre.length < 2) return hist
  let basis = hist.jahre
  if (hist.art === 'produkt' && brauchtReportingRollup(basis)) {
    basis = basis.map((j) => ({
      jahr: j.jahr,
      segmente: rollupZuReportingSegmenten(j.segmente),
    }))
  }
  const jahre = vereinheitlicheJahrEintraege(basis)
  if (jahre.length < 2) return hist
  const segmentNamen = [...new Set(jahre.flatMap((j) => j.segmente.map((s) => s.name)))].sort()
  return {
    ...hist,
    jahre,
    segmentNamen,
    anzahlJahre: jahre.length,
    aeltestesJahr: jahre[0]!.jahr,
    juengstesJahr: jahre[jahre.length - 1]!.jahr,
  }
}

/** Fehlende Geschäftsjahre aus Alternativ-Quellen ergänzen. */
export function ergaenzeJahresluecken(
  primaer: SecSegmentHistorie | null,
  quellen: SecSegmentJahrEintrag[][],
): SecSegmentHistorie | null {
  const art = primaer?.art ?? 'produkt'

  if (!primaer) {
    const merged = new Map<number, SecSegmentRoh[]>()
    for (const liste of quellen) {
      for (const j of liste) {
        if (j.segmente.length >= 2 && !merged.has(j.jahr)) merged.set(j.jahr, j.segmente)
      }
    }
    const jahre = [...merged.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([jahr, segmente]) => ({ jahr, segmente }))
    if (jahre.length < 2) return null
    return vereinheitlicheSegmentHistorie({
      art,
      jahre,
      segmentNamen: [],
      anzahlJahre: jahre.length,
      aeltestesJahr: jahre[0]!.jahr,
      juengstesJahr: jahre[jahre.length - 1]!.jahr,
    })
  }

  const byJahr = new Map(primaer.jahre.map((j) => [j.jahr, j.segmente]))
  for (const liste of quellen) {
    for (const j of liste) {
      if (j.segmente.length < 2) continue
      const alt = byJahr.get(j.jahr)
      if (!alt) {
        byJahr.set(j.jahr, j.segmente)
        continue
      }
      const altSum = alt.reduce((s, x) => s + (x.umsatzMio ?? 0), 0)
      const neuSum = j.segmente.reduce((s, x) => s + (x.umsatzMio ?? 0), 0)
      if (neuSum > altSum * 1.08 && alt.length < j.segmente.length) {
        byJahr.set(j.jahr, j.segmente)
      }
    }
  }

  const jahre = [...byJahr.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([jahr, segmente]) => ({ jahr, segmente }))
  return vereinheitlicheSegmentHistorie({ ...primaer, jahre })
}

/** Kleine Lücken zwischen bekannten Jahren linear interpolieren (max. 5 Jahre). */
export function interpoliereJahresluecken(hist: SecSegmentHistorie | null): SecSegmentHistorie | null {
  if (!hist || hist.jahre.length < 2) return hist
  const vorab = vereinheitlicheSegmentHistorie(hist) ?? hist
  const byJahr = new Map(vorab.jahre.map((j) => [j.jahr, j.segmente]))
  const sorted = [...byJahr.keys()].sort((a, b) => a - b)
  const min = sorted[0]!
  const max = sorted[sorted.length - 1]!
  const nameMap = aligniereSegmentNamenUeberJahre(vorab.jahre)

  for (let y = min + 1; y < max; y++) {
    if (byJahr.has(y)) continue

    let prev = y - 1
    while (prev >= min && !byJahr.has(prev)) prev--
    let next = y + 1
    while (next <= max && !byJahr.has(next)) next--
    if (prev < min || next > max) continue
    if (next - prev - 1 > 5) continue

    const segPrev = byJahr.get(prev)!
    const segNext = byJahr.get(next)!
    const w = (y - prev) / (next - prev)
    const namen = [
      ...new Set([
        ...segPrev.map((s) => kanonischerName(s.name, nameMap)),
        ...segNext.map((s) => kanonischerName(s.name, nameMap)),
      ]),
    ]
    const segmente: SecSegmentRoh[] = []

    for (const name of namen) {
      const a = segmentNachName(segPrev, name, nameMap)
      const b = segmentNachName(segNext, name, nameMap)
      const va = a?.umsatzMio ?? null
      const vb = b?.umsatzMio ?? null
      if (va == null && vb == null) continue
      const umsatzMio =
        va != null && vb != null
          ? Math.round((va * (1 - w) + vb * w) * 10) / 10
          : va ?? vb
      if (umsatzMio == null || umsatzMio <= 0) continue
      segmente.push({ name, umsatzMio, anteilPct: null })
    }
    if (segmente.length >= 2) {
      byJahr.set(y, anteileBerechnen(segmente))
    }
  }

  const jahre = [...byJahr.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([jahr, segmente]) => ({ jahr, segmente }))
  return vereinheitlicheSegmentHistorie({ ...vorab, jahre })
}

function skaliereSegmenteAufSumme(segmente: SecSegmentRoh[], zielSumme: number): SecSegmentRoh[] {
  const summe = segmente.reduce((s, x) => s + (x.umsatzMio ?? 0), 0)
  if (summe <= 0 || zielSumme <= 0) return segmente
  const scaled = segmente.map((s) => ({
    ...s,
    umsatzMio: Math.round(((s.umsatzMio ?? 0) * zielSumme) / summe * 10) / 10,
  }))
  const neuSumme = scaled.reduce((s, x) => s + (x.umsatzMio ?? 0), 0)
  const diff = Math.round((zielSumme - neuSumme) * 10) / 10
  if (diff !== 0 && scaled.length > 0) {
    let maxIdx = 0
    for (let i = 1; i < scaled.length; i++) {
      if ((scaled[i]!.umsatzMio ?? 0) > (scaled[maxIdx]!.umsatzMio ?? 0)) maxIdx = i
    }
    scaled[maxIdx] = {
      ...scaled[maxIdx]!,
      umsatzMio: Math.round(((scaled[maxIdx]!.umsatzMio ?? 0) + diff) * 10) / 10,
    }
  }
  return scaled
}

function dedupliziereSegmente(segmente: SecSegmentRoh[]): SecSegmentRoh[] {
  const byName = new Map<string, SecSegmentRoh>()
  for (const s of segmente) {
    const key = s.name.trim().toLowerCase()
    const prev = byName.get(key)
    if (!prev || (s.umsatzMio ?? 0) > (prev.umsatzMio ?? 0)) byName.set(key, { ...s })
  }
  return [...byName.values()]
}

function scoreJahrKandidat(segmente: SecSegmentRoh[], konzern: number | undefined): number {
  let score = segmente.length >= 2 && segmente.length <= 10 ? 20 : 0
  score -= segmente.filter((s) => istPeriodenLabel(s.name)).length * 50
  if (konzern && konzern > 0) {
    const summe = segmente.reduce((s, x) => s + (x.umsatzMio ?? 0), 0)
    if (summe > 0) {
      const ratio = summe / konzern
      score += 30 - Math.min(30, Math.abs(1 - ratio) * 40)
    }
  }
  return score
}

function bereinigeJahrSegmente(
  segmente: SecSegmentRoh[],
  konzernUmsatzMio: number | undefined,
  art: SecSegmentHistorie['art'],
): SecSegmentRoh[] | null {
  let clean = filterPeriodenSegmente(segmente).filter((s) => (s.umsatzMio ?? 0) > 0)
  clean = clean.filter((s) => istPlausiblerSegmentname(s.name))
  if (clean.length < 2) return null

  if (art === 'produkt' && brauchtReportingRollup([{ jahr: 0, segmente: clean }])) {
    clean = rollupZuReportingSegmenten(clean)
  }
  clean = entferneSubtotalZeilen(clean)
  clean = dedupliziereSegmente(clean)
  if (clean.length < 2) return null

  if (konzernUmsatzMio != null && konzernUmsatzMio > 0) {
    clean = skaliereSegmenteAufSumme(clean, konzernUmsatzMio)
  }

  return anteileBerechnen(clean)
}

function waehleBesteJahrSegmente(
  kandidaten: SecSegmentRoh[][],
  konzern: number | undefined,
  art: SecSegmentHistorie['art'],
): SecSegmentRoh[] | null {
  let best: SecSegmentRoh[] | null = null
  let bestScore = -Infinity
  for (const roh of kandidaten) {
    const val = bereinigeJahrSegmente(roh, konzern, art)
    if (!val) continue
    const score = scoreJahrKandidat(val, konzern)
    if (score > bestScore) {
      bestScore = score
      best = val
    }
  }
  return best
}

/**
 * Segment-Jahre bereinigen und auf exakt 100 % (= Konzern-Jahresumsatz) normalisieren.
 * Jahre werden nicht verworfen — beste Quelle je Jahr, Über-/Unterzählung per Skalierung korrigiert.
 */
export function bereinigeHistorieGegenJahresumsatz(
  hist: SecSegmentHistorie | null,
  umsatzProJahr: Map<number, number>,
  quellen: SecSegmentJahrEintrag[][] = [],
): SecSegmentHistorie | null {
  const art = hist?.art ?? 'produkt'
  const jahreSet = new Set<number>()
  for (const j of hist?.jahre ?? []) jahreSet.add(j.jahr)
  for (const q of quellen) for (const j of q) jahreSet.add(j.jahr)
  if (jahreSet.size === 0) return hist

  const jahre: SecSegmentJahrEintrag[] = []
  for (const jahr of [...jahreSet].sort((a, b) => a - b)) {
    const kandidaten: SecSegmentRoh[][] = []
    const prim = hist?.jahre.find((j) => j.jahr === jahr)?.segmente
    if (prim) kandidaten.push(prim)
    for (const q of quellen) {
      const alt = q.find((j) => j.jahr === jahr)?.segmente
      if (alt) kandidaten.push(alt)
    }
    const konzern = umsatzProJahr.get(jahr)
    const segmente = waehleBesteJahrSegmente(kandidaten, konzern, art)
    if (segmente) jahre.push({ jahr, segmente })
  }

  if (jahre.length < 2) return hist

  const segmentNamen = [...new Set(jahre.flatMap((j) => j.segmente.map((s) => s.name)))].sort()
  return {
    art,
    jahre,
    segmentNamen,
    anzahlJahre: jahre.length,
    aeltestesJahr: jahre[0]!.jahr,
    juengstesJahr: jahre[jahre.length - 1]!.jahr,
  }
}
