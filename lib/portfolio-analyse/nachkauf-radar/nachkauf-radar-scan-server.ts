/**
 * Nachkauf-Radar — Scan-Server (Stufe A).
 *
 * 1. Feste Whitelist (32 Quality-Positionen)
 * 2. Für jede Position: Fundamentaldaten + gecachte KI-Summaries
 * 3. Regelbasierter Score (kein LLM)
 * 4. Gemini Flash: kurze Begründung pro Titel
 * 5. Ergebnisse in Supabase speichern und zurückgeben
 */

import 'server-only'

import { ladeFundamentaldaten } from '@/lib/portfolio-analyse/fundamentaldaten-server'
import { isinKenntnis } from '@/lib/portfolio-analyse/isin-kenntnisse'
import { ladeSecBerichtKiCacheFuerTicker } from '@/lib/portfolio-analyse/sec-berichte-ki-cache-server'
import { ladeEarningsCallKiCacheFuerTicker } from '@/lib/portfolio-analyse/earnings-call-unternehmen-cache-server'
import { resolveCoachProviderFromMode, runCoachCompletion } from '@/lib/ki-coach-backend'
import { NACHKAUF_SCAN_SYSTEM_PROMPT } from './nachkauf-scan-prompt'
import {
  berechneMonatsEmpfehlung,
  berechneNachkaufScore,
  extrahiereBewertungsSignale,
  leiteNachkaufAmpelAb,
} from './nachkauf-radar-score'
import {
  ladeAlleDeepResearch,
  ladeNachkaufScanAusCloud,
  ladeNachkaufScanDatum,
  speichereNachkaufScanEintraege,
} from './nachkauf-radar-db-server'
import { NACHKAUF_RADAR_WHITELIST } from './nachkauf-radar-whitelist'
import type { NachkaufScanAnfrage, NachkaufScanEintrag, NachkaufScanPaket } from './nachkauf-radar-types'

// ---------------------------------------------------------------------------
// Modell-Kandidaten
// ---------------------------------------------------------------------------

function nachkaufScanModell(): string[] {
  const primary =
    process.env.NACHKAUF_SCAN_GEMINI_MODEL?.trim() ||
    process.env.FINANCE_COACH_GEMINI_MODEL?.trim() ||
    'gemini-3.5-flash'
  const fallbacks = ['gemini-flash-latest', 'gemini-2.5-flash', 'gemini-3.1-flash-lite']
  const seen = new Set<string>()
  return [primary, ...fallbacks].filter((m) => {
    if (seen.has(m)) return false
    seen.add(m)
    return true
  })
}

// (Depot-DB-Abfrage entfernt — Whitelist wird direkt aus nachkauf-radar-whitelist.ts geladen)

// ---------------------------------------------------------------------------
// KI-Begründung via Flash
// ---------------------------------------------------------------------------

async function generiereKiBegruendung(opts: {
  name: string
  ticker: string
  ampel: string
  score: number
  mantraAmpelText: string
  sellTriggerText: string
  fcfYield: string
  forwardPe: string
  earningsSummary: string
  secSummary: string
}): Promise<string | null> {
  const provider = resolveCoachProviderFromMode('gemini')
  if (!provider || provider.provider !== 'gemini') return null

  const userText = [
    `Unternehmen: ${opts.name} (${opts.ticker})`,
    `Radar-Ampel: ${opts.ampel} | Score: ${opts.score}/100`,
    `Mantra-Qualität: ${opts.mantraAmpelText}`,
    `Sell-Trigger-Status: ${opts.sellTriggerText}`,
    `FCF-Rendite (NTM/LTM): ${opts.fcfYield}`,
    `Forward-KGV (NTM): ${opts.forwardPe}`,
    '',
    opts.earningsSummary
      ? `--- EARNINGS CALL (Auszug, max. 1500 Zeichen) ---\n${opts.earningsSummary.slice(0, 1500)}`
      : '--- Kein Earnings-Call-Auszug im Cache ---',
    '',
    opts.secSummary
      ? `--- SEC/IR-BERICHT (Auszug, max. 1500 Zeichen) ---\n${opts.secSummary.slice(0, 1500)}`
      : '--- Kein Berichts-Auszug im Cache ---',
    '',
    'Schreibe jetzt die 2–3-Satz-Begründung gemäß dem System-Prompt.',
  ]
    .filter(Boolean)
    .join('\n')

  const result = await runCoachCompletion(
    provider.provider,
    provider.apiKey,
    NACHKAUF_SCAN_SYSTEM_PROMPT,
    [{ role: 'user', content: userText }],
    { temperature: 0.25, skipMessageTrim: true, geminiModels: nachkaufScanModell() },
  )

  return result.ok ? result.reply.trim() : null
}

