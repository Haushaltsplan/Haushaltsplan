/**
 * Nachkauf-Radar — Performance-Tracking (Empfehlungen + Score-Signal-Backtest).
 */

import 'server-only'

import { isinKenntnis } from '@/lib/portfolio-analyse/isin-kenntnisse'
import { ladeMomentumLiveKurs } from '@/lib/portfolio-analyse/momentum-trader/momentum-yahoo-quote-server'
import { yahooSchlusskursAm } from '@/lib/portfolio-analyse/yahoo-corporate-actions-client'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { ladeNachkaufScanAusCloud } from './nachkauf-radar-db-server'
import type { NachkaufScanEintrag, SparplanPosten } from './nachkauf-radar-types'
import type {
  NachkaufPerformanceUebersicht,
  NachkaufScoreBucketStat,
  NachkaufTrackingEintrag,
} from './nachkauf-radar-types'

const TABLE = 'nachkauf_empfehlung_tracking' as const
const VERLAUF_TABLE = 'nachkauf_radar_scan_verlauf' as const
const SPY = 'SPY'
const TAGE_6M = 183
const TAGE_12M = 365

function istKonfiguriert(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim())
}

function admin() {
  return createSupabaseAdmin()
}

/** Service Role hat kein auth.uid() — Owner aus Portfolio-Buchungen ableiten. */
export async function ladePortfolioOwnerUserId(): Promise<string | null> {
  if (!istKonfiguriert()) return null
  try {
    const { data: buchung } = await admin()
      .from('portfolio_analyse_buchung')
      .select('owner_user_id')
      .not('owner_user_id', 'is', null)
      .limit(1)
      .maybeSingle()
    if (buchung?.owner_user_id) return String(buchung.owner_user_id)

    const { data: emp } = await admin()
      .from('nachkauf_kaufempfehlung')
      .select('owner_user_id')
      .not('owner_user_id', 'is', null)
      .limit(1)
      .maybeSingle()
    return emp?.owner_user_id ? String(emp.owner_user_id) : null
  } catch {
    return null
  }
}

function addDaysIso(iso: string, tage: number): string {
  const d = new Date(iso.slice(0, 10) + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + tage)
  return d.toISOString().slice(0, 10)
}

function renditePct(von: number, bis: number): number | null {
  if (von <= 0 || bis <= 0) return null
  return Math.round(((bis - von) / von) * 1000) / 10
}

function scoreBucket(score: number): string {
  if (score >= 90) return '90+'
  if (score >= 80) return '80–89'
  if (score >= 70) return '70–79'
  return '<70'
}

type TrackingRow = {
  id: string
  monat: string
  ticker: string
  isin: string | null
  name: string | null
  empfohlen_betrag_eur: number
  score: number
  ampel: string | null
  kauf_trigger: boolean
  forward_pe: number | null
  premium_discount_pct: number | null
  kurs_usd: number | null
  empfohlen_am: string
  kurs_6m_usd: number | null
  kurs_12m_usd: number | null
  rendite_6m_pct: number | null
  rendite_12m_pct: number | null
  spy_rendite_6m_pct: number | null
  spy_rendite_12m_pct: number | null
  ausgewertet_6m_am: string | null
  ausgewertet_12m_am: string | null
}

function rowZuEintrag(r: TrackingRow): NachkaufTrackingEintrag {
  const alpha6m =
    r.rendite_6m_pct != null && r.spy_rendite_6m_pct != null
      ? Math.round((r.rendite_6m_pct - r.spy_rendite_6m_pct) * 10) / 10
      : null
  const alpha12m =
    r.rendite_12m_pct != null && r.spy_rendite_12m_pct != null
      ? Math.round((r.rendite_12m_pct - r.spy_rendite_12m_pct) * 10) / 10
      : null
  let status: NachkaufTrackingEintrag['status'] = 'offen'
  if (r.ausgewertet_12m_am) status = 'voll'
  else if (r.ausgewertet_6m_am) status = '6m'

  return {
    monat: r.monat,
    ticker: r.ticker,
    name: r.name ?? r.ticker,
    empfohlenBetragEur: Number(r.empfohlen_betrag_eur),
    score: r.score,
    kaufTrigger: r.kauf_trigger,
    empfohlenAm: r.empfohlen_am,
    kursUsd: r.kurs_usd,
    rendite6mPct: r.rendite_6m_pct,
    rendite12mPct: r.rendite_12m_pct,
    spyRendite6mPct: r.spy_rendite_6m_pct,
    spyRendite12mPct: r.spy_rendite_12m_pct,
    alpha6mPct: alpha6m,
    alpha12mPct: alpha12m,
    status,
  }
}

