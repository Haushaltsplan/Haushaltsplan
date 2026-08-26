/**
 * Nachkauf-Radar — Scan-Server (Stufe A).
 *
 * 1. Feste Whitelist (32 Quality-Positionen) + Watchlist-Titel (Cloud-Sync)
 * 2. Für jede Position: Fundamentaldaten + gecachte KI-Summaries
 * 3. Regelbasierter Score inkl. historischer Relative Bewertung + Kaufzonen-Trigger
 * 4. Gemini Flash: kurze Begründung pro Titel
 * 5. Ergebnisse in Supabase speichern + Score-Verlauf archivieren
 * 6. Depot-Gewichte, Insider-Käufe und Score-Verlauf anreichern
 */

import 'server-only'

import { berechneHistorischeBewertung } from '@/lib/portfolio-analyse/fundamentaldaten-historische-bewertung'
import { ladeFundamentaldaten } from '@/lib/portfolio-analyse/fundamentaldaten-server'
import { analyseTickerFuerPosition, isinKenntnis } from '@/lib/portfolio-analyse/isin-kenntnisse'
import { ladeSecBerichtKiCacheFuerTicker } from '@/lib/portfolio-analyse/sec-berichte-ki-cache-server'
import { ladeEarningsCallKiCacheFuerTicker } from '@/lib/portfolio-analyse/earnings-call-unternehmen-cache-server'
import { sentimentScoreAusZusammenfassung } from '@/lib/portfolio-analyse/earnings-call-sentiment'
import {
  geminiPaidFlashModelKandidaten,
  resolveCoachProviderFromMode,
  runCoachCompletion,
} from '@/lib/ki-coach-backend'
import { NACHKAUF_SCAN_SYSTEM_PROMPT } from './nachkauf-scan-prompt'
import {
  berechneMonatsEmpfehlung,
  berechneNachkaufScore,
  extrahiereBewertungsSignale,
  leiteNachkaufAmpelAb,
  pruefKaufTrigger,
} from './nachkauf-radar-score'
import { finalisiereNachkaufRanking } from './nachkauf-ranking-finalisierung-server'
import {
  ladeNachkaufBatchKontext,
  type NachkaufBatchKontext,
} from './nachkauf-ranking-kontext-server'
import { ladeNachkaufPerformance } from './nachkauf-performance-server'
import {
  ergaenzeInsiderKaeufe,
  ladeInsiderKaeufeFuerPosition,
} from './insider-kaeufe-server'
import {
  ergaenzeDatenVollstaendigkeit,
  formatZusatzSignaleKurz,
  ladeNachkaufZusatzSignale,
} from './nachkauf-zusatz-signale-server'
import {
  aktualisiereKaufhistorieCache,
  ergaenzeDepotGewichte,
  ergaenzeKaufhistorieUndNotizen,
  ladeAlleDeepResearch,
  ladeNachkaufScanAusCloud,
  speichereNachkaufScanEintraege,
} from './nachkauf-radar-db-server'
import { ergaenzeScoreVerlauf, speichereVerlaufPunkte } from './nachkauf-radar-verlauf-server'
import { berechneTrimSignale } from './nachkauf-trim-signal'
import { wendeNachkaufDisziplinAn } from './nachkauf-disziplin-server'
import { ladeNachkaufKandidaten } from './nachkauf-watchlist-cloud-server'
import type { WhitelistPosition } from './nachkauf-radar-whitelist'
import type { NachkaufScanAnfrage, NachkaufScanEintrag, NachkaufScanPaket } from './nachkauf-radar-types'

/** Positionen, die innerhalb dieser Zeit bereits gescannt wurden, werden übersprungen. */
const SKIP_WENN_JUENGER_MS = 12 * 60 * 60 * 1000 // 12 Stunden

/** Positionen → Analyse-Ticker (Macrotrends/US-Bare, nicht H11.SG / NFLX.DE). */
function tickerFuerPosition(p: WhitelistPosition): string {
  return analyseTickerFuerPosition(p.isin, p.symbolYahoo ?? isinKenntnis(p.isin)?.symbolYahoo)
}

