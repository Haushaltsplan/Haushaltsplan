/**
 * Nachkauf-Radar — KI-gestützte Kaufempfehlung (Stufe C).
 *
 * Nimmt strenge Kauf-Kandidaten (Grün + Score-Floor, oder Kaufzone) mit Deep Research,
 * kombiniert sie mit der regelbasierten Allokation und lässt Gemini Pro
 * eine finale, begründete Kaufempfehlung für das Monatsbudget erstellen.
 */

import 'server-only'

import {
  geminiProPaidModelKandidaten,
  resolveCoachProviderFromMode,
  runCoachCompletion,
} from '@/lib/ki-coach-backend'
import {
  istWhitelistIsin,
  risikoKlasseFuerIsin,
  type RisikoKlasse,
} from './nachkauf-radar-whitelist'
import type { NachkaufScanEintrag, MonatsEmpfehlung, SparplanPosten, VerkaufPosten } from './nachkauf-radar-types'
import {
  berechneBasisVerkaufAllokation,
  filterBeobachtungsKandidaten,
  filterVerkaufKandidaten,
} from './nachkauf-trim-signal'
import { berechneRegelAllokation, waehleMonatsNachkaufKandidaten } from './nachkauf-radar-score'

const DEFAULT_BUDGET_EUR = 500
/**
 * Stufe C ist bewusst strenger als Scan-Grün (58/68): echtes Geld, nicht nur Beobachtung.
 * Empfohlene Kalibrierung: ~oberes Grün-Quartil der Whitelist.
 */
export const MIN_SCORE_KAUF_GRUEN = 76
/** Kaufzone + Gelb: Ausnahme nur bei klarer Bewertungschance. */
export const MIN_SCORE_KAUF_TRIGGER = 74
/** Score-Fallback ohne Ampel Grün (selten, hohe Hürde). */
export const MIN_SCORE_KAUF_STANDARD = 82
/** Watchlist-Neukauf: noch höhere Hürde (keine kuratierte Qualitätshistorie). */
export const MIN_SCORE_WATCHLIST_NEUKAUF = 84

/** Maximale monatliche Investition je Risikoklasse. */
const RISIKO_CAP: Record<RisikoKlasse, number> = {
  konservativ: 350,
  moderat: 200,
  spekulativ: 100,
}

/** Lesbare Labels für die Anzeige im Prompt und UI. */
const RISIKO_LABEL: Record<RisikoKlasse, string> = {
  konservativ: 'Konservativ (≤ 350 €)',
  moderat: 'Moderat (≤ 200 €)',
  spekulativ: 'Spekulativ (≤ 100 €)',
}

/** Blockiert Nachkäufe nur bei bestätigtem Verkaufssignal (nicht bei bloßem Beobachten). */
function hatAktivesVerkaufSignal(e: NachkaufScanEintrag): boolean {
  const ts = e.trimSignal
  if (!ts) return false
  if (ts.aktion === 'vollverkauf') return true
  if (ts.aktion === 'teilverkauf' && ts.dringlichkeit === 'hoch') return true
  return false
}

/**
 * Stufe C — strenger als Scan-Ampel: Grün allein reicht nicht (Score-Floor), Deep Research Pflicht.
 * Watchlist-Neukäufe: Score ≥ 84 + Deep Research (kein Gelb-Kaufzone-Shortcut).
 */
export function istKiKaufKandidat(e: NachkaufScanEintrag): boolean {
  if (e.ampel === 'rot' || e.ampel === 'teuer' || hatAktivesVerkaufSignal(e) || !e.tiefenAnalyse) {
    return false
  }
  if (istWatchlistKandidat(e.isin)) {
    return e.score >= MIN_SCORE_WATCHLIST_NEUKAUF
  }
  if (e.ampel === 'gruen' && e.score >= MIN_SCORE_KAUF_GRUEN) return true
  if (
    e.kaufTriggerAusgeloest &&
    e.ampel === 'gelb' &&
    e.score >= MIN_SCORE_KAUF_TRIGGER
  ) {
    return true
  }
  return e.score >= MIN_SCORE_KAUF_STANDARD
}

function kaufSchwellenText(): string {
  return (
    `Whitelist: Grün + Score ≥ ${MIN_SCORE_KAUF_GRUEN}, oder Kaufzone + Gelb + Score ≥ ${MIN_SCORE_KAUF_TRIGGER}` +
    `; Watchlist-Neukauf: Score ≥ ${MIN_SCORE_WATCHLIST_NEUKAUF}` +
    ` (jeweils mit Deep Research)`
  )
}

