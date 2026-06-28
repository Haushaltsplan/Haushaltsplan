/** Kurze Erklärungen für Strava-Dashboard-Panels (deutsch, laienverständlich). */

export const STRAVA_PANEL_INFO = {
  kpiSummary:
    'Kennzahlen für den gewählten Zeitraum: Distanz, Fahrzeit, Höhenmeter und Anzahl der Einheiten. Der Vergleich bezieht sich auf die vorherige Periode (z. B. letzte Woche vs. die davor).',
  dataQuality:
    'Nach dem Import werden Strava-Rohdaten angereichert: Watt-Streams für Leistungskurven, Wetter, Segmente und aerobe Dekoupling. Das ist rechenintensiv und läuft in kleinen Schritten — nichts fehlt im Import.',
  filterExport:
    'Filtert die sichtbaren Auswertungen und den Feed. CSV und Saison-Review beziehen sich auf die gefilterte Auswahl. „Alles“ zeigt die komplette Historie in der Datenbank.',
  seasonGoals:
    'Persönliche Saisonziele (km, Höhenmeter, Fahrten pro Woche, Event). Fortschritt wird aus deinen Strava-Aktivitäten berechnet; das Event-Datum zeigt einen Countdown.',
  eftpProgress:
    'eFTP = geschätzte Functional Threshold Power pro Monat, abgeleitet aus deinen Power-Peaks. Ein steigender Trend bedeutet bessere Ausdauerleistung — vorausgesetzt Powermeter-Daten sind synchronisiert.',
  tssBudget:
    'TSS (Training Stress Score) misst Trainingsbelastung. Balken = wöchestliche Summe, gestrichelte Linie = dein Wochenziel. Grün = Ziel erreicht oder übertroffen.',
  tssAdherence:
    'Wie diszipliniert du dein Wochen-TSS-Ziel einhältst. Trefferquote = Anteil der Wochen am oder über dem Ziel; Streak = aktuelle Serie ohne Unterschreitung.',
  weatherPerformance:
    'Vergleicht deine Leistung bei verschiedenen Temperaturen (Open-Meteo). „Normalisiert“ rechnet auf 20 °C um — hilfreich, um heiße oder kalte Tage fair zu vergleichen.',
  prTimeline:
    'Chronologie deiner persönlichen Power-Rekorde (1 s, 5 min, 20 min …). Stern markiert kürzlich gesetzte PRs. Benötigt synchronisierte Watt-Streams.',
  quarterlyPower:
    'Power Curve je Kalenderquartal übereinander gelegt. So siehst du, ob deine Spitzen- und Ausdauerleistung über die Saison zunimmt.',
  heatmap:
    'Wann du trainierst: jede Zelle = ein Tag, Farbe = Trainingsstunden. Muster erkennen (z. B. nur Wochenenden) und Lücken vermeiden.',
  decoupling:
    'Aerobe Dekoupling: steigt die Herzfrequenz bei gleicher Leistung im Verlauf einer langen Fahrt? Unter ~5 % gilt als gute aerobe Effizienz. VI (Variability Index) zeigt, wie „spritzig“ die Leistung war.',
  gearSplit:
    'Aufteilung nach in Strava hinterlegtem Bike/Gear: Kilometer, Fahrten und Ø-Leistung pro Rad — ideal zum Vergleich Rennrad vs. MTB vs. Trainer.',
  segmentsRoutes:
    'Strava-Segmente = offizielle Streckenabschnitte mit Zeiten und KOM-Rang. Routen = wiederkehrende GPS-Strecken aus deinen Fahrten, auch ohne Segment.',
  formChart:
    'CTL (Fitness) = langfristige Belastung, ATL (Fatigue) = kurzfristige, TSB (Form) = CTL minus ATL. Positive TSB = eher erholt, negative = müde — klassisches PMC-Modell.',
  powerCurve:
    'Bestleistung in Watt über verschiedene Dauer (Sprint bis Ausdauer). Log-Achse: kurze und lange Intervalle vergleichbar. Orange = All-time, cyan = letzte 90 Tage.',
  consistency:
    'Wie regelmäßig du trainierst: aktuelle Streak in Wochen mit mindestens einer Einheit, plus Anteil aktiver Wochen an allen Wochen im Zeitraum.',
  intensityMix:
    'Verteilung der Zeit in leichten (Z1–2), moderaten (Z3) und harten (Z4–5) Zonen — Polarisation. Viel „Easy“ mit wenig „Hard“ entspricht oft einem gesunden Ausdauerprofil.',
  whoopBridge:
    'Verknüpft WHOOP-Recovery mit Strava-Belastung: war an Tagen mit hohem TSS am Folgetag die Recovery niedrig? Kein Ersatz für medizinische Beratung — nur Muster.',
  volumeChart:
    'Wöchentliche Kilometer nach Sportart gestapelt. Konsistentes Volume ist oft wichtiger als einzelne Spitzenwochen.',
  zoneDonut:
    'Zeigt, wo deine Trainingszeit verbracht wird: Herzfrequenz-Zonen (wenn HR-Daten da) oder Anteil Ride/Run/Sonstige.',
  speedTrend:
    'Durchschnittliches Tempo oder Pace über die Wochen — Trend bei ähnlichen Einheiten, nicht absolut mit anderen Sportarten vergleichen.',
  climbing:
    'Summe der Höhenmeter pro Kalenderwoche. Hilft, Belastung in den Bergen vs. Flachland zu planen.',
  yearCompare:
    'Year-to-date Vergleich mit dem gleichen Zeitpunkt im Vorjahr: km, Höhenmeter, Fahrten, Stunden — fairer Saisonvergleich.',
  activityFeed:
    'Deine letzten Aktivitäten mit den wichtigsten Metriken. Klick öffnet Details inkl. Karte (Route wird bei Bedarf nachgeladen).',
  powerCurveEmpty:
    'Ohne Powermeter-Streams keine Kurve. Mehrfach synchronisieren — pro Lauf werden bis zu 25 Fahrten mit Watt-/HF-Streams analysiert.',
  bodyWeight:
    'W/kg = Leistung geteilt durch dein Körpergewicht in Omnia (nicht Strava). Ohne Gewicht fehlen W/kg-Werte in Feed, PRs und Charts.',
  personalRecords:
    'Persönliche Bestleistungen aus allen importierten Strava-Aktivitäten — Distanz, Höhe, Leistung, Kalorien, Puls und Jahresrekorde.',
  wkgMonthly:
    'Monatlicher Durchschnitt W/kg nur aus Fahrten ≥20 Minuten mit Powermeter. Zeigt relative Leistungsentwicklung unabhängig vom Gewicht.',
  yearlyKm: 'Gesamtkilometer pro Kalenderjahr — alle importierten Sportarten, sofern nicht gefiltert.',
  yearlyRides: 'Anzahl der Aktivitäten pro Jahr — hilfreich für Konsistenz über mehrere Saisons.',
  yearlyHm: 'Summierte Höhenmeter pro Jahr — relevant für Bergtraining und Saisonplanung.',
  yearlyTable:
    'Jahresübersicht mit km, hm, Kalorien und Ø-Leistung — kompakte Langzeitbilanz deiner Strava-Historie.',
  kpiDistance: 'Summe der zurückgelegten Distanz aller Aktivitäten im gewählten Zeitraum.',
  kpiTime: 'Gesamte Trainingszeit (Fahrzeit) im gewählten Zeitraum.',
  kpiElevation: 'Summe der Höhenmeter — Aufstiege aus Strava-GPS und Höhendaten.',
  kpiCount: 'Anzahl der abgeschlossenen Einheiten im Zeitraum.',
} as const

export const STRAVA_BACKFILL_INFO: Record<string, string> = {
  streams:
    'Leistungs-, Trittfrequenz- und Pulsdaten sekündlich — Basis für Power Curve, eFTP, TSS und Dekoupling.',
  weather: 'Temperatur, Wind und Niederschlag zum Fahrtzeitpunkt (Open-Meteo) für Wetter-Auswertungen.',
  segments: 'Offizielle Strava-Segmentzeiten und KOM-Rankings aus deinen Fahrten.',
  decoupling: 'HR-Drift bei langen Ausdauerfahrten (>45 min) — aerobe Fitness im Zeitverlauf.',
}

export type StravaPanelInfoKey = keyof typeof STRAVA_PANEL_INFO
