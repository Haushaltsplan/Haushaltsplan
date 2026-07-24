/**
 * Export aller Fundamentaldaten eines Unternehmens — strukturiert wie die UI-Tabs.
 * Holt fehlende Satellite-Daten (CapAlloc, Insider, Peer, Beat/Miss, Earnings Call, SEC)
 * beim Export aktiv nach, falls nicht schon im localStorage.
 */

import type {
  FundamentaldatenAnfrage,
  FundamentaldatenPaket,
  FundamentalMetrikZeile,
} from '@/lib/portfolio-analyse/fundamentaldaten-types'
import {
  ladeEarningsCallAusLocalCache,
  ladeEarningsCallClient,
} from '@/lib/portfolio-analyse/earnings-call-client'
import {
  ladeSecBerichteAusLocalCache,
  ladeSecBerichteListe,
} from '@/lib/portfolio-analyse/sec-berichte-client'
import { listeQuartalsKiDiffAusLocal } from '@/lib/portfolio-analyse/quartals-ki-diff-client'

const LS_EARNINGS = 'pa-earnings-call-unternehmen-v1'
const LS_SEC = 'pa-sec-berichte-unternehmen-v4'
const LS_QUARTALS_DIFF = 'pa-quartals-ki-diff-v1'

const BEWERTUNG_GRUPPEN = new Set(['bewertung_forward', 'bewertung_trailing'])
const FINANZ_GRUPPEN = new Set([
  'finanzdaten',
  'cashflow',
  'bilanz',
  'rentabilitaet',
  'margen',
  'umschlag',
  'schaetzungen',
])

export type FundamentaldatenExportPayload = {
  exportVersion: 2
  exportiertAm: string
  meta: {
    ticker: string
    firmenname: string
    isin: string | null
    symbolYahoo: string | null
    frequenz: 'jahr' | 'quartal' | null
    geladenAm: string | null
    quelle: string | null
  }
  /** Entspricht den UI-Tabs — damit nichts „versteckt“ in einem Nested-Blob bleibt. */
  tabs: {
    uebersicht: {
      keyMetrics: FundamentaldatenPaket['keyMetrics']
      firmenprofil: {
        branche: string | null
        sektor: string | null
        website: string | null
        beschreibung: string | null
      }
    }
    mantra: {
      audit: FundamentaldatenPaket['mantra']
      mantraMeta: FundamentaldatenPaket['mantraMeta']
      capitalAllocation: unknown | null
      insiderTransaktionen: unknown | null
      peerVergleich: unknown | null
    }
    finanzdaten: {
      perioden: FundamentaldatenPaket['perioden']
      zeilen: FundamentalMetrikZeile[]
      waehrung: string
    }
    bewertung: {
      keyMetricsBewertung: FundamentaldatenPaket['keyMetrics']
      perioden: FundamentaldatenPaket['perioden']
      zeilen: FundamentalMetrikZeile[]
    }
    strukturUndDaten: {
      erweitert: FundamentaldatenPaket['erweitert']
      capitalAllocation: unknown | null
      peerVergleich: unknown | null
    }
    quartalszahlen: {
      earningsCalls: unknown | null
      secBerichte: unknown | null
      beatMiss: unknown | null
      quartalsKiDiffs: unknown[]
    }
    news: FundamentaldatenPaket['news']
  }
  /** Rohpaket unverändert (Vollständigkeit / Debugging). */
  fundamentaldatenRoh: FundamentaldatenPaket
  ladeHinweise: string[]
}

function tickerMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a?.trim() || !b?.trim()) return false
  return a.trim().toUpperCase() === b.trim().toUpperCase()
}

function matchesUnternehmen(
  eintrag: { ticker?: string },
  storeKey: string,
  ticker: string,
  symbolYahoo: string | null,
  isin: string | null,
): boolean {
  if (tickerMatch(eintrag.ticker, ticker) || tickerMatch(eintrag.ticker, symbolYahoo)) return true
  const parts = storeKey.toUpperCase().split('|')
  const t = ticker.trim().toUpperCase()
  const y = symbolYahoo?.trim().toUpperCase() ?? ''
  const i = isin?.trim().toUpperCase() ?? ''
  if (parts.includes(t) || (y && parts.includes(y))) return true
  if (i && parts[0] === i) return true
  return false
}

