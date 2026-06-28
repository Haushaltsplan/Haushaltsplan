/**
 * Nachkauf-Radar — KI-gestützte Kaufempfehlung (Stufe C).
 *
 * Nimmt alle Scan-Ergebnisse mit Score ≥ 90 + vorhandener Deep Research,
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
import type { NachkaufScanEintrag, MonatsEmpfehlung, SparplanPosten } from './nachkauf-radar-types'

const DEFAULT_BUDGET_EUR = 500
const MIN_SCORE_FUER_KI_EMPFEHLUNG = 90

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

/** Risikoklasse aus der Whitelist anhand ISIN abrufen — Fallback: moderat. */
function risikoKlasseVon(isin: string): RisikoKlasse {
  return NACHKAUF_RADAR_WHITELIST.find((p) => p.isin === isin)?.risikoKlasse ?? 'moderat'
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

    return [
      `### ${e.ticker} – ${e.name}`,
      `Score: ${e.score}/100 | Ampel: ${e.ampel} | ${trigger}`,
      `Risikoklasse: **${risikoLabel}** | Max. Einzelkauf diesen Monat: ${maxBetrag} €`,
      `Bewertung: ${premium} | FCF-Yield: ${e.bewertung.fcfYieldPct?.toFixed(1) ?? '?'}% | Fwd-KGV: ${e.bewertung.forwardPe?.toFixed(1) ?? '?'}`,
      klumpen,
      `Kaufhistorie: ${formatKaufhistorie(e)}`,
      insider,
      '',
      dr ? `**Deep Research Kernaussagen:**\n${kuerzerMemo(dr.memo)}` : '_Kein Deep Research vorhanden_',
    ].join('\n')
  }).join('\n\n---\n\n')
}

// ---------------------------------------------------------------------------
// Prompt
// ---------------------------------------------------------------------------

function bauePrompt(kandidaten: NachkaufScanEintrag[], basisAllokation: SparplanPosten[], budgetEur: number): string {
  const basisText = basisAllokation.length > 0
    ? basisAllokation.map((p) => `  • ${p.ticker}: ${p.betragEur} € (${p.begruendung})`).join('\n')
    : '  • Regelbasiert: kein Kauf empfohlen'
  const capKonservativ = Math.min(RISIKO_CAP.konservativ, budgetEur)
  const capModerat = Math.min(RISIKO_CAP.moderat, budgetEur)
  const capSpekulativ = Math.min(RISIKO_CAP.spekulativ, budgetEur)
  const klumpenCap = Math.round(budgetEur * 0.2)

  return `Du bist ein rationaler, emotionsfreier Investment-Assistent für einen Quality-Investor.

## Aufgabe
Verteile das Monatsbudget von **${budgetEur} €** auf die nachstehenden Kandidaten — oder empfehle ausdrücklich zu sparen.

## Rahmenbedingungen
- Investitionsphilosophie: Langfristiges Quality-Investing in profitable Qualitätsunternehmen
- Kein Zwangskauf: Wenn kein gutes Chancen-Risiko-Verhältnis vorliegt → sparen (Trade Republic zahlt 2,25 % p.a.)
- Klumpenrisiko-Grenze: Positionen mit ≥15 % Depotanteil maximal ${klumpenCap} € zusätzlich investieren
- Mindestbetrag pro Position: 100 € (sonst unwirtschaftlich)
- Budget kann teilweise gespart werden — Restbetrag wird benannt

## Risiko-adjustierte Positionsobergrenzen (HART, nicht überschreiten)
Jede Position hat eine Risikoklasse, die den maximalen monatlichen Investitionsbetrag begrenzt:
- **Konservativ** (Oligopole, rezessionssichere Large Caps): max. **${capKonservativ} €** — z.B. Mastercard, Visa, Microsoft, Alphabet, McDonald's
- **Moderat** (gute Qualität, aber spezifische Risiken wie Regulierung, KI-Disruption, Zyklizität): max. **${capModerat} €** — z.B. ASML, UnitedHealth, Wolters Kluwer, ServiceNow
- **Spekulativ** (Small/Mid-Cap oder sehr hohe Bewertungen mit erhöhter Volatilität): max. **${capSpekulativ} €** — z.B. Balchem, Datadog

Die Risikoklasse jedes Kandidaten ist unten angegeben. Du **musst** diese Obergrenzen einhalten — unabhängig von Score oder Trigger.

## Regelbasierte Basis-Allokation (nur Score/Trigger/Klumpen)
${basisText}

## Kandidaten mit Deep Research (Score ≥ ${MIN_SCORE_FUER_KI_EMPFEHLUNG})

${baueKandidatenText(kandidaten, budgetEur)}

---

## Deine Ausgabe

Beantworte folgende Punkte **auf Deutsch**:

**1. Gesamtbewertung:** Ist der Markt aktuell für Käufe geeignet? (2–3 Sätze)

**2. Kandidaten-Ranking mit Begründung:**
Für jeden Kandidaten: Kaufen (wie viel €, unter Berücksichtigung seiner Risikoklasse) oder überspringen — und warum (insbesondere auf Basis des Deep Research). Begründe bei Spekulativ/Moderat explizit, warum das Chancen-Risiko-Verhältnis den niedrigeren Cap rechtfertigt oder nicht.

**3. Finale Allokation:**
Liste im Format:
- TICKER (Risikoklasse): XXX € — Begründung in einem Satz
- TICKER (Risikoklasse): XXX € — Begründung in einem Satz
- Gespart: XXX € (Begründung)

**4. Wichtigste Warnung:** Was ist der kritischste Risikofaktor der Gesamtempfehlung?

Sei direkt und konkret. Kein Bullshit, kein Optimismus-Bias. Wenn du nicht kaufen würdest, sag es klar.`
}

