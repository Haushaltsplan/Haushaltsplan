/**
 * Watchlist mit Earnings-Terminen + Gap-Historie + Datenqualität anreichern.
 */

import 'server-only'

import { heuteIsoUtc, tageZwischenIso } from '@/lib/portfolio-analyse/dividenden-datum-hilfen'
import {
  berechneDatenqualitaetAusEvents,
  ladeNeuesterBarTag,
} from '@/lib/portfolio-analyse/momentum-trader/momentum-datenqualitaet-server'
import {
  gapVolatilitaetSchaetzung,
  ladeEarningsEventsFuerWatchlistEintrag,
  medianGapAbsPct,
} from '@/lib/portfolio-analyse/momentum-trader/momentum-earnings-events-server'
import {
  ladeMomentumEarningsEventsFuerSymbol,
  ladeMomentumEarningsKalenderFuerSymbole,
} from '@/lib/portfolio-analyse/momentum-trader/momentum-db-server'
import { istMomentumPseudoIsin } from '@/lib/portfolio-analyse/momentum-trader/momentum-pseudo-isin'
import type {
  MomentumEarningsZeit,
  MomentumLiveKurs,
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
  opts?: { liveKursProIsin?: Map<string, MomentumLiveKurs> },
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
  const barTagCache = new Map<string, string | null>()

  return Promise.all(
    eintraege.map(async (e) => {
      const sym = primaeresAnzeigeSymbol(e)
      let events = sym ? eventsCache.get(sym) : undefined
      if (sym && !events) {
        events = await ladeMomentumEarningsEventsFuerSymbol(sym)
        eventsCache.set(sym, events)
      }

      const eventsVoll = await ladeEarningsEventsFuerWatchlistEintrag(e)
      const mergedEvents = eventsVoll.length > (events?.length ?? 0) ? eventsVoll : (events ?? [])

      const naechstes = sym ? naechstesProSymbol.get(sym) ?? null : null
      const tageBis = naechstes ? tageZwischenIso(heute, naechstes.datum) : null
      const medianGap =
        gapVolatilitaetSchaetzung(mergedEvents).medianGapPct ?? medianGapAbsPct(mergedEvents ?? [])
      const letzteGapEvents = mergedEvents
        .slice()
        .sort((a, b) => b.earningsDate.localeCompare(a.earningsDate))
        .slice(0, 6)
        .map((ev) => ({
          datum: ev.earningsDate,
          gapPct: ev.gapPct,
          rvol: ev.rvol,
          surpriseEpsPct: ev.surpriseEpsPct,
          surpriseRevPct: ev.surpriseRevPct,
          timeBmoAmc: ev.timeBmoAmc,
        }))

      const basis = {
        naechstesEarnings: naechstes
          ? {
              datum: naechstes.datum,
              timeBmoAmc: naechstes.timeBmoAmc,
              zeitLabel: zeitLabel(naechstes.timeBmoAmc),
              tageBis,
            }
          : null,
        medianGapPct: medianGap,
        earningsEventsAnzahl: mergedEvents.length,
        letzteGapEvents,
      }

      let barsNeuesterTag: string | null = null
      if (sym && !istMomentumPseudoIsin(e.isin)) {
        if (!barTagCache.has(sym)) {
          barTagCache.set(sym, await ladeNeuesterBarTag(sym))
        }
        barsNeuesterTag = barTagCache.get(sym) ?? null
      }

      const datenqualitaet = istMomentumPseudoIsin(e.isin)
        ? berechneDatenqualitaetAusEvents(e, [], basis, null)
        : berechneDatenqualitaetAusEvents(e, mergedEvents, basis, barsNeuesterTag)

      const liveKurs = opts?.liveKursProIsin?.get(e.isin) ?? null

      return {
        ...e,
        ...basis,
        datenqualitaet,
        liveKurs,
      }
    }),
  )
}
