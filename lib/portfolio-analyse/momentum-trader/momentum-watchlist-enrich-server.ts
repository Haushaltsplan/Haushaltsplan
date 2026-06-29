/**
 * Watchlist mit Earnings-Terminen + Gap-Historie anreichern.
 */

import 'server-only'

import { heuteIsoUtc, tageZwischenIso } from '@/lib/portfolio-analyse/dividenden-datum-hilfen'
import { medianGapAbsPct, gapVolatilitaetSchaetzung } from '@/lib/portfolio-analyse/momentum-trader/momentum-earnings-events-server'
import {
  ladeMomentumEarningsEventsFuerSymbol,
  ladeMomentumEarningsKalenderFuerSymbole,
} from '@/lib/portfolio-analyse/momentum-trader/momentum-db-server'
import type {
  MomentumEarningsZeit,
  MomentumWatchlistEintrag,
  MomentumWatchlistEintragAngereichert,
} from '@/lib/portfolio-analyse/momentum-trader/momentum-trader-types'
import { symboleAusWatchlist } from '@/lib/portfolio-analyse/momentum-trader/momentum-watchlist-server'

import { primaeresAnzeigeSymbol } from '@/lib/portfolio-analyse/momentum-trader/momentum-symbol-hilfen'

function zeitLabel(z: MomentumEarningsZeit): string {
  if (z === 'bmo') return 'vor Börseneröffnung'
  if (z === 'amc') return 'nach Handelsschluss'
  if (z === 'dmh') return 'während Handel'
  return 'Zeit unbekannt'
}

export async function reichereWatchlistMitEarningsAn(
  eintraege: MomentumWatchlistEintrag[],
): Promise<MomentumWatchlistEintragAngereichert[]> {
  const heute = heuteIsoUtc()
  const symbole = symboleAusWatchlist(eintraege)
  const kalender = await ladeMomentumEarningsKalenderFuerSymbole(symbole)

  const naechstesProSymbol = new Map<string, { datum: string; timeBmoAmc: MomentumEarningsZeit }>()
  for (const k of kalender) {
    if (k.earningsDate < heute) continue
    const prev = naechstesProSymbol.get(k.symbol)
    if (!prev || k.earningsDate < prev.datum) {
      naechstesProSymbol.set(k.symbol, { datum: k.earningsDate, timeBmoAmc: k.timeBmoAmc })
    }
  }

  const eventsCache = new Map<string, Awaited<ReturnType<typeof ladeMomentumEarningsEventsFuerSymbol>>>()

  return Promise.all(
    eintraege.map(async (e) => {
      const sym = primaeresAnzeigeSymbol(e)
      let events = sym ? eventsCache.get(sym) : undefined
      if (sym && !events) {
        events = await ladeMomentumEarningsEventsFuerSymbol(sym)
        eventsCache.set(sym, events)
      }

      const naechstes = sym ? naechstesProSymbol.get(sym) ?? null : null
      const tageBis = naechstes ? tageZwischenIso(heute, naechstes.datum) : null
      const medianGap = events ? gapVolatilitaetSchaetzung(events).medianGapPct ?? medianGapAbsPct(events ?? []) : null
      const letzteGapEvents = (events ?? [])
        .slice()
        .sort((a, b) => b.earningsDate.localeCompare(a.earningsDate))
        .slice(0, 4)
        .map((ev) => ({
          datum: ev.earningsDate,
          gapPct: ev.gapPct,
          rvol: ev.rvol,
          surpriseEpsPct: ev.surpriseEpsPct,
          timeBmoAmc: ev.timeBmoAmc,
        }))

      return {
        ...e,
        naechstesEarnings: naechstes
          ? {
              datum: naechstes.datum,
              timeBmoAmc: naechstes.timeBmoAmc,
              zeitLabel: zeitLabel(naechstes.timeBmoAmc),
              tageBis,
            }
          : null,
        medianGapPct: medianGap,
        earningsEventsAnzahl: events?.length ?? 0,
        letzteGapEvents,
      }
    }),
  )
}