function baueSparHinweis(
  alle: NachkaufScanEintrag[],
  budgetEur: number,
  beobachtung: NachkaufScanEintrag[] = [],
): string {
  const gruenOhneDr = alle.filter((e) => e.ampel === 'gruen' && !e.tiefenAnalyse)
  const gruenScoreZuNiedrig = alle.filter(
    (e) =>
      !istWatchlistKandidat(e.isin) &&
      e.ampel === 'gruen' &&
      e.tiefenAnalyse &&
      e.score < MIN_SCORE_KAUF_GRUEN,
  )
  const watchlistZuNiedrig = alle.filter(
    (e) =>
      istWatchlistKandidat(e.isin) &&
      e.tiefenAnalyse &&
      e.score < MIN_SCORE_WATCHLIST_NEUKAUF,
  )
  const gelbMitTrigger = alle.filter(
    (e) =>
      !istWatchlistKandidat(e.isin) &&
      e.ampel === 'gelb' &&
      e.kaufTriggerAusgeloest &&
      !e.tiefenAnalyse,
  )
  const verkaufHinweis =
    beobachtung.length > 0
      ? `Keine Euro-Verkaufs-Allokation; Qualitäts-Beobachtung aktiv: ${beobachtung
          .map((e) => e.ticker)
          .join(', ')}. `
      : 'Keine Teil-/Vollverkaufs-Signale. '
  let text =
    'Keine Kauf-Kandidaten für Stufe C: ' +
    kaufSchwellenText() +
    '. ' +
    verkaufHinweis +
    String(budgetEur) +
    ' € auf Trade Republic sparen (2,25 % p.a.).'
  if (gruenOhneDr.length > 0) {
    text +=
      ' Hinweis: ' +
      gruenOhneDr.map((e) => e.ticker).join(', ') +
      ' ist/sind grün im Scan — Deep Research fehlt noch.'
  } else if (watchlistZuNiedrig.length > 0) {
    text +=
      ' Hinweis: Watchlist ' +
      watchlistZuNiedrig
        .map((e) => `${e.ticker} (Score ${e.score} < ${MIN_SCORE_WATCHLIST_NEUKAUF})`)
        .join(', ') +
      ' — Neukauf-Hürde noch nicht erreicht.'
  } else if (gruenScoreZuNiedrig.length > 0) {
    text +=
      ' Hinweis: ' +
      gruenScoreZuNiedrig
        .map((e) => `${e.ticker} (grün, Score ${e.score} < ${MIN_SCORE_KAUF_GRUEN})`)
        .join(', ') +
      ' — für Stufe C noch zu schwach.'
  } else if (gelbMitTrigger.length > 0) {
    text +=
      ' Hinweis: ' +
      gelbMitTrigger.map((e) => e.ticker).join(', ') +
      ' hat Kaufzone, aber Deep Research oder Score fehlt.'
  }
  return text
}

function risikoKlasseVon(isin: string): RisikoKlasse {
  return risikoKlasseFuerIsin(isin)
}

/** Watchlist-Kandidaten stehen nicht in der festen Whitelist → Kauf wäre ein Neukauf. */
export function istWatchlistKandidat(isin: string): boolean {
  return !istWhitelistIsin(isin)
}

// ---------------------------------------------------------------------------
// Kontext-Builder
// ---------------------------------------------------------------------------

function formatKaufhistorie(e: NachkaufScanEintrag): string {
  const kh = e.kaufhistorie
  if (!kh || kh.anzahlKaeufe === 0) return 'Noch nie gekauft'
  const teile: string[] = [`${kh.anzahlKaeufe}× gekauft`]
  if (kh.tageSeitletztemKauf != null) teile.push(`letzter Kauf vor ${kh.tageSeitletztemKauf} Tagen`)
  if (kh.durchschnittskaufpreisEur != null) teile.push(`Ø ${kh.durchschnittskaufpreisEur.toFixed(2)} €`)
  return teile.join(', ')
}

