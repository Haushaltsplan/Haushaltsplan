/** SEC 8-K Item 2.02 — Earnings Releases (EX-99) für alle US-Ticker, bevor 10-Q/10-K da ist. */

import 'server-only'

import { bereinigeIxbrlHtml, filterXbrlMuell } from '@/lib/html/sec-ixbrl-text'
import { htmlZuFliesstext } from '@/lib/html/text-aus-html'
import {
  parseBerichtsperiodeAusDateiname,
  parseBerichtsperiodeAusText,
  type Berichtsperiode,
} from '@/lib/portfolio-analyse/sec-bericht-periode'
import {
  ladeFilingIndexItems,
  type EdgarIndexItem,
} from '@/lib/portfolio-analyse/sec-edgar-bericht-text-server'
import {
  cikAusAccession,
  dokumentUrl,
  secFetch,
  type SecSubmissionsRecent,
} from '@/lib/portfolio-analyse/sec-edgar-common-server'

export type EarningsReleaseRoh = {
  formular: '8-K-ER'
  accession: string
  filingDatum: string | null
  berichtszeitraum: string | null
  primaryDocument: string
  firmenname: string
  label: string
  periodenKey: string
}

function istEarningsAchtK(items?: string): boolean {
  if (!items) return false
  return /\b2\.02\b/.test(items)
}

function meta(i: EdgarIndexItem): string {
  return `${i.type || ''} ${i.description || ''} ${i.name || ''}`.toLowerCase()
}

function parseSize(size?: string): number {
  if (!size) return 0
  const n = parseFloat(size.replace(/,/g, ''))
  return Number.isFinite(n) ? n : 0
}

function istSupplementOderTranskript(m: string): boolean {
  return /transcript|conference\s*call|supplement|ex-?99\.?2\b|ex992(?!\d*release)/i.test(m)
}

function istPressOder991(m: string): boolean {
  return /ex-?99\.?1\b|ex991|earnings\s*release|earningsrelease|press\s*release|narrative|results/i.test(m)
}

/** Wählt EX-99.1 / Earnings Release — nie Transkript/Supplement wenn 99.1 existiert. */
export function waehleEarningsReleaseDokument(items: EdgarIndexItem[]): string | null {
  const htmlItems = items.filter((i) => {
    const name = (i.name ?? '').trim()
    if (!name || !/\.(htm|html)$/i.test(name)) return false
    if (/^r\d+\.htm$/i.test(name) || /index-headers|filingsummary/i.test(name)) return false
    return true
  })

  const press = htmlItems.filter((i) => istPressOder991(meta(i)) && !istSupplementOderTranskript(meta(i)))
  const pool = press.length > 0 ? press : htmlItems.filter((i) => /ex-?99|exhibit|earnings|press|release|results/i.test(meta(i)))

  const kandidaten = pool.filter((i) => {
    const m = meta(i)
    if (press.length > 0) return true
    return !istSupplementOderTranskript(m) || /earnings\s*release|earningsrelease|press\s*release/i.test(m)
  })

  if (!kandidaten.length) return null

  const score = (i: EdgarIndexItem): number => {
    const m = meta(i)
    let s = Math.min(parseSize(i.size) / 1000, 500)
    if (/earnings\s*release|earningsrelease|press\s*release/i.test(m)) s += 8000
    if (/ex-?99\.?1\b|ex991|narrative/i.test(m)) s += 6000
    if (/ex-?99\b/i.test(m)) s += 500
    if (istSupplementOderTranskript(m)) s -= 50_000
    if (/powerpoint|slides|presentation|deck|vpower/i.test(m)) s -= 5000
    return s
  }

  const sorted = [...kandidaten].sort((a, b) => score(b) - score(a))
  return sorted[0]?.name?.trim() || null
}

function htmlZuReleaseText(html: string): string {
  const cleaned = bereinigeIxbrlHtml(html)
  const text = htmlZuFliesstext(cleaned)
    .split('\n\n')
    .filter((p) => p.trim().length > 20)
    .join('\n\n')
  return filterXbrlMuell(text)
}

const TEXT_PEEK_CHARS = 24_000

async function ladeReleaseRohHtml(
  companyCik: number,
  accession: string,
  dateiname: string,
): Promise<{ html: string; url: string } | null> {
  const ciks = [...new Set([companyCik, cikAusAccession(accession)].filter((c) => c > 0))]
  for (const cik of ciks) {
    const url = dokumentUrl(cik, accession, dateiname)
    const res = await secFetch(url)
    if (!res.ok) continue
    const html = await res.text()
    if (html.length < 200) continue
    return { html, url }
  }
  return null
}

