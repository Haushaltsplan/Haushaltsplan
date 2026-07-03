/**
 * Insider-Käufe für den Nachkauf-Radar.
 * US: OpenInsider (primär) + SEC Form 4 (Fallback mit CIK).
 * EU: Directors' Dealings via IR-Scrape.
 */

import 'server-only'

import { ladeEuInsiderDealings } from '@/lib/portfolio-analyse/eu-insider-dealing-server'
import { isinKenntnis } from '@/lib/portfolio-analyse/isin-kenntnisse'
import { ladeInsiderKauefeFuerSymbol } from '@/lib/portfolio-analyse/momentum-trader/momentum-insider-server'
import type { InsiderKauf, NachkaufScanEintrag } from './nachkauf-radar-types'
import type { WhitelistPosition } from './nachkauf-radar-whitelist'

const EDGAR_BASE = 'https://data.sec.gov'
const TAGE_RUECKBLICK = 90

const EDGAR_USER_AGENT =
  process.env.EDGAR_USER_AGENT ?? 'Mein-Haushalt-Portfolio-App meinhaushalt@haushalt.app'

const EDGAR_HEADERS = {
  'User-Agent': EDGAR_USER_AGENT,
  Accept: 'application/json',
}

function datumVorTagen(tage: number): string {
  const d = new Date()
  d.setDate(d.getDate() - tage)
  return d.toISOString().slice(0, 10)
}

function innerhalbFenster(datum: string): boolean {
  return datum >= datumVorTagen(TAGE_RUECKBLICK)
}

async function ladeNeuesteForm4(cik: string): Promise<Array<{ acc: string; datum: string; doc: string }>> {
  const url = `${EDGAR_BASE}/submissions/CIK${cik}.json`
  try {
    const res = await fetch(url, { headers: EDGAR_HEADERS, next: { revalidate: 3600 } })
    if (!res.ok) return []
    const json = await res.json()
    const recent = json?.filings?.recent
    if (!recent) return []

    const { form = [], accessionNumber = [], filingDate = [], primaryDocument = [] } = recent as Record<
      string,
      string[]
    >
    const grenze = datumVorTagen(TAGE_RUECKBLICK)
    const results: Array<{ acc: string; datum: string; doc: string }> = []

    for (let i = 0; i < form.length; i++) {
      if (form[i] !== '4') continue
      if (filingDate[i] < grenze) continue
      results.push({
        acc: (accessionNumber[i] ?? '').replace(/-/g, ''),
        datum: filingDate[i],
        doc: primaryDocument[i] ?? '',
      })
    }
    return results
  } catch {
    return []
  }
}

function parseForm4Xml(xml: string, datum: string): InsiderKauf[] {
  const kaeufe: InsiderKauf[] = []
  const nameMatch = xml.match(/<rptOwnerName>\s*(.+?)\s*<\/rptOwnerName>/i)
  const name = nameMatch?.[1] ?? 'Unbekannt'
  const titelMatch = xml.match(/<officerTitle>\s*(.+?)\s*<\/officerTitle>/i)
  const titel = titelMatch?.[1] ?? ''
  const txBlocks = [...xml.matchAll(/<nonDerivativeTransaction>([\s\S]*?)<\/nonDerivativeTransaction>/gi)]

  for (const block of txBlocks) {
    const tx = block[1]
    const codeMatch = tx.match(/<transactionCode>\s*([A-Z])\s*<\/transactionCode>/i)
    if (codeMatch?.[1]?.toUpperCase() !== 'P') continue
    const adCode = tx.match(/<transactionAcquiredDisposedCode>\s*<value>\s*([AD])\s*<\/value>/i)
    if (adCode?.[1]?.toUpperCase() !== 'A') continue
    const shares = parseFloat(
      tx.match(/<transactionShares>\s*<value>\s*([\d.,]+)\s*<\/value>/i)?.[1]?.replace(',', '') ?? '0',
    )
    const price = parseFloat(
      tx.match(/<transactionPricePerShare>\s*<value>\s*([\d.,]+)\s*<\/value>/i)?.[1]?.replace(',', '') ?? '0',
    )
    if (shares <= 0) continue
    kaeufe.push({
      datum,
      name,
      titel,
      anteile: Math.round(shares),
      wertUsd: Math.round(shares * price),
    })
  }
  return kaeufe
}

