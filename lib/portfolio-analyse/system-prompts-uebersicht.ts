/**
 * Zentrale Übersicht aller automatischen KI-System-Prompts in der Portfolioanalyse.
 *
 * Diese Datei sammelt alle Prompts die im Hintergrund von der App verwendet werden —
 * damit sie in der Markt & Prompts Seite lesbar und nachvollziehbar sind.
 * Rein client-seitig verwendbar (keine server-only Importe).
 */

import { EARNINGS_CALL_SYSTEM_PROMPT, EARNINGS_WEBCAST_SYSTEM_PROMPT } from './earnings-call-prompt'
import { SEC_BERICHTE_SYSTEM_PROMPT } from './sec-berichte-prompt'
import { QUARTALS_KI_DIFF_SYSTEM_PROMPT } from './quartals-ki-diff-prompt'
import { MARKTKONTEXT_SYSTEM_PROMPT } from './marktkontext-prompt'
import { NACHKAUF_SCAN_SYSTEM_PROMPT } from './nachkauf-radar/nachkauf-scan-prompt'
import { NACHKAUF_DEEP_RESEARCH_SYSTEM_PROMPT } from './nachkauf-radar/nachkauf-deep-research-prompt'

export type SystemPromptEintrag = {
  id: string
  gruppe: string
  titel: string
  beschreibung: string
  /** Das verwendete Modell / die Quelle. */
  modell: string
  text: string
}