/** Neuestes Scan-Datum über alle Einträge (nicht Score-Sortierung!). */
function neuestesGescanntAm(eintraege: NachkaufScanEintrag[]): string {
  let best = ''
  for (const e of eintraege) {
    if (e.gescannt_am && e.gescannt_am > best) best = e.gescannt_am
  }
  return best || new Date().toISOString()
}

/** Kandidaten ohne gespeicherten Scan (ISIN oder Ticker). */
function fehlendeKandidaten(
  kandidaten: WhitelistPosition[],
  gespeichert: NachkaufScanEintrag[],
): WhitelistPosition[] {
  const byIsin = new Set(
    gespeichert.map((e) => e.isin?.trim().toUpperCase()).filter((x): x is string => Boolean(x)),
  )
  const byTicker = new Set(gespeichert.map((e) => e.ticker.trim().toUpperCase()))
  return kandidaten.filter((p) => {
    if (byIsin.has(p.isin.toUpperCase())) return false
    if (byTicker.has(tickerFuerPosition(p))) return false
    return true
  })
}

function ausstehendAnzahl(
  kandidaten: WhitelistPosition[],
  gespeichert: NachkaufScanEintrag[],
): number {
  return fehlendeKandidaten(kandidaten, gespeichert).length
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
  evMultiples: string
  premiumDiscount: string
  kaufTriggerAusgeloest: boolean
  kaufTriggerText: string | null
  beatMissText: string
  capitalAllocText: string
  strukturText: string
  prognoseText: string
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
    `EV-Multiples (aktuell vs. 5J-Median): ${opts.evMultiples}`,
    `Historischer Vergleich (Premium/Discount vs. 5J-Median aus KGV/FCF/EV): ${opts.premiumDiscount}`,
    triggerHinweis,
    '',
    `Beat/Miss-Historie: ${opts.beatMissText}`,
    `Capital Allocation: ${opts.capitalAllocText}`,
    `Struktur & Verhalten: ${opts.strukturText}`,
    `Analysten-Prognose (Mehrjahr): ${opts.prognoseText}`,
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
    {
      temperature: 0.25,
      skipMessageTrim: true,
      /** Stufe A: bezahltes Gemini 3.5 Flash — nicht Free-Tier-Key. */
      geminiForcePaidApiKey: true,
      geminiModels: geminiPaidFlashModelKandidaten({
        primaryEnvKeys: ['NACHKAUF_SCAN_GEMINI_MODEL', 'GEMINI_MODEL'],
      }),
    },
  )

  return result.ok ? result.reply.trim() : null
}

// ---------------------------------------------------------------------------
// Einen Titel scannen
// ---------------------------------------------------------------------------

