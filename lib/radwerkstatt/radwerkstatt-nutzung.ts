import type { RadwerkstattArt, RadwerkstattArtikel } from '@/lib/radwerkstatt/radwerkstatt-types'

type Nutzung = {
  einsatz: string
  anwendung: string
  haltbarkeit: string
  rhythmus: string
}

const KLASSEN: Array<{ test: RegExp; nutzung: Nutzung }> = [
  {
    test: /heißwachs|heisswachs|hot wax/,
    nutzung: {
      einsatz: 'Heißwachs für die Kette',
      anwendung: 'Kette entfetten, ins flüssige Wachs tauchen, abkühlen lassen und überstehendes Wachs abknicken.',
      haltbarkeit: 'Bei Trockenheit hält eine Behandlung etwa 300–500 km, bei Nässe kürzer (typisch).',
      rhythmus: 'Neu wachsen, wenn die Kette quietscht oder nach längerem Regen (typisch).',
    },
  },
  {
    test: /kettenwachs|flüssigwachs|fluessigwachs|chain wax|graphitwachs|graphenwachs|drip wax|\bwachs\b|\bwax\b/,
    nutzung: {
      einsatz: 'Flüssigwachs für die Kette',
      anwendung: 'Auf die saubere, trockene Kette tropfen, kurz einziehen lassen und den Überschuss abwischen.',
      haltbarkeit: 'Bei Trockenheit hält eine Behandlung etwa 200–300 km, bei Nässe kürzer (typisch).',
      rhythmus: 'Nach jeder nassen Fahrt prüfen, sonst alle 200–300 km nachlegen (typisch).',
    },
  },
  {
    test: /kettenöl|kettenoel|chain lube|dry lube|wet lube|schmierstoff|schmiermittel|\blube\b|\böl\b/,
    nutzung: {
      einsatz: 'Kettenöl',
      anwendung: 'Auf jedes Kettenglied tropfen, einziehen lassen und den Überschuss abwischen.',
      haltbarkeit: 'Bei Trockenheit hält es etwa 150–300 km, Nässe wäscht es schneller ab (typisch).',
      rhythmus: 'Nach einer nassen Fahrt neu ölen, sonst alle 150–300 km (typisch).',
    },
  },
  {
    test: /reiniger|cleaner|entfetter|degreaser/,
    nutzung: {
      einsatz: 'Reiniger fürs Rad',
      anwendung: 'Auftragen, kurz einwirken lassen, dann abspülen oder abwischen. Nicht auf Bremsscheiben und Beläge sprühen.',
      haltbarkeit: 'Eine Flasche reicht für viele Wäschen (typisch).',
      rhythmus: 'Nach schmutzigen oder nassen Fahrten (typisch).',
    },
  },
  {
    test: /lagerfett|\bfett\b|grease|montagepaste/,
    nutzung: {
      einsatz: 'Fett für Lager und Gewinde',
      anwendung: 'Dünn auf das saubere Lager oder Gewinde geben, Überstand abwischen.',
      haltbarkeit: 'Eine Dose reicht für viele Lager (typisch).',
      rhythmus: 'Bei der Lagerwartung, etwa einmal im Jahr oder wenn es knackt (typisch).',
    },
  },
  {
    test: /dichtmilch|sealant|latexmilch/,
    nutzung: {
      einsatz: 'Dichtmilch für Tubeless',
      anwendung: 'In den Reifen füllen und schwenken, damit die Milch die Flanke benetzt.',
      haltbarkeit: 'Im Reifen etwa 2–6 Monate, dann erneuern (typisch).',
      rhythmus: 'Alle 2–6 Monate nachfüllen, früher wenn sie eintrocknet (typisch).',
    },
  },
  {
    test: /bremsbelag|brake pad|beläge|belaege/,
    nutzung: {
      einsatz: 'Bremsbeläge',
      anwendung: 'Bei der Verschleißmarke oder wenn die Bremse schleift tauschen, Scheibe nicht fetten.',
      haltbarkeit: 'Je nach Wetter und Strecke einige hundert bis ein paar tausend Kilometer (typisch).',
      rhythmus: 'Prüfen, wenn der Hebelweg länger wird oder es quietscht (typisch).',
    },
  },
  {
    test: /schlauch|inner tube/,
    nutzung: {
      einsatz: 'Ersatzschlauch',
      anwendung: 'Unter den abgehobenen Reifen legen, leicht anpumpen, Reifen zurücksetzen und auf Druck bringen.',
      haltbarkeit: 'Ein Schlauch hält, bis er ein Loch hat (typisch).',
      rhythmus: 'Als Ersatz dabeihaben und nach einem Platten einsetzen (typisch).',
    },
  },
  {
    test: /\bkette\b|\bchain\b/,
    nutzung: {
      einsatz: 'Verschleißteil Kette',
      anwendung: 'Mit der Kettenlehre prüfen und bei etwa 0,5 % Längung tauschen, bevor Kassette und Blätter mitleiden.',
      haltbarkeit: 'Gepflegt etwa 2000–5000 km, bei Nässe und Schmutz kürzer (typisch).',
      rhythmus: 'Alle paar hundert Kilometer messen (typisch).',
    },
  },
]