// ---------------------------------------------------------------------------
// Einen Titel scannen
// ---------------------------------------------------------------------------

async function scanneEinenTitel(opts: {
  isin: string
  name: string
  deepResearchMap: Map<string, import('./nachkauf-radar-types').NachkaufDeepResearch>
}): Promise<NachkaufScanEintrag | null> {
  const { isin, name } = opts
  const kenntnis = isinKenntnis(isin)
  const ticker = kenntnis?.symbolYahoo?.replace(/\.[^.]+$/, '') ?? isin

  // Fundamentaldaten laden (Macrotrends + Yahoo)
  let paket
  try {
    paket = await ladeFundamentaldaten({
      isin,
      name,
      symbolYahoo: kenntnis?.symbolYahoo ?? null,
      symbolCandidates: kenntnis?.symbolCandidates ?? undefined,
    })
  } catch (e) {
    console.warn(`[nachkauf-radar] Fundamentaldaten für ${ticker} fehlgeschlagen:`, e)
    return null
  }

  if (!paket.ok && paket.zeilen.length === 0) {
    console.warn(`[nachkauf-radar] Keine Fundamentaldaten für ${ticker}`)
    return null
  }

  // Score regelbasiert berechnen
  const bewertungsSignale = extrahiereBewertungsSignale(paket)
  const scoreDetail = berechneNachkaufScore(paket, bewertungsSignale)
  const ampel = leiteNachkaufAmpelAb(paket, scoreDetail, bewertungsSignale)

  // KI-Summaries aus Caches lesen (nicht neu generieren)
  const earningsMap = await ladeEarningsCallKiCacheFuerTicker(ticker)
  const secMap = await ladeSecBerichtKiCacheFuerTicker(ticker)

  const neuesteEarnings = [...earningsMap.values()]
    .sort((a, b) => b.transcriptUrl.localeCompare(a.transcriptUrl))
    .at(0)?.zusammenfassung ?? ''

  const neuesteSec = [...secMap.values()]
    .sort((a, b) => b.aktualisiertAm.localeCompare(a.aktualisiertAm))
    .at(0)?.zusammenfassung ?? ''

  // Sell-Trigger-Text für LLM
  const mantra = paket.mantra
  const watchWarnungen = mantra.sellTriggerWatch
    .filter((w) => w.status === 'warnung' || w.status === 'beobachten')
    .map((w) => `${w.status === 'warnung' ? 'WARNUNG' : 'Beobachten'}: ${w.titel}`)

  const sellTriggerText =
    watchWarnungen.length > 0 ? watchWarnungen.join('; ') : 'Keine aktiven Sell-Trigger'

  const ampelText: Record<string, string> = {
    gruen: 'Alle/Mehrzahl Metriken erfüllt',
    gelb: 'Teilweise erfüllt / im Beobachtungsmodus',
    rot: 'Mehrere Metriken nicht erfüllt',
    grau: 'Zu wenig Daten',
  }

  const fcfYieldText =
    bewertungsSignale.fcfYieldPct != null
      ? `${bewertungsSignale.fcfYieldPct.toFixed(1)} %`
      : 'keine Daten'
  const forwardPeText =
    bewertungsSignale.forwardPe != null
      ? `${bewertungsSignale.forwardPe.toFixed(1)}×`
      : 'keine Daten'

  // KI-Begründung generieren
  const kiBegruendung = await generiereKiBegruendung({
    name: paket.firmenname || name,
    ticker,
    ampel: ampel === 'gruen' ? 'Grün' : ampel === 'gelb' ? 'Gelb' : ampel === 'rot' ? 'Rot' : ampel === 'teuer' ? 'Teuer (Quality ok, Preis zu hoch)' : 'Grau',
    score: scoreDetail.gesamt,
    mantraAmpelText: ampelText[mantra.ampel] ?? mantra.ampel,
    sellTriggerText,
    fcfYield: fcfYieldText,
    forwardPe: forwardPeText,
    earningsSummary: neuesteEarnings,
    secSummary: neuesteSec,
  })

  const hatWarnung = mantra.sellTriggerWatch.some((w) => w.status === 'warnung')

  return {
    ticker,
    isin,
    name: paket.firmenname || name,
    ampel,
    score: scoreDetail.gesamt,
    scoreDetail,
    bewertung: bewertungsSignale,
    mantraAmpel: mantra.ampel,
    mantraScorePct: mantra.ampelScorePct,
    sellTriggerOk: !hatWarnung,
    kiBegruendung,
    gescannt_am: new Date().toISOString(),
    tiefenAnalyse: opts.deepResearchMap.get(ticker.toUpperCase()) ?? null,
  }
}