async function scanneEinenTitel(opts: {
  position: WhitelistPosition
  deepResearchMap: Map<string, import('./nachkauf-radar-types').NachkaufDeepResearch>
  batchKontext: NachkaufBatchKontext | null
}): Promise<NachkaufScanEintrag | null> {
  const { position } = opts
  const { isin, name } = position
  const kenntnis = isinKenntnis(isin)
  // Watchlist-Kandidaten fehlen in ISIN_KENNTNISSE → Symbol kommt direkt aus dem Sync-Eintrag
  const symbolYahoo = kenntnis?.symbolYahoo ?? position.symbolYahoo ?? null
  // Analyse-Ticker: HLMA statt H11, NFLX statt NFLX.DE (Kurs-Listing bleibt symbolYahoo)
  const ticker = analyseTickerFuerPosition(isin, symbolYahoo)

  // Fundamentaldaten laden (Macrotrends + Yahoo)
  let paket
  try {
    paket = await ladeFundamentaldaten({
      isin,
      name,
      symbolYahoo,
      symbolCandidates: kenntnis?.symbolCandidates ?? position.symbolCandidates ?? undefined,
      segmentNurCloud: true,
    })
  } catch (e) {
    console.warn(`[nachkauf-radar] Fundamentaldaten für ${ticker} fehlgeschlagen:`, e)
    return null
  }

  if (!paket.ok && paket.zeilen.length === 0) {
    console.warn(`[nachkauf-radar] Keine Fundamentaldaten für ${ticker}`)
    return null
  }

  const [zusatzRoh, insiderKaeufe] = await Promise.all([
    ladeNachkaufZusatzSignale({ paket, ticker, symbolYahoo, isin }),
    ladeInsiderKaeufeFuerPosition(position, symbolYahoo).catch(
      () => [] as import('./nachkauf-radar-types').InsiderKauf[],
    ),
  ])

  const historisch = berechneHistorischeBewertung(paket)

  const bewertungsSignale = extrahiereBewertungsSignale(paket, position, historisch, zusatzRoh)
  const zusatz = ergaenzeDatenVollstaendigkeit(zusatzRoh, bewertungsSignale)

  const { ausgeloest: kaufTriggerAusgeloest, text: kaufTriggerText } = pruefKaufTrigger(
    bewertungsSignale,
    position,
  )

  // KI-Caches VOR dem Score laden — wirken auf Ampel, nicht nur auf den Text
  const [earningsMap, secMap] = await Promise.all([
    ladeEarningsCallKiCacheFuerTicker(ticker),
    ladeSecBerichtKiCacheFuerTicker(ticker),
  ])

  const neuesteEarningsZeile = [...earningsMap.entries()]
    .map(([id, z]) => ({ id, ...z }))
    .sort((a, b) => b.aktualisiertAm.localeCompare(a.aktualisiertAm))
    .at(0)

  const neuesteEarnings = neuesteEarningsZeile?.zusammenfassung ?? ''

  const neuesteSec =
    [...secMap.values()]
      .sort((a, b) => b.aktualisiertAm.localeCompare(a.aktualisiertAm))
      .at(0)?.zusammenfassung ?? ''

  zusatz.earningsKiZusammenfassung = neuesteEarnings || null
  zusatz.secKiZusammenfassung = neuesteSec || null
  zusatz.earningsSentimentScore =
    neuesteEarningsZeile?.sentimentScore ??
    (neuesteEarnings ? sentimentScoreAusZusammenfassung(neuesteEarnings) : null)

  const drMemo = opts.deepResearchMap.get(ticker.toUpperCase())?.memo ?? null
  const scoreDetail = berechneNachkaufScore(
    paket,
    bewertungsSignale,
    position,
    zusatz,
    insiderKaeufe,
    {
      kaufTriggerAusgeloest,
      batchKontext: opts.batchKontext,
      deepResearchMemo: drMemo,
      earningsZusammenfassung: neuesteEarnings || null,
      secZusammenfassung: neuesteSec || null,
      ticker,
    },
  )
  const ampel = leiteNachkaufAmpelAb(paket, scoreDetail, bewertungsSignale, {
    kaufTriggerAusgeloest,
    regime: opts.batchKontext?.regime ?? null,
  })

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

  const evMultiplesText = [
    bewertungsSignale.ntmEvEbitda != null
      ? `EV/EBITDA ${bewertungsSignale.ntmEvEbitda.toFixed(1)}×${
          bewertungsSignale.historischerMedianEvEbitda != null
            ? ` (Med ${bewertungsSignale.historischerMedianEvEbitda.toFixed(1)}×)`
            : ''
        }`
      : null,
    bewertungsSignale.ntmEvRev != null
      ? `EV/Umsatz ${bewertungsSignale.ntmEvRev.toFixed(1)}×${
          bewertungsSignale.historischerMedianEvRev != null
            ? ` (Med ${bewertungsSignale.historischerMedianEvRev.toFixed(1)}×)`
            : ''
        }`
      : null,
  ]
    .filter(Boolean)
    .join(' · ')

  const premiumDiscountText =
    bewertungsSignale.premiumDiscountPct != null
      ? `${bewertungsSignale.premiumDiscountPct > 0 ? '+' : ''}${bewertungsSignale.premiumDiscountPct.toFixed(1)} % vs. 5J-Median${historisch.quelle === 'macrotrends' ? ' (Macrotrends)' : ''}`
      : 'kein historischer Median verfügbar'

  const beatMissText =
    zusatz.epsBeatRatePct != null
      ? `EPS-Beat 8Q ${zusatz.epsBeatRatePct} %${zusatz.epsBeatRate12Pct != null ? `, 12Q ${zusatz.epsBeatRate12Pct} %` : ''}${zusatz.epsStreakLaenge >= 2 ? `, Streak ${zusatz.epsStreakLaenge}× ${zusatz.epsStreakArt}` : ''}`
      : 'keine Beat/Miss-Daten'

  const capitalAllocText =
    zusatz.capitalAllocationScorePct != null
      ? `Score ${zusatz.capitalAllocationScorePct}/100 (${zusatz.capitalAllocationLabel ?? '–'})`
      : 'keine Capital-Allocation-Daten'

  const strukturText = formatZusatzSignaleKurz(zusatz)

  const prognoseText =
    zusatz.prognoseProfil && zusatz.prognoseProfil.anzahlJahre >= 1
      ? zusatz.prognoseProfil.zusammenfassung
      : 'keine Mehrjahres-Schätzungen'

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
    evMultiples: evMultiplesText || 'keine Daten',
    premiumDiscount: premiumDiscountText,
    kaufTriggerAusgeloest,
    kaufTriggerText,
    beatMissText,
    capitalAllocText,
    strukturText,
    prognoseText,
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
    insiderKaeufe,
    datenSignale: zusatz,
  }
}

