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
import { resolveCoachProviderFromMode, runCoachCompletion } from '@/lib/ki-coach-backend'
import { NACHKAUF_DEEP_RESEARCH_SYSTEM_PROMPT } from './nachkauf-deep-research-prompt'
import { ergaenzeDepotGewichte, speichereDeepResearch } from './nachkauf-radar-db-server'
import type { NachkaufDeepResearch, NachkaufDeepResearchAnfrage, NachkaufScanEintrag } from './nachkauf-radar-types'

// ---------------------------------------------------------------------------
// Modell-Kandidaten (Gemini Pro)
// ---------------------------------------------------------------------------

function deepResearchModell(): string[] {
  const primary =
    process.env.NACHKAUF_DEEP_RESEARCH_GEMINI_MODEL?.trim() ||
    'gemini-3.1-pro'
  const fallbacks = [
    'gemini-3.5-pro',
    'gemini-2.5-pro',
    'gemini-3.1-pro-preview',
    'gemini-2.5-pro-preview-06-05',
  ]
  const seen = new Set<string>()
  return [primary, ...fallbacks].filter((m) => {
    if (seen.has(m)) return false
    seen.add(m)
    return true
  })
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
  earningsSummaries: { quartalId: string; text: string }[]
  secSummaries: { berichtId: string; text: string }[]
  // Nachkauf-Score-Kontext
  nachkaufScore?: number
  nachkaufAmpel?: string
  kaufTriggerAusgeloest?: boolean
  kaufTriggerText?: string | null
  premiumDiscountPct?: number | null
  historischerMedianPe?: number | null
  scoreVerlauf?: Array<{ datum: string; score: number }>
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
    '--- DEPOT-KONTEXT (WICHTIG für Nachkauf-Entscheidung) ---',
    `Aktueller Depot-Anteil (Marktwert): ${gewichtHinweis}`,
    opts.klumpenrisiko
      ? `HINWEIS: Position bereits übergewichtet. Nachkauf nur wenn aussergewöhnlich attraktives Chance/Risiko-Verhältnis — andernfalls auf günstigere Alternativen verweisen.`
      : '',
    '',
  ].filter(Boolean)

  // Nachkauf-Radar Score-Kontext (neu)
  if (opts.nachkaufScore !== undefined) {
    teile.push('--- NACHKAUF-RADAR SCORE (regelbasiert, kein LLM) ---')
    teile.push(`Gesamt-Score: ${opts.nachkaufScore}/100 (Ampel: ${opts.nachkaufAmpel ?? 'n/a'})`)
    if (opts.kaufTriggerAusgeloest) {
      teile.push(`KAUFZONE AKTIV: ${opts.kaufTriggerText ?? 'Kaufzone wurde ausgelöst'}`)
    }
    if (opts.premiumDiscountPct != null) {
      const pd = opts.premiumDiscountPct
      const label = pd > 0 ? `${pd.toFixed(1)} % Premium` : `${Math.abs(pd).toFixed(1)} % Discount`
      teile.push(`Historischer Bewertungsvergleich: ${label} vs. 5J-Median (${opts.historischerMedianPe != null ? `Median KGV: ${opts.historischerMedianPe}×` : 'kein Median'})`)
    }
    if (opts.scoreVerlauf && opts.scoreVerlauf.length >= 2) {
      const trend = opts.scoreVerlauf.slice(-3).map((v) => `${v.datum.slice(0, 7)}: ${v.score}`).join(' → ')
      teile.push(`Score-Trend (letzte Monate): ${trend}`)
    }
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

  // Earnings-Summaries (neueste 2)
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

  teile.push('Erstelle jetzt die ausführliche Nachkauf-Memo gemäß dem System-Prompt.')

  return teile.join('\n')
}

// ---------------------------------------------------------------------------
// Haupt-Export
// ---------------------------------------------------------------------------

