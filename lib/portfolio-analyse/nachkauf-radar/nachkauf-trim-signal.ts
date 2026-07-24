/**
 * Verkauf-/Trim-Signal-Berechnung.
 *
 * Kein LLM — rein regelbasiert wie der Nachkauf-Score.
 *
 * Philosophie: Langfristiger Quality-Investor. Verkäufe sind selten und
 * nur bei klarer, kombinierter Evidenz — kein Trading, kein Panik-Trim.
 * Default ist Halten/Beobachten.
 *
 * Faktoren (einzeln nie ausreichend):
 *  – Klumpenrisiko (≥ 15 % Depot)
 *  – Operative Qualität (Sell-Trigger Warnung, nicht nur Beobachten)
 *  – Bewertungs-Hype nur mit Klumpen oder Qualitätsproblem
 *  – Score-Verfall über mehrere Monate + schwacher Score
 */

import type {
  NachkaufScanEintrag,
  TrimFaktor,
  TrimSignal,
  TrimSignalAktion,
  TrimSignalDringlichkeit,
  TrimSignalKategorie,
  VerkaufPosten,
} from './nachkauf-radar-types'
import { NACHKAUF_RADAR_WHITELIST, risikoKlasseFuerIsin, type RisikoKlasse } from './nachkauf-radar-whitelist'

/** Ziel-Depotgewicht je Risikoklasse (Langfrist-Allokation, nicht aggressiv trimmen). */
const ZIEL_GEWICHT: Record<RisikoKlasse, number> = {
  konservativ: 12,
  moderat: 10,
  spekulativ: 6,
}

/** Mindest-Gewichtsumme der Faktoren, bevor ein Signal überhaupt ausgelöst wird. */
const MIN_FAKTOR_GEWICHT = 5

/** Maximaler Teilverkauf in % — Langfrist-Investor, kein Komplett-Umschichten. */
const MAX_TEILVERKAUF_PCT = 30

function risikoKlasseVon(isin: string): RisikoKlasse {
  return risikoKlasseFuerIsin(isin)
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n))
}

/** Gesamt-Portfolio-Empfehlung pro Titel (Kaufen / Halten / Beobachten / Teilverkauf / Verkauf prüfen). */
export type PortfolioEmpfehlungTyp =
  | 'nachkauf'
  | 'halten'
  | 'beobachten'
  | 'teilverkauf_erwaegen'
  | 'verkauf_pruefen'

export function portfolioEmpfehlungVon(e: NachkaufScanEintrag): {
  typ: PortfolioEmpfehlungTyp
  label: string
  kurz: string
} {
  const ts = e.trimSignal

  if (ts?.aktion === 'vollverkauf') {
    return {
      typ: 'verkauf_pruefen',
      label: 'Verkauf prüfen',
      kurz: 'Investmenthypothese ernsthaft beschädigt — Exit erwägen, nicht reflexartig.',
    }
  }
  if (ts?.aktion === 'teilverkauf' && ts.dringlichkeit !== 'niedrig') {
    return {
      typ: 'teilverkauf_erwaegen',
      label: 'Teilverkauf erwägen',
      kurz: ts.verkaufAnteilPct != null
        ? `Optional ~${ts.verkaufAnteilPct} % reduzieren — Rest langfristig halten.`
        : 'Positionsgröße optional reduzieren.',
    }
  }
  if (ts?.aktion === 'ueberpruefen') {
    return {
      typ: 'beobachten',
      label: 'Beobachten',
      kurz: 'Hinweis zur Kenntnis — kein Handlungszwang, These weiter verfolgen.',
    }
  }

  if (e.ampel === 'gruen' && e.kaufTriggerAusgeloest) {
    return { typ: 'nachkauf', label: 'Nachkauf', kurz: 'Kaufzone aktiv, Qualität intakt.' }
  }
  if (e.ampel === 'gruen') {
    return { typ: 'nachkauf', label: 'Nachkauf möglich', kurz: 'Attraktiv, aber kein Trigger — kein Zwang.' }
  }
  if (e.ampel === 'gelb' || e.ampel === 'teuer') {
    return {
      typ: 'halten',
      label: 'Halten',
      kurz: e.ampel === 'teuer'
        ? 'Qualität intakt, Bewertung hoch — diesen Monat nicht nachkaufen.'
        : 'These intakt, Abstriche — beobachten, nicht verkaufen.',
    }
  }
  if (e.ampel === 'rot') {
    return {
      typ: 'beobachten',
      label: 'Beobachten',
      kurz: 'Kein Nachkauf — Verkauf nur bei bestätigtem Qualitätsbruch, nicht aus Angst.',
    }
  }
  return { typ: 'beobachten', label: 'Beobachten', kurz: 'Zu wenig Daten für eine klare Empfehlung.' }
}

