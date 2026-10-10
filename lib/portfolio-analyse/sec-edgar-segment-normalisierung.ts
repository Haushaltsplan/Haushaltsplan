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
  segmentIstGeo,
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
  // Google-Disaggregation bewusst granular belassen (nicht zu „Google Services“ rollen)
  [/^google\s+search\s*&?\s*other$/i, 'Google Search & other'],
  [/^youtube\s+ads?$/i, 'YouTube ads'],
  [/^youtube\s+advertising$/i, 'YouTube ads'],
  [/^google\s+subscriptions?,?\s*platforms?,?\s*(?:and|&)\s*devices$/i, 'Google subscriptions, platforms & devices'],
  [/^google\s+network$/i, 'Google Network'],
  [/^google\s+advertising$/i, 'Google advertising'],
  [/^commercial\s+revenue$/i, 'Commercial revenue'],
  [/^residential\s+revenue$/i, 'Residential revenue'],
  [/^franchise\s+revenues?$/i, 'Franchise revenues'],
  [/^asset\s+based\s+fees?$/i, 'Asset Based Fees'],
  [/^asset\s+linked\s+fees?$/i, 'Asset Linked Fees'],
  [/^instruments\s*and\s*accessories$/i, 'Instruments and Accessories'],
  [/^instrumentsand\s*accessories$/i, 'Instruments and Accessories'],
  [/^rest\s+of\s+(?:the\s+)?world$/i, 'Rest of the World'],
  [/^rest\s+of\s+world$/i, 'Rest of the World'],
  [/^other\s+countries$/i, 'Other countries'],
  [/^all\s+other\s+countries$/i, 'All Other Countries'],
  [/^wearables,?\s*home\s*(?:and|&)\s*accessories$/i, 'Wearables, Home and Accessories'],
  [/^wearables\s+homeand\s+accessories$/i, 'Wearables, Home and Accessories'],
  [/^software\s+as\s+a?\s*service$/i, 'Software as a Service'],
  [/^sleep\s+and\s+respiratory$/i, 'Sleep and Breathing Health'],
  [/^sleep\s+and\s+breathing\s+health$/i, 'Sleep and Breathing Health'],
  [/^residential\s+care\s+software$/i, 'Residential Care Software'],
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
  const schema = ermittleDominanteSegmentNamen(primaer.jahre)
  const medianN = medianZahl(
    primaer.jahre.map((j) => j.segmente.filter((s) => (s.umsatzMio ?? 0) > 0).length),
  )
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
      const altBruch = jahrIstSchemaBruch(alt, schema, medianN)
      const neuBruch = jahrIstSchemaBruch(j.segmente, schema, medianN)
      if (altBruch && !neuBruch) {
        byJahr.set(j.jahr, j.segmente)
        continue
      }
      if (neuSum > altSum * 1.08 && alt.length < j.segmente.length && !neuBruch) {
        byJahr.set(j.jahr, j.segmente)
      }
    }
  }

  const jahre = [...byJahr.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([jahr, segmente]) => ({ jahr, segmente }))
  return vereinheitlicheSegmentHistorie({ ...primaer, jahre })
}

function medianZahl(werte: number[]): number {
  if (werte.length === 0) return 0
  const s = [...werte].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 === 1 ? s[m]! : (s[m - 1]! + s[m]!) / 2
}

/** Reine Regionslabels (auch McD-„U.S.“-Operating), wenn daneben echte Produktlinien stehen. */
const REINE_REGION_LABEL =
  /^(?:u\.s\.?|united states|europe|asia(?:[- ]pacific)?|americas?|emea|apac|international|foreign|domestic|rest of (?:the )?world|other countries|other foreign countries|latin america|north america|south america)$/i

function entferneGeoAusProduktWennGemischt(segmente: SecSegmentRoh[]): SecSegmentRoh[] {
  const ohneGeo = segmente.filter(
    (s) => !segmentIstGeo(s.name) && !REINE_REGION_LABEL.test(s.name.trim()),
  )
  // McD o. Ä.: nur Regions-Operating-Segmente → Original behalten
  if (ohneGeo.length < 2) return segmente
  return ohneGeo
}

