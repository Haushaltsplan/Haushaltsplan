/**
 * Portfolio-Berater: Fundamentaldaten kompakt + Historie-5J + Quartals-Diff-Fallback.
 */

import 'server-only'

import { ladeFundamentaldaten } from '@/lib/portfolio-analyse/fundamentaldaten-server'
import type { FundamentaldatenPaket } from '@/lib/portfolio-analyse/fundamentaldaten-types'
import type { NachkaufScanEintrag } from '@/lib/portfolio-analyse/nachkauf-radar/nachkauf-radar-types'
import {
  ladeQuartalsKiDiffCache,
  type QuartalsKiDiffCloudZeile,
} from '@/lib/portfolio-analyse/quartals-ki-diff-cache-server'
import type {
  EarningsCallKiCloudZeile,
  SecBerichtKiCloudZeile,
} from '@/lib/portfolio-analyse/portfolio-ki-cache-cloud-server'
import { ladeQuartalsKiDiff } from '@/lib/portfolio-analyse/quartals-ki-diff-server'

const MAX_LADEN = 40
/** Fokus-Titel bei Cache-Miss: ≥ Macrotrends FETCH_TIMEOUT_MS + 5s. */
const LOAD_TIMEOUT_MS = 40_000
const TIMEOUT_CACHE_MS = 6_000
const PARALLEL_FUNDAMENTAL = 6

const KEY_METRIC_PRIORITAET = [
  'incremental_roic',
  'ltm_pe',
  'ntm_pe',
  'ltm_pfcf',
  'ltm_pb',
  'ltm_roic',
  'value_spread',
] as const

/** Deutsche Zeilen-IDs (Macrotrends/Yahoo) — früher fälschlich englische IDs → leere Historie. */
const ZEILEN_HIGHLIGHT = [
  'umsatz',
  'bruttogewinn',
  'ebit',
  'nettogewinn',
  'eps',
  'fcf',
  'ocf',
  'capex',
  'bruttomarge',
  'ebit_marge',
  'nettomarge',
  'roe',
  'roa',
  'roic',
  'kgv',
  'ps',
  'pb',
  'pfcf',
  'ev_ebitda',
  'ev_rev',
  'eigenkapital',
  'gesamtverschuldung',
  'bargeld',
] as const

const HISTORIE_KERN_FOKUS = [
  'umsatz',
  'nettogewinn',
  'eps',
  'fcf',
  'ebit',
  'bruttomarge',
  'roe',
  'kgv',
  'ps',
  'pb',
  'pfcf',
  'ev_ebitda',
  'ev_rev',
] as const

const HISTORIE_KERN_KURZ = ['umsatz', 'eps', 'fcf', 'kgv', 'ev_ebitda'] as const

export type FundamentalBeraterZiel = {
  isin: string
  name: string
  symbolYahoo: string | null
  symbolCandidates?: string[]
  fokus: boolean
  gewichtPct?: number | null
  ticker?: string | null
}

function kuerze(text: string | null | undefined, max: number): string | null {
  if (!text?.trim()) return null
  const t = text.trim()
  if (t.length <= max) return t
  return t.slice(0, max - 1).trimEnd() + '…'
}

function mitTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`Timeout ${label} (${ms}ms)`)), ms)
    p.then(
      (v) => {
        clearTimeout(t)
        resolve(v)
      },
      (e) => {
        clearTimeout(t)
        reject(e)
      },
    )
  })
}

function paketHatNutzbareDaten(p: FundamentaldatenPaket): boolean {
  if (p.zeilen.some((z) => Object.values(z.werte).some((v) => v != null && Number.isFinite(v)))) return true
  if (p.keyMetrics.some((m) => (m.wert && m.wert !== '–') || (m.zahl != null && Number.isFinite(m.zahl)))) {
    return true
  }
  return false
}

function periodenIso(p: FundamentaldatenPaket, max: number): string[] {
  return p.perioden
    .filter((pe) => !pe.istNtm && !pe.istSchaetzung && !pe.istLtm)
    .map((pe) => pe.iso)
    .sort()
    .reverse()
    .slice(0, max)
    .reverse()
}

