/** Nachkauf-Radar — Supabase-Persistenz (Service Role, server-only). */

import 'server-only'

import { ladeDepotGewichteMap, type DepotGewicht } from '@/lib/portfolio-analyse/depot-gewichte-server'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import type {
  NachkaufAmpel,
  NachkaufDeepResearch,
  NachkaufScanEintrag,
  NachkaufScoreDetail,
  TrimSignal,
} from './nachkauf-radar-types'
import type { NachkaufZusatzSignale } from './nachkauf-zusatz-signale-server'

export type { DepotGewicht }

/**
 * Depot-Gewichte pro ISIN — dieselbe Logik wie das Portfolio-Dashboard
 * (Buchungen + Snapshot-Merge + Live-Kurse, nicht nur letzter PDF-Snapshot).
 */
export async function ladeDepotGewichte(): Promise<Map<string, DepotGewicht>> {
  return ladeDepotGewichteMap()
}

const TABLE_SCAN = 'nachkauf_radar_scan' as const
const TABLE_DEEP = 'nachkauf_radar_deep_research' as const

function istKonfiguriert(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim())
}

function admin() {
  return createSupabaseAdmin()
}

// ---------------------------------------------------------------------------
// Scan — lesen
// ---------------------------------------------------------------------------

export async function ladeNachkaufScanAusCloud(): Promise<NachkaufScanEintrag[]> {
  if (!istKonfiguriert()) return []
  try {
    const { data, error } = await admin()
      .from(TABLE_SCAN)
      .select('*')
      .order('score', { ascending: false })
    if (error) {
      console.warn('[nachkauf-radar] Scan laden:', error.message)
      return []
    }
    return (data ?? []).map(dbZeileZuEintrag)
  } catch (e) {
    console.warn('[nachkauf-radar] Scan laden fehlgeschlagen:', e)
    return []
  }
}

export async function ladeNachkaufScanDatum(): Promise<string | null> {
  if (!istKonfiguriert()) return null
  try {
    const { data, error } = await admin()
      .from(TABLE_SCAN)
      .select('gescannt_am')
      .order('gescannt_am', { ascending: false })
      .limit(1)
    if (error || !data?.length) return null
    return (data[0] as { gescannt_am: string }).gescannt_am
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Scan — schreiben
// ---------------------------------------------------------------------------

export async function speichereNachkaufScanEintraege(eintraege: NachkaufScanEintrag[]): Promise<void> {
  if (!istKonfiguriert() || eintraege.length === 0) return
  try {
    const zeilen = eintraege.map(eintragZuDbZeile)
    const { error } = await admin()
      .from(TABLE_SCAN)
      .upsert(zeilen, { onConflict: 'ticker' })
    if (error) console.warn('[nachkauf-radar] Scan speichern:', error.message)
  } catch (e) {
    console.warn('[nachkauf-radar] Scan speichern fehlgeschlagen:', e)
  }
}

// ---------------------------------------------------------------------------
// Deep Research — lesen
// ---------------------------------------------------------------------------

export async function ladeDeepResearchFuerTicker(ticker: string): Promise<NachkaufDeepResearch | null> {
  if (!istKonfiguriert()) return null
  try {
    const { data, error } = await admin()
      .from(TABLE_DEEP)
      .select('ticker, isin, memo, erstellt_am')
      .eq('ticker', ticker.trim().toUpperCase())
      .maybeSingle()
    if (error || !data) return null
    const r = data as { ticker: string; isin: string; memo: string; erstellt_am: string }
    return { ticker: r.ticker, isin: r.isin, memo: r.memo, erstellt_am: r.erstellt_am }
  } catch {
    return null
  }
}

export async function ladeAlleDeepResearch(): Promise<Map<string, NachkaufDeepResearch>> {
  const out = new Map<string, NachkaufDeepResearch>()
  if (!istKonfiguriert()) return out
  try {
    const { data, error } = await admin()
      .from(TABLE_DEEP)
      .select('ticker, isin, memo, erstellt_am')
    if (error) return out
    for (const r of data ?? []) {
      const row = r as { ticker: string; isin: string; memo: string; erstellt_am: string }
      out.set(row.ticker.toUpperCase(), {
        ticker: row.ticker,
        isin: row.isin,
        memo: row.memo,
        erstellt_am: row.erstellt_am,
      })
    }
  } catch {
    // ignore
  }
  return out
}

// ---------------------------------------------------------------------------
// Deep Research — schreiben
// ---------------------------------------------------------------------------

export async function speichereDeepResearch(dr: NachkaufDeepResearch): Promise<void> {
  if (!istKonfiguriert()) return
  try {
    const { error } = await admin()
      .from(TABLE_DEEP)
      .upsert(
        {
          ticker: dr.ticker.trim().toUpperCase(),
          isin: dr.isin ?? '',
          memo: dr.memo,
          erstellt_am: dr.erstellt_am,
        },
        { onConflict: 'ticker' },
      )
    if (error) console.warn('[nachkauf-radar] Deep Research speichern:', error.message)
  } catch (e) {
    console.warn('[nachkauf-radar] Deep Research speichern fehlgeschlagen:', e)
  }
}

// ---------------------------------------------------------------------------
// Konvertierung DB ↔ Typ
// ---------------------------------------------------------------------------

function jsonSpalte<T>(raw: unknown): T | null {
  if (raw == null) return null
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as T
    } catch {
      return null
    }
  }
  if (typeof raw === 'object') return raw as T
  return null
}