// ---------------------------------------------------------------------------
// Haupt-Export: laufeScan
// ---------------------------------------------------------------------------

export async function laufeScan(anfrage: NachkaufScanAnfrage): Promise<NachkaufScanPaket> {
  // Cache prüfen (sofern nicht erzwungen und kein Einzel-Ticker)
  if (!anfrage.erzwingen && !anfrage.ticker) {
    const letzterScan = await ladeNachkaufScanDatum()
    if (letzterScan) {
      const alterMs = Date.now() - new Date(letzterScan).getTime()
      const CACHE_TTL_MS = 6 * 60 * 60 * 1000 // 6 Stunden
      if (alterMs < CACHE_TTL_MS) {
        const ergebnisse = await ladeNachkaufScanAusCloud()
        const deepMap = await ladeAlleDeepResearch()
        const mitDeep = ergebnisse.map((e) => ({
          ...e,
          tiefenAnalyse: deepMap.get(e.ticker.toUpperCase()) ?? null,
        }))
        return {
          ok: true,
          ergebnisse: mitDeep,
          monatsEmpfehlung: berechneMonatsEmpfehlung(mitDeep),
          gescannt_am: letzterScan,
        }
      }
    }
  }

  // Whitelist als Quelle — alle 32 Quality-Positionen
  const zuScannen = anfrage.ticker
    ? NACHKAUF_RADAR_WHITELIST.filter((p) => {
        const k = isinKenntnis(p.isin)
        const ticker = k?.symbolYahoo?.replace(/\.[^.]+$/, '') ?? ''
        return ticker.toUpperCase() === anfrage.ticker!.toUpperCase() || p.isin === anfrage.ticker
      })
    : NACHKAUF_RADAR_WHITELIST

  if (zuScannen.length === 0) {
    return {
      ok: false,
      ergebnisse: [],
      monatsEmpfehlung: { typ: 'sparen', text: 'Keine Positionen in der Whitelist gefunden.' },
      gescannt_am: new Date().toISOString(),
      fehler: anfrage.ticker ? `Ticker/ISIN ${anfrage.ticker} nicht in der Whitelist.` : 'Whitelist leer.',
    }
  }

  // Deep-Research-Cache vorab laden
  const deepResearchMap = await ladeAlleDeepResearch()

  // Titel in Batches von 3 scannen (Rate-Limit-freundlich)
  const BATCH_SIZE = 3
  const ergebnisse: NachkaufScanEintrag[] = []

  for (let i = 0; i < zuScannen.length; i += BATCH_SIZE) {
    const batch = zuScannen.slice(i, i + BATCH_SIZE)
    const batchErgebnisse = await Promise.allSettled(
      batch.map((p) =>
        scanneEinenTitel({
          isin: p.isin,
          name: p.name,
          deepResearchMap,
        }),
      ),
    )
    for (const r of batchErgebnisse) {
      if (r.status === 'fulfilled' && r.value) ergebnisse.push(r.value)
    }
    // Kurze Pause zwischen Batches (Macrotrends / Yahoo Rate-Limit)
    if (i + BATCH_SIZE < zuScannen.length) {
      await new Promise((res) => setTimeout(res, 1200))
    }
  }

  if (ergebnisse.length === 0) {
    return {
      ok: false,
      ergebnisse: [],
      monatsEmpfehlung: { typ: 'sparen', text: 'Scan fehlgeschlagen — keine Fundamentaldaten verfügbar.' },
      gescannt_am: new Date().toISOString(),
      fehler: 'Alle Fundamentaldaten-Abrufe fehlgeschlagen.',
    }
  }

  // Nach Score absteigend sortieren
  ergebnisse.sort((a, b) => b.score - a.score)

  // In Supabase persistieren
  await speichereNachkaufScanEintraege(ergebnisse)

  const gescannt_am = ergebnisse[0]?.gescannt_am ?? new Date().toISOString()

  return {
    ok: true,
    ergebnisse,
    monatsEmpfehlung: berechneMonatsEmpfehlung(ergebnisse),
    gescannt_am,
  }
}