function zeilenHighlights(p: FundamentaldatenPaket, fokus: boolean) {
  const perioden = periodenIso(p, fokus ? 6 : 5)
  const want = new Set<string>(ZEILEN_HIGHLIGHT)
  return p.zeilen
    .filter((z) => want.has(z.id))
    .map((z) => ({
      id: z.id,
      label: z.label,
      werte: Object.fromEntries(perioden.map((iso) => [iso, z.werte[iso] ?? null])),
    }))
    .filter((z) => Object.values(z.werte).some((v) => v != null))
}

/** Explizite 5-Jahres-Historie für den Berater (Umsatz/Gewinn/FCF/…). */
function historie5j(p: FundamentaldatenPaket, fokus: boolean) {
  const perioden = periodenIso(p, fokus ? 6 : 5)
  if (perioden.length === 0) return null
  const byId = new Map(p.zeilen.map((z) => [z.id, z]))
  const reihen: Record<string, Array<{ iso: string; wert: number | null }>> = {}
  const kern = fokus ? HISTORIE_KERN_FOKUS : HISTORIE_KERN_KURZ
  for (const id of kern) {
    const z = byId.get(id)
    if (!z) continue
    const serie = perioden.map((iso) => ({ iso, wert: z.werte[iso] ?? null }))
    if (serie.every((s) => s.wert == null)) continue
    reihen[id] = serie
  }
  if (Object.keys(reihen).length === 0) return null
  return { perioden, reihen }
}

function erweitertKompakt(p: FundamentaldatenPaket, fokus: boolean) {
  const e = p.erweitert
  if (!e) return null
  return {
    beatMiss: e.beatMiss
      ? {
          epsBeatRatePct: e.beatMiss.epsBeatRatePct,
          epsBeatRate12Pct: e.beatMiss.agg12?.epsBeatRatePct ?? null,
          streak: e.beatMiss.streak?.eps ?? null,
        }
      : null,
    dividenden: e.dividenden
      ? {
          cagr5yPct: e.dividenden.cagr5yPct,
          jahreOhneSenkung: e.dividenden.jahreOhneSenkung,
        }
      : null,
    insiderNetto: e.insiderNetto?.nettoRichtung ?? null,
    insiderKaeufe90d: e.insiderNetto?.kaeufe90d ?? null,
    insiderVerkaeufe90d: e.insiderNetto?.verkaeufe90d ?? null,
    debtRefi24mPct: e.debtMaturity?.refiAnteil24mPct ?? null,
    rdAktivierungsquotePct: e.rdKapitalisierung?.aktivierungsquotePct ?? null,
    secStruktur: e.secStruktur
      ? {
          segmentKonzentration: e.secStruktur.segmente?.[0]?.anteilPct ?? null,
          pensionMio: e.secStruktur.pensionVerpflichtungMio,
        }
      : null,
  }
}

export type BeraterFundamentalKompakt = {
  ok: boolean
  ticker: string
  firmenname: string
  sektor: string | null
  branche: string | null
  quelle: string | null
  fehler: string | null
  beschreibung: string | null
  keyMetrics: Array<{ label: string; wert: string; gruppe: string }>
  historie5j: {
    perioden: string[]
    reihen: Record<string, Array<{ iso: string; wert: number | null }>>
  } | null
  mantra: {
    ampel: string
    ampelScorePct: number | null
    ampelHinweis: string | null
    zusammenfassung: unknown
    standard: Array<{
      kategorie: string
      kennzahl: string
      zielwert: string
      istWert: string | null
      status: string
    }>
    sektor: Array<{
      kategorie: string
      kennzahl: string
      istWert: string | null
      status: string
    }>
    sellTriggerWatch: Array<{ titel: string; status: string; begruendung: string | null }>
  }
  zeilenHighlights: Array<{
    id: string
    label: string
    werte: Record<string, number | null>
  }>
  erweitert: {
    beatMiss: {
      epsBeatRatePct: number | null
      epsBeatRate12Pct: number | null
      streak: string | null
    } | null
    dividenden: { cagr5yPct: number | null; jahreOhneSenkung: number | null } | null
    insiderNetto: string | null
    insiderKaeufe90d: number | null
    insiderVerkaeufe90d: number | null
    debtRefi24mPct: number | null
    rdAktivierungsquotePct: number | null
    secStruktur: { segmentKonzentration: number | null; pensionMio: number | null } | null
  } | null
  news: Array<{ titel: string; quelle: string | null }>
  /** Incremental ROIC — eigene Zeile, damit der Coach sie nicht in 14 Key-Metrics übersieht. */
  roiic: { anzeige: string; pct: number | null } | null
}

