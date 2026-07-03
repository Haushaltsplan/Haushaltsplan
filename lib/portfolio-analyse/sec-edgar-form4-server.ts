/** SEC EDGAR — Form 4 Insider-Transaktionen (US). */

import 'server-only'

import { heuteIsoUtc, tageZwischenIso } from '@/lib/portfolio-analyse/dividenden-datum-hilfen'
import type { InsiderNettoPaket } from '@/lib/portfolio-analyse/fundamentaldaten-erweitert-types'
import {
  cikFuerTicker,
  dokumentUrl,
  ladeSecSubmissionsRecent,
  secFetch,
} from '@/lib/portfolio-analyse/sec-edgar-common-server'
import type { InsiderTransaktion, InsiderTransaktionTyp } from '@/lib/portfolio-analyse/insider-transaktionen-types'

const MAX_FILINGS = 30
const MAX_TX = 40
const NETTO_FENSTER_TAGE = 90

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

/** primaryDocument zeigt oft auf XSL-HTML — echtes XML liegt im Accession-Root. */
function form4RawXmlDateiname(primaryDocument: string): string {
  const name = primaryDocument.split('/').pop()?.trim() ?? primaryDocument
  return name.toLowerCase().endsWith('.xml') ? name : 'form4.xml'
}

function typAusCode(code: string | null, acquired: string | null): InsiderTransaktionTyp {
  const c = (code ?? '').toUpperCase()
  const ad = (acquired ?? '').toUpperCase()
  if (c === 'P') return 'kauf'
  if (c === 'S') return 'verkauf'
  if (c === 'F') return 'verkauf'
  if (ad === 'A' && c === 'A') return 'kauf'
  if (ad === 'D' && c === 'D') return 'verkauf'
  return 'sonstiges'
}

function parseForm4Xml(
  xml: string,
  meta: {
    cik: number
    accession: string
    filingDatum: string | null
    url: string
  },
): InsiderTransaktion[] {
  if (!xml.includes('ownershipDocument') && !xml.includes('nonDerivativeTransaction')) return []

  const person = tagDirekt(xml, 'rptOwnerName') ?? 'Insider'
  const titel = tagDirekt(xml, 'officerTitle')
  const out: InsiderTransaktion[] = []

  const bloecke = xml.split(/<nonDerivativeTransaction>/i).slice(1)
  for (const block of bloecke) {
    const chunk = block.split(/<\/nonDerivativeTransaction>/i)[0] ?? block
    const code = tagDirekt(chunk, 'transactionCode')
    const acquired =
      tagWert(chunk, 'transactionAcquiredDisposedCode') ??
      tagDirekt(chunk, 'transactionAcquiredDisposedCode')
    const typ = typAusCode(code, acquired)
    if (typ === 'sonstiges') continue

    const sharesRaw = tagWert(chunk, 'transactionShares')
    const priceRaw = tagWert(chunk, 'transactionPricePerShare')
    const dateRaw = tagWert(chunk, 'transactionDate') ?? meta.filingDatum
    const shares = sharesRaw != null ? Number(sharesRaw) : null
    const preis = priceRaw != null ? Number(priceRaw) : null
    const wert = shares != null && preis != null && shares > 0 && preis > 0 ? shares * preis : null

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
  const rawName = form4RawXmlDateiname(primary)
  const url = dokumentUrl(cik, accession, rawName)
  const res = await secFetch(url)
  if (!res.ok) return []
  const xml = await res.text()
  if (xml.length < 200 || xml.includes('<!DOCTYPE html')) return []
  return parseForm4Xml(xml, { cik, accession, filingDatum, url })
}

function datumVorTagen(tage: number): string {
  const d = new Date()
  d.setDate(d.getDate() - tage)
  return d.toISOString().slice(0, 10)
}

async function ladeForm4TransaktionenFuerZeitraum(
  ticker: string,
  fensterTage = NETTO_FENSTER_TAGE,
): Promise<InsiderTransaktion[]> {
  const cik = await cikFuerTicker(ticker)
  if (!cik) return []

  const recent = await ladeSecSubmissionsRecent(cik)
  if (!recent?.form?.length) return []

  const grenze = datumVorTagen(fensterTage)
  const out: InsiderTransaktion[] = []
  const seen = new Set<string>()
  let filings = 0

  for (let i = 0; i < recent.form.length && filings < MAX_FILINGS; i++) {
    const form = recent.form[i]
    if (form !== '4' && form !== '4/A') continue
    const accession = recent.accessionNumber?.[i]
    const primary = recent.primaryDocument?.[i]
    const filingDatum = recent.filingDate?.[i] ?? null
    if (!accession || !primary || seen.has(accession)) continue
    if (filingDatum && filingDatum < grenze) break
    seen.add(accession)
    filings++

    const txs = await ladeForm4Transaktionen(cik, accession, primary, filingDatum)
    for (const tx of txs) {
      if (!tx.datum || tx.datum < grenze) continue
      if (tageZwischenIso(tx.datum, heuteIsoUtc()) > fensterTage) continue
      out.push(tx)
    }
  }

  out.sort((a, b) => (b.datum ?? '').localeCompare(a.datum ?? ''))
  return out
}

export async function ladeSecForm4InsiderTransaktionen(ticker: string): Promise<InsiderTransaktion[]> {
  const txs = await ladeForm4TransaktionenFuerZeitraum(ticker, 365)
  return txs.slice(0, MAX_TX)
}

export async function ladeSecInsiderNetto90d(ticker: string): Promise<InsiderNettoPaket | null> {
  const sym = ticker.trim().toUpperCase()
  if (!sym || sym.includes('.')) return null

  const txs = await ladeForm4TransaktionenFuerZeitraum(sym, NETTO_FENSTER_TAGE)
  if (txs.length === 0) {
    return {
      kaeufe90d: 0,
      verkaeufe90d: 0,
      nettoWertUsd90d: null,
      nettoRichtung: null,
      letzterTrade: null,
      quelle: 'sec_edgar',
    }
  }

  let kaeufe = 0
  let verkaeufe = 0
  let netto = 0
  let hatWert = false

  for (const tx of txs) {
    const v = tx.wertUsd ?? 0
    if (tx.wertUsd != null) hatWert = true
    if (tx.typ === 'kauf') {
      kaeufe++
      netto += v
    } else if (tx.typ === 'verkauf') {
      verkaeufe++
      netto -= v
    }
  }

  return {
    kaeufe90d: kaeufe,
    verkaeufe90d: verkaeufe,
    nettoWertUsd90d: hatWert ? Math.round(netto) : null,
    nettoRichtung:
      kaeufe + verkaeufe === 0
        ? null
        : netto > 50_000
          ? 'kauf'
          : netto < -50_000
            ? 'verkauf'
            : 'neutral',
    letzterTrade: txs[0]?.datum ?? null,
    quelle: 'sec_edgar',
  }
}

/** Nur Open-Market-Käufe (Code P) für Nachkauf-Radar. */
export async function ladeSecForm4OpenMarketKaeufe(
  ticker: string,
  fensterTage = 90,
): Promise<InsiderTransaktion[]> {
  const txs = await ladeForm4TransaktionenFuerZeitraum(ticker, fensterTage)
  return txs.filter((t) => t.typ === 'kauf' && t.hinweis === 'Code P')
}
