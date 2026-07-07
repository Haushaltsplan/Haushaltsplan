/** Geo- & Produktsegmente aus iXBRL-10-K-Tabellen (us-gaap TextBlocks). */

import type { SecSegmentHistorie } from '@/lib/portfolio-analyse/fundamentaldaten-erweitert-types'

export type SecSegmentRoh = {
  name: string
  umsatzMio: number | null
  anteilPct: number | null
  /** Segment-Operating-Income (Mio. USD) — aus 10-K Segment-Reporting. */
  operatingIncomeMio?: number | null
  /** Netto- oder Operating-Marge = Gewinn / Umsatz (wenn in 10-K ausgewiesen). */
  margePct?: number | null
  netIncomeMio?: number | null
}

/** Segment-Umbenennungen über Jahre (10-K-Reporting-Änderungen). */
const SEGMENT_NAME_ALIASES: [RegExp, string][] = [
  [/^google$/i, 'Google Services'],
  [/^google segment$/i, 'Google Services'],
  [/^google advertising$/i, 'Google advertising'],
  [/^google search\s*&?\s*other$/i, 'Google Search & other'],
  [/^youtube ads$/i, 'YouTube ads'],
  [/^youtube advertising$/i, 'YouTube ads'],
  [/^google network$/i, 'Google Network'],
  [/^google subscriptions?,?\s*platforms?,?\s*(?:and|&)\s*devices$/i, 'Google subscriptions, platforms & devices'],
  [/^other bets$/i, 'Other Bets'],
  [/^intelligent cloud$/i, 'Intelligent Cloud'],
  [/^productivity and business processes$/i, 'Productivity and Business Processes'],
  [/^more personal computing$/i, 'More Personal Computing'],
]

/** Umsatz-Disaggregation → Reporting-Segment für EBIT-Marge (GOOGL, MSFT, …). */
const UMSATZ_ZU_REPORTING_SEGMENT: [RegExp, string][] = [
  [/^google cloud$/i, 'Google Cloud'],
  [/^other bets$/i, 'Other Bets'],
  [/^google services$/i, 'Google Services'],
  [/^google search/i, 'Google Services'],
  [/^youtube ads?$/i, 'Google Services'],
  [/^youtube advertising$/i, 'Google Services'],
  [/^google network/i, 'Google Services'],
  [/^google subscriptions/i, 'Google Services'],
  [/^google other$/i, 'Google Services'],
  [/^google advertising$/i, 'Google Services'],
  [/^intelligent cloud$/i, 'Intelligent Cloud'],
  [/^productivity and business/i, 'Productivity and Business Processes'],
  [/^more personal computing$/i, 'More Personal Computing'],
  [/^server products/i, 'Intelligent Cloud'],
  [/^microsoft 365/i, 'Productivity and Business Processes'],
  [/^linked[in]?in/i, 'Productivity and Business Processes'],
  [/^dynamics/i, 'Productivity and Business Processes'],
  [/^windows$/i, 'More Personal Computing'],
  [/^gaming$/i, 'More Personal Computing'],
  [/^devices$/i, 'More Personal Computing'],
  [/^unitedhealthcare$/i, 'UnitedHealthcare'],
  [/^optum/i, 'Optum'],
]

export function kanonisereSegmentNamen(segmente: SecSegmentRoh[]): SecSegmentRoh[] {
  return segmente.map((s) => {
    let name = s.name.trim()
    for (const [re, ziel] of SEGMENT_NAME_ALIASES) {
      if (re.test(name)) {
        name = ziel
        break
      }
    }
    return { ...s, name }
  })
}

const XBRL_GEO_TAGS = [
  'ScheduleOfRevenuesFromExternalCustomersAndLongLivedAssetsByGeographicalAreasTableTextBlock',
  'RevenueFromExternalCustomersByGeographicAreasTableTextBlock',
  'RevenuesFromExternalCustomersByGeographicAreasTableTextBlock',
]

const XBRL_OPERATING_TAG = 'ScheduleOfSegmentReportingInformationBySegmentTextBlock'
const XBRL_OPERATING_FALLBACK = 'SegmentReportingDisclosureTextBlock'

const SKIP_LABELS =
  /^(net revenue[s]?|total revenue[s]?|total net sales|revenue[s]?|revenues?|total[s]?|consolidated|eliminations?|intercompany|corporate|other(\s+and)?\s+unallocated|unallocated|not\s+assigned|all\s+other|year ended|in millions|\(in millions\)|cost of revenue|operating expenses|operating income|gross profit|depreciation|amortization|assets|liabilities|capital expenditures|adjusted ebitda|reconciling items|long-lived assets|property and equipment|revenue from operations|revenue from external customers|revenues from external customers|consolidated revenues|intersegment revenues|segment operating profit|operating profit|gross margin|employee benefit|less: other segment items)$/i

const JUNK_LABEL =
  /incorporated|recognized|privacy|union\s*\(|&#|payments,|chief executive|officer since|previous business|accounts receivable|contract assets|receivables from contracts|shares outstanding|weighted[- ]average|diluted|basic shares|per share|stockholders|shareholders|remeasurement|held for sale|medical costs|payable|long-term assets|capitalized software|common stock|preferred stock|class [a-z0-9]/i

const BALANCE_JUNK =
  /\breceivable\b|\bprepaid\b|\bother assets\b|\bother current\b|\bother liabilities\b|\bliabilit|\bnet income\b|\bgoodwill\b|\bintangible\b|\bproperty, plant\b|\bcash and cash\b|\btotal assets\b|\bsegment assets\b/i

const FINANCIAL_LINE_ITEM =
  /^(premiums?|products?|services?|investment|interest|depreciation|amortization|earnings|employee|personnel|professional fees|data processing|foreign exchange|advertising|marketing|provision|capital expenditure|total operating costs|total company|total franchised|total other|other costs|other segment items|other \(income\)|gains|losses|hedging|elimination|corporate|unallocated|income tax|tax expense|membership|operating loss|income before|operating supplies and expenses|general supplies and expenses|operating taxes and licenses|insurance and claims|communications and utilities|purchased transportation|miscellaneous expenses, net|other income, net|revenues?)$/i

/** GuV-/Reconciliation-Zeilen — keine echten Segmente. */
const AUFWAND_ZEILE =
  /\b(expense|expenses|depreciation|amortization|provision|litigation|interest|income tax|tax expense|compensation|personnel|professional fees|foreign exchange|data processing|telecommunications|purchased|fuel|salaries|membership and other|corporate and support|alphabet-level|employee compensation|other costs and expenses|operating supplies|general supplies|operating taxes|insurance and claims|communications and utilities|purchased transportation|miscellaneous expenses|other income, net|reconciling|elimination|materials and supplies|other cost of services|restructuring costs?|cost of services)\b/i

const GEO_SKIP =
  /hedging|elimination|intercompany|unallocated|corporate activities|alphabet-level/i

const GEO_HINT =
  /america|europe|asia|pacific|africa|middle east|international|united states|u\.s\.|emea|apac|latin|canada|china|japan|korea|india|germany|uk|united kingdom|austral|mexico|brazil|regional|foreign|domestic|north america|south america|rest of world|outside|geograph|country|market[s]?$|americas|other countries|other americas/i

export type SegmentExtraktionErgebnis = {
  segmente: SecSegmentRoh[]
  art: 'produkt' | 'geo' | null
  quelle: 'xbrl_operating' | 'xbrl_geo' | 'html_heuristik' | null
}

type TabellenZeile = { zellen: string[]; betraege: number[] }

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
}

function zellenText(tdHtml: string): string {
  return decodeHtmlEntities(
    tdHtml
      .replace(/<ix:nonfraction[^>]*>([\s\S]*?)<\/ix:nonfraction>/gi, '$1')
      .replace(/<ix:nonnumeric[^>]*>([\s\S]*?)<\/ix:nonnumeric>/gi, '$1')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim(),
  )
}

function betraegeAusZeile(trHtml: string): number[] {
  const betraege: number[] = []
  const ixRe = /<ix:nonfraction[^>]*>([\s\S]*?)<\/ix:nonfraction>/gi
  let m: RegExpExecArray | null
  while ((m = ixRe.exec(trHtml)) !== null) {
    const s = m[1].replace(/<[^>]+>/g, '').replace(/,/g, '').replace(/\$/g, '').trim()
    if (!/^-?\d+(?:\.\d+)?$/.test(s)) continue
    const n = Number(s)
    if (Number.isFinite(n) && n > 0) betraege.push(n)
  }
  if (betraege.length > 0) return betraege

  const zellen = [...trHtml.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((c) => zellenText(c[1]!))
  for (const z of zellen) {
    const s = z.replace(/[$,()]/g, '').trim()
    if (!/^\d+(?:\.\d+)?$/.test(s)) continue
    const n = Number(s)
    if (Number.isFinite(n) && n > 0) betraege.push(n)
  }
  return betraege
}

function parseTabellenZeilen(fragment: string): TabellenZeile[] {
  const rows: TabellenZeile[] = []
  const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi
  let row: RegExpExecArray | null
  while ((row = rowRe.exec(fragment)) !== null) {
    const tr = row[1]!
    if (/visibility:\s*collapse/i.test(row[0]!)) continue
    const zellen = [...tr.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)]
      .map((c) => zellenText(c[1]!))
    const sichtbar = nichtLeereZellen(zellen)
    if (sichtbar.length === 0) continue
    rows.push({ zellen, betraege: betraegeAusZeile(tr) })
  }
  return rows
}

function normalisiereZelle(z: string): string {
  return z.replace(/\u00a0/g, ' ').trim()
}

function nichtLeereZellen(zellen: string[]): string[] {
  return zellen.map(normalisiereZelle).filter((z) => z.length > 0 && z !== '$')
}

function segmentNameAusZeile(zellen: string[], betraege: number[] = []): string | null {
  const cleaned = nichtLeereZellen(zellen)
  if (cleaned.length === 0) return null
  const label0 = bereinigeLabel(cleaned[0]!)
  if (!istSegmentLabel(label0, false, false)) return null
  if (betraege.length > 0 && betragZuMio(betraege[0]!) >= 100) return null
  if (cleaned.length === 1) return label0
  const restNurLeer = cleaned.slice(1).every((c) => c.length <= 1 || c === '$')
  return restNurLeer ? label0 : null
}

function bereinigeLabel(raw: string): string {
  return decodeHtmlEntities(raw)
    .replace(/\s*\(\s*[a-z]\s*\)\s*$/gi, '')
    .replace(/\s*\(\s*\d+\s*\)\s*$/g, '')
    .replace(/\s+\d{1,2}\s*$/g, '')
    .replace(/\s*\$\s*$/g, '')
    .replace(/[:;]+\s*$/g, '')
    .replace(/\s*\(\s*in\s+millions?\s*\)\s*/gi, '')
    .trim()
}