function keyMetricsKompakt(
  p: FundamentaldatenPaket,
  fokus: boolean,
): BeraterFundamentalKompakt['keyMetrics'] {
  const max = fokus ? 24 : 16
  const seen = new Set<string>()
  const out: BeraterFundamentalKompakt['keyMetrics'] = []
  const push = (k: (typeof p.keyMetrics)[number] | undefined) => {
    if (!k || seen.has(k.id) || out.length >= max) return
    seen.add(k.id)
    out.push({ label: k.label, wert: k.wert, gruppe: k.gruppe })
  }
  for (const id of KEY_METRIC_PRIORITAET) push(p.keyMetrics.find((k) => k.id === id))
  for (const k of p.keyMetrics) push(k)
  return out
}

export function fundamentalPaketKompakt(p: FundamentaldatenPaket, fokus: boolean): BeraterFundamentalKompakt {
  const m = p.mantra
  const roiicKm = p.keyMetrics.find((k) => k.id === 'incremental_roic')
  return {
    ok: p.ok,
    ticker: p.ticker,
    firmenname: p.firmenname,
    sektor: p.sektor,
    branche: p.branche,
    quelle: p.quelle,
    fehler: p.fehler ?? null,
    beschreibung: kuerze(p.beschreibung, fokus ? 500 : 220),
    keyMetrics: keyMetricsKompakt(p, fokus),
    roiic:
      roiicKm != null
        ? { anzeige: roiicKm.wert, pct: roiicKm.zahl ?? null }
        : null,
    historie5j: historie5j(p, fokus),
    mantra: {
      ampel: m.ampel,
      ampelScorePct: m.ampelScorePct,
      ampelHinweis: m.ampelHinweis,
      zusammenfassung: m.zusammenfassung,
      standard: m.standard.map((z) => ({
        kategorie: z.kategorie,
        kennzahl: z.kennzahl,
        zielwert: z.zielwert,
        istWert: z.istWert,
        status: z.status,
      })),
      sektor: m.sektor.slice(0, fokus ? 16 : 8).map((z) => ({
        kategorie: z.kategorie,
        kennzahl: z.kennzahl,
        istWert: z.istWert,
        status: z.status,
      })),
      sellTriggerWatch: m.sellTriggerWatch.map((s) => ({
        titel: s.titel,
        status: s.status,
        begruendung: kuerze(s.begruendung, fokus ? 200 : 100),
      })),
    },
    zeilenHighlights: zeilenHighlights(p, fokus),
    erweitert: erweitertKompakt(p, fokus),
    news: fokus
      ? p.news.slice(0, 3).map((n) => ({ titel: n.titel, quelle: n.quelle }))
      : [],
  }
}