function kuerzerMemo(memo: string): string {
  // Kürze auf ca. 800 Zeichen um Token-Budget zu schonen
  if (memo.length <= 900) return memo
  const idx = memo.indexOf('\n\n', 700)
  return idx > 0 ? memo.slice(0, idx) + '\n\n[…gekürzt]' : memo.slice(0, 900) + ' […]'
}

function baueKandidatenText(kandidaten: NachkaufScanEintrag[], budgetEur: number): string {
  return kandidaten.map((e) => {
    const dr = e.tiefenAnalyse
    const premium = e.bewertung.premiumDiscountPct != null
      ? `${e.bewertung.premiumDiscountPct > 0 ? '+' : ''}${e.bewertung.premiumDiscountPct.toFixed(0)}% vs. hist. Median`
      : 'keine Vergleichsdaten'
    const trigger = e.kaufTriggerAusgeloest
      ? `✓ Kaufzone: ${e.kaufTriggerText ?? 'ausgelöst'}`
      : '– Kaufzone nicht ausgelöst'
    const klumpen = e.klumpenrisiko
      ? `⚠️ Klumpenrisiko (${e.depotGewichtPct?.toFixed(1) ?? '?'}% des Depots)`
      : `Depot-Anteil: ${e.depotGewichtPct?.toFixed(1) ?? '?'}%`
    const insider = e.insiderKaeufe?.length > 0
      ? `${e.insiderKaeufe.length} Insider-Käufe in letzten 90 Tagen`
      : 'keine Insider-Käufe'
    const risiko = risikoKlasseVon(e.isin)
    const risikoLabel = RISIKO_LABEL[risiko]
    const maxBetrag = e.klumpenrisiko
      ? Math.min(Math.min(RISIKO_CAP[risiko], budgetEur), Math.round(budgetEur * 0.2))
      : Math.min(RISIKO_CAP[risiko], budgetEur)

    const prognose =
      e.datenSignale?.prognoseProfil && e.datenSignale.prognoseProfil.anzahlJahre >= 2
        ? `Prognose (FY0–2027): ${e.datenSignale.prognoseProfil.zusammenfassung}`
        : ''
    const struktur = e.datenSignale?.segmentStrukturKontext
      ? `Geschäftsstruktur:\n${e.datenSignale.segmentStrukturKontext}`
      : ''

    const neukaufHinweis = istWatchlistKandidat(e.isin)
      ? '⚠️ WATCHLIST-KANDIDAT — noch NICHT im Depot: Kauf wäre ein NEUKAUF (neue Position). Höhere Hürde als Nachkauf: nur bei klar besserem Chance/Risiko als bestehende Kandidaten.'
      : ''

    return [
      `### ${e.ticker} – ${e.name}`,
      neukaufHinweis,
      `Score: ${e.score}/100 | Ampel: ${e.ampel} | ${trigger}`,
      `Risikoklasse: **${risikoLabel}** | Max. Einzelkauf diesen Monat: ${maxBetrag} €`,
      `Bewertung: ${premium} | FCF-Yield: ${e.bewertung.fcfYieldPct?.toFixed(1) ?? '?'}% | Fwd-KGV: ${e.bewertung.forwardPe?.toFixed(1) ?? '?'} | EV/EBITDA: ${e.bewertung.ntmEvEbitda?.toFixed(1) ?? '?'}× (5J-Med ${e.bewertung.historischerMedianEvEbitda?.toFixed(1) ?? '?'}) | EV/Umsatz: ${e.bewertung.ntmEvRev?.toFixed(1) ?? '?'}×`,
      klumpen,
      `Kaufhistorie: ${formatKaufhistorie(e)}`,
      insider,
      e.notiz ? `Eigene Notiz: ${e.notiz}` : '',
      e.disziplinHinweis ? `Disziplin: ${e.disziplinHinweis}` : '',
      prognose,
      struktur,
      '',
      dr ? `**Deep Research Kernaussagen:**\n${kuerzerMemo(dr.memo)}` : '_Kein Deep Research vorhanden_',
    ].filter(Boolean).join('\n')
  }).join('\n\n---\n\n')
}

// ---------------------------------------------------------------------------
// Prompt
// ---------------------------------------------------------------------------

