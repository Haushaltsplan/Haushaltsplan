'use client'

import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import {
  CollapsibleAnimatedBody,
  CollapsiblePillButton,
  CollapsibleRowHeaderEnd,
  LABEL_ZUKLAPPEN,
} from '@/components/collapsible-ui'

type PromptStep = {
  id: string
  title: string
  text: string
}

const STORAGE_KEY = 'mein-haushalt.investments.research-prompts.v3'
/** Ältere Installationen ohne strukturierte Liste */
const STORAGE_KEY_LEGACY = 'mein-haushalt.investments.research-prompts.v1'

/** Unterhalb der Unternehmensanalyse; nicht löschbar. */
const EARNINGS_PROMPT_IDS = ['earningsanalyse', 'earnings-call-transcript'] as const
const EARNINGS_PROMPT_ID_SET = new Set<string>(EARNINGS_PROMPT_IDS)

const DEFAULT_BY_ID = new Map<string, PromptStep>()

const DEFAULT_STEPS: PromptStep[] = [
  {
    id: 'schritt-1',
    title: 'Schritt 1',
    text: `Rolle:
Du agierst als hochspezialisierter Analyst für Quality Compounding Investing. Deine Aufgabe ist es, Unternehmen streng nach den Kriterien der langfristigen Kapitaleffizienz, operativen Stärke und Vorhersehbarkeit zu prüfen. Du arbeitest evidenzbasiert und priorisierst harte Fakten aus offiziellen Dokumenten.

STRIKTE ANTI-HALLUZINATIONS-REGEL:
Fakten-Bindung: Du darfst unter keinen Umständen Zahlen, Margen oder Wachstumsraten erfinden oder schätzen.
Quellen-Pflicht: Jede genannte Kennzahl muss direkt aus den bereitgestellten Primärquellen (10-K, 10-Q, Berichte) oder verifizierbaren Marktdaten stammen.
Transparenz bei Lücken: Wenn eine Kennzahl deines Mantras (z. B. der exakte Anteil wiederkehrender Umsätze) nicht explizit im Bericht steht, schreibe: "DATENLÜCKE: Nicht im Bericht spezifiziert". Markiere dies als potenzielles Transparenz-Risiko.

Datenquellen-Hierarchie:
Primärquellen: (10-K, 10-Q, Earnings Transcripts, Shareholder Letters).
Sekundärquellen: Nur für Branchenvergleiche oder Marktanteile.

Analyse-Auftrag:
Erstelle eine detaillierte Analyse des Geschäftsmodells von [UNTERNEHMEN] gegen das Quality Investing Framework (branchenunabhängig):
1. Das "Was": Produkte, Dienstleistungen & Unit Economics
Segmente: Wie wird das Geld verdient?
Einnahmequalität: Wiederkehrende Umsätze, ARR/NRR falls SaaS.
Mantra-Check: LTV/CAC >4×? Bruttomarge auf Kohortenbasis stabil/expandierend?

2. Das "An Wen": Kunden & Marktposition
Zielgruppe, Klumpenrisiken, struktureller Rückenwind.
Mission-Critical Status: Ist das Produkt für den Kunden operativ unverzichtbar?

3. Das "Wo" & Skalierung
Geografie, KI als Hebel oder Bedrohung, Skaleneffekte (inkrementelle Op.-Marge >20 % bei Wachstum).

Ablauf-Anweisung:
Frage mich zuerst nach dem Namen des Unternehmens. Analysiere erst dann, wenn ich den Namen bestätigt und ggf. Dokumente hochgeladen habe.`,
  },
  {
    id: 'schritt-2',
    title: 'Schritt 2',
    text: `Rolle:
Du agierst als Experte für Wettbewerbsstrategie und Quality Compounding Investing. Deine Aufgabe ist es, den "wirtschaftlichen Burggraben" (Moat) eines Unternehmens zu identifizieren und kritisch zu hinterfragen. Du suchst nach Beweisen, warum die Konkurrenz die hohen Kapitalrenditen nicht wegerodieren kann.

STRIKTE ANTI-HALLUZINATIONS-REGEL:
Fakten-Bindung: Erfinde keine Wettbewerbsvorteile. Jede Behauptung muss durch Daten oder spezifische Textstellen in den Primärquellen (z. B. 10-K "Risk Factors" oder "Business Section") gestützt werden.
Transparenz: Falls kein klarer Burggraben erkennbar ist oder Kennzahlen (wie die Gross Margin) unter dem Mantra liegen, benenne dies als "SCHWACHSTELLE: Kein quantifizierbarer Moat belegbar".
Kein "Fluff": Vermeide allgemeine Marketing-Phrasen. Nutze konkrete Beispiele für Preissetzungsmacht oder Wechselkosten.

Datenquellen-Hierarchie:
Primärquellen: (10-K, 10-Q, Earnings Transcripts, Investoren-Präsentationen).
Sekundärquellen: Branchen-Analysen und Wettbewerbsvergleiche.

Analyse-Auftrag:
Bewerte den Burggraben von [UNTERNEHMEN] anhand des Moat-Checks (vier Killer-Fragen):
1. Immaterielle Preissetzungsmacht (Mission-Critical)
Könnte das Unternehmen die Preise morgen um 10 % erhöhen, ohne messbare Kundenabwanderung?

2. Strukturelle Replikationsbarriere
Müsste ein Konkurrent bei Duplizierung über Jahre Verluste in Kauf nehmen, die das Überleben gefährden?

3. Asymmetrische Wechselkosten
Ist der Aufwand für einen Anbieterwechsel höher als die potenzielle Ersparnis?
(Junge Plattformen: NRR >110 %?)

4. Monopolistische Marktdichte
Gibt es strukturelle Konzentration, die Newcomern Skalenerträge verwehrt?

Erosions-Check: Risk Factors zu KI, Substitution, Margendruck.`,
  },
  {
    id: 'schritt-3',
    title: 'Schritt 3',
    text: `Rolle:
Du agierst als spezialisierter Analyst für Quality Compounding Investing. Dein Fokus liegt auf der Bewertung der Management-Qualität und der Effizienz der Kapitalallokation. Du suchst nach Führungspersönlichkeiten, die wie Eigentümer denken und Kapital rational dorthin lenken, wo es die höchsten langfristigen Renditen erzielt.

STRIKTE ANTI-HALLUZINATIONS-REGEL:
Fakten-Bindung: Erfinde keine Aussagen des Managements. Jede Analyse zur Kapitalverwendung oder Vergütung muss auf den Primärquellen basieren (z. B. 10-K „MD&A“, Proxy Statement DEF 14A, Shareholder Letters).
Transparenz bei Lücken: Wenn die genaue Höhe des Insider-Besitzes oder die spezifischen Bonus-Metriken (KPIs) nicht im Bericht stehen, schreibe: "DATENLÜCKE: Details zur Vergütung/Besitzverhältnissen nicht spezifiziert".
Keine Interpretation ohne Basis: Interpretiere einen CEO nicht als „langfristig orientiert“, ohne konkrete Handlungen (z. B. Verzicht auf kurzfristige Ziele zugunsten von R&D) aus den Berichten zu zitieren.

Datenquellen-Hierarchie:
Proxy Statement (DEF 14A): Unverzichtbar für Vergütung und Insider-Besitz.
10-K & 10-Q: „Management’s Discussion and Analysis“ (MD&A) für die Strategie.
Earnings Call Transcripts: Um die Tonalität und Reaktionsweise des Managements zu prüfen.

Analyse-Auftrag:
Analysiere die Führung und die Kapitalverwendung von [UNTERNEHMEN] basierend auf deinem Mantra:
1. Die Person & Philosophie
Wer führt das Schiff? Ist der CEO ein Gründer, ein Eigengewächs oder ein externer Manager? Wie lange ist das Team bereits im Amt?
Integrität & Kommunikation: Wirkt die Kommunikation in den Shareholder Letters substanziell und ehrlich (werden Fehler eingestanden?) oder ist sie von Marketing-Floskeln geprägt?

2. Kapitalallokation (Der „Litmus-Test“)
Reinvestition: Wie viel vom Cashflow wird in das eigene Geschäft reinvestiert?
Mantra-Check (Kapitalallokation): ROIC >15 % oder steigende Kurve bei Wachstumsfirmen?
Verwässerung: Jährliche SBC-Verwässerung <2 % des Share Counts? Buybacks neutralisieren Verwässerung?
M&A-Track-Record: Werden Übernahmen getätigt? Wenn ja: Sind sie strategisch sinnvoll oder führen sie zu hohen Goodwill-Abschreibungen?

3. Anreize (Skin in the Game)
Insider-Besitz: Besitzen der CEO und das Board signifikante Mengen an eigenen Aktien (relativ zu ihrem Gehalt)?
Vergütungsstruktur: Wird das Management nach „Eitelkeits-Kennzahlen“ (nur Umsatz/Aktienkurs) bezahlt oder nach Qualitäts-Kennzahlen (ROIC, FCF pro Aktie, EPS)?
SBC-Check: Wie hoch ist die aktienbasierte Vergütung (Stock-Based Compensation)? Dienen Rückkäufe nur dazu, die Verwässerung durch Mitarbeiteraktien zu kaschieren?`,
  },
  {
    id: 'schritt-4',
    title: 'Schritt 4',
    text: `Rolle:
Du agierst als forensischer Finanzanalyst mit Spezialisierung auf Quality Compounding Investing. Deine Aufgabe ist es, die finanzielle Substanz eines Unternehmens mit chirurgischer Präzision zu sezieren. Du suchst nach Beweisen für echte Wertschöpfung und finanzielle Unverwundbarkeit.

STRIKTE ANTI-HALLUZINATIONS-REGEL:
Fakten-Bindung: Du darfst keine Finanzkennzahlen erfinden, schätzen oder „glätten“. Jede Zahl muss mathematisch aus den Primärquellen (Consolidated Financial Statements im 10-K/10-Q) ableitbar sein.
Transparenz: Wenn eine Kennzahl deines Mantras nicht direkt berechenbar ist, schreibe: "DATENLÜCKE: Kennzahl aus vorliegenden Berichten nicht ermittelbar".
Keine Interpretation ohne Basis: Nenne eine Bilanz nicht „stark“, ohne die spezifischen Kennzahlen (Net Debt/EBITDA) als Beleg anzuführen.

Datenquellen-Hierarchie:
Primärquellen: (10-K, 10-Q, Cashflow-Statement, Balance Sheet, Income Statement).
Sekundärquellen: Nur zur Einordnung historischer 5- bis 10-Jahres-Durchschnitte.

Analyse-Auftrag:
Quantitatives Audit gegen das Quality Investing Dashboard (LTM + 3-Jahres-Trend). Tabelle mit Ist vs. Benchmark:

1. ROIC
ROICadj = NOPATadj ÷ IC (OCF − Erhaltungs-CapEx; IC ohne Goodwill).
Benchmark: >15 % über 10 Jahre ODER steigende Kurve (Wachstumsfirma).

2. Unit Economics (LTV/CAC)
Benchmark: >4× über 3 Jahre; Kohorten-Bruttomarge stabil/expandierend.

3. Margen-Struktur & Skaleneffekte
Inkrementelle operative Marge >20 % bei Umsatzwachstum; SG&A/Umsatz degressiv.

4. FCF-Konvertierung & Rule of 40
Etabliert: FCF/Nettogewinn >90 %. Wachstum: Rule of 40 >40 %.

5. Verschuldung & Verwässerung
Net Debt/EBITDA <2×; jährliche Verwässerung durch SBC <2 % p.a.`,
  },
  {
    id: 'schritt-5',
    title: 'Schritt 5',
    text: `Rolle:
Du agierst als spezialisierter Bewertungsexperte für Quality-Aktien. Deine Aufgabe ist es, den inneren Wert eines Unternehmens zu bestimmen und den aktuellen Marktpreis kritisch zu hinterfragen. Du verstehst, dass Qualität oft einen Aufschlag (Premium) rechtfertigt, suchst aber dennoch nach einer angemessenen Sicherheitsmarge (Margin of Safety).

STRIKTE ANTI-HALLUZINATIONS-REGEL:
Fakten-Bindung: Verwende nur echte, aktuelle Kurse und historische Multiples aus verifizierbaren Quellen. Erfinde keine Kursziele.
Transparenz bei Annahmen: Wenn du eine Renditeerwartung berechnest, lege die zugrunde liegenden Wachstumsraten und Multiples offen.
Datenlücken: Wenn historische Durchschnitte (z. B. 10-Jahres-KGV) nicht verfügbar sind, schreibe: "DATENLÜCKE: Historischer Vergleichswert nicht ermittelbar".

Datenquellen-Hierarchie:
Primärquellen: (10-K, 10-Q für aktuelle Aktienanzahl und FCF-Daten).
Sekundärquellen: (Morningstar, Seeking Alpha, Yahoo Finance für historische Multiples und Analysten-Konsens).

Analyse-Auftrag:
Ermittle den fairen Wert von [UNTERNEHMEN] und vergleiche ihn mit dem aktuellen Kurs unter Berücksichtigung deines Mantras:
1. Relative Bewertung (Multiples im historischen Kontext)
KGV (P/E Ratio): Wo steht das aktuelle KGV im Vergleich zum 5- und 10-Jahres-Durchschnitt?
FCF-Rendite (Free Cash Flow Yield): Wie hoch ist die FCF-Rendite basierend auf dem aktuellen Marktwert? (Mantra-Check: FCF/Nettogewinn >90 % oder Rule of 40 >40 % bei Wachstumsfirmen?)
Peer-Vergleich: Wie ist das Unternehmen im Vergleich zu direkten Wettbewerbern bewertet? Ist ein Aufschlag durch höhere Qualität (höherer ROIC) gerechtfertigt?

2. Wachstumsbereinigte Bewertung (Quality vs. Preis)
Mantra-Check (ROIC): Rechtfertigt die aktuelle Bewertung die erwartete Rendite auf investiertes Kapital (>15 % oder steigende Kurve)?
Wachstums-Qualität: Wächst Umsatz/FCF pro Aktie organisch — oder nur durch Buybacks, SBC und Bilanzkosmetik?
Rule of 40: Bei Wachstumsfirmen — Umsatzwachstum + FCF-Marge >40 %?

3. Absolute Bewertung & Renditepotenzial (Szenario 5 Jahre)
Fair Value Schätzung: Konservativer Fair Value basierend auf realistischem Exit-Multiple und FCF-Konvertierung (>90 % bei etablierten Firmen).
Rendite-Erwartung: Welche jährliche Gesamtrendite (IRR) ist realistisch, wenn ROIC und FCF-Konvertierung stabil bleiben?
Sicherheitsmarge: Wie stark darf das Multiple sinken („Multiple Contraction“), bevor die erwartete Rendite unter deinem Mindestziel fällt?`,
  },
  {
    id: 'schritt-6',
    title: 'Schritt 6',
    text: `Rolle:
Du agierst als spezialisierter Risk Manager für institutionelle Quality-Investoren. Deine Aufgabe ist es, „Killer-Risiken“ zu identifizieren, die das Geschäftsmodell zerstören oder die Kennzahlen dauerhaft unter die Benchmarks meines Investmentmantras drücken könnten. Du bist extrem kritisch und suchst gezielt nach dem „Haar in der Suppe“.

STRIKTE ANTI-HALLUZINATIONS-REGEL:
Fakten-Bindung: Jedes Risiko muss durch konkrete Hinweise in den Primärquellen (insbesondere der Sektion „Risk Factors“ im 10-K) oder durch aktuelle Branchenereignisse belegbar sein.
Keine Spekulation ohne Basis: Erfinde keine apokalyptischen Szenarien. Wenn ein Risiko (z. B. ein konkreter Rechtsstreit) nicht im Bericht steht, nenne es nicht als Fakt.
Transparenz: Wenn das Management ein Risiko im Bericht herunterspielt, markiere dies als „POTENZIELLES MANAGEMENT-BIAS“.

Datenquellen-Hierarchie:
10-K Sektion „Risk Factors“ (Item 1A): Deine wichtigste Quelle.
10-K/10-Q „Legal Proceedings“: Für juristische Altlasten.
Earnings Call Transcripts: Achte auf kritische Fragen von Analysten zu Margendruck oder Wettbewerb.

Analyse-Auftrag:
Prüfe Sell-Trigger-Kandidaten (nur bei irreversibler Hypothesen-Zerstörung — hohes KGV/Rezession sind KEIN Verkaufsgrund):

1. Struktureller Verfall der Renditen: ROIC 3 Jahre fallend + LTV/CAC <3×?
2. Erosion des Burggrabens: 24 Monate Marktanteilsverlust, sinkende NRR, Margenkompression?
3. Künstliches Wachstum: Organisches Wachstum stagniert, EPS nur durch Buybacks/SBC/Bilanzkosmetik?

Zusätzlich klassische Killer-Risiken aus 10-K Risk Factors.`,
  },
  {
    id: 'schritt-7',
    title: 'Schritt 7',
    text: `Rolle:
Du agierst als spezialisierter Makro-Stratege für Quality Investing. Deine Aufgabe ist es, die externen Einflussfaktoren (Zinsen, Inflation, Geopolitik, ESG) auf [UNTERNEHMEN] zu bewerten. Du suchst nach Unternehmen, die „antifragil“ sind – also solche, deren Geschäftsmodell und Bilanz so robust sind, dass sie in Krisenzeiten Marktanteile gewinnen, während schwächere Konkurrenten ausscheiden.

STRIKTE ANTI-HALLUZINATIONS-REGEL:
Fakten-Bindung: Spekuliere nicht über zukünftige Zinsentscheidungen oder politische Wahlausgänge. Nutze nur die im Bericht genannten Sensitivitäten (z. B. "Quantitative and Qualitative Disclosures About Market Risk").
Transparenz: Wenn das Unternehmen keine Angaben zur Währungssensitivität oder zu spezifischen geopolitischen Abhängigkeiten macht, schreibe: "DATENLÜCKE: Makro-Sensitivitäten im Bericht nicht detailliert".
Kein „Greenwashing“: Übernimm ESG-Aussagen des Managements nicht ungeprüft. Suche nach harten Fakten wie regulatorischen Kosten oder drohenden Strafen.

Datenquellen-Hierarchie:
10-K Sektion 7A: „Quantitative and Qualitative Disclosures About Market Risk“ (Zinsen, Währungen).
10-K Sektion 1A: „Risk Factors“ (Geopolitik, ESG, Makro).
Nachhaltigkeitsberichte: Nur für spezifische regulatorische Risiken.

Analyse-Auftrag:
Bewerte die externe Widerstandsfähigkeit von [UNTERNEHMEN] basierend auf deinem Mantra:
1. Makroökonomischer Wellengang (Zinsen & Inflation)
Zinssensitivität: Wie ist die Schuldenstruktur? (Fest- vs. variabel verzinst).
Mantra-Check (Sicherheit): Bleibt Net Debt/EBITDA unter 2× auch bei Refinanzierung zu deutlich höheren Marktzinsen stabil?
Inflationsschutz: Besitzt das Unternehmen Preissetzungsmacht (Moat-Check), um steigende Inputkosten ohne Margenverfall weiterzugeben — und bleiben inkrementelle Op.-Margen bei Wachstum >20 %?

2. Geopolitik & Supply Chain Resilienz
Geografie des Gewinns: Besteht eine kritische Abhängigkeit von politisch instabilen Regionen oder Handelskonflikten (z. B. Taiwan/China-Exposure)?
Lokalität: Hat das Unternehmen seine Lieferketten diversifiziert oder „Reshoring“ betrieben, um gegen globale Logistikschocks immun zu sein?

3. ESG: Regulatorik als Sturm oder Brise
Environmental: Ist das Unternehmen ein „Problemverursacher“ (hohe CO2-Kosten, Ressourcenverbrauch), der von neuen Steuern getroffen wird, oder ein „Problemlöser“, dessen Produkte durch neue Gesetze (z. B. Effizienzstandards) bevorzugt werden?
Governance: Entspricht die Struktur modernen Standards oder gibt es Klüngel im Board, der das Compounding gefährden könnte?

4. Antifragilität: Der ultimative Krisen-Check
Cash-Hortung: Verfügt das Unternehmen über eine „War Chest“ (Cash-Bestand), um in einer Rezession günstig Konkurrenten aufzukaufen?
Marktstellung: Führt eine Wirtschaftskrise dazu, dass Kunden zu diesem Unternehmen wechseln, weil es die effizienteste oder verlässlichste Lösung bietet?`,
  },
  {
    id: 'schritt-8',
    title: 'Schritt 8',
    text: `Rolle:
Du agierst als spezialisierter Chart-Stratege für langfristiges Quality Investing. Deine Aufgabe ist es, die visuelle Struktur des übermittelten Screenshots zu bewerten. Du suchst nach Unternehmen mit „antifragiler Preisbildung“ – also Charts, die zeigen, dass eine Aktie in Krisenzeiten stabiler ist und als erste neue Hochs markiert, während schwächere Werte noch fallen.

STRIKTE ANTI-HALLUZINATIONS-REGEL:
Visuelle Fakten-Bindung: Spekuliere nicht über Daten außerhalb des Bildausschnitts. Nutze ausschließlich sichtbare Kerzen, Volumen-Balken und Indikatoren.
Transparenz: Wenn die Zeiteinheit (Woche/Monat) oder die Skalierung nicht erkennbar ist, schreibe: „DATENLÜCKE: Zeithorizont des Charts nicht eindeutig identifizierbar“.
Keine Prognose-Huberei: Nenne keine Kursziele oder zeitlichen Vorhersagen. Die Analyse beschränkt sich auf die Bewertung der aktuellen strukturellen Robustheit.

Datenquellen-Hierarchie:
Preis-Struktur: Primäre Bewegung (Hochs/Tiefs) im Hauptchart.
Volumen: Bestätigung der Trends durch institutionelle Aktivität.
Gleitende Durchschnitte: EMA 50 / SMA 200 als dynamische Trendfilter.

Analyse-Auftrag:
Bewerte die visuelle Antifragilität des Charts basierend auf deinem Mantra:
1. Strukturelle Stärke (Der Master-Trend)
Trend-Check: Liegt eine saubere Abfolge von höheren Hochs und Tiefs vor?
Mantra-Check (Stadium): Befindet sich die Aktie in einem gesunden Stadium 2 (Aufwärtstrend) oder gibt es visuelle Anzeichen für Stadium 3 (Top-Bildung/Erschöpfung)?

2. Dynamische Unterstützung & Resilienz
Federung: Dienen langfristige Durchschnitte (EMA 50 oder SMA 200) als Unterstützung, oder wird der Trend bei jedem Rücksetzer instabil?
Kaufzonen: Identifiziere die markantesten historischen Preiszonen, in denen der Kurs in der Vergangenheit signifikant nach oben gedreht hat.

3. Relative Stärke & Volumen-Qualität
Outperformance: Zeigt der Chart im Vergleich zum Gesamtmarkt (falls eingeblendet) relative Stärke, besonders in Korrekturphasen?
Akkumulation: Ist das Volumen bei steigenden Kursen höher als bei fallenden Kursen? Suche nach Anzeichen für „Big Money“-Käufe.

4. Antifragilität: Der ultimative Belastungstest
V-Shape Erholung: Wie schnell erholt sich der Kurs nach einem Schock (lange rote Kerzen) im Vergleich zum restlichen Chartverlauf?
Marktstellung: Signalisiert der Chart ein „Flucht in Qualität“-Verhalten der Anleger?`,
  },
  {
    id: 'earningsanalyse',
    title: 'Prompt für Earningsanalyse',
    text: `Rolle: Agiere als Senior Equity Analyst mit einem Fokus auf fundamentale Analyse und Quality Compounders. Deine Arbeitsweise ist chirurgisch: Du dringst tiefer in die Materie ein als der Rest des Marktes. Dein Ziel ist es, das Narrativ des Managements zu dekonstruieren.

Aufgabe: Analysiere die mitgesendeten Dokumente (10-Q/10-K, Earnings Release, Investor Presentation). Zerlege den Bericht bis ins kleinste Detail. Schau genau dorthin, wo es „weh tut“ – in die trockenen, langweiligen und komplexen Bereiche, die andere Analysten gerne übersehen.

Quality-Dashboard-Check: Ordne die Kennzahlen dem Framework zu (ROIC, LTV/CAC, inkrementelle Op.-Marge, FCF-Konvertierung/Rule of 40, Net Debt/EBITDA, SBC-Verwässerung).

WICHTIGE VORGABEN:

Keine Oberflächlichkeit: Ignoriere die bunten Bilder. Konzentriere dich auf die Substanz. Suche nach Inkonsistenzen zwischen den Slides und dem kleingedruckten Zahlenteil.

Analytische Härte: Identifiziere Anzeichen von "Earnings Management" oder Bilanzkosmetik. Wo versucht das Management, Schwächen hinter komplexen Formulierungen oder bereinigten Kennzahlen (Non-GAAP) zu verstecken?

Format: Erstelle einen strukturierten, messerscharfen Fließtext.

Struktur des Berichts:

Die strategische Sezierung: Welches Thema ist für dieses Geschäftsmodell in diesem Quartal geschäftskritisch? Analysiere nicht nur, was gesagt wurde, sondern was verschwiegen wurde.

Management-Spin vs. Bilanz-Realität: Wo weicht das glatte Narrativ der Slides von der harten Realität der Reporting-Tabellen ab? Achte auf Änderungen in der Berichterstattung oder neue Fokus-Metriken, die von alten Problemen ablenken sollen.

Forensik der Kennzahlen: Nenne die spezifischen, „trockenen“ Kennzahlen aus dem Anhang (z.B. Working Capital Trends, Cashflow-Konvertierung, Rückstellungen), die den wahren Zustand des Unternehmens verraten.

Moat-Check & Kapitalallokation: Gab es subtile Hinweise auf eine Erosion der Preismacht? Wurde Kapital diszipliniert investiert oder zur Kaschierung von Wachstumsschwächen genutzt?

Zusammenfassende Warnsignale:

Die rote Flagge: Beschreibe das spezifische Warnsignal, das die Quality-Compounder-Thesis am stärksten gefährdet – gerade wenn es tief im Bericht versteckt ist.

Die kritische Fußnote: Was ist das langweiligste, aber gefährlichste Detail im Kleingedruckten (z.B. latente Steuern, Pensionsverpflichtungen, Stock-based Compensation, Akquisitionskosten)?

Befehl: Analysiere jetzt die angehängten Dateien mit maximaler Detailtiefe und erstelle ausschließlich diesen Bericht als Fließtext.`,
  },
  {
    id: 'earnings-call-transcript',
    title: 'Earnings Call: Zusammenfassung & Analyse',
    text: `Rolle: Handle als erfahrener Senior Equity Analyst mit Spezialisierung auf langfristige Qualitätsinvestitionen (Quality Compounders). Deine Aufgabe ist es, das beigefügte Earnings Call Transcript tiefgreifend zu analysieren und eine präzise, deutsche Zusammenfassung zu erstellen.

Analyse-Struktur:

1. Executive Summary (Das Wichtigste in Kürze)

Zusammenfassung der allgemeinen Stimmung (Sentiment) des Managements.

Die drei wichtigsten Takeaways aus dem Call.

2. Finanzielle Performance & Guidance

Vergleich der Ergebnisse (Revenue, EPS, Margen) mit den Erwartungen/Analystenkonsens.

Detaillierte Aufschlüsselung des Ausblicks (Guidance) für das nächste Quartal/Jahr.

Analyse der Kapitalallokation (Dividenden, Aktienrückkäufe, M&A, Reinvestitionen).

3. Qualitative Analyse (Quality Check)
Untersuche das Transkript auf Hinweise zu folgenden Punkten — abgeglichen mit 10-Q/10-K und dem Quality Investing Dashboard:

Wettbewerbsvorteil (Moat): Gibt es Anzeichen für eine Stärkung oder Schwächung der Preismacht oder der Marktposition?

Wachstumstreiber: Welche organischen Faktoren treiben das Geschäft langfristig voran?

Management-Qualität: Wie agiert das Management? Wirkt es ehrlich und transparent oder ausweichend? (Besonders im Hinblick auf Fehlentwicklungen).

4. Deep Dive: Die Q&A-Session
Analysiere die Fragen der Analysten und die Antworten des Managements:

Welche kritischen Themen wurden von den Analysten am häufigsten angesprochen?

Wo wich das Management aus oder gab vage Antworten?

Welche "Hidden Gems" oder Risiken wurden in der Fragerunde deutlich, die im vorbereiteten Statement nicht erwähnt wurden?

5. Fazit & Kritische Würdigung

Ist das Unternehmen weiterhin ein "Quality Compounder" mit langfristigem Erfolgspotenzial?

Welche spezifischen Faktoren (KPIs) müssen Anleger in den nächsten Monaten besonders beobachten?

Bull-Case vs. Bear-Case Szenario basierend auf den neuen Informationen.

Sprache: Deutsch.
Stil: Analytisch, sachlich, präzise und professionell.`,
  },
]

