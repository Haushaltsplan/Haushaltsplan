/**
 * Nachkauf-Radar — Deep Research Server (Stufe B).
 *
 * Erstellt eine ausführliche Nachkauf-Memo für einen Titel mit Gemini Pro.
 * Nutzt gecachte KI-Summaries (Earnings + SEC) als Input — kein Roh-10-K.
 */

import 'server-only'

import { ladeFundamentaldaten } from '@/lib/portfolio-analyse/fundamentaldaten-server'
import { isinKenntnis } from '@/lib/portfolio-analyse/isin-kenntnisse'
import { ladeSecBerichtKiCacheFuerTicker } from '@/lib/portfolio-analyse/sec-berichte-ki-cache-server'
import { ladeEarningsCallKiCacheFuerTicker } from '@/lib/portfolio-analyse/earnings-call-unternehmen-cache-server'
import {
  geminiProPaidModelKandidaten,
  resolveCoachProviderFromMode,
  runCoachCompletion,
} from '@/lib/ki-coach-backend'
import { NACHKAUF_DEEP_RESEARCH_SYSTEM_PROMPT } from './nachkauf-deep-research-prompt'
import { formatSegmentStrukturKontext } from './nachkauf-segment-struktur-hilfen'
import {
  formatZusatzSignaleKurz,
  ladeNachkaufZusatzSignale,
} from './nachkauf-zusatz-signale-server'
import { reichereNachkaufTickerKontext } from './nachkauf-kontext-server'
import { wendeNachkaufDisziplinAn } from './nachkauf-disziplin-server'
import { speichereDeepResearch } from './nachkauf-radar-db-server'
import { ladeNachkaufWatchlistAusCloud } from './nachkauf-watchlist-cloud-server'
import { formatDepotDashboardKontext } from '@/lib/portfolio-analyse/depot-gewichte-server'
import type { NachkaufDeepResearch, NachkaufDeepResearchAnfrage, NachkaufScanEintrag } from './nachkauf-radar-types'
import type { FundamentaldatenPaket } from '@/lib/portfolio-analyse/fundamentaldaten-types'

/** ROIC für Deep-Research-Kontext — Key Metric heißt ltm_roic, Macrotrends-Zeile roi. */
function formatRoicKontext(paket: FundamentaldatenPaket): string {
  const ltm = paket.keyMetrics.find((m) => m.id === 'ltm_roic')?.wert
  if (ltm && ltm !== '–' && ltm !== 'n/a') return ltm

  const roiZeile = paket.zeilen.find((z) => z.id === 'roi')
  if (!roiZeile) return '–'

  const hist: number[] = []
  for (const p of paket.perioden) {
    if (p.istSchaetzung || p.istNtm || p.istLtm) continue
    if (!/^\d{4}-\d{2}-\d{2}$/.test(p.iso)) continue
    const v = roiZeile.werte[p.iso]
    if (v != null && Number.isFinite(v)) hist.push(v)
  }
  if (hist.length === 0) return '–'

  const latest = hist[hist.length - 1]!
  const trend =
    hist.length >= 3
      ? ` — Verlauf: ${hist
          .slice(-5)
          .map((v) => `${v.toFixed(1)} %`)
          .join(' → ')}`
      : ''
  return `${latest.toFixed(1)} % (Macrotrends)${trend}`
}

function formatKeyMetricsBlock(paket: FundamentaldatenPaket): string {
  return paket.keyMetrics.map((m) => `- ${m.label}: ${m.wert}`).join('\n')
}

function formatKaufhistorieZeile(e: NachkaufScanEintrag | null | undefined): string | null {
  const kh = e?.kaufhistorie
  if (!kh || kh.anzahlKaeufe === 0) return 'Noch nie gekauft (laut Buchungen)'
  const teile = [`${kh.anzahlKaeufe}× gekauft`]
  if (kh.tageSeitletztemKauf != null) teile.push(`letzter Kauf vor ${kh.tageSeitletztemKauf} Tagen`)
  if (kh.durchschnittskaufpreisEur != null) teile.push(`Ø ${kh.durchschnittskaufpreisEur.toFixed(2)} €`)
  return teile.join(', ')
}

