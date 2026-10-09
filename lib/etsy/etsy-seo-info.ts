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
    was: 'Misst echte Etsy-Suchpositionen der fünf Kernbegriffe über Apify (nicht die schwache Open-API).',
    wie: 'APIFY_API_TOKEN in .env.local + Vercel setzen. Einmal Actor omkar-cloud/etsy-scraper auf Apify „Try for free“. Dann Button — Lauf dauert oft 1–3 Minuten und kostet Free-Credits.',
    gut: 'Zellen zeigen S.1/#… oder „fehlt“ erst nach einer Probe mit ≥48 Treffern. Alle 1–2 Wochen reicht.',
    achtung:
      'Ohne Token: Messung schlägt fehl (richtig so). Nicht täglich klicken — Free-Credits schonen. Alte API-„fehlt“-Zellen zählen nicht als Ergebnis.',
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
    wie: 'Button neben dem Listing. Die KI behält alle fünf Fokus-Keywords als Tags und setzt das schwächste vorne im Titel. Kein Diff-Schritt — Push passiert automatisch.',
    gut: 'Sinnvoll vor allem bei Listings mit wenigen Aufrufen. Danach erneut Ranks messen.',
    achtung:
      'Bei vielen Aufrufen oft unnötig — das Listing bekommt schon Traffic (Favoriten, Shop, andere Suche). Live-Push nicht spammen. Steht die Messung auf API/unsicher, zuerst auf Etsy.de selbst prüfen.',
  },
  keywordsFuenf: {
    was: 'Die fünf Begriffe, die für gedrechselte Schalen am relevantesten für deinen Shop sind — fest hinterlegt, nicht aus der Merkliste gemischt.',
    wie: 'Sie gelten für die ganze Matrix. Jedes Listing wird gegen genau diese fünf Phrasen gemessen und beim Optimieren geschützt bzw. gestärkt.',
    gut: 'Einheitliche Messung: vergleichbar über alle Schalen hinweg.',
    achtung:
      'Vasen oder Dosen passen inhaltlich nicht immer zu „Schale“-Keywords. Für reine Vasen-Listings die Zellen mit Vorsicht lesen.',
  },
  score: {
    was: 'Links: SEO-Score (0–100). Darunter: Aufrufe laut Etsy (Lifetime) und Preis. Aufrufe zeigen, ob das Listing schon Traffic bekommt — unabhängig von der Rank-Probe.',
    wie: 'Viele Aufrufe + „fehlt“ in der Matrix = oft Mess-Proxy, nicht tot. Wenige Aufrufe + schwach = eher Kandidat für „Ranking optimieren“.',
    gut: '80+ Score und steigende Aufrufe = Listing läuft. Dann eher Fotos/Preis als Titel drehen.',
    achtung: 'Score ≠ Ranking. Aufrufe können auch aus Shop-Besuchern oder Favoriten kommen, nicht nur aus den fünf Kernbegriffen.',
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
