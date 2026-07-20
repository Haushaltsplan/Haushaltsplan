/** SEC EDGAR — 10-Q / 10-K + 8-K Earnings Releases (US-Börsen). */

import 'server-only'

import { leseAlsJson } from '@/lib/http/safe-json-response'
import {
  labelAusReportDate,
  periodenDedupKeys,
  periodenKeyAusReportDate,
} from '@/lib/portfolio-analyse/sec-bericht-periode'
import { ladeLesbarenBerichtText } from '@/lib/portfolio-analyse/sec-edgar-bericht-text-server'
import {
  ladeEarningsReleaseFilings,
  ladeEarningsReleaseText,
} from '@/lib/portfolio-analyse/sec-edgar-earnings-release-server'
import {
  cikFuerTicker,
  dokumentUrl,
  padCik,
  secFetch,
  type SecSubmissionsRecent,
} from '@/lib/portfolio-analyse/sec-edgar-common-server'
import type { SecBerichtFormular } from '@/lib/portfolio-analyse/sec-berichte-types'

export type EdgarFilingRoh = {
  formular: Extract<SecBerichtFormular, '10-Q' | '10-K' | '8-K-ER'>
  accession: string
  filingDatum: string | null
  berichtszeitraum: string | null
  primaryDocument: string
  firmenname: string
  /** Explizites Label (v. a. 8-K-ER) */
  labelOverride?: string | null
  periodenKey?: string | null
}

const MAX_FILINGS = 14
const AUSZUG_ZEICHEN = 4_000

async function ladeDokumentText(
  cik: number,
  f: EdgarFilingRoh,
): Promise<{ text: string; url: string } | null> {
  if (f.formular === '8-K-ER') {
    return ladeEarningsReleaseText(cik, f.accession, f.primaryDocument)
  }
  const hit = await ladeLesbarenBerichtText(cik, f.accession, f.formular, f.primaryDocument)
  if (hit) return { text: hit.text, url: hit.url }
  return null
}

function labelAusFiling(f: EdgarFilingRoh): string {
  if (f.labelOverride?.trim()) return f.labelOverride.trim()
  if (f.formular === '10-Q' || f.formular === '10-K') {
    return labelAusReportDate(f.formular, f.berichtszeitraum)
  }
  return `Ergebnisbericht ${f.berichtszeitraum ?? f.filingDatum ?? ''}`
}

function idAusFiling(f: EdgarFilingRoh): string {
  return `${f.accession}-${f.formular}`
}

async function sleep(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms))
}

function sortiereNachFilingDatum(a: EdgarFilingRoh, b: EdgarFilingRoh): number {
  return (b.filingDatum ?? '').localeCompare(a.filingDatum ?? '')
}

