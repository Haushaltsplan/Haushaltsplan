/** Depot-Gewichte serverseitig — gleiche Quelle wie Dashboard (Buchungen + Live-Kurse). */

import 'server-only'

import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { positionenFuerBewertung } from '@/lib/portfolio-analyse/bestand'
import { teileArray } from '@/lib/portfolio-analyse/batch-hilfen'
import {
  berechneLivePortfolio,
  symboleAusMeta,
  type LiveKursePaket,
  type LivePortfolio,
} from '@/lib/portfolio-analyse/live-bewertung'
import type { IsinMetadata } from '@/lib/portfolio-analyse/isin-lookup-server'
import { sammleIsins } from '@/lib/portfolio-analyse/auswertungen'
import { lookupIsinMetadaten } from '@/lib/portfolio-analyse/isin-lookup-server'
import {
  FX_SYMBOLE,
  fxKurseAusYahooMap,
} from '@/lib/portfolio-analyse/kurs-aufloesung'
import { PORTFOLIO_DB_SEITEN_GROESSE, PORTFOLIO_MAX_BUCHUNGEN } from '@/lib/portfolio-analyse/limits'
import { requireOwnerUserId } from '@/lib/request-owner'
import { ladeStooqSchlusskurs } from '@/lib/portfolio-analyse/stooq-kurs'
import type { PortfolioBuchung, PortfolioDbSnapshot } from '@/lib/portfolio-analyse/types'
import { ladeYahooKurse, type YahooKursZeile } from '@/lib/portfolio-analyse/yahoo-kurse-server'
import { isinKenntnis } from '@/lib/portfolio-analyse/isin-kenntnisse'
import type { FundamentaldatenAnfrage } from '@/lib/portfolio-analyse/fundamentaldaten-types'

export type DepotGewicht = {
  /** Aktueller Marktwert der Position in EUR. */
  investiertEur: number
  /** Anteil am Gesamt-Depotwert (0–100). */
  anteilPct: number
}

export type LiveDepotPaket = {
  depotwertEur: number
  positionen: Array<{
    isin: string
    name: string
    gewichtProzent: number
    wertLiveEur: number
  }>
}

const KURSE_BATCH = 80

function istKonfiguriert(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim())
}

function mapBuchungRow(row: Record<string, unknown>): PortfolioBuchung {
  return {
    buchungsHash: String(row.buchungs_hash),
    datum: String(row.datum).slice(0, 10),
    typ: row.typ as PortfolioBuchung['typ'],
    isin: row.isin ? String(row.isin) : null,
    wertpapierName: row.wertpapier_name ? String(row.wertpapier_name) : null,
    stueck: row.stueck != null ? Number(row.stueck) : null,
    kursEur: row.kurs_eur != null ? Number(row.kurs_eur) : null,
    betragEur: Number(row.betrag_eur),
    realisierterGewinnEur:
      row.realisierter_gewinn_eur != null ? Number(row.realisierter_gewinn_eur) : null,
    parqetTyp: row.parqet_typ != null ? String(row.parqet_typ) : null,
    steuerEur: row.steuer_eur != null ? Number(row.steuer_eur) : null,
    assetKlasse: row.asset_klasse as PortfolioBuchung['assetKlasse'],
    quelle: row.quelle as PortfolioBuchung['quelle'],
  }
}

async function ladeBuchungenAdmin(): Promise<PortfolioBuchung[]> {
  const ownerUserId = requireOwnerUserId()
  const buchungen: PortfolioBuchung[] = []
  let offset = 0

  while (buchungen.length < PORTFOLIO_MAX_BUCHUNGEN) {
    const bis = Math.min(offset + PORTFOLIO_DB_SEITEN_GROESSE - 1, PORTFOLIO_MAX_BUCHUNGEN - 1)
    const { data, error } = await createSupabaseAdmin()
      .from('portfolio_analyse_buchung')
      .select('*')
      .eq('owner_user_id', ownerUserId)
      .order('datum', { ascending: false })
      .range(offset, bis)

    if (error) throw new Error(error.message)

    const seite = (data ?? []).map((r) => mapBuchungRow(r as Record<string, unknown>))
    buchungen.push(...seite)

    if (seite.length < PORTFOLIO_DB_SEITEN_GROESSE) break
    offset += PORTFOLIO_DB_SEITEN_GROESSE
    if (buchungen.length >= PORTFOLIO_MAX_BUCHUNGEN) break
  }

  return buchungen
}