function baueVerkaufKandidatenText(kandidaten: NachkaufScanEintrag[]): string {
  if (kandidaten.length === 0) return '_Keine Teil-/Vollverkaufs-Kandidaten (Euro-Allokation)._'

  return kandidaten.map((e) => {
    const ts = e.trimSignal!
    const dr = e.tiefenAnalyse
    const premium = e.bewertung.premiumDiscountPct != null
      ? `${e.bewertung.premiumDiscountPct > 0 ? '+' : ''}${e.bewertung.premiumDiscountPct.toFixed(0)}% vs. hist. Median`
      : 'keine Vergleichsdaten'
    const faktoren = ts.faktoren.map((f) => `  - [${f.kategorie}] ${f.text}`).join('\n')

    return [
      `### ${e.ticker} – ${e.name}`,
      `Aktion: **${ts.aktion}** | Dringlichkeit: ${ts.dringlichkeit} | Priorität: ${ts.prioritaet}/100`,
      ts.verkaufAnteilPct != null
        ? `Empfohlener Verkauf: ~${ts.verkaufAnteilPct} % der Position (Ziel: ${ts.zielDepotGewichtPct?.toFixed(1) ?? '?'} % Depot)`
        : 'Kein konkreter Verkaufsanteil — nur Überprüfung',
      `Score: ${e.score}/100 | Ampel: ${e.ampel} | Depot-Anteil: ${e.depotGewichtPct?.toFixed(1) ?? '?'}%`,
      `Bewertung: ${premium} | FCF-Yield: ${e.bewertung.fcfYieldPct?.toFixed(1) ?? '?'}% | Fwd-KGV: ${e.bewertung.forwardPe?.toFixed(1) ?? '?'} | EV/EBITDA: ${e.bewertung.ntmEvEbitda?.toFixed(1) ?? '?'}× (5J-Med ${e.bewertung.historischerMedianEvEbitda?.toFixed(1) ?? '?'}) | EV/Umsatz: ${e.bewertung.ntmEvRev?.toFixed(1) ?? '?'}×`,
      `Sell-Trigger: ${e.sellTriggerOk ? 'OK' : 'AKTIV'} | Mantra: ${e.mantraScorePct?.toFixed(0) ?? '?'}%`,
      e.datenSignale?.prognoseProfil && e.datenSignale.prognoseProfil.anzahlJahre >= 2
        ? `Prognose: ${e.datenSignale.prognoseProfil.zusammenfassung}`
        : '',
      '',
      '**Regelbasierte Faktoren:**',
      faktoren,
      '',
      dr ? `**Deep Research Kernaussagen:**\n${kuerzerMemo(dr.memo)}` : '_Kein Deep Research — nur regelbasierte Signale_',
    ].join('\n')
  }).join('\n\n---\n\n')
}

function baueBeobachtungsKandidatenText(kandidaten: NachkaufScanEintrag[]): string {
  if (kandidaten.length === 0) return '_Keine aktiven Qualitäts-Beobachtungen._'

  return kandidaten.map((e) => {
    const ts = e.trimSignal!
    const faktoren = ts.faktoren.map((f) => `  - [${f.kategorie}] ${f.text}`).join('\n')
    return [
      `### ${e.ticker} – ${e.name}`,
      `Aktion: **ueberpruefen** (kein Euro-Verkauf) | Dringlichkeit: ${ts.dringlichkeit} | Priorität: ${ts.prioritaet}/100`,
      `Score: ${e.score}/100 | Ampel: ${e.ampel} | Depot-Anteil: ${e.depotGewichtPct?.toFixed(1) ?? '?'}%`,
      `Sell-Trigger: ${e.sellTriggerOk ? 'OK' : 'AKTIV'} | Mantra: ${e.mantraScorePct?.toFixed(0) ?? '?'}%`,
      ts.grund ? `Grund: ${ts.grund}` : '',
      '',
      '**Faktoren:**',
      faktoren || '  - (keine)',
    ]
      .filter(Boolean)
      .join('\n')
  }).join('\n\n---\n\n')
}