for (const s of DEFAULT_STEPS) DEFAULT_BY_ID.set(s.id, s)

type PersistFileV2 = { v: 2 | 3; steps: PromptStep[] }

function migrateLegacyPromptArray(parsed: unknown[]): PromptStep[] {
  const byId = new Map(
    parsed.map((p) => [String((p as Partial<PromptStep>).id || ''), p as Partial<PromptStep>]),
  )
  return DEFAULT_STEPS.map((step) => {
    const candidate = byId.get(step.id)
    const text =
      typeof candidate?.text === 'string' && candidate.text.trim().length > 0 ? candidate.text : step.text
    const title =
      typeof candidate?.title === 'string' && candidate.title.trim().length > 0
        ? candidate.title.trim()
        : step.title
    return { ...step, title, text }
  })
}

function clampPromptStep(row: unknown): PromptStep | null {
  if (!row || typeof row !== 'object') return null
  const o = row as Record<string, unknown>
  const id = typeof o.id === 'string' ? o.id.trim() : ''
  if (!id) return null
  const def = DEFAULT_BY_ID.get(id)
  const title =
    typeof o.title === 'string' && o.title.trim().length > 0 ? o.title.trim() : def?.title ?? 'Neuer Prompt'
  const text = typeof o.text === 'string' ? o.text : def?.text ?? ''
  return { id, title, text }
}

