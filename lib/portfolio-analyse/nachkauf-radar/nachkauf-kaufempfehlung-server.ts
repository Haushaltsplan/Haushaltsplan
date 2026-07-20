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
import { NACHKAUF_RADAR_WHITELIST, type RisikoKlasse } from './nachkauf-radar-whitelist'
import type { NachkaufScanEintrag, MonatsEmpfehlung, SparplanPosten, VerkaufPosten } from './nachkauf-radar-types'
import {
  berechneBasisVerkaufAllokation,
  filterVerkaufKandidaten,
} from './nachkauf-trim-signal'
import { disziplinSparplanFaktor } from './nachkauf-disziplin-server'

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
 */
export function istKiKaufKandidat(e: NachkaufScanEintrag): boolean {
  if (e.ampel === 'rot' || e.ampel === 'teuer' || hatAktivesVerkaufSignal(e) || !e.tiefenAnalyse) {
    return false
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
    `Grün + Score ≥ ${MIN_SCORE_KAUF_GRUEN}, oder Kaufzone + Gelb + Score ≥ ${MIN_SCORE_KAUF_TRIGGER}` +
    ` (jeweils mit Deep Research)`
  )
}

function baueSparHinweis(alle: NachkaufScanEintrag[], budgetEur: number): string {
  const gruenOhneDr = alle.filter((e) => e.ampel === 'gruen' && !e.tiefenAnalyse)
  const gruenScoreZuNiedrig = alle.filter(
    (e) => e.ampel === 'gruen' && e.tiefenAnalyse && e.score < MIN_SCORE_KAUF_GRUEN,
  )
  const gelbMitTrigger = alle.filter(
    (e) => e.ampel === 'gelb' && e.kaufTriggerAusgeloest && !e.tiefenAnalyse,
  )
  let text =
    'Keine Kauf-Kandidaten für Stufe C: ' +
    kaufSchwellenText() +
    '. Keine Verkaufs-Signale. ' +
    String(budgetEur) +
    ' € auf Trade Republic sparen (2,25 % p.a.).'
  if (gruenOhneDr.length > 0) {
    text +=
      ' Hinweis: ' +
      gruenOhneDr.map((e) => e.ticker).join(', ') +
      ' ist/sind grün im Scan — Deep Research fehlt noch.'
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
  return NACHKAUF_RADAR_WHITELIST.find((p) => p.isin === isin)?.risikoKlasse ?? 'moderat'
}

/** Watchlist-Kandidaten stehen nicht in der festen Whitelist → Kauf wäre ein Neukauf. */
function istWatchlistKandidat(isin: string): boolean {
  return !NACHKAUF_RADAR_WHITELIST.some((p) => p.isin === isin)
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
      `Bewertung: ${premium} | FCF-Yield: ${e.bewertung.fcfYieldPct?.toFixed(1) ?? '?'}% | Fwd-KGV: ${e.bewertung.forwardPe?.toFixed(1) ?? '?'}`,
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
  if (kandidaten.length === 0) return '_Keine Verkaufs-Kandidaten identifiziert._'

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
      `Bewertung: ${premium} | FCF-Yield: ${e.bewertung.fcfYieldPct?.toFixed(1) ?? '?'}% | Fwd-KGV: ${e.bewertung.forwardPe?.toFixed(1) ?? '?'}`,
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

function bauePrompt(
  kandidaten: NachkaufScanEintrag[],
  verkaufKandidaten: NachkaufScanEintrag[],
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
    : '  • Regelbasiert: kein Verkauf empfohlen'

  return `Du bist ein rationaler Investment-Assistent für einen **langfristigen** Quality-Investor.
Ziel: Markt outperformen durch disziplinierte Kapitalallokation — nicht durch häufiges Trading.

## Aufgabe
1. Verteile das Monatsbudget von **${budgetEur} €** auf Kauf-Kandidaten — oder empfehle zu sparen.
2. Bewerte oben genannte Verkaufs-Hinweise — aber **übertreibe nicht**: Default ist Halten.

## Rahmenbedingungen (WICHTIG)
- **Langfrist-Horizont**: Jahre, nicht Monate. Verkäufe sind die Ausnahme, nicht die Regel.
- **Halten ist der Default**: Auch bei hoher Bewertung oder kurzfristig schwachem Score nicht reflexartig verkaufen.
- Verkäufe/Teilverkäufe nur bei **kombinierter, klarer Evidenz** (z. B. Klumpenrisiko + teure Bewertung, oder Sell-Trigger-Warnung + Score-Verfall).
- Kein Zwangskauf: Wenn kein gutes Chancen-Risiko-Verhältnis → sparen (Trade Republic 2,25 % p.a.)
- Teilverkäufe: typisch 10–25 % der Position, nicht mehr — Rest langfristig halten
- Vollverkauf: nur wenn die Investmenthypothese fundamental gebrochen ist (Sell-Trigger-Warnung + sehr niedriger Score)
- Emotionslos: weder Panik-Verkauf noch FOMO-Kauf
- Klumpenrisiko-Grenze beim Nachkauf: ≥15 % Depotanteil maximal ${klumpenCap} € zusätzlich
- Mindestbetrag pro Kauf: 100 €
- **Watchlist-Kandidaten** (als solche markiert) sind noch nicht im Depot: Ein Kauf eröffnet eine NEUE Position. Das ist erlaubt, aber die Hürde ist höher — bevorzuge bestehende Positionen bei vergleichbarem Chance/Risiko und begründe einen Neukauf explizit.

## Risiko-adjustierte Positionsobergrenzen (HART, nicht überschreiten)
- **Konservativ**: max. **${capKonservativ} €** — Mastercard, Visa, Microsoft, …
- **Moderat**: max. **${capModerat} €** — ASML, UnitedHealth, Wolters Kluwer, …
- **Spekulativ**: max. **${capSpekulativ} €** — Balchem, Datadog

## Regelbasierte Basis-Allokation (Käufe)
${basisText}

## Regelbasierte Verkaufs-Hinweise (selten — nur klare Fälle)
${basisVerkaufText}

## Verkaufs-Kandidaten (falls vorhanden — kritisch prüfen, nicht automatisch umsetzen)

${baueVerkaufKandidatenText(verkaufKandidaten)}

## Kauf-Kandidaten mit Deep Research (${kaufSchwellenText()})

${baueKandidatenText(kandidaten, budgetEur)}

---

## Deine Ausgabe

Beantworte folgende Punkte **auf Deutsch**:

**1. Gesamtbewertung:** Marktlage + gibt es ernsthafte Verkaufsfälle? (2–3 Sätze, zurückhaltend bei Verkäufen)

**2. Positions-Bewertung (Verkauf/Halten/Beobachten):**
Für jeden Verkaufs-Kandidaten: Halten, optional Teilverkauf (wie viel %), oder Vollverkauf — und warum.
Wenn die Evidenz nicht ausreicht: explizit **Halten** empfehlen und begründen.
Format:
- TICKER: Halten / ~XX % Teilverkauf / Vollverkauf prüfen — Begründung

**3. Kauf-Ranking:**
Kaufen (wie viel €) oder überspringen — mit Deep-Research-Bezug.

**4. Finale Kauf-Allokation:**
- TICKER (Risikoklasse): XXX € — Begründung
- Gespart: XXX € (Begründung)

**5. Wichtigste Warnung:** Kritischster Risikofaktor.

Sei direkt, aber **nicht verkaufs-biased**. Ein Langfrist-Investor verkauft selten.`
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

  // Verkaufs-Kandidaten (unabhängig von Kauf-Score)
  const verkaufKandidaten = filterVerkaufKandidaten(alleErgebnisse)
  const basisVerkaufAllokation = berechneBasisVerkaufAllokation(alleErgebnisse)

  // Kauf-Kandidaten: kalibriertes Grün + Deep Research (Score-Fallback s. istKiKaufKandidat)
  const kandidaten = alleErgebnisse
    .filter(istKiKaufKandidat)
    .sort((a, b) => {
      // Priorisiere: Trigger > Score > Nicht-Klumpen
      if (a.kaufTriggerAusgeloest !== b.kaufTriggerAusgeloest) return a.kaufTriggerAusgeloest ? -1 : 1
      if (a.klumpenrisiko !== b.klumpenrisiko) return a.klumpenrisiko ? 1 : -1
      return b.score - a.score
    })

  // Fallback ohne KI wenn weder Käufe noch Verkäufe
  if (kandidaten.length === 0 && verkaufKandidaten.length === 0) {
    const sparText = baueSparHinweis(alleErgebnisse, budgetEur)
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

  // Nur Verkäufe, keine Käufe — trotzdem KI-Synthese
  if (kandidaten.length === 0) {
    const prompt = bauePrompt([], verkaufKandidaten, [], basisVerkaufAllokation, budgetEur)
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

  // Regelbasierte Basis-Allokation
  const basisAllokation = berechneBasisAllokation(kandidaten, budgetEur)

  // Gemini-Synthese (Käufe + Verkäufe)
  const prompt = bauePrompt(kandidaten, verkaufKandidaten, basisAllokation, basisVerkaufAllokation, budgetEur)
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
        tickers: kandidaten.map((e) => e.ticker),
        text: kiText,
        sparplanAllokation: basisAllokation,
      }
    : basisVerkaufAllokation.length > 0
      ? { typ: 'beobachten', text: kiText }
      : { typ: 'sparen', text: kiText }

  return {
    ok: !fehler,
    kandidatenAnzahl: kandidaten.length,
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
          geminiModels: geminiProPaidModelKandidaten(),
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

// ---------------------------------------------------------------------------
// Regelbasierte Basis-Allokation (intern)
// ---------------------------------------------------------------------------

function berechneBasisAllokation(kandidaten: NachkaufScanEintrag[], budgetEur: number): SparplanPosten[] {
  if (kandidaten.length === 0) return []

  const MAX_KLUMPEN = budgetEur * 0.2
  const MIN_POS = 100

  const gewichte = kandidaten.map((e) => {
    let g = e.score
    if (e.kaufTriggerAusgeloest) g *= 1.25
    if (e.klumpenrisiko) g *= 0.4
    g *= disziplinSparplanFaktor(e)
    // Bewertungsrabatt wirkt als zusätzlicher Bonus
    const disc = e.bewertung.premiumDiscountPct
    if (disc != null && disc < 0) g *= 1 + Math.abs(disc) / 200  // max. +10%
    return { eintrag: e, gewicht: g }
  })

  const summe = gewichte.reduce((acc, gw) => acc + gw.gewicht, 0)
  if (summe <= 0) return []

  const posten: SparplanPosten[] = []
  let rest = budgetEur

  for (const { eintrag, gewicht } of gewichte) {
    const risiko = risikoKlasseVon(eintrag.isin)
    // Risikoklasse begrenzt den Maximalbetrag — Klumpen-Cap greift zusätzlich
    const maxBetrag = eintrag.klumpenrisiko
      ? Math.min(RISIKO_CAP[risiko], MAX_KLUMPEN)
      : RISIKO_CAP[risiko]

    let betrag = (gewicht / summe) * budgetEur
    betrag = Math.min(betrag, maxBetrag)
    betrag = Math.round(betrag / 10) * 10

    if (betrag < MIN_POS) continue
    rest -= betrag

    const teile: string[] = [`Score ${eintrag.score}`, `Risiko: ${risiko}`]
    if (eintrag.kaufTriggerAusgeloest) teile.push('Kaufzone aktiv')
    if (eintrag.klumpenrisiko) teile.push('Klumpen-Cap aktiv')

    posten.push({
      ticker: eintrag.ticker,
      name: eintrag.name,
      betragEur: betrag,
      begruendung: teile.join(' · '),
    })
  }

  // Restbetrag dem besten konservativen Kandidaten ohne Klumpen-Cap gutschreiben
  if (rest >= MIN_POS && posten.length > 0) {
    const konservativIdx = kandidaten.findIndex(
      (e, i) => posten[i] && risikoKlasseVon(e.isin) === 'konservativ' && !e.klumpenrisiko,
    )
    const target = konservativIdx >= 0 ? konservativIdx : 0
    if (posten[target]) {
      const risiko = risikoKlasseVon(kandidaten[target]!.isin)
      posten[target]!.betragEur = Math.min(posten[target]!.betragEur + rest, RISIKO_CAP[risiko])
    }
  }

  return posten
}