async function ladeInsiderKaeufeSec(cik: string): Promise<InsiderKauf[]> {
  const form4Liste = await ladeNeuesteForm4(cik)
  if (form4Liste.length === 0) return []
  const alle: InsiderKauf[] = []
  const cikOhneNullen = cik.replace(/^0+/, '')
  await Promise.allSettled(
    form4Liste.slice(0, 8).map(async ({ acc, datum, doc }) => {
      if (!doc) return
      const xmlUrl = `${EDGAR_BASE}/Archives/edgar/data/${cikOhneNullen}/${acc}/${doc}`
      try {
        const res = await fetch(xmlUrl, { headers: EDGAR_HEADERS, next: { revalidate: 3600 } })
        if (!res.ok) return
        const xml = await res.text()
        alle.push(...parseForm4Xml(xml, datum))
      } catch {
        /* einzelne Fehler ignorieren */
      }
    }),
  )
  return alle
}

function ausOpenInsider(symbol: string): Promise<InsiderKauf[]> {
  return ladeInsiderKauefeFuerSymbol(symbol).then((rows) =>
    rows
      .filter((r) => innerhalbFenster(r.tradeDate))
      .map((r) => ({
        datum: r.tradeDate,
        name: r.insiderName,
        titel: r.title ?? '',
        anteile: Math.round(r.qty ?? 0),
        wertUsd: Math.round(r.valueUsd ?? 0),
      })),
  )
}

function ausEuDealings(ticker: string, isin: string, name: string): Promise<InsiderKauf[]> {
  return ladeEuInsiderDealings({ ticker, isin, firmenname: name }).then((txs) =>
    txs
      .filter((t) => t.typ === 'kauf' && t.datum && innerhalbFenster(t.datum.slice(0, 10)))
      .map((t) => ({
        datum: t.datum!.slice(0, 10),
        name: t.person,
        titel: t.titel ?? '',
        anteile: t.aktien ?? 0,
        wertUsd: t.wertUsd ?? 0,
      })),
  )
}

/** Insider-Käufe für eine Whitelist-Position (US + EU). */
export async function ladeInsiderKaeufeFuerPosition(
  position: WhitelistPosition,
  symbolYahoo: string | null,
): Promise<InsiderKauf[]> {
  const k = isinKenntnis(position.isin)
  const sym = (symbolYahoo ?? k?.symbolYahoo ?? position.isin).split('.')[0]!.toUpperCase()
  const isUs = position.isin.startsWith('US')

  if (isUs) {
    const oi = await ausOpenInsider(sym).catch(() => [])
    if (oi.length > 0) return oi
    if (position.cik) return ladeInsiderKaeufeSec(position.cik).catch(() => [])
    return []
  }

  return ausEuDealings(sym, position.isin, position.name).catch(() => [])
}

export function berechneInsiderScoreDelta(kaeufe: InsiderKauf[]): number {
  if (kaeufe.length === 0) return 0
  const namen = new Set(kaeufe.map((k) => k.name.toLowerCase()))
  if (namen.size >= 3) return 4
  if (kaeufe.length >= 2) return 3
  return 1
}

/**
 * Reichert Scan-Einträge mit Insider-Käufen an (alle Whitelist-Titel).
 */
export async function ergaenzeInsiderKaeufe(
  eintraege: NachkaufScanEintrag[],
  whitelist: WhitelistPosition[],
): Promise<void> {
  const posMap = new Map(whitelist.map((p) => [p.isin, p]))
  const symMap = new Map(
    whitelist.map((p) => {
      const k = isinKenntnis(p.isin)
      return [p.isin, k?.symbolYahoo ?? null] as const
    }),
  )

  const BATCH = 4
  for (let i = 0; i < eintraege.length; i += BATCH) {
    const batch = eintraege.slice(i, i + BATCH)
    await Promise.allSettled(
      batch.map(async (e) => {
        const pos = posMap.get(e.isin)
        if (!pos) {
          e.insiderKaeufe = []
          return
        }
        try {
          e.insiderKaeufe = await ladeInsiderKaeufeFuerPosition(pos, symMap.get(e.isin) ?? null)
        } catch {
          e.insiderKaeufe = []
        }
      }),
    )
    if (i + BATCH < eintraege.length) await new Promise((r) => setTimeout(r, 900))
  }
}