export function berechneTrimSignale(eintraege: NachkaufScanEintrag[]): void {
  const whitelistMap = new Map(NACHKAUF_RADAR_WHITELIST.map((p) => [p.isin.toUpperCase(), p]))

  for (const e of eintraege) {
    const signal = berechneTrimSignalFuerEintrag(e, whitelistMap)
    if (signal) e.trimSignal = signal
  }
}

function berechneTrimSignalFuerEintrag(
  e: NachkaufScanEintrag,
  whitelistMap: Map<string, (typeof NACHKAUF_RADAR_WHITELIST)[number]>,
): TrimSignal | undefined {
  const depot = e.depotGewichtPct ?? 0
  if (depot <= 0) return undefined

  const position = whitelistMap.get(e.isin.toUpperCase())
  const verlauf = e.scoreVerlauf
  const risiko = risikoKlasseVon(e.isin)
  const zielGewicht = ZIEL_GEWICHT[risiko]
  const faktoren: TrimFaktor[] = []

  const hatKlumpen = e.klumpenrisiko
  const hatSchwerenSellTrigger = !e.sellTriggerOk && e.scoreDetail.sellTriggerPenalty <= -25
  const hatQualitaetsproblem = e.ampel === 'rot' || e.score < 35

  // --- Klumpenrisiko (stärkster legitimer Trim-Grund für Langfrist-Investor) ---
  if (hatKlumpen) {
    const ueberschuss = depot - zielGewicht
    faktoren.push({
      kategorie: 'klumpenrisiko',
      text: `Klumpenrisiko: ${depot.toFixed(1)} % Depot (Ziel langfristig ≤ ${zielGewicht} %).`,
      gewicht: ueberschuss >= 6 ? 3 : 2,
    })
  }

  // --- Qualität: nur harte Signale, kein „Beobachten"-Sell-Trigger allein ---
  if (hatSchwerenSellTrigger) {
    faktoren.push({
      kategorie: 'qualitaet',
      text: 'Sell-Trigger Warnung — operative Investmenthypothese beschädigt.',
      gewicht: 3,
    })
  }

  if (e.ampel === 'rot' && e.score < 35) {
    faktoren.push({
      kategorie: 'qualitaet',
      text: `Ampel rot bei Score ${e.score}/100 — Qualität oder These unter Druck.`,
      gewicht: 2,
    })
  } else if (e.score < 25) {
    faktoren.push({
      kategorie: 'qualitaet',
      text: `Sehr niedriger Score (${e.score}/100) — These fundamental überdenken.`,
      gewicht: 3,
    })
  }

  if (e.mantraScorePct != null && e.mantraScorePct < 40 && hatQualitaetsproblem) {
    faktoren.push({
      kategorie: 'qualitaet',
      text: `Mantra-Qualität ${e.mantraScorePct.toFixed(0)} % bei gleichzeitig schwachem Gesamt-Signal.`,
      gewicht: 2,
    })
  }

  // --- Hype: NUR in Kombination mit Klumpen oder Qualitätsproblem ---
  const premium = e.bewertung.premiumDiscountPct
  const drawdown = e.bewertung.drawdown52wPct
  if (
    premium != null && premium > 35 &&
    (drawdown == null || drawdown < 5) &&
    (hatKlumpen || hatQualitaetsproblem)
  ) {
    faktoren.push({
      kategorie: 'bewertung_hype',
      text: `Extreme Bewertung (+${premium.toFixed(0)} % vs. Median, nahe Hoch) bei gleichzeitigem Risiko.`,
      gewicht: 2,
    })
  }

  const medianPe = e.bewertung.historischerMedianPe ?? position?.historischerMedianPe
  if (medianPe && e.bewertung.forwardPe && hatKlumpen) {
    const ratio = e.bewertung.forwardPe / medianPe
    if (ratio > 2.2) {
      faktoren.push({
        kategorie: 'bewertung_hype',
        text: `KGV ${e.bewertung.forwardPe.toFixed(0)}× (>2× Median) bei Klumpenrisiko — Größe reduzieren, nicht Qualität aufgeben.`,
        gewicht: 2,
      })
    }
  }

  // --- Score-Verfall: nur bei anhaltendem Trend + schwachem Level ---
  if (verlauf.length >= 3 && e.score < 35) {
    const letzte3 = verlauf.slice(-3)
    const konstantSinkend =
      letzte3[0]!.score > letzte3[1]!.score && letzte3[1]!.score > letzte3[2]!.score
    const gesamtDelta = letzte3[0]!.score - letzte3[2]!.score
    if (konstantSinkend && gesamtDelta >= 12) {
      faktoren.push({
        kategorie: 'score_verfall',
        text: `Score fällt 3 Scans in Folge (${letzte3[0]!.score} → ${letzte3[2]!.score}).`,
        gewicht: 2,
      })
    }
  }

  // --- Struktur/Insider: nur als Verstärker bei bestehendem Qualitäts-Signal ---
  const zusatz = e.datenSignale
  if (hatQualitaetsproblem || hatSchwerenSellTrigger) {
    if (zusatz?.epsStreakArt === 'miss' && zusatz.epsStreakLaenge >= 3) {
      faktoren.push({
        kategorie: 'qualitaet',
        text: `${zusatz.epsStreakLaenge} EPS-Misses in Folge — operative Schwäche bestätigt.`,
        gewicht: 2,
      })
    }
    if (e.scoreDetail.strukturPunkte <= -6) {
      faktoren.push({
        kategorie: 'struktur',
        text: `Strukturrisiken (${e.scoreDetail.strukturPunkte} Pkt.) verstärken Qualitätsbedenken.`,
        gewicht: 1,
      })
    }
  }

  const gewichtSumme = faktoren.reduce((s, f) => s + f.gewicht, 0)

  // Harte Einzelfall-Ausnahme: echtes Klumpenrisiko ab 18 %
  const klumpenAlleinAusreichend = hatKlumpen && depot >= 18 && gewichtSumme >= 2

  if (gewichtSumme < MIN_FAKTOR_GEWICHT && !klumpenAlleinAusreichend) {
    return undefined
  }

  const prioritaet = berechnePrioritaet(faktoren, depot, hatKlumpen)
  const { verkaufAnteilPct, zielDepotGewichtPct } = berechneVerkaufAnteil(
    e,
    faktoren,
    depot,
    zielGewicht,
    hatKlumpen,
    hatSchwerenSellTrigger,
    hatQualitaetsproblem,
  )
  const { aktion, dringlichkeit } = bestimmeAktion(
    faktoren,
    e,
    verkaufAnteilPct,
    prioritaet,
    hatSchwerenSellTrigger,
    hatKlumpen,
  )
  const typ = aktion === 'ueberpruefen' ? 'ueberpruefen' : 'trim'
  const grund = baueGrundText(faktoren, aktion, verkaufAnteilPct)

  return {
    typ,
    aktion,
    dringlichkeit,
    verkaufAnteilPct,
    zielDepotGewichtPct,
    faktoren,
    grund,
    prioritaet,
  }
}