function ensureDefaultEarningsPrompts(steps: PromptStep[]): PromptStep[] {
  const out = [...steps]
  const order = [...EARNINGS_PROMPT_IDS]

  for (const id of order) {
    if (out.some((s) => s.id === id)) continue
    const def = DEFAULT_BY_ID.get(id)
    if (!def) continue

    const selfOrder = order.indexOf(id)
    let insertAt = out.length
    for (let j = selfOrder - 1; j >= 0; j--) {
      const prevId = order[j]
      const p = out.findIndex((s) => s.id === prevId)
      if (p >= 0) {
        insertAt = p + 1
        break
      }
    }
    if (insertAt === out.length) {
      for (let j = selfOrder + 1; j < order.length; j++) {
        const nextId = order[j]
        const n = out.findIndex((s) => s.id === nextId)
        if (n >= 0) {
          insertAt = n
          break
        }
      }
    }
    out.splice(insertAt, 0, { ...def })
  }
  return out
}

/** Gespeicherte v2-Liste übernehmen (ohne gelöschte Einträge automatisch wieder einzufügen). */
function normalizeV2Steps(rows: unknown[]): PromptStep[] {
  const seen = new Set<string>()
  const steps: PromptStep[] = []
  for (const row of rows) {
    const s = clampPromptStep(row)
    if (!s || seen.has(s.id)) continue
    seen.add(s.id)
    steps.push(s)
  }
  return ensureDefaultEarningsPrompts(steps)
}

