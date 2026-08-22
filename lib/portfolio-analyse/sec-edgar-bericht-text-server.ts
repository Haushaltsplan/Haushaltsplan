/** SEC Filing-Index + lesbarer 10-Q/10-K-Text (kein rohes XBRL). */

import 'server-only'

import { bereinigeIxbrlHtml, filterXbrlMuell, istXbrlMuell } from '@/lib/html/sec-ixbrl-text'
import { htmlZuFliesstext, linksAusHtml } from '@/lib/html/text-aus-html'
import { leseAlsJson } from '@/lib/http/safe-json-response'
import {
  cikAusAccession,
  dokumentUrl,
  secFetch,
} from '@/lib/portfolio-analyse/sec-edgar-common-server'

export type EdgarIndexItem = {
  name?: string
  type?: string
  description?: string
  size?: string
}

type EdgarIndex = {
  directory?: { item?: EdgarIndexItem | EdgarIndexItem[] }
}

function accessionOhneBindestriche(accession: string): string {
  return accession.replace(/-/g, '')
}

function dateinameAusHref(href: string): string {
  const clean = href.split('#')[0]!
  const parts = clean.split('/')
  return parts[parts.length - 1] || clean
}

function indexItems(index: EdgarIndex): EdgarIndexItem[] {
  const item = index.directory?.item
  if (!item) return []
  return Array.isArray(item) ? item : [item]
}