function istGenerischesUmsatzLabel(name: string): boolean {
  return /^(products?|services?|product sales|service revenue|goods|merchandise)$/i.test(
    name.trim(),
  )
}

/**
 * AAPL u. a.: „Product + Service“ parallel zu iPhone/iPad/Mac → Aggregate entfernen.
 * Ein einzelnes „Product“ neben Consumables/Instruments (TMO) ist ein Peer-Schnitt — behalten.
 */
function entferneGenerischenUmsatzSchnitt(segmente: SecSegmentRoh[]): SecSegmentRoh[] {
  const generic = segmente.filter((s) => istGenerischesUmsatzLabel(s.name))
  const specific = segmente.filter((s) => !istGenerischesUmsatzLabel(s.name))
  const hatProduct = generic.some((s) => /^products?$/i.test(s.name.trim()))
  const hatService = generic.some((s) => /^services?$/i.test(s.name.trim()))
  // Nur der klassische Product+Service-Doppel-Schnitt (nicht TMO-„Product“ allein)
  if (!hatProduct || !hatService || specific.length < 2) return segmente
  const gSum = generic.reduce((a, s) => a + (s.umsatzMio ?? 0), 0)
  const sSum = specific.reduce((a, s) => a + (s.umsatzMio ?? 0), 0)
  const total = gSum + sSum
  if (total <= 0) return segmente
  const gShare = gSum / total
  const sShare = sSum / total
  if (gShare >= 0.35 && gShare <= 0.65 && sShare >= 0.35 && sShare <= 0.65) {
    return specific
  }
  return segmente
}

/** Geo: nur bei echtem Doppel-Schnitt (US/ROW ≈ andere Regionen, je ~½) einen Schnitt behalten. */
function entferneGrobenGeoSchnitt(segmente: SecSegmentRoh[]): SecSegmentRoh[] {
  const grob = segmente.filter((s) => {
    const n = s.name.trim()
    return (
      /^(united states|u\.s\.?)$/i.test(n) ||
      /^rest of (?:the )?world$/i.test(n) ||
      /^other countries$/i.test(n) ||
      /^all other countries$/i.test(n) ||
      /^foreign$/i.test(n) ||
      /^international$/i.test(n)
    )
  })
  const fein = segmente.filter((s) => !grob.includes(s))
  if (grob.length < 2 || fein.length < 2) return segmente
  const gSum = grob.reduce((a, s) => a + (s.umsatzMio ?? 0), 0)
  const fSum = fein.reduce((a, s) => a + (s.umsatzMio ?? 0), 0)
  const total = gSum + fSum
  if (total <= 0) return segmente
  const gShare = gSum / total
  const fShare = fSum / total
  // Echtes Nebeneinander zweier Voll-Schnitte (nicht NVDA mit US+China+Europa in einem Schnitt)
  if (gShare >= 0.35 && gShare <= 0.65 && fShare >= 0.35 && fShare <= 0.65) {
    return grob
  }
  return segmente
}

/** Namen, die in den „schlanken“ Jahren stabil vorkommen (= Reporting-Schema). */
export function ermittleDominanteSegmentNamen(jahre: SecSegmentJahrEintrag[]): string[] {
  if (jahre.length === 0) return []
  const counts = jahre.map((j) => j.segmente.filter((s) => (s.umsatzMio ?? 0) > 0).length)
  const med = medianZahl(counts)
  const lean = jahre.filter((j) => {
    const n = j.segmente.filter((s) => (s.umsatzMio ?? 0) > 0).length
    return n >= 2 && n <= med + 1.5
  })
  const pool = lean.length >= 2 ? lean : jahre
  const freq = new Map<string, number>()
  for (const j of pool) {
    for (const s of j.segmente) {
      if ((s.umsatzMio ?? 0) <= 0) continue
      freq.set(s.name, (freq.get(s.name) ?? 0) + 1)
    }
  }
  const schwell = Math.max(2, Math.ceil(pool.length * 0.5))
  return [...freq.entries()]
    .filter(([, c]) => c >= schwell)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([n]) => n)
}

