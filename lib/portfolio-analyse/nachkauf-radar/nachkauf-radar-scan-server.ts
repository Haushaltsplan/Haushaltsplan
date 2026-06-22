/**
 * Nachkauf-Radar — Scan-Server (Stufe A).
 *
 * 1. Feste Whitelist (32 Quality-Positionen)
 * 2. Für jede Position: Fundamentaldaten + gecachte KI-Summaries
 * 3. Regelbasierter Score inkl. historischer Relative Bewertung + Kaufzonen-Trigger
 * 4. Gemini Flash: kurze Begründung pro Titel
 * 5. Ergebnisse in Supabase speichern + Score-Verlauf archivieren
 * 6. Depot-Gewichte, Insider-Käufe und Score-Verlauf anreichern
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
  pruefKaufTrigger,
} from './nachkauf-radar-score'
import {
  aktualisiereKaufhistorieCache,
  ergaenzeDepotGewichte,
  ergaenzeKaufhistorieUndNotizen,
  ladeAlleDeepResearch,
  ladeNachkaufScanAusCloud,
  speichereNachkaufScanEintraege,
} from './nachkauf-radar-db-server'
import { ergaenzeScoreVerlauf, speichereVerlaufPunkte } from './nachkauf-radar-verlauf-server'
import { ergaenzeInsiderKaeufe } from './insider-kaeufe-server'
import { berechneTrimSignale } from './nachkauf-trim-signal'
import { NACHKAUF_RADAR_WHITELIST } from './nachkauf-radar-whitelist'
import type { WhitelistPosition } from './nachkauf-radar-whitelist'
import type { NachkaufScanAnfrage, NachkaufScanEintrag, NachkaufScanPaket } from './nachkauf-radar-types'

/** Positionen, die innerhalb dieser Zeit bereits gescannt wurden, werden übersprungen. */
const SKIP_WENN_JUENGER_MS = 12 * 60 * 60 * 1000 // 12 Stunden

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
  premiumDiscount: string
  kaufTriggerAusgeloest: boolean
  kaufTriggerText: string | null
  earningsSummary: string
  secSummary: string
}): Promise<string | null> {
  const provider = resolveCoachProviderFromMode('gemini')
  if (!provider || provider.provider !== 'gemini') return null

  const triggerHinweis = opts.kaufTriggerAusgeloest && opts.kaufTriggerText
    ? `\nKaufzonen-Trigger: AUSGELÖST — ${opts.kaufTriggerText}`
    : ''

  const userText = [
    `Unternehmen: ${opts.name} (${opts.ticker})`,
    `Radar-Ampel: ${opts.ampel} | Score: ${opts.score}/100`,
    `Mantra-Qualität: ${opts.mantraAmpelText}`,
    `Sell-Trigger-Status: ${opts.sellTriggerText}`,
    `FCF-Rendite (NTM/LTM): ${opts.fcfYield}`,
    `Forward-KGV (NTM): ${opts.forwardPe}`,
    `Historischer Vergleich (Premium/Discount vs. 5J-Median): ${opts.premiumDiscount}`,
    triggerHinweis,
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
  position: WhitelistPosition
  deepResearchMap: Map<string, import('./nachkauf-radar-types').NachkaufDeepResearch>
}): Promise<NachkaufScanEintrag | null> {
  const { position } = opts
  const { isin, name } = position
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

  // Score regelbasiert berechnen (mit historischer Relative Bewertung)
  const bewertungsSignale = extrahiereBewertungsSignale(paket, position)
  const scoreDetail = berechneNachkaufScore(paket, bewertungsSignale, position)
  const ampel = leiteNachkaufAmpelAb(paket, scoreDetail, bewertungsSignale)

  // Kaufzonen-Trigger prüfen
  const { ausgeloest: kaufTriggerAusgeloest, text: kaufTriggerText } = pruefKaufTrigger(bewertungsSignale, position)

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

  const premiumDiscountText =
    bewertungsSignale.premiumDiscountPct != null
      ? `${bewertungsSignale.premiumDiscountPct > 0 ? '+' : ''}${bewertungsSignale.premiumDiscountPct.toFixed(1)} % vs. 5J-Median`
      : 'kein historischer Median hinterlegt'

  // KI-Begründung generieren
  const kiBegruendung = await generiereKiBegruendung({
    name: paket.firmenname || name,
    ticker,
    ampel:
      ampel === 'gruen' ? 'Grün'
      : ampel === 'gelb' ? 'Gelb'
      : ampel === 'rot' ? 'Rot'
      : ampel === 'teuer' ? 'Teuer (Quality ok, Preis zu hoch)'
      : 'Grau',
    score: scoreDetail.gesamt,
    mantraAmpelText: ampelText[mantra.ampel] ?? mantra.ampel,
    sellTriggerText,
    fcfYield: fcfYieldText,
    forwardPe: forwardPeText,
    premiumDiscount: premiumDiscountText,
    kaufTriggerAusgeloest,
    kaufTriggerText,
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
    depotGewichtPct: null,
    klumpenrisiko: false,
    kaufTriggerAusgeloest,
    kaufTriggerText,
    scoreVerlauf: [],
    insiderKaeufe: [],
  }
}

// ---------------------------------------------------------------------------
// Ergebnisse nach dem Scan anreichern (Verlauf, Insider, Depot-Gewichte)
// ---------------------------------------------------------------------------

async function reichereErgebnisseAn(
  eintraege: NachkaufScanEintrag[],
  mitInsider: boolean,
): Promise<void> {
  await Promise.allSettled([
    ergaenzeDepotGewichte(eintraege),
    ergaenzeScoreVerlauf(eintraege),
    ergaenzeKaufhistorieUndNotizen(eintraege),
    mitInsider ? ergaenzeInsiderKaeufe(eintraege, NACHKAUF_RADAR_WHITELIST) : Promise.resolve(),
  ])
  // Trim-Signale nachgelagert (braucht depotGewichtPct und scoreVerlauf)
  berechneTrimSignale(eintraege)
}

// ---------------------------------------------------------------------------
// Haupt-Export: laufeScan
// ---------------------------------------------------------------------------

export async function laufeScan(anfrage: NachkaufScanAnfrage): Promise<NachkaufScanPaket> {
  const gesamtAnzahl = NACHKAUF_RADAR_WHITELIST.length

  // Einzel-Rescan via ISIN (von der Rescan-API-Route)
  if (anfrage.nurEinenTicker) {
    const isinTarget = anfrage.nurEinenTicker.toUpperCase()
    const positionEintrag = NACHKAUF_RADAR_WHITELIST.find((p) => p.isin.toUpperCase() === isinTarget)
    if (!positionEintrag) {
      const gespeicherte = await ladeNachkaufScanAusCloud()
      await reichereErgebnisseAn(gespeicherte, false)
      return { ok: false, ergebnisse: gespeicherte, monatsEmpfehlung: berechneMonatsEmpfehlung(gespeicherte), gescannt_am: gespeicherte[0]?.gescannt_am ?? new Date().toISOString(), gesamtAnzahl, gescannt: 0, ausstehend: 0, fehler: `ISIN ${isinTarget} nicht in der Whitelist.` }
    }
    const deepResearchMap = await ladeAlleDeepResearch()
    const ergebnis = await scanneEinenTitel({ position: positionEintrag, deepResearchMap })
    if (ergebnis) {
      await speichereNachkaufScanEintraege([ergebnis])
      await speichereVerlaufPunkte([ergebnis])
    }
    const alle = await ladeNachkaufScanAusCloud()
    const deepMap = await ladeAlleDeepResearch()
    const mitDeep = alle.map((e) => ({ ...e, tiefenAnalyse: deepMap.get(e.ticker.toUpperCase()) ?? null }))
    await reichereErgebnisseAn(mitDeep, false)
    mitDeep.sort((a, b) => b.score - a.score)
    return { ok: true, ergebnisse: mitDeep, monatsEmpfehlung: berechneMonatsEmpfehlung(mitDeep), gescannt_am: ergebnis?.gescannt_am ?? new Date().toISOString(), gesamtAnzahl, gescannt: ergebnis ? 1 : 0, ausstehend: 0 }
  }

  // Einzelner Ticker → direkt scannen (Legacy-Pfad)
  if (anfrage.ticker) {
    const positionEintrag = NACHKAUF_RADAR_WHITELIST.find((p) => {
      const k = isinKenntnis(p.isin)
      const ticker = k?.symbolYahoo?.replace(/\.[^.]+$/, '') ?? ''
      return ticker.toUpperCase() === anfrage.ticker!.toUpperCase() || p.isin === anfrage.ticker
    })

    if (!positionEintrag) {
      const gespeicherte = await ladeNachkaufScanAusCloud()
      await reichereErgebnisseAn(gespeicherte, false)
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
    const ergebnis = await scanneEinenTitel({ position: positionEintrag, deepResearchMap })
    if (ergebnis) {
      await speichereNachkaufScanEintraege([ergebnis])
      await speichereVerlaufPunkte([ergebnis])
    }

    const alle = await ladeNachkaufScanAusCloud()
    const deepMap = await ladeAlleDeepResearch()
    const mitDeep = alle.map((e) => ({ ...e, tiefenAnalyse: deepMap.get(e.ticker.toUpperCase()) ?? null }))
    await reichereErgebnisseAn(mitDeep, false)
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

  // Bereits gespeicherte Ergebnisse laden
  const bereitsGespeichert = await ladeNachkaufScanAusCloud()
  const bereitsMap = new Map(bereitsGespeichert.map((e) => [e.ticker.toUpperCase(), e]))

  // Nicht erzwungen: Positionen aus den letzten 12h überspringen
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

  // Nichts zu tun
  if (zuScannen.length === 0) {
    const deepMap = await ladeAlleDeepResearch()
    const mitDeep = bereitsGespeichert.map((e) => ({
      ...e,
      tiefenAnalyse: deepMap.get(e.ticker.toUpperCase()) ?? null,
    }))
    await reichereErgebnisseAn(mitDeep, false)
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

  // Titel in Batches scannen — nach jedem Batch sofort in Supabase speichern
  const BATCH_SIZE = 3
  let neuGescannt = 0
  const neueEintraege: NachkaufScanEintrag[] = []

  for (let i = 0; i < zuScannen.length; i += BATCH_SIZE) {
    const batch = zuScannen.slice(i, i + BATCH_SIZE)
    const batchErgebnisse = await Promise.allSettled(
      batch.map((p) => scanneEinenTitel({ position: p, deepResearchMap })),
    )
    const batchOk: NachkaufScanEintrag[] = []
    for (const r of batchErgebnisse) {
      if (r.status === 'fulfilled' && r.value) batchOk.push(r.value)
    }
    if (batchOk.length > 0) {
      await speichereNachkaufScanEintraege(batchOk)
      neuGescannt += batchOk.length
      neueEintraege.push(...batchOk)
    }
    if (i + BATCH_SIZE < zuScannen.length) {
      await new Promise((res) => setTimeout(res, 1200))
    }
  }

  // Score-Verlauf archivieren + Kaufhistorie-Cache aktualisieren
  if (neueEintraege.length > 0) {
    await Promise.allSettled([
      speichereVerlaufPunkte(neueEintraege),
      aktualisiereKaufhistorieCache(NACHKAUF_RADAR_WHITELIST.map((p) => p.isin)),
    ]).catch((e) => console.warn('[nachkauf-scan] Post-Scan-Cache fehlgeschlagen:', e))
  }

  // Vollständiges, aktuelles Ergebnis aus Supabase laden
  const alle = await ladeNachkaufScanAusCloud()
  const deepMapAktuell = await ladeAlleDeepResearch()
  const mitDeep = alle.map((e) => ({
    ...e,
    tiefenAnalyse: deepMapAktuell.get(e.ticker.toUpperCase()) ?? null,
  }))

  // Alle Anreicherungen parallel (Verlauf, Insider, Depot-Gewichte)
  await reichereErgebnisseAn(mitDeep, true)
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
