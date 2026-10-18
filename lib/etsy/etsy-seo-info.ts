import type { EtsyInfoHintInhalt } from '@/components/etsy/etsy-info-hint'

/** Ausführliche Hover-Texte für das Etsy-SEO-Tool. */
export const ETSY_SEO_INFO = {
  uebersicht: {
    was: 'Hier siehst du alle aktiven Listings mit SEO-Score. Pro Listing: auditieren, Diff prüfen, dann Titel/Tags/Intro gezielt auf Etsy speichern.',
    wie: 'Listing öffnen → „Neu optimieren“ oder Audit laden → Vorschläge im Diff anpassen → Titel, Tags oder Intro übernehmen.',
    gut: 'Hauptbegriff vorne im Titel, genau 13 passende Tags, klare ersten Sätze (WAS / FÜR WEN / Nutzen).',
    achtung:
      'Nichts wird ohne deinen Klick auf Etsy geschrieben. Bei vielen Aufrufen eher Fotos/Preis prüfen als den Text umzubauen.',
  },
  score: {
    was: 'SEO-Score 0–100 aus Regeln + KI-Audit (Titel, Tags, Intro, Markt-Abdeckung).',
    wie: 'Unter 80 = eher nachziehen. Score allein verkauft nicht — Aufrufe und Fotos mitdenken.',
    gut: '80+ und steigende Aufrufe = Listing läuft. Dann eher ruhig lassen.',
    achtung: 'Score ≠ Verkauf. Viele Views ohne Kauf → Preis/Fotos/Trust, nicht nur Keywords.',
  },
  shopVerbinden: {
    was: 'Verbindet deinen Etsy-Shop per OAuth, damit die App Listings lesen und SEO-Updates speichern darf.',
    wie: '„Mit Etsy verbinden“ → bei Etsy erlauben → zurück in die App. Danach Tab „Meine Listings“.',
    gut: 'Status zeigt Shop-Namen und ID.',
    achtung: 'Ohne Verbindung kein Audit und kein Push auf Etsy.',
  },
  cockpit: {
    was: 'Tages-Überblick: dringende SEO-Aufgaben, Views-Einbrüche, Keyword-Lücken.',
    wie: 'Aufgaben der Reihe nach abarbeiten. Viele führen dich zu „Meine Listings“.',
    gut: 'Leere oder kurze Liste = wenig Feuer.',
    achtung: 'Cockpit ersetzt nicht den Diff-Check in „Meine Listings“.',
  },
  neuesListing: {
    was: 'Aus Fotos und Angaben einen SEO-fertigen Listing-Entwurf erzeugen.',
    wie: 'Fotos hochladen, Produktinfos prüfen, Entwurf speichern oder auf Etsy anlegen.',
    gut: 'Titel vorne mit Hauptbegriff, 13 Tags, klare ersten Sätze.',
    achtung: 'Nach dem Anlegen in „Meine Listings“ einmal auditieren und Diff prüfen.',
  },
  keywordsTab: {
    was: 'Recherche: welche Phrasen Käufer tippen (Etsy/Google/Amazon) und was in deinen Tags fehlt.',
    wie: 'Scan starten, Chancen prüfen, wichtige Phrasen merken — später als Hauptbegriff oder Tag nutzen.',
    gut: 'Merkliste für Long-Tails und Holzarten-Varianten.',
    achtung: 'Signale, keine Garantie. Phrasen nur übernehmen, wenn sie zum Produkt passen.',
  },
  konkurrenz: {
    was: 'Vergleich mit starken DE-Drechsler-Shops (Tags, Verkäufe, Preise).',
    wie: 'Shops beobachten, häufige Tags notieren, ggf. in eigene Listings übernehmen — ohne Copy.',
    gut: 'Du erkennst Marktlücken und überfüllte Phrasen.',
    achtung: 'Fremde Titel nicht 1:1 kopieren.',
  },
  zahlen: {
    was: 'Funnel-Zahlen: Views, Favoriten, Verkäufe — welche Listings „Zombies“ sind.',
    wie: 'Schwache Listings identifizieren und in „Meine Listings“ SEO nachziehen.',
    gut: 'Views steigen nach guter SEO oft zuerst, Verkäufe später.',
    achtung: 'Wenig Views bei gutem Score → Sichtbarkeit/Fotos; viele Views ohne Verkauf → Preis/Trust.',
  },
} as const satisfies Record<string, EtsyInfoHintInhalt>
