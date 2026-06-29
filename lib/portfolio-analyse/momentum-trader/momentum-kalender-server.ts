import 'server-only'

import { heuteIsoUtc, tageZwischenIso } from '@/lib/portfolio-analyse/dividenden-datum-hilfen'
import { ladeMomentumEarningsKalenderFuerSymbole } from '@/lib/portfolio-analyse/momentum-trader/momentum-db-server'
import type {
  MomentumEarningsKalenderMonat,
  MomentumEarningsZeit,
  MomentumKalenderEintrag,
  MomentumWatchlistEintrag,
  MomentumWatchlistEintragAngereichert,
} from '@/lib/portfolio-analyse/momentum-trader/momentum-trader-types'
import { symboleAusWatchlist } from '@/lib/portfolio-analyse/momentum-trader/momentum-watchlist-server'

function zeitLabel(z: MomentumEarningsZeit): string {
  if (z === 'bmo') return 'vor Börse'
  if (z === 'amc') return 'nach Börse'
  if (z === 'dmh') return 'intraday'
  return 'Zeit ?'
}

function addDaysIso(iso: string, tage: number): string {
  const d = new Date(iso + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + tage)
  return d.toISOString().slice(0, 10)
}

function primaeresSymbol(e: MomentumWatchlistEintrag): string | null {
  return e.symbolYahoo?.trim().toUpperCase() || e.symbolCandidates[0]?.trim().toUpperCase() || null
}

/** Earnings-Kalender für die Watchlist (nächste N Tage). */
export async function baueMomentumEarningsKalender(
  watchlist: MomentumWatchlistEintrag[] | MomentumWatchlistEintragAngereichert[],
  horizonTage = 35,
): Promise<MomentumEarningsKalenderMonat> {
  const heute = heuteIsoUtc()
  const bis = addDaysIso(heute, horizonTage)
  const symbole = symboleAusWatchlist(watchlist)
  const kalender = await ladeMomentumEarningsKalenderFuerSymbole(symbole)

  const nameProSymbol = new Map<string, { name: string; isin: string; medianGapPct: number | null }>()
  for (const e of watchlist) {
    const sym = primaeresSymbol(e)
    if (!sym) continue
    const median = 'medianGapPct' in e && e.medianGapPct != null ? e.medianGapPct : null
    nameProSymbol.set(sym, { name: e.name, isin: e.isin, medianGapPct: median })
  }

  const eintraege: MomentumKalenderEintrag[] = []
  for (const k of kalender) {
    if (k.earningsDate < heute || k.earningsDate > bis) continue
    const meta = nameProSymbol.get(k.symbol)
    if (!meta) continue
    eintraege.push({
      symbol: k.symbol,
      name: meta.name,
      isin: meta.isin,
      earningsDate: k.earningsDate,
      timeBmoAmc: k.timeBmoAmc,
      zeitLabel: zeitLabel(k.timeBmoAmc),
      tageBis: tageZwischenIso(heute, k.earningsDate),
      medianGapPct: meta.medianGapPct,
    })
  }

  eintraege.sort((a, b) => a.earningsDate.localeCompare(b.earningsDate) || a.symbol.localeCompare(b.symbol))

  const byTag = new Map<string, MomentumKalenderEintrag[]>()
  for (const e of eintraege) {
    const list = byTag.get(e.earningsDate) ?? []
    list.push(e)
    byTag.set(e.earningsDate, list)
  }

  const tage = [...byTag.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([datum, list]) => ({ datum, eintraege: list }))

  return { von: heute, bis, tage, gesamt: eintraege.length }
}
