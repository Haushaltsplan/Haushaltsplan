/**
 * EU URD / Jahresbericht-Notizen — Debt-Maturity, F&E-Aktivierung, Kundenkonzentration.
 * Primär: Hermès finance.hermes.com PDFs; generisch: IR-Jahresberichte.
 */

import 'server-only'

import { HERMES_ISIN, ladeHermesFinanzberichteHistorie } from '@/lib/portfolio-analyse/hermes-finance-ir-server'
import { ladeEuPortfolioFinanzberichteHistorie } from '@/lib/portfolio-analyse/eu-portfolio-ir-server'
import { euPortfolioIrConfig } from '@/lib/portfolio-analyse/eu-portfolio-ir-config'
import { ladeIrFinanzberichteHistorie } from '@/lib/portfolio-analyse/ir-financial-reports-server'
import type { DebtMaturityProfil, RdKapitalisierung } from '@/lib/portfolio-analyse/sec-edgar-debt-rd-server'
import type { SecZusatzRisikoFelder } from '@/lib/portfolio-analyse/fundamentaldaten-erweitert-types'

const CACHE_MS = 24 * 60 * 60 * 1000
const textCache = new Map<string, { at: number; text: string; titel: string }>()

function parseMio(raw: string): number | null {
  const cleaned = raw.replace(/\u00a0/g, ' ').replace(/\s/g, '').replace(/,/g, '')
  const n = Number(cleaned.replace(',', '.'))
  if (!Number.isFinite(n)) return null
  // Hermès berichtet oft in Mio. €
  if (n >= 50_000) return Math.round(n / 1_000_000) // Roh-EUR → Mio.
  return Math.round(n * 10) / 10
}

function leeresDebtProfil(): DebtMaturityProfil {
  return {
    due12mMio: null,
    dueYear2Mio: null,
    dueYear3Mio: null,
    dueYear4Mio: null,
    dueYear5Mio: null,
    dueAfter5yMio: null,
    due24mMio: null,
    refiAnteil24mPct: null,
    gesamtSchuldenMio: null,
    jahr: null,
    quelle: 'eu_urd',
  }
}

/**
 * Hermès / IFRS-Bilanzzeilen:
 * "Borrowings and financial liabilities due in less than one year 10 0 0"
 * "Lease liabilities due in more than one year 8.3 1,987 1,781"
 * → Note-Nr. + aktuelles FY + Vorjahr (Mio. €).
 */
export function parseHermesBilanzDebtAusText(text: string): DebtMaturityProfil | null {
  const t = text.replace(/\s+/g, ' ')
  const re =
    /(Borrowings(?:\s+and\s+financial\s+liabilities)?|Lease liabilities)\s+due in (less|more) than one year\s+(\d+(?:\.\d+)?)\s+([\d,]+(?:\.\d+)?)\s+([\d,]+(?:\.\d+)?)/gi
  let finShort = 0
  let finLong = 0
  let leaseShort = 0
  let leaseLong = 0
  let hits = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(t)) !== null) {
    const current = parseMio(m[4]!)
    if (current == null || current < 0) continue
    const isLease = /^Lease/i.test(m[1]!)
    const isLess = m[2]!.toLowerCase() === 'less'
    if (isLease) {
      if (isLess) leaseShort += current
      else leaseLong += current
    } else {
      if (isLess) finShort += current
      else finLong += current
    }
    hits++
  }
  if (hits < 2) return null

  const shortMio = finShort + leaseShort
  const longMio = finLong + leaseLong
  const out = leeresDebtProfil()
  out.due12mMio = Math.round(shortMio * 10) / 10
  const y2Proxy = Math.round(longMio * 0.2 * 10) / 10
  const restLt = Math.round((longMio - y2Proxy) * 10) / 10
  out.dueYear2Mio = y2Proxy > 0 ? y2Proxy : null
  out.dueAfter5yMio = restLt > 0 ? restLt : null
  out.due24mMio = Math.round((out.due12mMio + (out.dueYear2Mio ?? 0)) * 10) / 10
  out.gesamtSchuldenMio = Math.round((shortMio + longMio) * 10) / 10

  // Refi-Risiko nur auf Finanzschulden (nicht IFRS-16-Leases = Operating-Miete)
  const finGesamt = finShort + finLong
  const finDue24 = finShort + Math.round(finLong * 0.2 * 10) / 10
  if (finGesamt >= 1) {
    out.refiAnteil24mPct = Math.round((finDue24 / finGesamt) * 1000) / 10
  } else if (out.gesamtSchuldenMio != null && out.gesamtSchuldenMio > 0 && finGesamt < 1) {
    // Netto-Cash / nur Leases → kein klassisches Bond-Refi-Risiko
    out.refiAnteil24mPct = 0
  } else if (out.due24mMio != null && out.gesamtSchuldenMio != null && out.gesamtSchuldenMio > 0) {
    out.refiAnteil24mPct = Math.round((out.due24mMio / out.gesamtSchuldenMio) * 1000) / 10
  }

  const jahrM = t.match(/\b31\/12\/(20[2-3]\d)\b/) ?? t.match(/\b(20[2-3]\d)\s+UNIVERSAL REGISTRATION/i)
  out.jahr = jahrM ? parseInt(jahrM[1]!, 10) : null
  return out
}