function nameInSchema(name: string, schema: string[], nameMap: Map<string, string>): boolean {
  const k = kanonischerName(name, nameMap)
  const sk = segmentSchluessel(k)
  return schema.some((n) => {
    const sn = kanonischerName(n, nameMap)
    return sn === k || segmentSchluessel(sn) === sk
  })
}

function jahrIstSchemaBruch(
  segmente: SecSegmentRoh[],
  schema: string[],
  medianN: number,
  nameMap: Map<string, string> = new Map(),
): boolean {
  if (schema.length < 2) return false
  const clean = segmente.filter((s) => (s.umsatzMio ?? 0) > 0)
  if (clean.length < 2) return true
  const treffer = schema.filter((n) =>
    clean.some((s) => nameInSchema(s.name, [n], nameMap)),
  ).length
  const allSum = clean.reduce((a, s) => a + (s.umsatzMio ?? 0), 0)
  const schemaSum = clean
    .filter((s) => nameInSchema(s.name, schema, nameMap))
    .reduce((a, s) => a + (s.umsatzMio ?? 0), 0)
  const cov = allSum > 0 ? schemaSum / allSum : 0
  const aufgegblaht =
    clean.length >= Math.max(medianN + 4, Math.ceil(medianN * 1.75)) &&
    clean.length > schema.length + 2

  if (aufgegblaht && treffer >= Math.min(2, schema.length)) return true

  if (
    treffer >= Math.min(2, schema.length) &&
    clean.length > schema.length + 1 &&
    cov >= 0.22 &&
    cov <= 0.88
  ) {
    return true
  }

  if (aufgegblaht && treffer === 0 && clean.length >= medianN + 5) return true

  return false
}

function interpoliereSegmenteZwischenJahren(
  segPrev: SecSegmentRoh[],
  segNext: SecSegmentRoh[],
  prevJahr: number,
  nextJahr: number,
  zielJahr: number,
  nameMap: Map<string, string>,
  nurNamen?: string[],
): SecSegmentRoh[] | null {
  const span = nextJahr - prevJahr
  if (span <= 0) return null
  const w = (zielJahr - prevJahr) / span
  const namen = nurNamen?.length
    ? nurNamen
    : [
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
      va != null && vb != null ? Math.round((va * (1 - w) + vb * w) * 10) / 10 : (va ?? vb)
    if (umsatzMio == null || umsatzMio <= 0) continue
    const oiA = a?.operatingIncomeMio ?? null
    const oiB = b?.operatingIncomeMio ?? null
    const operatingIncomeMio =
      oiA != null && oiB != null
        ? Math.round((oiA * (1 - w) + oiB * w) * 10) / 10
        : oiA ?? oiB
    segmente.push({
      name,
      umsatzMio,
      anteilPct: null,
      operatingIncomeMio,
      margePct: null,
    })
  }
  return segmente.length >= 2 ? anteileBerechnen(segmente) : null
}

/**
 * Jahre mit vermischten Segment-Schnitten (z. B. TMO 2023: Product/Consumables/Instruments
 * + Operating-Segmente + Geo) durch Interpolation aus benachbarten schlanken Jahren ersetzen.
 */