function berechnePrioritaet(faktoren: TrimFaktor[], depot: number, hatKlumpen: boolean): number {
  const gewichtSumme = faktoren.reduce((s, f) => s + f.gewicht, 0)
  const depotBonus = hatKlumpen ? Math.min(15, (depot - 15) * 2) : 0
  return clamp(Math.round(gewichtSumme * 8 + depotBonus), 0, 100)
}

function berechneVerkaufAnteil(
  e: NachkaufScanEintrag,
  faktoren: TrimFaktor[],
  depot: number,
  zielGewicht: number,
  hatKlumpen: boolean,
  hatSchwerenSellTrigger: boolean,
  hatQualitaetsproblem: boolean,
): { verkaufAnteilPct: number | null; zielDepotGewichtPct: number | null } {
  const anteile: number[] = []

  // Klumpen: nur Überschuss trimmen, gedeckelt
  if (hatKlumpen && depot > zielGewicht) {
    const roh = ((depot - zielGewicht) / depot) * 100
    anteile.push(Math.min(roh, MAX_TEILVERKAUF_PCT))
  }

  // Qualität: nur moderater Trim, kein Panik
  if (hatSchwerenSellTrigger && e.score < 25 && e.ampel === 'rot') {
    anteile.push(100) // Vollverkauf nur in dieser Extremsituation
  } else if (hatSchwerenSellTrigger && hatQualitaetsproblem) {
    anteile.push(25)
  }

  // Hype + Klumpen: kleiner Trim
  const hypeMitKlumpen = faktoren.some(
    (f) => f.kategorie === 'bewertung_hype' && hatKlumpen,
  )
  if (hypeMitKlumpen) {
    anteile.push(15)
  }

  if (anteile.length === 0) {
    return { verkaufAnteilPct: null, zielDepotGewichtPct: null }
  }

  const verkaufAnteilPct = clamp(Math.round(Math.max(...anteile)), 10, MAX_TEILVERKAUF_PCT)
  const zielDepotGewichtPct = Math.round((depot * (100 - verkaufAnteilPct)) / 100 * 10) / 10

  return { verkaufAnteilPct, zielDepotGewichtPct }
}