function bauePrompt(
  kandidaten: NachkaufScanEintrag[],
  verkaufKandidaten: NachkaufScanEintrag[],
  beobachtungsKandidaten: NachkaufScanEintrag[],
  basisAllokation: SparplanPosten[],
  basisVerkauf: VerkaufPosten[],
  budgetEur: number,
): string {
  const basisText = basisAllokation.length > 0
    ? basisAllokation.map((p) => `  • ${p.ticker}: ${p.betragEur} € (${p.begruendung})`).join('\n')
    : '  • Regelbasiert: kein Kauf empfohlen'
  const capKonservativ = Math.min(RISIKO_CAP.konservativ, budgetEur)
  const capModerat = Math.min(RISIKO_CAP.moderat, budgetEur)
  const capSpekulativ = Math.min(RISIKO_CAP.spekulativ, budgetEur)
  const klumpenCap = Math.round(budgetEur * 0.2)

  const basisVerkaufText = basisVerkauf.length > 0
    ? basisVerkauf.map((p) => `  • ${p.ticker}: ~${p.verkaufAnteilPct} % verkaufen (${p.dringlichkeit}) — ${p.begruendung}`).join('\n')
    : '  • Regelbasiert: kein Euro-Verkauf empfohlen'

  return `Du bist ein rationaler Investment-Assistent für einen **langfristigen** Quality-Investor.
Ziel: Markt outperformen durch disziplinierte Kapitalallokation — nicht durch häufiges Trading.

## Aufgabe
1. Erkläre und prüfe die **regelbasierte Euro-Allokation** unten — die Beträge sind verbindlich.
2. Bewerte Verkaufs-Hinweise — aber **übertreibe nicht**: Default ist Halten.
3. Nenne Qualitäts-Beobachtungen explizit (WM/UNP/ATD-ähnlich) — **nicht** behaupten „keine Verkaufs-Kandidaten“, wenn Beobachtungen existieren.

## Rahmenbedingungen (WICHTIG)
- **Die Euro-Beträge der Basis-Allokation sind FIX.** Du darfst Positionen nur **streichen oder kürzen** (und den Rest als „Gespart“ ausweisen), niemals Beträge erhöhen oder umverteilen.
- **Langfrist-Horizont**: Jahre, nicht Monate. Verkäufe sind die Ausnahme, nicht die Regel.
- **Halten ist der Default**: Auch bei hoher Bewertung oder kurzfristig schwachem Score nicht reflexartig verkaufen.
- Verkäufe/Teilverkäufe nur bei **kombinierter, klarer Evidenz** (z. B. Klumpenrisiko + teure Bewertung, oder Sell-Trigger-Warnung + Score-Verfall).
- **aktion „ueberpruefen“** = Beobachtung/These prüfen, **kein** Verkaufsauftrag. Im Text: „Beobachten“ + warum — nicht „Gesamtdepot: Halten“ ohne Erwähnung.
- Kein Zwangskauf: Wenn die Basis-Allokation leer ist oder Chance/Risiko schwach → sparen (Trade Republic 2,25 % p.a.)
- Teilverkäufe: typisch 10–25 % der Position, nicht mehr — Rest langfristig halten
- Vollverkauf: nur wenn die Investmenthypothese fundamental gebrochen ist (Sell-Trigger-Warnung + sehr niedriger Score)
- Emotionslos: weder Panik-Verkauf noch FOMO-Kauf
- Klumpenrisiko-Grenze beim Nachkauf: ≥15 % Depotanteil maximal ${klumpenCap} € zusätzlich
- Mindestbetrag pro Kauf: 100 €
- **Watchlist-Kandidaten** (als solche markiert) sind noch nicht im Depot: Ein Kauf eröffnet eine NEUE Position. Cap spekulativ (≤ ${capSpekulativ} €). Score-Hürde ≥ ${MIN_SCORE_WATCHLIST_NEUKAUF}. Bevorzuge bestehende Whitelist-Positionen bei vergleichbarem Chance/Risiko.

## Risiko-adjustierte Positionsobergrenzen (HART, nicht überschreiten)
- **Konservativ**: max. **${capKonservativ} €** — Mastercard, Visa, Microsoft, …
- **Moderat**: max. **${capModerat} €** — ASML, UnitedHealth, Wolters Kluwer, …
- **Spekulativ**: max. **${capSpekulativ} €** — Balchem, Datadog

## Regelbasierte Basis-Allokation (Käufe)
${basisText}

## Regelbasierte Verkaufs-Hinweise (Euro — selten, nur klare Fälle)
${basisVerkaufText}

## Verkaufs-Kandidaten Teil-/Vollverkauf (kritisch prüfen, nicht automatisch umsetzen)

${baueVerkaufKandidatenText(verkaufKandidaten)}

## Qualitäts-Beobachtung (ueberpruefen — kein Euro-Verkauf, aber erwähnen!)

${baueBeobachtungsKandidatenText(beobachtungsKandidaten)}

## Kauf-Kandidaten mit Deep Research (${kaufSchwellenText()})

${baueKandidatenText(kandidaten, budgetEur)}

---

## Deine Ausgabe

Beantworte folgende Punkte **auf Deutsch**:

**1. Gesamtbewertung:** Marktlage + gibt es ernsthafte Verkaufsfälle oder Beobachtungen? (2–3 Sätze). Wenn Beobachtungen existieren: nenne die Ticker — nicht „keine Verkaufs-Kandidaten / Gesamtdepot Halten“ ohne sie.

**2. Positions-Bewertung (Verkauf/Halten/Beobachten):**
Für jeden Verkaufs- und Beobachtungs-Kandidaten: Halten, Beobachten, optional Teilverkauf (wie viel %), oder Vollverkauf — und warum.
Wenn die Evidenz für Verkauf nicht ausreicht: explizit **Beobachten** oder **Halten** empfehlen und begründen.
Format:
- TICKER: Halten / Beobachten / ~XX % Teilverkauf / Vollverkauf prüfen — Begründung

**3. Kauf-Kommentar:**
Für jede Position der Basis-Allokation: übernehmen, kürzen oder streichen — mit Deep-Research-Bezug. Keine neuen Euro-Beträge erfinden.

**4. Verbindliche Kauf-Allokation (nur ≤ Basis-Beträge):**
- TICKER (Risikoklasse): XXX € — Begründung
- Gespart: XXX € (Begründung)

**5. Wichtigste Warnung:** Kritischster Risikofaktor.

Sei direkt, aber **nicht verkaufs-biased**. Ein Langfrist-Investor verkauft selten. Euro-Zahlen kommen aus den Regeln, nicht aus deiner Kreativität.`
}

