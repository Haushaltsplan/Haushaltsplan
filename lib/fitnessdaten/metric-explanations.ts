/** Kurzerklärungen für WHOOP-Metriken (Klick → Modal). */

export type MetricInfoId =
  | 'recovery'
  | 'strain'
  | 'sleep_score'
  | 'sleep_debt'
  | 'sleep_stress'
  | 'sleep_need'
  | 'sleep_hours'
  | 'restorative_sleep'
  | 'sleep_consistency'
  | 'time_in_bed'
  | 'sleep_efficiency'
  | 'hrv'
  | 'rhr'
  | 'respiratory'
  | 'sleep_performance'
  | 'behavior'
  | 'zones_13'
  | 'zones_45'
  | 'strength'
  | 'steps'
  | 'calories'
  | 'activities'
  | 'spo2'
  | 'skin_temp'
  | 'whoop_age'
  | 'sync'
  | 'activity_intensity'
  | 'aging_process'
  | 'vo2max'
  | 'health_monitor'
  | 'healthspan'

export type MetricInfo = {
  title: string
  body: string
  source?: string
}

export const METRIC_INFO: Record<MetricInfoId, MetricInfo> = {
  recovery: {
    title: 'Erholung',
    body: 'Misst, wie gut dein Körper regeneriert ist — hauptsächlich aus Herzfrequenzvariabilität (HFV) und Ruhepuls im Vergleich zu deinem 30-Tage-Schnitt. Grün = bereit für Belastung, rot = schonen.',
    source: 'Lokal aus HFV + Ruhepuls vs. Baseline',
  },
  strain: {
    title: 'Belastung',
    body: 'Kardiovaskuläre Belastung auf einer Skala von 0–21. Steigt mit Zeit in höheren Herzfrequenzzonen. WHOOP empfiehlt oft einen Bereich, der zu deiner Erholung passt.',
    source: 'Lokal aus HF-Zonen heute',
  },
  sleep_score: {
    title: 'Schlafleistung',
    body: 'Prozentualer Anteil deines Schlafbedarfs, den du erreichst hast. 100 % = Bedarf gedeckt. Beeinflusst deine Erholung am nächsten Tag.',
    source: 'Geschätzt aus Schlafdauer + Effizienz (IMU)',
  },
  sleep_debt: {
    title: 'Schlafdefizit',
    body: 'Kumulierte fehlende Schlafzeit gegenüber einem Ziel (~8 h). WHOOP addiert Defizite über mehrere Tage — ausreichend Schlaf reduziert das Defizit.',
    source: 'Ziel 8 h minus geschlafene Stunden',
  },
  sleep_stress: {
    title: 'Schlafstress',
    body: 'Zeigt, wie erholsam dein Schlaf war — aufgeteilt in hoch, mittel und niedrig. Hoher Anteil bedeutet mehr unruhige oder gestörte Phasen. Exakte WHOOP-Werte brauchen Cloud-Modelle; hier eine Näherung aus Schlafleistung.',
    source: 'Näherung aus Schlafleistung',
  },
  sleep_need: {
    title: 'Schlafbedarf',
    body: 'Die Stunden, die dein Körper laut Modell braucht — abhängig von Belastung, Schlafdefizit und Nap-Zeit. Steigt nach anstrengenden Tagen.',
    source: 'Basis 8 h + Belastungs-/Defizit-Zuschlag',
  },
  sleep_hours: {
    title: 'Stunden vs. Bedarf',
    body: 'Vergleicht tatsächlich geschlafene Stunden (blau) mit berechnetem Bedarf (grün). Liegt die blaue Linie unter der grünen, fehlt Schlaf.',
    source: 'IMU-Nachtschätzung + Bedarfsformel',
  },
  restorative_sleep: {
    title: 'Erholsamer Schlaf',
    body: 'Tiefschlaf (körperliche Regeneration) und REM-Schlaf (mentale Verarbeitung). WHOOP misst das am Handgelenk; hier geschätzt aus Ruhephasen der IMU.',
    source: 'Geschätzt (~40 % REM, ~25 % Tief)',
  },
  sleep_consistency: {
    title: 'Schlafregelmäßigkeit',
    body: 'Wie konstant deine Schlaf- und Aufwachzeiten sind. Regelmäßiger Rhythmus verbessert Erholung und HFV.',
    source: 'Varianz der Bett-/Weckzeiten (7 Tage)',
  },
  time_in_bed: {
    title: 'Zeit im Bett',
    body: 'Wann du ins Bett gegangen bist und wann du aufgestanden bist. Die Differenz ist nicht gleich Schlaf — Effizienz zählt die tatsächliche Schlafzeit.',
    source: 'IMU-Ruhefenster nachts',
  },
  sleep_efficiency: {
    title: 'Schlafeffizienz',
    body: 'Anteil der Zeit im Bett, in der du tatsächlich schläfst (nicht wach liegst). Über 85 % gilt als gut.',
    source: 'Bewegungsvarianz am Handgelenk',
  },
  hrv: {
    title: 'Herzfrequenzvariabilität (HFV)',
    body: 'Schwankungen zwischen Herzschlägen in Millisekunden (RMSSD). Höhere HFV = bessere Erholung und Anpassungsfähigkeit. Sinkt bei Stress, Krankheit, Alkohol.',
    source: 'RR-Intervalle vom Band (Standard-HR BLE)',
  },
  rhr: {
    title: 'Ruheherzfrequenz',
    body: 'Dein Puls in Ruhe. Niedriger ist meist besser. Steigt bei Erschöpfung, Dehydrierung oder Infekt.',
    source: 'Niedrigste HF-Werte der Session',
  },
  respiratory: {
    title: 'Atemfrequenz',
    body: 'Atemzüge pro Minute während des Schlafs. WHOOP nutzt optische Sensoren; hier geschätzt aus Ruhepuls-Abweichung zur Baseline.',
    source: 'Schätzung aus Ruhepuls',
  },
  sleep_performance: {
    title: 'Schlafleistung (Erholung)',
    body: 'Gleiche Metrik wie Schlafleistung — Anteil des erfüllten Schlafbedarfs. Erscheint in der Erholungsansicht, weil Schlaf die Recovery stark beeinflusst.',
    source: 'Schlaf-Score',
  },
  behavior: {
    title: 'Verhaltenseinblicke',
    body: 'WHOOP korreliert manuell getrackte Gewohnheiten (Alkohol, Koffein, Meditation …) mit Recovery. Das erfordert die WHOOP-App und Cloud — in Omnia nicht verfügbar.',
    source: 'Nur WHOOP Cloud',
  },
  zones_13: {
    title: 'HF-Zonen 1–3',
    body: 'Moderate Belastung — Alltag, Spazieren, leichte Ausdauer. Sammeln sich über den Tag und tragen zum Strain bei.',
    source: 'HF vs. geschätzte Max-HF',
  },
  zones_45: {
    title: 'HF-Zonen 4–5',
    body: 'Hohe bis maximale Belastung — intensives Training. Kurze Zeit in Zone 4–5 ist effektiv, erfordert aber Erholung danach.',
    source: 'HF vs. geschätzte Max-HF',
  },
  strength: {
    title: 'Kraftaktivitätszeit',
    body: 'Zeit mit Krafttraining oder hoher muskulärer Belastung. WHOOP erkennt das am Handgelenk; hier grob aus Zone 4–5 abgeleitet.',
    source: 'Näherung aus HF-Zonen',
  },
  steps: {
    title: 'Schritte',
    body: 'WHOOP zählt Schritte am Handgelenk. Omnia schätzt sie aus Kalorien und Zone-1–3-Zeit — nur Richtwert.',
    source: 'Geschätzt',
  },
  calories: {
    title: 'Kalorien',
    body: 'Geschätzter Energieverbrauch aus Herzfrequenz und Dauer in den Zonen. Kein exakter Kalorienzähler.',
    source: 'HR-basierte Formel',
  },
  activities: {
    title: 'Aktivitäten heute',
    body: 'Automatisch erkannte Belastungsphasen aus dem Pulssignal — wenn HF deutlich über Ruhepuls steigt und länger anhält.',
    source: 'HR-Verlauf-Analyse',
  },
  spo2: {
    title: 'Sauerstoffsättigung (SpO₂)',
    body: 'Anteil des sauerstoffgesättigten Blutes. WHOOP misst das nachts/am Morgen — der fertige Wert kommt aus der WHOOP-Cloud (Recovery), nicht aus dem Live-BLE-Stream. In Omnia: WHOOP-Konto verbinden und Cloud-Sync.',
    source: 'WHOOP Cloud Recovery (OAuth)',
  },
  skin_temp: {
    title: 'Hauttemperatur',
    body: 'Abweichung von deinem persönlichen Ausgangswert. Deutliche Anstiege können auf Krankheit oder Zyklus hinweisen.',
    source: 'Gen5-Events (fd4b)',
  },
  whoop_age: {
    title: 'WHOOP Age',
    body: 'Biologisches Alter basierend auf Schlaf, Belastung, Fitness und Gesundheitsdaten — proprietäres WHOOP-Cloud-Modell.',
    source: 'Nur WHOOP Cloud',
  },
  sync: {
    title: 'Daten-Synchronisation',
    body: 'Das WHOOP-Band speichert Messungen intern, wenn kein Telefon verbunden ist. Beim erneuten Verbinden lädt Omnia historische Pakete (Gen5 fd4b) nach und füllt Lücken in Charts und Tageswerten.',
    source: 'Gen5 Historie-Sync + lokaler Puffer',
  },
  activity_intensity: {
    title: 'Aktivitätsintensität',
    body: 'Aufteilung deiner Bewegung in niedrig, mittel und hoch — basierend auf Herzfrequenzzonen. Hilft zu sehen, wie intensiv der Tag war.',
    source: 'HF-Zonenverteilung',
  },
  aging_process: {
    title: 'Alterungsprozess',
    body: 'Multiplikator für dein biologisches Altern: 1,0× = normal, unter 1,0× = langsamer, darüber = schneller. Omnia schätzt das aus Recovery-Trend und Ruhepuls.',
    source: 'Recovery vs. 30-Tage-Baseline',
  },
  vo2max: {
    title: 'VO₂ Max',
    body: 'Maximale Sauerstoffaufnahme — Maß für Ausdauer. WHOOP schätzt das aus Ruhepuls und Max-HF. Omnia nutzt eine vereinfachte Formel aus deinen HF-Daten.',
    source: 'Geschätzt aus RHF + Max-HF',
  },
  health_monitor: {
    title: 'Gesundheitsmonitor',
    body: 'Tagesübersicht zentraler Vitalwerte mit Ampel-Status. Abweichungen von deiner Baseline werden farblich hervorgehoben.',
    source: 'Live-BLE + Tageswerte',
  },
  healthspan: {
    title: 'Omnia Age / Healthspan',
    body: 'Biologisches Alter aus Schlaf, Belastung, HFV und Fitness-Proxys — inspiriert von WHOOP Age, aber lokal berechnet ohne WHOOP-Cloud.',
    source: 'Lokales Modell (Approximation)',
  },
}

export function getMetricInfo(id: MetricInfoId): MetricInfo {
  return METRIC_INFO[id]
}