function scoreDetailAusDb(r: DbZeile): NachkaufScoreDetail {
  const gesamt = r.score ?? 0
  const json = jsonSpalte<NachkaufScoreDetail>(r.score_detail)
  if (json) {
    return { ...json, gesamt: r.score ?? json.gesamt }
  }
  return {
    mantraScore: r.score_mantra ?? 0,
    bewertungsScore: r.score_bewertung ?? 0,
    sellTriggerPenalty: r.score_sell_penalty ?? 0,
    historischerBewertungsBonus: r.score_hist_bonus ?? 0,
    datenSignaleDelta: 0,
    momentumPunkte: 0,
    strukturPunkte: 0,
    drawdownBonus: 0,
    insiderPunkte: 0,
    kauftriggerBonus: 0,
    regimeDelta: 0,
    earningsMalus: 0,
    deepResearchMalus: 0,
    klumpenMalus: 0,
    sektorMalus: 0,
    scoreKalibrierung: 0,
    qualitaetsRang: 0,
    timingRang: 0,
    kombiniertRang: gesamt,
    datenVollstaendigkeitPct: 0,
    gesamt,
  }
}

type DbZeile = {
  ticker: string
  isin: string
  name: string
  ampel: string
  score: number
  mantra_ampel: string | null
  mantra_score_pct: number | null
  sell_trigger_ok: boolean
  ki_begruendung: string | null
  fcf_yield_pct: number | null
  forward_pe: number | null
  drawdown_52w_pct: number | null
  gescannt_am: string
  // erweiterte Spalten (Migration 20260622200000)
  score_mantra: number | null
  score_bewertung: number | null
  score_hist_bonus: number | null
  score_sell_penalty: number | null
  premium_discount_pct: number | null
  kauf_trigger_ausgeloest: boolean | null
  kauf_trigger_text: string | null
  historischer_median_pe: number | null
  historischer_median_fcf_yield: number | null
  ntm_ev_ebitda: number | null
  ntm_ev_rev: number | null
  historischer_median_ev_ebitda: number | null
  historischer_median_ev_rev: number | null
  ev_ebitda_perzentil_5y: number | null
  historisch_quelle: string | null
  daten_signale?: unknown
  score_detail?: unknown
  trim_signal?: unknown
}