function ladeStoreWerteFuerUnternehmen(
  lsKey: string,
  ticker: string,
  symbolYahoo: string | null,
  isin: string | null,
): unknown[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(lsKey)
    if (!raw) return []
    const store = JSON.parse(raw) as Record<string, { ticker?: string } & Record<string, unknown>>
    if (!store || typeof store !== 'object') return []
    return Object.entries(store)
      .filter(([key, p]) => matchesUnternehmen(p ?? {}, key, ticker, symbolYahoo, isin))
      .map(([, p]) => ohneCacheMeta(p as Record<string, unknown>))
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

async function fetchJson(
  url: string,
  body: Record<string, unknown>,
  timeoutMs: number,
): Promise<{ ok: true; data: unknown } | { ok: false; fehler: string }> {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    })
    const text = await res.text()
    const head = text.trimStart().slice(0, 32).toLowerCase()
    if (head.startsWith('<!doctype') || head.startsWith('<html')) {
      return { ok: false, fehler: `${url}: HTML-Fehler (${res.status})` }
    }
    try {
      return { ok: true, data: JSON.parse(text) as unknown }
    } catch {
      return { ok: false, fehler: `${url}: ungültiges JSON` }
    }
  } catch (e) {
    return { ok: false, fehler: `${url}: ${e instanceof Error ? e.message : String(e)}` }
  }
}

function filterZeilen(
  zeilen: FundamentalMetrikZeile[],
  gruppen: Set<string>,
): FundamentalMetrikZeile[] {
  return zeilen.filter((z) => gruppen.has(z.gruppe))
}

