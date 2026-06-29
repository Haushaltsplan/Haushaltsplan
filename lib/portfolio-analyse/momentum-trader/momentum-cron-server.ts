import 'server-only'

import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { fuehreVollenMomentumSyncAus } from '@/lib/portfolio-analyse/momentum-trader/momentum-full-sync-server'
import type { MomentumWatchlistEintrag } from '@/lib/portfolio-analyse/momentum-trader/momentum-trader-types'
import { ladeAlleMomentumWatchlistenGruppiert } from '@/lib/portfolio-analyse/momentum-trader/momentum-watchlist-server'

export type MomentumCronNutzerErgebnis = {
  ownerUserId: string
  watchlistGroesse: number
  ok: boolean
  schritte: string[]
  fehler: string[]
  scanAnzahl: number
}

export type MomentumCronErgebnis = {
  ok: boolean
  nutzerAnzahl: number
  ergebnisse: MomentumCronNutzerErgebnis[]
  zeitstempel: string
}

/**
 * Vercel Cron: Full-Sync für alle Nutzer mit nicht-leerer Watchlist.
 * Nutzt Service Role — RLS wird umgangen, Daten bleiben pro owner_user_id getrennt.
 */
export async function cronMomentumSyncAlleNutzer(): Promise<MomentumCronErgebnis> {
  const gruppen = await ladeAlleMomentumWatchlistenGruppiert()
  const admin = createSupabaseAdmin()
  const ergebnisse: MomentumCronNutzerErgebnis[] = []

  for (const [ownerUserId, watchlist] of gruppen) {
    if (watchlist.length === 0) continue
    const sync = await fuehreVollenMomentumSyncAus(admin, watchlist as MomentumWatchlistEintrag[])
    ergebnisse.push({
      ownerUserId,
      watchlistGroesse: watchlist.length,
      ok: sync.ok,
      schritte: sync.schritte,
      fehler: sync.fehler,
      scanAnzahl: sync.scan?.ergebnisse.length ?? 0,
    })
  }

  const ok = ergebnisse.every((e) => e.ok) || ergebnisse.length === 0

  return {
    ok,
    nutzerAnzahl: ergebnisse.length,
    ergebnisse,
    zeitstempel: new Date().toISOString(),
  }
}