export async function ladeEarningsReleaseText(
  companyCik: number,
  accession: string,
  dateiname: string,
): Promise<{ text: string; url: string } | null> {
  const hit = await ladeReleaseRohHtml(companyCik, accession, dateiname)
  if (!hit) return null
  const text = htmlZuReleaseText(hit.html)
  if (text.length < 200) return null
  return { text, url: hit.url }
}

/**
 * Periode: Exhibit-Text zuerst (Periodenende/FY), dann Dateiname.
 * Keine Ticker- oder Filing-Monats-Spezialfälle.
 */
export function labelAusEarningsReleaseMeta(
  dokumentName: string,
  filingDatum: string | null,
  exhibitText?: string | null,
): Berichtsperiode {
  const ausText = exhibitText ? parseBerichtsperiodeAusText(exhibitText.slice(0, TEXT_PEEK_CHARS)) : null
  const ausName = parseBerichtsperiodeAusDateiname(dokumentName)

  if (ausText) {
    // FY aus Text + Periodenende aus Dateiname (z. B. ma12312025 → pe:2025-12-31)
    if (
      (ausText.periodenKey.endsWith('-FY') || ausText.label.startsWith('Jahresbericht')) &&
      ausName?.periodenKey.startsWith('pe:')
    ) {
      return {
        label: ausText.label,
        periodenKey: ausName.periodenKey,
        berichtszeitraum: ausName.berichtszeitraum,
      }
    }
    // Quartal-Label ohne pe: → Periodenende aus Dateiname übernehmen
    if (!ausText.periodenKey.startsWith('pe:') && ausName?.periodenKey.startsWith('pe:')) {
      return {
        label: ausName.label,
        periodenKey: ausName.periodenKey,
        berichtszeitraum: ausName.berichtszeitraum,
      }
    }
    return ausText
  }

  if (ausName) return ausName

  const tag = filingDatum?.slice(0, 10) || 'ohne-datum'
  return {
    label: filingDatum ? `Ergebnisbericht ${filingDatum.slice(0, 10)}` : 'Ergebnisbericht',
    periodenKey: `er-${tag}-${dokumentName.toLowerCase().slice(0, 40)}`,
    berichtszeitraum: filingDatum,
  }
}

const MAX_RELEASES = 8

async function sleep(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms))
}

/** 8-K Item-2.02 Earnings Releases für beliebige US-CIKs (auch bei 424B2-Flut wie JPM). */
export async function ladeEarningsReleaseFilings(
  recent: SecSubmissionsRecent,
  companyCik: number,
  firmenname: string,
): Promise<EarningsReleaseRoh[]> {
  if (!recent.form?.length) return []

  // Zuerst nur Indizes sammeln (billig) — nicht nach den ersten N Forms abbrechen.
  const kandidatenIdx: number[] = []
  for (let i = 0; i < recent.form.length && kandidatenIdx.length < MAX_RELEASES * 2; i++) {
    const form = recent.form[i]
    if (form !== '8-K' && form !== '8-K/A') continue
    if (!istEarningsAchtK(recent.items?.[i])) continue
    kandidatenIdx.push(i)
  }

  const out: EarningsReleaseRoh[] = []
  const seenAcc = new Set<string>()
  const seenPerioden = new Set<string>()

  for (const i of kandidatenIdx) {
    if (out.length >= MAX_RELEASES) break
    const accession = recent.accessionNumber?.[i]
    if (!accession || seenAcc.has(accession)) continue
    seenAcc.add(accession)

    const filingDatum = recent.filingDate?.[i] ?? null
    try {
      await sleep(80)
      const items = await ladeFilingIndexItems(accession, companyCik)
      const doc = waehleEarningsReleaseDokument(items)
      if (!doc) continue

      await sleep(80)
      const roh = await ladeReleaseRohHtml(companyCik, accession, doc)
      const exhibitText = roh ? htmlZuReleaseText(roh.html).slice(0, TEXT_PEEK_CHARS) : null
      const metaLabel = labelAusEarningsReleaseMeta(doc, filingDatum, exhibitText)

      if (seenPerioden.has(metaLabel.periodenKey)) continue
      seenPerioden.add(metaLabel.periodenKey)

      out.push({
        formular: '8-K-ER',
        accession,
        filingDatum,
        berichtszeitraum: metaLabel.berichtszeitraum,
        primaryDocument: doc,
        firmenname,
        label: metaLabel.label,
        periodenKey: metaLabel.periodenKey,
      })
    } catch {
      continue
    }
  }

  return out
}