/** Fälligkeitsleiter aus URD-Text (IFRS Notes). */
export function parseDebtMaturityAusText(text: string): DebtMaturityProfil | null {
  const hermes = parseHermesBilanzDebtAusText(text)
  if (hermes) return hermes

  const t = text.replace(/\s+/g, ' ')
  if (t.length < 800) return null

  // Typische Formulierungen: "less than one year" / "1 to 5 years" / "more than 5 years"
  // oder Tabellen: "Within one year … Between one and five … Beyond five"
  const buckets: Array<{ key: keyof Pick<DebtMaturityProfil, 'due12mMio' | 'dueYear2Mio' | 'dueAfter5yMio'>; re: RegExp }> = [
    {
      key: 'due12mMio',
      re: /(?:less than one year|within one year|due within 1 year|fällig innerhalb|moins d['']un an|within 12 months|current portion)[^0-9]{0,40}([\d\s.,]+)\s*(?:m€|m\s*€|€m|million|mio)?/i,
    },
    {
      key: 'dueYear2Mio',
      re: /(?:one to five years|1 to 5 years|between one and five|1[-–]5 years|de 1 à 5 ans|between 1 and 5)[^0-9]{0,40}([\d\s.,]+)\s*(?:m€|m\s*€|€m|million|mio)?/i,
    },
    {
      key: 'dueAfter5yMio',
      re: /(?:more than five years|beyond five years|after five years|über fünf|plus de 5 ans|more than 5 years)[^0-9]{0,40}([\d\s.,]+)\s*(?:m€|m\s*€|€m|million|mio)?/i,
    },
  ]

  const out = leeresDebtProfil()

  let hits = 0
  for (const b of buckets) {
    const m = t.match(b.re)
    if (!m?.[1]) continue
    const mio = parseMio(m[1])
    if (mio == null || mio <= 0) continue
    out[b.key] = mio
    hits++
  }

  // Jahr-für-Jahr-Fälligkeiten: "2025 … 320" "2026 … 410" in Maturity-Abschnitten
  const maturityBlock =
    t.match(
      /(?:maturity|maturities|fälligkeit|échéances?|repayment schedule)[\s\S]{0,2500}?(?=equity|shareholders|note\s+\d|$)/i,
    )?.[0] ?? ''
  const yearRows = [
    ...maturityBlock.matchAll(/\b(20[2-3]\d)\b[^0-9]{0,25}([\d\s]{2,12}(?:[.,]\d+)?)\b/g),
  ]
  if (yearRows.length >= 2) {
    const nowY = new Date().getUTCFullYear()
    const byYear = new Map<number, number>()
    for (const m of yearRows) {
      const y = parseInt(m[1]!, 10)
      const mio = parseMio(m[2]!)
      if (mio == null || mio < 1) continue
      if (y < nowY || y > nowY + 8) continue
      byYear.set(y, mio)
    }
    if (byYear.size >= 2) {
      out.due12mMio = byYear.get(nowY) ?? byYear.get(nowY + 1) ?? out.due12mMio
      out.dueYear2Mio = byYear.get(nowY + 1) ?? byYear.get(nowY + 2) ?? out.dueYear2Mio
      out.dueYear3Mio = byYear.get(nowY + 2) ?? null
      out.dueYear4Mio = byYear.get(nowY + 3) ?? null
      out.dueYear5Mio = byYear.get(nowY + 4) ?? null
      hits += byYear.size
    }
  }

  if (hits === 0) {
    // Current / Non-current borrowings (+ leases) — IFRS-Bilanz ohne Fälligkeitsleiter
    const curB = t.match(
      /(?:Current (?:portion of )?(?:borrowings|financial (?:debt|liabilities)|loans)|kurzfristige (?:Finanzschulden|Finanzverbindlichkeiten)|Borrowings[^\n.]{0,40}current)[^0-9]{0,30}([\d\s.,]+)/i,
    )
    const nonCurB = t.match(
      /(?:Non[‑\- ]?current (?:borrowings|financial (?:debt|liabilities)|loans)|langfristige (?:Finanzschulden|Finanzverbindlichkeiten)|Borrowings[^\n.]{0,40}non[‑\- ]?current)[^0-9]{0,30}([\d\s.,]+)/i,
    )
    const curL = t.match(
      /(?:Current lease liabilities|Lease liabilities[^\n.]{0,30}current|kurzfristige Leasingverbindlichkeiten)[^0-9]{0,30}([\d\s.,]+)/i,
    )
    const nonCurL = t.match(
      /(?:Non[‑\- ]?current lease liabilities|Lease liabilities[^\n.]{0,30}non[‑\- ]?current|langfristige Leasingverbindlichkeiten)[^0-9]{0,30}([\d\s.,]+)/i,
    )
    const c1 = curB?.[1] ? parseMio(curB[1]) : null
    const c2 = curL?.[1] ? parseMio(curL[1]) : null
    const n1 = nonCurB?.[1] ? parseMio(nonCurB[1]) : null
    const n2 = nonCurL?.[1] ? parseMio(nonCurL[1]) : null
    const short = (c1 ?? 0) + (c2 ?? 0)
    const long = (n1 ?? 0) + (n2 ?? 0)
    if (short > 0 || long > 0) {
      out.due12mMio = short > 0 ? Math.round(short * 10) / 10 : null
      const y2 = Math.round(long * 0.2 * 10) / 10
      out.dueYear2Mio = y2 > 0 ? y2 : null
      out.dueAfter5yMio = long - y2 > 0 ? Math.round((long - y2) * 10) / 10 : null
      hits = (short > 0 ? 1 : 0) + (long > 0 ? 1 : 0)
    }
  }

  if (hits === 0) return null

  // 1–5 Jahre grob auf Jahr 2 legen, wenn nur Band vorhanden
  const due12 = out.due12mMio
  const mid = out.dueYear2Mio
  // Für 24M: kurzfristig + anteilig 1–5J (≈ 25 % des Bandes als Jahr-2-Proxy)
  const dueY2Proxy = mid != null && out.dueYear3Mio == null ? Math.round(mid * 0.25 * 10) / 10 : out.dueYear2Mio
  out.dueYear2Mio = dueY2Proxy
  out.due24mMio =
    due12 != null || dueY2Proxy != null
      ? Math.round(((due12 ?? 0) + (dueY2Proxy ?? 0)) * 10) / 10
      : null

  const gesamt =
    (out.due12mMio ?? 0) +
    (out.dueYear2Mio ?? 0) +
    (out.dueYear3Mio ?? 0) +
    (out.dueYear4Mio ?? 0) +
    (out.dueYear5Mio ?? 0) +
    (out.dueAfter5yMio ?? 0)
  out.gesamtSchuldenMio = gesamt > 0 ? Math.round(gesamt * 10) / 10 : null
  if (out.due24mMio != null && out.gesamtSchuldenMio != null && out.gesamtSchuldenMio > 0) {
    out.refiAnteil24mPct = Math.round((out.due24mMio / out.gesamtSchuldenMio) * 1000) / 10
  }

  const jahrM = t.match(/\b(20[2-3]\d)\b/)
  out.jahr = jahrM ? parseInt(jahrM[1]!, 10) : null
  return out
}

