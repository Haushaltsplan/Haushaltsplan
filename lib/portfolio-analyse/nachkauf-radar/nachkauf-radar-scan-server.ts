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

/** Positionen, die innerhalb dieser Zeit bereits gescannt wurden, werden übersprungen. */
const SKIP_WENN_JUENGER_MS = 12 * 60 * 60 * 1000 // 12 Stunden
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
  const gesamtAnzahl = NACHKAUF_RADAR_WHITELIST.length

  // Einzelner Ticker → direkt scannen, kein Cache-Check
  if (anfrage.ticker) {
    const kandidaten = NACHKAUF_RADAR_WHITELIST.filter((p) => {
      const k = isinKenntnis(p.isin)
      const ticker = k?.symbolYahoo?.replace(/\.[^.]+$/, '') ?? ''
      return ticker.toUpperCase() === anfrage.ticker!.toUpperCase() || p.isin === anfrage.ticker
    })
    if (kandidaten.length === 0) {
      const gespeicherte = await ladeNachkaufScanAusCloud()
      return {
        ok: false,
        ergebnisse: gespeicherte,
        monatsEmpfehlung: berechneMonatsEmpfehlung(gespeicherte),
        gescannt_am: gespeicherte[0]?.gescannt_am ?? new Date().toISOString(),
        gesamtAnzahl,
        gescannt: 0,
        ausstehend: 0,
        fehler: `Ticker/ISIN ${anfrage.ticker} nicht in der Whitelist.`,
      }
    }
    const deepResearchMap = await ladeAlleDeepResearch()
    const ergebnis = await scanneEinenTitel({ isin: kandidaten[0]!.isin, name: kandidaten[0]!.name, deepResearchMap })
    if (ergebnis) await speichereNachkaufScanEintraege([ergebnis])
    const alle = await ladeNachkaufScanAusCloud()
    const deepMap = await ladeAlleDeepResearch()
    const mitDeep = alle.map((e) => ({ ...e, tiefenAnalyse: deepMap.get(e.ticker.toUpperCase()) ?? null }))
    mitDeep.sort((a, b) => b.score - a.score)
    return {
      ok: true,
      ergebnisse: mitDeep,
      monatsEmpfehlung: berechneMonatsEmpfehlung(mitDeep),
      gescannt_am: ergebnis?.gescannt_am ?? new Date().toISOString(),
      gesamtAnzahl,
      gescannt: ergebnis ? 1 : 0,
      ausstehend: 0,
    }
  }

  // Bereits gespeicherte Ergebnisse laden — zum Skip-Check und als Basis für die Rückgabe
  const bereitsGespeichert = await ladeNachkaufScanAusCloud()
  const bereitsMap = new Map(bereitsGespeichert.map((e) => [e.ticker.toUpperCase(), e]))

  // Wenn nicht erzwungen: Positionen, die in den letzten 12h gescannt wurden, überspringen
  const jetzt = Date.now()
  const zuScannen = anfrage.erzwingen
    ? NACHKAUF_RADAR_WHITELIST
    : NACHKAUF_RADAR_WHITELIST.filter((p) => {
        const k = isinKenntnis(p.isin)
        const ticker = (k?.symbolYahoo?.replace(/\.[^.]+$/, '') ?? p.isin).toUpperCase()
        const existing = bereitsMap.get(ticker)
        if (!existing) return true
        const alter = jetzt - new Date(existing.gescannt_am).getTime()
        return alter > SKIP_WENN_JUENGER_MS
      })

  // Alle bereits aktuellen Positionen zurückgeben, falls gar nichts mehr zu scannen ist
  if (zuScannen.length === 0) {
    const deepMap = await ladeAlleDeepResearch()
    const mitDeep = bereitsGespeichert.map((e) => ({
      ...e,
      tiefenAnalyse: deepMap.get(e.ticker.toUpperCase()) ?? null,
    }))
    mitDeep.sort((a, b) => b.score - a.score)
    return {
      ok: true,
      ergebnisse: mitDeep,
      monatsEmpfehlung: berechneMonatsEmpfehlung(mitDeep),
      gescannt_am: bereitsGespeichert[0]?.gescannt_am ?? new Date().toISOString(),
      gesamtAnzahl,
      gescannt: 0,
      ausstehend: 0,
    }
  }

  // Deep-Research-Cache vorab laden
  const deepResearchMap = await ladeAlleDeepResearch()

  // Titel in Batches scannen.
  // WICHTIG: Nach jedem Batch sofort in Supabase speichern —
  // so gehen bei einem Timeout keine Ergebnisse verloren.
  const BATCH_SIZE = 3
  let neuGescannt = 0

  for (let i = 0; i < zuScannen.length; i += BATCH_SIZE) {
    const batch = zuScannen.slice(i, i + BATCH_SIZE)
    const batchErgebnisse = await Promise.allSettled(
      batch.map((p) => scanneEinenTitel({ isin: p.isin, name: p.name, deepResearchMap })),
    )
    const batchOk: NachkaufScanEintrag[] = []
    for (const r of batchErgebnisse) {
      if (r.status === 'fulfilled' && r.value) batchOk.push(r.value)
    }
    if (batchOk.length > 0) {
      // Sofort persistieren — kein Verlust bei Timeout
      await speichereNachkaufScanEintraege(batchOk)
      neuGescannt += batchOk.length
    }
    // Kurze Pause zwischen Batches (Macrotrends / Yahoo Rate-Limit)
    if (i + BATCH_SIZE < zuScannen.length) {
      await new Promise((res) => setTimeout(res, 1200))
    }
  }

  // Vollständiges, aktuelles Ergebnis aus Supabase laden (inkl. bereits vor diesem Lauf gespeicherter)
  const alle = await ladeNachkaufScanAusCloud()
  const deepMapAktuell = await ladeAlleDeepResearch()
  const mitDeep = alle.map((e) => ({
    ...e,
    tiefenAnalyse: deepMapAktuell.get(e.ticker.toUpperCase()) ?? null,
  }))
  mitDeep.sort((a, b) => b.score - a.score)

  const ausstehend = gesamtAnzahl - alle.length

  return {
    ok: true,
    ergebnisse: mitDeep,
    monatsEmpfehlung: berechneMonatsEmpfehlung(mitDeep),
    gescannt_am: mitDeep[0]?.gescannt_am ?? new Date().toISOString(),
    gesamtAnzahl,
    gescannt: neuGescannt,
    ausstehend,
  }
}