async function yahooSymbol(ticker: string, isin: string | null): Promise<string> {
  const k = isin ? isinKenntnis(isin) : null
  return k?.symbolYahoo ?? ticker
}

/** Snapshots beim Speichern der Monats-Kaufempfehlung. */
export async function speichereEmpfehlungTracking(opts: {
  monat: string
  basisAllokation: SparplanPosten[]
  scanMap: Map<string, NachkaufScanEintrag>
  ownerUserId?: string | null
  empfohlenAm?: string
}): Promise<void> {
  if (!istKonfiguriert() || opts.basisAllokation.length === 0) return

  const ownerUserId = opts.ownerUserId ?? (await ladePortfolioOwnerUserId())
  if (!ownerUserId) {
    console.warn('[nachkauf-performance] Kein owner_user_id — Tracking übersprungen')
    return
  }

  const jetzt = opts.empfohlenAm ?? new Date().toISOString()
  const zeilen: Record<string, unknown>[] = []

  for (const posten of opts.basisAllokation) {
    const e = opts.scanMap.get(posten.ticker.toUpperCase())
    if (!e) continue
    const sym = await yahooSymbol(e.ticker, e.isin)
    const live = await ladeMomentumLiveKurs(sym).catch(() => null)
    zeilen.push({
      owner_user_id: ownerUserId,
      monat: opts.monat,
      ticker: e.ticker.toUpperCase(),
      isin: e.isin || null,
      name: e.name,
      empfohlen_betrag_eur: posten.betragEur,
      score: e.score,
      ampel: e.ampel,
      kauf_trigger: e.kaufTriggerAusgeloest,
      forward_pe: e.bewertung.forwardPe,
      premium_discount_pct: e.bewertung.premiumDiscountPct,
      kurs_usd: live?.preis ?? null,
      empfohlen_am: jetzt,
    })
  }

  if (zeilen.length === 0) return
  const { error } = await admin()
    .from(TABLE)
    .upsert(zeilen, { onConflict: 'owner_user_id,monat,ticker' })
  if (error) console.warn('[nachkauf-performance] Snapshot speichern:', error.message)
}

/**
 * Fehlende Tracking-Zeilen aus gespeicherter Kaufempfehlung nachziehen
 * (z. B. wenn beim ersten Speichern owner_user_id fehlte).
 */
export async function backfillEmpfehlungTracking(monat?: string): Promise<number> {
  if (!istKonfiguriert()) return 0
  const ownerUserId = await ladePortfolioOwnerUserId()
  if (!ownerUserId) return 0

  const zielMonat = monat ?? new Date().toISOString().slice(0, 7)

  const { data: empRow } = await admin()
    .from('nachkauf_kaufempfehlung')
    .select('monat, basis_allokation, erstellt_am')
    .eq('monat', zielMonat)
    .order('erstellt_am', { ascending: false })
    .limit(1)
    .maybeSingle()

  const allokation = (empRow as { basis_allokation?: SparplanPosten[] } | null)?.basis_allokation
  if (!allokation?.length) return 0

  const { data: vorhanden } = await admin()
    .from(TABLE)
    .select('ticker')
    .eq('owner_user_id', ownerUserId)
    .eq('monat', zielMonat)

  const vorhandenSet = new Set(
    ((vorhanden ?? []) as Array<{ ticker: string }>).map((r) => r.ticker.toUpperCase()),
  )
  const fehlend = allokation.filter((p) => !vorhandenSet.has(p.ticker.toUpperCase()))
  if (fehlend.length === 0) return 0

  const scan = await ladeNachkaufScanAusCloud()
  const scanMap = new Map(scan.map((e) => [e.ticker.toUpperCase(), e]))
  const erstelltAm =
    (empRow as { erstellt_am?: string } | null)?.erstellt_am ?? new Date().toISOString()

  await speichereEmpfehlungTracking({
    monat: zielMonat,
    basisAllokation: fehlend,
    scanMap,
    ownerUserId,
    empfohlenAm: erstelltAm,
  })
  return fehlend.length
}