/** F&E-Aktivierung aus Accounting-Policy / Notes. */
export function parseRdKapitalisierungAusText(text: string): RdKapitalisierung | null {
  const t = text.replace(/\s+/g, ' ')
  if (t.length < 500) return null

  // Explizite Quote
  const quoteM = t.match(
    /(?:capitali[sz]ed|aktiviert)[^.]{0,40}(?:research|development|R&D|F&E)[^.]{0,60}?(\d{1,2}(?:[.,]\d+)?)\s*%/i,
  )
  if (quoteM?.[1]) {
    const q = parseFloat(quoteM[1].replace(',', '.'))
    if (q >= 0 && q <= 100) {
      return {
        kapitalisiertMio: null,
        aufwandMio: null,
        aktivierungsquotePct: Math.round(q * 10) / 10,
        jahr: null,
        quelle: 'eu_urd',
      }
    }
  }

  // Beträge: capitalised development costs … €Xm vs R&D expense … €Ym
  const capM = t.match(
    /(?:capitali[sz]ed\s+(?:development|software|R&D)|development\s+costs\s+capitali[sz]ed|aktiviert[ae]?\s+(?:Entwicklungs|F&E))[^0-9]{0,50}([\d\s.,]+)\s*(?:m€|€m|million|mio)/i,
  )
  const expM = t.match(
    /(?:research\s+and\s+development\s+(?:expenses?|costs?)|R&D\s+expenses?|F&E[- ](?:Aufwand|Kosten))[^0-9]{0,50}([\d\s.,]+)\s*(?:m€|€m|million|mio)/i,
  )

  const kapitalisiertMio = capM?.[1] ? parseMio(capM[1]) : null
  const aufwandMio = expM?.[1] ? parseMio(expM[1]) : null

  // Hermès/Luxury: oft „research costs are expensed as incurred“ / non-capitalisable R&D → Quote 0
  if (
    /research(?:\s+and\s+development)?\s+costs?\s+are\s+(?:fully\s+)?expensed|F&E[- ]Kosten\s+werden\s+(?:sofort\s+)?aufwandswirksam|non[‑\-]?capitalisable costs relating to research and development|costs relating to research and development[^.]{0,40}expensed/i.test(
      t,
    )
  ) {
    return {
      kapitalisiertMio: kapitalisiertMio ?? 0,
      aufwandMio,
      aktivierungsquotePct: 0,
      jahr: null,
      quelle: 'eu_urd',
    }
  }

  if (kapitalisiertMio == null && aufwandMio == null) return null

  let aktivierungsquotePct: number | null = null
  if (kapitalisiertMio != null && aufwandMio != null && kapitalisiertMio + aufwandMio > 0) {
    aktivierungsquotePct =
      Math.round((kapitalisiertMio / (kapitalisiertMio + aufwandMio)) * 1000) / 10
  }

  return {
    kapitalisiertMio,
    aufwandMio,
    aktivierungsquotePct,
    jahr: null,
    quelle: 'eu_urd',
  }
}