const WERKZEUG = /nieter|zange|pliers|werkzeug|\btool\b|multitool|drehmoment|reifenheber|kettenlehre|montageständer|werkstattständer|\bpumpe\b|standpumpe|minitool|heber/

export function nutzungZuName(name: string, zusatz = ''): Nutzung | null {
  const n = `${name} ${zusatz}`.toLowerCase()
  if (WERKZEUG.test(name.toLowerCase())) return null
  for (const klasse of KLASSEN) {
    if (klasse.test.test(n)) return klasse.nutzung
  }
  return null
}

export function artAusProdukt(name: string, zusatz = ''): RadwerkstattArt | null {
  if (WERKZEUG.test(name.toLowerCase())) return 'werkzeug'
  if (nutzungZuName(name, zusatz)) return 'verbrauch'
  return null
}

export function nutzungsText(nutzung: Nutzung): string {
  return `${nutzung.anwendung} ${nutzung.haltbarkeit} ${nutzung.rhythmus}`
}

function textIstNutzung(text: string): boolean {
  const t = text.trim()
  if (t.length < 40 || !/[.!?]$/.test(t)) return false
  const hatAnwendung = /tropf|abwisch|tauch|auftrag|aufsprüh|einwirk|entfett|lehre|füllen|fuellen/i.test(t)
  const hatDauer = /km|monat|anwendung|flasche|hält|näss|regen|quietsch|längung/i.test(t)
  return hatAnwendung && hatDauer
}

function einsatzBleibt(einsatz: string, zusammenfassung: string): boolean {
  const e = einsatz.trim()
  if (e.length < 2 || e.length > 56) return false
  const anfang = zusammenfassung.trim().toLowerCase().slice(0, 40)
  if (anfang && anfang.startsWith(e.toLowerCase().slice(0, 24))) return false
  return true
}

/** Verbrauchsgut: „Was es kann“ wird Anwendung, Haltbarkeit und Rhythmus. Abgeschnittener Werbetext wird ersetzt. */
export function artikelMitNutzung(artikel: RadwerkstattArtikel): RadwerkstattArtikel {
  const nutzung = nutzungZuName(artikel.name)
  if (!nutzung) return artikel
  const text = nutzungsText(nutzung)
  return {
    ...artikel,
    art: 'verbrauch',
    einsatzbereich: einsatzBleibt(artikel.einsatzbereich, artikel.zusammenfassung) ? artikel.einsatzbereich : nutzung.einsatz,
    zusammenfassung: textIstNutzung(artikel.zusammenfassung) ? artikel.zusammenfassung : text,
    haltbarkeit: artikel.haltbarkeit.trim() ? artikel.haltbarkeit : nutzung.haltbarkeit,
    verwendungsrhythmus: artikel.verwendungsrhythmus.trim() ? artikel.verwendungsrhythmus : nutzung.rhythmus,
  }
}