// ---------------------------------------------------------------------------
// Hauptfunktion
// ---------------------------------------------------------------------------

export type KaufempfehlungErgebnis = {
  ok: boolean
  kandidatenAnzahl: number
  verkaufKandidatenAnzahl: number
  basisAllokation: SparplanPosten[]
  basisVerkaufAllokation: VerkaufPosten[]
  kiEmpfehlungText: string
  /** Geparstes Ergebnis für die UI-Karte */
  monatsEmpfehlung: MonatsEmpfehlung
  erstellt_am: string
  fehler?: string
}

export async function generiereKaufempfehlung(
  alleErgebnisse: NachkaufScanEintrag[],
  budgetEur: number = DEFAULT_BUDGET_EUR,
): Promise<KaufempfehlungErgebnis> {
  const jetzt = new Date().toISOString()

  // Verkaufs-/Beobachtungs-Kandidaten (unabhängig von Kauf-Score)
  const verkaufKandidaten = filterVerkaufKandidaten(alleErgebnisse)
  const beobachtungsKandidaten = filterBeobachtungsKandidaten(alleErgebnisse)
  const basisVerkaufAllokation = berechneBasisVerkaufAllokation(alleErgebnisse)

  // Kauf-Kandidaten = dieselben Top-N Grün wie Radar-Banner (kein Drift zu Extra-Titeln).
  // Score-/DR-Filter nur als Hinweis im Prompt; Euro-Basis bleibt die Monats-Liste.
  const monatsKandidaten = waehleMonatsNachkaufKandidaten(alleErgebnisse)
  const kandidaten = monatsKandidaten.filter(istKiKaufKandidat)
  const allokationQuelle = kandidaten.length > 0 ? kandidaten : monatsKandidaten

  // Fallback ohne KI wenn weder Käufe noch Verkäufe noch Beobachtungen
  if (
    allokationQuelle.length === 0 &&
    verkaufKandidaten.length === 0 &&
    beobachtungsKandidaten.length === 0
  ) {
    const sparText = baueSparHinweis(alleErgebnisse, budgetEur, beobachtungsKandidaten)
    const sparen: MonatsEmpfehlung = { typ: 'sparen', text: sparText }
    return {
      ok: true,
      kandidatenAnzahl: 0,
      verkaufKandidatenAnzahl: 0,
      basisAllokation: [],
      basisVerkaufAllokation: [],
      kiEmpfehlungText: sparen.text,
      monatsEmpfehlung: sparen,
      erstellt_am: jetzt,
    }
  }

  // Nur Verkäufe/Beobachtung, keine Käufe — trotzdem KI-Synthese
  if (allokationQuelle.length === 0) {
    const prompt = bauePrompt(
      [],
      verkaufKandidaten,
      beobachtungsKandidaten,
      [],
      basisVerkaufAllokation,
      budgetEur,
    )
    const kiText = await rufeKiAuf(prompt)
    return {
      ok: true,
      kandidatenAnzahl: 0,
      verkaufKandidatenAnzahl: verkaufKandidaten.length,
      basisAllokation: [],
      basisVerkaufAllokation,
      kiEmpfehlungText: kiText.text,
      monatsEmpfehlung: { typ: 'beobachten', text: kiText.text },
      erstellt_am: jetzt,
      fehler: kiText.fehler,
    }
  }

  // Regelbasierte Basis-Allokation (verbindliche Euro-Beträge) — identisch zum Radar-Banner
  const basisAllokation = berechneRegelAllokation(allokationQuelle, budgetEur)

  // Gemini-Synthese (Käufe + Verkäufe + Beobachtung) — KI darf nur kürzen/streichen, nicht erhöhen/erweitern
  const prompt = bauePrompt(
    allokationQuelle,
    verkaufKandidaten,
    beobachtungsKandidaten,
    basisAllokation,
    basisVerkaufAllokation,
    budgetEur,
  )
  const kiResult = await rufeKiAuf(prompt)
  let kiText = kiResult.text
  const fehler = kiResult.fehler

  if (!kiText?.trim()) {
    const verkaufTeil = basisVerkaufAllokation.length > 0
      ? '\n\nRegelbasierte Verkäufe:\n' +
        basisVerkaufAllokation.map((p) => `• ${p.ticker}: ~${p.verkaufAnteilPct} % — ${p.begruendung}`).join('\n')
      : ''
    kiText = `[KI-Synthese fehlgeschlagen${fehler ? ': ' + fehler : ''}]\n\nRegelbasierte Käufe:\n` +
      basisAllokation.map((p) => `• ${p.ticker}: ${p.betragEur} € — ${p.begruendung}`).join('\n') +
      verkaufTeil
  }

  // MonatsEmpfehlung aus KI-Text + Basis-Allokation bauen
  const monatsEmpfehlung: MonatsEmpfehlung = basisAllokation.length > 0
    ? {
        typ: 'nachkauf',
        tickers: allokationQuelle.map((e) => e.ticker),
        text: kiText,
        sparplanAllokation: basisAllokation,
      }
    : basisVerkaufAllokation.length > 0
      ? { typ: 'beobachten', text: kiText }
      : { typ: 'sparen', text: kiText }

  return {
    ok: !fehler,
    kandidatenAnzahl: allokationQuelle.length,
    verkaufKandidatenAnzahl: verkaufKandidaten.length,
    basisAllokation,
    basisVerkaufAllokation,
    kiEmpfehlungText: kiText,
    monatsEmpfehlung,
    erstellt_am: jetzt,
    fehler,
  }
}

