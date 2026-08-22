/**
 * AMF Directors' Dealings (Frankreich) — Mirror transactions-amf.swaoo.com.
 * Liefert Insider-Netto 90d für FR-ISINs (z. B. Hermès), wenn SEC Form 4 fehlt.
 */

import 'server-only'

import type { InsiderNettoPaket } from '@/lib/portfolio-analyse/fundamentaldaten-erweitert-types'
import type { InsiderTransaktion } from '@/lib/portfolio-analyse/insider-transaktionen-types'
import { heuteIsoUtc, tageZwischenIso } from '@/lib/portfolio-analyse/dividenden-datum-hilfen'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

const AMF_URL = 'https://transactions-amf.swaoo.com/'
const CACHE_MS = 6 * 60 * 60 * 1000
const cache = new Map<string, { at: number; txs: InsiderTransaktion[] }>()

/** Kuratierte AMF-Suchnamen (Société). */
const AMF_SOCIETE_BY_ISIN: Record<string, string> = {
  FR0000052292: 'HERMES INTERNATIONAL',
  FR0000121014: 'LVMH',
  FR0000120321: 'L OREAL',
  FR0000120578: 'SANOFI',
  FR0000121972: 'SCHNEIDER ELECTRIC',
  FR0000125486: 'VINCI',
  FR0000131104: 'BNP PARIBAS',
  FR0000127771: 'VIVENDI',
  FR0000120693: 'PERNOD RICARD',
  FR0000121261: 'DANONE',
  FR0014003TT8: 'DASSAULT SYSTEMES',
}

function parseFrDatum(raw: string): string | null {
  const m = raw.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (!m) return null
  return `${m[3]}-${m[2]}-${m[1]}`
}

function parseFrZahl(raw: string): number | null {
  const n = Number(
    raw
      .replace(/\u00a0/g, ' ')
      .replace(/\s/g, '')
      .replace(/€/g, '')
      .replace(/,/g, '.')
      .replace(/[^\d.-]/g, ''),
  )
  return Number.isFinite(n) ? n : null
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

function typAusNature(nature: string): InsiderTransaktion['typ'] {
  const n = nature.toLowerCase()
  if (/cession|vente|sale|disposal/.test(n)) return 'verkauf'
  if (/acquisition|achat|purchase|souscription/.test(n)) return 'kauf'
  return 'sonstiges'
}

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&euro;/g, '€')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
}

/** Parst AMF-Tabellenzeilen (+ Detail-Collapse für Autor). */
export function parseAmfTransaktionenHtml(html: string, isin: string): InsiderTransaktion[] {
  const isinU = isin.toUpperCase()
  const out: InsiderTransaktion[] = []
  const rowRe = /<tr>([\s\S]*?)<\/tr>/gi
  let rowM: RegExpExecArray | null
  while ((rowM = rowRe.exec(html)) !== null) {
    const row = rowM[1]!
    if (/class="collapse"|<th\b/i.test(row)) continue
    const cells = [...row.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((c) =>
      decodeEntities(stripTags(c[1]!)),
    )
    if (cells.length < 6) continue
    const isinCell = cells.find((c) => /^[A-Z]{2}[A-Z0-9]{9}\d$/.test(c.trim())) ?? ''
    if (isinCell && isinCell.toUpperCase() !== isinU) continue
    // Spalten: Société | Date pub | Date op | Nature | Instrument | ISIN | Volume | Prix | Montant
    const nature =
      cells.find((c) => /Acquisition|Cession|Souscription|Vente/i.test(c)) ?? cells[3] ?? ''
    const typ = typAusNature(nature)
    if (typ === 'sonstiges') continue
    // Pub- + Op-Datum → früheres Datum = Operation
    const daten = cells.map((c) => parseFrDatum(c)).filter((d): d is string => d != null)
    const datumOp = daten.length >= 2 ? daten.sort()[0]! : (daten[0] ?? null)
    const zahlen = cells
      .map((c) => parseFrZahl(c))
      .filter((n): n is number => n != null && Number.isFinite(n))
    // Volume (Aktien), Preis (€), Montant (€) — typisch steigend in Magnitude außer Preis
    const volume =
      zahlen.find((n) => n >= 1 && n < 500_000 && Number.isInteger(Math.round(n))) ??
      zahlen.find((n) => n >= 1 && n < 500_000) ??
      null
    const preis = zahlen.find((n) => n > 5 && n < 20_000) ?? null
    const montant = [...zahlen].sort((a, b) => b - a).find((n) => n >= 1_000) ?? null

    const detId = row.match(/data-target="#(DET[^"]+)"/i)?.[1]
    let person = 'Dirigeant / PDMR'
    if (detId) {
      const det = html.match(new RegExp(`id="${detId}"[\\s\\S]*?<\\/tr>`, 'i'))?.[0] ?? ''
      const auteur = det.match(/Auteur\s*:?\s*<\/strong>\s*([^<]+)/i)?.[1]
      if (auteur) person = decodeEntities(stripTags(auteur)).slice(0, 120)
    }

    const idBase = detId ?? `${datumOp ?? 'x'}-${typ}-${volume ?? 0}`
    out.push({
      id: `amf-${Buffer.from(idBase).toString('base64url').slice(0, 16)}`,
      datum: datumOp,
      person,
      titel: null,
      typ,
      aktien: volume,
      preisUsd: preis,
      wertUsd: montant,
      quelle: 'eu_amf',
      url: AMF_URL,
      hinweis: nature.slice(0, 80),
    })
  }
  return out
}