/** SEC-10-Q/10-K-Historie + aktuelle 8-K-Ergebnisberichte für US-Ticker. */
export async function ladeSecEdgarBerichteHistorie(
  tickerRaw: string,
  opts?: { max?: number; accessionVolltext?: string | null },
): Promise<{
  firmenname: string
  cik: number
  berichte: EdgarFilingRoh[]
  texte: Map<string, string>
  urls: Map<string, string>
}> {
  const cik = await cikFuerTicker(tickerRaw)
  if (!cik) {
    return { firmenname: tickerRaw.toUpperCase(), cik: 0, berichte: [], texte: new Map(), urls: new Map() }
  }

  const subUrl = `https://data.sec.gov/submissions/CIK${padCik(cik)}.json`
  const subRes = await secFetch(subUrl)
  if (!subRes.ok) {
    return { firmenname: tickerRaw.toUpperCase(), cik, berichte: [], texte: new Map(), urls: new Map() }
  }

  const sub = await leseAlsJson<{ name?: string; filings?: { recent?: SecSubmissionsRecent } }>(subRes)
  if (!sub) {
    return { firmenname: tickerRaw.toUpperCase(), cik, berichte: [], texte: new Map(), urls: new Map() }
  }

  const recent = sub.filings?.recent
  const firmenname = sub.name?.trim() || tickerRaw.toUpperCase()
  if (!recent?.form?.length) {
    return { firmenname, cik, berichte: [], texte: new Map(), urls: new Map() }
  }

  const max = opts?.max ?? MAX_FILINGS
  const zehnQk: EdgarFilingRoh[] = []
  const seenAcc = new Set<string>()
  const periodenBelegt = new Set<string>()

  for (let i = 0; i < recent.form.length && zehnQk.length < max; i++) {
    const form = recent.form[i]
    if (form !== '10-Q' && form !== '10-K') continue
    const accession = recent.accessionNumber?.[i]
    const primary = recent.primaryDocument?.[i]
    if (!accession || !primary || seenAcc.has(accession)) continue
    seenAcc.add(accession)
    const berichtszeitraum = recent.reportDate?.[i] ?? null
    const periodenKey = periodenKeyAusReportDate(form, berichtszeitraum)
    const label10 = labelAusReportDate(form, berichtszeitraum)
    if (periodenKey) {
      periodenBelegt.add(periodenKey)
      if (form === '10-K' && berichtszeitraum && berichtszeitraum.length >= 4) {
        periodenBelegt.add(`${berichtszeitraum.slice(0, 4)}-FY`)
      }
      // Kalender-Q-Key für Dedup gegen 8-K ohne Periodenende (z. B. JPM „Q1 2026“)
      const qm = label10.match(/^Q([1-4])\s+(\d{4})$/)
      if (qm) periodenBelegt.add(`${qm[2]}-Q${qm[1]}`)
    }
    zehnQk.push({
      formular: form,
      accession,
      filingDatum: recent.filingDate?.[i] ?? null,
      berichtszeitraum,
      primaryDocument: primary,
      firmenname,
      labelOverride: label10,
      periodenKey,
    })
  }

  // 8-K Item 2.02 — Perioden-Lücken füllen (Dedup über Periodenende pe:YYYY-MM-DD).
  let releases: EdgarFilingRoh[] = []
  try {
    const er = await ladeEarningsReleaseFilings(recent, cik, firmenname)
    releases = er
      .filter((r) => {
        if (seenAcc.has(r.accession)) return false
        const keys = periodenDedupKeys({
          label: r.label,
          periodenKey: r.periodenKey,
          berichtszeitraum: r.berichtszeitraum,
        })
        return !keys.some((k) => periodenBelegt.has(k))
      })
      .map((r) => {
        for (const k of periodenDedupKeys({
          label: r.label,
          periodenKey: r.periodenKey,
          berichtszeitraum: r.berichtszeitraum,
        })) {
          periodenBelegt.add(k)
        }
        return {
          formular: '8-K-ER' as const,
          accession: r.accession,
          filingDatum: r.filingDatum,
          berichtszeitraum: r.berichtszeitraum,
          primaryDocument: r.primaryDocument,
          firmenname: r.firmenname,
          labelOverride: r.label,
          periodenKey: r.periodenKey,
        }
      })
  } catch {
    releases = []
  }

  const roh = [...zehnQk, ...releases].sort(sortiereNachFilingDatum).slice(0, max)

  const texte = new Map<string, string>()
  const urls = new Map<string, string>()
  const vollAcc = opts?.accessionVolltext?.trim()
  const zuLaden = vollAcc ? roh.filter((r) => r.accession === vollAcc) : []

  for (const f of zuLaden) {
    await sleep(120)
    try {
      const hit = await ladeDokumentText(cik, f)
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
): Promise<{
  text: string
  eintrag: import('@/lib/portfolio-analyse/sec-berichte-types').SecBerichtEintrag
} | null> {
  const { cik, berichte, texte, urls } = await ladeSecEdgarBerichteHistorie(tickerRaw, {
    accessionVolltext: accession,
  })
  const f = berichte.find((b) => b.accession === accession)
  const text = texte.get(accession)
  if (!f || !text || cik === 0) return null
  return { text, eintrag: baueSecBerichtEintrag(f, cik, text, true, urls.get(accession)) }
}
