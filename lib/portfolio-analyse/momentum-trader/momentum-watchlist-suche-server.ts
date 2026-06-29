import 'server-only'

import { sucheAktien, loeseAktieAusSuche } from '@/lib/portfolio-analyse/aktien-suche-server'
import { findePreIpoKandidaten } from '@/lib/portfolio-analyse/momentum-trader/momentum-pre-ipo-katalog'
import { erzeugeMomentumPseudoIsin, istMomentumPseudoIsin } from '@/lib/portfolio-analyse/momentum-trader/momentum-pseudo-isin'
import { normalisiereMomentumWatchlistSymbole } from '@/lib/portfolio-analyse/momentum-trader/momentum-symbol-hilfen'
import type {
  MomentumWatchlistAufloesung,
  MomentumWatchlistSuchTreffer,
} from '@/lib/portfolio-analyse/momentum-trader/momentum-trader-types'

export type { MomentumWatchlistAufloesung, MomentumWatchlistSuchTreffer }

/** Yahoo-Aktien + Pre-IPO-Katalog für die Momentum-Watchlist. */
export async function sucheMomentumWatchlistKandidaten(query: string): Promise<MomentumWatchlistSuchTreffer[]> {
  const q = query.trim()
  if (q.length < 2) return []

  const [yahoo, preIpo] = await Promise.all([sucheAktien(q), Promise.resolve(findePreIpoKandidaten(q))])

  const seen = new Set<string>()
  const out: MomentumWatchlistSuchTreffer[] = []

  for (const t of yahoo) {
    const key = t.symbol.trim().toUpperCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push({
      symbol: t.symbol,
      name: t.name,
      exchange: t.exchange,
      istPreIpo: false,
      ipoDatumVorschlag: null,
      notiz: null,
    })
  }

  for (const k of preIpo) {
    const key = k.symbol.toUpperCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push({
      symbol: k.symbol,
      name: k.name,
      exchange: 'Pre-IPO',
      istPreIpo: true,
      ipoDatumVorschlag: k.ipoDatumVorschlag ?? null,
      notiz: k.notiz ?? null,
    })
  }

  return out.slice(0, 14)
}

/** Löst Suchtreffer oder Freitext zu einem Watchlist-Eintrag auf (echte oder Pseudo-ISIN). */
export async function loeseMomentumWatchlistKandidat(opts: {
  symbol: string
  name: string
  istPreIpo?: boolean
  ipoDatumVorschlag?: string | null
  notiz?: string | null
}): Promise<MomentumWatchlistAufloesung | null> {
  const sym = opts.symbol.trim().toUpperCase()
  const name = opts.name.trim() || sym
  if (!sym) return null

  if (opts.istPreIpo) {
    return {
      isin: erzeugeMomentumPseudoIsin(sym),
      name,
      symbolYahoo: null,
      symbolCandidates: [sym],
      istPreIpo: true,
      ipoDatum: opts.ipoDatumVorschlag?.trim().slice(0, 10) || null,
      notiz: opts.notiz?.trim() || null,
    }
  }

  const aufgeloest = await loeseAktieAusSuche(sym, name)
  if (!aufgeloest) return null

  const isinRaw = aufgeloest.isin?.trim().toUpperCase()
  const isin =
    isinRaw && /^[A-Z]{2}[A-Z0-9]{10}$/.test(isinRaw) ? isinRaw : erzeugeMomentumPseudoIsin(sym)

  const symNorm = normalisiereMomentumWatchlistSymbole({
    symbolYahoo: aufgeloest.meta.symbolYahoo?.trim().toUpperCase() || sym,
    symbolCandidates:
      aufgeloest.meta.symbolCandidates?.length > 0
        ? aufgeloest.meta.symbolCandidates
        : [sym],
  })

  return {
    isin,
    name: aufgeloest.meta.name?.trim() || name,
    symbolYahoo: symNorm.symbolYahoo,
    symbolCandidates: symNorm.symbolCandidates,
    istPreIpo: istMomentumPseudoIsin(isin),
    ipoDatum: null,
    notiz: null,
  }
}