async function aktualisiereEineZeile(row: TrackingRow): Promise<void> {
  const basisTag = row.empfohlen_am.slice(0, 10)
  const heute = new Date().toISOString().slice(0, 10)
  const tag6m = addDaysIso(basisTag, TAGE_6M)
  const tag12m = addDaysIso(basisTag, TAGE_12M)
  const sym = await yahooSymbol(row.ticker, row.isin)
  const startKurs = row.kurs_usd ?? (await yahooSchlusskursAm(sym, basisTag))
  if (!startKurs || startKurs <= 0) return

  const updates: Record<string, unknown> = {}

  if (!row.ausgewertet_6m_am && heute >= tag6m) {
    const kurs6m = await yahooSchlusskursAm(sym, tag6m)
    const spyStart = await yahooSchlusskursAm(SPY, basisTag)
    const spy6m = await yahooSchlusskursAm(SPY, tag6m)
    if (kurs6m) {
      updates.kurs_6m_usd = kurs6m
      updates.rendite_6m_pct = renditePct(startKurs, kurs6m)
      updates.spy_rendite_6m_pct =
        spyStart && spy6m ? renditePct(spyStart, spy6m) : null
      updates.ausgewertet_6m_am = new Date().toISOString()
    }
  }

  if (!row.ausgewertet_12m_am && heute >= tag12m) {
    const kurs12m = await yahooSchlusskursAm(sym, tag12m)
    const spyStart = await yahooSchlusskursAm(SPY, basisTag)
    const spy12m = await yahooSchlusskursAm(SPY, tag12m)
    if (kurs12m) {
      updates.kurs_12m_usd = kurs12m
      updates.rendite_12m_pct = renditePct(startKurs, kurs12m)
      updates.spy_rendite_12m_pct =
        spyStart && spy12m ? renditePct(spyStart, spy12m) : null
      updates.ausgewertet_12m_am = new Date().toISOString()
    }
  }

  if (Object.keys(updates).length === 0) return
  await admin().from(TABLE).update(updates).eq('id', row.id)
}

/** Fällige 6M/12M-Outcomes nachziehen (max. 12 Zeilen pro Aufruf). */
export async function aktualisiereFaelligeOutcomes(): Promise<void> {
  if (!istKonfiguriert()) return
  const heute = new Date().toISOString().slice(0, 10)

  const { data } = await admin()
    .from(TABLE)
    .select('*')
    .order('empfohlen_am', { ascending: true })
    .limit(100)

  let updated = 0
  for (const row of (data ?? []) as TrackingRow[]) {
    const basisTag = row.empfohlen_am.slice(0, 10)
    const need6m = !row.ausgewertet_6m_am && addDaysIso(basisTag, TAGE_6M) <= heute
    const need12m = !row.ausgewertet_12m_am && addDaysIso(basisTag, TAGE_12M) <= heute
    if (!need6m && !need12m) continue
    if (updated >= 12) break
    await aktualisiereEineZeile(row)
    updated++
  }
}

function aggregiereBuckets(eintraege: NachkaufTrackingEintrag[]): NachkaufScoreBucketStat[] {
  const map = new Map<string, { n: number; alphaSum: number; alphaN: number }>()
  for (const e of eintraege) {
    if (e.alpha6mPct == null) continue
    const b = scoreBucket(e.score)
    const cur = map.get(b) ?? { n: 0, alphaSum: 0, alphaN: 0 }
    cur.n++
    cur.alphaSum += e.alpha6mPct
    cur.alphaN++
    map.set(b, cur)
  }
  const order = ['90+', '80–89', '70–79', '<70']
  return order
    .filter((b) => map.has(b))
    .map((b) => {
      const v = map.get(b)!
      return {
        bucket: b,
        anzahl: v.n,
        avgAlpha6mPct: v.alphaN > 0 ? Math.round((v.alphaSum / v.alphaN) * 10) / 10 : null,
      }
    })
}