async function rufeKiAuf(prompt: string): Promise<{ text: string; fehler?: string }> {
  let kiText = ''
  let fehler: string | undefined

  const provider = resolveCoachProviderFromMode('gemini')
  if (!provider || provider.provider !== 'gemini') {
    fehler = 'Kein Gemini-API-Key konfiguriert.'
  } else {
    try {
      const result = await runCoachCompletion(
        provider.provider,
        provider.apiKey,
        'Du bist ein rationaler Investmentassistent für Langfrist-Investoren. Antworte auf Deutsch. Verkäufe sind selten — Halten ist der Default.',
        [{ role: 'user', content: prompt }],
        {
          temperature: 0.3,
          skipMessageTrim: true,
          geminiForcePaidApiKey: true,
          geminiModels: geminiProPaidModelKandidaten({
            primaryEnvKeys: [
              'NACHKAUF_KAUFEMPFEHLUNG_GEMINI_MODEL',
              'NACHKAUF_DEEP_RESEARCH_GEMINI_MODEL',
            ],
          }),
        },
      )
      if (result.ok && result.reply?.trim()) {
        kiText = result.reply.trim()
      } else if (!result.ok) {
        fehler = result.hint ?? 'Unbekannter Fehler'
      }
    } catch (e) {
      fehler = e instanceof Error ? e.message : String(e)
    }
  }

  return { text: kiText, fehler }
}
