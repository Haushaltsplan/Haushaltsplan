/** SEC EDGAR — Earnings aus 8-K Exhibit 99.1/99.2 (kostenlos, US-Börsen). */

import 'server-only'

import { htmlZuFliesstext, linksAusHtml } from '@/lib/html/text-aus-html'
import { jsonParseFehlerNachricht, leseAlsJson } from '@/lib/http/safe-json-response'

export type EdgarTranscript = {
  titel: string
  url: string
  callDatum: string | null
  text: string
  exhibitTyp: 'EX-99.2' | 'EX-99.1'
  accession: string
}

type EdgarIndexItem = {
  name?: string
  type?: string
  description?: string
}

type EdgarIndex = {
  directory?: { item?: EdgarIndexItem | EdgarIndexItem[] }
}

type SubmissionsRecent = {
  accessionNumber?: string[]
  form?: string[]
  filingDate?: string[]
  primaryDocument?: string[]
  items?: string[]
}

let tickerCikCache: Map<string, number> | null = null
let tickerCikLoadedAt = 0
const TICKER_CACHE_MS = 24 * 60 * 60 * 1000

function secUserAgent(): string {
  const custom = process.env.SEC_EDGAR_USER_AGENT?.trim()
  if (custom) return custom
  const email = (process.env.APP_ALLOWED_EMAILS || 'contact@example.com').split(/[,;\s]+/)[0]?.trim()
  return `Omnia Haushalt ${email || 'contact@example.com'}`
}

function normalisiereUsTicker(ticker: string): string[] {
  const t = ticker.trim().toUpperCase().replace(/[^A-Z0-9.-]/g, '')
  if (!t) return []
  const variants = [t]
  if (t.includes('.')) variants.push(t.split('.')[0])
  /** Alphabet: Portfolio oft GOOG, SEC oft GOOGL */
  if (t === 'GOOG') variants.push('GOOGL')
  if (t === 'GOOGL') variants.push('GOOG')
  return [...new Set(variants.filter(Boolean))]
}

function cikAusAccession(accession: string): number {
  return parseInt(accession.split('-')[0], 10)
}

function accessionOhneBindestriche(accession: string): string {
  return accession.replace(/-/g, '')
}

function dateinameAusHref(href: string): string {
  const clean = href.split('#')[0]
  const parts = clean.split('/')
  return parts[parts.length - 1] || clean
}

function exhibitUrl(filingCik: number, accession: string, hrefOrName: string): string {
  if (/^https?:\/\//i.test(hrefOrName)) return hrefOrName
  if (hrefOrName.startsWith('/')) return `https://www.sec.gov${hrefOrName}`
  const accPath = accessionOhneBindestriche(accession)
  return `https://www.sec.gov/Archives/edgar/data/${filingCik}/${accPath}/${hrefOrName}`
}

async function secFetch(url: string): Promise<Response> {
  return fetch(url, {
    headers: {
      'User-Agent': secUserAgent(),
      Accept: 'application/json, text/html, */*',
    },
    cache: 'no-store',
  })
}

async function ladeTickerCikMap(): Promise<Map<string, number>> {
  if (tickerCikCache && Date.now() - tickerCikLoadedAt < TICKER_CACHE_MS) {
    return tickerCikCache
  }
  const res = await secFetch('https://www.sec.gov/files/company_tickers.json')
  if (!res.ok) throw new Error(`SEC Ticker-Liste (${res.status})`)
  const raw = await leseAlsJson<Record<string, { cik_str?: number; ticker?: string }>>(res)
  if (!raw) throw new Error(jsonParseFehlerNachricht('SEC Ticker-Liste'))
  const map = new Map<string, number>()
  for (const row of Object.values(raw)) {
    if (row.ticker && row.cik_str) map.set(row.ticker.toUpperCase(), row.cik_str)
  }
  tickerCikCache = map
  tickerCikLoadedAt = Date.now()
  return map
}

async function cikFuerTicker(ticker: string): Promise<number | null> {
  const map = await ladeTickerCikMap()
  for (const variant of normalisiereUsTicker(ticker)) {
    const hit = map.get(variant)
    if (hit) return hit
  }
  return null
}

function padCik(cik: number): string {
  return String(cik).padStart(10, '0')
}

function htmlZuTranskriptText(html: string): string {
  const text = htmlZuFliesstext(html)
  if (!text) return ''
  return text
    .split('\n\n')
    .filter((p) => !/^table of contents$/i.test(p.trim()))
    .join('\n\n')
}

function indexItems(index: EdgarIndex): EdgarIndexItem[] {
  const item = index.directory?.item
  if (!item) return []
  return Array.isArray(item) ? item : [item]
}

function itemsAusIndexHtml(html: string, accession: string): EdgarIndexItem[] {
  const base = `https://www.sec.gov/Archives/edgar/data/${cikAusAccession(accession)}/${accessionOhneBindestriche(accession)}/`
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
    const type = cells.find((c) => /^EX-/i.test(c)) ?? cells[3] ?? ''
    const desc = cells[1] ?? docLink.text
    items.push({
      name: docLink.href.startsWith('http') ? docLink.href : dateinameAusHref(docLink.href),
      type,
      description: desc,
    })
  }

  if (items.length > 0) return items

  for (const link of linksAusHtml(html, base)) {
    if (!/\.(htm|html|txt)$/i.test(link.href) || /-index\.htm/i.test(link.href)) continue
    if (!/exhibit|ex99|99\.1|99\.2|earnings|transcript|press/i.test(`${link.text} ${link.href}`)) continue
    items.push({
      name: link.href.startsWith('http') ? link.href : dateinameAusHref(link.href),
      description: link.text,
      type: '',
    })
  }
  return items
}