/** Depot-Aktien für Fundamental-Cache (Whitelist deckt die nicht alle ab, z. B. LVMH). */
export async function ladeDepotAktieAnfragen(): Promise<FundamentaldatenAnfrage[]> {
  if (!istKonfiguriert()) return []
  try {
    const snap = await ladeSnapshotAdmin()
    const out: FundamentaldatenAnfrage[] = []
    const seen = new Set<string>()
    for (const p of snap?.positionen ?? []) {
      const isin = p.isin?.trim().toUpperCase()
      if (!isin || seen.has(isin)) continue
      if (p.assetKlasse === 'etf' || p.assetKlasse === 'anleihe' || p.assetKlasse === 'crypto' || p.assetKlasse === 'geldmarkt') {
        continue
      }
      const ken = isinKenntnis(isin)
      if (p.assetKlasse !== 'aktie' && !ken) continue
      seen.add(isin)
      out.push({
        isin,
        name: p.name || ken?.name || isin,
        symbolYahoo: ken?.symbolYahoo ?? null,
        symbolCandidates: ken?.symbolCandidates,
        frequenz: 'jahr',
      })
    }
    return out
  } catch (e) {
    console.warn('[depot-aktie-anfragen]', e)
    return []
  }
}

export type DepotRadarAktie = {
  isin: string
  name: string
  symbolYahoo: string | null
  symbolCandidates: string[]
}

function istRadarAktieKlasse(klasse: string | undefined): boolean {
  return klasse !== 'etf' && klasse !== 'anleihe' && klasse !== 'crypto' && klasse !== 'geldmarkt'
}

/** Aktienpositionen des aktuellen Kontos für den Nachkauf-Radar (Live-Depot, Snapshot-Fallback). */
export async function ladeDepotRadarAktien(): Promise<DepotRadarAktie[]> {
  if (!istKonfiguriert()) return []
  const seen = new Set<string>()
  const out: DepotRadarAktie[] = []

  const push = (isinRoh: string, name: string, symbolYahoo?: string | null, symbolCandidates?: string[]) => {
    const isin = isinRoh.trim().toUpperCase()
    if (!/^[A-Z]{2}[A-Z0-9]{10}$/.test(isin) || seen.has(isin)) return
    const ken = isinKenntnis(isin)
    seen.add(isin)
    out.push({
      isin,
      name: name.trim() || ken?.name || isin,
      symbolYahoo: symbolYahoo ?? ken?.symbolYahoo ?? null,
      symbolCandidates: symbolCandidates?.length ? symbolCandidates : ken?.symbolCandidates ?? [],
    })
  }

  try {
    const paket = await ladeLivePortfolioServer()
    for (const p of paket?.live.positionen ?? []) {
      const isin = p.isin?.trim().toUpperCase()
      if (!isin) continue
      if (!(p.stueck > 0 || p.wertLiveEur > 0)) continue
      if (!istRadarAktieKlasse(p.assetKlasse)) continue
      const ken = isinKenntnis(isin)
      if (p.assetKlasse !== 'aktie' && !ken) continue
      push(isin, p.anzeigeName || p.name, p.symbolYahoo ?? ken?.symbolYahoo, ken?.symbolCandidates)
    }
  } catch (e) {
    console.warn('[depot-radar-aktien] Live-Depot:', e)
  }

  if (out.length === 0) {
    for (const d of await ladeDepotAktieAnfragen()) {
      if (!d.isin) continue
      push(d.isin, d.name ?? d.isin, d.symbolYahoo, d.symbolCandidates)
    }
  }
  return out
}

async function ladeSnapshotAdmin(): Promise<PortfolioDbSnapshot | null> {
  const { data, error } = await createSupabaseAdmin()
    .from('portfolio_analyse_snapshot')
    .select('*')
    .eq('owner_user_id', requireOwnerUserId())
    .order('erfasst_am', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error || !data) return null

  const s = data as Record<string, unknown>
  return {
    id: String(s.id),
    erfasst_am: String(s.erfasst_am),
    depotwert_eur: s.depotwert_eur != null ? Number(s.depotwert_eur) : null,
    positionen: Array.isArray(s.positionen) ? s.positionen : [],
  }
}

async function ladeLiveKurseServer(symbols: string[]): Promise<LiveKursePaket> {
  const stooqEur = new Map<string, number>()
  if (symbols.length === 0) {
    return { kurse: new Map(), stand: null, fx: fxKurseAusYahooMap(new Map()), stooqEur }
  }

  const stooqKeys = symbols.filter((s) => s.toLowerCase().startsWith('stooq:'))
  const yahooSyms = symbols.filter((s) => !s.toLowerCase().startsWith('stooq:'))

  for (const key of stooqKeys) {
    const stooqSym = key.slice(key.indexOf(':') + 1)
    const preis = await ladeStooqSchlusskurs(stooqSym)
    if (preis != null) stooqEur.set(key.toUpperCase(), preis)
  }

  const map = new Map<string, YahooKursZeile>()
  const symbole = [...new Set([...yahooSyms, ...FX_SYMBOLE])]
  for (const batch of teileArray(symbole, KURSE_BATCH)) {
    const part = await ladeYahooKurse(batch)
    for (const [k, v] of part) map.set(k, v)
  }

  return {
    kurse: map,
    stand: new Date().toISOString(),
    fx: fxKurseAusYahooMap(map),
    stooqEur,
  }
}