/** Kundenkonzentration aus URD („no customer exceeds 10%“ / Top-Kunden). */
export function parseKundenKonzentrationAusText(text: string): SecZusatzRisikoFelder['hauptkunden'] {
  const t = text.replace(/\s+/g, ' ')
  const out: SecZusatzRisikoFelder['hauptkunden'] = []
  const seen = new Set<string>()

  // Explizit: kein Kunde > X%
  const none = t.match(
    /(?:no|nicht\s+ein|kein)\s+(?:single\s+)?(?:customer|client|Kunde)[^.]{0,100}(?:more than|exceeds?|accounted for more than|über|mehr als|représentait plus de)\s+(\d{1,2})\s*%/i,
  )
  if (none?.[1]) {
    const pct = parseFloat(none[1]) - 0.1
    if (pct > 0) {
      out.push({ name: 'Kein Einzelkunde ≥ Schwelle', anteilPct: Math.max(pct, 1) })
      return out
    }
  }

  // „no customer accounted for more than 10% of … revenue“
  const none2 = t.match(
    /no\s+(?:single\s+)?(?:customer|client)[^.]{0,60}(?:accounted for|represented)[^.]{0,40}(?:more than|over)\s+(\d{1,2})\s*%/i,
  )
  if (none2?.[1]) {
    const pct = parseFloat(none2[1]) - 0.1
    if (pct > 0) {
      out.push({ name: 'Kein Einzelkunde ≥ Schwelle', anteilPct: Math.max(pct, 1) })
      return out
    }
  }

  // Hermès / Retail: „no significant concentration of credit risk“
  if (
    /no significant concentration of (?:credit )?risk|keine wesentliche Konzentration (?:des )?Kreditrisikos|keine wesentliche Kundenkonzentration/i.test(
      t,
    )
  ) {
    out.push({ name: 'Keine wesentliche Kreditrisiko-Konzentration', anteilPct: 5 })
    return out
  }

  const named =
    /([A-Z][A-Za-z0-9&.\- ]{2,40}?)\s+(?:accounted for|represented|représentait|stellte)[^.]{0,40}?(\d{1,2}(?:[.,]\d+)?)\s*%/gi
  let m: RegExpExecArray | null
  while ((m = named.exec(t)) !== null && out.length < 6) {
    const name = m[1]!.trim()
    const pct = parseFloat(m[2]!.replace(',', '.'))
    if (pct < 5 || pct > 80) continue
    if (/^(the|our|we|a|an|no|group|company)\b/i.test(name)) continue
    const key = name.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ name, anteilPct: Math.round(pct * 10) / 10 })
  }

  return out.sort((a, b) => b.anteilPct - a.anteilPct)
}

