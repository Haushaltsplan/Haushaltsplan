/**
 * Export aller lokal vorliegenden Fundamentaldaten eines Unternehmens.
 * Primär: FundamentaldatenPaket (+ erweitert). Zusätzlich: Earnings-Call-,
 * SEC-Berichte- und Quartals-KI-Diff-Caches für denselben Ticker.
 */

import type { FundamentaldatenAnfrage, FundamentaldatenPaket } from '@/lib/portfolio-analyse/fundamentaldaten-types'
import { listeEarningsCallPaketeMitKiAusLocal } from '@/lib/portfolio-analyse/earnings-call-client'
import { listeSecBerichtePaketeMitKiAusLocal } from '@/lib/portfolio-analyse/sec-berichte-client'
import { listeQuartalsKiDiffAusLocal } from '@/lib/portfolio-analyse/quartals-ki-diff-client'

const LS_EARNINGS = 'pa-earnings-call-unternehmen-v1'
const LS_SEC = 'pa-sec-berichte-unternehmen-v4'
const LS_QUARTALS_DIFF = 'pa-quartals-ki-diff-v1'
const LS_FUNDAMENTAL = 'pa-fundamentaldaten-v42'

export type FundamentaldatenExportPayload = {
  exportVersion: 1
  exportiertAm: string
  anfrage: {
    isin: string | null
    name: string | null
    symbolYahoo: string | null
    tickerOverride: string | null
    frequenz: 'jahr' | 'quartal' | null
  }
  /** Vollständiges Fundamentaldaten-Paket (GuV, Bilanz, Key Metrics, Mantra, erweitert, …). */
  fundamentaldaten: FundamentaldatenPaket
  /** Weitere lokal gecachte Daten zum selben Ticker (falls vorhanden). */
  satellites: {
    earningsCalls: unknown[]
    secBerichte: unknown[]
    quartalsKiDiffs: unknown[]
  }
  hinweis: string
}

function tickerMatch(a: string | null | undefined, b: string): boolean {
  return (a ?? '').trim().toUpperCase() === b.trim().toUpperCase()
}

function ladeStoreWerteFuerTicker(lsKey: string, ticker: string): unknown[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(lsKey)
    if (!raw) return []
    const store = JSON.parse(raw) as Record<string, { ticker?: string } & Record<string, unknown>>
    if (!store || typeof store !== 'object') return []
    return Object.values(store).filter((p) => tickerMatch(p?.ticker, ticker))
  } catch {
    return []
  }
}

function ohneCacheMeta<T extends Record<string, unknown>>(eintrag: T): Omit<T, 'cacheKey' | 'cachedAt'> {
  const { cacheKey: _c, cachedAt: _a, ...rest } = eintrag as T & {
    cacheKey?: string
    cachedAt?: number
  }
  return rest
}

/** Sammelt alle lokal bekannten Daten für den aktuellen Titel. */
export function baueFundamentaldatenExport(
  paket: FundamentaldatenPaket,
  anfrage: FundamentaldatenAnfrage | null,
): FundamentaldatenExportPayload {
  const ticker = paket.ticker
  const earningsAusStore = ladeStoreWerteFuerTicker(LS_EARNINGS, ticker).map((e) =>
    ohneCacheMeta(e as Record<string, unknown>),
  )
  // Fallback: KI-Liste, falls Store-Struktur abweicht
  const earningsFallback = listeEarningsCallPaketeMitKiAusLocal().filter((p) =>
    tickerMatch(p.ticker, ticker),
  )
  const earningsCalls = earningsAusStore.length > 0 ? earningsAusStore : earningsFallback

  const secAusStore = ladeStoreWerteFuerTicker(LS_SEC, ticker).map((e) =>
    ohneCacheMeta(e as Record<string, unknown>),
  )
  const secFallback = listeSecBerichtePaketeMitKiAusLocal().filter((p) => tickerMatch(p.ticker, ticker))
  const secBerichte = secAusStore.length > 0 ? secAusStore : secFallback

  const quartalsAusStore = ladeStoreWerteFuerTicker(LS_QUARTALS_DIFF, ticker).map((e) =>
    ohneCacheMeta(e as Record<string, unknown>),
  )
  const quartalsFallback = listeQuartalsKiDiffAusLocal().filter((p) => tickerMatch(p.ticker, ticker))
  const quartalsKiDiffs = quartalsAusStore.length > 0 ? quartalsAusStore : quartalsFallback

  return {
    exportVersion: 1,
    exportiertAm: new Date().toISOString(),
    anfrage: {
      isin: anfrage?.isin ?? null,
      name: anfrage?.name ?? paket.firmenname ?? null,
      symbolYahoo: anfrage?.symbolYahoo ?? paket.symbolYahoo ?? null,
      tickerOverride: anfrage?.tickerOverride ?? null,
      frequenz: anfrage?.frequenz ?? paket.frequenz ?? null,
    },
    fundamentaldaten: paket,
    satellites: {
      earningsCalls,
      secBerichte,
      quartalsKiDiffs,
    },
    hinweis:
      'Enthält das geladene Fundamentaldaten-Paket inkl. erweitert (SEC-Struktur, Dividenden, Holder, …) ' +
      'sowie lokal gecachte Earnings-Calls, SEC-Berichte und Quartals-KI-Diffs für denselben Ticker. ' +
      `Haupt-Cache-Key: ${LS_FUNDAMENTAL}. Peer-/Insider-/Capital-Allocation-Live-Abrufe ohne eigenen Cache fehlen ggf.`,
  }
}

function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

function dateinameBasis(paket: FundamentaldatenPaket): string {
  const tag = new Date().toISOString().slice(0, 10)
  const freq = paket.frequenz ?? 'jahr'
  const safe = paket.ticker.replace(/[^\w.-]+/g, '_')
  return `fundamentaldaten-${safe}-${freq}-${tag}`
}

/** Vollständiger JSON-Download. */
export function downloadFundamentaldatenJson(
  paket: FundamentaldatenPaket,
  anfrage: FundamentaldatenAnfrage | null,
): void {
  const payload = baueFundamentaldatenExport(paket, anfrage)
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json;charset=utf-8',
  })
  downloadBlob(`${dateinameBasis(paket)}.json`, blob)
}

/** Flache CSV der Finanz-/Kennzahlen-Matrix (perioden × zeilen). */
export function downloadFundamentaldatenKennzahlenCsv(paket: FundamentaldatenPaket): void {
  const perioden = paket.perioden ?? []
  const header = ['id', 'label', 'gruppe', 'einheit', ...perioden.map((p) => p.label || p.iso)]
  const escape = (v: string | number | null | undefined): string => {
    const s = v == null ? '' : String(v)
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
    return s
  }
  const rows = (paket.zeilen ?? []).map((z) => {
    const werte = perioden.map((p) => z.werte?.[p.iso] ?? '')
    return [z.id, z.label, z.gruppe ?? '', z.einheit ?? '', ...werte].map(escape).join(',')
  })
  const csv = '\uFEFF' + [header.map(escape).join(','), ...rows].join('\r\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  downloadBlob(`${dateinameBasis(paket)}-kennzahlen.csv`, blob)
}