export type LivePortfolioServerPaket = {
  live: LivePortfolio
  meta: Map<string, IsinMetadata>
}

const DEPOT_CACHE_MS = 3 * 60 * 1000
const depotCache = new Map<string, { at: number; paket: LivePortfolioServerPaket | null }>()
const depotInflight = new Map<string, Promise<LivePortfolioServerPaket | null>>()

async function ladeLivePortfolioServerUncached(): Promise<LivePortfolioServerPaket | null> {
  const [buchungen, snapshot] = await Promise.all([ladeBuchungenAdmin(), ladeSnapshotAdmin()])
  if (buchungen.length === 0 && !snapshot?.positionen?.length) return null

  const isins = sammleIsins(buchungen, snapshot)
  const metaList = isins.length > 0 ? await lookupIsinMetadaten(isins) : []
  const meta = new Map(metaList.map((m) => [m.isin.toUpperCase(), m]))

  const positionen = positionenFuerBewertung(buchungen, snapshot)
  const symbole = symboleAusMeta(positionen, meta)
  const { kurse, stand, fx, stooqEur } = await ladeLiveKurseServer(symbole)

  const live = berechneLivePortfolio(buchungen, snapshot, meta, kurse, stand, fx, stooqEur)
  return { live, meta }
}

/** Live-Portfolio wie Dashboard — volle Positionen + Kennzahlen (serverseitig). */
export async function ladeLivePortfolioServer(): Promise<LivePortfolioServerPaket | null> {
  if (!istKonfiguriert()) return null
  const ownerUserId = requireOwnerUserId()
  const cached = depotCache.get(ownerUserId)
  if (cached && Date.now() - cached.at < DEPOT_CACHE_MS) return cached.paket
  const laufend = depotInflight.get(ownerUserId)
  if (laufend) return laufend
  const job = ladeLivePortfolioServerUncached()
    .then((paket) => {
      depotCache.set(ownerUserId, { at: Date.now(), paket })
      return paket
    })
    .catch((e) => {
      console.warn('[depot-gewichte] Live-Portfolio laden fehlgeschlagen:', e)
      return null
    })
    .finally(() => {
      depotInflight.delete(ownerUserId)
    })
  depotInflight.set(ownerUserId, job)
  return job
}

/**
 * Live-Depot wie Dashboard (Buchungen + Snapshot + Live-Kurse).
 */
async function ladeLiveDepotPaket(): Promise<LiveDepotPaket | null> {
  const paket = await ladeLivePortfolioServer()
  if (!paket) return null

  const { live } = paket
  return {
    depotwertEur: live.kennzahlen.depotwertEur,
    positionen: live.positionen
      .filter((p) => p.isin && p.wertLiveEur > 0)
      .map((p) => ({
        isin: p.isin!.toUpperCase(),
        name: p.anzeigeName ?? p.name,
        gewichtProzent: p.gewichtProzent,
        wertLiveEur: p.wertLiveEur,
      })),
  }
}

/** Depot-Übersicht als Text — identische Quelle wie Portfolio-Dashboard. */
export async function formatDepotDashboardKontext(aktuelleIsin?: string | null): Promise<string> {
  const depot = await ladeLiveDepotPaket()
  if (!depot || depot.positionen.length === 0) {
    return 'Kein Depot geladen (keine Buchungen oder kein Snapshot).'
  }

  const isinMark = aktuelleIsin?.trim().toUpperCase() ?? ''
  const zeilen = [
    `Gesamt-Depotwert (live): ${depot.depotwertEur.toLocaleString('de-DE', { maximumFractionDigits: 0 })} €`,
    'Positionen nach Gewicht (wie Dashboard):',
    ...depot.positionen.slice(0, 18).map((p) => {
      const mark = p.isin === isinMark ? '  ← DIESE POSITION' : ''
      return `- ${p.name} (${p.isin}): ${p.gewichtProzent.toFixed(1)} % · ${p.wertLiveEur.toLocaleString('de-DE', { maximumFractionDigits: 0 })} €${mark}`
    }),
  ]
  if (depot.positionen.length > 18) {
    zeilen.push(`… und ${depot.positionen.length - 18} weitere Positionen`)
  }
  return zeilen.join('\n')
}

/**
 * Depot-Gewichte wie im Dashboard: Buchungen + Snapshot-Merge + Live-Kurse.
 * Fallback auf Einstandswerte, wenn Kurse nicht verfügbar sind.
 */
export async function ladeDepotGewichteMap(): Promise<Map<string, DepotGewicht>> {
  const out = new Map<string, DepotGewicht>()
  const depot = await ladeLiveDepotPaket()
  if (!depot) return out

  for (const p of depot.positionen) {
    const isin = p.isin?.trim().toUpperCase()
    if (!isin) continue
    out.set(isin, {
      investiertEur: p.wertLiveEur,
      anteilPct: p.gewichtProzent,
    })
  }
  return out
}