/** Fallback wenn Live-Fundamentaldaten scheitern — aus Scan-Kennzahlen. */
export function fundamentalAusScanFallback(
  e: NachkaufScanEintrag,
  fokus: boolean,
): BeraterFundamentalKompakt {
  const b = e.bewertung
  const d = e.datenSignale
  const keyMetrics: BeraterFundamentalKompakt['keyMetrics'] = [
    b?.forwardPe != null ? { label: 'Forward-KGV', wert: `${b.forwardPe.toFixed(1)}×`, gruppe: 'bewertung_ntm' } : null,
    b?.fcfYieldPct != null ? { label: 'FCF-Rendite', wert: `${b.fcfYieldPct.toFixed(1)} %`, gruppe: 'bewertung_ltm' } : null,
    b?.premiumDiscountPct != null
      ? { label: 'Premium/Discount', wert: `${b.premiumDiscountPct.toFixed(0)} %`, gruppe: 'bewertung_ntm' }
      : null,
    d?.epsBeatRate12Pct != null
      ? { label: 'EPS-Beat 12Q', wert: `${d.epsBeatRate12Pct} %`, gruppe: 'effizienz' }
      : null,
    d?.debtRefi24mPct != null
      ? { label: 'Refi ≤24M', wert: `${d.debtRefi24mPct.toFixed(0)} %`, gruppe: 'kapitalstruktur' }
      : null,
    d?.rdAktivierungsquotePct != null
      ? { label: 'F&E-Aktivierung', wert: `${d.rdAktivierungsquotePct.toFixed(0)} %`, gruppe: 'effizienz' }
      : null,
    d?.umsatzanteilTop1KundenPct != null
      ? { label: 'Top-Kunde', wert: `${d.umsatzanteilTop1KundenPct.toFixed(0)} %`, gruppe: 'kapitalstruktur' }
      : null,
  ].filter((x): x is NonNullable<typeof x> => x != null)

  return {
    ok: false,
    ticker: e.ticker,
    firmenname: e.name,
    sektor: null,
    branche: null,
    quelle: 'nachkauf_scan_fallback',
    fehler: 'Live-Fundamentalhistorie nicht geladen — Kennzahlen aus Nachkauf-Scan.',
    beschreibung: null,
    keyMetrics,
    historie5j: null,
    mantra: {
      ampel: e.mantraAmpel ?? 'grau',
      ampelScorePct: e.mantraScorePct,
      ampelHinweis: null,
      zusammenfassung: e.kiBegruendung ? kuerze(e.kiBegruendung, fokus ? 400 : 200) : null,
      standard: [],
      sektor: [],
      sellTriggerWatch: [],
    },
    zeilenHighlights: [],
    erweitert: {
      beatMiss: d
        ? {
            epsBeatRatePct: d.epsBeatRatePct,
            epsBeatRate12Pct: d.epsBeatRate12Pct,
            streak: null,
          }
        : null,
      dividenden: null,
      insiderNetto: d?.insiderNettoRichtung ?? null,
      insiderKaeufe90d: null,
      insiderVerkaeufe90d: null,
      debtRefi24mPct: d?.debtRefi24mPct ?? null,
      rdAktivierungsquotePct: d?.rdAktivierungsquotePct ?? null,
      secStruktur: null,
    },
    news: [],
    roiic:
      d?.incrementalRoicPct != null
        ? { anzeige: `${d.incrementalRoicPct.toFixed(1)} %`, pct: d.incrementalRoicPct }
        : null,
  }
}

export async function ladeFundamentaldatenFuerBerater(
  ziele: FundamentalBeraterZiel[],
  opts?: {
    scanByIsin?: Map<string, NachkaufScanEintrag>
    cacheModus?: 'immer' | 'nur-lesen' | 'erneuern'
  },
): Promise<
  Array<{
    isin: string
    fokus: boolean
    gewichtPct: number | null
    daten: BeraterFundamentalKompakt
  }>
