import 'server-only'

import { requireOwnerUserId } from '@/lib/request-owner'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import type { LivePosition } from '@/lib/portfolio-analyse/live-bewertung'
import { gewichtungNachAssetklasse } from '@/lib/portfolio-analyse/gewichtung'
import { ASSET_KLASSE_LABEL, type AssetKlasse } from '@/lib/portfolio-analyse/types'

export type ZielDimension = 'assetklasse' | 'sektor' | 'titel'

export type ZielGewicht = {
  id: string
  dimension: ZielDimension
  schluessel: string
  label: string
  zielPct: number
}

export type RebalancingTrade = {
  schluessel: string
  label: string
  dimension: ZielDimension
  istPct: number
  zielPct: number
  diffPct: number
  diffEur: number
  aktion: 'kaufen' | 'trimmen' | 'ok'
}

const TABLE = 'portfolio_zielallokation'

function admin() {
  return createSupabaseAdmin()
}

function istKonfiguriert() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim())
}

export async function ladeZielallokation(): Promise<ZielGewicht[]> {
  if (!istKonfiguriert()) return []
  const { data, error } = await admin()
    .from(TABLE)
    .select('*')
    .eq('owner_user_id', requireOwnerUserId())
    .order('dimension')
  if (error || !data) return []
  return data.map((r) => {
    const row = r as Record<string, unknown>
    return {
      id: String(row.id),
      dimension: row.dimension as ZielDimension,
      schluessel: String(row.schluessel),
      label: String(row.label ?? row.schluessel),
      zielPct: Number(row.ziel_pct) || 0,
    }
  })
}

export async function speichereZielgewichte(
  zeilen: Array<{ dimension: ZielDimension; schluessel: string; label: string; zielPct: number }>,
): Promise<void> {
  if (!istKonfiguriert()) throw new Error('Supabase nicht konfiguriert')
  const owner = requireOwnerUserId()
  const rows = zeilen.map((z) => ({
    owner_user_id: owner,
    dimension: z.dimension,
    schluessel: z.schluessel,
    label: z.label,
    ziel_pct: z.zielPct,
    aktualisiert_am: new Date().toISOString(),
  }))
  const { error } = await admin().from(TABLE).upsert(rows, {
    onConflict: 'owner_user_id,dimension,schluessel',
  })
  if (error) throw new Error(error.message)
}

export function berechneRebalancingTrades(
  positionen: LivePosition[],
  ziele: ZielGewicht[],
  depotwertEur: number,
): RebalancingTrade[] {
  const assetZiele = ziele.filter((z) => z.dimension === 'assetklasse')
  if (assetZiele.length === 0) return []

  const ist = gewichtungNachAssetklasse(positionen)
  const istMap = new Map(ist.map((e) => [e.key, e.gewichtProzent]))
  const wert = depotwertEur > 0 ? depotwertEur : 1

  return assetZiele
    .map((z) => {
      const istPct = istMap.get(z.schluessel) ?? 0
      const diffPct = Math.round((z.zielPct - istPct) * 10) / 10
      const diffEur = Math.round(((diffPct / 100) * wert) * 100) / 100
      const aktion: RebalancingTrade['aktion'] =
        Math.abs(diffPct) < 1 ? 'ok' : diffPct > 0 ? 'kaufen' : 'trimmen'
      return {
        schluessel: z.schluessel,
        label: z.label || ASSET_KLASSE_LABEL[z.schluessel as AssetKlasse] || z.schluessel,
        dimension: z.dimension,
        istPct: Math.round(istPct * 10) / 10,
        zielPct: z.zielPct,
        diffPct,
        diffEur,
        aktion,
      }
    })
    .sort((a, b) => Math.abs(b.diffPct) - Math.abs(a.diffPct))
}