/** Score-Signal-Backtest aus Scan-Verlauf (6M Forward vs. SPY). */
async function berechneScoreSignalBacktest(): Promise<NachkaufScoreBucketStat[]> {
  if (!istKonfiguriert()) return []
  const heute = new Date().toISOString().slice(0, 10)
  const seit = addDaysIso(heute, -540)

  const { data } = await admin()
    .from(VERLAUF_TABLE)
    .select('ticker, score, gescannt_am')
    .gte('gescannt_am', seit + 'T00:00:00Z')
    .order('gescannt_am', { ascending: true })
    .limit(400)

  if (!data?.length) return []

  const gesehen = new Set<string>()
  const punkte: { ticker: string; score: number; datum: string }[] = []
  for (const r of data as Array<{ ticker: string; score: number; gescannt_am: string }>) {
    const datum = r.gescannt_am.slice(0, 10)
    const tag6m = addDaysIso(datum, TAGE_6M)
    if (tag6m > heute) continue
    const key = `${r.ticker}:${datum.slice(0, 7)}`
    if (gesehen.has(key)) continue
    gesehen.add(key)
    punkte.push({ ticker: r.ticker, score: r.score, datum })
    if (punkte.length >= 20) break
  }

  const bucketMap = new Map<string, { n: number; alphaSum: number }>()
  for (const p of punkte) {
    const sym = p.ticker
    const start = await yahooSchlusskursAm(sym, p.datum)
    const end = await yahooSchlusskursAm(sym, addDaysIso(p.datum, TAGE_6M))
    const spyStart = await yahooSchlusskursAm(SPY, p.datum)
    const spyEnd = await yahooSchlusskursAm(SPY, addDaysIso(p.datum, TAGE_6M))
    if (!start || !end || !spyStart || !spyEnd) continue
    const alpha = (renditePct(start, end) ?? 0) - (renditePct(spyStart, spyEnd) ?? 0)
    const b = scoreBucket(p.score)
    const cur = bucketMap.get(b) ?? { n: 0, alphaSum: 0 }
    cur.n++
    cur.alphaSum += alpha
    bucketMap.set(b, cur)
  }

  const order = ['90+', '80–89', '70–79', '<70']
  return order
    .filter((b) => bucketMap.has(b))
    .map((b) => {
      const v = bucketMap.get(b)!
      return {
        bucket: b,
        anzahl: v.n,
        avgAlpha6mPct: Math.round((v.alphaSum / v.n) * 10) / 10,
      }
    })
}

export async function ladeNachkaufPerformance(): Promise<NachkaufPerformanceUebersicht> {
  if (!istKonfiguriert()) {
    return {
      anzahlEmpfehlungen: 0,
      ausgewertet6m: 0,
      ausgewertet12m: 0,
      avgRendite6mPct: null,
      avgAlpha6mPct: null,
      avgRendite12mPct: null,
      avgAlpha12mPct: null,
      trefferquote6mPct: null,
      scoreBucketsEmpfehlung: [],
      scoreBucketsSignal: [],
      eintraege: [],
    }
  }

  await backfillEmpfehlungTracking().catch((e) =>
    console.warn('[nachkauf-performance] Backfill:', e),
  )

  await aktualisiereFaelligeOutcomes()

  const ownerUserId = await ladePortfolioOwnerUserId()
  let query = admin().from(TABLE).select('*').order('empfohlen_am', { ascending: false }).limit(48)
  if (ownerUserId) query = query.eq('owner_user_id', ownerUserId)
  const { data } = await query

  const eintraege = ((data ?? []) as TrackingRow[]).map(rowZuEintrag)
  const mit6m = eintraege.filter((e) => e.rendite6mPct != null)
  const mit12m = eintraege.filter((e) => e.rendite12mPct != null)
  const avg = (vals: number[]) =>
    vals.length ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10 : null

  const alphas6m = mit6m.map((e) => e.alpha6mPct).filter((v): v is number => v != null)
  const treffer6m =
    alphas6m.length > 0
      ? Math.round((alphas6m.filter((a) => a > 0).length / alphas6m.length) * 1000) / 10
      : null

  const signalBuckets = await berechneScoreSignalBacktest()

  return {
    anzahlEmpfehlungen: eintraege.length,
    ausgewertet6m: mit6m.length,
    ausgewertet12m: mit12m.length,
    avgRendite6mPct: avg(mit6m.map((e) => e.rendite6mPct!)),
    avgAlpha6mPct: avg(alphas6m),
    avgRendite12mPct: avg(mit12m.map((e) => e.rendite12mPct!)),
    avgAlpha12mPct: avg(
      mit12m.map((e) => e.alpha12mPct).filter((v): v is number => v != null),
    ),
    trefferquote6mPct: treffer6m,
    scoreBucketsEmpfehlung: aggregiereBuckets(eintraege),
    scoreBucketsSignal: signalBuckets,
    eintraege,
  }
}
