/**
 * SEC EDGAR Form 4 — Insider-Käufe.
 *
 * Verwendet die kostenlose EDGAR Submissions API:
 *   https://data.sec.gov/submissions/CIK{10-digit}.json
 *
 * Für jede Form-4-Einreichung wird das XML-Dokument geparst und
 * Akquisitionen (transactionCode = 'P' für Open-Market-Purchase)
 * der letzten 90 Tage extrahiert.
 *
 * Nur für US-Unternehmen mit bekannter CIK (in der Whitelist hinterlegt).
 */

import 'server-only'

import type { InsiderKauf, NachkaufScanEintrag } from './nachkauf-radar-types'
import type { WhitelistPosition } from './nachkauf-radar-whitelist'

const EDGAR_BASE = 'https://data.sec.gov'
const TAGE_RUECKBLICK = 90

/**
 * SEC EDGAR erwartet einen User-Agent nach dem Schema:
 *   "Firmenname/App name <kontakt@email.com>"
 * Wird aus EDGAR_USER_AGENT in .env.local gelesen.
 * Fallback auf generischen User-Agent (funktioniert, aber bitte in .env.local anpassen).
 */
const EDGAR_USER_AGENT =
  process.env.EDGAR_USER_AGENT ?? 'Mein-Haushalt-Portfolio-App meinhaushalt@haushalt.app'

const EDGAR_HEADERS = {
  'User-Agent': EDGAR_USER_AGENT,
  Accept: 'application/json',
}

/** Gibt das ISO-Datum von vor N Tagen zurück (YYYY-MM-DD). */
function datumVorTagen(tage: number): string {
  const d = new Date()
  d.setDate(d.getDate() - tage)
  return d.toISOString().slice(0, 10)
}

/** Holt die neuesten Form-4-Einreichungen (accessionNumber, fileDate) aus EDGAR. */
async function ladeNeuesteForm4(cik: string): Promise<Array<{ acc: string; datum: string; doc: string }>> {
  const url = `${EDGAR_BASE}/submissions/CIK${cik}.json`
  try {
    const res = await fetch(url, { headers: EDGAR_HEADERS, next: { revalidate: 3600 } })
    if (!res.ok) return []
    const json = await res.json()
    const recent = json?.filings?.recent
    if (!recent) return []

    const { form = [], accessionNumber = [], filingDate = [], primaryDocument = [] } = recent as Record<string, string[]>
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

/** Parst ein Form-4-XML und gibt Open-Market-Käufe zurück. */
function parseForm4Xml(xml: string, datum: string): InsiderKauf[] {
  const kaeufe: InsiderKauf[] = []

  // Insider-Name
  const nameMatch = xml.match(/<rptOwnerName>\s*(.+?)\s*<\/rptOwnerName>/i)
  const name = nameMatch?.[1] ?? 'Unbekannt'

  // Titel (Funktion)
  const titelMatch = xml.match(/<officerTitle>\s*(.+?)\s*<\/officerTitle>/i)
  const titel = titelMatch?.[1] ?? ''

  // Alle Non-Derivative Transaktionen parsen
  const txBlocks = [...xml.matchAll(/<nonDerivativeTransaction>([\s\S]*?)<\/nonDerivativeTransaction>/gi)]

  for (const block of txBlocks) {
    const tx = block[1]

    // Code 'P' = Open Market Purchase
    const codeMatch = tx.match(/<transactionCode>\s*([A-Z])\s*<\/transactionCode>/i)
    if (codeMatch?.[1]?.toUpperCase() !== 'P') continue

    // A = Acquired
    const adCode = tx.match(/<transactionAcquiredDisposedCode>\s*<value>\s*([AD])\s*<\/value>/i)
    if (adCode?.[1]?.toUpperCase() !== 'A') continue

    const shares = parseFloat(tx.match(/<transactionShares>\s*<value>\s*([\d.,]+)\s*<\/value>/i)?.[1]?.replace(',', '') ?? '0')
    const price = parseFloat(tx.match(/<transactionPricePerShare>\s*<value>\s*([\d.,]+)\s*<\/value>/i)?.[1]?.replace(',', '') ?? '0')

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

/** Lädt Form-4-Käufe für eine CIK (max. 8 neueste Einreichungen). */
async function ladeInsiderKaeufe(cik: string): Promise<InsiderKauf[]> {
  const form4Liste = await ladeNeuesteForm4(cik)
  if (form4Liste.length === 0) return []

  const alle: InsiderKauf[] = []
  const cikOhneNullen = cik.replace(/^0+/, '')

  // Parallel, aber max. 8 Dokumente
  const zuVerarbeiten = form4Liste.slice(0, 8)
  await Promise.allSettled(
    zuVerarbeiten.map(async ({ acc, datum, doc }) => {
      if (!doc) return
      const xmlUrl = `${EDGAR_BASE}/Archives/edgar/data/${cikOhneNullen}/${acc}/${doc}`
      try {
        const res = await fetch(xmlUrl, { headers: EDGAR_HEADERS, next: { revalidate: 3600 } })
        if (!res.ok) return
        const xml = await res.text()
        const kaeufe = parseForm4Xml(xml, datum)
        alle.push(...kaeufe)
      } catch {
        // ignorieren — einzelne Fehler nicht propagieren
      }
    }),
  )

  return alle
}

/**
 * Reichert Scan-Einträge mit Insider-Käufen an.
 * Verarbeitet nur Einträge mit bekannter CIK (US-Unternehmen).
 * Laufzeit: parallel, max. 5 Unternehmen gleichzeitig.
 */
export async function ergaenzeInsiderKaeufe(
  eintraege: NachkaufScanEintrag[],
  whitelist: WhitelistPosition[],
): Promise<void> {
  const cikMap = new Map(whitelist.filter((p) => p.cik).map((p) => [p.isin, p.cik!]))

  // Einträge mit CIK
  const mitCik = eintraege.filter((e) => cikMap.has(e.isin))
  if (mitCik.length === 0) return

  // In Batches von 5 verarbeiten (Rate-Limiting EDGAR)
  const BATCH = 5
  for (let i = 0; i < mitCik.length; i += BATCH) {
    const batch = mitCik.slice(i, i + BATCH)
    await Promise.allSettled(
      batch.map(async (e) => {
        const cik = cikMap.get(e.isin)!
        try {
          e.insiderKaeufe = await ladeInsiderKaeufe(cik)
        } catch {
          e.insiderKaeufe = []
        }
      }),
    )
    // Kurze Pause zwischen Batches (EDGAR Rate-Limit: 10 req/s)
    if (i + BATCH < mitCik.length) await new Promise((r) => setTimeout(r, 1200))
  }
}