> {
  if (ziele.length === 0) return []

  const sortiert = [...ziele]
    .sort((a, b) => {
      if (a.fokus !== b.fokus) return a.fokus ? -1 : 1
      return (b.gewichtPct ?? 0) - (a.gewichtPct ?? 0)
    })
    .slice(0, MAX_LADEN)

  const ladenEines = async (z: FundamentalBeraterZiel) => {
    const modus = opts?.cacheModus ?? (z.fokus ? 'immer' : 'nur-lesen')
    const timeoutMs = z.fokus && modus !== 'nur-lesen' ? LOAD_TIMEOUT_MS : TIMEOUT_CACHE_MS
    const anfrage = {
      isin: z.isin,
      name: z.name,
      symbolYahoo: z.symbolYahoo,
      symbolCandidates: z.symbolCandidates,
      frequenz: 'jahr' as const,
      segmentNurCloud: true,
    }

    const lade = (cacheModus: 'immer' | 'nur-lesen' | 'erneuern', ms: number) =>
      mitTimeout(ladeFundamentaldaten({ ...anfrage, cacheModus }), ms, z.isin)

    let paket: FundamentaldatenPaket | null = null
    try {
      paket = await lade(modus, timeoutMs)
    } catch (e) {
      console.warn('[portfolio-berater] Fundamentaldaten', z.isin, e)
    }

    // Cache-Miss: Live-Scrape nur für den Fokus-Titel. Weitere Depot-Titel
    // würden sonst 40s-Batches stapeln und Gemini in den 504 treiben.
    // Leeres Paket hat immer ein Mantra-Objekt — das ist kein Treffer.
    if ((!paket || !paketHatNutzbareDaten(paket)) && modus === 'nur-lesen' && z.fokus) {
      try {
        paket = await lade('immer', LOAD_TIMEOUT_MS)
      } catch (e) {
        console.warn('[portfolio-berater] Live-Fallback', z.isin, e)
      }
    }

    try {
      if (paket && paketHatNutzbareDaten(paket)) {
        return {
          isin: z.isin,
          fokus: z.fokus,
          gewichtPct: z.gewichtPct ?? null,
          daten: fundamentalPaketKompakt(paket, z.fokus),
        }
      }
    } catch (e) {
      console.warn('[portfolio-berater] Fundamentaldaten kompakt', z.isin, e)
    }

    const scan = opts?.scanByIsin?.get(z.isin.toUpperCase())
    if (scan) {
      return {
        isin: z.isin,
        fokus: z.fokus,
        gewichtPct: z.gewichtPct ?? null,
        daten: fundamentalAusScanFallback(scan, z.fokus),
      }
    }

    return {
      isin: z.isin,
      fokus: z.fokus,
      gewichtPct: z.gewichtPct ?? null,
      daten: {
        ok: false,
        ticker: z.ticker ?? z.symbolYahoo ?? z.isin,
        firmenname: z.name,
        sektor: null,
        branche: null,
        quelle: null,
        fehler: 'Fundamentaldaten nicht verfügbar',
        beschreibung: null,
        keyMetrics: [],
        historie5j: null,
        mantra: {
          ampel: 'grau',
          ampelScorePct: null,
          ampelHinweis: null,
          zusammenfassung: null,
          standard: [],
          sektor: [],
          sellTriggerWatch: [],
        },
        zeilenHighlights: [],
        erweitert: null,
        news: [],
        roiic: null,
      } satisfies BeraterFundamentalKompakt,
    }
  }

  const settled: PromiseSettledResult<Awaited<ReturnType<typeof ladenEines>>>[] = []
  for (let i = 0; i < sortiert.length; i += PARALLEL_FUNDAMENTAL) {
    const batch = sortiert.slice(i, i + PARALLEL_FUNDAMENTAL)
    const batchRes = await Promise.allSettled(batch.map(ladenEines))
    settled.push(...batchRes)
  }
  const ergebnisse = settled

  const out: Array<{
    isin: string
    fokus: boolean
    gewichtPct: number | null
    daten: BeraterFundamentalKompakt
  }> = []

  for (const r of ergebnisse) {
    if (r.status === 'fulfilled') out.push(r.value)
    else console.warn('[portfolio-berater] Fundamentaldaten laden:', r.reason)
  }

  return out
}

function sortiereSecIds(map: Map<string, SecBerichtKiCloudZeile>): string[] {
  return [...map.keys()].sort((a, b) => b.localeCompare(a))
}

function sortiereEarningsIds(map: Map<string, EarningsCallKiCloudZeile>): string[] {
  return [...map.keys()].sort((a, b) => b.localeCompare(a))
}

function textDiffFallback(aktuellId: string, vorherId: string): string {
  return [
    `## Vergleich ${vorherId} → ${aktuellId}`,
    '',
    '_Kein KI-Diff im Cache — Summaries liegen separat unter kiCache. Für den echten Quartals-Vergleich: Fundamentaldaten → Quartals-Diff öffnen (nicht Executive Summary als Diff verwenden)._',
  ].join('\n')
}