async function ladeFilingIndexItems(accession: string): Promise<EdgarIndexItem[]> {
  const filingCik = cikAusAccession(accession)
  const accPath = accessionOhneBindestriche(accession)
  const jsonUrl = `https://www.sec.gov/Archives/edgar/data/${filingCik}/${accPath}/${accession}-index.json`
  const jsonRes = await secFetch(jsonUrl)
  if (jsonRes.ok) {
    const idx = await leseAlsJson<EdgarIndex>(jsonRes)
    if (idx) return indexItems(idx)
  }

  const htmUrl = `https://www.sec.gov/Archives/edgar/data/${filingCik}/${accPath}/${accession}-index.htm`
  const htmRes = await secFetch(htmUrl)
  if (!htmRes.ok) return []
  return itemsAusIndexHtml(await htmRes.text(), accession)
}

function waehleExhibit(items: EdgarIndexItem[]): { item: EdgarIndexItem; typ: 'EX-99.2' | 'EX-99.1' } | null {
  const meta = (i: EdgarIndexItem) =>
    `${i.type || ''} ${i.description || ''} ${i.name || ''}`.toLowerCase()

  const ex992 = items.filter((i) => {
    const m = meta(i)
    return (
      /99\.2|ex-99\.2|ex99\.2|exx992/.test(m) ||
      m.includes('transcript') ||
      (m.includes('exhibit') && m.includes('99') && m.includes('2'))
    )
  })
  if (ex992[0]?.name) return { item: ex992[0], typ: 'EX-99.2' }

  const ex991 = items.filter((i) => {
    const m = meta(i)
    return (
      /99\.1|ex-99\.1|ex99\.1|exx991|exhibit991|exhibit99/.test(m) ||
      m.includes('press release') ||
      m.includes('earnings release') ||
      (m.includes('earnings') && /exhibit|ex99|991/.test(m))
    )
  })
  if (ex991[0]?.name) return { item: ex991[0], typ: 'EX-99.1' }

  return null
}

function istEarningsAchtK(items?: string): boolean {
  if (!items) return false
  return /2\.02/.test(items) || /7\.01/.test(items)
}

async function ladeExhibitText(accession: string, hrefOrName: string): Promise<string> {
  const filingCik = cikAusAccession(accession)
  const url = exhibitUrl(filingCik, accession, hrefOrName)
  const res = await secFetch(url)
  if (!res.ok) throw new Error(`SEC Exhibit (${res.status})`)
  const html = await res.text()
  return htmlZuTranskriptText(html)
}

async function sleep(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms))
}

/** Bis zu `max` Earnings-Transkripte aus SEC-8-K-Filings. */
export async function ladeSecEdgarTranskriptHistorie(tickerRaw: string, max = 8): Promise<EdgarTranscript[]> {
  const cik = await cikFuerTicker(tickerRaw)
  if (!cik) return []

  const subUrl = `https://data.sec.gov/submissions/CIK${padCik(cik)}.json`
  const subRes = await secFetch(subUrl)
  if (!subRes.ok) return []
  const sub = await leseAlsJson<{ name?: string; filings?: { recent?: SubmissionsRecent } }>(subRes)
  if (!sub) return []
  const recent = sub.filings?.recent
  if (!recent?.form?.length) return []

  const firmenname = sub.name?.trim() || tickerRaw.toUpperCase()
  const forms = recent.form
  const maxScan = Math.min(forms.length, 120)

  const kandidaten: { i: number; earnings: boolean }[] = []
  for (let i = 0; i < maxScan; i++) {
    if (forms[i] !== '8-K') continue
    kandidaten.push({ i, earnings: istEarningsAchtK(recent.items?.[i]) })
  }
  kandidaten.sort((a, b) => Number(b.earnings) - Number(a.earnings))

  const out: EdgarTranscript[] = []
  const seenAcc = new Set<string>()

  for (const { i } of kandidaten) {
    if (out.length >= max) break
    const accession = recent.accessionNumber?.[i]
    const filingDate = recent.filingDate?.[i]
    if (!accession || seenAcc.has(accession)) continue
    seenAcc.add(accession)

    await sleep(150)
    const indexItemsList = await ladeFilingIndexItems(accession)
    if (!indexItemsList.length) continue

    const picked = waehleExhibit(indexItemsList)
    if (!picked?.item.name) continue

    let text = ''
    try {
      text = await ladeExhibitText(accession, picked.item.name)
    } catch {
      continue
    }
    if (text.length < 400) continue

    const exhibitLabel = picked.typ === 'EX-99.2' ? 'Earnings Call Transcript' : 'Earnings Press Release'
    const filingCik = cikAusAccession(accession)
    const docUrl = exhibitUrl(filingCik, accession, picked.item.name)

    out.push({
      titel: `${firmenname} — ${exhibitLabel} (8-K ${filingDate ?? ''})`,
      url: docUrl,
      callDatum: filingDate ?? null,
      text,
      exhibitTyp: picked.typ,
      accession,
    })
  }

  return out
}

export async function ladeSecEdgarLetztesTranskript(tickerRaw: string): Promise<EdgarTranscript> {
  const list = await ladeSecEdgarTranskriptHistorie(tickerRaw, 1)
  if (!list[0]) {
    throw new Error(
      `${tickerRaw}: Kein SEC-Transkript gefunden (nur US-SEC-Melder). Für EU-Aktien wird die IR-Seite durchsucht.`,
    )
  }
  return list[0]
}
