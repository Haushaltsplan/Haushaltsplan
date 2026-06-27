/**
 * Nachkauf-Radar — KI-gestützte Kaufempfehlung (Stufe C).
 *
 * Nimmt alle Scan-Ergebnisse mit Score ≥ 90 + vorhandener Deep Research,
 * kombiniert sie mit der regelbasierten Allokation und lässt Gemini Pro
 * eine finale, begründete Kaufempfehlung für das Monatsbudget erstellen.
 */

import 'server-only'

import { runCoachCompletion, resolveCoachProviderFromMode } from '@/lib/ki-coach-backend'
import type { NachkaufScanEintrag, MonatsEmpfehlung, SparplanPosten } from './nachkauf-radar-types'

const BUDGET_EUR = 500
const MIN_SCORE_FUER_KI_EMPFEHLUNG = 90

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

function baueKandidatenText(kandidaten: NachkaufScanEintrag[]): string {
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

    return [
      `### ${e.ticker} – ${e.name}`,
      `Score: ${e.score}/100 | Ampel: ${e.ampel} | ${trigger}`,
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

function bauePrompt(kandidaten: NachkaufScanEintrag[], basisAllokation: SparplanPosten[]): string {
  const basisText = basisAllokation.length > 0
    ? basisAllokation.map((p) => `  • ${p.ticker}: ${p.betragEur} € (${p.begruendung})`).join('\n')
    : '  • Regelbasiert: kein Kauf empfohlen'

  return `Du bist ein rationaler, emotionsfreier Investment-Assistent für einen Quality-Investor.

## Aufgabe
Verteile das Monatsbudget von **${BUDGET_EUR} €** auf die nachstehenden Kandidaten — oder empfehle ausdrücklich zu sparen.

## Rahmenbedingungen
- Investitionsphilosophie: Langfristiges Quality-Investing in profitable Qualitätsunternehmen
- Kein Zwangskauf: Wenn kein gutes Chancen-Risiko-Verhältnis vorliegt → sparen (Trade Republic zahlt 2,25 % p.a.)
- Klumpenrisiko-Grenze: Positionen mit ≥15 % Depotanteil maximal 100 € zusätzlich investieren
- Mindestbetrag pro Position: 100 € (sonst unwirtschaftlich)
- Maximalbetrag pro Position: 350 € (Diversifikation)
- Budget kann teilweise gespart werden — Restbetrag wird benannt

## Regelbasierte Basis-Allokation (nur Score/Trigger/Klumpen)
${basisText}

## Kandidaten mit Deep Research (Score ≥ ${MIN_SCORE_FUER_KI_EMPFEHLUNG})

${baueKandidatenText(kandidaten)}

---

## Deine Ausgabe

Beantworte folgende Punkte **auf Deutsch**:

**1. Gesamtbewertung:** Ist der Markt aktuell für Käufe geeignet? (2–3 Sätze)

**2. Kandidaten-Ranking mit Begründung:**
Für jeden Kandidaten: Kaufen (wie viel €) oder überspringen — und warum (insbesondere auf Basis des Deep Research).

**3. Finale Allokation:**
Liste im Format:
- TICKER: XXX € — Begründung in einem Satz
- TICKER: XXX € — Begründung in einem Satz
- Gespart: XXX € (Begründung)

**4. Wichtigste Warnung:** Was ist der kritischste Risikofaktor der Gesamtempfehlung?

Sei direkt und konkret. Kein Bullshit, kein Optimismus-Bias. Wenn du nicht kaufen würdest, sag es klar.`
}

// ---------------------------------------------------------------------------
// Modell-Kandidaten
// ---------------------------------------------------------------------------

function kaufempfehlungModell(): string[] {
  const primary =
    process.env.NACHKAUF_DEEP_RESEARCH_GEMINI_MODEL?.trim() || 'gemini-3.1-pro-preview'
  const fallbacks = [
    'gemini-3.1-pro-preview',
    'gemini-3.1-pro-exp',
    'gemini-3.5-pro-preview',
    'gemini-2.5-pro-preview-06-05',
    'gemini-2.5-pro',
  ]
  const seen = new Set<string>()
  return [primary, ...fallbacks].filter((m) => {
    if (seen.has(m)) return false
    seen.add(m)
    return true
  })
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
  const basisAllokation = berechneBasisAllokation(kandidaten)

  // Fallback ohne KI wenn keine Kandidaten
  if (kandidaten.length === 0) {
    const sparen: MonatsEmpfehlung = {
      typ: 'sparen',
      text: `Keine Positionen mit Score ≥ ${MIN_SCORE_FUER_KI_EMPFEHLUNG} und Deep Research gefunden. ` +
        `${BUDGET_EUR} € auf Trade Republic sparen (2,25 % p.a.).`,
    }
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
  const prompt = bauePrompt(kandidaten, basisAllokation)
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
          geminiModels: kaufempfehlungModell(),
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

function berechneBasisAllokation(kandidaten: NachkaufScanEintrag[]): SparplanPosten[] {
  if (kandidaten.length === 0) return []

  const MAX_KLUMPEN = BUDGET_EUR * 0.2   // max. 100 € für Klumpen-Positionen
  const MAX_PRO_POS = 350
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
  let rest = BUDGET_EUR

  for (const { eintrag, gewicht } of gewichte) {
    let betrag = (gewicht / summe) * BUDGET_EUR
    if (eintrag.klumpenrisiko) betrag = Math.min(betrag, MAX_KLUMPEN)
    betrag = Math.min(betrag, MAX_PRO_POS)
    betrag = Math.round(betrag / 10) * 10

    if (betrag < MIN_POS) continue
    rest -= betrag

    const teile: string[] = [`Score ${eintrag.score}`]
    if (eintrag.kaufTriggerAusgeloest) teile.push('Kaufzone aktiv')
    if (eintrag.klumpenrisiko) teile.push('Klumpen-Cap 20%')

    posten.push({
      ticker: eintrag.ticker,
      name: eintrag.name,
      betragEur: betrag,
      begruendung: teile.join(' · '),
    })
  }

  // Restbetrag dem besten Kandidaten ohne Klumpen-Cap gutschreiben
  if (rest > 0 && posten.length > 0) {
    const idx = posten.findIndex((_, i) => !kandidaten[i]?.klumpenrisiko)
    const target = idx >= 0 ? idx : 0
    posten[target]!.betragEur = Math.min(posten[target]!.betragEur + rest, MAX_PRO_POS)
  }

  return posten
}