/**
 * Füllt quartalsDiff aus Cloud-Cache; fehlende Paare aus SEC/Earnings-KI-Cache
 * (Fokus: KI-Diff wenn möglich, sonst Text-Gegenüberstellung).
 */
export async function baueQuartalsDiffFuerBerater(opts: {
  bestehende: QuartalsKiDiffCloudZeile[]
  secKi: Map<string, Map<string, SecBerichtKiCloudZeile>>
  earningsKi: Map<string, Map<string, EarningsCallKiCloudZeile>>
  relevanteTicker: Set<string>
  focusTicker: string | null
  maxNeuGenerieren?: number
}): Promise<
  Array<{
    ticker: string
    typ: string
    aktuellId: string
    vorherId: string
    diff: string
  }>
> {
  const maxGen = opts.maxNeuGenerieren ?? 3
  const out = new Map<string, { ticker: string; typ: string; aktuellId: string; vorherId: string; diff: string }>()

  for (const d of opts.bestehende) {
    const t = d.ticker.toUpperCase()
    if (!opts.relevanteTicker.has(t)) continue
    const key = `${t}|${d.typ}|${d.aktuellId}|${d.vorherId}`
    out.set(key, {
      ticker: t,
      typ: d.typ,
      aktuellId: d.aktuellId,
      vorherId: d.vorherId,
      diff: d.diff,
    })
  }

  const tickerListe = [...opts.relevanteTicker].sort((a, b) => {
    if (opts.focusTicker && a === opts.focusTicker) return -1
    if (opts.focusTicker && b === opts.focusTicker) return 1
    return a.localeCompare(b)
  })

  let generiert = 0
  for (const ticker of tickerListe) {
    for (const typ of ['sec_bericht', 'earnings_call'] as const) {
      const map =
        typ === 'sec_bericht' ? opts.secKi.get(ticker) : opts.earningsKi.get(ticker)
      if (!map || map.size < 2) continue
      const ids = typ === 'sec_bericht' ? sortiereSecIds(map as Map<string, SecBerichtKiCloudZeile>) : sortiereEarningsIds(map as Map<string, EarningsCallKiCloudZeile>)
      const aktuellId = ids[0]!
      const vorherId = ids[1]!
      const key = `${ticker}|${typ}|${aktuellId}|${vorherId}`
      if (out.has(key)) continue

      if (maxGen > 0) {
        const cached = await ladeQuartalsKiDiffCache(ticker, typ, aktuellId, vorherId)
        if (cached) {
          out.set(key, { ticker, typ, aktuellId, vorherId, diff: cached })
          continue
        }
      } else {
        continue
      }

      const aktuellText = map.get(aktuellId)?.zusammenfassung?.trim() ?? ''
      const vorherText = map.get(vorherId)?.zusammenfassung?.trim() ?? ''
      if (!aktuellText || !vorherText) continue

      const istFokus = opts.focusTicker != null && ticker === opts.focusTicker
      if (istFokus && generiert < maxGen) {
        try {
          const paket = await mitTimeout(
            ladeQuartalsKiDiff({
              ticker,
              typ,
              aktuellId,
              vorherId,
              firmenname: ticker,
              force: false,
            }),
            22_000,
            `diff-${ticker}`,
          )
          if (paket.ok && paket.diff) {
            out.set(key, { ticker, typ, aktuellId, vorherId, diff: paket.diff })
            generiert++
            continue
          }
        } catch {
          /* Fallback unten */
        }
      }

      out.set(key, {
        ticker,
        typ,
        aktuellId,
        vorherId,
        diff: textDiffFallback(aktuellId, vorherId),
      })
    }
  }

  return [...out.values()].sort((a, b) => {
    if (opts.focusTicker) {
      if (a.ticker === opts.focusTicker && b.ticker !== opts.focusTicker) return -1
      if (b.ticker === opts.focusTicker && a.ticker !== opts.focusTicker) return 1
    }
    return a.ticker.localeCompare(b.ticker)
  })
}