function parseBetragAusText(raw: string): number | null {
  const s = bereinigeLabel(raw)
    .replace(/\$/g, '')
    .replace(/%/g, '')
    .replace(/,/g, '')
    .trim()
  if (!/^-?\d+(?:\.\d+)?$/.test(s)) return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

/** Große Beträge pro Zeile (ohne Prozent-Spalten). */
function grossWerteAusZeile(z: TabellenZeile, minWert: number): number[] {
  const ausIx = z.betraege.filter((n) => Math.abs(n) >= minWert)
  if (ausIx.length >= 2) return ausIx
  const ausZellen: number[] = []
  for (const cell of z.zellen) {
    const n = parseBetragAusText(cell)
    if (n != null && Math.abs(n) >= minWert) ausZellen.push(n)
  }
  return ausZellen.length >= 2 ? ausZellen : ausIx.length > 0 ? ausIx : ausZellen
}

function betragAnSpaltenIdx(z: TabellenZeile, idx: number, minWert: number): number | null {
  let best: number | null = null
  for (let di = -3; di <= 3; di++) {
    const n = parseBetragAusText(z.zellen[idx + di] ?? '')
    if (n != null && Math.abs(n) >= minWert && (best == null || n > best)) best = n
  }
  if (best != null) return betragZuMio(best)

  const klassisch = betragAnIndex(z, idx)
  if (klassisch != null && klassisch >= (minWert >= 500 ? 30 : 5)) return klassisch

  return null
}

function betragAnJahrIndex(
  z: TabellenZeile,
  jahrSpalten: { jahr: number; idx: number }[],
  yearIdx: number,
  metrik: 'umsatz' | 'assets',
): number | null {
  const minWert = metrik === 'assets' ? 50 : 500
  const gross = grossWerteAusZeile(z, minWert)

  if (gross.length === jahrSpalten.length && yearIdx < gross.length) {
    return betragZuMio(gross[yearIdx]!)
  }

  const spalte = jahrSpalten[yearIdx]
  if (spalte) {
    const anSpalte = betragAnSpaltenIdx(z, spalte.idx, minWert)
    if (anSpalte != null) return anSpalte
  }

  if (yearIdx < gross.length) return betragZuMio(gross[yearIdx]!)
  return null
}

function betragZuMio(n: number): number {
  if (n > 50_000_000) return Math.round(n / 1_000_000)
  return Math.round(n)
}

function istGeoName(name: string): boolean {
  const n = bereinigeLabel(name)
  if (istGeoartigesOperatingSegment(n)) return false

  // Gebühren-/Produktzeilen mit geo-ähnlichen Wörtern (MA, V, …)
  if (
    /\b(assessment|assessments|fee|fees|processing|network|incentive|incentives|rebate|volume|service|services|solution|solutions|product|products|subscription|license|royalt|contra-revenue|cross-border|cross border|gross revenue|other revenue)\b/i.test(
      n,
    )
  ) {
    return false
  }

  // Reine Regions-Labels
  if (
    /^(?:the\s+)?(?:americas?|europe|asia|africa|emea|apac|international|foreign|u\.s\.?|united states|north america|south america|latin america|rest of (?:the )?world|other countries)(?:\s+markets?)?$/i.test(
      n,
    )
  ) {
    return true
  }
  if (/north american markets?|international markets?/i.test(n)) return true
  if (/asia pacific/i.test(n) && /(?:europe|africa|middle east)/i.test(n)) return true
  if (/middle east and africa/i.test(n)) return true

  if (GEO_SKIP.test(n)) return false
  if (/^(domestic|international|foreign|regional)$/i.test(n)) return true

  return GEO_HINT.test(n) && n.length <= 50 && !/\brevenue[s]?\b/i.test(n)
}

/** Öffentliche API für Segment-Trennung Produkt vs. Region. */
export function segmentIstGeo(name: string): boolean {
  return istGeoName(name)
}

function istEindeutigeProduktDisaggZeile(name: string): boolean {
  const n = bereinigeLabel(name)
  return /\b(assessment|assessments|fee|fees|processing|network|incentive|incentives|rebate|volume|service|services|solution|solutions|product|products|subscription|license|royalt|contra-revenue|cross-border|cross border|gross revenue|other revenue|payment network|transaction processing|value-added|client incentives)\b/i.test(
    n,
  )
}

function segmentGehoertZuProdukt(name: string): boolean {
  return !istGeoName(name) || istGeoartigesOperatingSegment(name)
}

function segmentGehoertZuGeo(name: string): boolean {
  if (istGeoartigesOperatingSegment(name)) return false
  if (istGeoName(name)) return true
  // KNSL: Commercial/Personal als Regions-Tab (kein klassisches Geo-Label)
  if (/^(commercial|personal)$/i.test(bereinigeLabel(name))) return true
  return false
}

/** Jahre auf reine Produkt- bzw. Geo-Segmente filtern (Anteile neu berechnen). */
export function filterJahreNachArt(
  jahre: SecSegmentJahrEintrag[],
  art: 'produkt' | 'geo',
): SecSegmentJahrEintrag[] {
  const out: SecSegmentJahrEintrag[] = []
  for (const j of jahre) {
    let segmente: SecSegmentRoh[]
    if (art === 'produkt') {
      segmente = j.segmente.filter(
        (s) => segmentGehoertZuProdukt(s.name) && istPlausiblerSegmentname(s.name),
      )
    } else {
      const ohneProduktZeilen = j.segmente.filter((s) => !istEindeutigeProduktDisaggZeile(s.name))
      const nurGeo = ohneProduktZeilen.filter((s) => segmentGehoertZuGeo(s.name))
      segmente = nurGeo.length >= 2 ? nurGeo : []
    }
    if (segmente.length >= 2) {
      out.push({ jahr: j.jahr, segmente: anteileBerechnen(segmente) })
    }
  }
  return out
}

/** Historie bereinigen — gemischte Disaggregation (MA, V) in reine Produkt-/Geo-Sicht. */
export function filterSegmentHistorie(
  hist: SecSegmentHistorie | null,
  art: 'produkt' | 'geo',
): SecSegmentHistorie | null {
  if (!hist) return null
  const jahre = filterJahreNachArt(hist.jahre, art)
  if (jahre.length < 2) return null
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

/** MCD & Co.: Geschäftssegmente, die wie Geo-Namen aussehen. */
function istGeoartigesOperatingSegment(name: string): boolean {
  const n = bereinigeLabel(name)
  return (
    /^u\.s\.?$/i.test(n) ||
    /operated markets|developmental licensed|licensed markets\s*&\s*corporate/i.test(n)
  )
}

function istSegmentLabel(name: string, geoModus: boolean, ausXbrlGeo: boolean): boolean {
  const n = bereinigeLabel(name)
  if (n.length < 3 || n.length > 90) return false
  if (/^\(.*millions?\)$/i.test(n) || /^amounts in millions$/i.test(n)) return false
  if (/^\(?\s*in (?:millions?|thousands?|billions?|dollars)\s*\)?$/i.test(n)) return false
  if (/^\(?\s*millions of dollars\s*\)?$/i.test(n)) return false
  if (/^(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2},?\s+\d{4}$/i.test(n)) return false
  if (/^fiscal\s+\d{4}$/i.test(n)) return false
  if (SKIP_LABELS.test(n)) return false
  if (JUNK_LABEL.test(n)) return false
  if (BALANCE_JUNK.test(n)) return false
  if (/^\d{4}$/.test(n)) return false
  if (/^\(in /i.test(n)) return false
  if (/[,(]$/.test(n)) return false
  if (!/[a-zA-Z]{2,}/.test(n) && !/^u\.s\.?$/i.test(n)) return false
  if (geoModus && !ausXbrlGeo && !istGeoName(n)) return false
  return true
}

/** iXBRL-TextBlock inkl. ix:continuation-Kette (MA, moderne 10-K). */
export function extrahiereIxbrlTextBlock(html: string, tagSuffix: string): string {
  const escaped = tagSuffix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const nameRe = new RegExp(`name="(?:[a-zA-Z0-9_-]+:)?${escaped}"`, 'i')
  const nameMatch = nameRe.exec(html)
  if (!nameMatch) return ''
  const idx = nameMatch.index

  const nonNumericStart = html.lastIndexOf('<ix:nonNumeric', idx)
  if (nonNumericStart < 0) return ''

  const nonNumericOpenEnd = html.indexOf('>', nonNumericStart) + 1
  const nonNumericEnd = html.indexOf('</ix:nonNumeric>', nonNumericStart)
  if (nonNumericEnd < 0) return ''

  const header = html.slice(nonNumericStart, Math.min(nonNumericStart + 4000, nonNumericEnd))
  let out = html.slice(nonNumericOpenEnd, nonNumericEnd)

  let contId = header.match(/continuedAt="([^"]+)"/)?.[1]
  const visited = new Set<string>()

  while (contId && !visited.has(contId)) {
    visited.add(contId)
    const tagStart = html.indexOf(`<ix:continuation id="${contId}"`, nonNumericStart)
    if (tagStart < 0) break
    const openEnd = html.indexOf('>', tagStart) + 1
    const contEnd = html.indexOf('</ix:continuation>', openEnd)
    if (contEnd < 0) break
    const chunkHeader = html.slice(tagStart, openEnd)
    out += html.slice(openEnd, contEnd)
    contId = chunkHeader.match(/continuedAt="([^"]+)"/)?.[1]
  }

  return out
}

export function extrahiereErstenGeoBlock(html: string): string {
  for (const tag of XBRL_GEO_TAGS) {
    const block = extrahiereIxbrlTextBlock(html, tag)
    if (block.length > 200) return block
  }
  return ''
}

/** Produktsegmente: Segmentname-Zeile + folgende Revenue-Zeile (MSFT-Muster). */
export function parseOperatingSegmente(fragment: string): SecSegmentRoh[] {
  if (!fragment) return []
  const zeilen = parseTabellenZeilen(fragment)
  const segmente: SecSegmentRoh[] = []
  const seen = new Set<string>()
  let aktuellesSegment = ''
  let nachTotal = false

  for (const z of zeilen) {
    const sichtbar = nichtLeereZellen(z.zellen)
    const label0 = bereinigeLabel(sichtbar[0] ?? '')
    const labelJoin = bereinigeLabel(sichtbar.join(' '))

    if (/^total$/i.test(label0) || /^total net sales$/i.test(label0)) {
      nachTotal = true
      aktuellesSegment = ''
      continue
    }
    if (nachTotal) continue

    const segName = segmentNameAusZeile(z.zellen, z.betraege)
    if (segName) {
      aktuellesSegment = segName
      continue
    }

    if (aktuellesSegment && /^(revenue|total revenues)$/i.test(label0) && z.betraege.length > 0) {
      const key = aktuellesSegment.toLowerCase()
      if (!seen.has(key)) {
        seen.add(key)
        segmente.push({ name: aktuellesSegment, umsatzMio: betragZuMio(z.betraege[0]!), anteilPct: null })
      }
      aktuellesSegment = ''
      continue
    }

    // GOOGL/MCD-Muster: Segmentname und Umsatz in einer Zeile
    if (
      sichtbar.length >= 2 &&
      !/^total\b/i.test(label0) &&
      istSegmentLabel(label0, false, false) &&
      (!istGeoName(label0) || istGeoartigesOperatingSegment(label0)) &&
      !FINANCIAL_LINE_ITEM.test(label0) &&
      !AUFWAND_ZEILE.test(label0) &&
      !istIncomeStatementZeile(label0) &&
      !SKIP_LABELS.test(label0) &&
      z.betraege.length > 0
    ) {
      const mio = betragZuMio(z.betraege[0]!)
      if (mio >= 500) {
        const key = label0.toLowerCase()
        if (!seen.has(key)) {
          seen.add(key)
          segmente.push({ name: label0, umsatzMio: mio, anteilPct: null })
        }
      }
    }
  }

  return segmente
}

export function parseSpaltenOrientierteSegmente(fragment: string): SecSegmentRoh[] {
  if (!fragment) return []
  const zeilen = parseTabellenZeilen(fragment)
  let spaltenNamen: string[] = []
  const segmente: SecSegmentRoh[] = []

  for (const z of zeilen) {
    const sichtbar = nichtLeereZellen(z.zellen).map(bereinigeLabel)
    const potNamen = sichtbar.filter(
      (c) =>
        c &&
        istSegmentLabel(c, false, false) &&
        !FINANCIAL_LINE_ITEM.test(c) &&
        !AUFWAND_ZEILE.test(c) &&
        !istIncomeStatementZeile(c),
    )

    if (potNamen.length >= 2 && z.betraege.length < potNamen.length) {
      if (potNamen.length >= spaltenNamen.length) spaltenNamen = potNamen
      continue
    }

    const label0 = sichtbar[0] ?? ''
    if (/unaffiliated|affiliated/i.test(label0)) continue
    if (
      spaltenNamen.length >= 2 &&
      /^(total revenues?|revenues?|revenue from external customers|revenues from external customers|sales(\s*\([a-z]\))?|net sales)$/i.test(
        label0,
      )
    ) {
      const zahlenAusText = sichtbar
        .slice(1)
        .map((c) => Number(c.replace(/[^\d.]/g, '')))
        .filter((n) => Number.isFinite(n) && n > 0)
      const zahlen =
        zahlenAusText.length >= spaltenNamen.length
          ? zahlenAusText
          : z.betraege.length >= spaltenNamen.length
            ? z.betraege
            : zahlenAusText

      if (zahlen.length >= spaltenNamen.length) {
        const namen = spaltenNamen.filter((n) => !/^\(?\s*millions of dollars\s*\)?$/i.test(n))
        const werte = zahlen.slice(0, namen.length)
        for (let i = 0; i < namen.length; i++) {
          segmente.push({
            name: namen[i]!,
            umsatzMio: betragZuMio(werte[i]!),
            anteilPct: null,
          })
        }
        if (segmente.length >= 2) return bereinigeSpaltenSegmente(segmente)
      }
    }
  }

  return segmente
}

function bereinigeSpaltenSegmente(segmente: SecSegmentRoh[]): SecSegmentRoh[] {
  let ohneElim = segmente.filter(
    (s) => !/elimination|intercompany|^total$|^engineering$|^other$/i.test(bereinigeLabel(s.name)),
  )
  const hatOptumUntereinheiten = ohneElim.some((s) => /^optum (health|insight|rx)/i.test(s.name))
  if (hatOptumUntereinheiten) {
    ohneElim = ohneElim.filter((s) => !/^optum$/i.test(bereinigeLabel(s.name)))
  }
  const mitUmsatz = ohneElim.filter((s) => (s.umsatzMio ?? 0) >= 30)
  return mitUmsatz.length >= 2 ? mitUmsatz : ohneElim
}

export function parseGeoSegmente(fragment: string, ausXbrlGeo: boolean): SecSegmentRoh[] {
  if (!fragment) return []
  const zeilen = parseTabellenZeilen(fragment)
  const segmente: SecSegmentRoh[] = []
  const seen = new Set<string>()
  const combinedAssetsTable = /RevenuesFromExternalCustomersAndLongLivedAssets|LongLivedAssetsByGeographical/i.test(
    fragment,
  )
  let inRevenueSection = !combinedAssetsTable

  let jahrSpalten: { jahr: number; idx: number }[] = []
  for (let i = 0; i < Math.min(zeilen.length, 15); i++) {
    const sp = jahresSpaltenAusZeile(zeilen[i]!.zellen)
    if (sp.length >= 1) {
      jahrSpalten = sp
      break
    }
  }
  const juengstesYearIdx =
    jahrSpalten.length > 0
      ? jahrSpalten.reduce(
          (best, s, i) => (s.jahr > jahrSpalten[best]!.jahr ? i : best),
          0,
        )
      : -1

  for (const z of zeilen) {
    const sichtbar = nichtLeereZellen(z.zellen)
    const label0 = bereinigeLabel(sichtbar[0] ?? '')
    const labelJoin = sichtbar.join(' ').toLowerCase()

    if (/long[- ]lived assets|property and equipment|total assets/i.test(labelJoin)) {
      inRevenueSection = false
      continue
    }
    if (/net revenue|revenue[s]? by|revenues? by|net sales/i.test(labelJoin) && !/cost of revenue/i.test(labelJoin)) {
      inRevenueSection = true
    }
    if (!inRevenueSection) continue

    if (!label0 || GEO_SKIP.test(label0)) continue
    if (istIncomeStatementZeile(label0)) continue
    if (/^total\b/i.test(label0)) continue
    if (/^net sales$/i.test(label0) && !istGeoName(label0)) continue
    if (!istSegmentLabel(label0, true, ausXbrlGeo)) continue
    if (/^net revenue|^total revenue|^total$|^total net sales|^revenue$/i.test(label0)) continue
    if (z.betraege.length === 0 && grossWerteAusZeile(z, 500).length === 0) continue

    let mio: number | null = null
    if (juengstesYearIdx >= 0) {
      mio = betragAnJahrIndex(z, jahrSpalten, juengstesYearIdx, 'umsatz')
    } else if (z.betraege.length > 0) {
      const gross = grossWerteAusZeile(z, 500)
      const raw = gross.length > 0 ? gross[gross.length - 1]! : z.betraege[0]!
      mio = betragZuMio(raw)
    }
    if (mio == null || mio < 5) continue
    if (combinedAssetsTable && mio < 3000) continue

    const key = label0.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    segmente.push({ name: label0, umsatzMio: mio, anteilPct: null })
  }

  return segmente
}

function istIncomeStatementZeile(label: string): boolean {
  const n = bereinigeLabel(label)
  return (
    /cost of sales|cost of revenue|cost of products sold|research and development|selling and marketing|general and administrative|operating income|operating loss|operating earnings|gross profit|^net sales$|income before|earnings before income|corporate and support|other \(gains\)|contingent consideration|^impairment$/i.test(
      n,
    ) || /reportable segment operating earnings/i.test(n)
  )
}

function istOperatingIncomeZeile(label: string): boolean {
  const n = bereinigeLabel(label)
  return /^(operating income|operating loss|operating \(loss\) income|segment operating income|income \(loss\) from operations|operating profit|segment profit|income from operations)$/i.test(
    n,
  )
}

function istNetIncomeZeile(label: string): boolean {
  const n = bereinigeLabel(label)
  return /^(net income|net earnings|net profit|net loss|net income \(loss\)|net \(loss\) income)$/i.test(n)
}

function istSegmentUmsatzZeile(label: string): boolean {
  const n = bereinigeLabel(label)
  return /^(revenues?|net sales|sales|total revenues?)$/i.test(n)
}

function reportingSegmentFuerUmsatzZeile(name: string, oiKeys: Set<string>): string {
  const trimmed = name.trim()
  const lower = trimmed.toLowerCase()
  if (oiKeys.has(lower)) return trimmed
  for (const [re, parent] of UMSATZ_ZU_REPORTING_SEGMENT) {
    if (re.test(trimmed)) return parent
  }
  return trimmed
}

/** Disaggregations-Zeilen (GOOGL, MSFT) auf Reporting-Segmente rollen. */
export function rollupZuReportingSegmenten(segmente: SecSegmentRoh[]): SecSegmentRoh[] {
  const oiKeys = new Set(
    segmente.filter((s) => s.operatingIncomeMio != null).map((s) => s.name.trim().toLowerCase()),
  )
  const byParent = new Map<string, SecSegmentRoh>()
  for (const s of segmente) {
    const parent = reportingSegmentFuerUmsatzZeile(s.name, oiKeys)
    const prev = byParent.get(parent)
    if (!prev) {
      byParent.set(parent, { ...s, name: parent })
      continue
    }
    const umsatz = (prev.umsatzMio ?? 0) + (s.umsatzMio ?? 0)
    const oi =
      prev.operatingIncomeMio != null || s.operatingIncomeMio != null
        ? (prev.operatingIncomeMio ?? 0) + (s.operatingIncomeMio ?? 0)
        : null
    byParent.set(parent, {
      name: parent,
      umsatzMio: umsatz > 0 ? Math.round(umsatz * 10) / 10 : prev.umsatzMio,
      anteilPct: null,
      operatingIncomeMio: oi,
      margePct: null,
      netIncomeMio: prev.netIncomeMio ?? s.netIncomeMio,
    })
  }
  const merged = [...byParent.values()]
  return merged.length >= 2 ? anteileBerechnen(merged) : segmente
}

export function brauchtReportingRollup(jahre: SecSegmentJahrEintrag[]): boolean {
  const knownParents = new Set(UMSATZ_ZU_REPORTING_SEGMENT.map(([, p]) => p))
  let hits = 0
  const parents = new Set<string>()
  for (const j of jahre) {
    const oiKeys = new Set(
      j.segmente.filter((s) => s.operatingIncomeMio != null).map((s) => s.name.trim().toLowerCase()),
    )
    for (const s of j.segmente) {
      const parent = reportingSegmentFuerUmsatzZeile(s.name, oiKeys)
      if (parent !== s.name.trim() && knownParents.has(parent)) {
        hits++
        parents.add(parent)
      }
    }
  }
  return hits >= 2 && parents.size >= 2
}

export function berechneSegmentMargePct(umsatzMio: number | null, operatingIncomeMio: number | null): number | null {
  if (umsatzMio == null || operatingIncomeMio == null || umsatzMio === 0) return null
  return Math.round((operatingIncomeMio / umsatzMio) * 1000) / 10
}

function betragAnJahrIndexSigned(
  z: TabellenZeile,
  jahrSpalten: { jahr: number; idx: number }[],
  yearIdx: number,
): number | null {
  const minWert = 30
  const gross = grossWerteAusZeile(z, minWert)
  if (gross.length === jahrSpalten.length && yearIdx < gross.length) {
    return betragZuMio(gross[yearIdx]!)
  }
  const spalte = jahrSpalten[yearIdx]
  if (spalte) {
    const anSpalte = betragAnSpaltenIdx(z, spalte.idx, minWert)
    if (anSpalte != null) return anSpalte
  }
  if (yearIdx < gross.length) return betragZuMio(gross[yearIdx]!)
  return null
}

/** Operating-Income-Historie in bestehende Umsatz-Segment-Historie einmischen. */
export function ergaenzeSegmentHistorieMitMargen(
  historie: SecSegmentHistorie,
  oiJahre: SecSegmentJahrEintrag[],
): SecSegmentHistorie {
  const kennzByJahr = new Map<number, Map<string, { oi?: number; rev?: number; ni?: number }>>()
  for (const j of oiJahre) {
    const map = new Map<string, { oi?: number; rev?: number; ni?: number }>()
    for (const s of j.segmente) {
      const key = s.name.toLowerCase()
      const cur = map.get(key) ?? {}
      if (s.operatingIncomeMio != null) cur.oi = s.operatingIncomeMio
      if (s.netIncomeMio != null) cur.ni = s.netIncomeMio
      if (s.umsatzMio != null) cur.rev = s.umsatzMio
      map.set(key, cur)
    }
    if (map.size > 0) kennzByJahr.set(j.jahr, map)
  }

  return {
    ...historie,
    jahre: historie.jahre.map((j) => {
      const kennz = kennzByJahr.get(j.jahr)
      const oiKeys = new Set(kennz ? [...kennz.keys()] : [])

      const kindRev = new Map<string, number>()
      for (const s of j.segmente) {
        if (s.umsatzMio == null) continue
        const parent = reportingSegmentFuerUmsatzZeile(s.name, oiKeys).toLowerCase()
        kindRev.set(parent, Math.round(((kindRev.get(parent) ?? 0) + s.umsatzMio) * 10) / 10)
      }

      return {
        ...j,
        segmente: j.segmente.map((s) => {
          const parent = reportingSegmentFuerUmsatzZeile(s.name, oiKeys)
          const pk = parent.toLowerCase()
          const k = kennz?.get(pk)
          const oi = k?.oi ?? null
          const ni = k?.ni ?? null
          const revReporting = k?.rev ?? kindRev.get(pk) ?? null
          const gewinn = ni ?? oi
          const margePct = berechneSegmentMargePct(revReporting, gewinn)
          return {
            ...s,
            operatingIncomeMio: oi,
            netIncomeMio: ni,
            margePct,
          }
        }),
      }
    }),
  }
}

export function mergeOiJahrSmart(
  map: Map<number, SecSegmentRoh[]>,
  jahr: number,
  segmente: SecSegmentRoh[],
  filingBerichtJahr?: number,
  meta?: Map<number, number>,
): void {
  const norm = kanonisereSegmentNamen(segmente).filter((s) => s.operatingIncomeMio != null)
  if (norm.length === 0) return
  const filing = filingBerichtJahr ?? 0
  const prevFiling = meta?.get(jahr) ?? 0
  const neuereQuelle = filing > prevFiling
  const gleicheQuelle = filing === prevFiling && filing > 0
  const alt = map.get(jahr)
  if (!alt || neuereQuelle || gleicheQuelle) {
    const merged = new Map<string, SecSegmentRoh>()
    for (const s of alt ?? []) merged.set(s.name.toLowerCase(), s)
    for (const s of norm) merged.set(s.name.toLowerCase(), { ...s, umsatzMio: null, anteilPct: null })
    map.set(jahr, [...merged.values()])
    if (meta && filing > 0) meta.set(jahr, Math.max(filing, prevFiling))
  }
}

/** Zeilenorientiert: Segment-Kopf + „Operating income“-Zeile (MSFT, GOOGL). */
function parseMehrjahresOperatingIncomeRowOriented(fragment: string): SecSegmentJahrEintrag[] {
  if (!fragment || fragment.length < 200) return []
  const zeilen = parseTabellenZeilen(fragment)
  let headerIdx = -1
  let jahrSpalten: { jahr: number; idx: number }[] = []

  for (let i = 0; i < Math.min(zeilen.length, 30); i++) {
    const spalten = jahresSpaltenAusZeile(zeilen[i]!.zellen)
    if (spalten.length >= 2) {
      headerIdx = i
      jahrSpalten = spalten
      break
    }
  }
  if (headerIdx < 0 || jahrSpalten.length < 2) return []

  const byJahr = new Map<number, Map<string, { oi?: number; rev?: number; ni?: number }>>()
  for (const { jahr } of jahrSpalten) byJahr.set(jahr, new Map())
  let aktivesSegment: string | null = null

  const touch = (jahr: number, seg: string) => {
    const key = seg.toLowerCase()
    const m = byJahr.get(jahr)!
    if (!m.has(key)) m.set(key, {})
    return m.get(key)!
  }

  for (let i = headerIdx + 1; i < zeilen.length; i++) {
    const z = zeilen[i]!
    const sichtbar = nichtLeereZellen(z.zellen)
    const label0 = bereinigeLabel(sichtbar[0] ?? '')

    const segName = segmentNameAusZeile(z.zellen, z.betraege)
    if (
      segName &&
      !istOperatingIncomeZeile(label0) &&
      !istSegmentUmsatzZeile(label0) &&
      !istIncomeStatementZeile(label0)
    ) {
      aktivesSegment = segName
      continue
    }

    if (istSegmentUmsatzZeile(label0) && aktivesSegment) {
      jahrSpalten.forEach(({ jahr }, yearIdx) => {
        const mio = betragAnJahrIndexSigned(z, jahrSpalten, yearIdx)
        if (mio == null) return
        touch(jahr, aktivesSegment!).rev = mio
      })
      continue
    }

    if (istOperatingIncomeZeile(label0) && aktivesSegment) {
      jahrSpalten.forEach(({ jahr }, yearIdx) => {
        const mio = betragAnJahrIndexSigned(z, jahrSpalten, yearIdx)
        if (mio == null) return
        touch(jahr, aktivesSegment!).oi = mio
      })
      aktivesSegment = null
      continue
    }

    if (istNetIncomeZeile(label0) && aktivesSegment) {
      jahrSpalten.forEach(({ jahr }, yearIdx) => {
        const mio = betragAnJahrIndexSigned(z, jahrSpalten, yearIdx)
        if (mio == null) return
        touch(jahr, aktivesSegment!).ni = mio
      })
      aktivesSegment = null
      continue
    }

    if (
      istSegmentLabel(label0, false, false) &&
      !istGeoName(label0) &&
      z.betraege.length > 0 &&
      istOperatingIncomeZeile(sichtbar[1] ?? '')
    ) {
      continue
    }
  }

  return [...byJahr.entries()]
    .sort((a, b) => a[0] - b[0])
    .filter(([, map]) => map.size >= 1)
    .map(([jahr, map]) => ({
      jahr,
      segmente: [...map.entries()]
        .filter(([, k]) => k.oi != null || k.ni != null || k.rev != null)
        .map(([name, k]) => ({
          name,
          umsatzMio: k.rev ?? null,
          anteilPct: null,
          operatingIncomeMio: k.oi ?? null,
          netIncomeMio: k.ni ?? null,
        })),
    }))
    .filter((j) => j.segmente.length >= 1)
}

/** Spaltenorientiert: Spalten = Segmente, Zeile = Operating income. */
function parseMehrjahresOperatingIncomeSpaltenOrientiert(fragment: string): SecSegmentJahrEintrag[] {
  if (!fragment || fragment.length < 200) return []
  const byJahr = new Map<number, SecSegmentRoh[]>()
  let pendingJahr: number | null = null

  const speichere = (jahr: number | null, segmente: SecSegmentRoh[]) => {
    const norm = kanonisereSegmentNamen(segmente).filter(
      (s) => s.operatingIncomeMio != null || s.umsatzMio != null,
    )
    if (norm.length < 1) return
    const j = jahr != null && jahr >= 2010 && jahr <= 2030 ? jahr : pendingJahr
    if (j == null || j < 2010) return
    const merged = new Map<string, SecSegmentRoh>()
    for (const s of byJahr.get(j) ?? []) merged.set(s.name.toLowerCase(), s)
    for (const s of norm) {
      const key = s.name.toLowerCase()
      const prev = merged.get(key)
      merged.set(key, {
        name: s.name,
        umsatzMio: s.umsatzMio ?? prev?.umsatzMio ?? null,
        anteilPct: null,
        operatingIncomeMio: s.operatingIncomeMio ?? prev?.operatingIncomeMio ?? null,
      })
    }
    byJahr.set(j, [...merged.values()])
    pendingJahr = null
  }

  const verarbeiteTeil = (teil: string) => {
    const zeilen = parseTabellenZeilen(teil)
    let spaltenNamen: string[] = []

    for (const z of zeilen) {
      const sichtbar = nichtLeereZellen(z.zellen).map(bereinigeLabel)
      const label0 = sichtbar[0] ?? ''

      const potNamen = sichtbar.filter(
        (c) =>
          c &&
          istSegmentLabel(c, false, false) &&
          !FINANCIAL_LINE_ITEM.test(c) &&
          !AUFWAND_ZEILE.test(c) &&
          !istIncomeStatementZeile(c),
      )
      if (potNamen.length >= 2 && z.betraege.length < potNamen.length) {
        if (potNamen.length >= spaltenNamen.length) spaltenNamen = potNamen
        continue
      }

      const jahrInZeile = label0.match(/^(20\d{2})$/)?.[1]
      if (jahrInZeile && /^(20\d{2})$/.test(label0)) {
        pendingJahr = parseInt(jahrInZeile, 10)
        continue
      }

      if (spaltenNamen.length >= 2 && istSegmentUmsatzZeile(label0)) {
        const zahlen =
          z.betraege.length >= spaltenNamen.length
            ? z.betraege
            : sichtbar
                .slice(1)
                .map((c) => parseBetragAusText(c))
                .filter((n): n is number => n != null)
        if (zahlen.length < spaltenNamen.length) continue
        const namen = spaltenNamen.filter((n) => !/^\(?\s*millions of dollars\s*\)?$/i.test(n))
        const roh = namen.map((name, idx) => ({
          name,
          umsatzMio: betragZuMio(zahlen[idx]!),
          anteilPct: null,
          operatingIncomeMio: null,
        }))
        const jahr =
          pendingJahr ??
          (jahrInZeile ? parseInt(jahrInZeile, 10) : null) ??
          (parseInt(teil.match(/\b(20\d{2})\b/)?.[1] ?? '0', 10) || null)
        speichere(jahr && jahr >= 2010 ? jahr : null, roh)
        continue
      }

      if (spaltenNamen.length >= 2 && istOperatingIncomeZeile(label0)) {
        const zahlen =
          z.betraege.length >= spaltenNamen.length
            ? z.betraege
            : sichtbar
                .slice(1)
                .map((c) => parseBetragAusText(c))
                .filter((n): n is number => n != null)
        if (zahlen.length < spaltenNamen.length) continue
        const namen = spaltenNamen.filter((n) => !/^\(?\s*millions of dollars\s*\)?$/i.test(n))
        const roh = namen.map((name, idx) => ({
          name,
          umsatzMio: null,
          anteilPct: null,
          operatingIncomeMio: betragZuMio(zahlen[idx]!),
        }))
        const jahr =
          pendingJahr ??
          (jahrInZeile ? parseInt(jahrInZeile, 10) : null) ??
          (parseInt(teil.match(/\b(20\d{2})\b/)?.[1] ?? '0', 10) || null)
        speichere(jahr && jahr >= 2010 ? jahr : null, roh)
      }
    }
  }

  verarbeiteTeil(fragment)
  const teile = fragment.split(/(?=<table\b)/i)
  if (teile.length > 1) {
    for (const teil of teile) {
      if (teil.length < 300) continue
      verarbeiteTeil(teil)
    }
  }

  return [...byJahr.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([jahr, segmente]) => ({ jahr, segmente }))
}

export function parseMehrjahresOperatingIncome(fragment: string): SecSegmentJahrEintrag[] {
  return mergeJahrEintraege(
    parseMehrjahresOperatingIncomeRowOriented(fragment),
    parseMehrjahresOperatingIncomeSpaltenOrientiert(fragment),
  )
}

/** Operating-Income je Segment & Jahr aus Segment-Reporting-TextBlock. */
export function extrahiereOperatingIncomeHistorieAus10kHtml(html: string): SecSegmentJahrEintrag[] {
  const operatingBlock = extrahiereIxbrlTextBlock(html, XBRL_OPERATING_TAG)
  const fallbackBlock = extrahiereIxbrlTextBlock(html, XBRL_OPERATING_FALLBACK)
  let hist = parseMehrjahresOperatingIncome(operatingBlock)
  if (hist.length < 2 && fallbackBlock.length > 500) {
    const fb = parseMehrjahresOperatingIncome(fallbackBlock)
    if (fb.length > hist.length) hist = fb
  }
  return hist
}

function dedupliziereSegmente(segmente: SecSegmentRoh[]): SecSegmentRoh[] {
  const seen = new Set<string>()
  const out: SecSegmentRoh[] = []
  for (const s of segmente) {
    const key = s.name.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(s)
  }
  return out
}

function sindKlareProduktsegmente(segmente: SecSegmentRoh[]): boolean {
  if (segmente.length < 2) return false
  const produktHinweis =
    /google (services|cloud)|other bets|intelligent cloud|productivity|unitedhealthcare|optum|walmart u\.s|sam's club|more personal computing|bulk|industrial|east tier|west tier|index|analytics|sustainability|zts|pharma|cloud|software|platform/i
  const mitHinweis = segmente.filter((s) => produktHinweis.test(s.name)).length
  if (mitHinweis >= 2) return true
  const geoCount = segmente.filter((s) => istGeoName(s.name)).length
  return geoCount < Math.ceil(segmente.length / 2)
}

function inferArt(segmente: SecSegmentRoh[]): 'produkt' | 'geo' {
  if (segmente.some((s) => istGeoartigesOperatingSegment(s.name) || /operated markets|market intelligence|ratings|life sciences|analytical instruments|walmart|google /i.test(s.name))) {
    return 'produkt'
  }
  const geoCount = segmente.filter((s) => istGeoName(s.name)).length
  return geoCount >= Math.ceil(segmente.length / 2) ? 'geo' : 'produkt'
}

export function istPlausiblerSegmentname(name: string): boolean {
  const n = bereinigeLabel(name)
  if (/^product$/i.test(n) || /^services?$/i.test(n)) return true
  if (istIncomeStatementZeile(n) || FINANCIAL_LINE_ITEM.test(n) || AUFWAND_ZEILE.test(n)) return false
  if (
    /adjusted ebitda|segment expenses|other segment items|locomotive fuel|salaries|variable costs|fixed costs|gross margin|expenditures for|corporate and support|revenue from operations|operating \[|administrative \[|other subsidiary|intersegment revenues|consolidated revenues|selling, general|operating supplies|general supplies|operating taxes|insurance and claims|communications and utilities|purchased transportation|miscellaneous expenses|deferral of|recognition of|unearned revenue|beginning balance|ending balance|residential revenues|commercial revenues|termite and ancillary/i.test(
      n,
    )
  ) {
    return false
  }
  if (/^fiscal\s+\d{4}$/i.test(n)) return false
  if (/^\w{3,9}\s+\d{1,2},/i.test(n)) return false
  if (/^millions|^may \d|^\(millions/i.test(n)) return false
  if (/^primary$|^secondary$|^total company$|^all other$/i.test(n)) return false
  return true
}

function korrigiereSkalierung(segmente: SecSegmentRoh[]): SecSegmentRoh[] {
  const werte = segmente.map((s) => s.umsatzMio ?? 0).filter((v) => v > 0)
  if (werte.length === 0) return segmente
  const median = [...werte].sort((a, b) => a - b)[Math.floor(werte.length / 2)] ?? 0
  if (median > 200_000) {
    const summeRoh = werte.reduce((a, b) => a + b, 0)
    // Nur skalieren wenn Werte wie Tausender aussehen (nach /1000 noch sinnvolle Konzernsumme).
    if (summeRoh / 1000 >= 3000) {
      for (const s of segmente) {
        if (s.umsatzMio != null) s.umsatzMio = Math.round(s.umsatzMio / 1000)
      }
    }
  }
  return segmente
}

/** Entfernt Prozent-Spalten, die fälschlich als Umsatz (z. B. „104“ statt 10.400) gelesen wurden. */
function filterProzentArtefakte(segmente: SecSegmentRoh[]): SecSegmentRoh[] {
  if (segmente.length < 2) return segmente
  const werte = segmente.map((s) => s.umsatzMio ?? 0).filter((v) => v > 0)
  const max = Math.max(...werte)
  if (max < 200) return segmente
  return segmente.filter((s) => {
    const v = s.umsatzMio ?? 0
    if (v >= max * 0.015) return true
    if (v >= 500) return true
    return false
  })
}

export function validiereSegmente(segmente: SecSegmentRoh[]): SecSegmentRoh[] {
  const skaliert = korrigiereSkalierung([...segmente])
  const plausibel = skaliert.filter((s) => istPlausiblerSegmentname(s.name))
  if (plausibel.filter((s) => istIncomeStatementZeile(s.name)).length >= 2) return []

  const mitUmsatz = filterProzentArtefakte(plausibel.filter((s) => (s.umsatzMio ?? 0) >= 30))
  if (mitUmsatz.length < 2) return []

  const nameKeys = mitUmsatz.map((s) => s.name.toLowerCase())
  if (new Set(nameKeys).size !== nameKeys.length) return []

  const summe = mitUmsatz.reduce((s, e) => s + (e.umsatzMio ?? 0), 0)
  const minSumme = mitUmsatz.length === 2 && mitUmsatz.every((s) => istGeoName(s.name)) ? 1500 : 3000
  if (summe < minSumme) return []

  for (const s of mitUmsatz) {
    s.anteilPct = Math.round(((s.umsatzMio ?? 0) / summe) * 1000) / 10
  }

  if (mitUmsatz.length > 10) return []

  const anteile = mitUmsatz.map((s) => s.anteilPct ?? 0)
  if (anteile.some((a) => a > 98.5)) return []
  if (anteile.filter((a) => a < 0.5).length > 1) return []

  const summeAnteil = anteile.reduce((a, b) => a + b, 0)
  if (summeAnteil < 75 || summeAnteil > 125) return []

  return mitUmsatz
}

/** Detail-Tabellen: mehr Zeilen, kleinere Mindestsummen (Disaggregation, Sub-Produkte). */
function approxGleich(a: number, b: number, tol = 0.03): boolean {
  if (a <= 0 || b <= 0) return false
  return Math.abs(a - b) / Math.max(a, b) <= tol
}

/** Entfernt Zwischen- und Gesamtsummen (z. B. „Google advertising“, „… total“). */
function entferneSubtotalZeilen(segmente: SecSegmentRoh[]): SecSegmentRoh[] {
  if (segmente.length < 3) return segmente
  const toRemove = new Set<string>()

  for (const s of segmente) {
    const sv = s.umsatzMio ?? 0
    if (sv <= 0) continue
    const n = s.name.toLowerCase()
    const kandidat =
      /\btotal\b|subtotal|gesamt|\badvertising$/i.test(n) || /services total$/i.test(n)
    if (!kandidat) continue
    const others = segmente.filter((o) => o.name !== s.name)
    for (let mask = 1; mask < 1 << others.length; mask++) {
      if (mask === (1 << others.length) - 1) continue
      const subset = others.filter((_, i) => mask & (1 << i))
      if (subset.length < 2) continue
      const sum = subset.reduce((a, b) => a + (b.umsatzMio ?? 0), 0)
      if (approxGleich(sum, sv)) {
        toRemove.add(s.name)
        break
      }
    }
  }

  for (const s of segmente) {
    const n = s.name.toLowerCase()
    if (/\btotal\b|subtotal|gesamt/i.test(n)) toRemove.add(s.name)
    if (/\badvertising$/i.test(n) && !/search|youtube|network/i.test(n)) toRemove.add(s.name)
    if (/services total$/i.test(n)) toRemove.add(s.name)
  }

  const rest = segmente.filter((s) => !toRemove.has(s.name))
  return rest.length >= 2 ? rest : segmente
}

export function validiereSegmenteDetail(segmente: SecSegmentRoh[]): SecSegmentRoh[] {
  const skaliert = korrigiereSkalierung([...segmente])
  const plausibel = skaliert.filter((s) => istPlausiblerSegmentname(s.name))
  const mitUmsatz = plausibel.filter((s) => (s.umsatzMio ?? 0) >= 5)
  if (mitUmsatz.length < 2) return []

  const ohneSubtotals = entferneSubtotalZeilen(mitUmsatz)

  const merged = new Map<string, SecSegmentRoh>()
  for (const s of ohneSubtotals) {
    const key = s.name.toLowerCase()
    const hit = merged.get(key)
    if (!hit || (s.umsatzMio ?? 0) > (hit.umsatzMio ?? 0)) merged.set(key, s)
  }
  const dedup = [...merged.values()]
  if (dedup.length < 2) return []

  const summe = dedup.reduce((s, e) => s + (e.umsatzMio ?? 0), 0)
  if (summe < 200) return []

  for (const s of dedup) {
    s.anteilPct = Math.round(((s.umsatzMio ?? 0) / summe) * 1000) / 10
  }

  if (dedup.length > 25) return []

  const anteile = dedup.map((s) => s.anteilPct ?? 0)
  const summeAnteil = anteile.reduce((a, b) => a + b, 0)
  if (summeAnteil < 85 || summeAnteil > 115) return []

  return dedup
}

function scoreSegmente(segmente: SecSegmentRoh[], art: 'produkt' | 'geo'): number {
  if (segmente.length < 2) return 0
  const summeAnteil = segmente.reduce((s, e) => s + (e.anteilPct ?? 0), 0)
  let score = segmente.length * 20
  if (art === 'produkt') score += 10
  if (summeAnteil >= 90 && summeAnteil <= 110) score += 25
  if (segmente.every((s) => (s.umsatzMio ?? 0) >= 100)) score += 10
  const junk = segmente.filter((s) => JUNK_LABEL.test(s.name) || BALANCE_JUNK.test(s.name)).length
  score -= junk * 50
  return score
}

const HTML_SECTION_RES = [
  /RevenueFromExternalCustomersByGeographicAreasTableTextBlock/i,
  /ScheduleOfRevenuesFromExternalCustomersAndLongLivedAssetsByGeographicalAreasTableTextBlock/i,
  /ScheduleOfSegmentReportingInformationBySegmentTextBlock/i,
  /revenue[s]?,?\s+classified by the major geographic/i,
  /net revenue[s]? by geographic(?:al)?(?:\s+area|\s+region)?/i,
  /revenues? by geographic(?:al)?(?:\s+area|\s+region)?/i,
  /revenue by geographic/i,
  /segment revenue, cost of revenue/i,
  /net revenues? by region/i,
]

function extrahiereHtmlHeuristik(html: string): SegmentExtraktionErgebnis {
  let fensterStart = -1
  for (const re of HTML_SECTION_RES) {
    const m = re.exec(html)
    if (m && (fensterStart < 0 || m.index < fensterStart)) fensterStart = m.index
  }
  if (fensterStart < 0) return { segmente: [], art: null, quelle: null }

  const fenster = html.slice(fensterStart, fensterStart + 45_000)
  const geoModus = /geographic|GeographicalAreas|country|region/i.test(fenster.slice(0, 1500))

  const spalten = validiereSegmente(parseSpaltenOrientierteSegmente(fenster))
  const zeilen = validiereSegmente(dedupliziereSegmente(parseOperatingSegmente(fenster)))
  const operating = spalten.length >= 2 ? spalten : zeilen
  const geo = validiereSegmente(parseGeoSegmente(fenster, geoModus))

  if (operating.length >= 2 && sindKlareProduktsegmente(operating)) {
    return { segmente: operating, art: 'produkt', quelle: 'html_heuristik' }
  }
  if (operating.length >= 2 && scoreSegmente(operating, 'produkt') >= scoreSegmente(geo, 'geo')) {
    return { segmente: operating, art: inferArt(operating), quelle: 'html_heuristik' }
  }
  if (geo.length >= 2) return { segmente: geo, art: 'geo', quelle: 'html_heuristik' }
  if (operating.length >= 2) return { segmente: operating, art: inferArt(operating), quelle: 'html_heuristik' }
  return { segmente: [], art: null, quelle: null }
}

/** Haupt-Einstieg: XBRL-TextBlocks bevorzugen, HTML-Heuristik als Fallback. */
export function extrahiereSegmenteAus10kHtml(html: string): SegmentExtraktionErgebnis {
  const operatingBlock = extrahiereIxbrlTextBlock(html, XBRL_OPERATING_TAG)
  const geoBlock = extrahiereErstenGeoBlock(html)
  const geoRaw = parseGeoSegmente(geoBlock, true)

  const spalten = validiereSegmente(parseSpaltenOrientierteSegmente(operatingBlock))
  const zeilen = validiereSegmente(dedupliziereSegmente(parseOperatingSegmente(operatingBlock)))
  let operating = spalten.length >= 2 ? spalten : zeilen
  let geo = validiereSegmente(geoRaw)

  if (operating.length < 2) {
    const fallbackBlock = extrahiereIxbrlTextBlock(html, XBRL_OPERATING_FALLBACK)
    if (fallbackBlock.length > 500) {
      const spaltenFb = validiereSegmente(parseSpaltenOrientierteSegmente(fallbackBlock))
      const zeilenFb = validiereSegmente(dedupliziereSegmente(parseOperatingSegmente(fallbackBlock)))
      const fbOp = spaltenFb.length >= 2 ? spaltenFb : zeilenFb
      if (fbOp.length > operating.length) operating = fbOp
      if (geo.length < 2) {
        const geoFromFallback = validiereSegmente(parseGeoSegmente(fallbackBlock, false))
        if (geoFromFallback.length > geo.length) geo = geoFromFallback
      }
    }
  }

  if (geo.length < 2 && geoBlock) {
    const geoHtml = validiereSegmente(parseGeoSegmente(geoBlock, false))
    if (geoHtml.length > geo.length) geo = geoHtml
  }

  const opScore = scoreSegmente(operating, 'produkt')
  const geoScore = scoreSegmente(geo, 'geo')

  if (operating.length >= 2 && sindKlareProduktsegmente(operating)) {
    return { segmente: operating, art: 'produkt', quelle: 'xbrl_operating' }
  }

  const operatingIstProdukt = operating.length >= 2 && operating.some((s) => !istGeoName(s.name))

  if (operatingIstProdukt && operating.length >= 2 && opScore >= geoScore - 5) {
    return { segmente: operating, art: 'produkt', quelle: 'xbrl_operating' }
  }
  if (geo.length >= 2 && geoScore >= opScore) {
    return { segmente: geo, art: 'geo', quelle: 'xbrl_geo' }
  }
  if (operating.length >= 2) {
    const art = inferArt(operating)
    return { segmente: operating, art, quelle: 'xbrl_operating' }
  }
  if (geo.length >= 2) {
    return { segmente: geo, art: 'geo', quelle: 'xbrl_geo' }
  }

  return extrahiereHtmlHeuristik(html)
}

export function segmentHinweisFuerErgebnis(ergebnis: SegmentExtraktionErgebnis): string | null {
  if (ergebnis.segmente.length === 0) {
    return 'Keine Geo-/Produktsegmente automatisch erkannt (10-K prüfen).'
  }
  if (ergebnis.art === 'geo') return 'Geografische Umsatzverteilung (10-K).'
  if (ergebnis.art === 'produkt') return 'Produkt-/Geschäftssegmente (10-K).'
  return null
}

// ---------------------------------------------------------------------------
// Dual-Extraktion (Geo + Produkt parallel) & Mehrjahres-Historie
// ---------------------------------------------------------------------------

export type SecSegmentJahrEintrag = {
  jahr: number
  segmente: SecSegmentRoh[]
}

export type SecSegmentMehrjahresErgebnis = {
  art: 'produkt' | 'geo'
  jahre: SecSegmentJahrEintrag[]
  quelle: SegmentExtraktionErgebnis['quelle']
}

function extrahiereOperatingSegmente(html: string): SecSegmentRoh[] {
  let operatingBlock = extrahiereIxbrlTextBlock(html, XBRL_OPERATING_TAG)
  let spalten = validiereSegmente(parseSpaltenOrientierteSegmente(operatingBlock))
  let zeilen = validiereSegmente(dedupliziereSegmente(parseOperatingSegmente(operatingBlock)))
  let operating = spalten.length >= 2 ? spalten : zeilen

  if (operating.length < 2) {
    const fallbackBlock = extrahiereIxbrlTextBlock(html, XBRL_OPERATING_FALLBACK)
    if (fallbackBlock.length > 500) {
      const spaltenFb = validiereSegmente(parseSpaltenOrientierteSegmente(fallbackBlock))
      const zeilenFb = validiereSegmente(dedupliziereSegmente(parseOperatingSegmente(fallbackBlock)))
      const fbOp = spaltenFb.length >= 2 ? spaltenFb : zeilenFb
      if (fbOp.length > operating.length) {
        operating = fbOp
        operatingBlock = fallbackBlock
      }
    }
  }

  if (operating.length >= 2 && sindKlareProduktsegmente(operating)) return operating
  if (operating.length >= 2 && operating.some((s) => !istGeoName(s.name))) return operating
  return operating
}

function extrahiereGeoSegmenteListe(html: string): SecSegmentRoh[] {
  const geoBlock = extrahiereErstenGeoBlock(html)
  let geo = validiereSegmente(parseGeoSegmente(geoBlock, true))
  if (geo.length < 2 && geoBlock) {
    const geoHtml = validiereSegmente(parseGeoSegmente(geoBlock, false))
    if (geoHtml.length > geo.length) geo = geoHtml
  }
  if (geo.length < 2) {
    const operatingBlock = extrahiereIxbrlTextBlock(html, XBRL_OPERATING_TAG)
    const geoFromOp = validiereSegmente(parseGeoSegmente(operatingBlock, false))
    if (geoFromOp.length > geo.length) geo = geoFromOp
  }
  return geo
}

/** Geo- und Produktsegmente getrennt — nicht nur die „beste“ Variante. */
export function extrahiereBeideSegmentartenAus10kHtml(html: string): {
  produkt: SegmentExtraktionErgebnis
  geo: SegmentExtraktionErgebnis
} {
  let operating = extrahiereOperatingSegmente(html)
  let geoListe = extrahiereGeoSegmenteListe(html)

  if (operating.length < 2 || geoListe.length < 2) {
    const heur = extrahiereHtmlHeuristik(html)
    if (heur.segmente.length >= 2) {
      if (heur.art === 'geo' && geoListe.length < 2) geoListe = heur.segmente
      else if (heur.art === 'produkt' && operating.length < 2) operating = heur.segmente
      else if (geoListe.length < 2 && heur.segmente.every((s) => istGeoName(s.name))) geoListe = heur.segmente
      else if (operating.length < 2) operating = heur.segmente
    }
  }

  if (geoListe.length < 2 && operating.length >= 2 && operating.every((s) => istGeoName(s.name))) {
    geoListe = operating
    operating = []
  }

  const produkt: SegmentExtraktionErgebnis = {
    segmente: operating,
    art: operating.length >= 2 ? 'produkt' : null,
    quelle: operating.length >= 2 ? 'xbrl_operating' : null,
  }
  const geo: SegmentExtraktionErgebnis = {
    segmente: geoListe,
    art: geoListe.length >= 2 ? 'geo' : null,
    quelle: geoListe.length >= 2 ? 'xbrl_geo' : null,
  }
  return { produkt, geo }
}

function parseJahrAusZelle(z: string): number | null {
  const n = bereinigeLabel(z)
  const m4 = n.match(/^(20\d{2})$/)
  if (m4) return parseInt(m4[1]!, 10)
  const mLong = n.match(
    /(?:year ended|years ended|fiscal year|(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2})[^0-9]{0,40}(20\d{2})/i,
  )
  if (mLong) return parseInt(mLong[1]!, 10)
  return null
}

function jahresSpaltenAusZeile(zellen: string[]): { jahr: number; idx: number }[] {
  const out: { jahr: number; idx: number }[] = []
  for (let i = 0; i < zellen.length; i++) {
    const jahr = parseJahrAusZelle(zellen[i] ?? '')
    if (jahr != null && jahr >= 2010 && jahr <= 2030) out.push({ jahr, idx: i })
  }
  return out
}

function betragAnIndex(z: TabellenZeile, idx: number): number | null {
  const zelle = z.zellen[idx]
  if (zelle != null) {
    const s = bereinigeLabel(zelle).replace(/[$,()]/g, '').trim()
    if (/^\d+(?:\.\d+)?$/.test(s)) {
      const n = Number(s)
      if (n > 0) return betragZuMio(n)
    }
  }
  if (z.betraege.length > 0) {
    const offset = Math.max(0, idx - 1)
    if (z.betraege[offset] != null) return betragZuMio(z.betraege[offset]!)
  }
  return null
}

export function anteileBerechnen(segmente: SecSegmentRoh[]): SecSegmentRoh[] {
  const summe = segmente.reduce((s, e) => s + (e.umsatzMio ?? 0), 0)
  if (summe <= 0) return segmente
  for (const s of segmente) {
    s.anteilPct = Math.round(((s.umsatzMio ?? 0) / summe) * 1000) / 10
  }
  return segmente
}

function mergeJahrEintraege(
  primaer: SecSegmentJahrEintrag[],
  sekundaer: SecSegmentJahrEintrag[],
): SecSegmentJahrEintrag[] {
  const map = new Map<number, Map<string, SecSegmentRoh>>()

  const add = (jahr: number, segmente: SecSegmentRoh[]) => {
    let m = map.get(jahr)
    if (!m) {
      m = new Map()
      map.set(jahr, m)
    }
    for (const s of kanonisereSegmentNamen(segmente)) {
      const key = s.name.toLowerCase()
      const prev = m.get(key)
      m.set(key, {
        name: s.name,
        umsatzMio: s.umsatzMio ?? prev?.umsatzMio ?? null,
        anteilPct: s.anteilPct ?? prev?.anteilPct ?? null,
        operatingIncomeMio: s.operatingIncomeMio ?? prev?.operatingIncomeMio ?? null,
        margePct: s.margePct ?? prev?.margePct ?? null,
      })
    }
  }

  for (const j of primaer) add(j.jahr, j.segmente)
  for (const j of sekundaer) add(j.jahr, j.segmente)

  return [...map.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([jahr, segMap]) => ({ jahr, segmente: [...segMap.values()] }))
}

/** Spalten = Segmente, Zeilen = Jahre (UNH, viele Healthcare-/Finanz-Titel). */
function parseSpaltenOrientierteMehrjahresSegmente(
  fragment: string,
  validiere: (seg: SecSegmentRoh[]) => SecSegmentRoh[],
): SecSegmentJahrEintrag[] {
  if (!fragment || fragment.length < 200) return []
  const byJahr = new Map<number, SecSegmentRoh[]>()
  let pendingJahr: number | null = null

  const speichere = (jahr: number | null, roh: SecSegmentRoh[]) => {
    const val = validiere(roh)
    if (val.length < 2) return
    const j = jahr != null && jahr >= 2010 && jahr <= 2030 ? jahr : pendingJahr
    if (j == null || j < 2010) return
    byJahr.set(j, anteileBerechnen(val))
    pendingJahr = null
  }

  const verarbeiteTeil = (teil: string) => {
    const zeilen = parseTabellenZeilen(teil)
    let spaltenNamen: string[] = []

    for (const z of zeilen) {
      const sichtbar = nichtLeereZellen(z.zellen).map(bereinigeLabel)
      const label0 = sichtbar[0] ?? ''

      const potNamen = sichtbar.filter(
        (c) =>
          c &&
          istSegmentLabel(c, false, false) &&
          !FINANCIAL_LINE_ITEM.test(c) &&
          !AUFWAND_ZEILE.test(c) &&
          !istIncomeStatementZeile(c),
      )
      if (potNamen.length >= 2 && z.betraege.length < potNamen.length) {
        if (potNamen.length >= spaltenNamen.length) spaltenNamen = potNamen
        continue
      }

      const jahrInZeile = label0.match(/^(20\d{2})$/)?.[1] ?? sichtbar.join(' ').match(/\b(20\d{2})\b/)?.[1]
      if (jahrInZeile && /^(20\d{2})$/.test(label0)) {
        pendingJahr = parseInt(jahrInZeile, 10)
        continue
      }

      if (/unaffiliated|affiliated/i.test(label0)) continue

      if (
        spaltenNamen.length >= 2 &&
        /^(total revenues?|revenues?|revenue from external customers|revenues from external customers|sales(\s*\([a-z]\))?|net sales)$/i.test(
          label0,
        )
      ) {
        const zahlenAusText = sichtbar
          .slice(1)
          .map((c) => Number(c.replace(/[^\d.]/g, '')))
          .filter((n) => Number.isFinite(n) && n > 0)
        const zahlen =
          zahlenAusText.length >= spaltenNamen.length
            ? zahlenAusText
            : z.betraege.length >= spaltenNamen.length
              ? z.betraege
              : zahlenAusText
        if (zahlen.length < spaltenNamen.length) continue
        const namen = spaltenNamen.filter((n) => !/^\(?\s*millions of dollars\s*\)?$/i.test(n))
        const roh = bereinigeSpaltenSegmente(
          namen.map((name, i) => ({
            name,
            umsatzMio: betragZuMio(zahlen[i]!),
            anteilPct: null,
          })),
        )
        const jahr =
          pendingJahr ??
          (jahrInZeile ? parseInt(jahrInZeile, 10) : null) ??
          (parseInt(teil.match(/\b(20\d{2})\b/)?.[1] ?? '0', 10) || null)
        speichere(jahr && jahr >= 2010 ? jahr : null, roh)
      }
    }
  }

  // Gesamter Block
  verarbeiteTeil(fragment)

  // Unter-Tabellen (UNH: mehrere Jahresblöcke in einem TextBlock)
  const teile = fragment.split(/(?=<table\b)/i)
  if (teile.length > 1) {
    for (const teil of teile) {
      if (teil.length < 300) continue
      verarbeiteTeil(teil)
    }
  }

  return [...byJahr.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([jahr, segmente]) => ({ jahr, segmente }))
}

/**
 * LIN & ähnliche: pro Jahr eigene Tabelle ("Year Ended December 31, 20XX"),
 * Spalten = Regionen, Zeilen = Produktlinien.
 */
function parseJahresSektionsMatrix(
  fragment: string,
  modus: 'geo' | 'produkt',
  validiere: (seg: SecSegmentRoh[]) => SecSegmentRoh[],
): SecSegmentJahrEintrag[] {
  if (!/Year Ended/i.test(fragment) || !/Americas/i.test(fragment)) return []

  const byJahr = new Map<number, Map<string, number>>()
  const teile = fragment.split(/(?=Year Ended)/gi)

  for (const teil of teile) {
    const jahrM = teil.match(/Year Ended[\s\S]{0,200}?(20\d{2})/i)
    if (!jahrM) continue
    const jahr = parseInt(jahrM[1]!, 10)
    if (jahr < 2010 || jahr > 2030) continue

    const zeilen = parseTabellenZeilen(teil)
    let geoSpalten: { name: string; idx: number }[] = []

    for (const z of zeilen) {
      const sichtbar = nichtLeereZellen(z.zellen).map(bereinigeLabel)
      if (sichtbar.length < 2) continue

      const geoInZeile = sichtbar
        .map((c, idx) => ({ name: c, idx }))
        .filter(({ name }) => istGeoName(name) && !/^total$/i.test(name))
      if (geoInZeile.length >= 2) {
        geoSpalten = geoInZeile
        continue
      }

      const label0 = sichtbar[0] ?? ''
      if (!label0 || /^sales$/i.test(label0) || SKIP_LABELS.test(label0) || istIncomeStatementZeile(label0)) {
        continue
      }
      if (/^total\s*%?$/i.test(label0) || /^%$/i.test(label0)) continue
      if (!/[a-zA-Z]{3,}/.test(label0)) continue

      if (modus === 'geo' && geoSpalten.length >= 2) {
        if (!byJahr.has(jahr)) byJahr.set(jahr, new Map())
        const map = byJahr.get(jahr)!
        for (const { name, idx } of geoSpalten) {
          const mio = betragAnSpaltenIdx(z, idx, 500)
          if (mio == null || mio < 5) continue
          map.set(name, (map.get(name) ?? 0) + mio)
        }
        continue
      }

      if (modus === 'produkt') {
        const totalIdx = sichtbar.findIndex((c) => /^total$/i.test(c))
        let totalMio = totalIdx >= 0 ? betragAnSpaltenIdx(z, totalIdx, 500) : null
        if (totalMio == null) {
          const gross = grossWerteAusZeile(z, 500)
          if (gross.length >= 1) totalMio = betragZuMio(gross[gross.length - 1]!)
        }
        if (totalMio == null || totalMio < 5) continue
        if (!byJahr.has(jahr)) byJahr.set(jahr, new Map())
        byJahr.get(jahr)!.set(label0, totalMio)
      }
    }
  }

  const jahre: SecSegmentJahrEintrag[] = []
  for (const [jahr, map] of [...byJahr.entries()].sort((a, b) => a[0] - b[0])) {
    const roh: SecSegmentRoh[] = [...map.entries()].map(([name, umsatzMio]) => ({
      name,
      umsatzMio,
      anteilPct: null,
    }))
    const val = validiere(roh)
    if (val.length >= 2) jahre.push({ jahr, segmente: anteileBerechnen(val) })
  }
  return jahre
}

/** Mehrjahres-Tabelle: Zeilen = Segmente, Spalten = Geschäftsjahre. */
export function parseMehrjahresSegmente(
  fragment: string,
  art: 'produkt' | 'geo',
  metrik: 'umsatz' | 'assets' = 'umsatz',
): SecSegmentJahrEintrag[] {
  return parseMehrjahresSegmenteIntern(fragment, art, metrik, validiereSegmente)
}

/** Detail-Aufschlüsselung (Disaggregation, Sub-Produkte) — lockere Validierung. */
export function parseMehrjahresSegmenteDetail(
  fragment: string,
  art: 'produkt' | 'geo',
  metrik: 'umsatz' | 'assets' = 'umsatz',
): SecSegmentJahrEintrag[] {
  return parseMehrjahresSegmenteIntern(fragment, art, metrik, validiereSegmenteDetail)
}

function parseMehrjahresSegmenteIntern(
  fragment: string,
  art: 'produkt' | 'geo',
  metrik: 'umsatz' | 'assets',
  validiere: (seg: SecSegmentRoh[]) => SecSegmentRoh[],
): SecSegmentJahrEintrag[] {
  const jahreRowOrientiert = parseMehrjahresSegmenteInternRowOnly(fragment, art, metrik, validiere)
  const jahreSpaltenOrientiert = parseSpaltenOrientierteMehrjahresSegmente(fragment, validiere)
  let merged = mergeJahrEintraege(jahreRowOrientiert, jahreSpaltenOrientiert)
  if (merged.length < 2 && /Year Ended/i.test(fragment) && /Americas/i.test(fragment)) {
    const matrixModus = art === 'geo' ? 'geo' : 'produkt'
    const matrix = parseJahresSektionsMatrix(fragment, matrixModus, validiere)
    merged = mergeJahrEintraege(merged, matrix)
    if (merged.length < 2 && matrixModus === 'produkt') {
      const geoMatrix = parseJahresSektionsMatrix(fragment, 'geo', validiere)
      merged = mergeJahrEintraege(merged, geoMatrix)
    }
  }
  return merged
}

function parseMehrjahresSegmenteInternRowOnly(
  fragment: string,
  art: 'produkt' | 'geo',
  metrik: 'umsatz' | 'assets',
  validiere: (seg: SecSegmentRoh[]) => SecSegmentRoh[],
): SecSegmentJahrEintrag[] {
  if (!fragment || fragment.length < 200) return []
  const zeilen = parseTabellenZeilen(fragment)
  const geoModus = art === 'geo'
  const ausXbrlGeo = /GeographicalAreas|geographic/i.test(fragment.slice(0, 2000))

  let headerIdx = -1
  let jahrSpalten: { jahr: number; idx: number }[] = []

  for (let i = 0; i < Math.min(zeilen.length, 30); i++) {
    const spalten = jahresSpaltenAusZeile(zeilen[i]!.zellen)
    if (spalten.length >= 2) {
      headerIdx = i
      jahrSpalten = spalten
      break
    }
  }

  if (headerIdx < 0 || jahrSpalten.length < 2) return []

  const byJahr = new Map<number, Map<string, number>>()
  for (const { jahr } of jahrSpalten) byJahr.set(jahr, new Map())

  let inRevenueSection = metrik === 'assets' ? false : geoModus || !/LongLivedAssetsByGeographical/i.test(fragment)
  if (metrik === 'assets') inRevenueSection = false
  let aktivesSegment: string | null = null

  for (let i = headerIdx + 1; i < zeilen.length; i++) {
    const z = zeilen[i]!
    const sichtbar = nichtLeereZellen(z.zellen)
    const label0 = bereinigeLabel(sichtbar[0] ?? '')
    const labelJoin = sichtbar.join(' ').toLowerCase()

    if (/long[- ]lived assets|property and equipment/i.test(labelJoin)) {
      inRevenueSection = metrik !== 'assets'
      if (metrik === 'assets') inRevenueSection = true
      aktivesSegment = null
      if (/total assets/i.test(labelJoin) && metrik === 'assets') continue
      continue
    }
    if (/total assets/i.test(labelJoin) && metrik === 'assets') {
      aktivesSegment = null
      continue
    }
    if (/net revenue|revenue[s]? by|revenues? by/i.test(labelJoin) && !/cost of revenue/i.test(labelJoin)) {
      inRevenueSection = true
    }
    if (!inRevenueSection && geoModus && metrik === 'umsatz') continue
    if (metrik === 'assets' && !/asset|property|equipment|long[- ]lived/i.test(labelJoin) && !istGeoName(label0)) {
      if (!inRevenueSection) continue
    }

    if (!label0 || GEO_SKIP.test(label0)) continue

    // MSFT-Stil: Segment-Kopfzeile, Revenue in Folgezeile
    if (
      /^revenues?$/i.test(label0) &&
      aktivesSegment &&
      inRevenueSection &&
      !istIncomeStatementZeile(aktivesSegment)
    ) {
      jahrSpalten.forEach(({ jahr }, yearIdx) => {
        const mio = betragAnJahrIndex(z, jahrSpalten, yearIdx, metrik)
        if (mio == null || mio < 5) return
        byJahr.get(jahr)!.set(aktivesSegment!, mio)
      })
      aktivesSegment = null
      continue
    }

    if (istIncomeStatementZeile(label0)) continue
    if (/^total\b/i.test(label0) && !istGeoName(label0)) continue
    if (!istSegmentLabel(label0, geoModus, ausXbrlGeo)) continue
    if (FINANCIAL_LINE_ITEM.test(label0) || AUFWAND_ZEILE.test(label0)) continue

    const hatBetragInZeile = jahrSpalten.some((_, yearIdx) => {
      const mio = betragAnJahrIndex(z, jahrSpalten, yearIdx, metrik)
      return mio != null && mio >= 5
    })

    if (!hatBetragInZeile) {
      const hatRevenueChild = zeilen.slice(i + 1, i + 6).some((nz) =>
        /^revenues?$/i.test(bereinigeLabel(nichtLeereZellen(nz.zellen)[0] ?? '')),
      )
      if (hatRevenueChild) {
        aktivesSegment = label0
        continue
      }
    }

    jahrSpalten.forEach(({ jahr }, yearIdx) => {
      const mio = betragAnJahrIndex(z, jahrSpalten, yearIdx, metrik)
      if (mio == null || mio < 5) return
      byJahr.get(jahr)!.set(label0, mio)
    })
    aktivesSegment = null
  }

  const jahre: SecSegmentJahrEintrag[] = []
  for (const [jahr, map] of [...byJahr.entries()].sort((a, b) => a[0] - b[0])) {
    const roh: SecSegmentRoh[] = [...map.entries()].map(([name, umsatzMio]) => ({
      name,
      umsatzMio,
      anteilPct: null,
    }))
    const val = validiere(roh)
    if (val.length >= 2) {
      jahre.push({ jahr, segmente: anteileBerechnen(val) })
    }
  }

  return jahre
}

function mehrjahresAusBloecke(html: string): {
  produkt: SecSegmentJahrEintrag[]
  geo: SecSegmentJahrEintrag[]
} {
  const operatingBlock = extrahiereIxbrlTextBlock(html, XBRL_OPERATING_TAG)
  const fallbackBlock = extrahiereIxbrlTextBlock(html, XBRL_OPERATING_FALLBACK)
  const geoBlock = extrahiereErstenGeoBlock(html)
  const geoKombiBlock = extrahiereIxbrlTextBlock(
    html,
    'ScheduleOfRevenuesFromExternalCustomersAndLongLivedAssetsByGeographicalAreasTableTextBlock',
  )
  let disaggBlock = extrahiereIxbrlTextBlock(html, 'DisaggregationOfRevenueTableTextBlock')
  if (disaggBlock.length < 200) {
    const alt = extrahiereIxbrlTextBlock(html, 'DisaggregatedRevenueTableTextBlock')
    if (alt.length > disaggBlock.length) disaggBlock = alt
  }

  let produkt = parseMehrjahresSegmente(operatingBlock, 'produkt')
  if (produkt.length < 2 && fallbackBlock.length > 500) {
    const fb = parseMehrjahresSegmente(fallbackBlock, 'produkt')
    if (fb.length > produkt.length) produkt = fb
  }
  if (produkt.length < 2 && disaggBlock.length > 200) {
    const det = parseMehrjahresSegmenteDetail(disaggBlock, 'produkt')
    const prodOnly = det
      .map((j) => ({
        jahr: j.jahr,
        segmente: anteileBerechnen(j.segmente.filter((s) => segmentGehoertZuProdukt(s.name))),
      }))
      .filter((j) => j.segmente.length >= 2)
    if (prodOnly.length > produkt.length) produkt = prodOnly
  }

  let geo = parseMehrjahresSegmente(geoBlock, 'geo')
  if (geo.length < 2 && geoKombiBlock.length > 200) {
    const gk = parseMehrjahresSegmente(geoKombiBlock, 'geo')
    if (gk.length > geo.length) geo = gk
  }
  if (geo.length < 2 && disaggBlock.length > 200) {
    const det = parseMehrjahresSegmenteDetail(disaggBlock, 'geo')
    const geoOnly = det
      .map((j) => ({
        jahr: j.jahr,
        segmente: anteileBerechnen(j.segmente.filter((s) => segmentGehoertZuGeo(s.name))),
      }))
      .filter((j) => j.segmente.length >= 2)
    if (geoOnly.length > geo.length) geo = geoOnly
  }
  if (geo.length < 2) {
    const geoOp = parseMehrjahresSegmente(operatingBlock, 'geo')
      .map((j) => ({
        jahr: j.jahr,
        segmente: anteileBerechnen(j.segmente.filter((s) => segmentGehoertZuGeo(s.name))),
      }))
      .filter((j) => j.segmente.length >= 2)
    if (geoOp.length > geo.length) geo = geoOp
  }
  if (geo.length < 2 && fallbackBlock.length > 500) {
    const geoFb = parseMehrjahresSegmente(fallbackBlock, 'geo')
      .map((j) => ({
        jahr: j.jahr,
        segmente: anteileBerechnen(j.segmente.filter((s) => segmentGehoertZuGeo(s.name))),
      }))
      .filter((j) => j.segmente.length >= 2)
    if (geoFb.length > geo.length) geo = geoFb
  }

  return { produkt, geo }
}

/** Disaggregation-Tabelle in Produkt- vs. Geo-Zeilen splitten (MA, V …). */
export function teileUmsatzDetailInProduktUndGeo(jahre: SecSegmentJahrEintrag[]): {
  produkt: SecSegmentJahrEintrag[]
  geo: SecSegmentJahrEintrag[]
} {
  const produkt: SecSegmentJahrEintrag[] = []
  const geo: SecSegmentJahrEintrag[] = []
  for (const j of jahre) {
    const geoSeg = j.segmente.filter((s) => segmentGehoertZuGeo(s.name))
    const prodSeg = j.segmente.filter((s) => segmentGehoertZuProdukt(s.name))
    if (geoSeg.length >= 2) geo.push({ jahr: j.jahr, segmente: anteileBerechnen(geoSeg) })
    if (prodSeg.length >= 2) produkt.push({ jahr: j.jahr, segmente: anteileBerechnen(prodSeg) })
  }
  return { produkt, geo }
}

/** Mehrjahres-Segmenthistorie aus einem 10-K (typ. 3 Spalten). */
export function extrahiereSegmentHistorieAus10kHtml(html: string): {
  produkt: SecSegmentMehrjahresErgebnis | null
  geo: SecSegmentMehrjahresErgebnis | null
} {
  const { produkt, geo } = mehrjahresAusBloecke(html)
  return {
    produkt:
      produkt.length >= 2
        ? { art: 'produkt', jahre: produkt, quelle: 'xbrl_operating' }
        : null,
    geo: geo.length >= 2 ? { art: 'geo', jahre: geo, quelle: 'xbrl_geo' } : null,
  }
}

/** Einzeljahr-Segmente für ältere 10-K-Filings. */
export function extrahiereSegmenteFuerJahr(
  html: string,
  zielJahr: number,
): { produkt: SecSegmentRoh[]; geo: SecSegmentRoh[] } {
  const { produkt: pHist, geo: gHist } = mehrjahresAusBloecke(html)
  const pJahr = pHist.find((j) => j.jahr === zielJahr)
  const gJahr = gHist.find((j) => j.jahr === zielJahr)
  if (pJahr || gJahr) {
    return {
      produkt: kanonisereSegmentNamen(pJahr?.segmente ?? []),
      geo: kanonisereSegmentNamen(gJahr?.segmente ?? []),
    }
  }

  // Kein Fallback auf „aktuelles“ Segment — verhindert falsche Jahreszuordnung
  return { produkt: [], geo: [] }
}