export async function fuhreDeepResearchDurch(
  anfrage: NachkaufDeepResearchAnfrage & {
    scanEintrag?: {
      score: number
      ampel: string
      kaufTriggerAusgeloest: boolean
      kaufTriggerText: string | null
      premiumDiscountPct: number | null
      scoreVerlauf: Array<{ datum: string; score: number }>
    }
    historischerMedianPe?: number | null
  },
): Promise<{ ok: true; dr: NachkaufDeepResearch } | { ok: false; fehler: string }> {
  const { ticker, isin, name } = anfrage

  const kenntnis = isin ? isinKenntnis(isin) : null
  const resolvedIsin = isin ?? ''

  // Fundamentaldaten laden
  let paket
  try {
    paket = await ladeFundamentaldaten({
      isin: resolvedIsin || null,
      name: name ?? undefined,
      symbolYahoo: kenntnis?.symbolYahoo ?? ticker ?? null,
      symbolCandidates: kenntnis?.symbolCandidates ?? [ticker],
    })
  } catch (e) {
    return { ok: false, fehler: `Fundamentaldaten für ${ticker} nicht ladbar: ${String(e)}` }
  }

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

  // Depot-Gewicht ermitteln
  const platzhalter: NachkaufScanEintrag[] = [{
    ticker, isin: resolvedIsin, name: name ?? ticker,
    ampel: 'grau', score: 0,
    scoreDetail: { mantraScore: 0, bewertungsScore: 0, sellTriggerPenalty: 0, historischerBewertungsBonus: 0, gesamt: 0 },
    bewertung: { fcfYieldPct: null, forwardPe: null, drawdown52wPct: null, premiumDiscountPct: null },
    mantraAmpel: null, mantraScorePct: null, sellTriggerOk: true,
    kiBegruendung: null, gescannt_am: new Date().toISOString(), tiefenAnalyse: null,
    depotGewichtPct: null, klumpenrisiko: false,
    kaufTriggerAusgeloest: false, kaufTriggerText: null,
    scoreVerlauf: [], insiderKaeufe: [],
  }]
  await ergaenzeDepotGewichte(platzhalter)
  const depotGewichtPct = platzhalter[0]!.depotGewichtPct
  const klumpenrisiko = platzhalter[0]!.klumpenrisiko

  const kontextText = baueKontextText({
    name: paket.firmenname || name || ticker,
    ticker,
    isin: resolvedIsin,
    mantraAmpel: mantra.ampel,
    mantraScorePct: mantra.ampelScorePct,
    sellTrigger: watchWarnungen || 'Keine aktiven Sell-Trigger',
    fcfYield: fmtOrDash('ntm_mc_fcf') !== '–' ? `NTM MC/FCF ${fmtOrDash('ntm_mc_fcf')}` : fmtOrDash('ltm_pfcf') !== '–' ? `LTM MC/FCF ${fmtOrDash('ltm_pfcf')}` : 'keine Daten',
    forwardPe: fmtOrDash('ntm_pe'),
    roic: fmtOrDash('roic') !== '–' ? fmtOrDash('roic') : '–',
    netDebtEbitda: fmtOrDash('net_debt_ebitda') !== '–' ? fmtOrDash('net_debt_ebitda') : '–',
    revWachstum: fmtOrDash('rev_cagr_3y'),
    depotGewichtPct,
    klumpenrisiko,
    earningsSummaries: earningsList,
    secSummaries: secList,
    // Nachkauf-Radar Score-Kontext
    nachkaufScore: anfrage.scanEintrag?.score,
    nachkaufAmpel: anfrage.scanEintrag?.ampel,
    kaufTriggerAusgeloest: anfrage.scanEintrag?.kaufTriggerAusgeloest,
    kaufTriggerText: anfrage.scanEintrag?.kaufTriggerText,
    premiumDiscountPct: anfrage.scanEintrag?.premiumDiscountPct,
    historischerMedianPe: anfrage.historischerMedianPe,
    scoreVerlauf: anfrage.scanEintrag?.scoreVerlauf,
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
      geminiModels: deepResearchModell(),
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
