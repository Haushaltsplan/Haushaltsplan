/** SEC EDGAR — Earnings-Call-Transkripte aus 8-K Exhibit 99.2 (kostenlos, US-Börsen). */

import 'server-only'

import { htmlZuFliesstext } from '@/lib/html/text-aus-html'
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
  return [...new Set(variants.filter(Boolean))]
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

function accessionOhneBindestriche(accession: string): string {
  return accession.replace(/-/g, '')
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

function waehleExhibit(items: EdgarIndexItem[]): { item: EdgarIndexItem; typ: 'EX-99.2' | 'EX-99.1' } | null {
  const norm = (s: string) => s.toLowerCase()
  const ex992 = items.filter((i) => {
    const type = norm(i.type || '')
    const desc = norm(i.description || '')
    const name = norm(i.name || '')
    return (
      type.includes('99.2') ||
      desc.includes('transcript') ||
      name.includes('ex99.2') ||
      name.includes('ex-99.2')
    )
  })
  if (ex992[0]?.name) return { item: ex992[0], typ: 'EX-99.2' }

  const ex991 = items.filter((i) => {
    const type = norm(i.type || '')
    const desc = norm(i.description || '')
    return type.includes('99.1') || desc.includes('press release') || desc.includes('earnings')
  })
  if (ex991[0]?.name) return { item: ex991[0], typ: 'EX-99.1' }

  return null
}

async function ladeExhibitText(
  cik: number,
  accession: string,
  filename: string,
): Promise<string> {
  const cikNum = cik
  const accPath = accessionOhneBindestriche(accession)
  const url = `https://www.sec.gov/Archives/edgar/data/${cikNum}/${accPath}/${filename}`
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
  const out: EdgarTranscript[] = []
  const seenAcc = new Set<string>()

  for (let i = 0; i < maxScan && out.length < max; i++) {
    if (forms[i] !== '8-K') continue
    const accession = recent.accessionNumber?.[i]
    const filingDate = recent.filingDate?.[i]
    if (!accession || seenAcc.has(accession)) continue
    seenAcc.add(accession)

    await sleep(120)
    const indexUrl = `https://www.sec.gov/Archives/edgar/data/${cik}/${accessionOhneBindestriche(accession)}/${accession}-index.json`
    const idxRes = await secFetch(indexUrl)
    if (!idxRes.ok) continue
    const idx = await leseAlsJson<EdgarIndex>(idxRes)
    if (!idx) continue
    const picked = waehleExhibit(indexItems(idx))
    if (!picked?.item.name) continue

    const text = await ladeExhibitText(cik, accession, picked.item.name)
    if (text.length < 400) continue

    const exhibitLabel = picked.typ === 'EX-99.2' ? 'Earnings Call Transcript' : 'Earnings Press Release'
    const docUrl = `https://www.sec.gov/Archives/edgar/data/${cik}/${accessionOhneBindestriche(accession)}/${picked.item.name}`

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
      `${tickerRaw}: Kein SEC-Transkript gefunden (nur US-SEC-Melder). Für EU-Aktien wird die IR-Seite per Playwright durchsucht.`,
    )
  }
  return list[0]
}
