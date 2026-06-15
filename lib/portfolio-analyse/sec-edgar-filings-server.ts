/** SEC EDGAR — 10-Q / 10-K Primärdokumente (US-Börsen). */

import 'server-only'

import { jsonParseFehlerNachricht, leseAlsJson } from '@/lib/http/safe-json-response'
import { ladeLesbarenBerichtText } from '@/lib/portfolio-analyse/sec-edgar-bericht-text-server'

export type EdgarFilingRoh = {
  formular: '10-Q' | '10-K'
  accession: string
  filingDatum: string | null
  berichtszeitraum: string | null
  primaryDocument: string
  firmenname: string
}

const MAX_FILINGS = 14
const AUSZUG_ZEICHEN = 4_000

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

function padCik(cik: number): string {
  return String(cik).padStart(10, '0')
}

function dokumentUrl(cik: number, accession: string, dateiname: string): string {
  if (/^https?:\/\//i.test(dateiname)) return dateiname
  const accPath = accessionOhneBindestriche(accession)
  return `https://www.sec.gov/Archives/edgar/data/${cik}/${accPath}/${dateiname}`
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

type SubmissionsRecent = {
  accessionNumber?: string[]
  form?: string[]
  filingDate?: string[]
  reportDate?: string[]
  primaryDocument?: string[]
}

async function ladeDokumentText(
  cik: number,
  accession: string,
  formular: '10-Q' | '10-K',
  dateiname: string,
): Promise<{ text: string; url: string } | null> {
  const hit = await ladeLesbarenBerichtText(cik, accession, formular, dateiname)
  if (hit) return { text: hit.text, url: hit.url }
  return null
}

function labelAusFiling(f: EdgarFilingRoh): string {
  const periode = f.berichtszeitraum ?? f.filingDatum ?? ''
  const jahr = periode.slice(0, 4)
  if (f.formular === '10-K') return `Jahresbericht ${jahr || f.filingDatum || ''}`
  const m = periode.match(/-(0[1-9]|1[0-2])-/)
  const monat = m ? parseInt(m[1], 10) : null
  const q =
    monat != null ? (monat <= 3 ? 1 : monat <= 6 ? 2 : monat <= 9 ? 3 : 4) : null
  return q != null ? `Q${q} ${jahr}` : `Quartalsbericht ${periode || f.filingDatum || ''}`
}

function idAusFiling(f: EdgarFilingRoh): string {
  return `${f.accession}-${f.formular}`
}

async function sleep(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms))
}

/** SEC-10-Q/10-K-Historie für US-Ticker. */
export async function ladeSecEdgarBerichteHistorie(
  tickerRaw: string,
  opts?: { max?: number; accessionVolltext?: string | null },
): Promise<{ firmenname: string; cik: number; berichte: EdgarFilingRoh[]; texte: Map<string, string>; urls: Map<string, string> }> {
  const cik = await cikFuerTicker(tickerRaw)
  if (!cik) return { firmenname: tickerRaw.toUpperCase(), cik: 0, berichte: [], texte: new Map(), urls: new Map() }

  const subUrl = `https://data.sec.gov/submissions/CIK${padCik(cik)}.json`
  const subRes = await secFetch(subUrl)
  if (!subRes.ok) return { firmenname: tickerRaw.toUpperCase(), cik, berichte: [], texte: new Map(), urls: new Map() }

  const sub = await leseAlsJson<{ name?: string; filings?: { recent?: SubmissionsRecent } }>(subRes)
  if (!sub) return { firmenname: tickerRaw.toUpperCase(), cik, berichte: [], texte: new Map(), urls: new Map() }

  const recent = sub.filings?.recent
  const firmenname = sub.name?.trim() || tickerRaw.toUpperCase()
  if (!recent?.form?.length) return { firmenname, cik, berichte: [], texte: new Map(), urls: new Map() }

  const max = opts?.max ?? MAX_FILINGS
  const roh: EdgarFilingRoh[] = []
  const seen = new Set<string>()

  for (let i = 0; i < recent.form.length && roh.length < max; i++) {
    const form = recent.form[i]
    if (form !== '10-Q' && form !== '10-K') continue
    const accession = recent.accessionNumber?.[i]
    const primary = recent.primaryDocument?.[i]
    if (!accession || !primary || seen.has(accession)) continue
    seen.add(accession)
    roh.push({
      formular: form,
      accession,
      filingDatum: recent.filingDate?.[i] ?? null,
      berichtszeitraum: recent.reportDate?.[i] ?? null,
      primaryDocument: primary,
      firmenname,
    })
  }

  const texte = new Map<string, string>()
  const urls = new Map<string, string>()
  const vollAcc = opts?.accessionVolltext?.trim()
  const zuLaden = vollAcc ? roh.filter((r) => r.accession === vollAcc) : []

  for (const f of zuLaden) {
    await sleep(120)
    try {
      const hit = await ladeDokumentText(cik, f.accession, f.formular, f.primaryDocument)
      if (hit && hit.text.length > 200) {
        texte.set(f.accession, hit.text)
        urls.set(f.accession, hit.url)
      }
    } catch {
      /* nächster */
    }
  }

  return { firmenname, cik, berichte: roh, texte, urls }
}

export function baueSecBerichtEintrag(
  f: EdgarFilingRoh,
  cik: number,
  text: string | undefined,
  vollstaendig: boolean,
  dokumentUrlOverride?: string,
): import('@/lib/portfolio-analyse/sec-berichte-types').SecBerichtEintrag {
  const url = dokumentUrlOverride ?? dokumentUrl(cik, f.accession, f.primaryDocument)
  const voll = text ?? ''
  const auszug = voll.slice(0, AUSZUG_ZEICHEN)
  return {
    id: idAusFiling(f),
    formular: f.formular,
    label: labelAusFiling(f),
    filingDatum: f.filingDatum,
    berichtszeitraum: f.berichtszeitraum,
    url,
    quelle: 'sec_edgar',
    accession: f.accession,
    textAuszug: auszug,
    textZeichen: voll.length,
    textVollstaendig: vollstaendig && voll.length > AUSZUG_ZEICHEN,
    zusammenfassung: null,
  }
}

export async function ladeSecEdgarBerichtVolltext(
  tickerRaw: string,
  accession: string,
): Promise<{ text: string; eintrag: import('@/lib/portfolio-analyse/sec-berichte-types').SecBerichtEintrag } | null> {
  const { firmenname: _, cik, berichte, texte, urls } = await ladeSecEdgarBerichteHistorie(tickerRaw, {
    accessionVolltext: accession,
  })
  const f = berichte.find((b) => b.accession === accession)
  const text = texte.get(accession)
  if (!f || !text || cik === 0) return null
  return { text, eintrag: baueSecBerichtEintrag(f, cik, text, true, urls.get(accession)) }
}