function formatInsiderZeile(e: NachkaufScanEintrag | null | undefined): string | null {
  const kaeufe = e?.insiderKaeufe ?? []
  if (kaeufe.length === 0) return null
  return `${kaeufe.length} Insider-Käufe in den letzten 90 Tagen`
}

// ---------------------------------------------------------------------------
// Kontext-Text für Deep Research bauen
// ---------------------------------------------------------------------------

function baueKontextText(opts: {
  name: string
  ticker: string
  isin: string
  mantraAmpel: string
  mantraScorePct: number | null
  sellTrigger: string
  fcfYield: string
  forwardPe: string
  roic: string
  netDebtEbitda: string
  revWachstum: string
  depotGewichtPct: number | null
  klumpenrisiko: boolean
  depotDashboardKontext: string
  kaufhistorie: string | null
  notiz: string | null
  scanKiBegruendung: string | null
  insiderHinweis: string | null
  disziplinHinweis: string | null
  keyMetricsBlock: string
  zusatzSignaleText: string | null
  earningsSummaries: { quartalId: string; text: string }[]
  secSummaries: { berichtId: string; text: string }[]
  scanEintrag?: NachkaufScanEintrag | null
  historischerMedianPe?: number | null
  segmentStrukturKontext?: string | null
}): string {
  const gewichtHinweis =
    opts.depotGewichtPct != null
      ? opts.klumpenrisiko
        ? `${opts.depotGewichtPct.toFixed(1)} % des Depots (KLUMPENRISIKO — bereits übergewichtet)`
        : `${opts.depotGewichtPct.toFixed(1)} % des Depots`
      : 'Keine Depot-Buchungen vorhanden (Position ggf. noch nicht im Depot)'

  const teile: string[] = [
    `=== DEPOT-POSITION: ${opts.name} (${opts.ticker}) — ISIN: ${opts.isin} ===`,
    '',
    '--- DEPOT-KONTEXT (Dashboard — Buchungen + Live-Kurse) ---',
    opts.depotDashboardKontext,
    '',
    `Aktueller Depot-Anteil dieser Position: ${gewichtHinweis}`,
    opts.kaufhistorie ? `Kaufhistorie: ${opts.kaufhistorie}` : '',
    opts.notiz ? `Eigene Notiz: ${opts.notiz}` : '',
    opts.klumpenrisiko
      ? `HINWEIS: Position bereits übergewichtet. Nachkauf nur bei aussergewöhnlichem Chance/Risiko — sonst Alternativen prüfen.`
      : '',
    '',
  ].filter(Boolean)

  const scan = opts.scanEintrag
  if (scan) {
    teile.push('--- NACHKAUF-RADAR SCAN (regelbasiert) ---')
    teile.push(`Gesamt-Score: ${scan.score}/100 (Ampel: ${scan.ampel})`)
    if (scan.kaufTriggerAusgeloest) {
      teile.push(`KAUFZONE AKTIV: ${scan.kaufTriggerText ?? 'Kaufzone ausgelöst'}`)
    }
    const pd = scan.bewertung.premiumDiscountPct
    if (pd != null) {
      const label = pd > 0 ? `${pd.toFixed(1)} % Premium` : `${Math.abs(pd).toFixed(1)} % Discount`
      teile.push(
        `Historischer Bewertungsvergleich: ${label} vs. 5J-Median (${opts.historischerMedianPe != null ? `Median KGV: ${opts.historischerMedianPe}×` : 'kein Median'})`,
      )
    }
    teile.push(
      `Bewertung: FCF-Yield ${scan.bewertung.fcfYieldPct?.toFixed(1) ?? '?'} % | Fwd-KGV ${scan.bewertung.forwardPe?.toFixed(1) ?? '?'} | Drawdown 52W ${scan.bewertung.drawdown52wPct?.toFixed(0) ?? '?'} %`,
    )
    if (scan.scoreVerlauf.length >= 2) {
      const trend = scan.scoreVerlauf
        .slice(-3)
        .map((v) => `${v.datum.slice(0, 7)}: ${v.score}`)
        .join(' → ')
      teile.push(`Score-Trend: ${trend}`)
    }
    if (scan.kiBegruendung) {
      teile.push(`Scan-KI-Memo (Flash): ${scan.kiBegruendung.slice(0, 1200)}`)
    }
    if (opts.disziplinHinweis) teile.push(`Disziplin-Hinweis: ${opts.disziplinHinweis}`)
    if (opts.insiderHinweis) teile.push(opts.insiderHinweis)
    teile.push('')
  }

  const scoreTeile = [
    '--- MANTRA-QUALITÄTS-DASHBOARD ---',
    `Mantra-Ampel: ${opts.mantraAmpel}`,
    opts.mantraScorePct != null ? `Mantra-Score: ${opts.mantraScorePct} %` : '',
    `ROIC: ${opts.roic}`,
    `Net Debt/EBITDA: ${opts.netDebtEbitda}`,
    `Umsatzwachstum: ${opts.revWachstum}`,
    `FCF-Rendite (NTM/LTM): ${opts.fcfYield}`,
    `Forward-KGV (NTM): ${opts.forwardPe}`,
    `Sell-Trigger-Status: ${opts.sellTrigger}`,
    '',
  ].filter(Boolean)
  teile.push(...scoreTeile)

  teile.push('--- FUNDAMENTALDATEN (Key Metrics, Macrotrends/Yahoo) ---')
  teile.push(opts.keyMetricsBlock)
  teile.push('')

  if (opts.zusatzSignaleText) {
    teile.push('--- ZUSATZ-SIGNALE (Beat/Miss, Capital Allocation, Struktur) ---')
    teile.push(opts.zusatzSignaleText)
    teile.push('')
  }
  const earnings = opts.earningsSummaries.slice(0, 2)
  if (earnings.length > 0) {
    teile.push('--- EARNINGS CALL ZUSAMMENFASSUNGEN (gecacht) ---')
    for (const e of earnings) {
      teile.push(`### ${e.quartalId}`)
      teile.push(e.text.slice(0, 4000))
      teile.push('')
    }
  } else {
    teile.push('--- Kein Earnings-Call-Cache vorhanden ---')
    teile.push('')
  }

  // SEC/IR-Summaries (neueste 2)
  const sec = opts.secSummaries.slice(0, 2)
  if (sec.length > 0) {
    teile.push('--- SEC / IR-BERICHTE ZUSAMMENFASSUNGEN (gecacht) ---')
    for (const s of sec) {
      teile.push(`### ${s.berichtId}`)
      teile.push(s.text.slice(0, 4000))
      teile.push('')
    }
  } else {
    teile.push('--- Kein SEC/IR-Bericht-Cache vorhanden ---')
    teile.push('')
  }

  if (opts.segmentStrukturKontext) {
    teile.push('--- GESCHÄFTSSTRUKTUR (Struktur & Daten, gescrapt) ---')
    teile.push(opts.segmentStrukturKontext)
    teile.push('')
  }

  teile.push('Erstelle jetzt die ausführliche Nachkauf-Memo gemäß dem System-Prompt.')

  return teile.join('\n')
}

