/**
 * Reichert Fundamentaldaten-Export mit Earnings-/SEC-Volltext + KI-Zusammenfassungen an
 * (liegt sonst nur serverseitig im Cache, nicht im Browser-JSON).
 */

import 'server-only'

import {
  ladeEarningsCallKiCacheFuerTicker,
  ladeUnternehmenCache,
} from '@/lib/portfolio-analyse/earnings-call-unternehmen-cache-server'
import { ladeSecBerichtKiCacheFuerTicker } from '@/lib/portfolio-analyse/sec-berichte-ki-cache-server'
import { parseQuartalAusText, sortiereQuartale } from '@/lib/portfolio-analyse/earnings-call-quartal'

export type EarningsExportQuartal = {
  id: string
  jahr: number
  quartal: 1 | 2 | 3 | 4
  label: string
  titel: string
  callDatum: string | null
  transcriptUrl: string
  quelle: string
  transcriptZeichen: number
  zusammenfassung: string | null
  sentimentScore: number | null
  /** Volltext Transkript (aus Server-Cache) */
  transcriptText: string | null
}

export type EarningsExportPaket = {
  ok: boolean
  ticker: string
  quelle: 'server-cache'
  quartale: EarningsExportQuartal[]
  hinweis: string
}

export type SecExportBericht = {
  id: string
  formular: string | null
  label: string | null
  filingDatum: string | null
  berichtszeitraum: string | null
  url: string | null
  accession: string | null
  zusammenfassung: string | null
  /** Kurz-/Vollauszug falls im Cache vorhanden */
  textAuszug: string | null
}

export type SecExportPaket = {
  ok: boolean
  ticker: string
  quelle: 'server-cache'
  berichte: SecExportBericht[]
  hinweis: string
}

export type FundamentalExportAnreicherung = {
  earningsCalls: EarningsExportPaket | null
  secBerichte: SecExportPaket | null
}

function tickerNorm(t: string): string {
  return t.trim().toUpperCase()
}

export async function ladeFundamentalExportAnreicherung(opts: {
  ticker: string
}): Promise<FundamentalExportAnreicherung> {
  const ticker = tickerNorm(opts.ticker)
  if (!ticker) return { earningsCalls: null, secBerichte: null }

  const [earningsCalls, secBerichte] = await Promise.all([
    ladeEarningsExportVoll(ticker),
    ladeSecExportVoll(ticker),
  ])

  return { earningsCalls, secBerichte }
}

async function ladeEarningsExportVoll(ticker: string): Promise<EarningsExportPaket | null> {
  const [cache, ki] = await Promise.all([
    ladeUnternehmenCache(ticker),
    ladeEarningsCallKiCacheFuerTicker(ticker),
  ])

  const byUrl = new Map<string, EarningsExportQuartal>()
  const byId = new Map<string, EarningsExportQuartal>()

  if (cache?.roh?.length) {
    const usedIds = new Set<string>()
    for (const r of cache.roh) {
      let urlTail = ''
      try {
        urlTail = decodeURIComponent((r.url.split('/').pop() ?? r.url).replace(/\+/g, ' '))
      } catch {
        urlTail = r.url.split('/').pop() ?? r.url
      }
      const q =
        parseQuartalAusText(r.titel, r.callDatum) ?? parseQuartalAusText(urlTail, r.callDatum)
      let id =
        q?.id ??
        (r.callDatum
          ? `unknown-${r.callDatum.slice(0, 10)}`
          : `unknown-${Buffer.from(r.url).toString('base64url').slice(0, 10)}`)
      if (usedIds.has(id)) id = `${id}-${usedIds.size}`
      usedIds.add(id)

      const kiHit =
        ki.get(id) ??
        [...ki.entries()].find(([, v]) => v.transcriptUrl === r.url)?.[1] ??
        (cache.summaries[id]
          ? {
              zusammenfassung: cache.summaries[id]!.zusammenfassung,
              transcriptUrl: cache.summaries[id]!.transcriptUrl,
              aktualisiertAm: cache.summaries[id]!.aktualisiertAm,
              sentimentScore: cache.summaries[id]!.sentimentScore ?? null,
            }
          : null)

      const eintrag: EarningsExportQuartal = {
        id,
        jahr: q?.jahr ?? (r.callDatum ? new Date(r.callDatum).getFullYear() : new Date().getFullYear()),
        quartal: (q?.quartal ?? 1) as 1 | 2 | 3 | 4,
        label: q?.label ?? `Call ${q?.jahr ?? ''}`,
        titel: r.titel,
        callDatum: r.callDatum,
        transcriptUrl: r.url,
        quelle: r.quelle,
        transcriptZeichen: r.text.length,
        zusammenfassung: kiHit?.zusammenfassung?.trim() || cache.summaries[id]?.zusammenfassung || null,
        sentimentScore: kiHit?.sentimentScore ?? cache.summaries[id]?.sentimentScore ?? null,
        transcriptText: r.text || null,
      }
      byUrl.set(r.url, eintrag)
      byId.set(id, eintrag)
    }
  }

  // KI-only Quartale (Zusammenfassung ohne Roh-Transkript im File-Cache)
  for (const [quartalId, row] of ki) {
    if (byId.has(quartalId)) continue
    const alreadyUrl = row.transcriptUrl && byUrl.has(row.transcriptUrl)
    if (alreadyUrl) continue
    const parsed = parseQuartalAusText(quartalId, null)
    byId.set(quartalId, {
      id: quartalId,
      jahr: parsed?.jahr ?? new Date().getFullYear(),
      quartal: (parsed?.quartal ?? 1) as 1 | 2 | 3 | 4,
      label: parsed?.label ?? quartalId,
      titel: parsed?.label ?? quartalId,
      callDatum: null,
      transcriptUrl: row.transcriptUrl || '',
      quelle: 'cache',
      transcriptZeichen: 0,
      zusammenfassung: row.zusammenfassung?.trim() || null,
      sentimentScore: row.sentimentScore ?? null,
      transcriptText: null,
    })
  }

  const quartale = sortiereQuartale([...byId.values()])
  if (quartale.length === 0) return null

  return {
    ok: true,
    ticker,
    quelle: 'server-cache',
    quartale,
    hinweis:
      'Enthält KI-Zusammenfassungen und Transkript-Volltexte aus dem Server-Cache (soweit vorhanden).',
  }
}

async function ladeSecExportVoll(ticker: string): Promise<SecExportPaket | null> {
  const ki = await ladeSecBerichtKiCacheFuerTicker(ticker)
  if (!ki.size) return null

  const berichte: SecExportBericht[] = []
  for (const [id, row] of ki) {
    berichte.push({
      id,
      formular: null,
      label: id,
      filingDatum: null,
      berichtszeitraum: null,
      url: null,
      accession: row.accession || null,
      zusammenfassung: row.zusammenfassung?.trim() || null,
      textAuszug: null,
    })
  }

  if (berichte.length === 0) return null

  return {
    ok: true,
    ticker,
    quelle: 'server-cache',
    berichte,
    hinweis: 'SEC-KI-Zusammenfassungen aus dem Cache (Roh-HTML ggf. nur in der SEC-UI).',
  }
}