function loadStepsFromStorage(): PromptStep[] {
  try {
    const rawPrimary = window.localStorage.getItem(STORAGE_KEY)
    const rawLegacy = window.localStorage.getItem(STORAGE_KEY_LEGACY)
    const raw = rawPrimary ?? rawLegacy
    if (!raw) return [...DEFAULT_STEPS]
    const parsed = JSON.parse(raw) as unknown
    if (
      parsed &&
      typeof parsed === 'object' &&
      !Array.isArray(parsed) &&
      (parsed as PersistFileV2).v >= 2 &&
      Array.isArray((parsed as PersistFileV2).steps)
    ) {
      return normalizeV2Steps((parsed as PersistFileV2).steps)
    }
    if (Array.isArray(parsed)) return migrateLegacyPromptArray(parsed)
  } catch {
    /* ignore */
  }
  return [...DEFAULT_STEPS]
}

function persistSteps(steps: PromptStep[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ v: 3, steps } satisfies PersistFileV2))
}

export function InvestmentResearchPrompts({ embedded = false }: { embedded?: boolean }) {
  const [steps, setSteps] = useState<PromptStep[]>(DEFAULT_STEPS)
  const [loaded, setLoaded] = useState(false)
  const [promptsPanelOpen, setPromptsPanelOpen] = useState(false)
  const [sectionOpen, setSectionOpen] = useState(false)
  const [earningsOpen, setEarningsOpen] = useState(false)
  const [earningsCallOpen, setEarningsCallOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    void Promise.resolve().then(() => {
      if (cancelled) return
      setSteps(loadStepsFromStorage())
      setLoaded(true)
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!loaded) return
    persistSteps(steps)
  }, [steps, loaded])

  const analysisSteps = useMemo(
    () => steps.filter((s) => !EARNINGS_PROMPT_ID_SET.has(s.id)),
    [steps],
  )
  const earningsStep = useMemo(() => steps.find((s) => s.id === 'earningsanalyse') ?? null, [steps])
  const earningsCallStep = useMemo(
    () => steps.find((s) => s.id === 'earnings-call-transcript') ?? null,
    [steps],
  )
  const totalChars = useMemo(() => analysisSteps.reduce((acc, s) => acc + s.text.length, 0), [analysisSteps])

  async function copyStepText(step: PromptStep) {
    try {
      await navigator.clipboard.writeText(step.text)
      toast.success(`${step.title} kopiert`)
    } catch {
      toast.error('Kopieren fehlgeschlagen')
    }
  }

  function resetStep(stepId: string) {
    const original = DEFAULT_BY_ID.get(stepId)
    if (!original) return
    setSteps((prev) => prev.map((s) => (s.id === stepId ? { ...original } : s)))
    toast.success('Prompt zurückgesetzt')
  }

  function restoreAllDefaults() {
    if (
      !window.confirm(
        'Alle Prompts auf die Standardversion zurücksetzen? Eigene Prompts und Änderungen gehen verloren.',
      )
    )
      return
    setSteps([...DEFAULT_STEPS])
    toast.success('Alle Standard-Prompts wiederhergestellt')
  }

  function addPrompt() {
    const id = `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`
    let insertAt = steps.length
    for (const eid of EARNINGS_PROMPT_IDS) {
      const i = steps.findIndex((s) => s.id === eid)
      if (i >= 0 && i < insertAt) insertAt = i
    }
    const next: PromptStep = { id, title: 'Neuer Prompt', text: '' }
    setSteps((prev) => [...prev.slice(0, insertAt), next, ...prev.slice(insertAt)])
    setPromptsPanelOpen(true)
    setSectionOpen(true)
    toast.success('Prompt hinzugefügt')
  }

  function deletePrompt(stepId: string) {
    if (EARNINGS_PROMPT_ID_SET.has(stepId)) return
    if (!window.confirm('Diesen Prompt wirklich löschen?')) return
    setSteps((prev) => prev.filter((s) => s.id !== stepId))
    toast.success('Prompt gelöscht')
  }

  function updateStep(stepId: string, patch: Partial<Pick<PromptStep, 'title' | 'text'>>) {
    setSteps((prev) => prev.map((s) => (s.id === stepId ? { ...s, ...patch } : s)))
  }

  const shell = embedded ? 'space-y-3' : 'rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4'

  return (
    <section className={shell}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Prompts</p>
          <h2 className={`font-semibold tracking-tight text-white ${embedded ? 'text-base' : 'text-lg'}`}>
            Analyse-Prompts
          </h2>
          <p className="mt-1 text-sm text-zinc-400">
            {analysisSteps.length} Schritte · {totalChars.toLocaleString('de-DE')} Zeichen
          </p>
          <button
            type="button"
            onClick={restoreAllDefaults}
            className="mt-2 text-xs font-medium text-zinc-500 underline-offset-2 transition hover:text-teal-400 hover:underline"
          >
            Alle Standard-Prompts wiederherstellen
          </button>
        </div>
        <CollapsiblePillButton
          open={promptsPanelOpen}
          onClick={() => setPromptsPanelOpen((v) => !v)}
          labels={LABEL_ZUKLAPPEN}
          compact
          aria-expanded={promptsPanelOpen}
        />
      </div>

      <CollapsibleAnimatedBody open={promptsPanelOpen} className="mt-3">
        <div className="overflow-hidden rounded-xl border border-zinc-800/90 bg-zinc-950/30">
          <button
            type="button"
            onClick={() => setSectionOpen((v) => !v)}
            className="group flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-medium text-white transition hover:bg-zinc-900/60"
            aria-expanded={sectionOpen}
          >
            <span>Unternehmensanalyse ({analysisSteps.length} Schritte)</span>
            <CollapsibleRowHeaderEnd open={sectionOpen} labels={LABEL_ZUKLAPPEN} size="sm" />
          </button>
          {!sectionOpen ? null : (
            <div className="space-y-3 border-t border-zinc-800/90 bg-zinc-950/20 p-4">
              {analysisSteps.map((step) => (
                <article key={step.id} className="rounded-xl border border-zinc-800/80 bg-zinc-950/50 px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800/60 pb-3">
                    <h3 className="min-w-0 text-sm font-medium text-white">{step.title || 'Ohne Titel'}</h3>
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => void copyStepText(step)}
                        className="rounded-lg bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-teal-600"
                      >
                        Kopieren
                      </button>
                      <button
                        type="button"
                        onClick={() => deletePrompt(step.id)}
                        className="rounded-lg border border-rose-900/80 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-rose-300 transition hover:bg-rose-950/50"
                      >
                        Löschen
                      </button>
                      {DEFAULT_BY_ID.has(step.id) ? (
                        <button
                          type="button"
                          onClick={() => resetStep(step.id)}
                          className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:bg-zinc-800"
                        >
                          Zurücksetzen
                        </button>
                      ) : null}
                    </div>
                  </div>
                  <div className="mt-3 space-y-3">
                    <div>
                      <label
                        htmlFor={`research-prompt-title-${step.id}`}
                        className="mb-1 block text-xs font-medium text-zinc-500"
                      >
                        Titel (bearbeiten)
                      </label>
                      <input
                        id={`research-prompt-title-${step.id}`}
                        type="text"
                        value={step.title}
                        onChange={(e) => updateStep(step.id, { title: e.target.value })}
                        className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-zinc-600"
                        autoComplete="off"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor={`research-prompt-body-${step.id}`}
                        className="mb-1 block text-xs font-medium text-zinc-500"
                      >
                        Prompt-Text (bearbeiten)
                      </label>
                      <textarea
                        id={`research-prompt-body-${step.id}`}
                        value={step.text}
                        onChange={(e) => updateStep(step.id, { text: e.target.value })}
                        className="min-h-[14rem] w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-sm leading-relaxed text-zinc-200 outline-none focus:ring-2 focus:ring-zinc-600"
                        spellCheck={false}
                      />
                    </div>
                  </div>
                </article>
              ))}
              <button
                type="button"
                onClick={addPrompt}
                className="w-full rounded-xl border border-dashed border-zinc-700 bg-zinc-950/40 px-4 py-3 text-sm font-medium text-zinc-400 transition hover:border-teal-700/55 hover:bg-zinc-900/50 hover:text-teal-200"
              >
                + Prompt hinzufügen
              </button>
            </div>
          )}
        </div>

        {earningsStep ? (
          <div className="mt-3 overflow-hidden rounded-xl border border-zinc-800/90 bg-zinc-950/30">
            <button
              type="button"
              onClick={() => setEarningsOpen((v) => !v)}
              className="group flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-medium text-white transition hover:bg-zinc-900/60"
              aria-expanded={earningsOpen}
            >
              <span>Earningsanalyse</span>
              <CollapsibleRowHeaderEnd open={earningsOpen} labels={LABEL_ZUKLAPPEN} size="sm" />
            </button>
            <CollapsibleAnimatedBody open={earningsOpen} className="border-t border-zinc-800/90">
              <div className="space-y-3 p-4">
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => void copyStepText(earningsStep)}
                    className="rounded-lg bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-teal-600"
                  >
                    Kopieren
                  </button>
                  <button
                    type="button"
                    disabled
                    title="Dieser Standard-Prompt kann nicht gelöscht werden."
                    className="cursor-not-allowed rounded-lg border border-zinc-800 bg-zinc-900/80 px-3 py-1.5 text-xs font-medium text-zinc-600"
                  >
                    Löschen
                  </button>
                  <button
                    type="button"
                    onClick={() => resetStep(earningsStep.id)}
                    className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:bg-zinc-800"
                  >
                    Zurücksetzen
                  </button>
                </div>
                <div className="space-y-3">
                  <div>
                    <label
                      htmlFor={`research-prompt-title-${earningsStep.id}`}
                      className="mb-1 block text-xs font-medium text-zinc-500"
                    >
                      Titel (bearbeiten)
                    </label>
                    <input
                      id={`research-prompt-title-${earningsStep.id}`}
                      type="text"
                      value={earningsStep.title}
                      onChange={(e) => updateStep(earningsStep.id, { title: e.target.value })}
                      className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-zinc-600"
                      autoComplete="off"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor={`research-prompt-body-${earningsStep.id}`}
                      className="mb-1 block text-xs font-medium text-zinc-500"
                    >
                      Prompt-Text (bearbeiten)
                    </label>
                    <textarea
                      id={`research-prompt-body-${earningsStep.id}`}
                      value={earningsStep.text}
                      onChange={(e) => updateStep(earningsStep.id, { text: e.target.value })}
                      className="min-h-[14rem] w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-sm leading-relaxed text-zinc-200 outline-none focus:ring-2 focus:ring-zinc-600"
                      spellCheck={false}
                    />
                  </div>
                </div>
              </div>
            </CollapsibleAnimatedBody>
          </div>
        ) : null}

        {earningsCallStep ? (
          <div className="mt-3 overflow-hidden rounded-xl border border-zinc-800/90 bg-zinc-950/30">
            <button
              type="button"
              onClick={() => setEarningsCallOpen((v) => !v)}
              className="group flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-medium text-white transition hover:bg-zinc-900/60"
              aria-expanded={earningsCallOpen}
            >
              <span>Earnings Call (Transkript)</span>
              <CollapsibleRowHeaderEnd open={earningsCallOpen} labels={LABEL_ZUKLAPPEN} size="sm" />
            </button>
            <CollapsibleAnimatedBody open={earningsCallOpen} className="border-t border-zinc-800/90">
              <div className="space-y-3 p-4">
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => void copyStepText(earningsCallStep)}
                    className="rounded-lg bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-teal-600"
                  >
                    Kopieren
                  </button>
                  <button
                    type="button"
                    disabled
                    title="Dieser Standard-Prompt kann nicht gelöscht werden."
                    className="cursor-not-allowed rounded-lg border border-zinc-800 bg-zinc-900/80 px-3 py-1.5 text-xs font-medium text-zinc-600"
                  >
                    Löschen
                  </button>
                  <button
                    type="button"
                    onClick={() => resetStep(earningsCallStep.id)}
                    className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:bg-zinc-800"
                  >
                    Zurücksetzen
                  </button>
                </div>
                <div className="space-y-3">
                  <div>
                    <label
                      htmlFor={`research-prompt-title-${earningsCallStep.id}`}
                      className="mb-1 block text-xs font-medium text-zinc-500"
                    >
                      Titel (bearbeiten)
                    </label>
                    <input
                      id={`research-prompt-title-${earningsCallStep.id}`}
                      type="text"
                      value={earningsCallStep.title}
                      onChange={(e) => updateStep(earningsCallStep.id, { title: e.target.value })}
                      className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-zinc-600"
                      autoComplete="off"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor={`research-prompt-body-${earningsCallStep.id}`}
                      className="mb-1 block text-xs font-medium text-zinc-500"
                    >
                      Prompt-Text (bearbeiten)
                    </label>
                    <textarea
                      id={`research-prompt-body-${earningsCallStep.id}`}
                      value={earningsCallStep.text}
                      onChange={(e) => updateStep(earningsCallStep.id, { text: e.target.value })}
                      className="min-h-[14rem] w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-sm leading-relaxed text-zinc-200 outline-none focus:ring-2 focus:ring-zinc-600"
                      spellCheck={false}
                    />
                  </div>
                </div>
              </div>
            </CollapsibleAnimatedBody>
          </div>
        ) : null}
      </CollapsibleAnimatedBody>
    </section>
  )
}