function dbZeileZuEintrag(r: DbZeile): NachkaufScanEintrag {
  const datenSignale = jsonSpalte<NachkaufZusatzSignale>(r.daten_signale)
  const trimSignal = jsonSpalte<TrimSignal>(r.trim_signal) ?? undefined
  const scoreDetail = scoreDetailAusDb(r)
  if (datenSignale?.datenVollstaendigkeitPct != null) {
    scoreDetail.datenVollstaendigkeitPct = datenSignale.datenVollstaendigkeitPct
  }
  return {
    ticker: r.ticker,
    isin: r.isin ?? '',
    name: r.name ?? r.ticker,
    ampel: r.ampel as NachkaufAmpel,
    score: r.score ?? 0,
    scoreDetail,
    bewertung: {
      fcfYieldPct: r.fcf_yield_pct ?? null,
      forwardPe: r.forward_pe ?? null,
      drawdown52wPct: r.drawdown_52w_pct ?? null,
      premiumDiscountPct: r.premium_discount_pct ?? null,
      historischerMedianPe: r.historischer_median_pe ?? null,
      historischerMedianFcfYield: r.historischer_median_fcf_yield ?? null,
      historischQuelle: (r.historisch_quelle as 'macrotrends' | 'whitelist' | null) ?? null,
      ntmEvEbitda: r.ntm_ev_ebitda ?? null,
      ntmEvRev: r.ntm_ev_rev ?? null,
      historischerMedianEvEbitda: r.historischer_median_ev_ebitda ?? null,
      historischerMedianEvRev: r.historischer_median_ev_rev ?? null,
      evEbitdaPerzentil5y: r.ev_ebitda_perzentil_5y ?? null,
    },
    mantraAmpel: r.mantra_ampel ?? null,
    mantraScorePct: r.mantra_score_pct ?? null,
    sellTriggerOk: r.sell_trigger_ok ?? true,
    kiBegruendung: r.ki_begruendung ?? null,
    gescannt_am: r.gescannt_am,
    tiefenAnalyse: null,
    depotGewichtPct: null,
    klumpenrisiko: false,
    kaufTriggerAusgeloest: r.kauf_trigger_ausgeloest ?? false,
    kaufTriggerText: r.kauf_trigger_text ?? null,
    scoreVerlauf: [],
    insiderKaeufe: [],
    datenSignale: datenSignale ?? undefined,
    trimSignal,
  }
}

/** Reichert Scan-Einträge mit aktuellen Depot-Gewichten an (In-place). */
export async function ergaenzeDepotGewichte(eintraege: NachkaufScanEintrag[]): Promise<void> {
  const gewichte = await ladeDepotGewichte()
  for (const e of eintraege) {
    const g = gewichte.get(e.isin.toUpperCase())
    e.depotGewichtPct = g?.anteilPct ?? null
    e.klumpenrisiko = (g?.anteilPct ?? 0) >= 15
  }
}