function bestimmeAktion(
  faktoren: TrimFaktor[],
  e: NachkaufScanEintrag,
  verkaufAnteilPct: number | null,
  prioritaet: number,
  hatSchwerenSellTrigger: boolean,
  hatKlumpen: boolean,
): { aktion: TrimSignalAktion; dringlichkeit: TrimSignalDringlichkeit } {
  // Vollverkauf: nur bei bestätigtem Qualitätsbruch
  if (
    verkaufAnteilPct != null && verkaufAnteilPct >= 100 &&
    hatSchwerenSellTrigger && e.score < 25 && e.ampel === 'rot'
  ) {
    return { aktion: 'vollverkauf', dringlichkeit: 'hoch' }
  }

  if (verkaufAnteilPct == null) {
    return { aktion: 'ueberpruefen', dringlichkeit: 'niedrig' }
  }

  // Teilverkauf nur bei klarer Evidenz
  if (hatKlumpen && depotUeberschussRelevant(e.depotGewichtPct ?? 0, risikoKlasseVon(e.isin))) {
    if (prioritaet >= 55) return { aktion: 'teilverkauf', dringlichkeit: 'mittel' }
    return { aktion: 'teilverkauf', dringlichkeit: 'niedrig' }
  }

  if (hatSchwerenSellTrigger && e.score < 30) {
    return { aktion: 'teilverkauf', dringlichkeit: 'mittel' }
  }

  // Alles andere: nur beobachten, kein Handlungszwang
  return { aktion: 'ueberpruefen', dringlichkeit: 'niedrig' }
}

function depotUeberschussRelevant(depot: number, risiko: RisikoKlasse): boolean {
  return depot >= ZIEL_GEWICHT[risiko] + 4
}

const KATEGORIE_LABEL: Record<TrimSignalKategorie, string> = {
  klumpenrisiko: 'Klumpenrisiko',
  qualitaet: 'Qualitätsverschlechterung',
  bewertung_hype: 'Bewertungs-Hype',
  score_verfall: 'Score-Verfall',
  struktur: 'Strukturrisiko',
  insider: 'Insider-Signal',
}

function baueGrundText(
  faktoren: TrimFaktor[],
  aktion: TrimSignalAktion,
  verkaufAnteilPct: number | null,
): string {
  const sortiert = [...faktoren].sort((a, b) => b.gewicht - a.gewicht)
  const haupt = sortiert.slice(0, 2).map((f) => f.text).join(' ')
  const kategorien = [...new Set(sortiert.map((f) => KATEGORIE_LABEL[f.kategorie]))].join(', ')

  if (aktion === 'vollverkauf') {
    return `Langfrist-These wohl gebrochen (${kategorien}): ${haupt}`
  }
  if (aktion === 'teilverkauf' && verkaufAnteilPct != null) {
    return `Optional ~${verkaufAnteilPct} % reduzieren (${kategorien}) — Rest halten: ${haupt}`
  }
  return `Zur Kenntnis (${kategorien}) — kein Handlungszwang: ${haupt}`
}

// ---------------------------------------------------------------------------
// Verkaufs-Allokation für Stufe C (nur klare Fälle)
// ---------------------------------------------------------------------------

const MIN_VERKAUF_ANTEIL = 10

/** Regelbasierte Verkaufsempfehlungen — konservativ, wenige Kandidaten. */
export function berechneBasisVerkaufAllokation(eintraege: NachkaufScanEintrag[]): VerkaufPosten[] {
  return eintraege
    .filter((e) => {
      const ts = e.trimSignal
      if (!ts) return false
      if (ts.aktion === 'ueberpruefen') return false
      if (ts.dringlichkeit === 'niedrig') return false
      if (ts.verkaufAnteilPct == null || ts.verkaufAnteilPct < MIN_VERKAUF_ANTEIL) return false
      return true
    })
    .sort((a, b) => (b.trimSignal?.prioritaet ?? 0) - (a.trimSignal?.prioritaet ?? 0))
    .map((e) => {
      const ts = e.trimSignal!
      return {
        ticker: e.ticker,
        name: e.name,
        verkaufAnteilPct: ts.verkaufAnteilPct!,
        begruendung: ts.grund,
        dringlichkeit: ts.dringlichkeit,
        faktoren: ts.faktoren.map((f) => f.text),
      }
    })
}

/** Verkaufs-Kandidaten für KI — nur echte Handlungsfälle. */
export function filterVerkaufKandidaten(eintraege: NachkaufScanEintrag[]): NachkaufScanEintrag[] {
  return eintraege
    .filter((e) => {
      const ts = e.trimSignal
      if (!ts) return false
      if ((e.depotGewichtPct ?? 0) < 3) return false
      return ts.aktion === 'teilverkauf' || ts.aktion === 'vollverkauf'
    })
    .sort((a, b) => (b.trimSignal?.prioritaet ?? 0) - (a.trimSignal?.prioritaet ?? 0))
}