async function ladeEuJahresberichtText(opts: {
  isin: string
  ticker: string
  firmenname?: string | null
}): Promise<{ text: string; titel: string } | null> {
  const isin = opts.isin.trim().toUpperCase()
  const cacheKey = isin || opts.ticker
  const hit = textCache.get(cacheKey)
  if (hit && Date.now() - hit.at < CACHE_MS) return { text: hit.text, titel: hit.titel }

  let berichte: Array<{ text: string; titel: string }> = []

  if (isin === HERMES_ISIN) {
    const hermes = await ladeHermesFinanzberichteHistorie(4)
    berichte = hermes
      .filter((b) => /urd|publishing|annual|registration/i.test(b.titel + b.url))
      .map((b) => ({ text: b.text, titel: b.titel }))
    if (berichte.length === 0) {
      berichte = hermes.map((b) => ({ text: b.text, titel: b.titel }))
    }
  }

  if (berichte.length === 0 && euPortfolioIrConfig(isin)) {
    const eu = await ladeEuPortfolioFinanzberichteHistorie(isin, 4)
    berichte = eu
      .filter((b) => /annual|jahr|urd|registration|FY|geschäft|20-?F/i.test(b.titel + b.url))
      .map((b) => ({ text: b.text, titel: b.titel }))
    if (berichte.length === 0) {
      berichte = eu.map((b) => ({ text: b.text, titel: b.titel }))
    }
  }

  // Generischer Fallback: IR-Crawl für JEDE EU-ISIN (ASML, LVMH, Watchlist, …)
  if (berichte.every((b) => b.text.length < 5_000)) {
    try {
      const ir = await ladeIrFinanzberichteHistorie({
        ticker: opts.ticker,
        isin,
        firmenname: opts.firmenname,
      })
      const ausTexte = [...ir.texte.entries()].map(([acc, text]) => {
        const titel = ir.berichte.find((b) => b.accession === acc)?.label ?? acc
        return { text, titel }
      })
      const besser = ausTexte
        .filter((b) => /annual|jahr|urd|registration|geschäft|20-?F|universal/i.test(b.titel))
        .concat(ausTexte)
      for (const b of besser) {
        if (b.text.length >= 5_000 && !berichte.some((x) => x.titel === b.titel)) {
          berichte.push(b)
        }
      }
    } catch {
      /* IR optional */
    }
  }

  const best =
    berichte.find(
      (b) =>
        b.text.length >= 5_000 &&
        /In millions of (?:euros?|CHF)|EUR million|CHF million|in Mio\.?\s*€/i.test(b.text) &&
        /\b(?:Revenue|Net sales|Umsatz)\b/i.test(b.text),
    ) ??
    berichte.find((b) => b.text.length >= 5_000) ??
    berichte[0]
  if (!best) return null

  textCache.set(cacheKey, { at: Date.now(), text: best.text, titel: best.titel })
  return best
}

/** Öffentlicher Alias — gleicher Text für Debt-Notes und Key-Figures-Historie. */
export async function ladeEuUrdNotesText(opts: {
  isin: string
  ticker: string
  firmenname?: string | null
}): Promise<{ text: string; titel: string } | null> {
  return ladeEuJahresberichtText(opts)
}

export type EuUrdNotesPaket = {
  debtMaturity: DebtMaturityProfil | null
  rdKapitalisierung: RdKapitalisierung | null
  hauptkunden: SecZusatzRisikoFelder['hauptkunden']
  quelleTitel: string | null
}

/** Lädt EU-Jahresbericht und extrahiert Debt / F&E / Kunden. */
export async function ladeEuUrdNotes(opts: {
  isin: string
  ticker: string
  firmenname?: string | null
}): Promise<EuUrdNotesPaket | null> {
  const doc = await ladeEuJahresberichtText(opts)
  if (!doc) return null

  const debtMaturity = parseDebtMaturityAusText(doc.text)
  const rdKapitalisierung = parseRdKapitalisierungAusText(doc.text)
  const hauptkunden = parseKundenKonzentrationAusText(doc.text)

  if (!debtMaturity && !rdKapitalisierung && hauptkunden.length === 0) return null

  if (debtMaturity) debtMaturity.quelle = 'eu_urd'
  if (rdKapitalisierung) rdKapitalisierung.quelle = 'eu_urd'

  return {
    debtMaturity,
    rdKapitalisierung,
    hauptkunden,
    quelleTitel: doc.titel,
  }
}
