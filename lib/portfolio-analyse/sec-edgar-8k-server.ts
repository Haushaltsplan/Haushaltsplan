/** SEC EDGAR — 8-K Material Events (US). */

import 'server-only'

import { htmlZuFliesstext } from '@/lib/html/text-aus-html'
import { leseAlsJson } from '@/lib/http/safe-json-response'
import type { MaterialEventEintrag, MaterialEventKategorie } from '@/lib/portfolio-analyse/material-events-types'

const MAX_8K = 16
const AUSZUG_ZEICHEN = 2_400

type SubmissionsRecent = {
  accessionNumber?: string[]
  form?: string[]
  filingDate?: string[]
  primaryDocument?: string[]
  items?: string[]
}

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

let tickerCikCache: Map<string, number> | null = null
let tickerCikLoadedAt = 0

async function secFetch(url: string): Promise<Response> {
  return fetch(url, {
    headers: { 'User-Agent': secUserAgent(), Accept: 'application/json, text/html, */*' },
    cache: 'no-store',
  })
}

async function cikFuerTicker(ticker: string): Promise<number | null> {
  if (!tickerCikCache || Date.now() - tickerCikLoadedAt > 24 * 60 * 60 * 1000) {
    const res = await secFetch('https://www.sec.gov/files/company_tickers.json')
    if (!res.ok) return null
    const raw = await leseAlsJson<Record<string, { cik_str?: number; ticker?: string }>>(res)
    tickerCikCache = new Map()
    for (const row of Object.values(raw ?? {})) {
      if (row.ticker && row.cik_str) tickerCikCache.set(row.ticker.toUpperCase(), row.cik_str)
    }
    tickerCikLoadedAt = Date.now()
  }
  for (const v of normalisiereUsTicker(ticker)) {
    const hit = tickerCikCache!.get(v)
    if (hit) return hit
  }
  return null
}

function padCik(cik: number): string {
  return String(cik).padStart(10, '0')
}

function dokumentUrl(cik: number, accession: string, dateiname: string): string {
  const accPath = accession.replace(/-/g, '')
  return `https://www.sec.gov/Archives/edgar/data/${cik}/${accPath}/${dateiname}`
}

function kategorieAusText(text: string, items?: string): MaterialEventKategorie {
  const kombi = `${text} ${items ?? ''}`.toLowerCase()
  if (/\b(item\s*2\.0?2|guidance|outlook|forecast|expects)\b/i.test(kombi)) return 'guidance'
  if (/\b(item\s*5\.0?2|chief executive|ceo|cfo|director|officer|resign|appoint)\b/i.test(kombi)) {
    return 'management'
  }
  if (/\b(item\s*1\.0?1|acquisition|merger|definitive agreement|purchase agreement)\b/i.test(kombi)) {
    return 'm_a'
  }
  if (/\b(restructur|workforce reduction|layoff|severance|impairment)\b/i.test(kombi)) return 'restrukturierung'
  if (/\b(item\s*2\.0?2|results of operations|earnings release|financial results)\b/i.test(kombi)) {
    return 'finanzergebnis'
  }
  if (/\b(item\s*8\.0?1|regulatory|sec investigation|litigation)\b/i.test(kombi)) return 'regulatorisch'
  return 'sonstiges'
}

function titelAusKategorie(k: MaterialEventKategorie, datum: string | null): string {
  const d = datum ? ` (${datum})` : ''
  const map: Record<MaterialEventKategorie, string> = {
    guidance: `Guidance / Outlook${d}`,
    management: `Management-Wechsel${d}`,
    m_a: `M&A / Übernahme${d}`,
    restrukturierung: `Restrukturierung${d}`,
    finanzergebnis: `Finanzergebnis / 8-K${d}`,
    regulatorisch: `Regulatorisch / Recht${d}`,
    sonstiges: `Material Event${d}`,
  }
  return map[k]
}

async function lade8kAuszug(cik: number, accession: string, primary: string): Promise<string> {
  const url = dokumentUrl(cik, accession, primary)
  const res = await secFetch(url)
  if (!res.ok) return ''
  const raw = await res.text()
  const text = /\.(htm|html)$/i.test(primary) ? htmlZuFliesstext(raw) : raw.replace(/\s+/g, ' ').trim()
  return text.slice(0, AUSZUG_ZEICHEN)
}

export async function ladeSec8KMaterialEvents(ticker: string): Promise<MaterialEventEintrag[]> {
  const cik = await cikFuerTicker(ticker)
  if (!cik) return []

  const subRes = await secFetch(`https://data.sec.gov/submissions/CIK${padCik(cik)}.json`)
  if (!subRes.ok) return []

  const sub = await leseAlsJson<{ filings?: { recent?: SubmissionsRecent } }>(subRes)
  const recent = sub?.filings?.recent
  if (!recent?.form?.length) return []

  const out: MaterialEventEintrag[] = []
  const seen = new Set<string>()

  for (let i = 0; i < recent.form.length && out.length < MAX_8K; i++) {
    if (recent.form[i] !== '8-K') continue
    const accession = recent.accessionNumber?.[i]
    const primary = recent.primaryDocument?.[i]
    const datum = recent.filingDate?.[i] ?? null
    const itemsRaw = recent.items?.[i]
    if (!accession || !primary || seen.has(accession)) continue
    seen.add(accession)

    const auszug = await lade8kAuszug(cik, accession, primary)
    if (auszug.length < 80) continue

    const kat = kategorieAusText(auszug, itemsRaw)
    const items = itemsRaw?.split(',').map((s) => s.trim()).filter(Boolean)

    out.push({
      id: `8k-${accession}`,
      titel: titelAusKategorie(kat, datum),
      kategorie: kat,
      quelle: 'sec_8k',
      datum,
      url: dokumentUrl(cik, accession, primary),
      textAuszug: auszug,
      items,
    })
  }

  return out
}