function itemsAusIndexHtml(html: string, baseCik: number, accession: string): EdgarIndexItem[] {
  const base = `https://www.sec.gov/Archives/edgar/data/${baseCik}/${accessionOhneBindestriche(accession)}/`
  const items: EdgarIndexItem[] = []
  const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi
  let row: RegExpExecArray | null
  while ((row = rowRe.exec(html)) !== null) {
    const cells = [...row[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((c) =>
      c[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
    )
    const links = linksAusHtml(row[1], base)
    const docLink = links.find((l) => /\.(htm|html|txt)$/i.test(l.href) && !/-index\.htm/i.test(l.href))
    if (!docLink) continue
    items.push({
      name: dateinameAusHref(docLink.href),
      type: cells.find((c) => /^(10-Q|10-K|EX-)/i.test(c)) ?? cells[3] ?? '',
      description: cells[1] ?? docLink.text,
      size: cells[4] ?? cells[cells.length - 1],
    })
  }
  return items
}

function cikKandidaten(companyCik?: number | null, accession?: string): number[] {
  const out: number[] = []
  const company = companyCik != null && Number.isFinite(companyCik) && companyCik > 0 ? companyCik : null
  const filing = accession ? cikAusAccession(accession) : null
  if (company) out.push(company)
  if (filing && filing !== company) out.push(filing)
  return out
}

/**
 * Filing-Index laden.
 * Moderne Filings: `…/{accPath}/index.json` unter Company-CIK.
 * Legacy: `{accession}-index.json` / `{accession}-index.htm` (Accession-CIK kann Filing-Agent sein).
 */
export async function ladeFilingIndexItems(
  accession: string,
  companyCik?: number | null,
): Promise<EdgarIndexItem[]> {
  const accPath = accessionOhneBindestriche(accession)
  const ciks = cikKandidaten(companyCik, accession)
  if (!ciks.length) return []

  for (const cik of ciks) {
    const dirJsonUrl = `https://www.sec.gov/Archives/edgar/data/${cik}/${accPath}/index.json`
    const dirJsonRes = await secFetch(dirJsonUrl)
    if (dirJsonRes.ok) {
      const idx = await leseAlsJson<EdgarIndex>(dirJsonRes)
      const items = idx ? indexItems(idx) : []
      if (items.length) return items
    }

    const accJsonUrl = `https://www.sec.gov/Archives/edgar/data/${cik}/${accPath}/${accession}-index.json`
    const accJsonRes = await secFetch(accJsonUrl)
    if (accJsonRes.ok) {
      const idx = await leseAlsJson<EdgarIndex>(accJsonRes)
      const items = idx ? indexItems(idx) : []
      if (items.length) return items
    }

    const accHtmUrl = `https://www.sec.gov/Archives/edgar/data/${cik}/${accPath}/${accession}-index.htm`
    const accHtmRes = await secFetch(accHtmUrl)
    if (accHtmRes.ok) {
      const items = itemsAusIndexHtml(await accHtmRes.text(), cik, accession)
      if (items.length) return items
    }
  }

  return []
}

function istXbrlArtefakt(name: string): boolean {
  const n = name.toLowerCase()
  return (
    n.endsWith('.xml') ||
    n.endsWith('.xsd') ||
    n.includes('_cal.') ||
    n.includes('_def.') ||
    n.includes('_lab.') ||
    n.includes('_pre.') ||
    n.includes('filingsummary') ||
    n.includes('schema') ||
    n.includes('index-headers') ||
    /^r\d+\.htm$/i.test(n)
  )
}

function istExhibit(meta: string): boolean {
  return /exhibit|ex-\d|graphic|\.jpg|\.png|\.pdf|cover page/i.test(meta)
}

function parseSizeKb(size?: string): number {
  if (!size) return 0
  const m = size.replace(/,/g, '').match(/([\d.]+)\s*(k|m)?/i)
  if (!m) return 0
  const n = parseFloat(m[1]!)
  if (Number.isNaN(n)) return 0
  // Directory-index.json liefert Bytes ohne Einheit — Werte > 100_000 sind Bytes.
  if (!m[2] && n >= 100_000) return n / 1024
  const unit = (m[2] ?? 'k').toLowerCase()
  return unit === 'm' ? n * 1024 : n
}

/** Wählt das lesbare Haupt-HTML (10-Q/10-K/20-F), nicht XBRL-Instance/XML. */
export function waehleLesbaresBerichtDokument(
  items: EdgarIndexItem[],
  formular: '10-Q' | '10-K' | '20-F',
  primaryDocument?: string,
): string | null {
  const primaryNorm = primaryDocument?.trim().toLowerCase() ?? ''

  const kandidaten = items.filter((i) => {
    const name = (i.name ?? '').trim()
    if (!name) return false
    if (!/\.(htm|html)$/i.test(name)) return false
    if (istXbrlArtefakt(name)) return false
    if (/-index\.htm/i.test(name)) return false
    const meta = `${i.type ?? ''} ${i.description ?? ''} ${name}`.toLowerCase()
    if (istExhibit(meta)) return false
    return true
  })

  const score = (i: EdgarIndexItem): number => {
    const name = (i.name ?? '').toLowerCase()
    const meta = `${i.type ?? ''} ${i.description ?? ''}`.toLowerCase()
    let s = parseSizeKb(i.size)
    if ((i.type ?? '').toUpperCase() === formular) s += 500
    if (meta.includes(formular.toLowerCase())) s += 300
    if (
      name.includes('10q') ||
      name.includes('10-q') ||
      name.includes('10k') ||
      name.includes('10-k') ||
      name.includes('20f') ||
      name.includes('20-f')
    ) {
      s += 200
    }
    // Directory-index.json hat type=text.gif — Primary stark bevorzugen.
    if (primaryNorm && name === primaryNorm) s += 50_000
    return s
  }

  const sorted = [...kandidaten].sort((a, b) => score(b) - score(a))
  if (sorted[0]?.name) return sorted[0].name

  if (primaryDocument && /\.(htm|html)$/i.test(primaryDocument) && !istXbrlArtefakt(primaryDocument)) {
    return primaryDocument
  }

  return null
}

function htmlZuBerichtText(html: string): string {
  const cleaned = bereinigeIxbrlHtml(html)
  const text = htmlZuFliesstext(cleaned)
    .split('\n\n')
    .filter((p) => p.trim().length > 20)
    .join('\n\n')
  return filterXbrlMuell(text)
}

async function ladeRohtext(
  ciks: number[],
  accession: string,
  dateiname: string,
): Promise<{ text: string; url: string }> {
  let letzterFehler: Error | null = null
  for (const cik of ciks) {
    const url = dokumentUrl(cik, accession, dateiname)
    try {
      const res = await secFetch(url)
      if (!res.ok) {
        letzterFehler = new Error(`SEC Dokument (${res.status})`)
        continue
      }
      const raw = await res.text()
      const text = /\.(htm|html)$/i.test(dateiname)
        ? htmlZuBerichtText(raw)
        : raw.replace(/\s+/g, ' ').trim()
      return { text, url }
    } catch (e) {
      letzterFehler = e instanceof Error ? e : new Error(String(e))
    }
  }
  throw letzterFehler ?? new Error('SEC Dokument nicht erreichbar')
}

const MAX_VOLLTEXT = 600_000

/** Lädt lesbaren Berichtstext — umgeht XBRL-Primary-Dokumente. */
export async function ladeLesbarenBerichtText(
  cik: number,
  accession: string,
  formular: '10-Q' | '10-K' | '20-F',
  primaryDocument: string,
): Promise<{ text: string; documentName: string; url: string } | null> {
  const ciks = cikKandidaten(cik, accession)
  const items = await ladeFilingIndexItems(accession, cik)
  const primaryIstHtml = /\.(htm|html)$/i.test(primaryDocument)
  const primaryIstXbrl = !primaryIstHtml || istXbrlArtefakt(primaryDocument)

  const kandidaten: string[] = []
  const gewaehlt = waehleLesbaresBerichtDokument(items, formular, primaryDocument)
  if (gewaehlt) kandidaten.push(gewaehlt)
  if (primaryIstHtml && !primaryIstXbrl && !kandidaten.includes(primaryDocument)) {
    kandidaten.push(primaryDocument)
  }
  for (const i of items) {
    const n = i.name?.trim()
    if (n && /\.(htm|html)$/i.test(n) && !istXbrlArtefakt(n) && !kandidaten.includes(n)) {
      kandidaten.push(n)
    }
  }

  for (const doc of kandidaten.slice(0, 6)) {
    try {
      const hit = await ladeRohtext(ciks, accession, doc)
      const text = hit.text.slice(0, MAX_VOLLTEXT)
      if (text.length < 400) continue
      if (istXbrlMuell(text)) continue
      return {
        text,
        documentName: doc,
        url: hit.url,
      }
    } catch {
      continue
    }
  }

  return null
}
