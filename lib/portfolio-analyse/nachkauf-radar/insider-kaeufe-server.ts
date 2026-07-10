/**
 * Insider-Käufe für den Nachkauf-Radar.
 * US: SEC Form 4 (Open Market, Code P) — primär; OpenInsider Fallback.
 * EU: Directors' Dealings via IR-Scrape.
 */

import 'server-only'

import { ladeEuInsiderDealings } from '@/lib/portfolio-analyse/eu-insider-dealing-server'
import { isinKenntnis } from '@/lib/portfolio-analyse/isin-kenntnisse'
import { ladeInsiderKauefeFuerSymbol } from '@/lib/portfolio-analyse/openinsider-server'
import { ladeSecForm4OpenMarketKaeufe } from '@/lib/portfolio-analyse/sec-edgar-form4-server'
import type { InsiderKauf, NachkaufScanEintrag } from './nachkauf-radar-types'
import type { WhitelistPosition } from './nachkauf-radar-whitelist'

const TAGE_RUECKBLICK = 90

function innerhalbFenster(datum: string): boolean {
  const grenze = new Date()
  grenze.setDate(grenze.getDate() - TAGE_RUECKBLICK)
  return datum >= grenze.toISOString().slice(0, 10)
}

function ausSecKaeufe(symbol: string): Promise<InsiderKauf[]> {
  return ladeSecForm4OpenMarketKaeufe(symbol, TAGE_RUECKBLICK).then((rows) =>
    rows
      .filter((r) => r.datum && innerhalbFenster(r.datum))
      .map((r) => ({
        datum: r.datum!,
        name: r.person,
        titel: r.titel ?? '',
        anteile: Math.round(r.aktien ?? 0),
        wertUsd: Math.round(r.wertUsd ?? 0),
      })),
  )
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
    const sec = await ausSecKaeufe(sym).catch(() => [])
    if (sec.length > 0) return sec
    return ausOpenInsider(sym).catch(() => [])
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
      const kenntnis = isinKenntnis(p.isin)
      return [p.isin, kenntnis?.symbolYahoo ?? null] as const
    }),
  )

  const BATCH = 3
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
    if (i + BATCH < eintraege.length) await new Promise((r) => setTimeout(r, 400))
  }
}
