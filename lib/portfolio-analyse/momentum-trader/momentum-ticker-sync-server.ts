import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { syncBarsFuerWatchlist } from '@/lib/portfolio-analyse/momentum-trader/momentum-bars-sync-server'
import { backfillEarningsEventsFuerEintrag } from '@/lib/portfolio-analyse/momentum-trader/momentum-earnings-events-server'
import { syncEarningsFuerWatchlist } from '@/lib/portfolio-analyse/momentum-trader/momentum-earnings-sync-server'
import { ladeMomentumLiveKurs } from '@/lib/portfolio-analyse/momentum-trader/momentum-yahoo-quote-server'
import { reichereWatchlistMitEarningsAn } from '@/lib/portfolio-analyse/momentum-trader/momentum-watchlist-enrich-server'
import {
  ladeMomentumWatchlist,
  repariereWatchlistSymbolKandidaten,
  syncIpoDatumFuerWatchlist,
} from '@/lib/portfolio-analyse/momentum-trader/momentum-watchlist-server'
import type {
  MomentumTickerSyncErgebnis,
  MomentumWatchlistEintragAngereichert,
} from '@/lib/portfolio-analyse/momentum-trader/momentum-trader-types'

/**
 * Vollständiger Sync für einen Watchlist-Titel:
 * Earnings-Kalender → Kurse (400T) → Gap-Backfill (3J MarketBeat) → IPO → Live-Kurs.
 */
export async function syncMomentumTicker(
  sb: SupabaseClient,
  isin: string,
): Promise<MomentumTickerSyncErgebnis> {
  const isinNorm = isin.trim().toUpperCase()
  const alle = await ladeMomentumWatchlist(sb)
  let eintrag = alle.find((e) => e.isin === isinNorm) ?? null
  if (!eintrag) {
    return { ok: false, schritte: [], fehler: ['Titel nicht in der Watchlist.'], eintrag: null }
  }

  const schritte: string[] = []
  const fehler: string[] = []

  const symRep = await repariereWatchlistSymbolKandidaten(sb, [eintrag])
  if (symRep > 0) {
    schritte.push('Symbole normalisiert (US-Ticker ergänzt)')
    eintrag = (await ladeMomentumWatchlist(sb)).find((e) => e.isin === isinNorm) ?? eintrag
  }

  const earnings = await syncEarningsFuerWatchlist(sb, [eintrag])
  schritte.push('Earnings: ' + earnings.termineGeschrieben + ' Termine')
  if (earnings.fehler.length) fehler.push(...earnings.fehler)

  const bars = await syncBarsFuerWatchlist([eintrag], 400)
  schritte.push('Kurse: ' + bars.kerzenGeschrieben + ' Kerzen')
  if (bars.fehler) fehler.push(bars.fehler)

  const events = await backfillEarningsEventsFuerEintrag(eintrag)
  schritte.push('Gap-Historie: ' + events.geschrieben + ' Events (3J, MarketBeat 24Q)')
  if (events.fehler.length) fehler.push(...events.fehler)

  const ipo = await syncIpoDatumFuerWatchlist(sb, [eintrag])
  if (ipo.aktualisiert > 0) schritte.push('IPO-Datum aktualisiert')

  const sym = eintrag.symbolYahoo ?? eintrag.symbolCandidates[0] ?? null
  let liveKurs = sym ? await ladeMomentumLiveKurs(sym, { skipCache: true }) : null
  if (liveKurs) schritte.push('Live-Kurs: ' + liveKurs.preis + ' (' + liveKurs.quelle + ')')

  const frisch = (await ladeMomentumWatchlist(sb)).find((e) => e.isin === isinNorm) ?? eintrag
  const angereichert = await reichereWatchlistMitEarningsAn([frisch], liveKurs ? { liveKursProIsin: new Map([[isinNorm, liveKurs]]) } : undefined)
  const result: MomentumWatchlistEintragAngereichert | null = angereichert[0] ?? null

  return {
    ok: fehler.length === 0,
    schritte,
    fehler,
    eintrag: result,
  }
}
