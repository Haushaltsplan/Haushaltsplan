/** SEC EDGAR — Form 4 Insider-Transaktionen (US). */

import 'server-only'

import {
  cikFuerTicker,
  dokumentUrl,
  ladeSecSubmissionsRecent,
  padCik,
  secFetch,
} from '@/lib/portfolio-analyse/sec-edgar-common-server'
import type { InsiderTransaktion, InsiderTransaktionTyp } from '@/lib/portfolio-analyse/insider-transaktionen-types'

const MAX_FILINGS = 24
const MAX_TX = 20

function tagWert(xml: string, tag: string): string | null {
  const m = xml.match(new RegExp(`<${tag}[^>]*>\\s*<value>([^<]+)</value>`, 'i'))
  if (m?.[1]) return m[1].trim()
  const m2 = xml.match(new RegExp(`<${tag}[^>]*>([^<]+)</${tag}>`, 'i'))
  return m2?.[1]?.trim() ?? null
}

function tagDirekt(xml: string, tag: string): string | null {
  const m = xml.match(new RegExp(`<${tag}[^>]*>([^<]+)</${tag}>`, 'i'))
  return m?.[1]?.trim() ?? null
}

function typAusCode(code: string | null, acquired: string | null): InsiderTransaktionTyp {
  const c = (code ?? '').toUpperCase()
  const ad = (acquired ?? '').toUpperCase()
  if (c === 'P' || (c === 'A' && ad === 'A')) return 'kauf'
  if (c === 'S' || (c === 'D' && ad === 'D') || c === 'F') return 'verkauf'
  if (ad === 'A') return 'kauf'
  if (ad === 'D') return 'verkauf'
  return 'sonstiges'
}

function parseForm4Xml(xml: string, meta: {
  cik: number
  accession: string
  filingDatum: string | null
  url: string
}): InsiderTransaktion[] {
  const person = tagDirekt(xml, 'rptOwnerName') ?? 'Insider'
  const titel = tagDirekt(xml, 'officerTitle') ?? tagDirekt(xml, 'officerTitle') ?? null
  const out: InsiderTransaktion[] = []

  const bloecke = xml.split(/<nonDerivativeTransaction>/i).slice(1)
  for (const block of bloecke) {
    const chunk = block.split(/<\/nonDerivativeTransaction>/i)[0] ?? block
    const code = tagDirekt(chunk, 'transactionCode')
    const acquired = tagDirekt(chunk, 'transactionAcquiredDisposedCode')
    const typ = typAusCode(code, acquired)
    if (typ === 'sonstiges') continue

    const sharesRaw = tagWert(chunk, 'transactionShares')
    const priceRaw = tagWert(chunk, 'transactionPricePerShare')
    const dateRaw = tagWert(chunk, 'transactionDate') ?? meta.filingDatum
    const shares = sharesRaw != null ? Number(sharesRaw) : null
    const preis = priceRaw != null ? Number(priceRaw) : null
    const wert = shares != null && preis != null ? shares * preis : null

    out.push({
      id: `f4-${meta.accession}-${out.length}`,
      datum: dateRaw,
      person,
      titel,
      typ,
      aktien: shares != null && Number.isFinite(shares) ? shares : null,
      preisUsd: preis != null && Number.isFinite(preis) ? preis : null,
      wertUsd: wert != null && Number.isFinite(wert) ? wert : null,
      quelle: 'sec_form4',
      url: meta.url,
      hinweis: code ? `Code ${code}` : null,
    })
  }

  return out
}

async function ladeForm4Transaktionen(
  cik: number,
  accession: string,
  primary: string,
  filingDatum: string | null,
): Promise<InsiderTransaktion[]> {
  const url = dokumentUrl(cik, accession, primary)
  const res = await secFetch(url)
  if (!res.ok) return []
  const xml = await res.text()
  if (xml.length < 100) return []
  return parseForm4Xml(xml, { cik, accession, filingDatum, url })
}

export async function ladeSecForm4InsiderTransaktionen(ticker: string): Promise<InsiderTransaktion[]> {
  const cik = await cikFuerTicker(ticker)
  if (!cik) return []

  const recent = await ladeSecSubmissionsRecent(cik)
  if (!recent?.form?.length) return []

  const out: InsiderTransaktion[] = []
  const seen = new Set<string>()
  let filings = 0

  for (let i = 0; i < recent.form.length && filings < MAX_FILINGS && out.length < MAX_TX; i++) {
    const form = recent.form[i]
    if (form !== '4' && form !== '4/A') continue
    const accession = recent.accessionNumber?.[i]
    const primary = recent.primaryDocument?.[i]
    const datum = recent.filingDate?.[i] ?? null
    if (!accession || !primary || seen.has(accession)) continue
    seen.add(accession)
    filings++

    const txs = await ladeForm4Transaktionen(cik, accession, primary, datum)
    for (const tx of txs) {
      if (out.length >= MAX_TX) break
      out.push(tx)
    }
  }

  out.sort((a, b) => (b.datum ?? '').localeCompare(a.datum ?? ''))
  return out
}