export const SYSTEM_PROMPTS_UEBERSICHT: SystemPromptEintrag[] = [
  // -------------------------------------------------------------------------
  // Quartalszahlen & Earnings
  // -------------------------------------------------------------------------
  {
    id: 'sys-earnings-call',
    gruppe: 'Quartalszahlen & Earnings',
    titel: 'Earnings Call: Zusammenfassung',
    beschreibung: 'Analyse eines vollständigen Earnings Call Transkripts mit Q&A-Session.',
    modell: 'Gemini Flash / GPT (konfigurierbar)',
    text: EARNINGS_CALL_SYSTEM_PROMPT,
  },
  {
    id: 'sys-earnings-webcast',
    gruppe: 'Quartalszahlen & Earnings',
    titel: 'Earnings Webcast / PDF (ohne Transkript)',
    beschreibung: 'Analyse eines Webcasts, Investor-Präsentation oder Ergebnis-PDFs — ohne vollständiges Q&A.',
    modell: 'Gemini Flash / GPT (konfigurierbar)',
    text: EARNINGS_WEBCAST_SYSTEM_PROMPT,
  },
  {
    id: 'sys-quartals-diff',
    gruppe: 'Quartalszahlen & Earnings',
    titel: 'Quartals-Vergleich (KI-Diff)',
    beschreibung: 'Vergleich zweier aufeinanderfolgender KI-Zusammenfassungen desselben Unternehmens — zeigt was sich wirklich verändert hat.',
    modell: 'Gemini Flash / GPT (konfigurierbar)',
    text: QUARTALS_KI_DIFF_SYSTEM_PROMPT,
  },

  // -------------------------------------------------------------------------
  // Berichte & Recherche
  // -------------------------------------------------------------------------
  {
    id: 'sys-sec-bericht',
    gruppe: 'Berichte & Recherche',
    titel: 'SEC / IR-Bericht (10-K / 10-Q)',
    beschreibung: 'Forensische Analyse eines Jahres- oder Quartalsberichts nach dem Quality Investing Framework.',
    modell: 'Gemini Flash / GPT (konfigurierbar)',
    text: SEC_BERICHTE_SYSTEM_PROMPT,
  },
  {
    id: 'sys-marktkontext',
    gruppe: 'Berichte & Recherche',
    titel: 'Live-Marktkontext',
    beschreibung: 'Ergänzt bestehende Analysen um aktuelle Nachrichten via Google Search Grounding — regulatorische Risiken, M&A, Analysten-Stimmung.',
    modell: 'Gemini (Google Search Grounding)',
    text: MARKTKONTEXT_SYSTEM_PROMPT,
  },

  // -------------------------------------------------------------------------
  // Nachkauf-Radar
  // -------------------------------------------------------------------------
  {
    id: 'sys-nachkauf-scan',
    gruppe: 'Nachkauf-Radar',
    titel: 'Nachkauf-Scan Stufe A (Flash)',
    beschreibung: 'Kurze 2–3-Satz-Begründung pro Position im monatlichen Scan. Der Score selbst ist regelbasiert — das Modell erklärt nur.',
    modell: 'Gemini Flash (kostengünstig, ~32 Calls/Monat)',
    text: NACHKAUF_SCAN_SYSTEM_PROMPT,
  },
  {
    id: 'sys-nachkauf-deep',
    gruppe: 'Nachkauf-Radar',
    titel: 'Nachkauf Deep Research Stufe B (Pro)',
    beschreibung: 'Ausführliche Investitions-Memo für einen einzelnen Kandidaten — inkl. Kaufzone, Bewertung und Bull/Bear-Case. Manuell auslösbar.',
    modell: 'Gemini Pro (auf Anfrage)',
    text: NACHKAUF_DEEP_RESEARCH_SYSTEM_PROMPT,
  },

  // -------------------------------------------------------------------------
  // Nachkauf-Radar: Regelbasierte Logik (kein LLM-Prompt, aber dokumentiert)
  // -------------------------------------------------------------------------
  {
    id: 'sys-nachkauf-scoring',
    gruppe: 'Nachkauf-Radar',
    titel: 'Score-Formel (regelbasiert, kein LLM)',
    beschreibung: 'Transparente Dokumentation wie der Nachkauf-Score berechnet wird: Qualität (0–60 Pkt.) + Bewertung absolut (0–40 Pkt.) ± Historischer Vergleich zum 5-Jahres-Median (±10 Pkt.) − Sell-Trigger (0/−10/−25 Pkt.).',
    modell: 'Regelbasiert (TypeScript)',
    text: `SCORE-FORMEL:

1. QUALITÄTS-SCORE (0–60 Punkte)
   Quelle: Mantra-Audit (5 quantitative Metriken aus Fundamentaldaten)
   Bewertung: erfüllte_Metriken / bewertbare_Metriken × 60

2. BEWERTUNGS-SCORE ABSOLUT (0–40 Punkte)
   FCF-Rendite (0–22 Pkt.):
     ≥ 5,0 % = 22 Pkt. | ≥ 3,5 % = 17 Pkt. | ≥ 2,5 % = 12 Pkt. | ≥ 1,5 % = 6 Pkt.
   Forward P/E (0–18 Pkt.):
     < 15× = 18 Pkt. | < 20× = 14 Pkt. | < 25× = 9 Pkt. | < 35× = 4 Pkt.

3. HISTORISCHER BONUS/MALUS (–10 bis +10 Punkte)
   Vergleich des aktuellen P/E mit dem 5-Jahres-Median aus der Whitelist.
   Discount ≥ 20 % = +10 | 10–20 % = +6 | 5–10 % = +3
   Premium 5–15 % = –4 | 15–25 % = –7 | > 25 % = –10

4. SELL-TRIGGER-PENALTY
   Aktive Warnung (sell_trigger = true) = –25 Pkt.
   Beobachten-Status = –10 Pkt.

AMPEL-LOGIK:
   gruen  = Gesamt-Score ≥ 65, kein Sell-Trigger
   gelb   = Score 35–64
   rot    = Score < 35 oder aktiver Sell-Trigger
   teuer  = Quality intakt (Mantra ≥ 30 Pkt.), aber FCF-Rendite < 1,5 % UND P/E > 38×
   grau   = Keine Fundamentaldaten verfügbar`,
  },
]
