/** Statischer Inhalt: Führungspfad Stellv. Leiter Hartware. */

export const FUEHRUNG_MANTRA_DEFAULT = `Ich bin Stellvertretender Leiter Hartware — nicht der Hilfe-Assistent des Hauses.

Mein Wert liegt in Entscheidungen, Prioritäten und Verantwortung — nicht darin, jedes Problem selbst zu lösen.

Wenn ich alles beantworte, trainiere ich Abhängigkeit.
Wenn ich nachfrage und freigebe, trainiere ich Können.

Nein zu Soforthilfe ist Ja zu Führung.
Freundlich bleiben. Bestimmt bleiben. Erreichbar bleiben — aber nicht verfügbar für alles.`

export type FuehrungPrinzip = {
  id: string
  titel: string
  text: string
}

export const FUEHRUNG_PRINZIPIEN: FuehrungPrinzip[] = [
  {
    id: 'pause',
    titel: 'Pause vor dem Ja',
    text: 'Drei Sekunden. Atmen. Dann entscheiden: selbst, später, oder zurückgeben.',
  },
  {
    id: 'coachen',
    titel: 'Nicht lösen — coachen',
    text: 'Zuerst Gegenfrage. Wer selbst denkt, wächst. Wer nur abholt, bleibt abhängig.',
  },
  {
    id: 'prioritaet',
    titel: 'Meine Arbeit zuerst',
    text: 'Du wirst für schwierigere Arbeit bezahlt. Unterbrechungen sind teuer — schütze Fokusblöcke.',
  },
  {
    id: 'klarheit',
    titel: 'Respekt durch Klarheit',
    text: 'Nett sein heißt nicht Ja sagen. Klar und ruhig wirkt stärker als immer verfügbar.',
  },
]

export type FuehrungSkript = {
  id: string
  situation: string
  satz: string
}

export const FUEHRUNG_SKRIPTE: FuehrungSkript[] = [
  {
    id: 'versuch',
    situation: 'Jemand will eine schnelle Antwort, ohne selbst nachzudenken',
    satz: 'Was hast du schon versucht? Zeig mir kurz deinen Stand — dann schauen wir weiter.',
  },
  {
    id: 'empfehlung',
    situation: 'Entscheidung wird an dich abgeschoben',
    satz: 'Was ist deine Empfehlung? Entscheide das — ich vertraue dir dabei.',
  },
  {
    id: 'spaeter',
    situation: 'Du bist mit wichtiger Arbeit beschäftigt',
    satz: 'Ich bin gerade an etwas Wichtigem. Komm in 30 Minuten wieder / frag erst X.',
  },
  {
    id: 'grenze',
    situation: 'Dauerhafte Nutzung als Alleskönner',
    satz: 'Das liegt in deinem Bereich. Wenn du feststeckst, komm mit einem konkreten Vorschlag.',
  },
  {
    id: 'eskalation',
    situation: 'Wirklich deine Führungssache',
    satz: 'Das ist eine Führungsentscheidung — die nehme ich. Kurz den Kontext, dann entscheide ich.',
  },
  {
    id: 'nein-freundlich',
    situation: 'Klassisches Nein, ohne kalt zu wirken',
    satz: 'Heute nicht — sonst komme ich mit meiner Arbeit nicht weiter. Versuch es so … und melde dich, wenn du wirklich feststeckst.',
  },
]

export type FuehrungWoche = {
  nr: number
  titel: string
  fokus: string
  aufgaben: string[]
}