// ---------------------------------------------------------------------------
// Hauptfunktion
// ---------------------------------------------------------------------------

export type KaufempfehlungErgebnis = {
  ok: boolean
  kandidatenAnzahl: number
  basisAllokation: SparplanPosten[]
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

  // Kandidaten: Score ≥ 90, Ampel nicht rot, kein aktives Trim-Signal, Deep Research vorhanden
  const kandidaten = alleErgebnisse
    .filter((e) =>
      e.score >= MIN_SCORE_FUER_KI_EMPFEHLUNG &&
      e.ampel !== 'rot' &&
      !e.trimSignal &&
      e.tiefenAnalyse != null,
    )
    .sort((a, b) => {
      // Priorisiere: Trigger > Score > Nicht-Klumpen
      if (a.kaufTriggerAusgeloest !== b.kaufTriggerAusgeloest) return a.kaufTriggerAusgeloest ? -1 : 1
      if (a.klumpenrisiko !== b.klumpenrisiko) return a.klumpenrisiko ? 1 : -1
      return b.score - a.score
    })

  // Regelbasierte Basis-Allokation
  const basisAllokation = berechneBasisAllokation(kandidaten, budgetEur)

  // Fallback ohne KI wenn keine Kandidaten
  if (kandidaten.length === 0) {
    const scoreMin = String(MIN_SCORE_FUER_KI_EMPFEHLUNG)
    const budgetStr = String(budgetEur)
    const sparText =
      'Keine Positionen mit Score \u2265 ' + scoreMin +
      ' und Deep Research gefunden. ' + budgetStr +
      ' \u20AC auf Trade Republic sparen (2,25\u00A0%\u00A0p.a.).'
    const sparen: MonatsEmpfehlung = { typ: 'sparen', text: sparText }
    return {
      ok: true,
      kandidatenAnzahl: 0,
      basisAllokation: [],
      kiEmpfehlungText: sparen.text,
      monatsEmpfehlung: sparen,
      erstellt_am: jetzt,
    }
  }

  // Gemini-Synthese
  const prompt = bauePrompt(kandidaten, basisAllokation, budgetEur)
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
        'Du bist ein rationaler Investmentassistent. Antworte immer auf Deutsch. Sei direkt, ehrlich und kritisch.',
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

  if (!kiText?.trim()) {
    kiText = `[KI-Synthese fehlgeschlagen${fehler ? ': ' + fehler : ''}]\n\nRegelbasierte Basis:\n` +
      basisAllokation.map((p) => `• ${p.ticker}: ${p.betragEur} € — ${p.begruendung}`).join('\n')
  }

  // MonatsEmpfehlung aus KI-Text + Basis-Allokation bauen
  const monatsEmpfehlung: MonatsEmpfehlung = basisAllokation.length > 0
    ? {
        typ: 'nachkauf',
        tickers: kandidaten.map((e) => e.ticker),
        text: kiText,
        sparplanAllokation: basisAllokation,
      }
    : { typ: 'sparen', text: kiText }

  return {
    ok: !fehler,
    kandidatenAnzahl: kandidaten.length,
    basisAllokation,
    kiEmpfehlungText: kiText,
    monatsEmpfehlung,
    erstellt_am: jetzt,
    fehler,
  }
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