function eintragZuDbZeile(e: NachkaufScanEintrag): Record<string, unknown> {
  return {
    ticker: e.ticker.trim().toUpperCase(),
    isin: e.isin ?? '',
    name: e.name,
    ampel: e.ampel,
    score: e.score,
    mantra_ampel: e.mantraAmpel ?? null,
    mantra_score_pct: e.mantraScorePct ?? null,
    sell_trigger_ok: e.sellTriggerOk,
    ki_begruendung: e.kiBegruendung ?? null,
    fcf_yield_pct: e.bewertung.fcfYieldPct ?? null,
    forward_pe: e.bewertung.forwardPe ?? null,
    drawdown_52w_pct: e.bewertung.drawdown52wPct ?? null,
    gescannt_am: e.gescannt_am,
    // erweiterte Spalten
    score_mantra: e.scoreDetail.mantraScore,
    score_bewertung: e.scoreDetail.bewertungsScore,
    score_hist_bonus: e.scoreDetail.historischerBewertungsBonus,
    score_sell_penalty: e.scoreDetail.sellTriggerPenalty,
    premium_discount_pct: e.bewertung.premiumDiscountPct ?? null,
    kauf_trigger_ausgeloest: e.kaufTriggerAusgeloest,
    kauf_trigger_text: e.kaufTriggerText ?? null,
    historischer_median_pe: e.bewertung.historischerMedianPe ?? null,
    historischer_median_fcf_yield: e.bewertung.historischerMedianFcfYield ?? null,
    historisch_quelle: e.bewertung.historischQuelle ?? null,
    ntm_ev_ebitda: e.bewertung.ntmEvEbitda ?? null,
    ntm_ev_rev: e.bewertung.ntmEvRev ?? null,
    historischer_median_ev_ebitda: e.bewertung.historischerMedianEvEbitda ?? null,
    historischer_median_ev_rev: e.bewertung.historischerMedianEvRev ?? null,
    ev_ebitda_perzentil_5y: e.bewertung.evEbitdaPerzentil5y ?? null,
    daten_signale: e.datenSignale ?? null,
    score_detail: e.scoreDetail,
    trim_signal: e.trimSignal ?? null,
  }
}

// ---------------------------------------------------------------------------
// Notizen — lesen / schreiben
// ---------------------------------------------------------------------------

const TABLE_NOTIZEN = 'nachkauf_radar_notizen' as const

export async function ladeNotizen(): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  if (!istKonfiguriert()) return out
  try {
    const { data, error } = await admin().from(TABLE_NOTIZEN).select('ticker, notiz')
    if (error || !data) return out
    for (const r of data as Array<{ ticker: string; notiz: string }>) {
      out.set(r.ticker.toUpperCase(), r.notiz)
    }
  } catch { /* ignore */ }
  return out
}

export async function speichereNotiz(ticker: string, notiz: string): Promise<void> {
  if (!istKonfiguriert()) return
  try {
    const { error } = await admin()
      .from(TABLE_NOTIZEN)
      .upsert(
        { ticker: ticker.trim().toUpperCase(), notiz, aktualisiert_am: new Date().toISOString() },
        { onConflict: 'ticker' },
      )
    if (error) console.warn('[nachkauf-notiz] Speichern fehlgeschlagen:', error.message)
  } catch (e) {
    console.warn('[nachkauf-notiz] Fehler:', e)
  }
}

// ---------------------------------------------------------------------------
// Kaufhistorie-Cache — aus Buchungen befüllen
// ---------------------------------------------------------------------------

const TABLE_KAUFHIST = 'nachkauf_radar_kaufhistorie_cache' as const

export type KaufhistorieEintrag = {
  ticker?: string
  letzterKaufAm: string | null
  anzahlKaeufe: number
  durchschnittskaufpreisEur: number | null
  tageSeitletztemKauf: number | null
}

export async function ladeKaufhistorie(): Promise<Map<string, KaufhistorieEintrag>> {
  const out = new Map<string, KaufhistorieEintrag>()
  if (!istKonfiguriert()) return out
  try {
    const { data, error } = await admin()
      .from(TABLE_KAUFHIST)
      .select('ticker, letzter_kauf_am, anzahl_kaeufe, avg_kaufpreis_eur')
    if (error || !data) return out
    const heute = Date.now()
    for (const r of data as Array<{ ticker: string; letzter_kauf_am: string | null; anzahl_kaeufe: number; avg_kaufpreis_eur: number | null }>) {
      const letzterKaufAm = r.letzter_kauf_am ?? null
      const tage = letzterKaufAm
        ? Math.floor((heute - new Date(letzterKaufAm).getTime()) / 86_400_000)
        : null
      out.set(r.ticker.toUpperCase(), {
        ticker: r.ticker,
        letzterKaufAm,
        anzahlKaeufe: r.anzahl_kaeufe,
        durchschnittskaufpreisEur: r.avg_kaufpreis_eur ?? null,
        tageSeitletztemKauf: tage,
      })
    }
  } catch { /* ignore */ }
  return out
}