/** Baut den vollständigen Export (inkl. Nachladen der Tab-Satelliten). */
export async function baueFundamentaldatenExportVollstaendig(
  paket: FundamentaldatenPaket,
  anfrage: FundamentaldatenAnfrage | null,
): Promise<FundamentaldatenExportPayload> {
  const ticker = paket.ticker
  const symbolYahoo = anfrage?.symbolYahoo ?? paket.symbolYahoo ?? null
  const isin = anfrage?.isin ?? null
  const firmenname = anfrage?.name ?? paket.firmenname
  const hinweise: string[] = []

  const anfrageBasis = {
    ticker,
    symbolYahoo,
    firmenname,
    isin,
  }

  // --- Parallel: Tab-Satelliten nachladen ---
  const [capAllocRes, insiderRes, peerRes, beatMissRes] = await Promise.all([
    fetchJson('/api/portfolio-analyse/capital-allocation', { ticker, symbolYahoo }, 60_000),
    fetchJson(
      '/api/portfolio-analyse/insider-transaktionen',
      { ticker, symbolYahoo, firmenname, isin },
      90_000,
    ),
    fetchJson('/api/portfolio-analyse/peer-vergleich', { ticker, isin }, 90_000),
    fetchJson(
      '/api/portfolio-analyse/earnings-beat-miss',
      { ticker, symbolYahoo, isin, limit: 8 },
      60_000,
    ),
  ])

  if (!capAllocRes.ok) hinweise.push(`Capital Allocation: ${capAllocRes.fehler}`)
  if (!insiderRes.ok) hinweise.push(`Insider: ${insiderRes.fehler}`)
  if (!peerRes.ok) hinweise.push(`Peer: ${peerRes.fehler}`)
  if (!beatMissRes.ok) hinweise.push(`Beat/Miss: ${beatMissRes.fehler}`)

  // Earnings Call: Cache → sonst API
  let earningsCalls: unknown | null = null
  try {
    const cached = ladeEarningsCallAusLocalCache(anfrageBasis)
    if (cached?.quartale?.length) {
      earningsCalls = cached
    } else {
      const ausStore = ladeStoreWerteFuerUnternehmen(LS_EARNINGS, ticker, symbolYahoo, isin)
      if (ausStore.length > 0) {
        earningsCalls = ausStore.length === 1 ? ausStore[0]! : ausStore
      } else {
        earningsCalls = await ladeEarningsCallClient(anfrageBasis)
      }
    }
  } catch (e) {
    hinweise.push(`Earnings Call: ${e instanceof Error ? e.message : String(e)}`)
    const ausStore = ladeStoreWerteFuerUnternehmen(LS_EARNINGS, ticker, symbolYahoo, isin)
    earningsCalls = ausStore.length > 0 ? ausStore : null
  }

  // SEC-Berichte: Cache → sonst Liste API
  let secBerichte: unknown | null = null
  try {
    const cached = ladeSecBerichteAusLocalCache(anfrageBasis)
    if (cached?.berichte?.length) {
      secBerichte = cached
    } else {
      const ausStore = ladeStoreWerteFuerUnternehmen(LS_SEC, ticker, symbolYahoo, isin)
      if (ausStore.length > 0) {
        secBerichte = ausStore.length === 1 ? ausStore[0]! : ausStore
      } else {
        secBerichte = await ladeSecBerichteListe(anfrageBasis)
      }
    }
  } catch (e) {
    hinweise.push(`SEC-Berichte: ${e instanceof Error ? e.message : String(e)}`)
    const ausStore = ladeStoreWerteFuerUnternehmen(LS_SEC, ticker, symbolYahoo, isin)
    secBerichte = ausStore.length > 0 ? ausStore : null
  }

  const quartalsKiDiffs =
    ladeStoreWerteFuerUnternehmen(LS_QUARTALS_DIFF, ticker, symbolYahoo, isin).length > 0
      ? ladeStoreWerteFuerUnternehmen(LS_QUARTALS_DIFF, ticker, symbolYahoo, isin)
      : listeQuartalsKiDiffAusLocal().filter(
          (p) => tickerMatch(p.ticker, ticker) || tickerMatch(p.ticker, symbolYahoo),
        )

  if (!paket.mantra) hinweise.push('Mantra fehlt im Paket')
  if (!paket.erweitert) hinweise.push('Struktur/erweitert fehlt im Paket — Seite neu laden')

  const bewertungZeilen = filterZeilen(paket.zeilen ?? [], BEWERTUNG_GRUPPEN)
  const finanzZeilen = filterZeilen(paket.zeilen ?? [], FINANZ_GRUPPEN)
  const keyMetricsBewertung = (paket.keyMetrics ?? []).filter(
    (m) =>
      m.gruppe === 'bewertung_ltm' ||
      m.gruppe === 'bewertung_ntm' ||
      m.id.includes('pe') ||
      m.id.includes('fcf') ||
      m.id.includes('ev_') ||
      m.id.includes('kgv') ||
      m.id.includes('payout') ||
      m.id.includes('div_'),
  )

  return {
    exportVersion: 2,
    exportiertAm: new Date().toISOString(),
    meta: {
      ticker,
      firmenname: paket.firmenname,
      isin,
      symbolYahoo,
      frequenz: anfrage?.frequenz ?? paket.frequenz ?? null,
      geladenAm: paket.geladenAm ?? null,
      quelle: paket.quelle ?? null,
    },
    tabs: {
      uebersicht: {
        keyMetrics: paket.keyMetrics ?? [],
        firmenprofil: {
          branche: paket.branche,
          sektor: paket.sektor,
          website: paket.website,
          beschreibung: paket.beschreibung,
        },
      },
      mantra: {
        audit: paket.mantra,
        mantraMeta: paket.mantraMeta ?? null,
        capitalAllocation: capAllocRes.ok ? capAllocRes.data : null,
        insiderTransaktionen: insiderRes.ok ? insiderRes.data : null,
        peerVergleich: peerRes.ok ? peerRes.data : null,
      },
      finanzdaten: {
        perioden: paket.perioden ?? [],
        zeilen: finanzZeilen,
        waehrung: paket.waehrung,
      },
      bewertung: {
        keyMetricsBewertung,
        perioden: paket.perioden ?? [],
        zeilen: bewertungZeilen,
      },
      strukturUndDaten: {
        erweitert: paket.erweitert ?? null,
        capitalAllocation: capAllocRes.ok ? capAllocRes.data : null,
        peerVergleich: peerRes.ok ? peerRes.data : null,
      },
      quartalszahlen: {
        earningsCalls,
        secBerichte,
        beatMiss: beatMissRes.ok ? beatMissRes.data : null,
        quartalsKiDiffs,
      },
      news: paket.news ?? [],
    },
    fundamentaldatenRoh: paket,
    ladeHinweise: hinweise,
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

/** Vollständiger JSON-Download (lädt Tab-Daten nach). */
export async function downloadFundamentaldatenJson(
  paket: FundamentaldatenPaket,
  anfrage: FundamentaldatenAnfrage | null,
): Promise<void> {
  const payload = await baueFundamentaldatenExportVollstaendig(paket, anfrage)
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
