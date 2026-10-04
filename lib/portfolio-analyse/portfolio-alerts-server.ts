import 'server-only'

import { baueEarningsBriefingDepot } from '@/lib/portfolio-analyse/earnings-briefing-server'
import { ladeLivePortfolioServer } from '@/lib/portfolio-analyse/depot-gewichte-server'
import { ladeNachkaufScanAusCloud } from '@/lib/portfolio-analyse/nachkauf-radar/nachkauf-radar-db-server'
import type { PortfolioAlert, PortfolioAlertTyp } from '@/lib/portfolio-analyse/portfolio-alerts-types'
import { requireOwnerUserId } from '@/lib/request-owner'
import { createSupabaseAdmin } from '@/lib/supabase-admin'

export type { PortfolioAlert, PortfolioAlertTyp } from '@/lib/portfolio-analyse/portfolio-alerts-types'

const TABLE = 'portfolio_analyse_alerts'
const DRAWDOWN_POS_PCT = -15
const DRAWDOWN_DEPOT_PCT = -20

function admin() {
  return createSupabaseAdmin()
}

function istKonfiguriert(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim())
}

function heuteKey(): string {
  return new Date().toISOString().slice(0, 10)
}

async function upsertAlert(row: {
  typ: PortfolioAlertTyp
  ticker?: string | null
  isin?: string | null
  titel: string
  nachricht: string
  payload?: Record<string, unknown>
  dedupeKey: string
}): Promise<void> {
  if (!istKonfiguriert()) return
  const owner = requireOwnerUserId()
  const { error } = await admin().from(TABLE).upsert(
    {
      owner_user_id: owner,
      typ: row.typ,
      ticker: row.ticker ?? null,
      isin: row.isin ?? null,
      titel: row.titel,
      nachricht: row.nachricht,
      payload: row.payload ?? {},
      dedupe_key: row.dedupeKey,
    },
    { onConflict: 'owner_user_id,dedupe_key', ignoreDuplicates: true },
  )
  if (error) console.warn('[portfolio-alerts] upsert:', error.message)
}

export async function ladePortfolioAlerts(opts?: {
  nurUngelesen?: boolean
  limit?: number
}): Promise<PortfolioAlert[]> {
  if (!istKonfiguriert()) return []
  try {
    let q = admin()
      .from(TABLE)
      .select('*')
      .eq('owner_user_id', requireOwnerUserId())
      .order('erstellt_am', { ascending: false })
      .limit(opts?.limit ?? 50)
    if (opts?.nurUngelesen) q = q.is('gelesen_am', null)
    const { data, error } = await q
    if (error) {
      console.warn('[portfolio-alerts] laden:', error.message)
      return []
    }
    return (data ?? []).map((r) => {
      const row = r as Record<string, unknown>
      return {
        id: String(row.id),
        typ: row.typ as PortfolioAlertTyp,
        ticker: row.ticker != null ? String(row.ticker) : null,
        isin: row.isin != null ? String(row.isin) : null,
        titel: String(row.titel ?? ''),
        nachricht: String(row.nachricht ?? ''),
        payload: (row.payload as Record<string, unknown>) ?? {},
        gelesenAm: row.gelesen_am != null ? String(row.gelesen_am) : null,
        erstelltAm: String(row.erstellt_am ?? ''),
      }
    })
  } catch (e) {
    console.warn('[portfolio-alerts] laden fehlgeschlagen:', e)
    return []
  }
}

export async function markiereAlertGelesen(id: string): Promise<boolean> {
  if (!istKonfiguriert()) return false
  const { error } = await admin()
    .from(TABLE)
    .update({ gelesen_am: new Date().toISOString() })
    .eq('owner_user_id', requireOwnerUserId())
    .eq('id', id)
  return !error
}

export async function markiereAlleAlertsGelesen(): Promise<number> {
  if (!istKonfiguriert()) return 0
  const { data, error } = await admin()
    .from(TABLE)
    .update({ gelesen_am: new Date().toISOString() })
    .eq('owner_user_id', requireOwnerUserId())
    .is('gelesen_am', null)
    .select('id')
  if (error) return 0
  return data?.length ?? 0
}