// ---------------------------------------------------------------------------
// Haupt-Export
// ---------------------------------------------------------------------------

export async function fuhreDeepResearchDurch(
  anfrage: NachkaufDeepResearchAnfrage & {
    scanEintrag?: NachkaufScanEintrag | null
    historischerMedianPe?: number | null
  },
): Promise<{ ok: true; dr: NachkaufDeepResearch } | { ok: false; fehler: string }> {
  const { ticker, isin, name } = anfrage

  const kenntnis = isin ? isinKenntnis(isin) : null
  const resolvedIsin = isin ?? ''

  // Watchlist-Titel stehen nicht in ISIN_KENNTNISSE → Symbol aus dem Cloud-Sync holen
  let watchlistEintrag: Awaited<ReturnType<typeof ladeNachkaufWatchlistAusCloud>>[number] | null = null
  if (!kenntnis && resolvedIsin) {
    watchlistEintrag =
      (await ladeNachkaufWatchlistAusCloud().catch(() => []))
        .find((e) => e.isin.toUpperCase() === resolvedIsin.toUpperCase()) ?? null
  }

  const symbolYahoo = kenntnis?.symbolYahoo ?? watchlistEintrag?.symbolYahoo ?? ticker

  // Fundamentaldaten (gleiche Basis wie Scan — Segment aus Cloud-Cache)
  let paket
  try {
    paket = await ladeFundamentaldaten({
      isin: resolvedIsin || null,
      name: name ?? undefined,
      symbolYahoo: symbolYahoo ?? null,
      symbolCandidates:
        kenntnis?.symbolCandidates ??
        (watchlistEintrag?.symbolCandidates?.length ? watchlistEintrag.symbolCandidates : [ticker]),
      segmentNurCloud: true,
    })
  } catch (e) {
    return { ok: false, fehler: `Fundamentaldaten für ${ticker} nicht ladbar: ${String(e)}` }
  }
  const zusatz = await ladeNachkaufZusatzSignale({
    paket,
    ticker,
    symbolYahoo,
    isin: resolvedIsin,
  }).catch(() => null)

  // Scan-Eintrag + Depot/Historie/Notizen/Insider anreichern
  let scanEintrag = anfrage.scanEintrag ?? null
  const kontextEintraege: NachkaufScanEintrag[] = scanEintrag
    ? [scanEintrag]
    : [{
        ticker, isin: resolvedIsin, name: name ?? ticker,
        ampel: 'grau', score: 0,
        scoreDetail: {
          mantraScore: 0, bewertungsScore: 0, sellTriggerPenalty: 0, historischerBewertungsBonus: 0,
          datenSignaleDelta: 0, momentumPunkte: 0, strukturPunkte: 0, drawdownBonus: 0, insiderPunkte: 0,
          kauftriggerBonus: 0, regimeDelta: 0, earningsMalus: 0, deepResearchMalus: 0, klumpenMalus: 0,
          sektorMalus: 0, scoreKalibrierung: 0, qualitaetsRang: 0, timingRang: 0, kombiniertRang: 0,
          datenVollstaendigkeitPct: 0, gesamt: 0,
        },
        bewertung: { fcfYieldPct: null, forwardPe: null, drawdown52wPct: null, premiumDiscountPct: null },
        mantraAmpel: null, mantraScorePct: null, sellTriggerOk: true,
        kiBegruendung: null, gescannt_am: new Date().toISOString(), tiefenAnalyse: null,
        depotGewichtPct: null, klumpenrisiko: false,
        kaufTriggerAusgeloest: false, kaufTriggerText: null,
        scoreVerlauf: [], insiderKaeufe: [],
      }]
  await reichereNachkaufTickerKontext(kontextEintraege)
  wendeNachkaufDisziplinAn(kontextEintraege)
  scanEintrag = kontextEintraege[0]!

  const [depotDashboardKontext] = await Promise.all([
    formatDepotDashboardKontext(resolvedIsin),
  ])

  // KI-Summaries aus Caches
  const earningsMap = await ladeEarningsCallKiCacheFuerTicker(ticker)
  const secMap = await ladeSecBerichtKiCacheFuerTicker(ticker)

  const earningsList = [...earningsMap.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([quartalId, v]) => ({ quartalId, text: v.zusammenfassung }))

  const secList = [...secMap.entries()]
    .sort(([, a], [, b]) => b.aktualisiertAm.localeCompare(a.aktualisiertAm))
    .map(([berichtId, v]) => ({ berichtId, text: v.zusammenfassung }))

  // Key-Metriken extrahieren
  const km = paket.keyMetrics
  const fmtOrDash = (id: string) => km.find((m) => m.id === id)?.wert ?? '–'

  const mantra = paket.mantra
  const watchWarnungen = mantra.sellTriggerWatch
    .map((w) => `${w.status === 'warnung' ? 'WARNUNG' : w.status === 'beobachten' ? 'Beobachten' : 'OK'}: ${w.titel}`)
    .join('; ')

  const depotGewichtPct = scanEintrag.depotGewichtPct
  const klumpenrisiko = scanEintrag.klumpenrisiko

  const kontextText = baueKontextText({
    name: paket.firmenname || name || ticker,
    ticker,
    isin: resolvedIsin,
    mantraAmpel: mantra.ampel,
    mantraScorePct: mantra.ampelScorePct,
    sellTrigger: watchWarnungen || 'Keine aktiven Sell-Trigger',
    fcfYield: fmtOrDash('ntm_mc_fcf') !== '–' ? `NTM MC/FCF ${fmtOrDash('ntm_mc_fcf')}` : fmtOrDash('ltm_pfcf') !== '–' ? `LTM MC/FCF ${fmtOrDash('ltm_pfcf')}` : 'keine Daten',
    forwardPe: fmtOrDash('ntm_pe'),
    roic: formatRoicKontext(paket),
    netDebtEbitda: fmtOrDash('net_debt_ebitda') !== '–' ? fmtOrDash('net_debt_ebitda') : '–',
    revWachstum: fmtOrDash('rev_cagr_3y'),
    depotGewichtPct,
    klumpenrisiko,
    depotDashboardKontext,
    kaufhistorie: formatKaufhistorieZeile(scanEintrag),
    notiz: scanEintrag.notiz ?? null,
    scanKiBegruendung: scanEintrag.kiBegruendung ?? null,
    insiderHinweis: formatInsiderZeile(scanEintrag),
    disziplinHinweis: scanEintrag.disziplinHinweis ?? null,
    keyMetricsBlock: formatKeyMetricsBlock(paket),
    zusatzSignaleText: zusatz ? formatZusatzSignaleKurz(zusatz) : null,
    earningsSummaries: earningsList,
    secSummaries: secList,
    scanEintrag,
    historischerMedianPe: anfrage.historischerMedianPe,
    segmentStrukturKontext:
      zusatz?.segmentStrukturKontext ??
      formatSegmentStrukturKontext(paket.erweitert?.secSegmentHistorie, paket.erweitert?.secStruktur),
  })

  // LLM-Aufruf mit Gemini Pro
  const provider = resolveCoachProviderFromMode('gemini')
  if (!provider || provider.provider !== 'gemini') {
    return { ok: false, fehler: 'Kein Gemini-API-Key konfiguriert.' }
  }

  const result = await runCoachCompletion(
    provider.provider,
    provider.apiKey,
    NACHKAUF_DEEP_RESEARCH_SYSTEM_PROMPT,
    [{ role: 'user', content: kontextText }],
    {
      temperature: 0.3,
      skipMessageTrim: true,
      geminiForcePaidApiKey: true,
      geminiModels: geminiProPaidModelKandidaten(),
    },
  )

  if (!result.ok) {
    return { ok: false, fehler: `Gemini Pro fehlgeschlagen: ${result.hint ?? 'Unbekannter Fehler'}` }
  }

  const dr: NachkaufDeepResearch = {
    ticker: ticker.trim().toUpperCase(),
    isin: resolvedIsin,
    memo: result.reply.trim(),
    erstellt_am: new Date().toISOString(),
  }

  await speichereDeepResearch(dr)

  return { ok: true, dr }
}
