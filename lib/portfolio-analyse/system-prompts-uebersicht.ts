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
import { kiMoverEinordnungSystemPrompt } from '@/lib/investment-movers-begruendung'

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
  // Investment Movers
  // -------------------------------------------------------------------------
  {
    id: 'sys-movers-live',
    gruppe: 'Investment Movers',
    titel: 'Kurs-Bewegungen Einordnung (Live)',
    beschreibung: 'Begründung der stärksten Tages-Gewinner und -Verlierer im S&P 500 / Nasdaq 100 mit Google Search Grounding.',
    modell: 'Gemini (Google Search Grounding)',
    text: kiMoverEinordnungSystemPrompt(true),
  },
  {
    id: 'sys-movers-cache',
    gruppe: 'Investment Movers',
    titel: 'Kurs-Bewegungen Einordnung (Offline)',
    beschreibung: 'Gleicher Prompt — aber ohne Live-Websuche, basiert nur auf mitgelieferten RSS/Artikel-Feldern.',
    modell: 'Gemini / GPT (konfigurierbar)',
    text: kiMoverEinordnungSystemPrompt(false),
  },
]