/** Erzeugt Alerts aus Radar, Earnings-Briefing und Drawdowns (idempotent pro Tag). */
export async function generierePortfolioAlerts(): Promise<{ erzeugtHinweis: string; geprueft: number }> {
  const tag = heuteKey()
  let geprueft = 0

  // Radar
  const scan = await ladeNachkaufScanAusCloud()
  for (const e of scan) {
    geprueft++
    if (e.ampel === 'gruen') {
      await upsertAlert({
        typ: 'radar_gruen',
        ticker: e.ticker,
        isin: e.isin,
        titel: `${e.name || e.ticker}: Ampel grün`,
        nachricht: `Nachkauf-Radar Score ${e.score}. ${e.kiBegruendung?.slice(0, 160) ?? ''}`.trim(),
        payload: { score: e.score, ampel: e.ampel },
        dedupeKey: `radar_gruen:${e.ticker}:${tag}`,
      })
    }
    if (e.kaufTriggerAusgeloest) {
      await upsertAlert({
        typ: 'radar_kaufzone',
        ticker: e.ticker,
        isin: e.isin,
        titel: `${e.name || e.ticker}: Kaufzone`,
        nachricht: e.kaufTriggerText || `Score ${e.score}, Ampel ${e.ampel}.`,
        payload: { score: e.score, ampel: e.ampel },
        dedupeKey: `radar_kaufzone:${e.ticker}:${tag}`,
      })
    }
  }

  // Earnings heute/morgen
  const livePaket = await ladeLivePortfolioServer().catch(() => null)
  const live = livePaket?.live ?? null
  const positionen = (live?.positionen ?? [])
    .filter((p) => p.stueck > 0 && p.assetKlasse === 'aktie')
    .map((p) => ({
      isin: p.isin,
      name: p.name,
      stueck: p.stueck,
      symbolYahoo: p.symbolYahoo,
    }))
  if (positionen.length > 0) {
    const briefing = await baueEarningsBriefingDepot(positionen, { horizonTage: 2 })
    for (const e of briefing.eintraege) {
      geprueft++
      if (e.tageBis === 0) {
        await upsertAlert({
          typ: 'earnings_heute',
          ticker: e.symbol,
          isin: e.isin,
          titel: `${e.name}: Earnings heute`,
          nachricht: [
            e.berichtszeitAnzeige,
            e.eps.averageAnzeige ? `EPS-Konsens ${e.eps.averageAnzeige}` : null,
          ]
            .filter(Boolean)
            .join(' · '),
          payload: { termin: e.terminDatumIso },
          dedupeKey: `earnings_heute:${e.symbol}:${e.terminDatumIso}`,
        })
      } else if (e.tageBis === 1) {
        await upsertAlert({
          typ: 'earnings_morgen',
          ticker: e.symbol,
          isin: e.isin,
          titel: `${e.name}: Earnings morgen`,
          nachricht: e.berichtszeitAnzeige ?? e.terminDatumIso,
          payload: { termin: e.terminDatumIso },
          dedupeKey: `earnings_morgen:${e.symbol}:${e.terminDatumIso}`,
        })
      }
    }
  }

  // Drawdowns
  if (live?.kennzahlen && live.positionen) {
    const depotPct = live.kennzahlen.gewinnVerlustProzent
    if (depotPct != null && depotPct <= DRAWDOWN_DEPOT_PCT) {
      await upsertAlert({
        typ: 'drawdown',
        titel: `Depot Drawdown ${depotPct.toFixed(1)} %`,
        nachricht: `Gesamtperformance unter ${DRAWDOWN_DEPOT_PCT} %.`,
        payload: { pct: depotPct, scope: 'depot' },
        dedupeKey: `drawdown:depot:${tag}`,
      })
    }
    for (const p of live.positionen) {
      if (p.stueck <= 0 || p.assetKlasse !== 'aktie') continue
      const pct = p.gewinnVerlustProzent
      if (pct != null && pct <= DRAWDOWN_POS_PCT) {
        geprueft++
        await upsertAlert({
          typ: 'drawdown',
          ticker: p.symbolYahoo,
          isin: p.isin,
          titel: `${p.name}: Drawdown ${pct.toFixed(1)} %`,
          nachricht: `Position unter ${DRAWDOWN_POS_PCT} % vs. Einstand.`,
          payload: { pct, scope: 'position' },
          dedupeKey: `drawdown:${p.isin ?? p.symbolYahoo}:${tag}`,
        })
      }
    }
  }

  return { erzeugtHinweis: `Alerts geprüft (${geprueft} Signale, Tag ${tag}).`, geprueft }
}
