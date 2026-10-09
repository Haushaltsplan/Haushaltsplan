import type { EtsyInfoHintInhalt } from '@/components/etsy/etsy-info-hint'

/** Ausführliche Hover-Texte für das Etsy-SEO-Tool. */
export const ETSY_SEO_INFO = {
  uebersicht: {
    was: 'Hier siehst du alle aktiven Listings und auf einen Blick, auf welcher Etsy-Seite sie unter den fünf wichtigsten Schalen-Suchbegriffen stehen.',
    wie: 'Zuerst „Ranks aktualisieren“ klicken (misst alle fünf Keywords für den ganzen Shop). Dann die farbigen Zellen lesen. Bei schwachen Werten „Ranking optimieren“ neben dem Listing.',
    gut: 'Grün = Seite 1, Gelb = Seite 2. Deine Schalen sind unter den Begriffen sichtbar, ohne dass du jedes Listing einzeln öffnen musst.',
    achtung:
      '„Nicht gefunden“ heißt: nicht in der gemessenen Probe. Steht „Probe dünn“ oder „API-Relevanz“, ist die Messung unsicher — dann einmal auf Etsy.de selbst nachschauen, bevor du massenhaft umschreibst.',
  },
  ranksAktualisieren: {
    was: 'Startet die Positionsmessung für genau diese fünf Suchbegriffe: gedrechselte Schale, Holzschale, Obstschale aus Holz, Holzschale Deko, gedrechselt.',
    wie: 'Ein Klick reicht. Die App sucht jedes Keyword einmal und prüft, wo deine Listings in der Trefferliste stehen. Danach aktualisieren sich die farbigen Zellen.',
    gut: 'Nach dem Lauf siehst du Seite und Platz pro Keyword. Der Lauf kann 30–90 Sekunden dauern.',
    achtung:
      'Etsy blockiert oft die echte Suchseite. Dann nutzen wir die Open-API als Näherung (Hinweis „API-Relevanz“). Das ist ein Proxy, kein 1:1-Browser-Ranking.',
  },
  rankZelle: {
    was: 'Eine Zelle = Position dieses Listings unter genau diesem Suchbegriff.',
    wie: 'Grün S.1, Gelb S.2, Rot Seite ≥3 oder nicht gefunden. Zahl darunter = ungefährer Platz in der Trefferliste (Platz 1 = ganz oben).',
    gut: 'Ideal: möglichst viele grüne Zellen bei den fünf Kernbegriffen, ohne den Titel mit Keywords zu stopfen.',
    achtung:
      'Ein Listing muss nicht unter allen fünf Begriffen Seite 1 sein. „gedrechselt“ allein ist sehr breit und konkurrenzstark — dort oft schwerer.',
  },
  rankingOptimieren: {
    was: 'Ein Klick schreibt Titel, Tags und Intro neu, stärkt das schwächste der fünf Keywords und speichert die Änderung direkt auf Etsy.',
    wie: 'Button neben dem Listing. Die KI muss alle fünf Fokus-Keywords als Tags behalten und das schwächste vorne im Titel setzen. Du brauchst keinen Diff-Schritt — der Push passiert automatisch.',
    gut: 'Danach erneut „Ranks aktualisieren“. Ziel: das schwache Keyword verbessert sich, die anderen bleiben mindestens so gut wie zuvor (Schutzliste).',
    achtung:
      'Änderungen gehen live auf Etsy. Rankings brauchen oft Stunden bis Tage. Nicht mehrmals hintereinander denselben Button spammen — einmal optimieren, messen, warten.',
  },
  keywordsFuenf: {
    was: 'Die fünf Begriffe, die für gedrechselte Schalen am relevantesten für deinen Shop sind — fest hinterlegt, nicht aus der Merkliste gemischt.',
    wie: 'Sie gelten für die ganze Matrix. Jedes Listing wird gegen genau diese fünf Phrasen gemessen und beim Optimieren geschützt bzw. gestärkt.',
    gut: 'Einheitliche Messung: vergleichbar über alle Schalen hinweg.',
    achtung:
      'Vasen oder Dosen passen inhaltlich nicht immer zu „Schale“-Keywords. Für reine Vasen-Listings die Zellen mit Vorsicht lesen.',
  },
  score: {
    was: 'SEO-/GEO-Score aus dem letzten Audit (0–100): Regelchecks + KI-Bewertung von Titel, Tags und Beschreibung.',
    wie: 'Nur Orientierung. Hoher Score heißt nicht automatisch Seite 1 — und umgekehrt.',
    gut: '80+ ist solide. Darunter lohnt ein Blick auf fehlende Maße, Tags oder Hauptbegriff.',
    achtung: 'Score und Ranking sind zwei Dinge. Optimiere für Ranking über den Button „Ranking optimieren“, nicht nur über den Score.',
  },
  shopVerbinden: {
    was: 'Verbindet deinen Etsy-Shop per OAuth, damit die App Listings lesen und SEO-Updates speichern darf.',
    wie: '„Mit Etsy verbinden“ → bei Etsy erlauben → zurück in die App. Danach Tab „Meine Listings“.',
    gut: 'Status zeigt Shop-Namen und ID.',
    achtung: 'Ohne Verbindung keine Ranks und kein Push auf Etsy.',
  },
  cockpit: {
    was: 'Tages-Überblick: dringende SEO-Aufgaben, Views-Einbrüche, Keyword-Lücken.',
    wie: 'Aufgaben der Reihe nach abarbeiten. Viele führen dich zu „Meine Listings“.',
    gut: 'Leere oder kurze Liste = wenig Feuer.',
    achtung: 'Cockpit ersetzt nicht die Rank-Matrix — für Schalen-Positionen immer „Meine Listings“.',
  },
  neuesListing: {
    was: 'Aus Fotos und Angaben einen SEO-fertigen Listing-Entwurf erzeugen.',
    wie: 'Fotos hochladen, Produktinfos prüfen, Entwurf speichern oder auf Etsy anlegen.',
    gut: 'Titel vorne mit Hauptbegriff, 13 Tags, klare ersten Sätze.',
    achtung: 'Nach dem Anlegen einmal in „Meine Listings“ die Ranks messen.',
  },
  keywordsTab: {
    was: 'Recherche: welche Phrasen Käufer tippen (Etsy/Google/Amazon) und was in deinen Tags fehlt.',
    wie: 'Scan starten, Chancen prüfen, wichtige Phrasen merken. Die Rank-Matrix nutzt aber die fünf festen Schalen-Begriffe.',
    gut: 'Merkliste für Long-Tails und Holzarten-Varianten.',
    achtung: 'Merkliste steuert nicht mehr die Haupt-Rank-Matrix — die fünf Kernbegriffe sind fest.',
  },
  konkurrenz: {
    was: 'Vergleich mit starken DE-Drechsler-Shops (Tags, Verkäufe, Preise).',
    wie: 'Shops beobachten, häufige Tags notieren, ggf. in eigene Listings übernehmen — ohne Copy.',
    gut: 'Du erkennst Marktlücken und überfüllte Phrasen.',
    achtung: 'Fremde Titel nicht 1:1 kopieren. Konkurrenz-Daten ergänzen die Rank-Matrix, ersetzen sie nicht.',
  },
  zahlen: {
    was: 'Funnel-Zahlen: Views, Favoriten, Verkäufe — welche Listings „Zombies“ sind.',
    wie: 'Schwache Listings identifizieren und in „Meine Listings“ SEO nachziehen.',
    gut: 'Views steigen nach Ranking-Optimierung oft zuerst, Verkäufe später.',
    achtung: 'Wenig Views bei gutem Score → eher Sichtbarkeit/Ranking; viele Views ohne Verkauf → Preis/Fotos/Trust.',
  },
} as const satisfies Record<string, EtsyInfoHintInhalt>