// ---------------------------------------------------------------------------
// Ergebnisse nach dem Scan anreichern (Verlauf, Insider, Depot-Gewichte)
// ---------------------------------------------------------------------------

async function reichereErgebnisseAn(
  eintraege: NachkaufScanEintrag[],
  mitInsider: boolean,
  batchKontext: NachkaufBatchKontext | null = null,
  kandidaten: WhitelistPosition[] = [],
): Promise<void> {
  await Promise.allSettled([
    ergaenzeDepotGewichte(eintraege),
    ergaenzeScoreVerlauf(eintraege),
    ergaenzeKaufhistorieUndNotizen(eintraege),
    mitInsider ? ergaenzeInsiderKaeufe(eintraege, kandidaten) : Promise.resolve(),
  ])
  finalisiereNachkaufRanking(eintraege, batchKontext)
  wendeNachkaufDisziplinAn(eintraege)
  berechneTrimSignale(eintraege)
}

// ---------------------------------------------------------------------------
// Haupt-Export: laufeScan
// ---------------------------------------------------------------------------

export async function laufeScan(anfrage: NachkaufScanAnfrage): Promise<NachkaufScanPaket> {
  // Feste Whitelist + Watchlist-Titel aus Supabase (Cloud-Sync der Watchlist-Seite)
  const kandidaten = await ladeNachkaufKandidaten()
  const gesamtAnzahl = kandidaten.length
  const perf = await ladeNachkaufPerformance(undefined, { mitLive: false }).catch(() => null)
  const batchKontext = await ladeNachkaufBatchKontext(
    kandidaten.map((p) => p.isin),
    perf?.scoreBucketsSignal ?? [],
  )

  // Einzel-Rescan via ISIN (von der Rescan-API-Route)
  if (anfrage.nurEinenTicker) {
    const isinTarget = anfrage.nurEinenTicker.toUpperCase()
    const positionEintrag = kandidaten.find((p) => p.isin.toUpperCase() === isinTarget)
    if (!positionEintrag) {
      const gespeicherte = await ladeNachkaufScanAusCloud()
      await reichereErgebnisseAn(gespeicherte, false, batchKontext)
      return { ok: false, ergebnisse: gespeicherte, monatsEmpfehlung: berechneMonatsEmpfehlung(gespeicherte), gescannt_am: gespeicherte[0]?.gescannt_am ?? new Date().toISOString(), gesamtAnzahl, gescannt: 0, ausstehend: 0, fehler: `ISIN ${isinTarget} weder in Whitelist noch Watchlist.` }
    }
    const deepResearchMap = await ladeAlleDeepResearch()
    const ergebnis = await scanneEinenTitel({ position: positionEintrag, deepResearchMap, batchKontext })
    if (ergebnis) {
      await speichereNachkaufScanEintraege([ergebnis])
      await speichereVerlaufPunkte([ergebnis])
    }
    const alle = await ladeNachkaufScanAusCloud()
    const deepMap = await ladeAlleDeepResearch()
    const mitDeep = alle.map((e) => ({ ...e, tiefenAnalyse: deepMap.get(e.ticker.toUpperCase()) ?? null }))
    await reichereErgebnisseAn(mitDeep, false, batchKontext)
    mitDeep.sort((a, b) => b.score - a.score)
    return { ok: true, ergebnisse: mitDeep, monatsEmpfehlung: berechneMonatsEmpfehlung(mitDeep), gescannt_am: neuestesGescanntAm(mitDeep), gesamtAnzahl, gescannt: ergebnis ? 1 : 0, ausstehend: ausstehendAnzahl(kandidaten, alle) }
  }

  // Einzelner Ticker → direkt scannen (Legacy-Pfad)
  if (anfrage.ticker) {
    const positionEintrag = kandidaten.find((p) => {
      const ticker = analyseTickerFuerPosition(p.isin, p.symbolYahoo ?? isinKenntnis(p.isin)?.symbolYahoo)
      return ticker.toUpperCase() === anfrage.ticker!.toUpperCase() || p.isin === anfrage.ticker
    })

    if (!positionEintrag) {
      const gespeicherte = await ladeNachkaufScanAusCloud()
      await reichereErgebnisseAn(gespeicherte, false, batchKontext)
      return {
        ok: false,
        ergebnisse: gespeicherte,
        monatsEmpfehlung: berechneMonatsEmpfehlung(gespeicherte),
        gescannt_am: gespeicherte[0]?.gescannt_am ?? new Date().toISOString(),
        gesamtAnzahl,
        gescannt: 0,
        ausstehend: 0,
        fehler: `Ticker/ISIN ${anfrage.ticker} weder in Whitelist noch Watchlist.`,
      }
    }

    const deepResearchMap = await ladeAlleDeepResearch()
    const ergebnis = await scanneEinenTitel({ position: positionEintrag, deepResearchMap, batchKontext })
    if (ergebnis) {
      await speichereNachkaufScanEintraege([ergebnis])
      await speichereVerlaufPunkte([ergebnis])
    }

    const alle = await ladeNachkaufScanAusCloud()
    const deepMap = await ladeAlleDeepResearch()
    const mitDeep = alle.map((e) => ({ ...e, tiefenAnalyse: deepMap.get(e.ticker.toUpperCase()) ?? null }))
    await reichereErgebnisseAn(mitDeep, false, batchKontext)
    mitDeep.sort((a, b) => b.score - a.score)

    return {
      ok: true,
      ergebnisse: mitDeep,
      monatsEmpfehlung: berechneMonatsEmpfehlung(mitDeep),
      gescannt_am: neuestesGescanntAm(mitDeep),
      gesamtAnzahl,
      gescannt: ergebnis ? 1 : 0,
      ausstehend: ausstehendAnzahl(kandidaten, alle),
    }
  }

  // Bereits gespeicherte Ergebnisse laden
  const bereitsGespeichert = await ladeNachkaufScanAusCloud()
  const bereitsMap = new Map(bereitsGespeichert.map((e) => [e.ticker.toUpperCase(), e]))

  // Was scannen?
  // - erzwingen: alle Kandidaten
  // - nurFehlende / Fortsetzen: nur fehlende (kein 12h-Re-Scan der vorhandenen)
  // - sonst: fehlende + älter als 12h
  const jetzt = Date.now()
  let zuScannen: WhitelistPosition[]
  if (anfrage.erzwingen) {
    zuScannen = kandidaten
  } else if (anfrage.nurFehlende) {
    zuScannen = fehlendeKandidaten(kandidaten, bereitsGespeichert)
  } else {
    const fehlend = new Set(fehlendeKandidaten(kandidaten, bereitsGespeichert).map((p) => p.isin))
    zuScannen = kandidaten.filter((p) => {
      if (fehlend.has(p.isin)) return true
      const ticker = tickerFuerPosition(p)
      const existing = bereitsMap.get(ticker)
      if (!existing) return true
      const alter = jetzt - new Date(existing.gescannt_am).getTime()
      return alter > SKIP_WENN_JUENGER_MS
    })
  }

  // Nichts zu tun
  if (zuScannen.length === 0) {
    const deepMap = await ladeAlleDeepResearch()
    const mitDeep = bereitsGespeichert.map((e) => ({
      ...e,
      tiefenAnalyse: deepMap.get(e.ticker.toUpperCase()) ?? null,
    }))
    await reichereErgebnisseAn(mitDeep, false, batchKontext)
    mitDeep.sort((a, b) => b.score - a.score)
    return {
      ok: true,
      ergebnisse: mitDeep,
      monatsEmpfehlung: berechneMonatsEmpfehlung(mitDeep),
      gescannt_am: neuestesGescanntAm(mitDeep),
      gesamtAnzahl,
      gescannt: 0,
      ausstehend: ausstehendAnzahl(kandidaten, bereitsGespeichert),
    }
  }

  // Scan abschließen: volle Anreicherung ohne neuen Titel-Scan
  if (anfrage.abschliessen) {
    const alle = await ladeNachkaufScanAusCloud()
    const deepMapAktuell = await ladeAlleDeepResearch()
    const mitDeep = alle.map((e) => ({
      ...e,
      tiefenAnalyse: deepMapAktuell.get(e.ticker.toUpperCase()) ?? null,
    }))
    await Promise.allSettled([
      aktualisiereKaufhistorieCache(kandidaten.map((p) => p.isin)),
    ])
    await reichereErgebnisseAn(mitDeep, true, batchKontext, kandidaten)
    mitDeep.sort((a, b) => b.score - a.score)
    const saveFin = await speichereNachkaufScanEintraege(mitDeep)
    return {
      ok: saveFin.ok,
      ergebnisse: mitDeep,
      monatsEmpfehlung: berechneMonatsEmpfehlung(mitDeep),
      gescannt_am: neuestesGescanntAm(mitDeep),
      gesamtAnzahl,
      gescannt: 0,
      ausstehend: ausstehendAnzahl(kandidaten, alle),
      verbleibend: 0,
      teilscan: false,
      fehler: saveFin.ok ? null : saveFin.fehler,
    }
  }

  // Deep-Research-Cache vorab laden
  const deepResearchMap = await ladeAlleDeepResearch()

  // Chunking: nur einen Teil pro API-Aufruf (Vercel-Timeout-Schutz)
  const offset = Math.max(0, anfrage.offset ?? 0)
  const maxProAufruf = Math.max(1, anfrage.maxProAufruf ?? zuScannen.length)
  const zuScannenJetzt = zuScannen.slice(offset, offset + maxProAufruf)
  const zeitBudgetMs = anfrage.zeitBudgetMs ?? 240_000
  const scanStart = Date.now()
  const leicht = anfrage.leicht !== false

  // Titel scannen — nach jedem Titel sofort in Supabase speichern
  const BATCH_SIZE = 1
  let neuGescannt = 0
  const neueEintraege: NachkaufScanEintrag[] = []
  let speicherFehler: string | null = null
  const fehlgeschlagen: string[] = []

  for (let i = 0; i < zuScannenJetzt.length; i += BATCH_SIZE) {
    if (Date.now() - scanStart > zeitBudgetMs) {
      break
    }
    const batch = zuScannenJetzt.slice(i, i + BATCH_SIZE)
    const batchErgebnisse = await Promise.allSettled(
      batch.map((p) => scanneEinenTitel({ position: p, deepResearchMap, batchKontext })),
    )
    const batchOk: NachkaufScanEintrag[] = []
    for (let bi = 0; bi < batchErgebnisse.length; bi++) {
      const r = batchErgebnisse[bi]!
      const pos = batch[bi]!
      if (r.status === 'fulfilled' && r.value) {
        batchOk.push(r.value)
      } else {
        const name = `${pos.name} (${tickerFuerPosition(pos)})`
        fehlgeschlagen.push(name)
        const grund =
          r.status === 'rejected'
            ? r.reason instanceof Error
              ? r.reason.message
              : String(r.reason)
            : 'keine Fundamentaldaten'
        console.warn(`[nachkauf-radar] Scan fehlgeschlagen: ${name} — ${grund}`)
      }
    }
    if (batchOk.length > 0) {
      const save = await speichereNachkaufScanEintraege(batchOk)
      if (!save.ok) {
        speicherFehler = save.fehler ?? 'Speichern fehlgeschlagen'
        console.error('[nachkauf-radar] Speichern fehlgeschlagen:', speicherFehler)
      } else {
        neuGescannt += batchOk.length
        neueEintraege.push(...batchOk)
      }
    }
    if (i + BATCH_SIZE < zuScannenJetzt.length) {
      await new Promise((res) => setTimeout(res, 800))
    }
  }

  // Offset-Logik: immer den Chunk als „abgearbeitet“ zählen (auch bei Fehlschlag),
  // sonst hängt der Client ewig auf denselben Titeln.
  const verbleibend = Math.max(0, zuScannen.length - offset - zuScannenJetzt.length)

  // Score-Verlauf archivieren (Kaufhistorie erst beim Abschließen)
  if (neueEintraege.length > 0) {
    await speichereVerlaufPunkte(neueEintraege).catch((e) =>
      console.warn('[nachkauf-scan] Verlauf fehlgeschlagen:', e),
    )
  }

  const fehlerText =
    speicherFehler ??
    (fehlgeschlagen.length > 0
      ? `Nicht gescannt: ${fehlgeschlagen.slice(0, 5).join(', ')}${fehlgeschlagen.length > 5 ? ' …' : ''}`
      : null)

  // Leicht-Modus: Zwischen-Chunks ohne Ranking/Insider-Anreicherung (Datenqualität unverändert)
  if (leicht) {
    const alle = await ladeNachkaufScanAusCloud()
    return {
      ok: !speicherFehler,
      ergebnisse: alle,
      monatsEmpfehlung: berechneMonatsEmpfehlung(alle),
      gescannt_am: neuestesGescanntAm(alle),
      gesamtAnzahl,
      gescannt: Math.max(1, neuGescannt), // Client-Offset weiterbewegen auch bei 0 Erfolgen
      ausstehend: ausstehendAnzahl(kandidaten, alle),
      verbleibend,
      teilscan: verbleibend > 0,
      fehler: fehlerText,
    }
  }

  // Vollständiges Ergebnis mit Anreicherung
  const alle = await ladeNachkaufScanAusCloud()
  const deepMapAktuell = await ladeAlleDeepResearch()
  const mitDeep = alle.map((e) => ({
    ...e,
    tiefenAnalyse: deepMapAktuell.get(e.ticker.toUpperCase()) ?? null,
  }))

  // Alle Anreicherungen parallel (Verlauf, Insider, Depot-Gewichte)
  await reichereErgebnisseAn(mitDeep, true, batchKontext, kandidaten)
  mitDeep.sort((a, b) => b.score - a.score)
  await speichereNachkaufScanEintraege(mitDeep)

  return {
    ok: !speicherFehler,
    ergebnisse: mitDeep,
    monatsEmpfehlung: berechneMonatsEmpfehlung(mitDeep),
    gescannt_am: neuestesGescanntAm(mitDeep),
    gesamtAnzahl,
    gescannt: Math.max(1, neuGescannt),
    ausstehend: ausstehendAnzahl(kandidaten, alle),
    verbleibend,
    teilscan: verbleibend > 0,
    fehler: fehlerText,
  }
}