/**
 * Aktualisiert den Kaufhistorie-Cache aus portfolio_analyse_buchung.
 * Wird nach jedem Scan einmal aufgerufen.
 */
export async function aktualisiereKaufhistorieCache(isins: string[]): Promise<void> {
  if (!istKonfiguriert() || isins.length === 0) return
  try {
    // Buchungen für alle Whitelist-ISINs laden
    // Nur 'kauf' und 'verkauf' — 'sparplan' ist kein valider Enum-Wert in portfolio_analyse_buchung
    const { data, error } = await admin()
      .from('portfolio_analyse_buchung')
      .select('isin, datum, kurs_eur, anzahl, typ')
      .in('isin', isins)
      .in('typ', ['kauf', 'verkauf'])
      .order('datum', { ascending: false })

    if (error || !data) return

    type BuchungsZeile = { isin: string; datum: string; kurs_eur: number | null; anzahl: number | null; typ: string }
    const buchungen = data as BuchungsZeile[]

    // Gruppierung nach ISIN
    const gruppenMap = new Map<string, BuchungsZeile[]>()
    for (const b of buchungen) {
      const isin = b.isin?.toUpperCase()
      if (!isin) continue
      const arr = gruppenMap.get(isin) ?? []
      arr.push(b)
      gruppenMap.set(isin, arr)
    }

    // Isin → Ticker mapping aus Whitelist-ISINs nicht direkt verfügbar hier
    // → Cache mit ISIN als Key, Ticker wird nachgelagert gemapped
    const zeilen: Array<Record<string, unknown>> = []
    for (const [isin, gruppe] of gruppenMap) {
      const sorted = gruppe.sort((a, b) => b.datum.localeCompare(a.datum))
      const letzterKauf = sorted[0]!
      const anzahl = gruppe.length

      // Durchschnittskaufpreis: gewichtetes Mittel
      let gesamtKosten = 0
      let gesamtAnteile = 0
      for (const b of gruppe) {
        if (b.kurs_eur != null && b.anzahl != null && b.kurs_eur > 0 && b.anzahl > 0) {
          gesamtKosten += b.kurs_eur * b.anzahl
          gesamtAnteile += b.anzahl
        }
      }
      const durchschnitt = gesamtAnteile > 0 ? gesamtKosten / gesamtAnteile : null

      // Ticker für ISIN nachschlagen (lazy — wir nutzen den ISIN selbst als Fallback)
      zeilen.push({
        ticker: isin, // wird im UI durch ISIN-Lookup ergänzt
        isin,
        letzter_kauf_am: letzterKauf.datum,
        anzahl_kaeufe: anzahl,
        avg_kaufpreis_eur: durchschnitt,
        aktualisiert_am: new Date().toISOString(),
      })
    }

    if (zeilen.length > 0) {
      await admin().from(TABLE_KAUFHIST).upsert(zeilen, { onConflict: 'ticker' })
    }
  } catch (e) {
    console.warn('[kaufhistorie-cache] Aktualisierung fehlgeschlagen:', e)
  }
}

/** Reichert Scan-Einträge mit Kaufhistorie und Notizen an (In-place). */
export async function ergaenzeKaufhistorieUndNotizen(eintraege: NachkaufScanEintrag[]): Promise<void> {
  const [kaufMap, notizMap] = await Promise.all([ladeKaufhistorie(), ladeNotizen()])
  for (const e of eintraege) {
    const hist = kaufMap.get(e.ticker.toUpperCase()) ?? kaufMap.get(e.isin.toUpperCase())
    if (hist) {
      e.kaufhistorie = hist
    }
    const notiz = notizMap.get(e.ticker.toUpperCase())
    if (notiz) e.notiz = notiz
  }
}