export function repariereInkohaerenteSegmentJahre(
  hist: SecSegmentHistorie | null,
): SecSegmentHistorie | null {
  if (!hist || hist.jahre.length < 3) return hist
  const vorab = vereinheitlicheSegmentHistorie(hist) ?? hist
  const schema = ermittleDominanteSegmentNamen(vorab.jahre)
  if (schema.length < 2) return vorab

  const medianN = medianZahl(
    vorab.jahre.map((j) => j.segmente.filter((s) => (s.umsatzMio ?? 0) > 0).length),
  )
  const byJahr = new Map(vorab.jahre.map((j) => [j.jahr, j.segmente]))
  const nameMap = aligniereSegmentNamenUeberJahre(vorab.jahre)
  const sorted = [...byJahr.keys()].sort((a, b) => a - b)
  const min = sorted[0]!
  const max = sorted[sorted.length - 1]!

  const istBruch = (jahr: number): boolean => {
    const segs = byJahr.get(jahr)
    return !segs || jahrIstSchemaBruch(segs, schema, medianN, nameMap)
  }

  let geaendert = false
  for (const y of sorted) {
    if (!istBruch(y)) continue

    let prev = y - 1
    while (prev >= min && istBruch(prev)) prev--
    let next = y + 1
    while (next <= max && istBruch(next)) next++
    if (prev < min || next > max || !byJahr.has(prev) || !byJahr.has(next)) {
      // Ohne Nachbarn nicht zurechtschneiden: skalierte Teil-Summen verfälschen den Mix.
      continue
    }
    if (next - prev > 6) continue

    const interp = interpoliereSegmenteZwischenJahren(
      byJahr.get(prev)!,
      byJahr.get(next)!,
      prev,
      next,
      y,
      nameMap,
      schema,
    )
    if (interp) {
      byJahr.set(y, interp)
      geaendert = true
    }
  }

  if (!geaendert) return vorab
  const jahre = [...byJahr.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([jahr, segmente]) => ({ jahr, segmente }))
  return vereinheitlicheSegmentHistorie({ ...vorab, jahre })
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

    const interp = interpoliereSegmenteZwischenJahren(
      byJahr.get(prev)!,
      byJahr.get(next)!,
      prev,
      next,
      y,
      nameMap,
    )
    if (interp) byJahr.set(y, interp)
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

function scoreJahrKandidat(
  segmente: SecSegmentRoh[],
  konzern: number | undefined,
  schema: string[] = [],
): number {
  let score = segmente.length >= 2 && segmente.length <= 10 ? 20 : 0
  if (segmente.length > 12) score -= 35
  score -= segmente.filter((s) => istPeriodenLabel(s.name)).length * 50
  if (konzern && konzern > 0) {
    const summe = segmente.reduce((s, x) => s + (x.umsatzMio ?? 0), 0)
    if (summe > 0) {
      const ratio = summe / konzern
      score += 30 - Math.min(30, Math.abs(1 - ratio) * 40)
    }
  }
  if (schema.length >= 2) {
    const names = new Set(segmente.map((s) => s.name))
    const treffer = schema.filter((n) => names.has(n)).length
    score += treffer * 12
    score -= Math.max(0, segmente.length - schema.length) * 4
    if (treffer === schema.length && segmente.length <= schema.length + 1) score += 25
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
  if (art === 'produkt') {
    clean = entferneGeoAusProduktWennGemischt(clean)
    clean = entferneGenerischenUmsatzSchnitt(clean)
  } else if (art === 'geo') {
    clean = entferneGrobenGeoSchnitt(clean)
  }
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
  schema: string[] = [],
): SecSegmentRoh[] | null {
  let best: SecSegmentRoh[] | null = null
  let bestScore = -Infinity
  for (const roh of kandidaten) {
    const val = bereinigeJahrSegmente(roh, konzern, art)
    if (!val) continue
    const score = scoreJahrKandidat(val, konzern, schema)
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

  const rohJahre: SecSegmentJahrEintrag[] = []
  for (const jahr of [...jahreSet].sort((a, b) => a - b)) {
    const prim = hist?.jahre.find((j) => j.jahr === jahr)?.segmente
    if (prim?.length) rohJahre.push({ jahr, segmente: prim })
  }
  const schema = ermittleDominanteSegmentNamen(
    rohJahre.length >= 2
      ? rohJahre
      : [...jahreSet]
          .sort((a, b) => a - b)
          .flatMap((jahr) => {
            for (const q of quellen) {
              const alt = q.find((j) => j.jahr === jahr)
              if (alt) return [alt]
            }
            return []
          }),
  )

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
    const segmente = waehleBesteJahrSegmente(kandidaten, konzern, art, schema)
    if (segmente) jahre.push({ jahr, segmente })
  }

  if (jahre.length < 2) return hist

  const roh: SecSegmentHistorie = {
    art,
    jahre,
    segmentNamen: [...new Set(jahre.flatMap((j) => j.segmente.map((s) => s.name)))].sort(),
    anzahlJahre: jahre.length,
    aeltestesJahr: jahre[0]!.jahr,
    juengstesJahr: jahre[jahre.length - 1]!.jahr,
  }
  return repariereInkohaerenteSegmentJahre(vereinheitlicheSegmentHistorie(roh) ?? roh)
}