export const FUEHRUNG_WOCHEN: FuehrungWoche[] = [
  {
    nr: 1,
    titel: 'Wahrnehmen',
    fokus: 'Du siehst klar, wie oft du benutzt wirst — ohne dich sofort zu ändern.',
    aufgaben: [
      'Jede Unterbrechung kurz zählen (Strichliste / App).',
      'Bei jeder Bitte 3 Sekunden Pause — auch wenn du danach noch hilfst.',
      'Abends: 1 Satz „Wann habe ich mich heute benutzen lassen?“',
    ],
  },
  {
    nr: 2,
    titel: 'Gegenfragen',
    fokus: 'Du gibst Denken zurück, bevor du Wissen gibst.',
    aufgaben: [
      'Mindestens 5× „Was hast du schon versucht?“ / „Was ist deine Empfehlung?“',
      'Nur bei echten Führungsentscheidungen sofort selbst lösen.',
      'Einen Kollegen bewusst zum ersten Ansprechpartner für ein Thema machen.',
    ],
  },
  {
    nr: 3,
    titel: 'Fokus schützen',
    fokus: 'Deine Arbeit bekommt sichtbare Zeitfenster.',
    aufgaben: [
      'Täglich 2× 45–60 Min Fokusblock (Kopfhörer / „nicht stören“-Signal).',
      'In Fokuszeiten nur Eskalationen annehmen.',
      'Chef einmal kurz informieren: „Ich schütze Fokuszeiten — so arbeite ich.“',
    ],
  },
  {
    nr: 4,
    titel: 'Grenzen normalisieren',
    fokus: 'Nein und Später werden Alltag — nicht Ausnahme.',
    aufgaben: [
      'Mindestens 3 klare „Später / selbst entscheiden“ pro Tag.',
      'Ein Thema komplett abgeben (Dokumentation oder kurzes Briefing).',
      'Wenn jemand dich ausnutzt: einmal ruhig ansprechen, nicht nur innerlich ärgern.',
    ],
  },
  {
    nr: 5,
    titel: 'Team trägt',
    fokus: 'Das Team funktioniert auch ohne dich als Lexikon.',
    aufgaben: [
      'Einen Tag bewusst weniger Soforthilfe — messen, was trotzdem läuft.',
      'Nachfragen: „Wer außer mir kann das?“ → dorthin verweisen.',
      'Mit Teamleiter Lager / Marketing abstimmen: wer ist für was erster Ansprechpartner.',
    ],
  },
  {
    nr: 6,
    titel: 'Bilanz mit dem Chef',
    fokus: 'Du machst Fortschritt sichtbar — und holst Feedback.',
    aufgaben: [
      'Zahlen mitbringen: Redirects, Fokusblöcke, was das Team selbst löst.',
      'Gespräch mit Leiter Hartware: Was ist besser? Was noch nicht?',
      'Nächste 90 Tage: 2–3 Führungsgewohnheiten festziehen.',
    ],
  },
]

/** Gesprächs-Kontext (nur Anzeige, nicht speichern nötig). */
export const FUEHRUNG_KONTEXT = {
  rolle: 'Stellvertretender Leiter Hartware',
  unternehmen: 'Mittelständischer Ski-Onlinehändler · ~40 MA · ~80 % Hartware / 20 % Textil',
  ebenbuertig: 'Teamleiter Lager · Teamleiterin Marketing',
  ausloeser:
    'Feedback Leiter Hartware: Mitarbeiter nutzen Gutmütigkeit aus; du bist für alles erster Ansprechpartner. In 4–6 Wochen spürbar Führung zeigen — sonst „haben wir ein Problem“.',
  wahrheit:
    'Nett bleiben darfst du. Immer verfügbar sein und jedes Gehirn ersetzen — nicht. Respekt kommt von Klarheit, nicht von Dauerhilfe.',
}

export const FUEHRUNG_SITUATION_TYPEN = [
  { id: 'unterbrechung' as const, label: 'Unterbrechung', kurz: 'Unterbr.' },
  { id: 'abgeschoben' as const, label: 'Entscheidung abgeschoben', kurz: 'Abgeschoben' },
  { id: 'fuehrung' as const, label: 'Echtes Führungsthema', kurz: 'Führung' },
  { id: 'sonstiges' as const, label: 'Sonstiges', kurz: 'Sonst.' },
]

export const FUEHRUNG_REAKTIONEN = [
  { id: 'redirect' as const, label: 'Redirect / Gegenfrage', gut: true },
  { id: 'nein' as const, label: 'Nein gesagt', gut: true },
  { id: 'spaeter' as const, label: 'Später / Fokus geschützt', gut: true },
  { id: 'selbst' as const, label: 'Selbst gelöst (ok wenn Führung)', gut: false },
  { id: 'ausgenutzt' as const, label: 'Wieder ausgenutzt', gut: false },
]

export const FUEHRUNG_ABEND_FRAGEN = [
  'Habe ich heute Denken zurückgegeben — oder alles selbst gemacht?',
  'Wann habe ich mich benutzen lassen?',
  'Ein Win, den ich dem Chef erzählen könnte?',
]