async function fetchAmfHtml(societe: string, isin: string): Promise<string | null> {
  const body = new URLSearchParams({
    f_page: '1',
    f_societes: societe,
    f_isin: isin,
  })
  try {
    const res = await fetch(AMF_URL, {
      method: 'POST',
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
      cache: 'no-store',
    })
    if (!res.ok) return null
    return await res.text()
  } catch {
    return null
  }
}

export async function ladeAmfInsiderTransaktionen(opts: {
  isin: string
  firmenname?: string | null
}): Promise<InsiderTransaktion[]> {
  const isin = opts.isin.trim().toUpperCase()
  if (!isin.startsWith('FR') || isin.length < 12) return []

  const hit = cache.get(isin)
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.txs

  const societe =
    AMF_SOCIETE_BY_ISIN[isin] ??
    (opts.firmenname?.trim().toUpperCase().replace(/[^A-Z0-9 ]+/g, ' ').slice(0, 40) || '')
  if (!societe) return []

  const html = await fetchAmfHtml(societe, isin)
  if (!html) return []

  const txs = parseAmfTransaktionenHtml(html, isin)
    .filter((t) => t.datum)
    .sort((a, b) => (b.datum ?? '').localeCompare(a.datum ?? ''))

  cache.set(isin, { at: Date.now(), txs })
  return txs
}

export async function ladeAmfInsiderNetto90d(opts: {
  isin: string
  firmenname?: string | null
}): Promise<InsiderNettoPaket | null> {
  const txs = await ladeAmfInsiderTransaktionen(opts)
  if (txs.length === 0) return null

  const heute = heuteIsoUtc()
  const recent = txs.filter((t) => t.datum && tageZwischenIso(t.datum, heute) <= 90)
  let kaeufe = 0
  let verkaeufe = 0
  let nettoWert = 0
  let hatWert = false
  for (const t of recent) {
    if (t.typ === 'kauf') {
      kaeufe++
      if (t.wertUsd != null) {
        nettoWert += t.wertUsd
        hatWert = true
      }
    } else if (t.typ === 'verkauf') {
      verkaeufe++
      if (t.wertUsd != null) {
        nettoWert -= t.wertUsd
        hatWert = true
      }
    }
  }

  const netto = kaeufe - verkaeufe
  return {
    kaeufe90d: kaeufe,
    verkaeufe90d: verkaeufe,
    nettoWertUsd90d: hatWert ? Math.round(nettoWert) : null,
    nettoRichtung: netto > 0 ? 'kauf' : netto < 0 ? 'verkauf' : 'neutral',
    letzterTrade: recent[0]?.datum ?? txs[0]?.datum ?? null,
    quelle: 'eu_amf',
  }
}
