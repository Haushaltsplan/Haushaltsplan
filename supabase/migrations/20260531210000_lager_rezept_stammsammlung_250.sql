-- 250 neue Standard-Rezepte (Stammsammlung Erweiterung).
-- Generiert von scripts/generate-rezept-stammsammlung-250.mjs
-- Idempotent: gleicher Titel wird nicht doppelt eingefügt.

-- Gemüsecurry mit Kokosmilch
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Gemüsecurry mit Kokosmilch',
  4,
  $g${
  "titel": "Gemüsecurry mit Kokosmilch",
  "portionen": 4,
  "kategorie": "Vegetarisch",
  "geschaetzte_kcal_gesamt": 1852,
  "zutaten": [
    {
      "name": "Kokosmilch",
      "menge": 400,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "rote Currypaste",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Gemüsemix (Paprika, Zucchini)",
      "menge": 500,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Ingwer",
      "menge": 20,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Reis (Beilage)",
      "menge": 300,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Limettensaft",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Koriander frisch",
      "menge": 10,
      "einheit": "g",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Arbeitsfläche freiräumen: große Pfanne oder Wok, Topf für Reis, Schöpfkelle, Küchenuhr und scharfes Messer bereitstellen.",
    "Reis parallel starten: 300 g Reis waschen, mit 450 ml Wasser salzen, aufkochen, Deckel, Stufe 1–2, 12–15 Min quellen lassen.",
    "Zwiebel schälen und fein würfeln, Ingwer und Knoblauch fein hacken — alles in Schälchen legen (Mise en place).",
    "Pfanne auf Herdstufe 6 von 9 stellen, 2 EL Öl erhitzen, Currypaste 1–2 Min anrösten, bis es duftet und leicht dunkler wird (nicht schwarz).",
    "Zwiebel und Ingwer 3–4 Min glasig dünsten, dann Gemüse in gleich großen Stücken zugeben und 4–5 Min anbraten oder mitgaren.",
    "Kokosmilch und passierte Tomaten einrühren, einmal aufkochen, Hitze auf Stufe 3–4 reduzieren.",
    "«Gemüsecurry mit Kokosmilch» 15–20 Min leicht köcheln lassen, gelegentlich rühren, bis die Soße sämig ist und leichtes Öl an der Oberfläche perlt.",
    "Mit Limettensaft, Salz, Pfeffer und optional 1 TL Zucker abschmecken (süß-sauer-salzig ausbalancieren).",
    "Reis mit einer Gabel auflockern, Curry auf tiefe Teller geben, frischen Koriander darüber streuen.",
    "Sofort heiß servieren; Reste 2 Tage kühl lagern und nur einmal vollständig durcherhitzen."
  ]
}$g$::jsonb,
  1852,
  NULL,
  'Vegetarisch'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Gemüsecurry mit Kokosmilch');

-- Spinat-Linsen-Dal
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Spinat-Linsen-Dal',
  4,
  $g${
  "titel": "Spinat-Linsen-Dal",
  "portionen": 4,
  "kategorie": "Vegetarisch",
  "geschaetzte_kcal_gesamt": 1503,
  "zutaten": [
    {
      "name": "rote Linsen",
      "menge": 250,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Spinat",
      "menge": 300,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Kokosmilch",
      "menge": 200,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Knoblauchzehen",
      "menge": 2,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Currypulver",
      "menge": 2,
      "einheit": "TL",
      "aus_lager": false
    },
    {
      "name": "Tomatenmark",
      "menge": 1,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Gemüsebrühe",
      "menge": 600,
      "einheit": "ml",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Großen Topf (4–5 l) und Schöpfkelle bereitstellen; Gemüse waschen, Enden entfernen, in gleichmäßige Würfel schneiden.",
    "Topf auf Herdstufe 6 von 9 stellen, 2 EL Öl oder Butter erhitzen, Zwiebel und Knoblauch 4 Min glasig dünsten.",
    "Hartes Gemüse (Karotten, Sellerie, Kartoffeln) 5–6 Min mit anschwitzen, gelegentlich rühren, nicht bräunen.",
    "Brühe (ca. 1–1,2 l) angießen, mit einem Spritzer einmal aufkochen, dann Hitze auf Stufe 3–4 reduzieren.",
    "Spinat-Linsen-Dal: 20–30 Min leicht köcheln, bis alles weich ist; mit dem Löffel prüfen — keine harten Stücke.",
    "Optional mit Stabmixer pürieren: Mixer tief ins Flüssige tauchen, kurze Pulse, Spritzer vermeiden; oder grob lassen.",
    "Mit Salz, Pfeffer, Muskat oder frischen Kräutern abschmecken; Konsistenz mit Wasser oder Sahne anpassen.",
    "Bei Bedarf Einlage (Nudeln, Croutons, Sahnehaube) separat zubereiten und erst beim Servieren zugeben.",
    "Suppe in vorgewärmte Schalen füllen, heiß servieren; Rest im Topf auf Stufe 2 warm halten."
  ]
}$g$::jsonb,
  1503,
  NULL,
  'Vegetarisch'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Spinat-Linsen-Dal');

-- Caprese-Salat
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Caprese-Salat',
  4,
  $g${
  "titel": "Caprese-Salat",
  "portionen": 4,
  "kategorie": "Vegetarisch",
  "geschaetzte_kcal_gesamt": 1553,
  "zutaten": [
    {
      "name": "Hauptzutat",
      "menge": 500,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Knoblauchzehen",
      "menge": 2,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Tomaten",
      "menge": 300,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Gemüsebrühe",
      "menge": 500,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Olivenöl",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Kräuter frisch",
      "menge": 15,
      "einheit": "g",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Salatschüssel und große Schüssel mit kaltem Wasser bereitstellen; Gemüse gründlich waschen und trocken schleudern.",
    "Blattsalat in mundgerechte Stücke zupfen oder schneiden — Messer vermeidet braune Schnittkanten.",
    "Festes Gemüse (Gurke, Paprika, Tomaten) in gleichmäßige Stücke schneiden, separat lagern.",
    "Dressing in kleiner Schüssel: Öl, Essig, Senf, Salz, Pfeffer mit Schneebesen emulgieren.",
    "Käse, Nüsse oder Croutons erst kurz vor dem Servieren zugeben (sonst weich).",
    "Salat mit Dressing vermengen — nur so viel, dass Blätter glänzen, nicht schwimmen.",
    "Sofort auf kühlen Tellern anrichten; bei Meal Prep Dressing separat mitgeben."
  ]
}$g$::jsonb,
  1553,
  NULL,
  'Vegetarisch'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Caprese-Salat');

-- Auberginen-Parmigiana
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Auberginen-Parmigiana',
  4,
  $g${
  "titel": "Auberginen-Parmigiana",
  "portionen": 4,
  "kategorie": "Vegetarisch",
  "geschaetzte_kcal_gesamt": 1586,
  "zutaten": [
    {
      "name": "Hauptzutat",
      "menge": 500,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Knoblauchzehen",
      "menge": 2,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Tomaten",
      "menge": 300,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Gemüsebrühe",
      "menge": 500,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Olivenöl",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Kräuter frisch",
      "menge": 15,
      "einheit": "g",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Ofen auf 180 °C Umluft vorheizen (nur Ober-/Unterhitze: +20 °C), Backblech mit Backpapier auslegen.",
    "Hauptzutat würzen, marinieren oder panieren wie im Rezept; Küchenthermometer bereitlegen bei Fleisch/Fisch.",
    "Ofenfeste Form oder Blech fetten oder mit Papier belegen, Zutaten in einer Schicht anordnen (gleichmäßige Hitze).",
    "In die mittlere Schiene schieben, 35–45 Min backen/braten — nicht zu früh die Tür öffnen (Temperaturverlust).",
    "Nach der Hälfte wenden oder begießen (Bratensoße, Marinade), Oberfläche soll goldbraun werden.",
    "Gargrad prüfen: Fisch 58–62 °C Kerntemperatur, Geflügel 74 °C, Rind medium ca. 55 °C (nach Ruhezeit).",
    "5–10 Min ruhen lassen unter Alufolie (locker), dann in Scheiben schneiden oder anrichten.",
    "Mit Beilage und heißer Sauce servieren; Ofenhandschuhe verwenden."
  ]
}$g$::jsonb,
  1586,
  NULL,
  'Vegetarisch'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Auberginen-Parmigiana');

-- Ratatouille aus dem Ofen
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Ratatouille aus dem Ofen',
  4,
  $g${
  "titel": "Ratatouille aus dem Ofen",
  "portionen": 4,
  "kategorie": "Vegetarisch",
  "geschaetzte_kcal_gesamt": 1785,
  "zutaten": [
    {
      "name": "Hauptzutat",
      "menge": 500,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Knoblauchzehen",
      "menge": 2,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Tomaten",
      "menge": 300,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Gemüsebrühe",
      "menge": 500,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Olivenöl",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Kräuter frisch",
      "menge": 15,
      "einheit": "g",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Ofen auf 180 °C Umluft vorheizen (nur Ober-/Unterhitze: +20 °C), Backblech mit Backpapier auslegen.",
    "Hauptzutat würzen, marinieren oder panieren wie im Rezept; Küchenthermometer bereitlegen bei Fleisch/Fisch.",
    "Ofenfeste Form oder Blech fetten oder mit Papier belegen, Zutaten in einer Schicht anordnen (gleichmäßige Hitze).",
    "In die mittlere Schiene schieben, 35–45 Min backen/braten — nicht zu früh die Tür öffnen (Temperaturverlust).",
    "Nach der Hälfte wenden oder begießen (Bratensoße, Marinade), Oberfläche soll goldbraun werden.",
    "Gargrad prüfen: Fisch 58–62 °C Kerntemperatur, Geflügel 74 °C, Rind medium ca. 55 °C (nach Ruhezeit).",
    "5–10 Min ruhen lassen unter Alufolie (locker), dann in Scheiben schneiden oder anrichten.",
    "Mit Beilage und heißer Sauce servieren; Ofenhandschuhe verwenden."
  ]
}$g$::jsonb,
  1785,
  NULL,
  'Vegetarisch'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Ratatouille aus dem Ofen');

-- Vegetarische Gemüselasagne
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Vegetarische Gemüselasagne',
  4,
  $g${
  "titel": "Vegetarische Gemüselasagne",
  "portionen": 4,
  "kategorie": "Vegetarisch",
  "geschaetzte_kcal_gesamt": 1854,
  "zutaten": [
    {
      "name": "Hauptzutat",
      "menge": 500,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Knoblauchzehen",
      "menge": 2,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Tomaten",
      "menge": 300,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Gemüsebrühe",
      "menge": 500,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Olivenöl",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Kräuter frisch",
      "menge": 15,
      "einheit": "g",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Ofen auf 180 °C Umluft vorheizen (nur Ober-/Unterhitze: +20 °C), Backblech mit Backpapier auslegen.",
    "Hauptzutat würzen, marinieren oder panieren wie im Rezept; Küchenthermometer bereitlegen bei Fleisch/Fisch.",
    "Ofenfeste Form oder Blech fetten oder mit Papier belegen, Zutaten in einer Schicht anordnen (gleichmäßige Hitze).",
    "In die mittlere Schiene schieben, 35–45 Min backen/braten — nicht zu früh die Tür öffnen (Temperaturverlust).",
    "Nach der Hälfte wenden oder begießen (Bratensoße, Marinade), Oberfläche soll goldbraun werden.",
    "Gargrad prüfen: Fisch 58–62 °C Kerntemperatur, Geflügel 74 °C, Rind medium ca. 55 °C (nach Ruhezeit).",
    "5–10 Min ruhen lassen unter Alufolie (locker), dann in Scheiben schneiden oder anrichten.",
    "Mit Beilage und heißer Sauce servieren; Ofenhandschuhe verwenden."
  ]
}$g$::jsonb,
  1854,
  NULL,
  'Vegetarisch'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Vegetarische Gemüselasagne');

-- Margherita-Pizza
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Margherita-Pizza',
  4,
  $g${
  "titel": "Margherita-Pizza",
  "portionen": 4,
  "kategorie": "Vegetarisch",
  "geschaetzte_kcal_gesamt": 1899,
  "zutaten": [
    {
      "name": "Pizzateig",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "passierte Tomaten",
      "menge": 200,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Mozzarella",
      "menge": 250,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Basilikum",
      "menge": 15,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Olivenöl",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Oregano getrocknet",
      "menge": 1,
      "einheit": "TL",
      "aus_lager": false
    },
    {
      "name": "Knoblauchzehen",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Ofen auf 180 °C Umluft vorheizen (nur Ober-/Unterhitze: +20 °C), Backblech mit Backpapier auslegen.",
    "Hauptzutat würzen, marinieren oder panieren wie im Rezept; Küchenthermometer bereitlegen bei Fleisch/Fisch.",
    "Ofenfeste Form oder Blech fetten oder mit Papier belegen, Zutaten in einer Schicht anordnen (gleichmäßige Hitze).",
    "In die mittlere Schiene schieben, 35–45 Min backen/braten — nicht zu früh die Tür öffnen (Temperaturverlust).",
    "Nach der Hälfte wenden oder begießen (Bratensoße, Marinade), Oberfläche soll goldbraun werden.",
    "Gargrad prüfen: Fisch 58–62 °C Kerntemperatur, Geflügel 74 °C, Rind medium ca. 55 °C (nach Ruhezeit).",
    "5–10 Min ruhen lassen unter Alufolie (locker), dann in Scheiben schneiden oder anrichten.",
    "Mit Beilage und heißer Sauce servieren; Ofenhandschuhe verwenden."
  ]
}$g$::jsonb,
  1899,
  NULL,
  'Vegetarisch'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Margherita-Pizza');

-- Shakshuka
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Shakshuka',
  4,
  $g${
  "titel": "Shakshuka",
  "portionen": 4,
  "kategorie": "Vegetarisch",
  "geschaetzte_kcal_gesamt": 1631,
  "zutaten": [
    {
      "name": "Hauptzutat",
      "menge": 500,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Knoblauchzehen",
      "menge": 2,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Tomaten",
      "menge": 300,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Gemüsebrühe",
      "menge": 500,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Olivenöl",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Kräuter frisch",
      "menge": 15,
      "einheit": "g",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Pfanne (28 cm) und Spatel bereitstellen; Zutaten in gleicher Größe schneiden, damit gleichzeitig gar sind.",
    "Pfanne 2 Min auf Herdstufe 7 von 9 leer vorwärmen, dann 2 EL Öl — es soll leicht schimmern.",
    "Fleisch oder Tofu zuerst bei hoher Hitze anbraten, nicht bewegen bis sich eine Kruste löst (2–3 Min), wenden.",
    "Gemüse zugeben, 4–6 Min mitbraten, Pfanne nicht überfüllen (sonst dämpft es).",
    "Sauce (Soja, Sahne, Brühe) einrühren, 2–3 Min einkochen lassen, bis die Soße am Spatel haftet.",
    "Mit Salz, Pfeffer, Kräutern abschmecken; Hitze reduzieren, 1 Min ziehen lassen.",
    "Sofort auf vorgewärmten Tellern servieren — Pfannengerichte verlieren schnell an Textur."
  ]
}$g$::jsonb,
  1631,
  NULL,
  'Vegetarisch'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Shakshuka');

-- Falafel mit Tahini
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Falafel mit Tahini',
  4,
  $g${
  "titel": "Falafel mit Tahini",
  "portionen": 4,
  "kategorie": "Vegetarisch",
  "geschaetzte_kcal_gesamt": 1582,
  "zutaten": [
    {
      "name": "Hauptzutat",
      "menge": 500,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Knoblauchzehen",
      "menge": 2,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Tomaten",
      "menge": 300,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Gemüsebrühe",
      "menge": 500,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Olivenöl",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Kräuter frisch",
      "menge": 15,
      "einheit": "g",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Pfanne (28 cm) und Spatel bereitstellen; Zutaten in gleicher Größe schneiden, damit gleichzeitig gar sind.",
    "Pfanne 2 Min auf Herdstufe 7 von 9 leer vorwärmen, dann 2 EL Öl — es soll leicht schimmern.",
    "Fleisch oder Tofu zuerst bei hoher Hitze anbraten, nicht bewegen bis sich eine Kruste löst (2–3 Min), wenden.",
    "Gemüse zugeben, 4–6 Min mitbraten, Pfanne nicht überfüllen (sonst dämpft es).",
    "Sauce (Soja, Sahne, Brühe) einrühren, 2–3 Min einkochen lassen, bis die Soße am Spatel haftet.",
    "Mit Salz, Pfeffer, Kräutern abschmecken; Hitze reduzieren, 1 Min ziehen lassen.",
    "Sofort auf vorgewärmten Tellern servieren — Pfannengerichte verlieren schnell an Textur."
  ]
}$g$::jsonb,
  1582,
  NULL,
  'Vegetarisch'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Falafel mit Tahini');

-- Vegetarische Bolognese
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Vegetarische Bolognese',
  4,
  $g${
  "titel": "Vegetarische Bolognese",
  "portionen": 4,
  "kategorie": "Vegetarisch",
  "geschaetzte_kcal_gesamt": 1700,
  "zutaten": [
    {
      "name": "Hauptzutat",
      "menge": 500,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Knoblauchzehen",
      "menge": 2,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Tomaten",
      "menge": 300,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Gemüsebrühe",
      "menge": 500,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Olivenöl",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Kräuter frisch",
      "menge": 15,
      "einheit": "g",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Pfanne (28 cm) und Spatel bereitstellen; Zutaten in gleicher Größe schneiden, damit gleichzeitig gar sind.",
    "Pfanne 2 Min auf Herdstufe 7 von 9 leer vorwärmen, dann 2 EL Öl — es soll leicht schimmern.",
    "Fleisch oder Tofu zuerst bei hoher Hitze anbraten, nicht bewegen bis sich eine Kruste löst (2–3 Min), wenden.",
    "Gemüse zugeben, 4–6 Min mitbraten, Pfanne nicht überfüllen (sonst dämpft es).",
    "Sauce (Soja, Sahne, Brühe) einrühren, 2–3 Min einkochen lassen, bis die Soße am Spatel haftet.",
    "Mit Salz, Pfeffer, Kräutern abschmecken; Hitze reduzieren, 1 Min ziehen lassen.",
    "Sofort auf vorgewärmten Tellern servieren — Pfannengerichte verlieren schnell an Textur."
  ]
}$g$::jsonb,
  1700,
  NULL,
  'Vegetarisch'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Vegetarische Bolognese');

-- Kürbissuppe mit Ingwer
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Kürbissuppe mit Ingwer',
  4,
  $g${
  "titel": "Kürbissuppe mit Ingwer",
  "portionen": 4,
  "kategorie": "Vegetarisch",
  "geschaetzte_kcal_gesamt": 1830,
  "zutaten": [
    {
      "name": "Hauptzutat",
      "menge": 500,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Knoblauchzehen",
      "menge": 2,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Tomaten",
      "menge": 300,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Gemüsebrühe",
      "menge": 500,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Olivenöl",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Kräuter frisch",
      "menge": 15,
      "einheit": "g",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Großen Topf (4–5 l) und Schöpfkelle bereitstellen; Gemüse waschen, Enden entfernen, in gleichmäßige Würfel schneiden.",
    "Topf auf Herdstufe 6 von 9 stellen, 2 EL Öl oder Butter erhitzen, Zwiebel und Knoblauch 4 Min glasig dünsten.",
    "Hartes Gemüse (Karotten, Sellerie, Kartoffeln) 5–6 Min mit anschwitzen, gelegentlich rühren, nicht bräunen.",
    "Brühe (ca. 1–1,2 l) angießen, mit einem Spritzer einmal aufkochen, dann Hitze auf Stufe 3–4 reduzieren.",
    "Kürbissuppe mit Ingwer: 20–30 Min leicht köcheln, bis alles weich ist; mit dem Löffel prüfen — keine harten Stücke.",
    "Optional mit Stabmixer pürieren: Mixer tief ins Flüssige tauchen, kurze Pulse, Spritzer vermeiden; oder grob lassen.",
    "Mit Salz, Pfeffer, Muskat oder frischen Kräutern abschmecken; Konsistenz mit Wasser oder Sahne anpassen.",
    "Bei Bedarf Einlage (Nudeln, Croutons, Sahnehaube) separat zubereiten und erst beim Servieren zugeben.",
    "Suppe in vorgewärmte Schalen füllen, heiß servieren; Rest im Topf auf Stufe 2 warm halten."
  ]
}$g$::jsonb,
  1830,
  NULL,
  'Vegetarisch'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Kürbissuppe mit Ingwer');

-- Halloumi-Grillpfanne
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Halloumi-Grillpfanne',
  4,
  $g${
  "titel": "Halloumi-Grillpfanne",
  "portionen": 4,
  "kategorie": "Vegetarisch",
  "geschaetzte_kcal_gesamt": 1510,
  "zutaten": [
    {
      "name": "Hauptzutat",
      "menge": 500,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Knoblauchzehen",
      "menge": 2,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Tomaten",
      "menge": 300,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Gemüsebrühe",
      "menge": 500,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Olivenöl",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Kräuter frisch",
      "menge": 15,
      "einheit": "g",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Pfanne (28 cm) und Spatel bereitstellen; Zutaten in gleicher Größe schneiden, damit gleichzeitig gar sind.",
    "Pfanne 2 Min auf Herdstufe 7 von 9 leer vorwärmen, dann 2 EL Öl — es soll leicht schimmern.",
    "Fleisch oder Tofu zuerst bei hoher Hitze anbraten, nicht bewegen bis sich eine Kruste löst (2–3 Min), wenden.",
    "Gemüse zugeben, 4–6 Min mitbraten, Pfanne nicht überfüllen (sonst dämpft es).",
    "Sauce (Soja, Sahne, Brühe) einrühren, 2–3 Min einkochen lassen, bis die Soße am Spatel haftet.",
    "Mit Salz, Pfeffer, Kräutern abschmecken; Hitze reduzieren, 1 Min ziehen lassen.",
    "Sofort auf vorgewärmten Tellern servieren — Pfannengerichte verlieren schnell an Textur."
  ]
}$g$::jsonb,
  1510,
  NULL,
  'Vegetarisch'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Halloumi-Grillpfanne');

-- Vegetarische Paella
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Vegetarische Paella',
  4,
  $g${
  "titel": "Vegetarische Paella",
  "portionen": 4,
  "kategorie": "Vegetarisch",
  "geschaetzte_kcal_gesamt": 1765,
  "zutaten": [
    {
      "name": "Hauptzutat",
      "menge": 500,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Knoblauchzehen",
      "menge": 2,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Tomaten",
      "menge": 300,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Gemüsebrühe",
      "menge": 500,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Olivenöl",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Kräuter frisch",
      "menge": 15,
      "einheit": "g",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Arbeitsfläche freiräumen: große Pfanne oder Wok, Topf für Reis, Schöpfkelle, Küchenuhr und scharfes Messer bereitstellen.",
    "Reis parallel starten: 300 g Reis waschen, mit 450 ml Wasser salzen, aufkochen, Deckel, Stufe 1–2, 12–15 Min quellen lassen.",
    "Zwiebel schälen und fein würfeln, Ingwer und Knoblauch fein hacken — alles in Schälchen legen (Mise en place).",
    "Pfanne auf Herdstufe 6 von 9 stellen, 2 EL Öl erhitzen, Currypaste 1–2 Min anrösten, bis es duftet und leicht dunkler wird (nicht schwarz).",
    "Zwiebel und Ingwer 3–4 Min glasig dünsten, dann Gemüse in gleich großen Stücken zugeben und 4–5 Min anbraten oder mitgaren.",
    "Kokosmilch und passierte Tomaten einrühren, einmal aufkochen, Hitze auf Stufe 3–4 reduzieren.",
    "«Vegetarische Paella» 15–20 Min leicht köcheln lassen, gelegentlich rühren, bis die Soße sämig ist und leichtes Öl an der Oberfläche perlt.",
    "Mit Limettensaft, Salz, Pfeffer und optional 1 TL Zucker abschmecken (süß-sauer-salzig ausbalancieren).",
    "Reis mit einer Gabel auflockern, Curry auf tiefe Teller geben, frischen Koriander darüber streuen.",
    "Sofort heiß servieren; Reste 2 Tage kühl lagern und nur einmal vollständig durcherhitzen."
  ]
}$g$::jsonb,
  1765,
  NULL,
  'Vegetarisch'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Vegetarische Paella');

-- Spinat-Ricotta-Cannelloni
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Spinat-Ricotta-Cannelloni',
  4,
  $g${
  "titel": "Spinat-Ricotta-Cannelloni",
  "portionen": 4,
  "kategorie": "Vegetarisch",
  "geschaetzte_kcal_gesamt": 1566,
  "zutaten": [
    {
      "name": "Hauptzutat",
      "menge": 500,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Knoblauchzehen",
      "menge": 2,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Tomaten",
      "menge": 300,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Gemüsebrühe",
      "menge": 500,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Olivenöl",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Kräuter frisch",
      "menge": 15,
      "einheit": "g",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Pfanne (28 cm) und Spatel bereitstellen; Zutaten in gleicher Größe schneiden, damit gleichzeitig gar sind.",
    "Pfanne 2 Min auf Herdstufe 7 von 9 leer vorwärmen, dann 2 EL Öl — es soll leicht schimmern.",
    "Fleisch oder Tofu zuerst bei hoher Hitze anbraten, nicht bewegen bis sich eine Kruste löst (2–3 Min), wenden.",
    "Gemüse zugeben, 4–6 Min mitbraten, Pfanne nicht überfüllen (sonst dämpft es).",
    "Sauce (Soja, Sahne, Brühe) einrühren, 2–3 Min einkochen lassen, bis die Soße am Spatel haftet.",
    "Mit Salz, Pfeffer, Kräutern abschmecken; Hitze reduzieren, 1 Min ziehen lassen.",
    "Sofort auf vorgewärmten Tellern servieren — Pfannengerichte verlieren schnell an Textur."
  ]
}$g$::jsonb,
  1566,
  NULL,
  'Vegetarisch'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Spinat-Ricotta-Cannelloni');

-- Möhren-Ingwer-Suppe
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Möhren-Ingwer-Suppe',
  4,
  $g${
  "titel": "Möhren-Ingwer-Suppe",
  "portionen": 4,
  "kategorie": "Vegetarisch",
  "geschaetzte_kcal_gesamt": 1887,
  "zutaten": [
    {
      "name": "Hauptzutat",
      "menge": 500,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Knoblauchzehen",
      "menge": 2,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Tomaten",
      "menge": 300,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Gemüsebrühe",
      "menge": 500,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Olivenöl",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Kräuter frisch",
      "menge": 15,
      "einheit": "g",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Großen Topf (4–5 l) und Schöpfkelle bereitstellen; Gemüse waschen, Enden entfernen, in gleichmäßige Würfel schneiden.",
    "Topf auf Herdstufe 6 von 9 stellen, 2 EL Öl oder Butter erhitzen, Zwiebel und Knoblauch 4 Min glasig dünsten.",
    "Hartes Gemüse (Karotten, Sellerie, Kartoffeln) 5–6 Min mit anschwitzen, gelegentlich rühren, nicht bräunen.",
    "Brühe (ca. 1–1,2 l) angießen, mit einem Spritzer einmal aufkochen, dann Hitze auf Stufe 3–4 reduzieren.",
    "Möhren-Ingwer-Suppe: 20–30 Min leicht köcheln, bis alles weich ist; mit dem Löffel prüfen — keine harten Stücke.",
    "Optional mit Stabmixer pürieren: Mixer tief ins Flüssige tauchen, kurze Pulse, Spritzer vermeiden; oder grob lassen.",
    "Mit Salz, Pfeffer, Muskat oder frischen Kräutern abschmecken; Konsistenz mit Wasser oder Sahne anpassen.",
    "Bei Bedarf Einlage (Nudeln, Croutons, Sahnehaube) separat zubereiten und erst beim Servieren zugeben.",
    "Suppe in vorgewärmte Schalen füllen, heiß servieren; Rest im Topf auf Stufe 2 warm halten."
  ]
}$g$::jsonb,
  1887,
  NULL,
  'Vegetarisch'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Möhren-Ingwer-Suppe');

-- Zucchini-Frittata
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Zucchini-Frittata',
  4,
  $g${
  "titel": "Zucchini-Frittata",
  "portionen": 4,
  "kategorie": "Vegetarisch",
  "geschaetzte_kcal_gesamt": 1605,
  "zutaten": [
    {
      "name": "Hauptzutat",
      "menge": 500,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Knoblauchzehen",
      "menge": 2,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Tomaten",
      "menge": 300,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Gemüsebrühe",
      "menge": 500,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Olivenöl",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Kräuter frisch",
      "menge": 15,
      "einheit": "g",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Pfanne (28 cm) und Spatel bereitstellen; Zutaten in gleicher Größe schneiden, damit gleichzeitig gar sind.",
    "Pfanne 2 Min auf Herdstufe 7 von 9 leer vorwärmen, dann 2 EL Öl — es soll leicht schimmern.",
    "Fleisch oder Tofu zuerst bei hoher Hitze anbraten, nicht bewegen bis sich eine Kruste löst (2–3 Min), wenden.",
    "Gemüse zugeben, 4–6 Min mitbraten, Pfanne nicht überfüllen (sonst dämpft es).",
    "Sauce (Soja, Sahne, Brühe) einrühren, 2–3 Min einkochen lassen, bis die Soße am Spatel haftet.",
    "Mit Salz, Pfeffer, Kräutern abschmecken; Hitze reduzieren, 1 Min ziehen lassen.",
    "Sofort auf vorgewärmten Tellern servieren — Pfannengerichte verlieren schnell an Textur."
  ]
}$g$::jsonb,
  1605,
  NULL,
  'Vegetarisch'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Zucchini-Frittata');

-- Bulgursalat mit Minze
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Bulgursalat mit Minze',
  4,
  $g${
  "titel": "Bulgursalat mit Minze",
  "portionen": 4,
  "kategorie": "Vegetarisch",
  "geschaetzte_kcal_gesamt": 1567,
  "zutaten": [
    {
      "name": "Hauptzutat",
      "menge": 500,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Knoblauchzehen",
      "menge": 2,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Tomaten",
      "menge": 300,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Gemüsebrühe",
      "menge": 500,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Olivenöl",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Kräuter frisch",
      "menge": 15,
      "einheit": "g",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Salatschüssel und große Schüssel mit kaltem Wasser bereitstellen; Gemüse gründlich waschen und trocken schleudern.",
    "Blattsalat in mundgerechte Stücke zupfen oder schneiden — Messer vermeidet braune Schnittkanten.",
    "Festes Gemüse (Gurke, Paprika, Tomaten) in gleichmäßige Stücke schneiden, separat lagern.",
    "Dressing in kleiner Schüssel: Öl, Essig, Senf, Salz, Pfeffer mit Schneebesen emulgieren.",
    "Käse, Nüsse oder Croutons erst kurz vor dem Servieren zugeben (sonst weich).",
    "Salat mit Dressing vermengen — nur so viel, dass Blätter glänzen, nicht schwimmen.",
    "Sofort auf kühlen Tellern anrichten; bei Meal Prep Dressing separat mitgeben."
  ]
}$g$::jsonb,
  1567,
  NULL,
  'Vegetarisch'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Bulgursalat mit Minze');

-- Vegetarisches Chili sin Carne
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Vegetarisches Chili sin Carne',
  4,
  $g${
  "titel": "Vegetarisches Chili sin Carne",
  "portionen": 4,
  "kategorie": "Vegetarisch",
  "geschaetzte_kcal_gesamt": 1861,
  "zutaten": [
    {
      "name": "Hauptzutat",
      "menge": 500,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Knoblauchzehen",
      "menge": 2,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Tomaten",
      "menge": 300,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Gemüsebrühe",
      "menge": 500,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Olivenöl",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Kräuter frisch",
      "menge": 15,
      "einheit": "g",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Arbeitsfläche freiräumen: große Pfanne oder Wok, Topf für Reis, Schöpfkelle, Küchenuhr und scharfes Messer bereitstellen.",
    "Reis parallel starten: 300 g Reis waschen, mit 450 ml Wasser salzen, aufkochen, Deckel, Stufe 1–2, 12–15 Min quellen lassen.",
    "Zwiebel schälen und fein würfeln, Ingwer und Knoblauch fein hacken — alles in Schälchen legen (Mise en place).",
    "Pfanne auf Herdstufe 6 von 9 stellen, 2 EL Öl erhitzen, Currypaste 1–2 Min anrösten, bis es duftet und leicht dunkler wird (nicht schwarz).",
    "Zwiebel und Ingwer 3–4 Min glasig dünsten, dann Gemüse in gleich großen Stücken zugeben und 4–5 Min anbraten oder mitgaren.",
    "Kokosmilch und passierte Tomaten einrühren, einmal aufkochen, Hitze auf Stufe 3–4 reduzieren.",
    "«Vegetarisches Chili sin Carne» 15–20 Min leicht köcheln lassen, gelegentlich rühren, bis die Soße sämig ist und leichtes Öl an der Oberfläche perlt.",
    "Mit Limettensaft, Salz, Pfeffer und optional 1 TL Zucker abschmecken (süß-sauer-salzig ausbalancieren).",
    "Reis mit einer Gabel auflockern, Curry auf tiefe Teller geben, frischen Koriander darüber streuen.",
    "Sofort heiß servieren; Reste 2 Tage kühl lagern und nur einmal vollständig durcherhitzen."
  ]
}$g$::jsonb,
  1861,
  NULL,
  'Vegetarisch'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Vegetarisches Chili sin Carne');

-- Kartoffelgratin
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Kartoffelgratin',
  4,
  $g${
  "titel": "Kartoffelgratin",
  "portionen": 4,
  "kategorie": "Vegetarisch",
  "geschaetzte_kcal_gesamt": 1871,
  "zutaten": [
    {
      "name": "Hauptzutat",
      "menge": 500,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Knoblauchzehen",
      "menge": 2,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Tomaten",
      "menge": 300,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Gemüsebrühe",
      "menge": 500,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Olivenöl",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Kräuter frisch",
      "menge": 15,
      "einheit": "g",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Pfanne (28 cm) und Spatel bereitstellen; Zutaten in gleicher Größe schneiden, damit gleichzeitig gar sind.",
    "Pfanne 2 Min auf Herdstufe 7 von 9 leer vorwärmen, dann 2 EL Öl — es soll leicht schimmern.",
    "Fleisch oder Tofu zuerst bei hoher Hitze anbraten, nicht bewegen bis sich eine Kruste löst (2–3 Min), wenden.",
    "Gemüse zugeben, 4–6 Min mitbraten, Pfanne nicht überfüllen (sonst dämpft es).",
    "Sauce (Soja, Sahne, Brühe) einrühren, 2–3 Min einkochen lassen, bis die Soße am Spatel haftet.",
    "Mit Salz, Pfeffer, Kräutern abschmecken; Hitze reduzieren, 1 Min ziehen lassen.",
    "Sofort auf vorgewärmten Tellern servieren — Pfannengerichte verlieren schnell an Textur."
  ]
}$g$::jsonb,
  1871,
  NULL,
  'Vegetarisch'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Kartoffelgratin');

-- Couscous mit Gemüse
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Couscous mit Gemüse',
  4,
  $g${
  "titel": "Couscous mit Gemüse",
  "portionen": 4,
  "kategorie": "Vegetarisch",
  "geschaetzte_kcal_gesamt": 1895,
  "zutaten": [
    {
      "name": "Hauptzutat",
      "menge": 500,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Knoblauchzehen",
      "menge": 2,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Tomaten",
      "menge": 300,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Gemüsebrühe",
      "menge": 500,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Olivenöl",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Kräuter frisch",
      "menge": 15,
      "einheit": "g",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Pfanne (28 cm) und Spatel bereitstellen; Zutaten in gleicher Größe schneiden, damit gleichzeitig gar sind.",
    "Pfanne 2 Min auf Herdstufe 7 von 9 leer vorwärmen, dann 2 EL Öl — es soll leicht schimmern.",
    "Fleisch oder Tofu zuerst bei hoher Hitze anbraten, nicht bewegen bis sich eine Kruste löst (2–3 Min), wenden.",
    "Gemüse zugeben, 4–6 Min mitbraten, Pfanne nicht überfüllen (sonst dämpft es).",
    "Sauce (Soja, Sahne, Brühe) einrühren, 2–3 Min einkochen lassen, bis die Soße am Spatel haftet.",
    "Mit Salz, Pfeffer, Kräutern abschmecken; Hitze reduzieren, 1 Min ziehen lassen.",
    "Sofort auf vorgewärmten Tellern servieren — Pfannengerichte verlieren schnell an Textur."
  ]
}$g$::jsonb,
  1895,
  NULL,
  'Vegetarisch'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Couscous mit Gemüse');

-- Erbsensuppe mit Minze
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Erbsensuppe mit Minze',
  4,
  $g${
  "titel": "Erbsensuppe mit Minze",
  "portionen": 4,
  "kategorie": "Vegetarisch",
  "geschaetzte_kcal_gesamt": 1573,
  "zutaten": [
    {
      "name": "Hauptzutat",
      "menge": 500,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Knoblauchzehen",
      "menge": 2,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Tomaten",
      "menge": 300,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Gemüsebrühe",
      "menge": 500,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Olivenöl",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Kräuter frisch",
      "menge": 15,
      "einheit": "g",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Großen Topf (4–5 l) und Schöpfkelle bereitstellen; Gemüse waschen, Enden entfernen, in gleichmäßige Würfel schneiden.",
    "Topf auf Herdstufe 6 von 9 stellen, 2 EL Öl oder Butter erhitzen, Zwiebel und Knoblauch 4 Min glasig dünsten.",
    "Hartes Gemüse (Karotten, Sellerie, Kartoffeln) 5–6 Min mit anschwitzen, gelegentlich rühren, nicht bräunen.",
    "Brühe (ca. 1–1,2 l) angießen, mit einem Spritzer einmal aufkochen, dann Hitze auf Stufe 3–4 reduzieren.",
    "Erbsensuppe mit Minze: 20–30 Min leicht köcheln, bis alles weich ist; mit dem Löffel prüfen — keine harten Stücke.",
    "Optional mit Stabmixer pürieren: Mixer tief ins Flüssige tauchen, kurze Pulse, Spritzer vermeiden; oder grob lassen.",
    "Mit Salz, Pfeffer, Muskat oder frischen Kräutern abschmecken; Konsistenz mit Wasser oder Sahne anpassen.",
    "Bei Bedarf Einlage (Nudeln, Croutons, Sahnehaube) separat zubereiten und erst beim Servieren zugeben.",
    "Suppe in vorgewärmte Schalen füllen, heiß servieren; Rest im Topf auf Stufe 2 warm halten."
  ]
}$g$::jsonb,
  1573,
  NULL,
  'Vegetarisch'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Erbsensuppe mit Minze');

-- Gnocchi Tomate-Mozzarella
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Gnocchi Tomate-Mozzarella',
  4,
  $g${
  "titel": "Gnocchi Tomate-Mozzarella",
  "portionen": 4,
  "kategorie": "Vegetarisch",
  "geschaetzte_kcal_gesamt": 1551,
  "zutaten": [
    {
      "name": "Hauptzutat",
      "menge": 500,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Knoblauchzehen",
      "menge": 2,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Tomaten",
      "menge": 300,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Gemüsebrühe",
      "menge": 500,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Olivenöl",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Kräuter frisch",
      "menge": 15,
      "einheit": "g",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Arbeitsfläche freiräumen: großer Topf (mind. 5 l), hohe Pfanne oder Sauteuse, Schöpfkelle, Sieb, Küchenuhr und großes Schneidebrett bereitstellen.",
    "Großen Topf mit reichlich kaltem Wasser füllen (ca. 1 l pro 100 g Nudeln), Deckel aufsetzen, auf Herdstufe 9 von 9 zum kräftigen Kochen bringen.",
    "Während das Wasser heizt: Hauptzutat, Zwiebeln, Knoblauchzehen, Tomaten vorbereiten — Gemüse schneiden, Kräuter waschen, Käse reiben, alles in Schüsseln getrennt bereitstellen.",
    "Wasser kräftig salzen (ca. 1 EL Salz pro Liter), Nudeln einrühren, Uhr stellen: Packungsangabe minus 1 Min als Richtwert für al dente.",
    "Für Soße passend zum Gericht: Pfanne auf Herdstufe 6–7 von 9 vorwärmen, Öl oder Butter erhitzen bis leicht glänzend, nicht rauchen lassen.",
    "Aromaten (Zwiebel, Knoblauch) 3–4 Min glasig dünsten, dann Hauptzutaten nach Rezept anbraten oder mitgeben, Hitze anpassen.",
    "Flüssigkeit (Tomaten, Sahne, Brühe) zugeben, einmal aufkochen, Hitze auf Stufe 3–4 reduzieren, 8–15 Min köcheln bis die Konsistenz an der Soßenkelle haftet.",
    "Mit Salz, Pfeffer und ggf. Chili, Zitrone oder Käse abschmecken; Soße warm halten (Deckel, niedrige Stufe).",
    "2–3 Min vor Ende der Nudelgarzeit eine Schöpfkelle Nudelwasser aufheben — enthält Stärke zum Binden der Soße.",
    "Nudeln im Sieb abgießen, nicht abschrecken, sofort in die Pfanne zur Soße geben, mit etwas Nudelwasser unter Rühren emulgieren.",
    "1–2 Min auf Stufe 4 mitrühren, bis die Soße glänzend an den Nudeln haftet; Portionen mit Kelle auf tiefe Teller geben.",
    "Optional frisch geriebenen Käse, Kräuter oder Olivenöl darüber; sofort heiß servieren."
  ]
}$g$::jsonb,
  1551,
  NULL,
  'Vegetarisch'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Gnocchi Tomate-Mozzarella');

-- Blumenkohl-Steaks aus dem Ofen
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Blumenkohl-Steaks aus dem Ofen',
  4,
  $g${
  "titel": "Blumenkohl-Steaks aus dem Ofen",
  "portionen": 4,
  "kategorie": "Vegetarisch",
  "geschaetzte_kcal_gesamt": 1532,
  "zutaten": [
    {
      "name": "Hauptzutat",
      "menge": 500,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Knoblauchzehen",
      "menge": 2,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Tomaten",
      "menge": 300,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Gemüsebrühe",
      "menge": 500,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Olivenöl",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Kräuter frisch",
      "menge": 15,
      "einheit": "g",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Pfanne (28 cm) und Spatel bereitstellen; Zutaten in gleicher Größe schneiden, damit gleichzeitig gar sind.",
    "Pfanne 2 Min auf Herdstufe 7 von 9 leer vorwärmen, dann 2 EL Öl — es soll leicht schimmern.",
    "Fleisch oder Tofu zuerst bei hoher Hitze anbraten, nicht bewegen bis sich eine Kruste löst (2–3 Min), wenden.",
    "Gemüse zugeben, 4–6 Min mitbraten, Pfanne nicht überfüllen (sonst dämpft es).",
    "Sauce (Soja, Sahne, Brühe) einrühren, 2–3 Min einkochen lassen, bis die Soße am Spatel haftet.",
    "Mit Salz, Pfeffer, Kräutern abschmecken; Hitze reduzieren, 1 Min ziehen lassen.",
    "Sofort auf vorgewärmten Tellern servieren — Pfannengerichte verlieren schnell an Textur."
  ]
}$g$::jsonb,
  1532,
  NULL,
  'Vegetarisch'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Blumenkohl-Steaks aus dem Ofen');

-- Brokkoli-Käse-Auflauf
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Brokkoli-Käse-Auflauf',
  4,
  $g${
  "titel": "Brokkoli-Käse-Auflauf",
  "portionen": 4,
  "kategorie": "Vegetarisch",
  "geschaetzte_kcal_gesamt": 1646,
  "zutaten": [
    {
      "name": "Hauptzutat",
      "menge": 500,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Knoblauchzehen",
      "menge": 2,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Tomaten",
      "menge": 300,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Gemüsebrühe",
      "menge": 500,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Olivenöl",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Kräuter frisch",
      "menge": 15,
      "einheit": "g",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Ofen auf 180 °C Umluft vorheizen (nur Ober-/Unterhitze: +20 °C), Backblech mit Backpapier auslegen.",
    "Hauptzutat würzen, marinieren oder panieren wie im Rezept; Küchenthermometer bereitlegen bei Fleisch/Fisch.",
    "Ofenfeste Form oder Blech fetten oder mit Papier belegen, Zutaten in einer Schicht anordnen (gleichmäßige Hitze).",
    "In die mittlere Schiene schieben, 35–45 Min backen/braten — nicht zu früh die Tür öffnen (Temperaturverlust).",
    "Nach der Hälfte wenden oder begießen (Bratensoße, Marinade), Oberfläche soll goldbraun werden.",
    "Gargrad prüfen: Fisch 58–62 °C Kerntemperatur, Geflügel 74 °C, Rind medium ca. 55 °C (nach Ruhezeit).",
    "5–10 Min ruhen lassen unter Alufolie (locker), dann in Scheiben schneiden oder anrichten.",
    "Mit Beilage und heißer Sauce servieren; Ofenhandschuhe verwenden."
  ]
}$g$::jsonb,
  1646,
  NULL,
  'Vegetarisch'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Brokkoli-Käse-Auflauf');

-- Reibekuchen mit Apfelmus
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Reibekuchen mit Apfelmus',
  4,
  $g${
  "titel": "Reibekuchen mit Apfelmus",
  "portionen": 4,
  "kategorie": "Vegetarisch",
  "geschaetzte_kcal_gesamt": 1848,
  "zutaten": [
    {
      "name": "Hauptzutat",
      "menge": 500,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Knoblauchzehen",
      "menge": 2,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Tomaten",
      "menge": 300,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Gemüsebrühe",
      "menge": 500,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Olivenöl",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Kräuter frisch",
      "menge": 15,
      "einheit": "g",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Pfanne (28 cm) und Spatel bereitstellen; Zutaten in gleicher Größe schneiden, damit gleichzeitig gar sind.",
    "Pfanne 2 Min auf Herdstufe 7 von 9 leer vorwärmen, dann 2 EL Öl — es soll leicht schimmern.",
    "Fleisch oder Tofu zuerst bei hoher Hitze anbraten, nicht bewegen bis sich eine Kruste löst (2–3 Min), wenden.",
    "Gemüse zugeben, 4–6 Min mitbraten, Pfanne nicht überfüllen (sonst dämpft es).",
    "Sauce (Soja, Sahne, Brühe) einrühren, 2–3 Min einkochen lassen, bis die Soße am Spatel haftet.",
    "Mit Salz, Pfeffer, Kräutern abschmecken; Hitze reduzieren, 1 Min ziehen lassen.",
    "Sofort auf vorgewärmten Tellern servieren — Pfannengerichte verlieren schnell an Textur."
  ]
}$g$::jsonb,
  1848,
  NULL,
  'Vegetarisch'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Reibekuchen mit Apfelmus');

-- Gebratener Blumenkohl
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Gebratener Blumenkohl',
  4,
  $g${
  "titel": "Gebratener Blumenkohl",
  "portionen": 4,
  "kategorie": "Vegetarisch",
  "geschaetzte_kcal_gesamt": 1596,
  "zutaten": [
    {
      "name": "Hauptzutat",
      "menge": 500,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Knoblauchzehen",
      "menge": 2,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Tomaten",
      "menge": 300,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Gemüsebrühe",
      "menge": 500,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Olivenöl",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Kräuter frisch",
      "menge": 15,
      "einheit": "g",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Pfanne (28 cm) und Spatel bereitstellen; Zutaten in gleicher Größe schneiden, damit gleichzeitig gar sind.",
    "Pfanne 2 Min auf Herdstufe 7 von 9 leer vorwärmen, dann 2 EL Öl — es soll leicht schimmern.",
    "Fleisch oder Tofu zuerst bei hoher Hitze anbraten, nicht bewegen bis sich eine Kruste löst (2–3 Min), wenden.",
    "Gemüse zugeben, 4–6 Min mitbraten, Pfanne nicht überfüllen (sonst dämpft es).",
    "Sauce (Soja, Sahne, Brühe) einrühren, 2–3 Min einkochen lassen, bis die Soße am Spatel haftet.",
    "Mit Salz, Pfeffer, Kräutern abschmecken; Hitze reduzieren, 1 Min ziehen lassen.",
    "Sofort auf vorgewärmten Tellern servieren — Pfannengerichte verlieren schnell an Textur."
  ]
}$g$::jsonb,
  1596,
  NULL,
  'Vegetarisch'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Gebratener Blumenkohl');

-- Käsesoufflé
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Käsesoufflé',
  4,
  $g${
  "titel": "Käsesoufflé",
  "portionen": 4,
  "kategorie": "Vegetarisch",
  "geschaetzte_kcal_gesamt": 1707,
  "zutaten": [
    {
      "name": "Hauptzutat",
      "menge": 500,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Knoblauchzehen",
      "menge": 2,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Tomaten",
      "menge": 300,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Gemüsebrühe",
      "menge": 500,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Olivenöl",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Kräuter frisch",
      "menge": 15,
      "einheit": "g",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Pfanne (28 cm) und Spatel bereitstellen; Zutaten in gleicher Größe schneiden, damit gleichzeitig gar sind.",
    "Pfanne 2 Min auf Herdstufe 7 von 9 leer vorwärmen, dann 2 EL Öl — es soll leicht schimmern.",
    "Fleisch oder Tofu zuerst bei hoher Hitze anbraten, nicht bewegen bis sich eine Kruste löst (2–3 Min), wenden.",
    "Gemüse zugeben, 4–6 Min mitbraten, Pfanne nicht überfüllen (sonst dämpft es).",
    "Sauce (Soja, Sahne, Brühe) einrühren, 2–3 Min einkochen lassen, bis die Soße am Spatel haftet.",
    "Mit Salz, Pfeffer, Kräutern abschmecken; Hitze reduzieren, 1 Min ziehen lassen.",
    "Sofort auf vorgewärmten Tellern servieren — Pfannengerichte verlieren schnell an Textur."
  ]
}$g$::jsonb,
  1707,
  NULL,
  'Vegetarisch'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Käsesoufflé');

-- Tomaten-Feta-Pfanne
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Tomaten-Feta-Pfanne',
  4,
  $g${
  "titel": "Tomaten-Feta-Pfanne",
  "portionen": 4,
  "kategorie": "Vegetarisch",
  "geschaetzte_kcal_gesamt": 1702,
  "zutaten": [
    {
      "name": "Hauptzutat",
      "menge": 500,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Knoblauchzehen",
      "menge": 2,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Tomaten",
      "menge": 300,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Gemüsebrühe",
      "menge": 500,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Olivenöl",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Kräuter frisch",
      "menge": 15,
      "einheit": "g",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Pfanne (28 cm) und Spatel bereitstellen; Zutaten in gleicher Größe schneiden, damit gleichzeitig gar sind.",
    "Pfanne 2 Min auf Herdstufe 7 von 9 leer vorwärmen, dann 2 EL Öl — es soll leicht schimmern.",
    "Fleisch oder Tofu zuerst bei hoher Hitze anbraten, nicht bewegen bis sich eine Kruste löst (2–3 Min), wenden.",
    "Gemüse zugeben, 4–6 Min mitbraten, Pfanne nicht überfüllen (sonst dämpft es).",
    "Sauce (Soja, Sahne, Brühe) einrühren, 2–3 Min einkochen lassen, bis die Soße am Spatel haftet.",
    "Mit Salz, Pfeffer, Kräutern abschmecken; Hitze reduzieren, 1 Min ziehen lassen.",
    "Sofort auf vorgewärmten Tellern servieren — Pfannengerichte verlieren schnell an Textur."
  ]
}$g$::jsonb,
  1702,
  NULL,
  'Vegetarisch'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Tomaten-Feta-Pfanne');

-- Veganes Linsencurry
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Veganes Linsencurry',
  4,
  $g${
  "titel": "Veganes Linsencurry",
  "portionen": 4,
  "kategorie": "Vegan",
  "geschaetzte_kcal_gesamt": 1727,
  "zutaten": [
    {
      "name": "Tofu oder Kichererbsen",
      "menge": 400,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Kokosmilch",
      "menge": 400,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Currypaste",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Limettensaft",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Reis oder Nudeln",
      "menge": 300,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Gemüse der Saison",
      "menge": 400,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Sojasauce",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Arbeitsfläche freiräumen: große Pfanne oder Wok, Topf für Reis, Schöpfkelle, Küchenuhr und scharfes Messer bereitstellen.",
    "Reis parallel starten: 300 g Reis waschen, mit 450 ml Wasser salzen, aufkochen, Deckel, Stufe 1–2, 12–15 Min quellen lassen.",
    "Zwiebel schälen und fein würfeln, Ingwer und Knoblauch fein hacken — alles in Schälchen legen (Mise en place).",
    "Pfanne auf Herdstufe 6 von 9 stellen, 2 EL Öl erhitzen, Currypaste 1–2 Min anrösten, bis es duftet und leicht dunkler wird (nicht schwarz).",
    "Zwiebel und Ingwer 3–4 Min glasig dünsten, dann Tofu oder Kichererbsen zugeben und 4–5 Min anbraten oder mitgaren.",
    "Kokosmilch und passierte Tomaten einrühren, einmal aufkochen, Hitze auf Stufe 3–4 reduzieren.",
    "«Veganes Linsencurry» 15–20 Min leicht köcheln lassen, gelegentlich rühren, bis die Soße sämig ist und leichtes Öl an der Oberfläche perlt.",
    "Mit Limettensaft, Salz, Pfeffer und optional 1 TL Zucker abschmecken (süß-sauer-salzig ausbalancieren).",
    "Reis mit einer Gabel auflockern, Curry auf tiefe Teller geben, frischen Koriander darüber streuen.",
    "Sofort heiß servieren; Reste 2 Tage kühl lagern und nur einmal vollständig durcherhitzen."
  ]
}$g$::jsonb,
  1727,
  NULL,
  'Vegan'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Veganes Linsencurry');

-- Vegane Bolognese
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Vegane Bolognese',
  4,
  $g${
  "titel": "Vegane Bolognese",
  "portionen": 4,
  "kategorie": "Vegan",
  "geschaetzte_kcal_gesamt": 1756,
  "zutaten": [
    {
      "name": "Tofu oder Kichererbsen",
      "menge": 400,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Kokosmilch",
      "menge": 400,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Currypaste",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Limettensaft",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Reis oder Nudeln",
      "menge": 300,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Gemüse der Saison",
      "menge": 400,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Sojasauce",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Pfanne (28 cm) und Spatel bereitstellen; Zutaten in gleicher Größe schneiden, damit gleichzeitig gar sind.",
    "Pfanne 2 Min auf Herdstufe 7 von 9 leer vorwärmen, dann 2 EL Öl — es soll leicht schimmern.",
    "Fleisch oder Tofu zuerst bei hoher Hitze anbraten, nicht bewegen bis sich eine Kruste löst (2–3 Min), wenden.",
    "Gemüse zugeben, 4–6 Min mitbraten, Pfanne nicht überfüllen (sonst dämpft es).",
    "Sauce (Soja, Sahne, Brühe) einrühren, 2–3 Min einkochen lassen, bis die Soße am Spatel haftet.",
    "Mit Salz, Pfeffer, Kräutern abschmecken; Hitze reduzieren, 1 Min ziehen lassen.",
    "Sofort auf vorgewärmten Tellern servieren — Pfannengerichte verlieren schnell an Textur."
  ]
}$g$::jsonb,
  1756,
  NULL,
  'Vegan'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Vegane Bolognese');

-- Tofu-Gemüse-Pfanne
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Tofu-Gemüse-Pfanne',
  4,
  $g${
  "titel": "Tofu-Gemüse-Pfanne",
  "portionen": 4,
  "kategorie": "Vegan",
  "geschaetzte_kcal_gesamt": 1653,
  "zutaten": [
    {
      "name": "Tofu oder Kichererbsen",
      "menge": 400,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Kokosmilch",
      "menge": 400,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Currypaste",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Limettensaft",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Reis oder Nudeln",
      "menge": 300,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Gemüse der Saison",
      "menge": 400,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Sojasauce",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Pfanne (28 cm) und Spatel bereitstellen; Zutaten in gleicher Größe schneiden, damit gleichzeitig gar sind.",
    "Pfanne 2 Min auf Herdstufe 7 von 9 leer vorwärmen, dann 2 EL Öl — es soll leicht schimmern.",
    "Fleisch oder Tofu zuerst bei hoher Hitze anbraten, nicht bewegen bis sich eine Kruste löst (2–3 Min), wenden.",
    "Gemüse zugeben, 4–6 Min mitbraten, Pfanne nicht überfüllen (sonst dämpft es).",
    "Sauce (Soja, Sahne, Brühe) einrühren, 2–3 Min einkochen lassen, bis die Soße am Spatel haftet.",
    "Mit Salz, Pfeffer, Kräutern abschmecken; Hitze reduzieren, 1 Min ziehen lassen.",
    "Sofort auf vorgewärmten Tellern servieren — Pfannengerichte verlieren schnell an Textur."
  ]
}$g$::jsonb,
  1653,
  NULL,
  'Vegan'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Tofu-Gemüse-Pfanne');

-- Kichererbsen-Curry
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Kichererbsen-Curry',
  4,
  $g${
  "titel": "Kichererbsen-Curry",
  "portionen": 4,
  "kategorie": "Vegan",
  "geschaetzte_kcal_gesamt": 1615,
  "zutaten": [
    {
      "name": "Tofu oder Kichererbsen",
      "menge": 400,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Kokosmilch",
      "menge": 400,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Currypaste",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Limettensaft",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Reis oder Nudeln",
      "menge": 300,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Gemüse der Saison",
      "menge": 400,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Sojasauce",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Arbeitsfläche freiräumen: große Pfanne oder Wok, Topf für Reis, Schöpfkelle, Küchenuhr und scharfes Messer bereitstellen.",
    "Reis parallel starten: 300 g Reis waschen, mit 450 ml Wasser salzen, aufkochen, Deckel, Stufe 1–2, 12–15 Min quellen lassen.",
    "Zwiebel schälen und fein würfeln, Ingwer und Knoblauch fein hacken — alles in Schälchen legen (Mise en place).",
    "Pfanne auf Herdstufe 6 von 9 stellen, 2 EL Öl erhitzen, Currypaste 1–2 Min anrösten, bis es duftet und leicht dunkler wird (nicht schwarz).",
    "Zwiebel und Ingwer 3–4 Min glasig dünsten, dann Tofu oder Kichererbsen zugeben und 4–5 Min anbraten oder mitgaren.",
    "Kokosmilch und passierte Tomaten einrühren, einmal aufkochen, Hitze auf Stufe 3–4 reduzieren.",
    "«Kichererbsen-Curry» 15–20 Min leicht köcheln lassen, gelegentlich rühren, bis die Soße sämig ist und leichtes Öl an der Oberfläche perlt.",
    "Mit Limettensaft, Salz, Pfeffer und optional 1 TL Zucker abschmecken (süß-sauer-salzig ausbalancieren).",
    "Reis mit einer Gabel auflockern, Curry auf tiefe Teller geben, frischen Koriander darüber streuen.",
    "Sofort heiß servieren; Reste 2 Tage kühl lagern und nur einmal vollständig durcherhitzen."
  ]
}$g$::jsonb,
  1615,
  NULL,
  'Vegan'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Kichererbsen-Curry');

-- Vegane Zucchini-Lasagne
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Vegane Zucchini-Lasagne',
  4,
  $g${
  "titel": "Vegane Zucchini-Lasagne",
  "portionen": 4,
  "kategorie": "Vegan",
  "geschaetzte_kcal_gesamt": 1603,
  "zutaten": [
    {
      "name": "Tofu oder Kichererbsen",
      "menge": 400,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Kokosmilch",
      "menge": 400,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Currypaste",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Limettensaft",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Reis oder Nudeln",
      "menge": 300,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Gemüse der Saison",
      "menge": 400,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Sojasauce",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Pfanne (28 cm) und Spatel bereitstellen; Zutaten in gleicher Größe schneiden, damit gleichzeitig gar sind.",
    "Pfanne 2 Min auf Herdstufe 7 von 9 leer vorwärmen, dann 2 EL Öl — es soll leicht schimmern.",
    "Fleisch oder Tofu zuerst bei hoher Hitze anbraten, nicht bewegen bis sich eine Kruste löst (2–3 Min), wenden.",
    "Gemüse zugeben, 4–6 Min mitbraten, Pfanne nicht überfüllen (sonst dämpft es).",
    "Sauce (Soja, Sahne, Brühe) einrühren, 2–3 Min einkochen lassen, bis die Soße am Spatel haftet.",
    "Mit Salz, Pfeffer, Kräutern abschmecken; Hitze reduzieren, 1 Min ziehen lassen.",
    "Sofort auf vorgewärmten Tellern servieren — Pfannengerichte verlieren schnell an Textur."
  ]
}$g$::jsonb,
  1603,
  NULL,
  'Vegan'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Vegane Zucchini-Lasagne');

-- Süßkartoffel-Bowl
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Süßkartoffel-Bowl',
  4,
  $g${
  "titel": "Süßkartoffel-Bowl",
  "portionen": 4,
  "kategorie": "Vegan",
  "geschaetzte_kcal_gesamt": 1765,
  "zutaten": [
    {
      "name": "Tofu oder Kichererbsen",
      "menge": 400,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Kokosmilch",
      "menge": 400,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Currypaste",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Limettensaft",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Reis oder Nudeln",
      "menge": 300,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Gemüse der Saison",
      "menge": 400,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Sojasauce",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Salatschüssel und große Schüssel mit kaltem Wasser bereitstellen; Gemüse gründlich waschen und trocken schleudern.",
    "Blattsalat in mundgerechte Stücke zupfen oder schneiden — Messer vermeidet braune Schnittkanten.",
    "Festes Gemüse (Gurke, Paprika, Tomaten) in gleichmäßige Stücke schneiden, separat lagern.",
    "Dressing in kleiner Schüssel: Öl, Essig, Senf, Salz, Pfeffer mit Schneebesen emulgieren.",
    "Käse, Nüsse oder Croutons erst kurz vor dem Servieren zugeben (sonst weich).",
    "Salat mit Dressing vermengen — nur so viel, dass Blätter glänzen, nicht schwimmen.",
    "Sofort auf kühlen Tellern anrichten; bei Meal Prep Dressing separat mitgeben."
  ]
}$g$::jsonb,
  1765,
  NULL,
  'Vegan'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Süßkartoffel-Bowl');

-- Veganer Kidney-Bohnen-Burger
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Veganer Kidney-Bohnen-Burger',
  4,
  $g${
  "titel": "Veganer Kidney-Bohnen-Burger",
  "portionen": 4,
  "kategorie": "Vegan",
  "geschaetzte_kcal_gesamt": 1663,
  "zutaten": [
    {
      "name": "Tofu oder Kichererbsen",
      "menge": 400,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Kokosmilch",
      "menge": 400,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Currypaste",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Limettensaft",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Reis oder Nudeln",
      "menge": 300,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Gemüse der Saison",
      "menge": 400,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Sojasauce",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Pfanne (28 cm) und Spatel bereitstellen; Zutaten in gleicher Größe schneiden, damit gleichzeitig gar sind.",
    "Pfanne 2 Min auf Herdstufe 7 von 9 leer vorwärmen, dann 2 EL Öl — es soll leicht schimmern.",
    "Fleisch oder Tofu zuerst bei hoher Hitze anbraten, nicht bewegen bis sich eine Kruste löst (2–3 Min), wenden.",
    "Gemüse zugeben, 4–6 Min mitbraten, Pfanne nicht überfüllen (sonst dämpft es).",
    "Sauce (Soja, Sahne, Brühe) einrühren, 2–3 Min einkochen lassen, bis die Soße am Spatel haftet.",
    "Mit Salz, Pfeffer, Kräutern abschmecken; Hitze reduzieren, 1 Min ziehen lassen.",
    "Sofort auf vorgewärmten Tellern servieren — Pfannengerichte verlieren schnell an Textur."
  ]
}$g$::jsonb,
  1663,
  NULL,
  'Vegan'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Veganer Kidney-Bohnen-Burger');

-- Erdnuss-Nudeln
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Erdnuss-Nudeln',
  4,
  $g${
  "titel": "Erdnuss-Nudeln",
  "portionen": 4,
  "kategorie": "Vegan",
  "geschaetzte_kcal_gesamt": 1599,
  "zutaten": [
    {
      "name": "Tofu oder Kichererbsen",
      "menge": 400,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Kokosmilch",
      "menge": 400,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Currypaste",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Limettensaft",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Reis oder Nudeln",
      "menge": 300,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Gemüse der Saison",
      "menge": 400,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Sojasauce",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Arbeitsfläche freiräumen: großer Topf (mind. 5 l), hohe Pfanne oder Sauteuse, Schöpfkelle, Sieb, Küchenuhr und großes Schneidebrett bereitstellen.",
    "Großen Topf mit reichlich kaltem Wasser füllen (ca. 1 l pro 100 g Nudeln), Deckel aufsetzen, auf Herdstufe 9 von 9 zum kräftigen Kochen bringen.",
    "Während das Wasser heizt: Tofu oder Kichererbsen, Kokosmilch, Zwiebeln, Currypaste vorbereiten — Gemüse schneiden, Kräuter waschen, Käse reiben, alles in Schüsseln getrennt bereitstellen.",
    "Wasser kräftig salzen (ca. 1 EL Salz pro Liter), Nudeln einrühren, Uhr stellen: Packungsangabe minus 1 Min als Richtwert für al dente.",
    "Für Soße passend zum Gericht: Pfanne auf Herdstufe 6–7 von 9 vorwärmen, Öl oder Butter erhitzen bis leicht glänzend, nicht rauchen lassen.",
    "Aromaten (Zwiebel, Knoblauch) 3–4 Min glasig dünsten, dann Hauptzutaten nach Rezept anbraten oder mitgeben, Hitze anpassen.",
    "Flüssigkeit (Tomaten, Sahne, Brühe) zugeben, einmal aufkochen, Hitze auf Stufe 3–4 reduzieren, 8–15 Min köcheln bis die Konsistenz an der Soßenkelle haftet.",
    "Mit Salz, Pfeffer und ggf. Chili, Zitrone oder Käse abschmecken; Soße warm halten (Deckel, niedrige Stufe).",
    "2–3 Min vor Ende der Nudelgarzeit eine Schöpfkelle Nudelwasser aufheben — enthält Stärke zum Binden der Soße.",
    "Nudeln im Sieb abgießen, nicht abschrecken, sofort in die Pfanne zur Soße geben, mit etwas Nudelwasser unter Rühren emulgieren.",
    "1–2 Min auf Stufe 4 mitrühren, bis die Soße glänzend an den Nudeln haftet; Portionen mit Kelle auf tiefe Teller geben.",
    "Optional frisch geriebenen Käse, Kräuter oder Olivenöl darüber; sofort heiß servieren."
  ]
}$g$::jsonb,
  1599,
  NULL,
  'Vegan'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Erdnuss-Nudeln');

-- Vegane Pasta Arrabbiata
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Vegane Pasta Arrabbiata',
  4,
  $g${
  "titel": "Vegane Pasta Arrabbiata",
  "portionen": 4,
  "kategorie": "Vegan",
  "geschaetzte_kcal_gesamt": 1568,
  "zutaten": [
    {
      "name": "Tofu oder Kichererbsen",
      "menge": 400,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Kokosmilch",
      "menge": 400,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Currypaste",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Limettensaft",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Reis oder Nudeln",
      "menge": 300,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Gemüse der Saison",
      "menge": 400,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Sojasauce",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Arbeitsfläche freiräumen: großer Topf (mind. 5 l), hohe Pfanne oder Sauteuse, Schöpfkelle, Sieb, Küchenuhr und großes Schneidebrett bereitstellen.",
    "Großen Topf mit reichlich kaltem Wasser füllen (ca. 1 l pro 100 g Nudeln), Deckel aufsetzen, auf Herdstufe 9 von 9 zum kräftigen Kochen bringen.",
    "Während das Wasser heizt: Tofu oder Kichererbsen, Kokosmilch, Zwiebeln, Currypaste vorbereiten — Gemüse schneiden, Kräuter waschen, Käse reiben, alles in Schüsseln getrennt bereitstellen.",
    "Wasser kräftig salzen (ca. 1 EL Salz pro Liter), Nudeln einrühren, Uhr stellen: Packungsangabe minus 1 Min als Richtwert für al dente.",
    "Für Soße passend zum Gericht: Pfanne auf Herdstufe 6–7 von 9 vorwärmen, Öl oder Butter erhitzen bis leicht glänzend, nicht rauchen lassen.",
    "Aromaten (Zwiebel, Knoblauch) 3–4 Min glasig dünsten, dann Hauptzutaten nach Rezept anbraten oder mitgeben, Hitze anpassen.",
    "Flüssigkeit (Tomaten, Sahne, Brühe) zugeben, einmal aufkochen, Hitze auf Stufe 3–4 reduzieren, 8–15 Min köcheln bis die Konsistenz an der Soßenkelle haftet.",
    "Mit Salz, Pfeffer und ggf. Chili, Zitrone oder Käse abschmecken; Soße warm halten (Deckel, niedrige Stufe).",
    "2–3 Min vor Ende der Nudelgarzeit eine Schöpfkelle Nudelwasser aufheben — enthält Stärke zum Binden der Soße.",
    "Nudeln im Sieb abgießen, nicht abschrecken, sofort in die Pfanne zur Soße geben, mit etwas Nudelwasser unter Rühren emulgieren.",
    "1–2 Min auf Stufe 4 mitrühren, bis die Soße glänzend an den Nudeln haftet; Portionen mit Kelle auf tiefe Teller geben.",
    "Optional frisch geriebenen Käse, Kräuter oder Olivenöl darüber; sofort heiß servieren."
  ]
}$g$::jsonb,
  1568,
  NULL,
  'Vegan'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Vegane Pasta Arrabbiata');

-- Kokos-Linsensuppe
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Kokos-Linsensuppe',
  4,
  $g${
  "titel": "Kokos-Linsensuppe",
  "portionen": 4,
  "kategorie": "Vegan",
  "geschaetzte_kcal_gesamt": 1538,
  "zutaten": [
    {
      "name": "Tofu oder Kichererbsen",
      "menge": 400,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Kokosmilch",
      "menge": 400,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Currypaste",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Limettensaft",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Reis oder Nudeln",
      "menge": 300,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Gemüse der Saison",
      "menge": 400,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Sojasauce",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Großen Topf (4–5 l) und Schöpfkelle bereitstellen; Gemüse waschen, Enden entfernen, in gleichmäßige Würfel schneiden.",
    "Topf auf Herdstufe 6 von 9 stellen, 2 EL Öl oder Butter erhitzen, Zwiebel und Knoblauch 4 Min glasig dünsten.",
    "Hartes Gemüse (Karotten, Sellerie, Kartoffeln) 5–6 Min mit anschwitzen, gelegentlich rühren, nicht bräunen.",
    "Brühe (ca. 1–1,2 l) angießen, mit einem Spritzer einmal aufkochen, dann Hitze auf Stufe 3–4 reduzieren.",
    "Kokos-Linsensuppe: 20–30 Min leicht köcheln, bis alles weich ist; mit dem Löffel prüfen — keine harten Stücke.",
    "Optional mit Stabmixer pürieren: Mixer tief ins Flüssige tauchen, kurze Pulse, Spritzer vermeiden; oder grob lassen.",
    "Mit Salz, Pfeffer, Muskat oder frischen Kräutern abschmecken; Konsistenz mit Wasser oder Sahne anpassen.",
    "Bei Bedarf Einlage (Nudeln, Croutons, Sahnehaube) separat zubereiten und erst beim Servieren zugeben.",
    "Suppe in vorgewärmte Schalen füllen, heiß servieren; Rest im Topf auf Stufe 2 warm halten."
  ]
}$g$::jsonb,
  1538,
  NULL,
  'Vegan'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Kokos-Linsensuppe');

-- Gebackene Süßkartoffel
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Gebackene Süßkartoffel',
  4,
  $g${
  "titel": "Gebackene Süßkartoffel",
  "portionen": 4,
  "kategorie": "Vegan",
  "geschaetzte_kcal_gesamt": 1433,
  "zutaten": [
    {
      "name": "Tofu oder Kichererbsen",
      "menge": 400,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Kokosmilch",
      "menge": 400,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Currypaste",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Limettensaft",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Reis oder Nudeln",
      "menge": 300,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Gemüse der Saison",
      "menge": 400,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Sojasauce",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Pfanne (28 cm) und Spatel bereitstellen; Zutaten in gleicher Größe schneiden, damit gleichzeitig gar sind.",
    "Pfanne 2 Min auf Herdstufe 7 von 9 leer vorwärmen, dann 2 EL Öl — es soll leicht schimmern.",
    "Fleisch oder Tofu zuerst bei hoher Hitze anbraten, nicht bewegen bis sich eine Kruste löst (2–3 Min), wenden.",
    "Gemüse zugeben, 4–6 Min mitbraten, Pfanne nicht überfüllen (sonst dämpft es).",
    "Sauce (Soja, Sahne, Brühe) einrühren, 2–3 Min einkochen lassen, bis die Soße am Spatel haftet.",
    "Mit Salz, Pfeffer, Kräutern abschmecken; Hitze reduzieren, 1 Min ziehen lassen.",
    "Sofort auf vorgewärmten Tellern servieren — Pfannengerichte verlieren schnell an Textur."
  ]
}$g$::jsonb,
  1433,
  NULL,
  'Vegan'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Gebackene Süßkartoffel');

-- Quinoa-Salat
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Quinoa-Salat',
  4,
  $g${
  "titel": "Quinoa-Salat",
  "portionen": 4,
  "kategorie": "Vegan",
  "geschaetzte_kcal_gesamt": 1767,
  "zutaten": [
    {
      "name": "Tofu oder Kichererbsen",
      "menge": 400,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Kokosmilch",
      "menge": 400,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Currypaste",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Limettensaft",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Reis oder Nudeln",
      "menge": 300,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Gemüse der Saison",
      "menge": 400,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Sojasauce",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Salatschüssel und große Schüssel mit kaltem Wasser bereitstellen; Gemüse gründlich waschen und trocken schleudern.",
    "Blattsalat in mundgerechte Stücke zupfen oder schneiden — Messer vermeidet braune Schnittkanten.",
    "Festes Gemüse (Gurke, Paprika, Tomaten) in gleichmäßige Stücke schneiden, separat lagern.",
    "Dressing in kleiner Schüssel: Öl, Essig, Senf, Salz, Pfeffer mit Schneebesen emulgieren.",
    "Käse, Nüsse oder Croutons erst kurz vor dem Servieren zugeben (sonst weich).",
    "Salat mit Dressing vermengen — nur so viel, dass Blätter glänzen, nicht schwimmen.",
    "Sofort auf kühlen Tellern anrichten; bei Meal Prep Dressing separat mitgeben."
  ]
}$g$::jsonb,
  1767,
  NULL,
  'Vegan'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Quinoa-Salat');

-- Veganes Chili
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Veganes Chili',
  4,
  $g${
  "titel": "Veganes Chili",
  "portionen": 4,
  "kategorie": "Vegan",
  "geschaetzte_kcal_gesamt": 1434,
  "zutaten": [
    {
      "name": "Tofu oder Kichererbsen",
      "menge": 400,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Kokosmilch",
      "menge": 400,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Currypaste",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Limettensaft",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Reis oder Nudeln",
      "menge": 300,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Gemüse der Saison",
      "menge": 400,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Sojasauce",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Arbeitsfläche freiräumen: große Pfanne oder Wok, Topf für Reis, Schöpfkelle, Küchenuhr und scharfes Messer bereitstellen.",
    "Reis parallel starten: 300 g Reis waschen, mit 450 ml Wasser salzen, aufkochen, Deckel, Stufe 1–2, 12–15 Min quellen lassen.",
    "Zwiebel schälen und fein würfeln, Ingwer und Knoblauch fein hacken — alles in Schälchen legen (Mise en place).",
    "Pfanne auf Herdstufe 6 von 9 stellen, 2 EL Öl erhitzen, Currypaste 1–2 Min anrösten, bis es duftet und leicht dunkler wird (nicht schwarz).",
    "Zwiebel und Ingwer 3–4 Min glasig dünsten, dann Tofu oder Kichererbsen zugeben und 4–5 Min anbraten oder mitgaren.",
    "Kokosmilch und passierte Tomaten einrühren, einmal aufkochen, Hitze auf Stufe 3–4 reduzieren.",
    "«Veganes Chili» 15–20 Min leicht köcheln lassen, gelegentlich rühren, bis die Soße sämig ist und leichtes Öl an der Oberfläche perlt.",
    "Mit Limettensaft, Salz, Pfeffer und optional 1 TL Zucker abschmecken (süß-sauer-salzig ausbalancieren).",
    "Reis mit einer Gabel auflockern, Curry auf tiefe Teller geben, frischen Koriander darüber streuen.",
    "Sofort heiß servieren; Reste 2 Tage kühl lagern und nur einmal vollständig durcherhitzen."
  ]
}$g$::jsonb,
  1434,
  NULL,
  'Vegan'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Veganes Chili');

-- Tofu-Scramble
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Tofu-Scramble',
  4,
  $g${
  "titel": "Tofu-Scramble",
  "portionen": 4,
  "kategorie": "Vegan",
  "geschaetzte_kcal_gesamt": 1468,
  "zutaten": [
    {
      "name": "Tofu oder Kichererbsen",
      "menge": 400,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Kokosmilch",
      "menge": 400,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Currypaste",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Limettensaft",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Reis oder Nudeln",
      "menge": 300,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Gemüse der Saison",
      "menge": 400,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Sojasauce",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Pfanne (28 cm) und Spatel bereitstellen; Zutaten in gleicher Größe schneiden, damit gleichzeitig gar sind.",
    "Pfanne 2 Min auf Herdstufe 7 von 9 leer vorwärmen, dann 2 EL Öl — es soll leicht schimmern.",
    "Fleisch oder Tofu zuerst bei hoher Hitze anbraten, nicht bewegen bis sich eine Kruste löst (2–3 Min), wenden.",
    "Gemüse zugeben, 4–6 Min mitbraten, Pfanne nicht überfüllen (sonst dämpft es).",
    "Sauce (Soja, Sahne, Brühe) einrühren, 2–3 Min einkochen lassen, bis die Soße am Spatel haftet.",
    "Mit Salz, Pfeffer, Kräutern abschmecken; Hitze reduzieren, 1 Min ziehen lassen.",
    "Sofort auf vorgewärmten Tellern servieren — Pfannengerichte verlieren schnell an Textur."
  ]
}$g$::jsonb,
  1468,
  NULL,
  'Vegan'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Tofu-Scramble');

-- Vegane Pfannkuchen
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Vegane Pfannkuchen',
  4,
  $g${
  "titel": "Vegane Pfannkuchen",
  "portionen": 4,
  "kategorie": "Vegan",
  "geschaetzte_kcal_gesamt": 1567,
  "zutaten": [
    {
      "name": "Tofu oder Kichererbsen",
      "menge": 400,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Kokosmilch",
      "menge": 400,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Currypaste",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Limettensaft",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Reis oder Nudeln",
      "menge": 300,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Gemüse der Saison",
      "menge": 400,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Sojasauce",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Ofen auf 175 °C vorheizen; Backform fetten oder mit Papier auslegen, Zutaten auf Raumtemperatur bringen.",
    "Trockene Zutaten (Mehl, Backpulver, Kakao) in einer Schüssel sieben, verrühren.",
    "Butter/Zucker oder Eier nach Rezept schaumig rühren (Handrührer Stufe 2–3, 3–5 Min).",
    "Mehlmischung unterheben — nur bis kein Mehl mehr sichtbar (Überrühren macht trocken).",
    "Teig in die Form füllen, Oberfläche glatt streichen, ggf. Kerne oder Streusel darauf.",
    "Backzeit laut Rezept; Stäbchenprobe: Holzspieß kommt sauber heraus (außer Brownies: feuchte Krümel).",
    "Form 10 Min auf dem Rost abkühlen, dann stürzen oder Stücke schneiden.",
    "Vollständig abgekühlt lagern oder lauwarm mit Sahne servieren."
  ]
}$g$::jsonb,
  1567,
  NULL,
  'Vegan'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Vegane Pfannkuchen');

-- Hummus mit Fladenbrot
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Hummus mit Fladenbrot',
  4,
  $g${
  "titel": "Hummus mit Fladenbrot",
  "portionen": 4,
  "kategorie": "Vegan",
  "geschaetzte_kcal_gesamt": 1458,
  "zutaten": [
    {
      "name": "Tofu oder Kichererbsen",
      "menge": 400,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Kokosmilch",
      "menge": 400,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Currypaste",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Limettensaft",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Reis oder Nudeln",
      "menge": 300,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Gemüse der Saison",
      "menge": 400,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Sojasauce",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Pfanne (28 cm) und Spatel bereitstellen; Zutaten in gleicher Größe schneiden, damit gleichzeitig gar sind.",
    "Pfanne 2 Min auf Herdstufe 7 von 9 leer vorwärmen, dann 2 EL Öl — es soll leicht schimmern.",
    "Fleisch oder Tofu zuerst bei hoher Hitze anbraten, nicht bewegen bis sich eine Kruste löst (2–3 Min), wenden.",
    "Gemüse zugeben, 4–6 Min mitbraten, Pfanne nicht überfüllen (sonst dämpft es).",
    "Sauce (Soja, Sahne, Brühe) einrühren, 2–3 Min einkochen lassen, bis die Soße am Spatel haftet.",
    "Mit Salz, Pfeffer, Kräutern abschmecken; Hitze reduzieren, 1 Min ziehen lassen.",
    "Sofort auf vorgewärmten Tellern servieren — Pfannengerichte verlieren schnell an Textur."
  ]
}$g$::jsonb,
  1458,
  NULL,
  'Vegan'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Hummus mit Fladenbrot');

-- Vegane Gemüsepaella
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Vegane Gemüsepaella',
  4,
  $g${
  "titel": "Vegane Gemüsepaella",
  "portionen": 4,
  "kategorie": "Vegan",
  "geschaetzte_kcal_gesamt": 1402,
  "zutaten": [
    {
      "name": "Tofu oder Kichererbsen",
      "menge": 400,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Kokosmilch",
      "menge": 400,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Currypaste",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Limettensaft",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Reis oder Nudeln",
      "menge": 300,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Gemüse der Saison",
      "menge": 400,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Sojasauce",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Pfanne (28 cm) und Spatel bereitstellen; Zutaten in gleicher Größe schneiden, damit gleichzeitig gar sind.",
    "Pfanne 2 Min auf Herdstufe 7 von 9 leer vorwärmen, dann 2 EL Öl — es soll leicht schimmern.",
    "Fleisch oder Tofu zuerst bei hoher Hitze anbraten, nicht bewegen bis sich eine Kruste löst (2–3 Min), wenden.",
    "Gemüse zugeben, 4–6 Min mitbraten, Pfanne nicht überfüllen (sonst dämpft es).",
    "Sauce (Soja, Sahne, Brühe) einrühren, 2–3 Min einkochen lassen, bis die Soße am Spatel haftet.",
    "Mit Salz, Pfeffer, Kräutern abschmecken; Hitze reduzieren, 1 Min ziehen lassen.",
    "Sofort auf vorgewärmten Tellern servieren — Pfannengerichte verlieren schnell an Textur."
  ]
}$g$::jsonb,
  1402,
  NULL,
  'Vegan'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Vegane Gemüsepaella');

-- Rote-Bete-Salat
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Rote-Bete-Salat',
  4,
  $g${
  "titel": "Rote-Bete-Salat",
  "portionen": 4,
  "kategorie": "Vegan",
  "geschaetzte_kcal_gesamt": 1585,
  "zutaten": [
    {
      "name": "Tofu oder Kichererbsen",
      "menge": 400,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Kokosmilch",
      "menge": 400,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Currypaste",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Limettensaft",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Reis oder Nudeln",
      "menge": 300,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Gemüse der Saison",
      "menge": 400,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Sojasauce",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Salatschüssel und große Schüssel mit kaltem Wasser bereitstellen; Gemüse gründlich waschen und trocken schleudern.",
    "Blattsalat in mundgerechte Stücke zupfen oder schneiden — Messer vermeidet braune Schnittkanten.",
    "Festes Gemüse (Gurke, Paprika, Tomaten) in gleichmäßige Stücke schneiden, separat lagern.",
    "Dressing in kleiner Schüssel: Öl, Essig, Senf, Salz, Pfeffer mit Schneebesen emulgieren.",
    "Käse, Nüsse oder Croutons erst kurz vor dem Servieren zugeben (sonst weich).",
    "Salat mit Dressing vermengen — nur so viel, dass Blätter glänzen, nicht schwimmen.",
    "Sofort auf kühlen Tellern anrichten; bei Meal Prep Dressing separat mitgeben."
  ]
}$g$::jsonb,
  1585,
  NULL,
  'Vegan'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Rote-Bete-Salat');

-- Vegane Schoko-Brownies
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Vegane Schoko-Brownies',
  4,
  $g${
  "titel": "Vegane Schoko-Brownies",
  "portionen": 4,
  "kategorie": "Vegan",
  "geschaetzte_kcal_gesamt": 1531,
  "zutaten": [
    {
      "name": "Tofu oder Kichererbsen",
      "menge": 400,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Kokosmilch",
      "menge": 400,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Currypaste",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Limettensaft",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Reis oder Nudeln",
      "menge": 300,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Gemüse der Saison",
      "menge": 400,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Sojasauce",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Ofen auf 175 °C vorheizen; Backform fetten oder mit Papier auslegen, Zutaten auf Raumtemperatur bringen.",
    "Trockene Zutaten (Mehl, Backpulver, Kakao) in einer Schüssel sieben, verrühren.",
    "Butter/Zucker oder Eier nach Rezept schaumig rühren (Handrührer Stufe 2–3, 3–5 Min).",
    "Mehlmischung unterheben — nur bis kein Mehl mehr sichtbar (Überrühren macht trocken).",
    "Teig in die Form füllen, Oberfläche glatt streichen, ggf. Kerne oder Streusel darauf.",
    "Backzeit laut Rezept; Stäbchenprobe: Holzspieß kommt sauber heraus (außer Brownies: feuchte Krümel).",
    "Form 10 Min auf dem Rost abkühlen, dann stürzen oder Stücke schneiden.",
    "Vollständig abgekühlt lagern oder lauwarm mit Sahne servieren."
  ]
}$g$::jsonb,
  1531,
  NULL,
  'Vegan'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Vegane Schoko-Brownies');

-- Avocado-Toast
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Avocado-Toast',
  4,
  $g${
  "titel": "Avocado-Toast",
  "portionen": 4,
  "kategorie": "Vegan",
  "geschaetzte_kcal_gesamt": 1469,
  "zutaten": [
    {
      "name": "Tofu oder Kichererbsen",
      "menge": 400,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Kokosmilch",
      "menge": 400,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Currypaste",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Limettensaft",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Reis oder Nudeln",
      "menge": 300,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Gemüse der Saison",
      "menge": 400,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Sojasauce",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Pfanne (28 cm) und Spatel bereitstellen; Zutaten in gleicher Größe schneiden, damit gleichzeitig gar sind.",
    "Pfanne 2 Min auf Herdstufe 7 von 9 leer vorwärmen, dann 2 EL Öl — es soll leicht schimmern.",
    "Fleisch oder Tofu zuerst bei hoher Hitze anbraten, nicht bewegen bis sich eine Kruste löst (2–3 Min), wenden.",
    "Gemüse zugeben, 4–6 Min mitbraten, Pfanne nicht überfüllen (sonst dämpft es).",
    "Sauce (Soja, Sahne, Brühe) einrühren, 2–3 Min einkochen lassen, bis die Soße am Spatel haftet.",
    "Mit Salz, Pfeffer, Kräutern abschmecken; Hitze reduzieren, 1 Min ziehen lassen.",
    "Sofort auf vorgewärmten Tellern servieren — Pfannengerichte verlieren schnell an Textur."
  ]
}$g$::jsonb,
  1469,
  NULL,
  'Vegan'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Avocado-Toast');

-- Vegane Minestrone
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Vegane Minestrone',
  4,
  $g${
  "titel": "Vegane Minestrone",
  "portionen": 4,
  "kategorie": "Vegan",
  "geschaetzte_kcal_gesamt": 1490,
  "zutaten": [
    {
      "name": "Tofu oder Kichererbsen",
      "menge": 400,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Kokosmilch",
      "menge": 400,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Currypaste",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Limettensaft",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Reis oder Nudeln",
      "menge": 300,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Gemüse der Saison",
      "menge": 400,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Sojasauce",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Großen Topf (4–5 l) und Schöpfkelle bereitstellen; Gemüse waschen, Enden entfernen, in gleichmäßige Würfel schneiden.",
    "Topf auf Herdstufe 6 von 9 stellen, 2 EL Öl oder Butter erhitzen, Zwiebel und Knoblauch 4 Min glasig dünsten.",
    "Hartes Gemüse (Karotten, Sellerie, Kartoffeln) 5–6 Min mit anschwitzen, gelegentlich rühren, nicht bräunen.",
    "Brühe (ca. 1–1,2 l) angießen, mit einem Spritzer einmal aufkochen, dann Hitze auf Stufe 3–4 reduzieren.",
    "Vegane Minestrone: 20–30 Min leicht köcheln, bis alles weich ist; mit dem Löffel prüfen — keine harten Stücke.",
    "Optional mit Stabmixer pürieren: Mixer tief ins Flüssige tauchen, kurze Pulse, Spritzer vermeiden; oder grob lassen.",
    "Mit Salz, Pfeffer, Muskat oder frischen Kräutern abschmecken; Konsistenz mit Wasser oder Sahne anpassen.",
    "Bei Bedarf Einlage (Nudeln, Croutons, Sahnehaube) separat zubereiten und erst beim Servieren zugeben.",
    "Suppe in vorgewärmte Schalen füllen, heiß servieren; Rest im Topf auf Stufe 2 warm halten."
  ]
}$g$::jsonb,
  1490,
  NULL,
  'Vegan'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Vegane Minestrone');

-- Tempeh-Gemüse-Pfanne
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Tempeh-Gemüse-Pfanne',
  4,
  $g${
  "titel": "Tempeh-Gemüse-Pfanne",
  "portionen": 4,
  "kategorie": "Vegan",
  "geschaetzte_kcal_gesamt": 1450,
  "zutaten": [
    {
      "name": "Tofu oder Kichererbsen",
      "menge": 400,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Kokosmilch",
      "menge": 400,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Currypaste",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Limettensaft",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Reis oder Nudeln",
      "menge": 300,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Gemüse der Saison",
      "menge": 400,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Sojasauce",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Pfanne (28 cm) und Spatel bereitstellen; Zutaten in gleicher Größe schneiden, damit gleichzeitig gar sind.",
    "Pfanne 2 Min auf Herdstufe 7 von 9 leer vorwärmen, dann 2 EL Öl — es soll leicht schimmern.",
    "Fleisch oder Tofu zuerst bei hoher Hitze anbraten, nicht bewegen bis sich eine Kruste löst (2–3 Min), wenden.",
    "Gemüse zugeben, 4–6 Min mitbraten, Pfanne nicht überfüllen (sonst dämpft es).",
    "Sauce (Soja, Sahne, Brühe) einrühren, 2–3 Min einkochen lassen, bis die Soße am Spatel haftet.",
    "Mit Salz, Pfeffer, Kräutern abschmecken; Hitze reduzieren, 1 Min ziehen lassen.",
    "Sofort auf vorgewärmten Tellern servieren — Pfannengerichte verlieren schnell an Textur."
  ]
}$g$::jsonb,
  1450,
  NULL,
  'Vegan'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Tempeh-Gemüse-Pfanne');

-- Vegane Kartoffelsuppe
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Vegane Kartoffelsuppe',
  4,
  $g${
  "titel": "Vegane Kartoffelsuppe",
  "portionen": 4,
  "kategorie": "Vegan",
  "geschaetzte_kcal_gesamt": 1513,
  "zutaten": [
    {
      "name": "Tofu oder Kichererbsen",
      "menge": 400,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Kokosmilch",
      "menge": 400,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Currypaste",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Limettensaft",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Reis oder Nudeln",
      "menge": 300,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Gemüse der Saison",
      "menge": 400,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Sojasauce",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Großen Topf (4–5 l) und Schöpfkelle bereitstellen; Gemüse waschen, Enden entfernen, in gleichmäßige Würfel schneiden.",
    "Topf auf Herdstufe 6 von 9 stellen, 2 EL Öl oder Butter erhitzen, Zwiebel und Knoblauch 4 Min glasig dünsten.",
    "Hartes Gemüse (Karotten, Sellerie, Kartoffeln) 5–6 Min mit anschwitzen, gelegentlich rühren, nicht bräunen.",
    "Brühe (ca. 1–1,2 l) angießen, mit einem Spritzer einmal aufkochen, dann Hitze auf Stufe 3–4 reduzieren.",
    "Vegane Kartoffelsuppe: 20–30 Min leicht köcheln, bis alles weich ist; mit dem Löffel prüfen — keine harten Stücke.",
    "Optional mit Stabmixer pürieren: Mixer tief ins Flüssige tauchen, kurze Pulse, Spritzer vermeiden; oder grob lassen.",
    "Mit Salz, Pfeffer, Muskat oder frischen Kräutern abschmecken; Konsistenz mit Wasser oder Sahne anpassen.",
    "Bei Bedarf Einlage (Nudeln, Croutons, Sahnehaube) separat zubereiten und erst beim Servieren zugeben.",
    "Suppe in vorgewärmte Schalen füllen, heiß servieren; Rest im Topf auf Stufe 2 warm halten."
  ]
}$g$::jsonb,
  1513,
  NULL,
  'Vegan'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Vegane Kartoffelsuppe');

-- Schwarze-Bohnen-Bowl
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Schwarze-Bohnen-Bowl',
  4,
  $g${
  "titel": "Schwarze-Bohnen-Bowl",
  "portionen": 4,
  "kategorie": "Vegan",
  "geschaetzte_kcal_gesamt": 1735,
  "zutaten": [
    {
      "name": "Tofu oder Kichererbsen",
      "menge": 400,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Kokosmilch",
      "menge": 400,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Currypaste",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Limettensaft",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Reis oder Nudeln",
      "menge": 300,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Gemüse der Saison",
      "menge": 400,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Sojasauce",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Salatschüssel und große Schüssel mit kaltem Wasser bereitstellen; Gemüse gründlich waschen und trocken schleudern.",
    "Blattsalat in mundgerechte Stücke zupfen oder schneiden — Messer vermeidet braune Schnittkanten.",
    "Festes Gemüse (Gurke, Paprika, Tomaten) in gleichmäßige Stücke schneiden, separat lagern.",
    "Dressing in kleiner Schüssel: Öl, Essig, Senf, Salz, Pfeffer mit Schneebesen emulgieren.",
    "Käse, Nüsse oder Croutons erst kurz vor dem Servieren zugeben (sonst weich).",
    "Salat mit Dressing vermengen — nur so viel, dass Blätter glänzen, nicht schwimmen.",
    "Sofort auf kühlen Tellern anrichten; bei Meal Prep Dressing separat mitgeben."
  ]
}$g$::jsonb,
  1735,
  NULL,
  'Vegan'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Schwarze-Bohnen-Bowl');

-- Veganes Ratatouille
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Veganes Ratatouille',
  4,
  $g${
  "titel": "Veganes Ratatouille",
  "portionen": 4,
  "kategorie": "Vegan",
  "geschaetzte_kcal_gesamt": 1703,
  "zutaten": [
    {
      "name": "Tofu oder Kichererbsen",
      "menge": 400,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Kokosmilch",
      "menge": 400,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Currypaste",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Limettensaft",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Reis oder Nudeln",
      "menge": 300,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Gemüse der Saison",
      "menge": 400,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Sojasauce",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Pfanne (28 cm) und Spatel bereitstellen; Zutaten in gleicher Größe schneiden, damit gleichzeitig gar sind.",
    "Pfanne 2 Min auf Herdstufe 7 von 9 leer vorwärmen, dann 2 EL Öl — es soll leicht schimmern.",
    "Fleisch oder Tofu zuerst bei hoher Hitze anbraten, nicht bewegen bis sich eine Kruste löst (2–3 Min), wenden.",
    "Gemüse zugeben, 4–6 Min mitbraten, Pfanne nicht überfüllen (sonst dämpft es).",
    "Sauce (Soja, Sahne, Brühe) einrühren, 2–3 Min einkochen lassen, bis die Soße am Spatel haftet.",
    "Mit Salz, Pfeffer, Kräutern abschmecken; Hitze reduzieren, 1 Min ziehen lassen.",
    "Sofort auf vorgewärmten Tellern servieren — Pfannengerichte verlieren schnell an Textur."
  ]
}$g$::jsonb,
  1703,
  NULL,
  'Vegan'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Veganes Ratatouille');

-- Erbsen-Hummus-Wrap
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Erbsen-Hummus-Wrap',
  4,
  $g${
  "titel": "Erbsen-Hummus-Wrap",
  "portionen": 4,
  "kategorie": "Vegan",
  "geschaetzte_kcal_gesamt": 1546,
  "zutaten": [
    {
      "name": "Tofu oder Kichererbsen",
      "menge": 400,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Kokosmilch",
      "menge": 400,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Currypaste",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Limettensaft",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Reis oder Nudeln",
      "menge": 300,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Gemüse der Saison",
      "menge": 400,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Sojasauce",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Füllung vorbereiten: Protein/Gemüse würzen und in Pfanne oder Ofen garen, abkühlen lassen falls nötig.",
    "Tortillas oder Fladen kurz in trockener Pfanne erwärmen (30 s pro Seite), geschmeidig machen.",
    "Sauce (Joghurt, Tahini, Salsa) dünn auf die Mitte streichen, nicht bis zum Rand.",
    "Füllung in der Mitte stapeln, Seiten einschlagen, fest rollen.",
    "Optional in Pfanne 2 Min goldbraun anpressen; diagonal schneiden und servieren."
  ]
}$g$::jsonb,
  1546,
  NULL,
  'Vegan'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Erbsen-Hummus-Wrap');

-- Vegane Haferflocken-Kekse
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Vegane Haferflocken-Kekse',
  4,
  $g${
  "titel": "Vegane Haferflocken-Kekse",
  "portionen": 4,
  "kategorie": "Vegan",
  "geschaetzte_kcal_gesamt": 1798,
  "zutaten": [
    {
      "name": "Tofu oder Kichererbsen",
      "menge": 400,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Kokosmilch",
      "menge": 400,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Currypaste",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Limettensaft",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Reis oder Nudeln",
      "menge": 300,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Gemüse der Saison",
      "menge": 400,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Sojasauce",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Ofen auf 175 °C vorheizen; Backform fetten oder mit Papier auslegen, Zutaten auf Raumtemperatur bringen.",
    "Trockene Zutaten (Mehl, Backpulver, Kakao) in einer Schüssel sieben, verrühren.",
    "Butter/Zucker oder Eier nach Rezept schaumig rühren (Handrührer Stufe 2–3, 3–5 Min).",
    "Mehlmischung unterheben — nur bis kein Mehl mehr sichtbar (Überrühren macht trocken).",
    "Teig in die Form füllen, Oberfläche glatt streichen, ggf. Kerne oder Streusel darauf.",
    "Backzeit laut Rezept; Stäbchenprobe: Holzspieß kommt sauber heraus (außer Brownies: feuchte Krümel).",
    "Form 10 Min auf dem Rost abkühlen, dann stürzen oder Stücke schneiden.",
    "Vollständig abgekühlt lagern oder lauwarm mit Sahne servieren."
  ]
}$g$::jsonb,
  1798,
  NULL,
  'Vegan'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Vegane Haferflocken-Kekse');

-- Kokos-Mango-Reis
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Kokos-Mango-Reis',
  4,
  $g${
  "titel": "Kokos-Mango-Reis",
  "portionen": 4,
  "kategorie": "Vegan",
  "geschaetzte_kcal_gesamt": 1710,
  "zutaten": [
    {
      "name": "Tofu oder Kichererbsen",
      "menge": 400,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Kokosmilch",
      "menge": 400,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Currypaste",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Limettensaft",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Reis oder Nudeln",
      "menge": 300,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Gemüse der Saison",
      "menge": 400,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Sojasauce",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Pfanne (28 cm) und Spatel bereitstellen; Zutaten in gleicher Größe schneiden, damit gleichzeitig gar sind.",
    "Pfanne 2 Min auf Herdstufe 7 von 9 leer vorwärmen, dann 2 EL Öl — es soll leicht schimmern.",
    "Fleisch oder Tofu zuerst bei hoher Hitze anbraten, nicht bewegen bis sich eine Kruste löst (2–3 Min), wenden.",
    "Gemüse zugeben, 4–6 Min mitbraten, Pfanne nicht überfüllen (sonst dämpft es).",
    "Sauce (Soja, Sahne, Brühe) einrühren, 2–3 Min einkochen lassen, bis die Soße am Spatel haftet.",
    "Mit Salz, Pfeffer, Kräutern abschmecken; Hitze reduzieren, 1 Min ziehen lassen.",
    "Sofort auf vorgewärmten Tellern servieren — Pfannengerichte verlieren schnell an Textur."
  ]
}$g$::jsonb,
  1710,
  NULL,
  'Vegan'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Kokos-Mango-Reis');

-- Penne all'Arrabbiata
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Penne all''Arrabbiata',
  4,
  $g${
  "titel": "Penne all'Arrabbiata",
  "portionen": 4,
  "kategorie": "Nudelgericht",
  "geschaetzte_kcal_gesamt": 2087,
  "zutaten": [
    {
      "name": "Penne",
      "menge": 400,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "passierte Tomaten",
      "menge": 500,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Knoblauchzehen",
      "menge": 3,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Chiliflocken",
      "menge": 1,
      "einheit": "TL",
      "aus_lager": false
    },
    {
      "name": "Olivenöl",
      "menge": 4,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Petersilie",
      "menge": 15,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Parmesan",
      "menge": 40,
      "einheit": "g",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Arbeitsfläche freiräumen: großer Topf (mind. 5 l), hohe Pfanne oder Sauteuse, Schöpfkelle, Sieb, Küchenuhr und großes Schneidebrett bereitstellen.",
    "Großen Topf mit reichlich kaltem Wasser füllen (ca. 1 l pro 100 g Penne), Deckel aufsetzen, auf Herdstufe 9 von 9 zum kräftigen Kochen bringen.",
    "Während das Wasser heizt: Penne, passierte Tomaten, Knoblauchzehen, Chiliflocken vorbereiten — Gemüse schneiden, Kräuter waschen, Käse reiben, alles in Schüsseln getrennt bereitstellen.",
    "Wasser kräftig salzen (ca. 1 EL Salz pro Liter), Penne einrühren, Uhr stellen: Packungsangabe minus 1 Min als Richtwert für al dente.",
    "Für Soße passend zum Gericht: Pfanne auf Herdstufe 6–7 von 9 vorwärmen, Öl oder Butter erhitzen bis leicht glänzend, nicht rauchen lassen.",
    "Aromaten (Zwiebel, Knoblauch) 3–4 Min glasig dünsten, dann Hauptzutaten nach Rezept anbraten oder mitgeben, Hitze anpassen.",
    "Flüssigkeit (Tomaten, Sahne, Brühe) zugeben, einmal aufkochen, Hitze auf Stufe 3–4 reduzieren, 8–15 Min köcheln bis die Konsistenz an der Soßenkelle haftet.",
    "Mit Salz, Pfeffer und ggf. Chili, Zitrone oder Käse abschmecken; Soße warm halten (Deckel, niedrige Stufe).",
    "2–3 Min vor Ende der Nudelgarzeit eine Schöpfkelle Nudelwasser aufheben — enthält Stärke zum Binden der Soße.",
    "Penne im Sieb abgießen, nicht abschrecken, sofort in die Pfanne zur Soße geben, mit etwas Nudelwasser unter Rühren emulgieren.",
    "1–2 Min auf Stufe 4 mitrühren, bis die Soße glänzend an den Nudeln haftet; Portionen mit Kelle auf tiefe Teller geben.",
    "Optional frisch geriebenen Käse, Kräuter oder Olivenöl darüber; sofort heiß servieren."
  ]
}$g$::jsonb,
  2087,
  NULL,
  'Nudelgericht'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Penne all''Arrabbiata');

-- Tagliatelle mit Steinpilzen
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Tagliatelle mit Steinpilzen',
  4,
  $g${
  "titel": "Tagliatelle mit Steinpilzen",
  "portionen": 4,
  "kategorie": "Nudelgericht",
  "geschaetzte_kcal_gesamt": 2095,
  "zutaten": [
    {
      "name": "Tagliatelle",
      "menge": 400,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Knoblauchzehen",
      "menge": 2,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Olivenöl",
      "menge": 3,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Parmesan",
      "menge": 50,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "passierte Tomaten",
      "menge": 400,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Basilikum",
      "menge": 10,
      "einheit": "g",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Arbeitsfläche freiräumen: großer Topf (mind. 5 l), hohe Pfanne oder Sauteuse, Schöpfkelle, Sieb, Küchenuhr und großes Schneidebrett bereitstellen.",
    "Großen Topf mit reichlich kaltem Wasser füllen (ca. 1 l pro 100 g Nudeln), Deckel aufsetzen, auf Herdstufe 9 von 9 zum kräftigen Kochen bringen.",
    "Während das Wasser heizt: Tagliatelle, Zwiebeln, Knoblauchzehen, Olivenöl vorbereiten — Gemüse schneiden, Kräuter waschen, Käse reiben, alles in Schüsseln getrennt bereitstellen.",
    "Wasser kräftig salzen (ca. 1 EL Salz pro Liter), Nudeln einrühren, Uhr stellen: Packungsangabe minus 1 Min als Richtwert für al dente.",
    "Für Soße passend zum Gericht: Pfanne auf Herdstufe 6–7 von 9 vorwärmen, Öl oder Butter erhitzen bis leicht glänzend, nicht rauchen lassen.",
    "Aromaten (Zwiebel, Knoblauch) 3–4 Min glasig dünsten, dann Hauptzutaten nach Rezept anbraten oder mitgeben, Hitze anpassen.",
    "Flüssigkeit (Tomaten, Sahne, Brühe) zugeben, einmal aufkochen, Hitze auf Stufe 3–4 reduzieren, 8–15 Min köcheln bis die Konsistenz an der Soßenkelle haftet.",
    "Mit Salz, Pfeffer und ggf. Chili, Zitrone oder Käse abschmecken; Soße warm halten (Deckel, niedrige Stufe).",
    "2–3 Min vor Ende der Nudelgarzeit eine Schöpfkelle Nudelwasser aufheben — enthält Stärke zum Binden der Soße.",
    "Nudeln im Sieb abgießen, nicht abschrecken, sofort in die Pfanne zur Soße geben, mit etwas Nudelwasser unter Rühren emulgieren.",
    "1–2 Min auf Stufe 4 mitrühren, bis die Soße glänzend an den Nudeln haftet; Portionen mit Kelle auf tiefe Teller geben.",
    "Optional frisch geriebenen Käse, Kräuter oder Olivenöl darüber; sofort heiß servieren."
  ]
}$g$::jsonb,
  2095,
  NULL,
  'Nudelgericht'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Tagliatelle mit Steinpilzen');

-- Spaghetti Aglio e Olio
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Spaghetti Aglio e Olio',
  4,
  $g${
  "titel": "Spaghetti Aglio e Olio",
  "portionen": 4,
  "kategorie": "Nudelgericht",
  "geschaetzte_kcal_gesamt": 1829,
  "zutaten": [
    {
      "name": "Spaghetti",
      "menge": 400,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Knoblauchzehen",
      "menge": 2,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Olivenöl",
      "menge": 3,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Parmesan",
      "menge": 50,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "passierte Tomaten",
      "menge": 400,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Basilikum",
      "menge": 10,
      "einheit": "g",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Arbeitsfläche freiräumen: großer Topf (mind. 5 l), hohe Pfanne oder Sauteuse, Schöpfkelle, Sieb, Küchenuhr und großes Schneidebrett bereitstellen.",
    "Großen Topf mit reichlich kaltem Wasser füllen (ca. 1 l pro 100 g Spaghetti), Deckel aufsetzen, auf Herdstufe 9 von 9 zum kräftigen Kochen bringen.",
    "Während das Wasser heizt: Spaghetti, Zwiebeln, Knoblauchzehen, Olivenöl vorbereiten — Gemüse schneiden, Kräuter waschen, Käse reiben, alles in Schüsseln getrennt bereitstellen.",
    "Wasser kräftig salzen (ca. 1 EL Salz pro Liter), Spaghetti einrühren, Uhr stellen: Packungsangabe minus 1 Min als Richtwert für al dente.",
    "Für Soße passend zum Gericht: Pfanne auf Herdstufe 6–7 von 9 vorwärmen, Öl oder Butter erhitzen bis leicht glänzend, nicht rauchen lassen.",
    "Aromaten (Zwiebel, Knoblauch) 3–4 Min glasig dünsten, dann Hauptzutaten nach Rezept anbraten oder mitgeben, Hitze anpassen.",
    "Flüssigkeit (Tomaten, Sahne, Brühe) zugeben, einmal aufkochen, Hitze auf Stufe 3–4 reduzieren, 8–15 Min köcheln bis die Konsistenz an der Soßenkelle haftet.",
    "Mit Salz, Pfeffer und ggf. Chili, Zitrone oder Käse abschmecken; Soße warm halten (Deckel, niedrige Stufe).",
    "2–3 Min vor Ende der Nudelgarzeit eine Schöpfkelle Nudelwasser aufheben — enthält Stärke zum Binden der Soße.",
    "Spaghetti im Sieb abgießen, nicht abschrecken, sofort in die Pfanne zur Soße geben, mit etwas Nudelwasser unter Rühren emulgieren.",
    "1–2 Min auf Stufe 4 mitrühren, bis die Soße glänzend an den Nudeln haftet; Portionen mit Kelle auf tiefe Teller geben.",
    "Optional frisch geriebenen Käse, Kräuter oder Olivenöl darüber; sofort heiß servieren."
  ]
}$g$::jsonb,
  1829,
  NULL,
  'Nudelgericht'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Spaghetti Aglio e Olio');

-- Tortellini in Sahnesoße
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Tortellini in Sahnesoße',
  4,
  $g${
  "titel": "Tortellini in Sahnesoße",
  "portionen": 4,
  "kategorie": "Nudelgericht",
  "geschaetzte_kcal_gesamt": 2186,
  "zutaten": [
    {
      "name": "Tortellini",
      "menge": 400,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Knoblauchzehen",
      "menge": 2,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Olivenöl",
      "menge": 3,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Parmesan",
      "menge": 50,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Sahne",
      "menge": 200,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Butter",
      "menge": 40,
      "einheit": "g",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Arbeitsfläche freiräumen: großer Topf (mind. 5 l), hohe Pfanne oder Sauteuse, Schöpfkelle, Sieb, Küchenuhr und großes Schneidebrett bereitstellen.",
    "Großen Topf mit reichlich kaltem Wasser füllen (ca. 1 l pro 100 g Nudeln), Deckel aufsetzen, auf Herdstufe 9 von 9 zum kräftigen Kochen bringen.",
    "Während das Wasser heizt: Tortellini, Zwiebeln, Knoblauchzehen, Olivenöl vorbereiten — Gemüse schneiden, Kräuter waschen, Käse reiben, alles in Schüsseln getrennt bereitstellen.",
    "Wasser kräftig salzen (ca. 1 EL Salz pro Liter), Nudeln einrühren, Uhr stellen: Packungsangabe minus 1 Min als Richtwert für al dente.",
    "Für Soße passend zum Gericht: Pfanne auf Herdstufe 6–7 von 9 vorwärmen, Öl oder Butter erhitzen bis leicht glänzend, nicht rauchen lassen.",
    "Aromaten (Zwiebel, Knoblauch) 3–4 Min glasig dünsten, dann Hauptzutaten nach Rezept anbraten oder mitgeben, Hitze anpassen.",
    "Flüssigkeit (Tomaten, Sahne, Brühe) zugeben, einmal aufkochen, Hitze auf Stufe 3–4 reduzieren, 8–15 Min köcheln bis die Konsistenz an der Soßenkelle haftet.",
    "Mit Salz, Pfeffer und ggf. Chili, Zitrone oder Käse abschmecken; Soße warm halten (Deckel, niedrige Stufe).",
    "2–3 Min vor Ende der Nudelgarzeit eine Schöpfkelle Nudelwasser aufheben — enthält Stärke zum Binden der Soße.",
    "Nudeln im Sieb abgießen, nicht abschrecken, sofort in die Pfanne zur Soße geben, mit etwas Nudelwasser unter Rühren emulgieren.",
    "1–2 Min auf Stufe 4 mitrühren, bis die Soße glänzend an den Nudeln haftet; Portionen mit Kelle auf tiefe Teller geben.",
    "Optional frisch geriebenen Käse, Kräuter oder Olivenöl darüber; sofort heiß servieren."
  ]
}$g$::jsonb,
  2186,
  NULL,
  'Nudelgericht'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Tortellini in Sahnesoße');

-- Linguine mit Meeresfrüchten
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Linguine mit Meeresfrüchten',
  4,
  $g${
  "titel": "Linguine mit Meeresfrüchten",
  "portionen": 4,
  "kategorie": "Nudelgericht",
  "geschaetzte_kcal_gesamt": 1828,
  "zutaten": [
    {
      "name": "Linguine",
      "menge": 400,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Knoblauchzehen",
      "menge": 2,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Olivenöl",
      "menge": 3,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Parmesan",
      "menge": 50,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Meeresfrüchte-Mix",
      "menge": 400,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Weißwein",
      "menge": 100,
      "einheit": "ml",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Arbeitsfläche freiräumen: großer Topf (mind. 5 l), hohe Pfanne oder Sauteuse, Schöpfkelle, Sieb, Küchenuhr und großes Schneidebrett bereitstellen.",
    "Großen Topf mit reichlich kaltem Wasser füllen (ca. 1 l pro 100 g Nudeln), Deckel aufsetzen, auf Herdstufe 9 von 9 zum kräftigen Kochen bringen.",
    "Während das Wasser heizt: Linguine, Zwiebeln, Knoblauchzehen, Olivenöl vorbereiten — Gemüse schneiden, Kräuter waschen, Käse reiben, alles in Schüsseln getrennt bereitstellen.",
    "Wasser kräftig salzen (ca. 1 EL Salz pro Liter), Nudeln einrühren, Uhr stellen: Packungsangabe minus 1 Min als Richtwert für al dente.",
    "Für Soße passend zum Gericht: Pfanne auf Herdstufe 6–7 von 9 vorwärmen, Öl oder Butter erhitzen bis leicht glänzend, nicht rauchen lassen.",
    "Aromaten (Zwiebel, Knoblauch) 3–4 Min glasig dünsten, dann Hauptzutaten nach Rezept anbraten oder mitgeben, Hitze anpassen.",
    "Flüssigkeit (Tomaten, Sahne, Brühe) zugeben, einmal aufkochen, Hitze auf Stufe 3–4 reduzieren, 8–15 Min köcheln bis die Konsistenz an der Soßenkelle haftet.",
    "Mit Salz, Pfeffer und ggf. Chili, Zitrone oder Käse abschmecken; Soße warm halten (Deckel, niedrige Stufe).",
    "2–3 Min vor Ende der Nudelgarzeit eine Schöpfkelle Nudelwasser aufheben — enthält Stärke zum Binden der Soße.",
    "Nudeln im Sieb abgießen, nicht abschrecken, sofort in die Pfanne zur Soße geben, mit etwas Nudelwasser unter Rühren emulgieren.",
    "1–2 Min auf Stufe 4 mitrühren, bis die Soße glänzend an den Nudeln haftet; Portionen mit Kelle auf tiefe Teller geben.",
    "Optional frisch geriebenen Käse, Kräuter oder Olivenöl darüber; sofort heiß servieren."
  ]
}$g$::jsonb,
  1828,
  NULL,
  'Nudelgericht'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Linguine mit Meeresfrüchten');

-- Penne alla Vodka
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Penne alla Vodka',
  4,
  $g${
  "titel": "Penne alla Vodka",
  "portionen": 4,
  "kategorie": "Nudelgericht",
  "geschaetzte_kcal_gesamt": 2077,
  "zutaten": [
    {
      "name": "Penne",
      "menge": 400,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Knoblauchzehen",
      "menge": 2,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Olivenöl",
      "menge": 3,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Parmesan",
      "menge": 50,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "passierte Tomaten",
      "menge": 400,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Basilikum",
      "menge": 10,
      "einheit": "g",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Arbeitsfläche freiräumen: großer Topf (mind. 5 l), hohe Pfanne oder Sauteuse, Schöpfkelle, Sieb, Küchenuhr und großes Schneidebrett bereitstellen.",
    "Großen Topf mit reichlich kaltem Wasser füllen (ca. 1 l pro 100 g Penne), Deckel aufsetzen, auf Herdstufe 9 von 9 zum kräftigen Kochen bringen.",
    "Während das Wasser heizt: Penne, Zwiebeln, Knoblauchzehen, Olivenöl vorbereiten — Gemüse schneiden, Kräuter waschen, Käse reiben, alles in Schüsseln getrennt bereitstellen.",
    "Wasser kräftig salzen (ca. 1 EL Salz pro Liter), Penne einrühren, Uhr stellen: Packungsangabe minus 1 Min als Richtwert für al dente.",
    "Für Soße passend zum Gericht: Pfanne auf Herdstufe 6–7 von 9 vorwärmen, Öl oder Butter erhitzen bis leicht glänzend, nicht rauchen lassen.",
    "Aromaten (Zwiebel, Knoblauch) 3–4 Min glasig dünsten, dann Hauptzutaten nach Rezept anbraten oder mitgeben, Hitze anpassen.",
    "Flüssigkeit (Tomaten, Sahne, Brühe) zugeben, einmal aufkochen, Hitze auf Stufe 3–4 reduzieren, 8–15 Min köcheln bis die Konsistenz an der Soßenkelle haftet.",
    "Mit Salz, Pfeffer und ggf. Chili, Zitrone oder Käse abschmecken; Soße warm halten (Deckel, niedrige Stufe).",
    "2–3 Min vor Ende der Nudelgarzeit eine Schöpfkelle Nudelwasser aufheben — enthält Stärke zum Binden der Soße.",
    "Penne im Sieb abgießen, nicht abschrecken, sofort in die Pfanne zur Soße geben, mit etwas Nudelwasser unter Rühren emulgieren.",
    "1–2 Min auf Stufe 4 mitrühren, bis die Soße glänzend an den Nudeln haftet; Portionen mit Kelle auf tiefe Teller geben.",
    "Optional frisch geriebenen Käse, Kräuter oder Olivenöl darüber; sofort heiß servieren."
  ]
}$g$::jsonb,
  2077,
  NULL,
  'Nudelgericht'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Penne alla Vodka');

-- Fettuccine Alfredo
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Fettuccine Alfredo',
  4,
  $g${
  "titel": "Fettuccine Alfredo",
  "portionen": 4,
  "kategorie": "Nudelgericht",
  "geschaetzte_kcal_gesamt": 1967,
  "zutaten": [
    {
      "name": "Fettuccine",
      "menge": 400,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Knoblauchzehen",
      "menge": 2,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Olivenöl",
      "menge": 3,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Parmesan",
      "menge": 50,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Sahne",
      "menge": 200,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Butter",
      "menge": 40,
      "einheit": "g",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Arbeitsfläche freiräumen: großer Topf (mind. 5 l), hohe Pfanne oder Sauteuse, Schöpfkelle, Sieb, Küchenuhr und großes Schneidebrett bereitstellen.",
    "Großen Topf mit reichlich kaltem Wasser füllen (ca. 1 l pro 100 g Nudeln), Deckel aufsetzen, auf Herdstufe 9 von 9 zum kräftigen Kochen bringen.",
    "Während das Wasser heizt: Fettuccine, Zwiebeln, Knoblauchzehen, Olivenöl vorbereiten — Gemüse schneiden, Kräuter waschen, Käse reiben, alles in Schüsseln getrennt bereitstellen.",
    "Wasser kräftig salzen (ca. 1 EL Salz pro Liter), Nudeln einrühren, Uhr stellen: Packungsangabe minus 1 Min als Richtwert für al dente.",
    "Für Soße passend zum Gericht: Pfanne auf Herdstufe 6–7 von 9 vorwärmen, Öl oder Butter erhitzen bis leicht glänzend, nicht rauchen lassen.",
    "Aromaten (Zwiebel, Knoblauch) 3–4 Min glasig dünsten, dann Hauptzutaten nach Rezept anbraten oder mitgeben, Hitze anpassen.",
    "Flüssigkeit (Tomaten, Sahne, Brühe) zugeben, einmal aufkochen, Hitze auf Stufe 3–4 reduzieren, 8–15 Min köcheln bis die Konsistenz an der Soßenkelle haftet.",
    "Mit Salz, Pfeffer und ggf. Chili, Zitrone oder Käse abschmecken; Soße warm halten (Deckel, niedrige Stufe).",
    "2–3 Min vor Ende der Nudelgarzeit eine Schöpfkelle Nudelwasser aufheben — enthält Stärke zum Binden der Soße.",
    "Nudeln im Sieb abgießen, nicht abschrecken, sofort in die Pfanne zur Soße geben, mit etwas Nudelwasser unter Rühren emulgieren.",
    "1–2 Min auf Stufe 4 mitrühren, bis die Soße glänzend an den Nudeln haftet; Portionen mit Kelle auf tiefe Teller geben.",
    "Optional frisch geriebenen Käse, Kräuter oder Olivenöl darüber; sofort heiß servieren."
  ]
}$g$::jsonb,
  1967,
  NULL,
  'Nudelgericht'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Fettuccine Alfredo');

-- Spaghetti Bolognese
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Spaghetti Bolognese',
  4,
  $g${
  "titel": "Spaghetti Bolognese",
  "portionen": 4,
  "kategorie": "Nudelgericht",
  "geschaetzte_kcal_gesamt": 2095,
  "zutaten": [
    {
      "name": "Spaghetti",
      "menge": 400,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Rinderhackfleisch",
      "menge": 500,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "passierte Tomaten",
      "menge": 400,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 2,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Möhren",
      "menge": 150,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Sellerie",
      "menge": 80,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Rotwein",
      "menge": 100,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Olivenöl",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Parmesan",
      "menge": 50,
      "einheit": "g",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Arbeitsfläche freiräumen: großer Topf (mind. 5 l), hohe Pfanne oder Sauteuse, Schöpfkelle, Sieb, Küchenuhr und großes Schneidebrett bereitstellen.",
    "Großen Topf mit reichlich kaltem Wasser füllen (ca. 1 l pro 100 g Spaghetti), Deckel aufsetzen, auf Herdstufe 9 von 9 zum kräftigen Kochen bringen.",
    "Während das Wasser heizt: Spaghetti, Rinderhackfleisch, passierte Tomaten, Zwiebeln vorbereiten — Gemüse schneiden, Kräuter waschen, Käse reiben, alles in Schüsseln getrennt bereitstellen.",
    "Wasser kräftig salzen (ca. 1 EL Salz pro Liter), Spaghetti einrühren, Uhr stellen: Packungsangabe minus 1 Min als Richtwert für al dente.",
    "Für Soße passend zum Gericht: Pfanne auf Herdstufe 6–7 von 9 vorwärmen, Öl oder Butter erhitzen bis leicht glänzend, nicht rauchen lassen.",
    "Aromaten (Zwiebel, Knoblauch) 3–4 Min glasig dünsten, dann Hauptzutaten nach Rezept anbraten oder mitgeben, Hitze anpassen.",
    "Flüssigkeit (Tomaten, Sahne, Brühe) zugeben, einmal aufkochen, Hitze auf Stufe 3–4 reduzieren, 8–15 Min köcheln bis die Konsistenz an der Soßenkelle haftet.",
    "Mit Salz, Pfeffer und ggf. Chili, Zitrone oder Käse abschmecken; Soße warm halten (Deckel, niedrige Stufe).",
    "2–3 Min vor Ende der Nudelgarzeit eine Schöpfkelle Nudelwasser aufheben — enthält Stärke zum Binden der Soße.",
    "Spaghetti im Sieb abgießen, nicht abschrecken, sofort in die Pfanne zur Soße geben, mit etwas Nudelwasser unter Rühren emulgieren.",
    "1–2 Min auf Stufe 4 mitrühren, bis die Soße glänzend an den Nudeln haftet; Portionen mit Kelle auf tiefe Teller geben.",
    "Optional frisch geriebenen Käse, Kräuter oder Olivenöl darüber; sofort heiß servieren."
  ]
}$g$::jsonb,
  2095,
  NULL,
  'Nudelgericht'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Spaghetti Bolognese');

-- Pasta Pesto Genovese
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Pasta Pesto Genovese',
  4,
  $g${
  "titel": "Pasta Pesto Genovese",
  "portionen": 4,
  "kategorie": "Nudelgericht",
  "geschaetzte_kcal_gesamt": 2120,
  "zutaten": [
    {
      "name": "Pasta",
      "menge": 400,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Knoblauchzehen",
      "menge": 2,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Olivenöl",
      "menge": 3,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Parmesan",
      "menge": 50,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Basilikum-Pesto",
      "menge": 120,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Pinienkerne",
      "menge": 30,
      "einheit": "g",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Arbeitsfläche freiräumen: großer Topf (mind. 5 l), hohe Pfanne oder Sauteuse, Schöpfkelle, Sieb, Küchenuhr und großes Schneidebrett bereitstellen.",
    "Großen Topf mit reichlich kaltem Wasser füllen (ca. 1 l pro 100 g Nudeln), Deckel aufsetzen, auf Herdstufe 9 von 9 zum kräftigen Kochen bringen.",
    "Während das Wasser heizt: Pasta, Zwiebeln, Knoblauchzehen, Olivenöl vorbereiten — Gemüse schneiden, Kräuter waschen, Käse reiben, alles in Schüsseln getrennt bereitstellen.",
    "Wasser kräftig salzen (ca. 1 EL Salz pro Liter), Nudeln einrühren, Uhr stellen: Packungsangabe minus 1 Min als Richtwert für al dente.",
    "Für Soße passend zum Gericht: Pfanne auf Herdstufe 6–7 von 9 vorwärmen, Öl oder Butter erhitzen bis leicht glänzend, nicht rauchen lassen.",
    "Aromaten (Zwiebel, Knoblauch) 3–4 Min glasig dünsten, dann Hauptzutaten nach Rezept anbraten oder mitgeben, Hitze anpassen.",
    "Flüssigkeit (Tomaten, Sahne, Brühe) zugeben, einmal aufkochen, Hitze auf Stufe 3–4 reduzieren, 8–15 Min köcheln bis die Konsistenz an der Soßenkelle haftet.",
    "Mit Salz, Pfeffer und ggf. Chili, Zitrone oder Käse abschmecken; Soße warm halten (Deckel, niedrige Stufe).",
    "2–3 Min vor Ende der Nudelgarzeit eine Schöpfkelle Nudelwasser aufheben — enthält Stärke zum Binden der Soße.",
    "Nudeln im Sieb abgießen, nicht abschrecken, sofort in die Pfanne zur Soße geben, mit etwas Nudelwasser unter Rühren emulgieren.",
    "1–2 Min auf Stufe 4 mitrühren, bis die Soße glänzend an den Nudeln haftet; Portionen mit Kelle auf tiefe Teller geben.",
    "Optional frisch geriebenen Käse, Kräuter oder Olivenöl darüber; sofort heiß servieren."
  ]
}$g$::jsonb,
  2120,
  NULL,
  'Nudelgericht'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Pasta Pesto Genovese');

-- Rigatoni al Forno
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Rigatoni al Forno',
  4,
  $g${
  "titel": "Rigatoni al Forno",
  "portionen": 4,
  "kategorie": "Nudelgericht",
  "geschaetzte_kcal_gesamt": 1814,
  "zutaten": [
    {
      "name": "Rigatoni",
      "menge": 400,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Knoblauchzehen",
      "menge": 2,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Olivenöl",
      "menge": 3,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Parmesan",
      "menge": 50,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "passierte Tomaten",
      "menge": 400,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Basilikum",
      "menge": 10,
      "einheit": "g",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Arbeitsfläche freiräumen: großer Topf (mind. 5 l), hohe Pfanne oder Sauteuse, Schöpfkelle, Sieb, Küchenuhr und großes Schneidebrett bereitstellen.",
    "Großen Topf mit reichlich kaltem Wasser füllen (ca. 1 l pro 100 g Nudeln), Deckel aufsetzen, auf Herdstufe 9 von 9 zum kräftigen Kochen bringen.",
    "Während das Wasser heizt: Rigatoni, Zwiebeln, Knoblauchzehen, Olivenöl vorbereiten — Gemüse schneiden, Kräuter waschen, Käse reiben, alles in Schüsseln getrennt bereitstellen.",
    "Wasser kräftig salzen (ca. 1 EL Salz pro Liter), Nudeln einrühren, Uhr stellen: Packungsangabe minus 1 Min als Richtwert für al dente.",
    "Für Soße passend zum Gericht: Pfanne auf Herdstufe 6–7 von 9 vorwärmen, Öl oder Butter erhitzen bis leicht glänzend, nicht rauchen lassen.",
    "Aromaten (Zwiebel, Knoblauch) 3–4 Min glasig dünsten, dann Hauptzutaten nach Rezept anbraten oder mitgeben, Hitze anpassen.",
    "Flüssigkeit (Tomaten, Sahne, Brühe) zugeben, einmal aufkochen, Hitze auf Stufe 3–4 reduzieren, 8–15 Min köcheln bis die Konsistenz an der Soßenkelle haftet.",
    "Mit Salz, Pfeffer und ggf. Chili, Zitrone oder Käse abschmecken; Soße warm halten (Deckel, niedrige Stufe).",
    "2–3 Min vor Ende der Nudelgarzeit eine Schöpfkelle Nudelwasser aufheben — enthält Stärke zum Binden der Soße.",
    "Nudeln im Sieb abgießen, nicht abschrecken, sofort in die Pfanne zur Soße geben, mit etwas Nudelwasser unter Rühren emulgieren.",
    "1–2 Min auf Stufe 4 mitrühren, bis die Soße glänzend an den Nudeln haftet; Portionen mit Kelle auf tiefe Teller geben.",
    "Optional frisch geriebenen Käse, Kräuter oder Olivenöl darüber; sofort heiß servieren."
  ]
}$g$::jsonb,
  1814,
  NULL,
  'Nudelgericht'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Rigatoni al Forno');

-- Spaghetti Marinara
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Spaghetti Marinara',
  4,
  $g${
  "titel": "Spaghetti Marinara",
  "portionen": 4,
  "kategorie": "Nudelgericht",
  "geschaetzte_kcal_gesamt": 1980,
  "zutaten": [
    {
      "name": "Spaghetti",
      "menge": 400,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Knoblauchzehen",
      "menge": 2,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Olivenöl",
      "menge": 3,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Parmesan",
      "menge": 50,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "passierte Tomaten",
      "menge": 400,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Basilikum",
      "menge": 10,
      "einheit": "g",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Arbeitsfläche freiräumen: großer Topf (mind. 5 l), hohe Pfanne oder Sauteuse, Schöpfkelle, Sieb, Küchenuhr und großes Schneidebrett bereitstellen.",
    "Großen Topf mit reichlich kaltem Wasser füllen (ca. 1 l pro 100 g Spaghetti), Deckel aufsetzen, auf Herdstufe 9 von 9 zum kräftigen Kochen bringen.",
    "Während das Wasser heizt: Spaghetti, Zwiebeln, Knoblauchzehen, Olivenöl vorbereiten — Gemüse schneiden, Kräuter waschen, Käse reiben, alles in Schüsseln getrennt bereitstellen.",
    "Wasser kräftig salzen (ca. 1 EL Salz pro Liter), Spaghetti einrühren, Uhr stellen: Packungsangabe minus 1 Min als Richtwert für al dente.",
    "Für Soße passend zum Gericht: Pfanne auf Herdstufe 6–7 von 9 vorwärmen, Öl oder Butter erhitzen bis leicht glänzend, nicht rauchen lassen.",
    "Aromaten (Zwiebel, Knoblauch) 3–4 Min glasig dünsten, dann Hauptzutaten nach Rezept anbraten oder mitgeben, Hitze anpassen.",
    "Flüssigkeit (Tomaten, Sahne, Brühe) zugeben, einmal aufkochen, Hitze auf Stufe 3–4 reduzieren, 8–15 Min köcheln bis die Konsistenz an der Soßenkelle haftet.",
    "Mit Salz, Pfeffer und ggf. Chili, Zitrone oder Käse abschmecken; Soße warm halten (Deckel, niedrige Stufe).",
    "2–3 Min vor Ende der Nudelgarzeit eine Schöpfkelle Nudelwasser aufheben — enthält Stärke zum Binden der Soße.",
    "Spaghetti im Sieb abgießen, nicht abschrecken, sofort in die Pfanne zur Soße geben, mit etwas Nudelwasser unter Rühren emulgieren.",
    "1–2 Min auf Stufe 4 mitrühren, bis die Soße glänzend an den Nudeln haftet; Portionen mit Kelle auf tiefe Teller geben.",
    "Optional frisch geriebenen Käse, Kräuter oder Olivenöl darüber; sofort heiß servieren."
  ]
}$g$::jsonb,
  1980,
  NULL,
  'Nudelgericht'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Spaghetti Marinara');

-- Mac and Cheese
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Mac and Cheese',
  4,
  $g${
  "titel": "Mac and Cheese",
  "portionen": 4,
  "kategorie": "Nudelgericht",
  "geschaetzte_kcal_gesamt": 1833,
  "zutaten": [
    {
      "name": "Pasta",
      "menge": 400,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Knoblauchzehen",
      "menge": 2,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Olivenöl",
      "menge": 3,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Parmesan",
      "menge": 50,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "passierte Tomaten",
      "menge": 400,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Basilikum",
      "menge": 10,
      "einheit": "g",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Arbeitsfläche freiräumen: großer Topf (mind. 5 l), hohe Pfanne oder Sauteuse, Schöpfkelle, Sieb, Küchenuhr und großes Schneidebrett bereitstellen.",
    "Großen Topf mit reichlich kaltem Wasser füllen (ca. 1 l pro 100 g Nudeln), Deckel aufsetzen, auf Herdstufe 9 von 9 zum kräftigen Kochen bringen.",
    "Während das Wasser heizt: Pasta, Zwiebeln, Knoblauchzehen, Olivenöl vorbereiten — Gemüse schneiden, Kräuter waschen, Käse reiben, alles in Schüsseln getrennt bereitstellen.",
    "Wasser kräftig salzen (ca. 1 EL Salz pro Liter), Nudeln einrühren, Uhr stellen: Packungsangabe minus 1 Min als Richtwert für al dente.",
    "Für Soße passend zum Gericht: Pfanne auf Herdstufe 6–7 von 9 vorwärmen, Öl oder Butter erhitzen bis leicht glänzend, nicht rauchen lassen.",
    "Aromaten (Zwiebel, Knoblauch) 3–4 Min glasig dünsten, dann Hauptzutaten nach Rezept anbraten oder mitgeben, Hitze anpassen.",
    "Flüssigkeit (Tomaten, Sahne, Brühe) zugeben, einmal aufkochen, Hitze auf Stufe 3–4 reduzieren, 8–15 Min köcheln bis die Konsistenz an der Soßenkelle haftet.",
    "Mit Salz, Pfeffer und ggf. Chili, Zitrone oder Käse abschmecken; Soße warm halten (Deckel, niedrige Stufe).",
    "2–3 Min vor Ende der Nudelgarzeit eine Schöpfkelle Nudelwasser aufheben — enthält Stärke zum Binden der Soße.",
    "Nudeln im Sieb abgießen, nicht abschrecken, sofort in die Pfanne zur Soße geben, mit etwas Nudelwasser unter Rühren emulgieren.",
    "1–2 Min auf Stufe 4 mitrühren, bis die Soße glänzend an den Nudeln haftet; Portionen mit Kelle auf tiefe Teller geben.",
    "Optional frisch geriebenen Käse, Kräuter oder Olivenöl darüber; sofort heiß servieren."
  ]
}$g$::jsonb,
  1833,
  NULL,
  'Nudelgericht'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Mac and Cheese');

-- Spaghetti mit Meatballs
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Spaghetti mit Meatballs',
  4,
  $g${
  "titel": "Spaghetti mit Meatballs",
  "portionen": 4,
  "kategorie": "Nudelgericht",
  "geschaetzte_kcal_gesamt": 2048,
  "zutaten": [
    {
      "name": "Spaghetti",
      "menge": 400,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Knoblauchzehen",
      "menge": 2,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Olivenöl",
      "menge": 3,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Parmesan",
      "menge": 50,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "passierte Tomaten",
      "menge": 400,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Basilikum",
      "menge": 10,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Rinderhackfleisch",
      "menge": 400,
      "einheit": "g",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Arbeitsfläche freiräumen: großer Topf (mind. 5 l), hohe Pfanne oder Sauteuse, Schöpfkelle, Sieb, Küchenuhr und großes Schneidebrett bereitstellen.",
    "Großen Topf mit reichlich kaltem Wasser füllen (ca. 1 l pro 100 g Spaghetti), Deckel aufsetzen, auf Herdstufe 9 von 9 zum kräftigen Kochen bringen.",
    "Während das Wasser heizt: Spaghetti, Zwiebeln, Knoblauchzehen, Olivenöl vorbereiten — Gemüse schneiden, Kräuter waschen, Käse reiben, alles in Schüsseln getrennt bereitstellen.",
    "Wasser kräftig salzen (ca. 1 EL Salz pro Liter), Spaghetti einrühren, Uhr stellen: Packungsangabe minus 1 Min als Richtwert für al dente.",
    "Für Soße passend zum Gericht: Pfanne auf Herdstufe 6–7 von 9 vorwärmen, Öl oder Butter erhitzen bis leicht glänzend, nicht rauchen lassen.",
    "Aromaten (Zwiebel, Knoblauch) 3–4 Min glasig dünsten, dann Hauptzutaten nach Rezept anbraten oder mitgeben, Hitze anpassen.",
    "Flüssigkeit (Tomaten, Sahne, Brühe) zugeben, einmal aufkochen, Hitze auf Stufe 3–4 reduzieren, 8–15 Min köcheln bis die Konsistenz an der Soßenkelle haftet.",
    "Mit Salz, Pfeffer und ggf. Chili, Zitrone oder Käse abschmecken; Soße warm halten (Deckel, niedrige Stufe).",
    "2–3 Min vor Ende der Nudelgarzeit eine Schöpfkelle Nudelwasser aufheben — enthält Stärke zum Binden der Soße.",
    "Spaghetti im Sieb abgießen, nicht abschrecken, sofort in die Pfanne zur Soße geben, mit etwas Nudelwasser unter Rühren emulgieren.",
    "1–2 Min auf Stufe 4 mitrühren, bis die Soße glänzend an den Nudeln haftet; Portionen mit Kelle auf tiefe Teller geben.",
    "Optional frisch geriebenen Käse, Kräuter oder Olivenöl darüber; sofort heiß servieren."
  ]
}$g$::jsonb,
  2048,
  NULL,
  'Nudelgericht'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Spaghetti mit Meatballs');

-- Penne Brokkoli-Sahne
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Penne Brokkoli-Sahne',
  4,
  $g${
  "titel": "Penne Brokkoli-Sahne",
  "portionen": 4,
  "kategorie": "Nudelgericht",
  "geschaetzte_kcal_gesamt": 2103,
  "zutaten": [
    {
      "name": "Penne",
      "menge": 400,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Knoblauchzehen",
      "menge": 2,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Olivenöl",
      "menge": 3,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Parmesan",
      "menge": 50,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Sahne",
      "menge": 200,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Butter",
      "menge": 40,
      "einheit": "g",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Arbeitsfläche freiräumen: großer Topf (mind. 5 l), hohe Pfanne oder Sauteuse, Schöpfkelle, Sieb, Küchenuhr und großes Schneidebrett bereitstellen.",
    "Großen Topf mit reichlich kaltem Wasser füllen (ca. 1 l pro 100 g Penne), Deckel aufsetzen, auf Herdstufe 9 von 9 zum kräftigen Kochen bringen.",
    "Während das Wasser heizt: Penne, Zwiebeln, Knoblauchzehen, Olivenöl vorbereiten — Gemüse schneiden, Kräuter waschen, Käse reiben, alles in Schüsseln getrennt bereitstellen.",
    "Wasser kräftig salzen (ca. 1 EL Salz pro Liter), Penne einrühren, Uhr stellen: Packungsangabe minus 1 Min als Richtwert für al dente.",
    "Für Soße passend zum Gericht: Pfanne auf Herdstufe 6–7 von 9 vorwärmen, Öl oder Butter erhitzen bis leicht glänzend, nicht rauchen lassen.",
    "Aromaten (Zwiebel, Knoblauch) 3–4 Min glasig dünsten, dann Hauptzutaten nach Rezept anbraten oder mitgeben, Hitze anpassen.",
    "Flüssigkeit (Tomaten, Sahne, Brühe) zugeben, einmal aufkochen, Hitze auf Stufe 3–4 reduzieren, 8–15 Min köcheln bis die Konsistenz an der Soßenkelle haftet.",
    "Mit Salz, Pfeffer und ggf. Chili, Zitrone oder Käse abschmecken; Soße warm halten (Deckel, niedrige Stufe).",
    "2–3 Min vor Ende der Nudelgarzeit eine Schöpfkelle Nudelwasser aufheben — enthält Stärke zum Binden der Soße.",
    "Penne im Sieb abgießen, nicht abschrecken, sofort in die Pfanne zur Soße geben, mit etwas Nudelwasser unter Rühren emulgieren.",
    "1–2 Min auf Stufe 4 mitrühren, bis die Soße glänzend an den Nudeln haftet; Portionen mit Kelle auf tiefe Teller geben.",
    "Optional frisch geriebenen Käse, Kräuter oder Olivenöl darüber; sofort heiß servieren."
  ]
}$g$::jsonb,
  2103,
  NULL,
  'Nudelgericht'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Penne Brokkoli-Sahne');

-- Pasta alla Norma
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Pasta alla Norma',
  4,
  $g${
  "titel": "Pasta alla Norma",
  "portionen": 4,
  "kategorie": "Nudelgericht",
  "geschaetzte_kcal_gesamt": 2088,
  "zutaten": [
    {
      "name": "Pasta",
      "menge": 400,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Knoblauchzehen",
      "menge": 2,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Olivenöl",
      "menge": 3,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Parmesan",
      "menge": 50,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "passierte Tomaten",
      "menge": 400,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Basilikum",
      "menge": 10,
      "einheit": "g",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Arbeitsfläche freiräumen: großer Topf (mind. 5 l), hohe Pfanne oder Sauteuse, Schöpfkelle, Sieb, Küchenuhr und großes Schneidebrett bereitstellen.",
    "Großen Topf mit reichlich kaltem Wasser füllen (ca. 1 l pro 100 g Nudeln), Deckel aufsetzen, auf Herdstufe 9 von 9 zum kräftigen Kochen bringen.",
    "Während das Wasser heizt: Pasta, Zwiebeln, Knoblauchzehen, Olivenöl vorbereiten — Gemüse schneiden, Kräuter waschen, Käse reiben, alles in Schüsseln getrennt bereitstellen.",
    "Wasser kräftig salzen (ca. 1 EL Salz pro Liter), Nudeln einrühren, Uhr stellen: Packungsangabe minus 1 Min als Richtwert für al dente.",
    "Für Soße passend zum Gericht: Pfanne auf Herdstufe 6–7 von 9 vorwärmen, Öl oder Butter erhitzen bis leicht glänzend, nicht rauchen lassen.",
    "Aromaten (Zwiebel, Knoblauch) 3–4 Min glasig dünsten, dann Hauptzutaten nach Rezept anbraten oder mitgeben, Hitze anpassen.",
    "Flüssigkeit (Tomaten, Sahne, Brühe) zugeben, einmal aufkochen, Hitze auf Stufe 3–4 reduzieren, 8–15 Min köcheln bis die Konsistenz an der Soßenkelle haftet.",
    "Mit Salz, Pfeffer und ggf. Chili, Zitrone oder Käse abschmecken; Soße warm halten (Deckel, niedrige Stufe).",
    "2–3 Min vor Ende der Nudelgarzeit eine Schöpfkelle Nudelwasser aufheben — enthält Stärke zum Binden der Soße.",
    "Nudeln im Sieb abgießen, nicht abschrecken, sofort in die Pfanne zur Soße geben, mit etwas Nudelwasser unter Rühren emulgieren.",
    "1–2 Min auf Stufe 4 mitrühren, bis die Soße glänzend an den Nudeln haftet; Portionen mit Kelle auf tiefe Teller geben.",
    "Optional frisch geriebenen Käse, Kräuter oder Olivenöl darüber; sofort heiß servieren."
  ]
}$g$::jsonb,
  2088,
  NULL,
  'Nudelgericht'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Pasta alla Norma');

-- Spaghetti Napoli
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Spaghetti Napoli',
  4,
  $g${
  "titel": "Spaghetti Napoli",
  "portionen": 4,
  "kategorie": "Nudelgericht",
  "geschaetzte_kcal_gesamt": 2180,
  "zutaten": [
    {
      "name": "Spaghetti",
      "menge": 400,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Knoblauchzehen",
      "menge": 2,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Olivenöl",
      "menge": 3,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Parmesan",
      "menge": 50,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "passierte Tomaten",
      "menge": 400,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Basilikum",
      "menge": 10,
      "einheit": "g",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Arbeitsfläche freiräumen: großer Topf (mind. 5 l), hohe Pfanne oder Sauteuse, Schöpfkelle, Sieb, Küchenuhr und großes Schneidebrett bereitstellen.",
    "Großen Topf mit reichlich kaltem Wasser füllen (ca. 1 l pro 100 g Spaghetti), Deckel aufsetzen, auf Herdstufe 9 von 9 zum kräftigen Kochen bringen.",
    "Während das Wasser heizt: Spaghetti, Zwiebeln, Knoblauchzehen, Olivenöl vorbereiten — Gemüse schneiden, Kräuter waschen, Käse reiben, alles in Schüsseln getrennt bereitstellen.",
    "Wasser kräftig salzen (ca. 1 EL Salz pro Liter), Spaghetti einrühren, Uhr stellen: Packungsangabe minus 1 Min als Richtwert für al dente.",
    "Für Soße passend zum Gericht: Pfanne auf Herdstufe 6–7 von 9 vorwärmen, Öl oder Butter erhitzen bis leicht glänzend, nicht rauchen lassen.",
    "Aromaten (Zwiebel, Knoblauch) 3–4 Min glasig dünsten, dann Hauptzutaten nach Rezept anbraten oder mitgeben, Hitze anpassen.",
    "Flüssigkeit (Tomaten, Sahne, Brühe) zugeben, einmal aufkochen, Hitze auf Stufe 3–4 reduzieren, 8–15 Min köcheln bis die Konsistenz an der Soßenkelle haftet.",
    "Mit Salz, Pfeffer und ggf. Chili, Zitrone oder Käse abschmecken; Soße warm halten (Deckel, niedrige Stufe).",
    "2–3 Min vor Ende der Nudelgarzeit eine Schöpfkelle Nudelwasser aufheben — enthält Stärke zum Binden der Soße.",
    "Spaghetti im Sieb abgießen, nicht abschrecken, sofort in die Pfanne zur Soße geben, mit etwas Nudelwasser unter Rühren emulgieren.",
    "1–2 Min auf Stufe 4 mitrühren, bis die Soße glänzend an den Nudeln haftet; Portionen mit Kelle auf tiefe Teller geben.",
    "Optional frisch geriebenen Käse, Kräuter oder Olivenöl darüber; sofort heiß servieren."
  ]
}$g$::jsonb,
  2180,
  NULL,
  'Nudelgericht'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Spaghetti Napoli');

-- One-Pot Pasta Tomate-Mozzarella
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'One-Pot Pasta Tomate-Mozzarella',
  4,
  $g${
  "titel": "One-Pot Pasta Tomate-Mozzarella",
  "portionen": 4,
  "kategorie": "Nudelgericht",
  "geschaetzte_kcal_gesamt": 1931,
  "zutaten": [
    {
      "name": "Pasta",
      "menge": 400,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Knoblauchzehen",
      "menge": 2,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Olivenöl",
      "menge": 3,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Parmesan",
      "menge": 50,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "passierte Tomaten",
      "menge": 400,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Basilikum",
      "menge": 10,
      "einheit": "g",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Arbeitsfläche freiräumen: großer Topf (mind. 5 l), hohe Pfanne oder Sauteuse, Schöpfkelle, Sieb, Küchenuhr und großes Schneidebrett bereitstellen.",
    "Großen Topf mit reichlich kaltem Wasser füllen (ca. 1 l pro 100 g Nudeln), Deckel aufsetzen, auf Herdstufe 9 von 9 zum kräftigen Kochen bringen.",
    "Während das Wasser heizt: Pasta, Zwiebeln, Knoblauchzehen, Olivenöl vorbereiten — Gemüse schneiden, Kräuter waschen, Käse reiben, alles in Schüsseln getrennt bereitstellen.",
    "Wasser kräftig salzen (ca. 1 EL Salz pro Liter), Nudeln einrühren, Uhr stellen: Packungsangabe minus 1 Min als Richtwert für al dente.",
    "Für Soße passend zum Gericht: Pfanne auf Herdstufe 6–7 von 9 vorwärmen, Öl oder Butter erhitzen bis leicht glänzend, nicht rauchen lassen.",
    "Aromaten (Zwiebel, Knoblauch) 3–4 Min glasig dünsten, dann Hauptzutaten nach Rezept anbraten oder mitgeben, Hitze anpassen.",
    "Flüssigkeit (Tomaten, Sahne, Brühe) zugeben, einmal aufkochen, Hitze auf Stufe 3–4 reduzieren, 8–15 Min köcheln bis die Konsistenz an der Soßenkelle haftet.",
    "Mit Salz, Pfeffer und ggf. Chili, Zitrone oder Käse abschmecken; Soße warm halten (Deckel, niedrige Stufe).",
    "2–3 Min vor Ende der Nudelgarzeit eine Schöpfkelle Nudelwasser aufheben — enthält Stärke zum Binden der Soße.",
    "Nudeln im Sieb abgießen, nicht abschrecken, sofort in die Pfanne zur Soße geben, mit etwas Nudelwasser unter Rühren emulgieren.",
    "1–2 Min auf Stufe 4 mitrühren, bis die Soße glänzend an den Nudeln haftet; Portionen mit Kelle auf tiefe Teller geben.",
    "Optional frisch geriebenen Käse, Kräuter oder Olivenöl darüber; sofort heiß servieren."
  ]
}$g$::jsonb,
  1931,
  NULL,
  'Nudelgericht'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'One-Pot Pasta Tomate-Mozzarella');

-- Penne Pesto und Cherrytomaten
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Penne Pesto und Cherrytomaten',
  4,
  $g${
  "titel": "Penne Pesto und Cherrytomaten",
  "portionen": 4,
  "kategorie": "Nudelgericht",
  "geschaetzte_kcal_gesamt": 1829,
  "zutaten": [
    {
      "name": "Penne",
      "menge": 400,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Knoblauchzehen",
      "menge": 2,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Olivenöl",
      "menge": 3,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Parmesan",
      "menge": 50,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Basilikum-Pesto",
      "menge": 120,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Pinienkerne",
      "menge": 30,
      "einheit": "g",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Arbeitsfläche freiräumen: großer Topf (mind. 5 l), hohe Pfanne oder Sauteuse, Schöpfkelle, Sieb, Küchenuhr und großes Schneidebrett bereitstellen.",
    "Großen Topf mit reichlich kaltem Wasser füllen (ca. 1 l pro 100 g Penne), Deckel aufsetzen, auf Herdstufe 9 von 9 zum kräftigen Kochen bringen.",
    "Während das Wasser heizt: Penne, Zwiebeln, Knoblauchzehen, Olivenöl vorbereiten — Gemüse schneiden, Kräuter waschen, Käse reiben, alles in Schüsseln getrennt bereitstellen.",
    "Wasser kräftig salzen (ca. 1 EL Salz pro Liter), Penne einrühren, Uhr stellen: Packungsangabe minus 1 Min als Richtwert für al dente.",
    "Für Soße passend zum Gericht: Pfanne auf Herdstufe 6–7 von 9 vorwärmen, Öl oder Butter erhitzen bis leicht glänzend, nicht rauchen lassen.",
    "Aromaten (Zwiebel, Knoblauch) 3–4 Min glasig dünsten, dann Hauptzutaten nach Rezept anbraten oder mitgeben, Hitze anpassen.",
    "Flüssigkeit (Tomaten, Sahne, Brühe) zugeben, einmal aufkochen, Hitze auf Stufe 3–4 reduzieren, 8–15 Min köcheln bis die Konsistenz an der Soßenkelle haftet.",
    "Mit Salz, Pfeffer und ggf. Chili, Zitrone oder Käse abschmecken; Soße warm halten (Deckel, niedrige Stufe).",
    "2–3 Min vor Ende der Nudelgarzeit eine Schöpfkelle Nudelwasser aufheben — enthält Stärke zum Binden der Soße.",
    "Penne im Sieb abgießen, nicht abschrecken, sofort in die Pfanne zur Soße geben, mit etwas Nudelwasser unter Rühren emulgieren.",
    "1–2 Min auf Stufe 4 mitrühren, bis die Soße glänzend an den Nudeln haftet; Portionen mit Kelle auf tiefe Teller geben.",
    "Optional frisch geriebenen Käse, Kräuter oder Olivenöl darüber; sofort heiß servieren."
  ]
}$g$::jsonb,
  1829,
  NULL,
  'Nudelgericht'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Penne Pesto und Cherrytomaten');

-- Spaghetti Cacio e Pepe
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Spaghetti Cacio e Pepe',
  4,
  $g${
  "titel": "Spaghetti Cacio e Pepe",
  "portionen": 4,
  "kategorie": "Nudelgericht",
  "geschaetzte_kcal_gesamt": 1807,
  "zutaten": [
    {
      "name": "Spaghetti",
      "menge": 400,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Knoblauchzehen",
      "menge": 2,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Olivenöl",
      "menge": 3,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Parmesan",
      "menge": 50,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "passierte Tomaten",
      "menge": 400,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Basilikum",
      "menge": 10,
      "einheit": "g",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Arbeitsfläche freiräumen: großer Topf (mind. 5 l), hohe Pfanne oder Sauteuse, Schöpfkelle, Sieb, Küchenuhr und großes Schneidebrett bereitstellen.",
    "Großen Topf mit reichlich kaltem Wasser füllen (ca. 1 l pro 100 g Spaghetti), Deckel aufsetzen, auf Herdstufe 9 von 9 zum kräftigen Kochen bringen.",
    "Während das Wasser heizt: Spaghetti, Zwiebeln, Knoblauchzehen, Olivenöl vorbereiten — Gemüse schneiden, Kräuter waschen, Käse reiben, alles in Schüsseln getrennt bereitstellen.",
    "Wasser kräftig salzen (ca. 1 EL Salz pro Liter), Spaghetti einrühren, Uhr stellen: Packungsangabe minus 1 Min als Richtwert für al dente.",
    "Für Soße passend zum Gericht: Pfanne auf Herdstufe 6–7 von 9 vorwärmen, Öl oder Butter erhitzen bis leicht glänzend, nicht rauchen lassen.",
    "Aromaten (Zwiebel, Knoblauch) 3–4 Min glasig dünsten, dann Hauptzutaten nach Rezept anbraten oder mitgeben, Hitze anpassen.",
    "Flüssigkeit (Tomaten, Sahne, Brühe) zugeben, einmal aufkochen, Hitze auf Stufe 3–4 reduzieren, 8–15 Min köcheln bis die Konsistenz an der Soßenkelle haftet.",
    "Mit Salz, Pfeffer und ggf. Chili, Zitrone oder Käse abschmecken; Soße warm halten (Deckel, niedrige Stufe).",
    "2–3 Min vor Ende der Nudelgarzeit eine Schöpfkelle Nudelwasser aufheben — enthält Stärke zum Binden der Soße.",
    "Spaghetti im Sieb abgießen, nicht abschrecken, sofort in die Pfanne zur Soße geben, mit etwas Nudelwasser unter Rühren emulgieren.",
    "1–2 Min auf Stufe 4 mitrühren, bis die Soße glänzend an den Nudeln haftet; Portionen mit Kelle auf tiefe Teller geben.",
    "Optional frisch geriebenen Käse, Kräuter oder Olivenöl darüber; sofort heiß servieren."
  ]
}$g$::jsonb,
  1807,
  NULL,
  'Nudelgericht'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Spaghetti Cacio e Pepe');

-- Gnocchi in Butter-Salbei
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Gnocchi in Butter-Salbei',
  4,
  $g${
  "titel": "Gnocchi in Butter-Salbei",
  "portionen": 4,
  "kategorie": "Nudelgericht",
  "geschaetzte_kcal_gesamt": 2045,
  "zutaten": [
    {
      "name": "Gnocchi",
      "menge": 400,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Knoblauchzehen",
      "menge": 2,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Olivenöl",
      "menge": 3,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Parmesan",
      "menge": 50,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "passierte Tomaten",
      "menge": 400,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Basilikum",
      "menge": 10,
      "einheit": "g",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Arbeitsfläche freiräumen: großer Topf (mind. 5 l), hohe Pfanne oder Sauteuse, Schöpfkelle, Sieb, Küchenuhr und großes Schneidebrett bereitstellen.",
    "Großen Topf mit reichlich kaltem Wasser füllen (ca. 1 l pro 100 g Nudeln), Deckel aufsetzen, auf Herdstufe 9 von 9 zum kräftigen Kochen bringen.",
    "Während das Wasser heizt: Gnocchi, Zwiebeln, Knoblauchzehen, Olivenöl vorbereiten — Gemüse schneiden, Kräuter waschen, Käse reiben, alles in Schüsseln getrennt bereitstellen.",
    "Wasser kräftig salzen (ca. 1 EL Salz pro Liter), Nudeln einrühren, Uhr stellen: Packungsangabe minus 1 Min als Richtwert für al dente.",
    "Für Soße passend zum Gericht: Pfanne auf Herdstufe 6–7 von 9 vorwärmen, Öl oder Butter erhitzen bis leicht glänzend, nicht rauchen lassen.",
    "Aromaten (Zwiebel, Knoblauch) 3–4 Min glasig dünsten, dann Hauptzutaten nach Rezept anbraten oder mitgeben, Hitze anpassen.",
    "Flüssigkeit (Tomaten, Sahne, Brühe) zugeben, einmal aufkochen, Hitze auf Stufe 3–4 reduzieren, 8–15 Min köcheln bis die Konsistenz an der Soßenkelle haftet.",
    "Mit Salz, Pfeffer und ggf. Chili, Zitrone oder Käse abschmecken; Soße warm halten (Deckel, niedrige Stufe).",
    "2–3 Min vor Ende der Nudelgarzeit eine Schöpfkelle Nudelwasser aufheben — enthält Stärke zum Binden der Soße.",
    "Nudeln im Sieb abgießen, nicht abschrecken, sofort in die Pfanne zur Soße geben, mit etwas Nudelwasser unter Rühren emulgieren.",
    "1–2 Min auf Stufe 4 mitrühren, bis die Soße glänzend an den Nudeln haftet; Portionen mit Kelle auf tiefe Teller geben.",
    "Optional frisch geriebenen Käse, Kräuter oder Olivenöl darüber; sofort heiß servieren."
  ]
}$g$::jsonb,
  2045,
  NULL,
  'Nudelgericht'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Gnocchi in Butter-Salbei');

-- Pasta mit Artischocken
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Pasta mit Artischocken',
  4,
  $g${
  "titel": "Pasta mit Artischocken",
  "portionen": 4,
  "kategorie": "Nudelgericht",
  "geschaetzte_kcal_gesamt": 1945,
  "zutaten": [
    {
      "name": "Pasta",
      "menge": 400,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Knoblauchzehen",
      "menge": 2,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Olivenöl",
      "menge": 3,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Parmesan",
      "menge": 50,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "passierte Tomaten",
      "menge": 400,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Basilikum",
      "menge": 10,
      "einheit": "g",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Arbeitsfläche freiräumen: großer Topf (mind. 5 l), hohe Pfanne oder Sauteuse, Schöpfkelle, Sieb, Küchenuhr und großes Schneidebrett bereitstellen.",
    "Großen Topf mit reichlich kaltem Wasser füllen (ca. 1 l pro 100 g Nudeln), Deckel aufsetzen, auf Herdstufe 9 von 9 zum kräftigen Kochen bringen.",
    "Während das Wasser heizt: Pasta, Zwiebeln, Knoblauchzehen, Olivenöl vorbereiten — Gemüse schneiden, Kräuter waschen, Käse reiben, alles in Schüsseln getrennt bereitstellen.",
    "Wasser kräftig salzen (ca. 1 EL Salz pro Liter), Nudeln einrühren, Uhr stellen: Packungsangabe minus 1 Min als Richtwert für al dente.",
    "Für Soße passend zum Gericht: Pfanne auf Herdstufe 6–7 von 9 vorwärmen, Öl oder Butter erhitzen bis leicht glänzend, nicht rauchen lassen.",
    "Aromaten (Zwiebel, Knoblauch) 3–4 Min glasig dünsten, dann Hauptzutaten nach Rezept anbraten oder mitgeben, Hitze anpassen.",
    "Flüssigkeit (Tomaten, Sahne, Brühe) zugeben, einmal aufkochen, Hitze auf Stufe 3–4 reduzieren, 8–15 Min köcheln bis die Konsistenz an der Soßenkelle haftet.",
    "Mit Salz, Pfeffer und ggf. Chili, Zitrone oder Käse abschmecken; Soße warm halten (Deckel, niedrige Stufe).",
    "2–3 Min vor Ende der Nudelgarzeit eine Schöpfkelle Nudelwasser aufheben — enthält Stärke zum Binden der Soße.",
    "Nudeln im Sieb abgießen, nicht abschrecken, sofort in die Pfanne zur Soße geben, mit etwas Nudelwasser unter Rühren emulgieren.",
    "1–2 Min auf Stufe 4 mitrühren, bis die Soße glänzend an den Nudeln haftet; Portionen mit Kelle auf tiefe Teller geben.",
    "Optional frisch geriebenen Käse, Kräuter oder Olivenöl darüber; sofort heiß servieren."
  ]
}$g$::jsonb,
  1945,
  NULL,
  'Nudelgericht'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Pasta mit Artischocken');

-- Mediterraner Nudelsalat
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Mediterraner Nudelsalat',
  4,
  $g${
  "titel": "Mediterraner Nudelsalat",
  "portionen": 4,
  "kategorie": "Nudelgericht",
  "geschaetzte_kcal_gesamt": 2119,
  "zutaten": [
    {
      "name": "Pasta",
      "menge": 400,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Knoblauchzehen",
      "menge": 2,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Olivenöl",
      "menge": 3,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Parmesan",
      "menge": 50,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "passierte Tomaten",
      "menge": 400,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Basilikum",
      "menge": 10,
      "einheit": "g",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Arbeitsfläche freiräumen: großer Topf (mind. 5 l), hohe Pfanne oder Sauteuse, Schöpfkelle, Sieb, Küchenuhr und großes Schneidebrett bereitstellen.",
    "Großen Topf mit reichlich kaltem Wasser füllen (ca. 1 l pro 100 g Nudeln), Deckel aufsetzen, auf Herdstufe 9 von 9 zum kräftigen Kochen bringen.",
    "Während das Wasser heizt: Pasta, Zwiebeln, Knoblauchzehen, Olivenöl vorbereiten — Gemüse schneiden, Kräuter waschen, Käse reiben, alles in Schüsseln getrennt bereitstellen.",
    "Wasser kräftig salzen (ca. 1 EL Salz pro Liter), Nudeln einrühren, Uhr stellen: Packungsangabe minus 1 Min als Richtwert für al dente.",
    "Für Soße passend zum Gericht: Pfanne auf Herdstufe 6–7 von 9 vorwärmen, Öl oder Butter erhitzen bis leicht glänzend, nicht rauchen lassen.",
    "Aromaten (Zwiebel, Knoblauch) 3–4 Min glasig dünsten, dann Hauptzutaten nach Rezept anbraten oder mitgeben, Hitze anpassen.",
    "Flüssigkeit (Tomaten, Sahne, Brühe) zugeben, einmal aufkochen, Hitze auf Stufe 3–4 reduzieren, 8–15 Min köcheln bis die Konsistenz an der Soßenkelle haftet.",
    "Mit Salz, Pfeffer und ggf. Chili, Zitrone oder Käse abschmecken; Soße warm halten (Deckel, niedrige Stufe).",
    "2–3 Min vor Ende der Nudelgarzeit eine Schöpfkelle Nudelwasser aufheben — enthält Stärke zum Binden der Soße.",
    "Nudeln im Sieb abgießen, nicht abschrecken, sofort in die Pfanne zur Soße geben, mit etwas Nudelwasser unter Rühren emulgieren.",
    "1–2 Min auf Stufe 4 mitrühren, bis die Soße glänzend an den Nudeln haftet; Portionen mit Kelle auf tiefe Teller geben.",
    "Optional frisch geriebenen Käse, Kräuter oder Olivenöl darüber; sofort heiß servieren."
  ]
}$g$::jsonb,
  2119,
  NULL,
  'Nudelgericht'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Mediterraner Nudelsalat');

-- Spätzle mit Rosenkohl
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Spätzle mit Rosenkohl',
  4,
  $g${
  "titel": "Spätzle mit Rosenkohl",
  "portionen": 4,
  "kategorie": "Nudelgericht",
  "geschaetzte_kcal_gesamt": 2013,
  "zutaten": [
    {
      "name": "Pasta",
      "menge": 400,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Knoblauchzehen",
      "menge": 2,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Olivenöl",
      "menge": 3,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Parmesan",
      "menge": 50,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "passierte Tomaten",
      "menge": 400,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Basilikum",
      "menge": 10,
      "einheit": "g",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Arbeitsfläche freiräumen: großer Topf (mind. 5 l), hohe Pfanne oder Sauteuse, Schöpfkelle, Sieb, Küchenuhr und großes Schneidebrett bereitstellen.",
    "Großen Topf mit reichlich kaltem Wasser füllen (ca. 1 l pro 100 g Nudeln), Deckel aufsetzen, auf Herdstufe 9 von 9 zum kräftigen Kochen bringen.",
    "Während das Wasser heizt: Pasta, Zwiebeln, Knoblauchzehen, Olivenöl vorbereiten — Gemüse schneiden, Kräuter waschen, Käse reiben, alles in Schüsseln getrennt bereitstellen.",
    "Wasser kräftig salzen (ca. 1 EL Salz pro Liter), Nudeln einrühren, Uhr stellen: Packungsangabe minus 1 Min als Richtwert für al dente.",
    "Für Soße passend zum Gericht: Pfanne auf Herdstufe 6–7 von 9 vorwärmen, Öl oder Butter erhitzen bis leicht glänzend, nicht rauchen lassen.",
    "Aromaten (Zwiebel, Knoblauch) 3–4 Min glasig dünsten, dann Hauptzutaten nach Rezept anbraten oder mitgeben, Hitze anpassen.",
    "Flüssigkeit (Tomaten, Sahne, Brühe) zugeben, einmal aufkochen, Hitze auf Stufe 3–4 reduzieren, 8–15 Min köcheln bis die Konsistenz an der Soßenkelle haftet.",
    "Mit Salz, Pfeffer und ggf. Chili, Zitrone oder Käse abschmecken; Soße warm halten (Deckel, niedrige Stufe).",
    "2–3 Min vor Ende der Nudelgarzeit eine Schöpfkelle Nudelwasser aufheben — enthält Stärke zum Binden der Soße.",
    "Nudeln im Sieb abgießen, nicht abschrecken, sofort in die Pfanne zur Soße geben, mit etwas Nudelwasser unter Rühren emulgieren.",
    "1–2 Min auf Stufe 4 mitrühren, bis die Soße glänzend an den Nudeln haftet; Portionen mit Kelle auf tiefe Teller geben.",
    "Optional frisch geriebenen Käse, Kräuter oder Olivenöl darüber; sofort heiß servieren."
  ]
}$g$::jsonb,
  2013,
  NULL,
  'Nudelgericht'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Spätzle mit Rosenkohl');

-- Ravioli in Brunnenkresse-Soße
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Ravioli in Brunnenkresse-Soße',
  4,
  $g${
  "titel": "Ravioli in Brunnenkresse-Soße",
  "portionen": 4,
  "kategorie": "Nudelgericht",
  "geschaetzte_kcal_gesamt": 1949,
  "zutaten": [
    {
      "name": "Ravioli",
      "menge": 400,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Knoblauchzehen",
      "menge": 2,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Olivenöl",
      "menge": 3,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Parmesan",
      "menge": 50,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "passierte Tomaten",
      "menge": 400,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Basilikum",
      "menge": 10,
      "einheit": "g",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Arbeitsfläche freiräumen: großer Topf (mind. 5 l), hohe Pfanne oder Sauteuse, Schöpfkelle, Sieb, Küchenuhr und großes Schneidebrett bereitstellen.",
    "Großen Topf mit reichlich kaltem Wasser füllen (ca. 1 l pro 100 g Nudeln), Deckel aufsetzen, auf Herdstufe 9 von 9 zum kräftigen Kochen bringen.",
    "Während das Wasser heizt: Ravioli, Zwiebeln, Knoblauchzehen, Olivenöl vorbereiten — Gemüse schneiden, Kräuter waschen, Käse reiben, alles in Schüsseln getrennt bereitstellen.",
    "Wasser kräftig salzen (ca. 1 EL Salz pro Liter), Nudeln einrühren, Uhr stellen: Packungsangabe minus 1 Min als Richtwert für al dente.",
    "Für Soße passend zum Gericht: Pfanne auf Herdstufe 6–7 von 9 vorwärmen, Öl oder Butter erhitzen bis leicht glänzend, nicht rauchen lassen.",
    "Aromaten (Zwiebel, Knoblauch) 3–4 Min glasig dünsten, dann Hauptzutaten nach Rezept anbraten oder mitgeben, Hitze anpassen.",
    "Flüssigkeit (Tomaten, Sahne, Brühe) zugeben, einmal aufkochen, Hitze auf Stufe 3–4 reduzieren, 8–15 Min köcheln bis die Konsistenz an der Soßenkelle haftet.",
    "Mit Salz, Pfeffer und ggf. Chili, Zitrone oder Käse abschmecken; Soße warm halten (Deckel, niedrige Stufe).",
    "2–3 Min vor Ende der Nudelgarzeit eine Schöpfkelle Nudelwasser aufheben — enthält Stärke zum Binden der Soße.",
    "Nudeln im Sieb abgießen, nicht abschrecken, sofort in die Pfanne zur Soße geben, mit etwas Nudelwasser unter Rühren emulgieren.",
    "1–2 Min auf Stufe 4 mitrühren, bis die Soße glänzend an den Nudeln haftet; Portionen mit Kelle auf tiefe Teller geben.",
    "Optional frisch geriebenen Käse, Kräuter oder Olivenöl darüber; sofort heiß servieren."
  ]
}$g$::jsonb,
  1949,
  NULL,
  'Nudelgericht'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Ravioli in Brunnenkresse-Soße');

-- Pasta mit Sardellen
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Pasta mit Sardellen',
  4,
  $g${
  "titel": "Pasta mit Sardellen",
  "portionen": 4,
  "kategorie": "Nudelgericht",
  "geschaetzte_kcal_gesamt": 2021,
  "zutaten": [
    {
      "name": "Pasta",
      "menge": 400,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Knoblauchzehen",
      "menge": 2,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Olivenöl",
      "menge": 3,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Parmesan",
      "menge": 50,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "passierte Tomaten",
      "menge": 400,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Basilikum",
      "menge": 10,
      "einheit": "g",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Arbeitsfläche freiräumen: großer Topf (mind. 5 l), hohe Pfanne oder Sauteuse, Schöpfkelle, Sieb, Küchenuhr und großes Schneidebrett bereitstellen.",
    "Großen Topf mit reichlich kaltem Wasser füllen (ca. 1 l pro 100 g Nudeln), Deckel aufsetzen, auf Herdstufe 9 von 9 zum kräftigen Kochen bringen.",
    "Während das Wasser heizt: Pasta, Zwiebeln, Knoblauchzehen, Olivenöl vorbereiten — Gemüse schneiden, Kräuter waschen, Käse reiben, alles in Schüsseln getrennt bereitstellen.",
    "Wasser kräftig salzen (ca. 1 EL Salz pro Liter), Nudeln einrühren, Uhr stellen: Packungsangabe minus 1 Min als Richtwert für al dente.",
    "Für Soße passend zum Gericht: Pfanne auf Herdstufe 6–7 von 9 vorwärmen, Öl oder Butter erhitzen bis leicht glänzend, nicht rauchen lassen.",
    "Aromaten (Zwiebel, Knoblauch) 3–4 Min glasig dünsten, dann Hauptzutaten nach Rezept anbraten oder mitgeben, Hitze anpassen.",
    "Flüssigkeit (Tomaten, Sahne, Brühe) zugeben, einmal aufkochen, Hitze auf Stufe 3–4 reduzieren, 8–15 Min köcheln bis die Konsistenz an der Soßenkelle haftet.",
    "Mit Salz, Pfeffer und ggf. Chili, Zitrone oder Käse abschmecken; Soße warm halten (Deckel, niedrige Stufe).",
    "2–3 Min vor Ende der Nudelgarzeit eine Schöpfkelle Nudelwasser aufheben — enthält Stärke zum Binden der Soße.",
    "Nudeln im Sieb abgießen, nicht abschrecken, sofort in die Pfanne zur Soße geben, mit etwas Nudelwasser unter Rühren emulgieren.",
    "1–2 Min auf Stufe 4 mitrühren, bis die Soße glänzend an den Nudeln haftet; Portionen mit Kelle auf tiefe Teller geben.",
    "Optional frisch geriebenen Käse, Kräuter oder Olivenöl darüber; sofort heiß servieren."
  ]
}$g$::jsonb,
  2021,
  NULL,
  'Nudelgericht'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Pasta mit Sardellen');

-- Tortellini in Brühe
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Tortellini in Brühe',
  4,
  $g${
  "titel": "Tortellini in Brühe",
  "portionen": 4,
  "kategorie": "Nudelgericht",
  "geschaetzte_kcal_gesamt": 2178,
  "zutaten": [
    {
      "name": "Tortellini",
      "menge": 400,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Knoblauchzehen",
      "menge": 2,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Olivenöl",
      "menge": 3,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Parmesan",
      "menge": 50,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "passierte Tomaten",
      "menge": 400,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Basilikum",
      "menge": 10,
      "einheit": "g",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Arbeitsfläche freiräumen: großer Topf (mind. 5 l), hohe Pfanne oder Sauteuse, Schöpfkelle, Sieb, Küchenuhr und großes Schneidebrett bereitstellen.",
    "Großen Topf mit reichlich kaltem Wasser füllen (ca. 1 l pro 100 g Nudeln), Deckel aufsetzen, auf Herdstufe 9 von 9 zum kräftigen Kochen bringen.",
    "Während das Wasser heizt: Tortellini, Zwiebeln, Knoblauchzehen, Olivenöl vorbereiten — Gemüse schneiden, Kräuter waschen, Käse reiben, alles in Schüsseln getrennt bereitstellen.",
    "Wasser kräftig salzen (ca. 1 EL Salz pro Liter), Nudeln einrühren, Uhr stellen: Packungsangabe minus 1 Min als Richtwert für al dente.",
    "Für Soße passend zum Gericht: Pfanne auf Herdstufe 6–7 von 9 vorwärmen, Öl oder Butter erhitzen bis leicht glänzend, nicht rauchen lassen.",
    "Aromaten (Zwiebel, Knoblauch) 3–4 Min glasig dünsten, dann Hauptzutaten nach Rezept anbraten oder mitgeben, Hitze anpassen.",
    "Flüssigkeit (Tomaten, Sahne, Brühe) zugeben, einmal aufkochen, Hitze auf Stufe 3–4 reduzieren, 8–15 Min köcheln bis die Konsistenz an der Soßenkelle haftet.",
    "Mit Salz, Pfeffer und ggf. Chili, Zitrone oder Käse abschmecken; Soße warm halten (Deckel, niedrige Stufe).",
    "2–3 Min vor Ende der Nudelgarzeit eine Schöpfkelle Nudelwasser aufheben — enthält Stärke zum Binden der Soße.",
    "Nudeln im Sieb abgießen, nicht abschrecken, sofort in die Pfanne zur Soße geben, mit etwas Nudelwasser unter Rühren emulgieren.",
    "1–2 Min auf Stufe 4 mitrühren, bis die Soße glänzend an den Nudeln haftet; Portionen mit Kelle auf tiefe Teller geben.",
    "Optional frisch geriebenen Käse, Kräuter oder Olivenöl darüber; sofort heiß servieren."
  ]
}$g$::jsonb,
  2178,
  NULL,
  'Nudelgericht'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Tortellini in Brühe');

-- Lasagne vegetarisch mit Spinat
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Lasagne vegetarisch mit Spinat',
  4,
  $g${
  "titel": "Lasagne vegetarisch mit Spinat",
  "portionen": 4,
  "kategorie": "Nudelgericht",
  "geschaetzte_kcal_gesamt": 1921,
  "zutaten": [
    {
      "name": "Pasta",
      "menge": 400,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Knoblauchzehen",
      "menge": 2,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Olivenöl",
      "menge": 3,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Parmesan",
      "menge": 50,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "passierte Tomaten",
      "menge": 400,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Basilikum",
      "menge": 10,
      "einheit": "g",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Arbeitsfläche freiräumen: großer Topf (mind. 5 l), hohe Pfanne oder Sauteuse, Schöpfkelle, Sieb, Küchenuhr und großes Schneidebrett bereitstellen.",
    "Großen Topf mit reichlich kaltem Wasser füllen (ca. 1 l pro 100 g Nudeln), Deckel aufsetzen, auf Herdstufe 9 von 9 zum kräftigen Kochen bringen.",
    "Während das Wasser heizt: Pasta, Zwiebeln, Knoblauchzehen, Olivenöl vorbereiten — Gemüse schneiden, Kräuter waschen, Käse reiben, alles in Schüsseln getrennt bereitstellen.",
    "Wasser kräftig salzen (ca. 1 EL Salz pro Liter), Nudeln einrühren, Uhr stellen: Packungsangabe minus 1 Min als Richtwert für al dente.",
    "Für Soße passend zum Gericht: Pfanne auf Herdstufe 6–7 von 9 vorwärmen, Öl oder Butter erhitzen bis leicht glänzend, nicht rauchen lassen.",
    "Aromaten (Zwiebel, Knoblauch) 3–4 Min glasig dünsten, dann Hauptzutaten nach Rezept anbraten oder mitgeben, Hitze anpassen.",
    "Flüssigkeit (Tomaten, Sahne, Brühe) zugeben, einmal aufkochen, Hitze auf Stufe 3–4 reduzieren, 8–15 Min köcheln bis die Konsistenz an der Soßenkelle haftet.",
    "Mit Salz, Pfeffer und ggf. Chili, Zitrone oder Käse abschmecken; Soße warm halten (Deckel, niedrige Stufe).",
    "2–3 Min vor Ende der Nudelgarzeit eine Schöpfkelle Nudelwasser aufheben — enthält Stärke zum Binden der Soße.",
    "Nudeln im Sieb abgießen, nicht abschrecken, sofort in die Pfanne zur Soße geben, mit etwas Nudelwasser unter Rühren emulgieren.",
    "1–2 Min auf Stufe 4 mitrühren, bis die Soße glänzend an den Nudeln haftet; Portionen mit Kelle auf tiefe Teller geben.",
    "Optional frisch geriebenen Käse, Kräuter oder Olivenöl darüber; sofort heiß servieren."
  ]
}$g$::jsonb,
  1921,
  NULL,
  'Nudelgericht'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Lasagne vegetarisch mit Spinat');

-- Spaghetti mit Garnelen
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Spaghetti mit Garnelen',
  4,
  $g${
  "titel": "Spaghetti mit Garnelen",
  "portionen": 4,
  "kategorie": "Nudelgericht",
  "geschaetzte_kcal_gesamt": 1943,
  "zutaten": [
    {
      "name": "Spaghetti",
      "menge": 400,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Knoblauchzehen",
      "menge": 2,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Olivenöl",
      "menge": 3,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Parmesan",
      "menge": 50,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Meeresfrüchte-Mix",
      "menge": 400,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Weißwein",
      "menge": 100,
      "einheit": "ml",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Arbeitsfläche freiräumen: großer Topf (mind. 5 l), hohe Pfanne oder Sauteuse, Schöpfkelle, Sieb, Küchenuhr und großes Schneidebrett bereitstellen.",
    "Großen Topf mit reichlich kaltem Wasser füllen (ca. 1 l pro 100 g Spaghetti), Deckel aufsetzen, auf Herdstufe 9 von 9 zum kräftigen Kochen bringen.",
    "Während das Wasser heizt: Spaghetti, Zwiebeln, Knoblauchzehen, Olivenöl vorbereiten — Gemüse schneiden, Kräuter waschen, Käse reiben, alles in Schüsseln getrennt bereitstellen.",
    "Wasser kräftig salzen (ca. 1 EL Salz pro Liter), Spaghetti einrühren, Uhr stellen: Packungsangabe minus 1 Min als Richtwert für al dente.",
    "Für Soße passend zum Gericht: Pfanne auf Herdstufe 6–7 von 9 vorwärmen, Öl oder Butter erhitzen bis leicht glänzend, nicht rauchen lassen.",
    "Aromaten (Zwiebel, Knoblauch) 3–4 Min glasig dünsten, dann Hauptzutaten nach Rezept anbraten oder mitgeben, Hitze anpassen.",
    "Flüssigkeit (Tomaten, Sahne, Brühe) zugeben, einmal aufkochen, Hitze auf Stufe 3–4 reduzieren, 8–15 Min köcheln bis die Konsistenz an der Soßenkelle haftet.",
    "Mit Salz, Pfeffer und ggf. Chili, Zitrone oder Käse abschmecken; Soße warm halten (Deckel, niedrige Stufe).",
    "2–3 Min vor Ende der Nudelgarzeit eine Schöpfkelle Nudelwasser aufheben — enthält Stärke zum Binden der Soße.",
    "Spaghetti im Sieb abgießen, nicht abschrecken, sofort in die Pfanne zur Soße geben, mit etwas Nudelwasser unter Rühren emulgieren.",
    "1–2 Min auf Stufe 4 mitrühren, bis die Soße glänzend an den Nudeln haftet; Portionen mit Kelle auf tiefe Teller geben.",
    "Optional frisch geriebenen Käse, Kräuter oder Olivenöl darüber; sofort heiß servieren."
  ]
}$g$::jsonb,
  1943,
  NULL,
  'Nudelgericht'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Spaghetti mit Garnelen');

-- Schweinebraten mit Kruste
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Schweinebraten mit Kruste',
  4,
  $g${
  "titel": "Schweinebraten mit Kruste",
  "portionen": 4,
  "kategorie": "Fleischgericht",
  "geschaetzte_kcal_gesamt": 2290,
  "zutaten": [
    {
      "name": "Schweinefleisch",
      "menge": 800,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 2,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Knoblauchzehen",
      "menge": 2,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Gemüsebrühe",
      "menge": 400,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Tomatenmark",
      "menge": 1,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Butter",
      "menge": 40,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Rosmarin",
      "menge": 2,
      "einheit": "Zweige",
      "aus_lager": false
    },
    {
      "name": "Pfeffer",
      "menge": 1,
      "einheit": "Prise",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Bratofen oder schweren Topf auf Stufe 7 vorheizen; Fleisch 30 Min vorher aus dem Kühlschrank nehmen, trocken tupfen.",
    "Rundum mit Salz und Pfeffer einreiben, optional mit Mehl dünn bestäuben für Kruste.",
    "2 EL Öl im Topf erhitzen, Fleisch von allen Seiten 2–3 Min scharf anbraten (Maillard-Reaktion).",
    "Zwiebeln, Möhren, Brühe und Gewürze zugeben, Flüssigkeit soll 1/3 des Fleisches bedecken.",
    "Deckel auf, Ofen 160 °C oder Herd Stufe 3–4: Garzeit laut Gewicht (ca. 40 Min pro kg Rind).",
    "Thermometer in die dickste Stelle: gewünschter Kerntemperatur minus 3 °C (Nachgaren).",
    "Fleisch herausnehmen, Bratensoße durch Sieb passieren, mit Mehl-Butter-Einlage binden.",
    "Fleisch 10 Min unter Folie ruhen, dann tranchieren, mit Soße und Beilage servieren."
  ]
}$g$::jsonb,
  2290,
  NULL,
  'Fleischgericht'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Schweinebraten mit Kruste');

-- Hähnchenschenkel im Ofen
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Hähnchenschenkel im Ofen',
  4,
  $g${
  "titel": "Hähnchenschenkel im Ofen",
  "portionen": 4,
  "kategorie": "Fleischgericht",
  "geschaetzte_kcal_gesamt": 2243,
  "zutaten": [
    {
      "name": "Hähnchen",
      "menge": 800,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 2,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Knoblauchzehen",
      "menge": 2,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Gemüsebrühe",
      "menge": 400,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Tomatenmark",
      "menge": 1,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Butter",
      "menge": 40,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Rosmarin",
      "menge": 2,
      "einheit": "Zweige",
      "aus_lager": false
    },
    {
      "name": "Pfeffer",
      "menge": 1,
      "einheit": "Prise",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Pfanne (28 cm) und Spatel bereitstellen; Zutaten in gleicher Größe schneiden, damit gleichzeitig gar sind.",
    "Pfanne 2 Min auf Herdstufe 7 von 9 leer vorwärmen, dann 2 EL Öl — es soll leicht schimmern.",
    "Fleisch oder Tofu zuerst bei hoher Hitze anbraten, nicht bewegen bis sich eine Kruste löst (2–3 Min), wenden.",
    "Gemüse zugeben, 4–6 Min mitbraten, Pfanne nicht überfüllen (sonst dämpft es).",
    "Sauce (Soja, Sahne, Brühe) einrühren, 2–3 Min einkochen lassen, bis die Soße am Spatel haftet.",
    "Mit Salz, Pfeffer, Kräutern abschmecken; Hitze reduzieren, 1 Min ziehen lassen.",
    "Sofort auf vorgewärmten Tellern servieren — Pfannengerichte verlieren schnell an Textur."
  ]
}$g$::jsonb,
  2243,
  NULL,
  'Fleischgericht'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Hähnchenschenkel im Ofen');

-- Rindersteak mit Pfeffersoße
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Rindersteak mit Pfeffersoße',
  4,
  $g${
  "titel": "Rindersteak mit Pfeffersoße",
  "portionen": 4,
  "kategorie": "Fleischgericht",
  "geschaetzte_kcal_gesamt": 2594,
  "zutaten": [
    {
      "name": "Rindfleisch",
      "menge": 800,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 2,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Knoblauchzehen",
      "menge": 2,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Gemüsebrühe",
      "menge": 400,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Tomatenmark",
      "menge": 1,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Butter",
      "menge": 40,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Rosmarin",
      "menge": 2,
      "einheit": "Zweige",
      "aus_lager": false
    },
    {
      "name": "Pfeffer",
      "menge": 1,
      "einheit": "Prise",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Bratofen oder schweren Topf auf Stufe 7 vorheizen; Fleisch 30 Min vorher aus dem Kühlschrank nehmen, trocken tupfen.",
    "Rundum mit Salz und Pfeffer einreiben, optional mit Mehl dünn bestäuben für Kruste.",
    "2 EL Öl im Topf erhitzen, Fleisch von allen Seiten 2–3 Min scharf anbraten (Maillard-Reaktion).",
    "Zwiebeln, Möhren, Brühe und Gewürze zugeben, Flüssigkeit soll 1/3 des Fleisches bedecken.",
    "Deckel auf, Ofen 160 °C oder Herd Stufe 3–4: Garzeit laut Gewicht (ca. 40 Min pro kg Rind).",
    "Thermometer in die dickste Stelle: gewünschter Kerntemperatur minus 3 °C (Nachgaren).",
    "Fleisch herausnehmen, Bratensoße durch Sieb passieren, mit Mehl-Butter-Einlage binden.",
    "Fleisch 10 Min unter Folie ruhen, dann tranchieren, mit Soße und Beilage servieren."
  ]
}$g$::jsonb,
  2594,
  NULL,
  'Fleischgericht'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Rindersteak mit Pfeffersoße');

-- Putenbraten mit Orangen
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Putenbraten mit Orangen',
  4,
  $g${
  "titel": "Putenbraten mit Orangen",
  "portionen": 4,
  "kategorie": "Fleischgericht",
  "geschaetzte_kcal_gesamt": 2468,
  "zutaten": [
    {
      "name": "Putenfleisch",
      "menge": 800,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 2,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Knoblauchzehen",
      "menge": 2,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Gemüsebrühe",
      "menge": 400,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Tomatenmark",
      "menge": 1,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Butter",
      "menge": 40,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Rosmarin",
      "menge": 2,
      "einheit": "Zweige",
      "aus_lager": false
    },
    {
      "name": "Pfeffer",
      "menge": 1,
      "einheit": "Prise",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Bratofen oder schweren Topf auf Stufe 7 vorheizen; Fleisch 30 Min vorher aus dem Kühlschrank nehmen, trocken tupfen.",
    "Rundum mit Salz und Pfeffer einreiben, optional mit Mehl dünn bestäuben für Kruste.",
    "2 EL Öl im Topf erhitzen, Fleisch von allen Seiten 2–3 Min scharf anbraten (Maillard-Reaktion).",
    "Zwiebeln, Möhren, Brühe und Gewürze zugeben, Flüssigkeit soll 1/3 des Fleisches bedecken.",
    "Deckel auf, Ofen 160 °C oder Herd Stufe 3–4: Garzeit laut Gewicht (ca. 40 Min pro kg Rind).",
    "Thermometer in die dickste Stelle: gewünschter Kerntemperatur minus 3 °C (Nachgaren).",
    "Fleisch herausnehmen, Bratensoße durch Sieb passieren, mit Mehl-Butter-Einlage binden.",
    "Fleisch 10 Min unter Folie ruhen, dann tranchieren, mit Soße und Beilage servieren."
  ]
}$g$::jsonb,
  2468,
  NULL,
  'Fleischgericht'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Putenbraten mit Orangen');

-- Schweinefilet Medaillons
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Schweinefilet Medaillons',
  4,
  $g${
  "titel": "Schweinefilet Medaillons",
  "portionen": 4,
  "kategorie": "Fleischgericht",
  "geschaetzte_kcal_gesamt": 2218,
  "zutaten": [
    {
      "name": "Schweinefleisch",
      "menge": 800,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 2,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Knoblauchzehen",
      "menge": 2,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Gemüsebrühe",
      "menge": 400,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Tomatenmark",
      "menge": 1,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Butter",
      "menge": 40,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Rosmarin",
      "menge": 2,
      "einheit": "Zweige",
      "aus_lager": false
    },
    {
      "name": "Pfeffer",
      "menge": 1,
      "einheit": "Prise",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Pfanne (28 cm) und Spatel bereitstellen; Zutaten in gleicher Größe schneiden, damit gleichzeitig gar sind.",
    "Pfanne 2 Min auf Herdstufe 7 von 9 leer vorwärmen, dann 2 EL Öl — es soll leicht schimmern.",
    "Fleisch oder Tofu zuerst bei hoher Hitze anbraten, nicht bewegen bis sich eine Kruste löst (2–3 Min), wenden.",
    "Gemüse zugeben, 4–6 Min mitbraten, Pfanne nicht überfüllen (sonst dämpft es).",
    "Sauce (Soja, Sahne, Brühe) einrühren, 2–3 Min einkochen lassen, bis die Soße am Spatel haftet.",
    "Mit Salz, Pfeffer, Kräutern abschmecken; Hitze reduzieren, 1 Min ziehen lassen.",
    "Sofort auf vorgewärmten Tellern servieren — Pfannengerichte verlieren schnell an Textur."
  ]
}$g$::jsonb,
  2218,
  NULL,
  'Fleischgericht'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Schweinefilet Medaillons');

-- Hackbraten klassisch
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Hackbraten klassisch',
  4,
  $g${
  "titel": "Hackbraten klassisch",
  "portionen": 4,
  "kategorie": "Fleischgericht",
  "geschaetzte_kcal_gesamt": 2208,
  "zutaten": [
    {
      "name": "Fleisch",
      "menge": 800,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 2,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Knoblauchzehen",
      "menge": 2,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Gemüsebrühe",
      "menge": 400,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Tomatenmark",
      "menge": 1,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Butter",
      "menge": 40,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Rosmarin",
      "menge": 2,
      "einheit": "Zweige",
      "aus_lager": false
    },
    {
      "name": "Pfeffer",
      "menge": 1,
      "einheit": "Prise",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Bratofen oder schweren Topf auf Stufe 7 vorheizen; Fleisch 30 Min vorher aus dem Kühlschrank nehmen, trocken tupfen.",
    "Rundum mit Salz und Pfeffer einreiben, optional mit Mehl dünn bestäuben für Kruste.",
    "2 EL Öl im Topf erhitzen, Fleisch von allen Seiten 2–3 Min scharf anbraten (Maillard-Reaktion).",
    "Zwiebeln, Möhren, Brühe und Gewürze zugeben, Flüssigkeit soll 1/3 des Fleisches bedecken.",
    "Deckel auf, Ofen 160 °C oder Herd Stufe 3–4: Garzeit laut Gewicht (ca. 40 Min pro kg Rind).",
    "Thermometer in die dickste Stelle: gewünschter Kerntemperatur minus 3 °C (Nachgaren).",
    "Fleisch herausnehmen, Bratensoße durch Sieb passieren, mit Mehl-Butter-Einlage binden.",
    "Fleisch 10 Min unter Folie ruhen, dann tranchieren, mit Soße und Beilage servieren."
  ]
}$g$::jsonb,
  2208,
  NULL,
  'Fleischgericht'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Hackbraten klassisch');

-- Geschnetzeltes Zürcher Art
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Geschnetzeltes Zürcher Art',
  4,
  $g${
  "titel": "Geschnetzeltes Zürcher Art",
  "portionen": 4,
  "kategorie": "Fleischgericht",
  "geschaetzte_kcal_gesamt": 2513,
  "zutaten": [
    {
      "name": "Fleisch",
      "menge": 800,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 2,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Knoblauchzehen",
      "menge": 2,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Gemüsebrühe",
      "menge": 400,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Tomatenmark",
      "menge": 1,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Butter",
      "menge": 40,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Rosmarin",
      "menge": 2,
      "einheit": "Zweige",
      "aus_lager": false
    },
    {
      "name": "Pfeffer",
      "menge": 1,
      "einheit": "Prise",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Pfanne (28 cm) und Spatel bereitstellen; Zutaten in gleicher Größe schneiden, damit gleichzeitig gar sind.",
    "Pfanne 2 Min auf Herdstufe 7 von 9 leer vorwärmen, dann 2 EL Öl — es soll leicht schimmern.",
    "Fleisch oder Tofu zuerst bei hoher Hitze anbraten, nicht bewegen bis sich eine Kruste löst (2–3 Min), wenden.",
    "Gemüse zugeben, 4–6 Min mitbraten, Pfanne nicht überfüllen (sonst dämpft es).",
    "Sauce (Soja, Sahne, Brühe) einrühren, 2–3 Min einkochen lassen, bis die Soße am Spatel haftet.",
    "Mit Salz, Pfeffer, Kräutern abschmecken; Hitze reduzieren, 1 Min ziehen lassen.",
    "Sofort auf vorgewärmten Tellern servieren — Pfannengerichte verlieren schnell an Textur."
  ]
}$g$::jsonb,
  2513,
  NULL,
  'Fleischgericht'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Geschnetzeltes Zürcher Art');

-- Sauerbraten rheinisch
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Sauerbraten rheinisch',
  4,
  $g${
  "titel": "Sauerbraten rheinisch",
  "portionen": 4,
  "kategorie": "Fleischgericht",
  "geschaetzte_kcal_gesamt": 2337,
  "zutaten": [
    {
      "name": "Fleisch",
      "menge": 800,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 2,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Knoblauchzehen",
      "menge": 2,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Gemüsebrühe",
      "menge": 400,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Tomatenmark",
      "menge": 1,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Butter",
      "menge": 40,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Rosmarin",
      "menge": 2,
      "einheit": "Zweige",
      "aus_lager": false
    },
    {
      "name": "Pfeffer",
      "menge": 1,
      "einheit": "Prise",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Bratofen oder schweren Topf auf Stufe 7 vorheizen; Fleisch 30 Min vorher aus dem Kühlschrank nehmen, trocken tupfen.",
    "Rundum mit Salz und Pfeffer einreiben, optional mit Mehl dünn bestäuben für Kruste.",
    "2 EL Öl im Topf erhitzen, Fleisch von allen Seiten 2–3 Min scharf anbraten (Maillard-Reaktion).",
    "Zwiebeln, Möhren, Brühe und Gewürze zugeben, Flüssigkeit soll 1/3 des Fleisches bedecken.",
    "Deckel auf, Ofen 160 °C oder Herd Stufe 3–4: Garzeit laut Gewicht (ca. 40 Min pro kg Rind).",
    "Thermometer in die dickste Stelle: gewünschter Kerntemperatur minus 3 °C (Nachgaren).",
    "Fleisch herausnehmen, Bratensoße durch Sieb passieren, mit Mehl-Butter-Einlage binden.",
    "Fleisch 10 Min unter Folie ruhen, dann tranchieren, mit Soße und Beilage servieren."
  ]
}$g$::jsonb,
  2337,
  NULL,
  'Fleischgericht'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Sauerbraten rheinisch');

-- Schweinshaxe aus dem Ofen
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Schweinshaxe aus dem Ofen',
  4,
  $g${
  "titel": "Schweinshaxe aus dem Ofen",
  "portionen": 4,
  "kategorie": "Fleischgericht",
  "geschaetzte_kcal_gesamt": 2585,
  "zutaten": [
    {
      "name": "Schweinefleisch",
      "menge": 800,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 2,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Knoblauchzehen",
      "menge": 2,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Gemüsebrühe",
      "menge": 400,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Tomatenmark",
      "menge": 1,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Butter",
      "menge": 40,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Rosmarin",
      "menge": 2,
      "einheit": "Zweige",
      "aus_lager": false
    },
    {
      "name": "Pfeffer",
      "menge": 1,
      "einheit": "Prise",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Bratofen oder schweren Topf auf Stufe 7 vorheizen; Fleisch 30 Min vorher aus dem Kühlschrank nehmen, trocken tupfen.",
    "Rundum mit Salz und Pfeffer einreiben, optional mit Mehl dünn bestäuben für Kruste.",
    "2 EL Öl im Topf erhitzen, Fleisch von allen Seiten 2–3 Min scharf anbraten (Maillard-Reaktion).",
    "Zwiebeln, Möhren, Brühe und Gewürze zugeben, Flüssigkeit soll 1/3 des Fleisches bedecken.",
    "Deckel auf, Ofen 160 °C oder Herd Stufe 3–4: Garzeit laut Gewicht (ca. 40 Min pro kg Rind).",
    "Thermometer in die dickste Stelle: gewünschter Kerntemperatur minus 3 °C (Nachgaren).",
    "Fleisch herausnehmen, Bratensoße durch Sieb passieren, mit Mehl-Butter-Einlage binden.",
    "Fleisch 10 Min unter Folie ruhen, dann tranchieren, mit Soße und Beilage servieren."
  ]
}$g$::jsonb,
  2585,
  NULL,
  'Fleischgericht'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Schweinshaxe aus dem Ofen');

-- Hähnchen-Cordon-Bleu
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Hähnchen-Cordon-Bleu',
  4,
  $g${
  "titel": "Hähnchen-Cordon-Bleu",
  "portionen": 4,
  "kategorie": "Fleischgericht",
  "geschaetzte_kcal_gesamt": 2223,
  "zutaten": [
    {
      "name": "Hähnchen",
      "menge": 800,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 2,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Knoblauchzehen",
      "menge": 2,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Gemüsebrühe",
      "menge": 400,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Tomatenmark",
      "menge": 1,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Butter",
      "menge": 40,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Rosmarin",
      "menge": 2,
      "einheit": "Zweige",
      "aus_lager": false
    },
    {
      "name": "Pfeffer",
      "menge": 1,
      "einheit": "Prise",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Bratofen oder schweren Topf auf Stufe 7 vorheizen; Fleisch 30 Min vorher aus dem Kühlschrank nehmen, trocken tupfen.",
    "Rundum mit Salz und Pfeffer einreiben, optional mit Mehl dünn bestäuben für Kruste.",
    "2 EL Öl im Topf erhitzen, Fleisch von allen Seiten 2–3 Min scharf anbraten (Maillard-Reaktion).",
    "Zwiebeln, Möhren, Brühe und Gewürze zugeben, Flüssigkeit soll 1/3 des Fleisches bedecken.",
    "Deckel auf, Ofen 160 °C oder Herd Stufe 3–4: Garzeit laut Gewicht (ca. 40 Min pro kg Rind).",
    "Thermometer in die dickste Stelle: gewünschter Kerntemperatur minus 3 °C (Nachgaren).",
    "Fleisch herausnehmen, Bratensoße durch Sieb passieren, mit Mehl-Butter-Einlage binden.",
    "Fleisch 10 Min unter Folie ruhen, dann tranchieren, mit Soße und Beilage servieren."
  ]
}$g$::jsonb,
  2223,
  NULL,
  'Fleischgericht'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Hähnchen-Cordon-Bleu');

-- Rindersteak mit Zwiebeln
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Rindersteak mit Zwiebeln',
  4,
  $g${
  "titel": "Rindersteak mit Zwiebeln",
  "portionen": 4,
  "kategorie": "Fleischgericht",
  "geschaetzte_kcal_gesamt": 2574,
  "zutaten": [
    {
      "name": "Rindfleisch",
      "menge": 800,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 2,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Knoblauchzehen",
      "menge": 2,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Gemüsebrühe",
      "menge": 400,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Tomatenmark",
      "menge": 1,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Butter",
      "menge": 40,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Rosmarin",
      "menge": 2,
      "einheit": "Zweige",
      "aus_lager": false
    },
    {
      "name": "Pfeffer",
      "menge": 1,
      "einheit": "Prise",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Bratofen oder schweren Topf auf Stufe 7 vorheizen; Fleisch 30 Min vorher aus dem Kühlschrank nehmen, trocken tupfen.",
    "Rundum mit Salz und Pfeffer einreiben, optional mit Mehl dünn bestäuben für Kruste.",
    "2 EL Öl im Topf erhitzen, Fleisch von allen Seiten 2–3 Min scharf anbraten (Maillard-Reaktion).",
    "Zwiebeln, Möhren, Brühe und Gewürze zugeben, Flüssigkeit soll 1/3 des Fleisches bedecken.",
    "Deckel auf, Ofen 160 °C oder Herd Stufe 3–4: Garzeit laut Gewicht (ca. 40 Min pro kg Rind).",
    "Thermometer in die dickste Stelle: gewünschter Kerntemperatur minus 3 °C (Nachgaren).",
    "Fleisch herausnehmen, Bratensoße durch Sieb passieren, mit Mehl-Butter-Einlage binden.",
    "Fleisch 10 Min unter Folie ruhen, dann tranchieren, mit Soße und Beilage servieren."
  ]
}$g$::jsonb,
  2574,
  NULL,
  'Fleischgericht'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Rindersteak mit Zwiebeln');

-- Puten-Geschnetzeltes
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Puten-Geschnetzeltes',
  4,
  $g${
  "titel": "Puten-Geschnetzeltes",
  "portionen": 4,
  "kategorie": "Fleischgericht",
  "geschaetzte_kcal_gesamt": 2249,
  "zutaten": [
    {
      "name": "Putenfleisch",
      "menge": 800,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 2,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Knoblauchzehen",
      "menge": 2,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Gemüsebrühe",
      "menge": 400,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Tomatenmark",
      "menge": 1,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Butter",
      "menge": 40,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Rosmarin",
      "menge": 2,
      "einheit": "Zweige",
      "aus_lager": false
    },
    {
      "name": "Pfeffer",
      "menge": 1,
      "einheit": "Prise",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Pfanne (28 cm) und Spatel bereitstellen; Zutaten in gleicher Größe schneiden, damit gleichzeitig gar sind.",
    "Pfanne 2 Min auf Herdstufe 7 von 9 leer vorwärmen, dann 2 EL Öl — es soll leicht schimmern.",
    "Fleisch oder Tofu zuerst bei hoher Hitze anbraten, nicht bewegen bis sich eine Kruste löst (2–3 Min), wenden.",
    "Gemüse zugeben, 4–6 Min mitbraten, Pfanne nicht überfüllen (sonst dämpft es).",
    "Sauce (Soja, Sahne, Brühe) einrühren, 2–3 Min einkochen lassen, bis die Soße am Spatel haftet.",
    "Mit Salz, Pfeffer, Kräutern abschmecken; Hitze reduzieren, 1 Min ziehen lassen.",
    "Sofort auf vorgewärmten Tellern servieren — Pfannengerichte verlieren schnell an Textur."
  ]
}$g$::jsonb,
  2249,
  NULL,
  'Fleischgericht'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Puten-Geschnetzeltes');

-- Schweinefilet in Champignonrahm
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Schweinefilet in Champignonrahm',
  4,
  $g${
  "titel": "Schweinefilet in Champignonrahm",
  "portionen": 4,
  "kategorie": "Fleischgericht",
  "geschaetzte_kcal_gesamt": 2485,
  "zutaten": [
    {
      "name": "Schweinefleisch",
      "menge": 800,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 2,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Knoblauchzehen",
      "menge": 2,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Gemüsebrühe",
      "menge": 400,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Tomatenmark",
      "menge": 1,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Butter",
      "menge": 40,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Rosmarin",
      "menge": 2,
      "einheit": "Zweige",
      "aus_lager": false
    },
    {
      "name": "Pfeffer",
      "menge": 1,
      "einheit": "Prise",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Pfanne (28 cm) und Spatel bereitstellen; Zutaten in gleicher Größe schneiden, damit gleichzeitig gar sind.",
    "Pfanne 2 Min auf Herdstufe 7 von 9 leer vorwärmen, dann 2 EL Öl — es soll leicht schimmern.",
    "Fleisch oder Tofu zuerst bei hoher Hitze anbraten, nicht bewegen bis sich eine Kruste löst (2–3 Min), wenden.",
    "Gemüse zugeben, 4–6 Min mitbraten, Pfanne nicht überfüllen (sonst dämpft es).",
    "Sauce (Soja, Sahne, Brühe) einrühren, 2–3 Min einkochen lassen, bis die Soße am Spatel haftet.",
    "Mit Salz, Pfeffer, Kräutern abschmecken; Hitze reduzieren, 1 Min ziehen lassen.",
    "Sofort auf vorgewärmten Tellern servieren — Pfannengerichte verlieren schnell an Textur."
  ]
}$g$::jsonb,
  2485,
  NULL,
  'Fleischgericht'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Schweinefilet in Champignonrahm');

-- Köttbullar mit Preiselbeeren
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Köttbullar mit Preiselbeeren',
  4,
  $g${
  "titel": "Köttbullar mit Preiselbeeren",
  "portionen": 4,
  "kategorie": "Fleischgericht",
  "geschaetzte_kcal_gesamt": 2338,
  "zutaten": [
    {
      "name": "Fleisch",
      "menge": 800,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 2,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Knoblauchzehen",
      "menge": 2,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Gemüsebrühe",
      "menge": 400,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Tomatenmark",
      "menge": 1,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Butter",
      "menge": 40,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Rosmarin",
      "menge": 2,
      "einheit": "Zweige",
      "aus_lager": false
    },
    {
      "name": "Pfeffer",
      "menge": 1,
      "einheit": "Prise",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Pfanne (28 cm) und Spatel bereitstellen; Zutaten in gleicher Größe schneiden, damit gleichzeitig gar sind.",
    "Pfanne 2 Min auf Herdstufe 7 von 9 leer vorwärmen, dann 2 EL Öl — es soll leicht schimmern.",
    "Fleisch oder Tofu zuerst bei hoher Hitze anbraten, nicht bewegen bis sich eine Kruste löst (2–3 Min), wenden.",
    "Gemüse zugeben, 4–6 Min mitbraten, Pfanne nicht überfüllen (sonst dämpft es).",
    "Sauce (Soja, Sahne, Brühe) einrühren, 2–3 Min einkochen lassen, bis die Soße am Spatel haftet.",
    "Mit Salz, Pfeffer, Kräutern abschmecken; Hitze reduzieren, 1 Min ziehen lassen.",
    "Sofort auf vorgewärmten Tellern servieren — Pfannengerichte verlieren schnell an Textur."
  ]
}$g$::jsonb,
  2338,
  NULL,
  'Fleischgericht'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Köttbullar mit Preiselbeeren');

-- Chili con Carne
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Chili con Carne',
  4,
  $g${
  "titel": "Chili con Carne",
  "portionen": 4,
  "kategorie": "Fleischgericht",
  "geschaetzte_kcal_gesamt": 2362,
  "zutaten": [
    {
      "name": "Fleisch",
      "menge": 800,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 2,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Knoblauchzehen",
      "menge": 2,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Gemüsebrühe",
      "menge": 400,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Tomatenmark",
      "menge": 1,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Butter",
      "menge": 40,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Rosmarin",
      "menge": 2,
      "einheit": "Zweige",
      "aus_lager": false
    },
    {
      "name": "Pfeffer",
      "menge": 1,
      "einheit": "Prise",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Pfanne (28 cm) und Spatel bereitstellen; Zutaten in gleicher Größe schneiden, damit gleichzeitig gar sind.",
    "Pfanne 2 Min auf Herdstufe 7 von 9 leer vorwärmen, dann 2 EL Öl — es soll leicht schimmern.",
    "Fleisch oder Tofu zuerst bei hoher Hitze anbraten, nicht bewegen bis sich eine Kruste löst (2–3 Min), wenden.",
    "Gemüse zugeben, 4–6 Min mitbraten, Pfanne nicht überfüllen (sonst dämpft es).",
    "Sauce (Soja, Sahne, Brühe) einrühren, 2–3 Min einkochen lassen, bis die Soße am Spatel haftet.",
    "Mit Salz, Pfeffer, Kräutern abschmecken; Hitze reduzieren, 1 Min ziehen lassen.",
    "Sofort auf vorgewärmten Tellern servieren — Pfannengerichte verlieren schnell an Textur."
  ]
}$g$::jsonb,
  2362,
  NULL,
  'Fleischgericht'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Chili con Carne');

-- Gyros mit Tzatziki
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Gyros mit Tzatziki',
  4,
  $g${
  "titel": "Gyros mit Tzatziki",
  "portionen": 4,
  "kategorie": "Fleischgericht",
  "geschaetzte_kcal_gesamt": 2384,
  "zutaten": [
    {
      "name": "Fleisch",
      "menge": 800,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 2,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Knoblauchzehen",
      "menge": 2,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Gemüsebrühe",
      "menge": 400,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Tomatenmark",
      "menge": 1,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Butter",
      "menge": 40,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Rosmarin",
      "menge": 2,
      "einheit": "Zweige",
      "aus_lager": false
    },
    {
      "name": "Pfeffer",
      "menge": 1,
      "einheit": "Prise",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Pfanne (28 cm) und Spatel bereitstellen; Zutaten in gleicher Größe schneiden, damit gleichzeitig gar sind.",
    "Pfanne 2 Min auf Herdstufe 7 von 9 leer vorwärmen, dann 2 EL Öl — es soll leicht schimmern.",
    "Fleisch oder Tofu zuerst bei hoher Hitze anbraten, nicht bewegen bis sich eine Kruste löst (2–3 Min), wenden.",
    "Gemüse zugeben, 4–6 Min mitbraten, Pfanne nicht überfüllen (sonst dämpft es).",
    "Sauce (Soja, Sahne, Brühe) einrühren, 2–3 Min einkochen lassen, bis die Soße am Spatel haftet.",
    "Mit Salz, Pfeffer, Kräutern abschmecken; Hitze reduzieren, 1 Min ziehen lassen.",
    "Sofort auf vorgewärmten Tellern servieren — Pfannengerichte verlieren schnell an Textur."
  ]
}$g$::jsonb,
  2384,
  NULL,
  'Fleischgericht'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Gyros mit Tzatziki');

-- Pulled Pork
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Pulled Pork',
  4,
  $g${
  "titel": "Pulled Pork",
  "portionen": 4,
  "kategorie": "Fleischgericht",
  "geschaetzte_kcal_gesamt": 2458,
  "zutaten": [
    {
      "name": "Fleisch",
      "menge": 800,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 2,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Knoblauchzehen",
      "menge": 2,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Gemüsebrühe",
      "menge": 400,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Tomatenmark",
      "menge": 1,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Butter",
      "menge": 40,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Rosmarin",
      "menge": 2,
      "einheit": "Zweige",
      "aus_lager": false
    },
    {
      "name": "Pfeffer",
      "menge": 1,
      "einheit": "Prise",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Pfanne (28 cm) und Spatel bereitstellen; Zutaten in gleicher Größe schneiden, damit gleichzeitig gar sind.",
    "Pfanne 2 Min auf Herdstufe 7 von 9 leer vorwärmen, dann 2 EL Öl — es soll leicht schimmern.",
    "Fleisch oder Tofu zuerst bei hoher Hitze anbraten, nicht bewegen bis sich eine Kruste löst (2–3 Min), wenden.",
    "Gemüse zugeben, 4–6 Min mitbraten, Pfanne nicht überfüllen (sonst dämpft es).",
    "Sauce (Soja, Sahne, Brühe) einrühren, 2–3 Min einkochen lassen, bis die Soße am Spatel haftet.",
    "Mit Salz, Pfeffer, Kräutern abschmecken; Hitze reduzieren, 1 Min ziehen lassen.",
    "Sofort auf vorgewärmten Tellern servieren — Pfannengerichte verlieren schnell an Textur."
  ]
}$g$::jsonb,
  2458,
  NULL,
  'Fleischgericht'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Pulled Pork');

-- Hähnchen Tikka Masala
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Hähnchen Tikka Masala',
  4,
  $g${
  "titel": "Hähnchen Tikka Masala",
  "portionen": 4,
  "kategorie": "Fleischgericht",
  "geschaetzte_kcal_gesamt": 2283,
  "zutaten": [
    {
      "name": "Hähnchen",
      "menge": 800,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 2,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Knoblauchzehen",
      "menge": 2,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Gemüsebrühe",
      "menge": 400,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Tomatenmark",
      "menge": 1,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Butter",
      "menge": 40,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Rosmarin",
      "menge": 2,
      "einheit": "Zweige",
      "aus_lager": false
    },
    {
      "name": "Pfeffer",
      "menge": 1,
      "einheit": "Prise",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Pfanne (28 cm) und Spatel bereitstellen; Zutaten in gleicher Größe schneiden, damit gleichzeitig gar sind.",
    "Pfanne 2 Min auf Herdstufe 7 von 9 leer vorwärmen, dann 2 EL Öl — es soll leicht schimmern.",
    "Fleisch oder Tofu zuerst bei hoher Hitze anbraten, nicht bewegen bis sich eine Kruste löst (2–3 Min), wenden.",
    "Gemüse zugeben, 4–6 Min mitbraten, Pfanne nicht überfüllen (sonst dämpft es).",
    "Sauce (Soja, Sahne, Brühe) einrühren, 2–3 Min einkochen lassen, bis die Soße am Spatel haftet.",
    "Mit Salz, Pfeffer, Kräutern abschmecken; Hitze reduzieren, 1 Min ziehen lassen.",
    "Sofort auf vorgewärmten Tellern servieren — Pfannengerichte verlieren schnell an Textur."
  ]
}$g$::jsonb,
  2283,
  NULL,
  'Fleischgericht'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Hähnchen Tikka Masala');

-- Rinderburger selbst gemacht
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Rinderburger selbst gemacht',
  4,
  $g${
  "titel": "Rinderburger selbst gemacht",
  "portionen": 4,
  "kategorie": "Fleischgericht",
  "geschaetzte_kcal_gesamt": 2505,
  "zutaten": [
    {
      "name": "Rindfleisch",
      "menge": 800,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 2,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Knoblauchzehen",
      "menge": 2,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Gemüsebrühe",
      "menge": 400,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Tomatenmark",
      "menge": 1,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Butter",
      "menge": 40,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Rosmarin",
      "menge": 2,
      "einheit": "Zweige",
      "aus_lager": false
    },
    {
      "name": "Pfeffer",
      "menge": 1,
      "einheit": "Prise",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Pfanne (28 cm) und Spatel bereitstellen; Zutaten in gleicher Größe schneiden, damit gleichzeitig gar sind.",
    "Pfanne 2 Min auf Herdstufe 7 von 9 leer vorwärmen, dann 2 EL Öl — es soll leicht schimmern.",
    "Fleisch oder Tofu zuerst bei hoher Hitze anbraten, nicht bewegen bis sich eine Kruste löst (2–3 Min), wenden.",
    "Gemüse zugeben, 4–6 Min mitbraten, Pfanne nicht überfüllen (sonst dämpft es).",
    "Sauce (Soja, Sahne, Brühe) einrühren, 2–3 Min einkochen lassen, bis die Soße am Spatel haftet.",
    "Mit Salz, Pfeffer, Kräutern abschmecken; Hitze reduzieren, 1 Min ziehen lassen.",
    "Sofort auf vorgewärmten Tellern servieren — Pfannengerichte verlieren schnell an Textur."
  ]
}$g$::jsonb,
  2505,
  NULL,
  'Fleischgericht'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Rinderburger selbst gemacht');

-- Schweinekoteletts paniert
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Schweinekoteletts paniert',
  4,
  $g${
  "titel": "Schweinekoteletts paniert",
  "portionen": 4,
  "kategorie": "Fleischgericht",
  "geschaetzte_kcal_gesamt": 2400,
  "zutaten": [
    {
      "name": "Schweinefleisch",
      "menge": 800,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 2,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Knoblauchzehen",
      "menge": 2,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Gemüsebrühe",
      "menge": 400,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Tomatenmark",
      "menge": 1,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Butter",
      "menge": 40,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Rosmarin",
      "menge": 2,
      "einheit": "Zweige",
      "aus_lager": false
    },
    {
      "name": "Pfeffer",
      "menge": 1,
      "einheit": "Prise",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Pfanne (28 cm) und Spatel bereitstellen; Zutaten in gleicher Größe schneiden, damit gleichzeitig gar sind.",
    "Pfanne 2 Min auf Herdstufe 7 von 9 leer vorwärmen, dann 2 EL Öl — es soll leicht schimmern.",
    "Fleisch oder Tofu zuerst bei hoher Hitze anbraten, nicht bewegen bis sich eine Kruste löst (2–3 Min), wenden.",
    "Gemüse zugeben, 4–6 Min mitbraten, Pfanne nicht überfüllen (sonst dämpft es).",
    "Sauce (Soja, Sahne, Brühe) einrühren, 2–3 Min einkochen lassen, bis die Soße am Spatel haftet.",
    "Mit Salz, Pfeffer, Kräutern abschmecken; Hitze reduzieren, 1 Min ziehen lassen.",
    "Sofort auf vorgewärmten Tellern servieren — Pfannengerichte verlieren schnell an Textur."
  ]
}$g$::jsonb,
  2400,
  NULL,
  'Fleischgericht'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Schweinekoteletts paniert');

-- Entenbrust mit Orangensoße
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Entenbrust mit Orangensoße',
  4,
  $g${
  "titel": "Entenbrust mit Orangensoße",
  "portionen": 4,
  "kategorie": "Fleischgericht",
  "geschaetzte_kcal_gesamt": 2524,
  "zutaten": [
    {
      "name": "Entenbrust",
      "menge": 800,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 2,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Knoblauchzehen",
      "menge": 2,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Gemüsebrühe",
      "menge": 400,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Tomatenmark",
      "menge": 1,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Butter",
      "menge": 40,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Rosmarin",
      "menge": 2,
      "einheit": "Zweige",
      "aus_lager": false
    },
    {
      "name": "Pfeffer",
      "menge": 1,
      "einheit": "Prise",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Pfanne (28 cm) und Spatel bereitstellen; Zutaten in gleicher Größe schneiden, damit gleichzeitig gar sind.",
    "Pfanne 2 Min auf Herdstufe 7 von 9 leer vorwärmen, dann 2 EL Öl — es soll leicht schimmern.",
    "Fleisch oder Tofu zuerst bei hoher Hitze anbraten, nicht bewegen bis sich eine Kruste löst (2–3 Min), wenden.",
    "Gemüse zugeben, 4–6 Min mitbraten, Pfanne nicht überfüllen (sonst dämpft es).",
    "Sauce (Soja, Sahne, Brühe) einrühren, 2–3 Min einkochen lassen, bis die Soße am Spatel haftet.",
    "Mit Salz, Pfeffer, Kräutern abschmecken; Hitze reduzieren, 1 Min ziehen lassen.",
    "Sofort auf vorgewärmten Tellern servieren — Pfannengerichte verlieren schnell an Textur."
  ]
}$g$::jsonb,
  2524,
  NULL,
  'Fleischgericht'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Entenbrust mit Orangensoße');

-- Lammkoteletts mit Rosmarin
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Lammkoteletts mit Rosmarin',
  4,
  $g${
  "titel": "Lammkoteletts mit Rosmarin",
  "portionen": 4,
  "kategorie": "Fleischgericht",
  "geschaetzte_kcal_gesamt": 2419,
  "zutaten": [
    {
      "name": "Lamm",
      "menge": 800,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 2,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Knoblauchzehen",
      "menge": 2,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Gemüsebrühe",
      "menge": 400,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Tomatenmark",
      "menge": 1,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Butter",
      "menge": 40,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Rosmarin",
      "menge": 2,
      "einheit": "Zweige",
      "aus_lager": false
    },
    {
      "name": "Pfeffer",
      "menge": 1,
      "einheit": "Prise",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Pfanne (28 cm) und Spatel bereitstellen; Zutaten in gleicher Größe schneiden, damit gleichzeitig gar sind.",
    "Pfanne 2 Min auf Herdstufe 7 von 9 leer vorwärmen, dann 2 EL Öl — es soll leicht schimmern.",
    "Fleisch oder Tofu zuerst bei hoher Hitze anbraten, nicht bewegen bis sich eine Kruste löst (2–3 Min), wenden.",
    "Gemüse zugeben, 4–6 Min mitbraten, Pfanne nicht überfüllen (sonst dämpft es).",
    "Sauce (Soja, Sahne, Brühe) einrühren, 2–3 Min einkochen lassen, bis die Soße am Spatel haftet.",
    "Mit Salz, Pfeffer, Kräutern abschmecken; Hitze reduzieren, 1 Min ziehen lassen.",
    "Sofort auf vorgewärmten Tellern servieren — Pfannengerichte verlieren schnell an Textur."
  ]
}$g$::jsonb,
  2419,
  NULL,
  'Fleischgericht'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Lammkoteletts mit Rosmarin');

-- Hähnchenwings im Ofen
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Hähnchenwings im Ofen',
  4,
  $g${
  "titel": "Hähnchenwings im Ofen",
  "portionen": 4,
  "kategorie": "Fleischgericht",
  "geschaetzte_kcal_gesamt": 2350,
  "zutaten": [
    {
      "name": "Hähnchen",
      "menge": 800,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 2,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Knoblauchzehen",
      "menge": 2,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Gemüsebrühe",
      "menge": 400,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Tomatenmark",
      "menge": 1,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Butter",
      "menge": 40,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Rosmarin",
      "menge": 2,
      "einheit": "Zweige",
      "aus_lager": false
    },
    {
      "name": "Pfeffer",
      "menge": 1,
      "einheit": "Prise",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Pfanne (28 cm) und Spatel bereitstellen; Zutaten in gleicher Größe schneiden, damit gleichzeitig gar sind.",
    "Pfanne 2 Min auf Herdstufe 7 von 9 leer vorwärmen, dann 2 EL Öl — es soll leicht schimmern.",
    "Fleisch oder Tofu zuerst bei hoher Hitze anbraten, nicht bewegen bis sich eine Kruste löst (2–3 Min), wenden.",
    "Gemüse zugeben, 4–6 Min mitbraten, Pfanne nicht überfüllen (sonst dämpft es).",
    "Sauce (Soja, Sahne, Brühe) einrühren, 2–3 Min einkochen lassen, bis die Soße am Spatel haftet.",
    "Mit Salz, Pfeffer, Kräutern abschmecken; Hitze reduzieren, 1 Min ziehen lassen.",
    "Sofort auf vorgewärmten Tellern servieren — Pfannengerichte verlieren schnell an Textur."
  ]
}$g$::jsonb,
  2350,
  NULL,
  'Fleischgericht'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Hähnchenwings im Ofen');

-- Rindfleisch-Stroganoff
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Rindfleisch-Stroganoff',
  4,
  $g${
  "titel": "Rindfleisch-Stroganoff",
  "portionen": 4,
  "kategorie": "Fleischgericht",
  "geschaetzte_kcal_gesamt": 2425,
  "zutaten": [
    {
      "name": "Rindfleisch",
      "menge": 800,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 2,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Knoblauchzehen",
      "menge": 2,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Gemüsebrühe",
      "menge": 400,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Tomatenmark",
      "menge": 1,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Butter",
      "menge": 40,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Rosmarin",
      "menge": 2,
      "einheit": "Zweige",
      "aus_lager": false
    },
    {
      "name": "Pfeffer",
      "menge": 1,
      "einheit": "Prise",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Pfanne (28 cm) und Spatel bereitstellen; Zutaten in gleicher Größe schneiden, damit gleichzeitig gar sind.",
    "Pfanne 2 Min auf Herdstufe 7 von 9 leer vorwärmen, dann 2 EL Öl — es soll leicht schimmern.",
    "Fleisch oder Tofu zuerst bei hoher Hitze anbraten, nicht bewegen bis sich eine Kruste löst (2–3 Min), wenden.",
    "Gemüse zugeben, 4–6 Min mitbraten, Pfanne nicht überfüllen (sonst dämpft es).",
    "Sauce (Soja, Sahne, Brühe) einrühren, 2–3 Min einkochen lassen, bis die Soße am Spatel haftet.",
    "Mit Salz, Pfeffer, Kräutern abschmecken; Hitze reduzieren, 1 Min ziehen lassen.",
    "Sofort auf vorgewärmten Tellern servieren — Pfannengerichte verlieren schnell an Textur."
  ]
}$g$::jsonb,
  2425,
  NULL,
  'Fleischgericht'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Rindfleisch-Stroganoff');

-- Schweinerouladen
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Schweinerouladen',
  4,
  $g${
  "titel": "Schweinerouladen",
  "portionen": 4,
  "kategorie": "Fleischgericht",
  "geschaetzte_kcal_gesamt": 2280,
  "zutaten": [
    {
      "name": "Schweinefleisch",
      "menge": 800,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 2,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Knoblauchzehen",
      "menge": 2,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Gemüsebrühe",
      "menge": 400,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Tomatenmark",
      "menge": 1,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Butter",
      "menge": 40,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Rosmarin",
      "menge": 2,
      "einheit": "Zweige",
      "aus_lager": false
    },
    {
      "name": "Pfeffer",
      "menge": 1,
      "einheit": "Prise",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Pfanne (28 cm) und Spatel bereitstellen; Zutaten in gleicher Größe schneiden, damit gleichzeitig gar sind.",
    "Pfanne 2 Min auf Herdstufe 7 von 9 leer vorwärmen, dann 2 EL Öl — es soll leicht schimmern.",
    "Fleisch oder Tofu zuerst bei hoher Hitze anbraten, nicht bewegen bis sich eine Kruste löst (2–3 Min), wenden.",
    "Gemüse zugeben, 4–6 Min mitbraten, Pfanne nicht überfüllen (sonst dämpft es).",
    "Sauce (Soja, Sahne, Brühe) einrühren, 2–3 Min einkochen lassen, bis die Soße am Spatel haftet.",
    "Mit Salz, Pfeffer, Kräutern abschmecken; Hitze reduzieren, 1 Min ziehen lassen.",
    "Sofort auf vorgewärmten Tellern servieren — Pfannengerichte verlieren schnell an Textur."
  ]
}$g$::jsonb,
  2280,
  NULL,
  'Fleischgericht'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Schweinerouladen');

-- Hackfleisch-Pfanne mexikanisch
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Hackfleisch-Pfanne mexikanisch',
  4,
  $g${
  "titel": "Hackfleisch-Pfanne mexikanisch",
  "portionen": 4,
  "kategorie": "Fleischgericht",
  "geschaetzte_kcal_gesamt": 2358,
  "zutaten": [
    {
      "name": "Fleisch",
      "menge": 800,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 2,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Knoblauchzehen",
      "menge": 2,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Gemüsebrühe",
      "menge": 400,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Tomatenmark",
      "menge": 1,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Butter",
      "menge": 40,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Rosmarin",
      "menge": 2,
      "einheit": "Zweige",
      "aus_lager": false
    },
    {
      "name": "Pfeffer",
      "menge": 1,
      "einheit": "Prise",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Pfanne (28 cm) und Spatel bereitstellen; Zutaten in gleicher Größe schneiden, damit gleichzeitig gar sind.",
    "Pfanne 2 Min auf Herdstufe 7 von 9 leer vorwärmen, dann 2 EL Öl — es soll leicht schimmern.",
    "Fleisch oder Tofu zuerst bei hoher Hitze anbraten, nicht bewegen bis sich eine Kruste löst (2–3 Min), wenden.",
    "Gemüse zugeben, 4–6 Min mitbraten, Pfanne nicht überfüllen (sonst dämpft es).",
    "Sauce (Soja, Sahne, Brühe) einrühren, 2–3 Min einkochen lassen, bis die Soße am Spatel haftet.",
    "Mit Salz, Pfeffer, Kräutern abschmecken; Hitze reduzieren, 1 Min ziehen lassen.",
    "Sofort auf vorgewärmten Tellern servieren — Pfannengerichte verlieren schnell an Textur."
  ]
}$g$::jsonb,
  2358,
  NULL,
  'Fleischgericht'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Hackfleisch-Pfanne mexikanisch');

-- Coq au Vin
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Coq au Vin',
  4,
  $g${
  "titel": "Coq au Vin",
  "portionen": 4,
  "kategorie": "Fleischgericht",
  "geschaetzte_kcal_gesamt": 2270,
  "zutaten": [
    {
      "name": "Fleisch",
      "menge": 800,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 2,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Knoblauchzehen",
      "menge": 2,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Gemüsebrühe",
      "menge": 400,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Tomatenmark",
      "menge": 1,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Butter",
      "menge": 40,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Rosmarin",
      "menge": 2,
      "einheit": "Zweige",
      "aus_lager": false
    },
    {
      "name": "Pfeffer",
      "menge": 1,
      "einheit": "Prise",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Pfanne (28 cm) und Spatel bereitstellen; Zutaten in gleicher Größe schneiden, damit gleichzeitig gar sind.",
    "Pfanne 2 Min auf Herdstufe 7 von 9 leer vorwärmen, dann 2 EL Öl — es soll leicht schimmern.",
    "Fleisch oder Tofu zuerst bei hoher Hitze anbraten, nicht bewegen bis sich eine Kruste löst (2–3 Min), wenden.",
    "Gemüse zugeben, 4–6 Min mitbraten, Pfanne nicht überfüllen (sonst dämpft es).",
    "Sauce (Soja, Sahne, Brühe) einrühren, 2–3 Min einkochen lassen, bis die Soße am Spatel haftet.",
    "Mit Salz, Pfeffer, Kräutern abschmecken; Hitze reduzieren, 1 Min ziehen lassen.",
    "Sofort auf vorgewärmten Tellern servieren — Pfannengerichte verlieren schnell an Textur."
  ]
}$g$::jsonb,
  2270,
  NULL,
  'Fleischgericht'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Coq au Vin');

-- Schweinebauch kross
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Schweinebauch kross',
  4,
  $g${
  "titel": "Schweinebauch kross",
  "portionen": 4,
  "kategorie": "Fleischgericht",
  "geschaetzte_kcal_gesamt": 2531,
  "zutaten": [
    {
      "name": "Schweinefleisch",
      "menge": 800,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 2,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Knoblauchzehen",
      "menge": 2,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Gemüsebrühe",
      "menge": 400,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Tomatenmark",
      "menge": 1,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Butter",
      "menge": 40,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Rosmarin",
      "menge": 2,
      "einheit": "Zweige",
      "aus_lager": false
    },
    {
      "name": "Pfeffer",
      "menge": 1,
      "einheit": "Prise",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Pfanne (28 cm) und Spatel bereitstellen; Zutaten in gleicher Größe schneiden, damit gleichzeitig gar sind.",
    "Pfanne 2 Min auf Herdstufe 7 von 9 leer vorwärmen, dann 2 EL Öl — es soll leicht schimmern.",
    "Fleisch oder Tofu zuerst bei hoher Hitze anbraten, nicht bewegen bis sich eine Kruste löst (2–3 Min), wenden.",
    "Gemüse zugeben, 4–6 Min mitbraten, Pfanne nicht überfüllen (sonst dämpft es).",
    "Sauce (Soja, Sahne, Brühe) einrühren, 2–3 Min einkochen lassen, bis die Soße am Spatel haftet.",
    "Mit Salz, Pfeffer, Kräutern abschmecken; Hitze reduzieren, 1 Min ziehen lassen.",
    "Sofort auf vorgewärmten Tellern servieren — Pfannengerichte verlieren schnell an Textur."
  ]
}$g$::jsonb,
  2531,
  NULL,
  'Fleischgericht'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Schweinebauch kross');

-- Forelle Müllerin Art
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Forelle Müllerin Art',
  4,
  $g${
  "titel": "Forelle Müllerin Art",
  "portionen": 4,
  "kategorie": "Fischgericht",
  "geschaetzte_kcal_gesamt": 1647,
  "zutaten": [
    {
      "name": "Forelle",
      "menge": 2,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Zitrone",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Butter",
      "menge": 40,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Knoblauchzehen",
      "menge": 2,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Dill",
      "menge": 15,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Olivenöl",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Sahne",
      "menge": 100,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Kapern",
      "menge": 1,
      "einheit": "EL",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Fischfilet 20 Min vorher aus dem Kühlschrank, Hautseite trocken tupfen, Gräten mit Fingern prüfen.",
    "Pfanne oder Ofen vorbereiten: Pfanne auf Stufe 6–7, 1 EL Öl; Ofen 200 °C Umluft falls Ofengang.",
    "Fisch salzen und pfeffern, optional mit Zitrone beträufeln; bei Pfanne: Hautseite zuerst 3–4 Min ohne Wenden.",
    "Wenden oder in den Ofen geben: Gesamtgarzeit oft nur 8–12 Min je nach Dicke (1 cm ≈ 3 Min).",
    "Kerntemperatur 58–62 °C oder Flakes brechen sich leicht — nicht überziehen (trocken).",
    "Beilage parallel fertigstellen; Fisch sofort mit Zitrone und Kräutern servieren."
  ]
}$g$::jsonb,
  1647,
  NULL,
  'Fischgericht'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Forelle Müllerin Art');

-- Kabeljau mit Senfsoße
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Kabeljau mit Senfsoße',
  4,
  $g${
  "titel": "Kabeljau mit Senfsoße",
  "portionen": 4,
  "kategorie": "Fischgericht",
  "geschaetzte_kcal_gesamt": 1739,
  "zutaten": [
    {
      "name": "Kabeljaufilet",
      "menge": 600,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Zitrone",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Butter",
      "menge": 40,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Knoblauchzehen",
      "menge": 2,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Dill",
      "menge": 15,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Olivenöl",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Sahne",
      "menge": 100,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Kapern",
      "menge": 1,
      "einheit": "EL",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Fischfilet 20 Min vorher aus dem Kühlschrank, Hautseite trocken tupfen, Gräten mit Fingern prüfen.",
    "Pfanne oder Ofen vorbereiten: Pfanne auf Stufe 6–7, 1 EL Öl; Ofen 200 °C Umluft falls Ofengang.",
    "Fisch salzen und pfeffern, optional mit Zitrone beträufeln; bei Pfanne: Hautseite zuerst 3–4 Min ohne Wenden.",
    "Wenden oder in den Ofen geben: Gesamtgarzeit oft nur 8–12 Min je nach Dicke (1 cm ≈ 3 Min).",
    "Kerntemperatur 58–62 °C oder Flakes brechen sich leicht — nicht überziehen (trocken).",
    "Beilage parallel fertigstellen; Fisch sofort mit Zitrone und Kräutern servieren."
  ]
}$g$::jsonb,
  1739,
  NULL,
  'Fischgericht'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Kabeljau mit Senfsoße');

-- Garnelen in Knoblauchöl
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Garnelen in Knoblauchöl',
  4,
  $g${
  "titel": "Garnelen in Knoblauchöl",
  "portionen": 4,
  "kategorie": "Fischgericht",
  "geschaetzte_kcal_gesamt": 1964,
  "zutaten": [
    {
      "name": "Garnelen",
      "menge": 400,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Zitrone",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Butter",
      "menge": 40,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Knoblauchzehen",
      "menge": 2,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Dill",
      "menge": 15,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Olivenöl",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Sahne",
      "menge": 100,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Kapern",
      "menge": 1,
      "einheit": "EL",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Fischfilet 20 Min vorher aus dem Kühlschrank, Hautseite trocken tupfen, Gräten mit Fingern prüfen.",
    "Pfanne oder Ofen vorbereiten: Pfanne auf Stufe 6–7, 1 EL Öl; Ofen 200 °C Umluft falls Ofengang.",
    "Fisch salzen und pfeffern, optional mit Zitrone beträufeln; bei Pfanne: Hautseite zuerst 3–4 Min ohne Wenden.",
    "Wenden oder in den Ofen geben: Gesamtgarzeit oft nur 8–12 Min je nach Dicke (1 cm ≈ 3 Min).",
    "Kerntemperatur 58–62 °C oder Flakes brechen sich leicht — nicht überziehen (trocken).",
    "Beilage parallel fertigstellen; Fisch sofort mit Zitrone und Kräutern servieren."
  ]
}$g$::jsonb,
  1964,
  NULL,
  'Fischgericht'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Garnelen in Knoblauchöl');

-- Thunfischsteak kurz angebraten
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Thunfischsteak kurz angebraten',
  4,
  $g${
  "titel": "Thunfischsteak kurz angebraten",
  "portionen": 4,
  "kategorie": "Fischgericht",
  "geschaetzte_kcal_gesamt": 1847,
  "zutaten": [
    {
      "name": "Thunfischsteak",
      "menge": 600,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Zitrone",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Butter",
      "menge": 40,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Knoblauchzehen",
      "menge": 2,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Dill",
      "menge": 15,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Olivenöl",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Sahne",
      "menge": 100,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Kapern",
      "menge": 1,
      "einheit": "EL",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Fischfilet 20 Min vorher aus dem Kühlschrank, Hautseite trocken tupfen, Gräten mit Fingern prüfen.",
    "Pfanne oder Ofen vorbereiten: Pfanne auf Stufe 6–7, 1 EL Öl; Ofen 200 °C Umluft falls Ofengang.",
    "Fisch salzen und pfeffern, optional mit Zitrone beträufeln; bei Pfanne: Hautseite zuerst 3–4 Min ohne Wenden.",
    "Wenden oder in den Ofen geben: Gesamtgarzeit oft nur 8–12 Min je nach Dicke (1 cm ≈ 3 Min).",
    "Kerntemperatur 58–62 °C oder Flakes brechen sich leicht — nicht überziehen (trocken).",
    "Beilage parallel fertigstellen; Fisch sofort mit Zitrone und Kräutern servieren."
  ]
}$g$::jsonb,
  1847,
  NULL,
  'Fischgericht'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Thunfischsteak kurz angebraten');

-- Fischstäbchen selbst gemacht
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Fischstäbchen selbst gemacht',
  4,
  $g${
  "titel": "Fischstäbchen selbst gemacht",
  "portionen": 4,
  "kategorie": "Fischgericht",
  "geschaetzte_kcal_gesamt": 1710,
  "zutaten": [
    {
      "name": "Fischfilet",
      "menge": 600,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Zitrone",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Butter",
      "menge": 40,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Knoblauchzehen",
      "menge": 2,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Dill",
      "menge": 15,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Olivenöl",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Sahne",
      "menge": 100,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Kapern",
      "menge": 1,
      "einheit": "EL",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Fischfilet 20 Min vorher aus dem Kühlschrank, Hautseite trocken tupfen, Gräten mit Fingern prüfen.",
    "Pfanne oder Ofen vorbereiten: Pfanne auf Stufe 6–7, 1 EL Öl; Ofen 200 °C Umluft falls Ofengang.",
    "Fisch salzen und pfeffern, optional mit Zitrone beträufeln; bei Pfanne: Hautseite zuerst 3–4 Min ohne Wenden.",
    "Wenden oder in den Ofen geben: Gesamtgarzeit oft nur 8–12 Min je nach Dicke (1 cm ≈ 3 Min).",
    "Kerntemperatur 58–62 °C oder Flakes brechen sich leicht — nicht überziehen (trocken).",
    "Beilage parallel fertigstellen; Fisch sofort mit Zitrone und Kräutern servieren."
  ]
}$g$::jsonb,
  1710,
  NULL,
  'Fischgericht'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Fischstäbchen selbst gemacht');

-- Lachs in Dill-Senfsoße
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Lachs in Dill-Senfsoße',
  4,
  $g${
  "titel": "Lachs in Dill-Senfsoße",
  "portionen": 4,
  "kategorie": "Fischgericht",
  "geschaetzte_kcal_gesamt": 1750,
  "zutaten": [
    {
      "name": "Lachsfilet",
      "menge": 600,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Zitrone",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Butter",
      "menge": 40,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Knoblauchzehen",
      "menge": 2,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Dill",
      "menge": 15,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Olivenöl",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Sahne",
      "menge": 100,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Kapern",
      "menge": 1,
      "einheit": "EL",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Fischfilet 20 Min vorher aus dem Kühlschrank, Hautseite trocken tupfen, Gräten mit Fingern prüfen.",
    "Pfanne oder Ofen vorbereiten: Pfanne auf Stufe 6–7, 1 EL Öl; Ofen 200 °C Umluft falls Ofengang.",
    "Fisch salzen und pfeffern, optional mit Zitrone beträufeln; bei Pfanne: Hautseite zuerst 3–4 Min ohne Wenden.",
    "Wenden oder in den Ofen geben: Gesamtgarzeit oft nur 8–12 Min je nach Dicke (1 cm ≈ 3 Min).",
    "Kerntemperatur 58–62 °C oder Flakes brechen sich leicht — nicht überziehen (trocken).",
    "Beilage parallel fertigstellen; Fisch sofort mit Zitrone und Kräutern servieren."
  ]
}$g$::jsonb,
  1750,
  NULL,
  'Fischgericht'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Lachs in Dill-Senfsoße');

-- Zanderfilet auf Tomatenbett
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Zanderfilet auf Tomatenbett',
  4,
  $g${
  "titel": "Zanderfilet auf Tomatenbett",
  "portionen": 4,
  "kategorie": "Fischgericht",
  "geschaetzte_kcal_gesamt": 1883,
  "zutaten": [
    {
      "name": "Zanderfilet",
      "menge": 600,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Zitrone",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Butter",
      "menge": 40,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Knoblauchzehen",
      "menge": 2,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Dill",
      "menge": 15,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Olivenöl",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Sahne",
      "menge": 100,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Kapern",
      "menge": 1,
      "einheit": "EL",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Fischfilet 20 Min vorher aus dem Kühlschrank, Hautseite trocken tupfen, Gräten mit Fingern prüfen.",
    "Pfanne oder Ofen vorbereiten: Pfanne auf Stufe 6–7, 1 EL Öl; Ofen 200 °C Umluft falls Ofengang.",
    "Fisch salzen und pfeffern, optional mit Zitrone beträufeln; bei Pfanne: Hautseite zuerst 3–4 Min ohne Wenden.",
    "Wenden oder in den Ofen geben: Gesamtgarzeit oft nur 8–12 Min je nach Dicke (1 cm ≈ 3 Min).",
    "Kerntemperatur 58–62 °C oder Flakes brechen sich leicht — nicht überziehen (trocken).",
    "Beilage parallel fertigstellen; Fisch sofort mit Zitrone und Kräutern servieren."
  ]
}$g$::jsonb,
  1883,
  NULL,
  'Fischgericht'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Zanderfilet auf Tomatenbett');

-- Meeresfrüchte-Pfanne
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Meeresfrüchte-Pfanne',
  4,
  $g${
  "titel": "Meeresfrüchte-Pfanne",
  "portionen": 4,
  "kategorie": "Fischgericht",
  "geschaetzte_kcal_gesamt": 1742,
  "zutaten": [
    {
      "name": "Fischfilet",
      "menge": 600,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Zitrone",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Butter",
      "menge": 40,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Knoblauchzehen",
      "menge": 2,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Dill",
      "menge": 15,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Olivenöl",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Sahne",
      "menge": 100,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Kapern",
      "menge": 1,
      "einheit": "EL",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Fischfilet 20 Min vorher aus dem Kühlschrank, Hautseite trocken tupfen, Gräten mit Fingern prüfen.",
    "Pfanne oder Ofen vorbereiten: Pfanne auf Stufe 6–7, 1 EL Öl; Ofen 200 °C Umluft falls Ofengang.",
    "Fisch salzen und pfeffern, optional mit Zitrone beträufeln; bei Pfanne: Hautseite zuerst 3–4 Min ohne Wenden.",
    "Wenden oder in den Ofen geben: Gesamtgarzeit oft nur 8–12 Min je nach Dicke (1 cm ≈ 3 Min).",
    "Kerntemperatur 58–62 °C oder Flakes brechen sich leicht — nicht überziehen (trocken).",
    "Beilage parallel fertigstellen; Fisch sofort mit Zitrone und Kräutern servieren."
  ]
}$g$::jsonb,
  1742,
  NULL,
  'Fischgericht'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Meeresfrüchte-Pfanne');

-- Matjes mit Bratkartoffeln
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Matjes mit Bratkartoffeln',
  4,
  $g${
  "titel": "Matjes mit Bratkartoffeln",
  "portionen": 4,
  "kategorie": "Fischgericht",
  "geschaetzte_kcal_gesamt": 1667,
  "zutaten": [
    {
      "name": "Fischfilet",
      "menge": 600,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Zitrone",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Butter",
      "menge": 40,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Knoblauchzehen",
      "menge": 2,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Dill",
      "menge": 15,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Olivenöl",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Sahne",
      "menge": 100,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Kapern",
      "menge": 1,
      "einheit": "EL",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Fischfilet 20 Min vorher aus dem Kühlschrank, Hautseite trocken tupfen, Gräten mit Fingern prüfen.",
    "Pfanne oder Ofen vorbereiten: Pfanne auf Stufe 6–7, 1 EL Öl; Ofen 200 °C Umluft falls Ofengang.",
    "Fisch salzen und pfeffern, optional mit Zitrone beträufeln; bei Pfanne: Hautseite zuerst 3–4 Min ohne Wenden.",
    "Wenden oder in den Ofen geben: Gesamtgarzeit oft nur 8–12 Min je nach Dicke (1 cm ≈ 3 Min).",
    "Kerntemperatur 58–62 °C oder Flakes brechen sich leicht — nicht überziehen (trocken).",
    "Beilage parallel fertigstellen; Fisch sofort mit Zitrone und Kräutern servieren."
  ]
}$g$::jsonb,
  1667,
  NULL,
  'Fischgericht'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Matjes mit Bratkartoffeln');

-- Fischcurry mit Kokosmilch
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Fischcurry mit Kokosmilch',
  4,
  $g${
  "titel": "Fischcurry mit Kokosmilch",
  "portionen": 4,
  "kategorie": "Fischgericht",
  "geschaetzte_kcal_gesamt": 1696,
  "zutaten": [
    {
      "name": "Fischfilet",
      "menge": 600,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Zitrone",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Butter",
      "menge": 40,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Knoblauchzehen",
      "menge": 2,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Dill",
      "menge": 15,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Olivenöl",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Sahne",
      "menge": 100,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Kapern",
      "menge": 1,
      "einheit": "EL",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Fischfilet 20 Min vorher aus dem Kühlschrank, Hautseite trocken tupfen, Gräten mit Fingern prüfen.",
    "Pfanne oder Ofen vorbereiten: Pfanne auf Stufe 6–7, 1 EL Öl; Ofen 200 °C Umluft falls Ofengang.",
    "Fisch salzen und pfeffern, optional mit Zitrone beträufeln; bei Pfanne: Hautseite zuerst 3–4 Min ohne Wenden.",
    "Wenden oder in den Ofen geben: Gesamtgarzeit oft nur 8–12 Min je nach Dicke (1 cm ≈ 3 Min).",
    "Kerntemperatur 58–62 °C oder Flakes brechen sich leicht — nicht überziehen (trocken).",
    "Beilage parallel fertigstellen; Fisch sofort mit Zitrone und Kräutern servieren."
  ]
}$g$::jsonb,
  1696,
  NULL,
  'Fischgericht'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Fischcurry mit Kokosmilch');

-- Sardinen-Pasta
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Sardinen-Pasta',
  4,
  $g${
  "titel": "Sardinen-Pasta",
  "portionen": 4,
  "kategorie": "Fischgericht",
  "geschaetzte_kcal_gesamt": 1770,
  "zutaten": [
    {
      "name": "Fischfilet",
      "menge": 600,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Zitrone",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Butter",
      "menge": 40,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Knoblauchzehen",
      "menge": 2,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Dill",
      "menge": 15,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Olivenöl",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Sahne",
      "menge": 100,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Kapern",
      "menge": 1,
      "einheit": "EL",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Fischfilet 20 Min vorher aus dem Kühlschrank, Hautseite trocken tupfen, Gräten mit Fingern prüfen.",
    "Pfanne oder Ofen vorbereiten: Pfanne auf Stufe 6–7, 1 EL Öl; Ofen 200 °C Umluft falls Ofengang.",
    "Fisch salzen und pfeffern, optional mit Zitrone beträufeln; bei Pfanne: Hautseite zuerst 3–4 Min ohne Wenden.",
    "Wenden oder in den Ofen geben: Gesamtgarzeit oft nur 8–12 Min je nach Dicke (1 cm ≈ 3 Min).",
    "Kerntemperatur 58–62 °C oder Flakes brechen sich leicht — nicht überziehen (trocken).",
    "Beilage parallel fertigstellen; Fisch sofort mit Zitrone und Kräutern servieren."
  ]
}$g$::jsonb,
  1770,
  NULL,
  'Fischgericht'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Sardinen-Pasta');

-- Tintenfischringe gebraten
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Tintenfischringe gebraten',
  4,
  $g${
  "titel": "Tintenfischringe gebraten",
  "portionen": 4,
  "kategorie": "Fischgericht",
  "geschaetzte_kcal_gesamt": 1756,
  "zutaten": [
    {
      "name": "Fischfilet",
      "menge": 600,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Zitrone",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Butter",
      "menge": 40,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Knoblauchzehen",
      "menge": 2,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Dill",
      "menge": 15,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Olivenöl",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Sahne",
      "menge": 100,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Kapern",
      "menge": 1,
      "einheit": "EL",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Fischfilet 20 Min vorher aus dem Kühlschrank, Hautseite trocken tupfen, Gräten mit Fingern prüfen.",
    "Pfanne oder Ofen vorbereiten: Pfanne auf Stufe 6–7, 1 EL Öl; Ofen 200 °C Umluft falls Ofengang.",
    "Fisch salzen und pfeffern, optional mit Zitrone beträufeln; bei Pfanne: Hautseite zuerst 3–4 Min ohne Wenden.",
    "Wenden oder in den Ofen geben: Gesamtgarzeit oft nur 8–12 Min je nach Dicke (1 cm ≈ 3 Min).",
    "Kerntemperatur 58–62 °C oder Flakes brechen sich leicht — nicht überziehen (trocken).",
    "Beilage parallel fertigstellen; Fisch sofort mit Zitrone und Kräutern servieren."
  ]
}$g$::jsonb,
  1756,
  NULL,
  'Fischgericht'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Tintenfischringe gebraten');

-- Lachs-Tatar-Bowl
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Lachs-Tatar-Bowl',
  4,
  $g${
  "titel": "Lachs-Tatar-Bowl",
  "portionen": 4,
  "kategorie": "Fischgericht",
  "geschaetzte_kcal_gesamt": 1893,
  "zutaten": [
    {
      "name": "Lachsfilet",
      "menge": 600,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Zitrone",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Butter",
      "menge": 40,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Knoblauchzehen",
      "menge": 2,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Dill",
      "menge": 15,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Olivenöl",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Sahne",
      "menge": 100,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Kapern",
      "menge": 1,
      "einheit": "EL",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Fischfilet 20 Min vorher aus dem Kühlschrank, Hautseite trocken tupfen, Gräten mit Fingern prüfen.",
    "Pfanne oder Ofen vorbereiten: Pfanne auf Stufe 6–7, 1 EL Öl; Ofen 200 °C Umluft falls Ofengang.",
    "Fisch salzen und pfeffern, optional mit Zitrone beträufeln; bei Pfanne: Hautseite zuerst 3–4 Min ohne Wenden.",
    "Wenden oder in den Ofen geben: Gesamtgarzeit oft nur 8–12 Min je nach Dicke (1 cm ≈ 3 Min).",
    "Kerntemperatur 58–62 °C oder Flakes brechen sich leicht — nicht überziehen (trocken).",
    "Beilage parallel fertigstellen; Fisch sofort mit Zitrone und Kräutern servieren."
  ]
}$g$::jsonb,
  1893,
  NULL,
  'Fischgericht'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Lachs-Tatar-Bowl');

-- Fischsuppe bouillabaisse-artig
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Fischsuppe bouillabaisse-artig',
  4,
  $g${
  "titel": "Fischsuppe bouillabaisse-artig",
  "portionen": 4,
  "kategorie": "Fischgericht",
  "geschaetzte_kcal_gesamt": 1837,
  "zutaten": [
    {
      "name": "Fischfilet",
      "menge": 600,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Zitrone",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Butter",
      "menge": 40,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Knoblauchzehen",
      "menge": 2,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Dill",
      "menge": 15,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Olivenöl",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Sahne",
      "menge": 100,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Kapern",
      "menge": 1,
      "einheit": "EL",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Großen Topf (4–5 l) und Schöpfkelle bereitstellen; Gemüse waschen, Enden entfernen, in gleichmäßige Würfel schneiden.",
    "Topf auf Herdstufe 6 von 9 stellen, 2 EL Öl oder Butter erhitzen, Zwiebel und Knoblauch 4 Min glasig dünsten.",
    "Hartes Gemüse (Karotten, Sellerie, Kartoffeln) 5–6 Min mit anschwitzen, gelegentlich rühren, nicht bräunen.",
    "Brühe (ca. 1–1,2 l) angießen, mit einem Spritzer einmal aufkochen, dann Hitze auf Stufe 3–4 reduzieren.",
    "Fischsuppe bouillabaisse-artig: 20–30 Min leicht köcheln, bis alles weich ist; mit dem Löffel prüfen — keine harten Stücke.",
    "Optional mit Stabmixer pürieren: Mixer tief ins Flüssige tauchen, kurze Pulse, Spritzer vermeiden; oder grob lassen.",
    "Mit Salz, Pfeffer, Muskat oder frischen Kräutern abschmecken; Konsistenz mit Wasser oder Sahne anpassen.",
    "Bei Bedarf Einlage (Nudeln, Croutons, Sahnehaube) separat zubereiten und erst beim Servieren zugeben.",
    "Suppe in vorgewärmte Schalen füllen, heiß servieren; Rest im Topf auf Stufe 2 warm halten."
  ]
}$g$::jsonb,
  1837,
  NULL,
  'Fischgericht'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Fischsuppe bouillabaisse-artig');

-- Seelachs im Backteig
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Seelachs im Backteig',
  4,
  $g${
  "titel": "Seelachs im Backteig",
  "portionen": 4,
  "kategorie": "Fischgericht",
  "geschaetzte_kcal_gesamt": 1880,
  "zutaten": [
    {
      "name": "Lachsfilet",
      "menge": 600,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Zitrone",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Butter",
      "menge": 40,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Knoblauchzehen",
      "menge": 2,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Dill",
      "menge": 15,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Olivenöl",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Sahne",
      "menge": 100,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Kapern",
      "menge": 1,
      "einheit": "EL",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Fischfilet 20 Min vorher aus dem Kühlschrank, Hautseite trocken tupfen, Gräten mit Fingern prüfen.",
    "Pfanne oder Ofen vorbereiten: Pfanne auf Stufe 6–7, 1 EL Öl; Ofen 200 °C Umluft falls Ofengang.",
    "Fisch salzen und pfeffern, optional mit Zitrone beträufeln; bei Pfanne: Hautseite zuerst 3–4 Min ohne Wenden.",
    "Wenden oder in den Ofen geben: Gesamtgarzeit oft nur 8–12 Min je nach Dicke (1 cm ≈ 3 Min).",
    "Kerntemperatur 58–62 °C oder Flakes brechen sich leicht — nicht überziehen (trocken).",
    "Beilage parallel fertigstellen; Fisch sofort mit Zitrone und Kräutern servieren."
  ]
}$g$::jsonb,
  1880,
  NULL,
  'Fischgericht'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Seelachs im Backteig');

-- Garnele-Cocktail klassisch
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Garnele-Cocktail klassisch',
  4,
  $g${
  "titel": "Garnele-Cocktail klassisch",
  "portionen": 4,
  "kategorie": "Fischgericht",
  "geschaetzte_kcal_gesamt": 1754,
  "zutaten": [
    {
      "name": "Fischfilet",
      "menge": 600,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Zitrone",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Butter",
      "menge": 40,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Knoblauchzehen",
      "menge": 2,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Dill",
      "menge": 15,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Olivenöl",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Sahne",
      "menge": 100,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Kapern",
      "menge": 1,
      "einheit": "EL",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Fischfilet 20 Min vorher aus dem Kühlschrank, Hautseite trocken tupfen, Gräten mit Fingern prüfen.",
    "Pfanne oder Ofen vorbereiten: Pfanne auf Stufe 6–7, 1 EL Öl; Ofen 200 °C Umluft falls Ofengang.",
    "Fisch salzen und pfeffern, optional mit Zitrone beträufeln; bei Pfanne: Hautseite zuerst 3–4 Min ohne Wenden.",
    "Wenden oder in den Ofen geben: Gesamtgarzeit oft nur 8–12 Min je nach Dicke (1 cm ≈ 3 Min).",
    "Kerntemperatur 58–62 °C oder Flakes brechen sich leicht — nicht überziehen (trocken).",
    "Beilage parallel fertigstellen; Fisch sofort mit Zitrone und Kräutern servieren."
  ]
}$g$::jsonb,
  1754,
  NULL,
  'Fischgericht'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Garnele-Cocktail klassisch');

-- Hering in Sahne
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Hering in Sahne',
  4,
  $g${
  "titel": "Hering in Sahne",
  "portionen": 4,
  "kategorie": "Fischgericht",
  "geschaetzte_kcal_gesamt": 1779,
  "zutaten": [
    {
      "name": "Fischfilet",
      "menge": 600,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Zitrone",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Butter",
      "menge": 40,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Knoblauchzehen",
      "menge": 2,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Dill",
      "menge": 15,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Olivenöl",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Sahne",
      "menge": 100,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Kapern",
      "menge": 1,
      "einheit": "EL",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Fischfilet 20 Min vorher aus dem Kühlschrank, Hautseite trocken tupfen, Gräten mit Fingern prüfen.",
    "Pfanne oder Ofen vorbereiten: Pfanne auf Stufe 6–7, 1 EL Öl; Ofen 200 °C Umluft falls Ofengang.",
    "Fisch salzen und pfeffern, optional mit Zitrone beträufeln; bei Pfanne: Hautseite zuerst 3–4 Min ohne Wenden.",
    "Wenden oder in den Ofen geben: Gesamtgarzeit oft nur 8–12 Min je nach Dicke (1 cm ≈ 3 Min).",
    "Kerntemperatur 58–62 °C oder Flakes brechen sich leicht — nicht überziehen (trocken).",
    "Beilage parallel fertigstellen; Fisch sofort mit Zitrone und Kräutern servieren."
  ]
}$g$::jsonb,
  1779,
  NULL,
  'Fischgericht'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Hering in Sahne');

-- Fisch-Burger
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Fisch-Burger',
  4,
  $g${
  "titel": "Fisch-Burger",
  "portionen": 4,
  "kategorie": "Fischgericht",
  "geschaetzte_kcal_gesamt": 1953,
  "zutaten": [
    {
      "name": "Fischfilet",
      "menge": 600,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Zitrone",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Butter",
      "menge": 40,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Knoblauchzehen",
      "menge": 2,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Dill",
      "menge": 15,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Olivenöl",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Sahne",
      "menge": 100,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Kapern",
      "menge": 1,
      "einheit": "EL",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Fischfilet 20 Min vorher aus dem Kühlschrank, Hautseite trocken tupfen, Gräten mit Fingern prüfen.",
    "Pfanne oder Ofen vorbereiten: Pfanne auf Stufe 6–7, 1 EL Öl; Ofen 200 °C Umluft falls Ofengang.",
    "Fisch salzen und pfeffern, optional mit Zitrone beträufeln; bei Pfanne: Hautseite zuerst 3–4 Min ohne Wenden.",
    "Wenden oder in den Ofen geben: Gesamtgarzeit oft nur 8–12 Min je nach Dicke (1 cm ≈ 3 Min).",
    "Kerntemperatur 58–62 °C oder Flakes brechen sich leicht — nicht überziehen (trocken).",
    "Beilage parallel fertigstellen; Fisch sofort mit Zitrone und Kräutern servieren."
  ]
}$g$::jsonb,
  1953,
  NULL,
  'Fischgericht'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Fisch-Burger');

-- Lachs-Bowl mit Reis
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Lachs-Bowl mit Reis',
  4,
  $g${
  "titel": "Lachs-Bowl mit Reis",
  "portionen": 4,
  "kategorie": "Fischgericht",
  "geschaetzte_kcal_gesamt": 1737,
  "zutaten": [
    {
      "name": "Lachsfilet",
      "menge": 600,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Zitrone",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Butter",
      "menge": 40,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Knoblauchzehen",
      "menge": 2,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Dill",
      "menge": 15,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Olivenöl",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Sahne",
      "menge": 100,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Kapern",
      "menge": 1,
      "einheit": "EL",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Fischfilet 20 Min vorher aus dem Kühlschrank, Hautseite trocken tupfen, Gräten mit Fingern prüfen.",
    "Pfanne oder Ofen vorbereiten: Pfanne auf Stufe 6–7, 1 EL Öl; Ofen 200 °C Umluft falls Ofengang.",
    "Fisch salzen und pfeffern, optional mit Zitrone beträufeln; bei Pfanne: Hautseite zuerst 3–4 Min ohne Wenden.",
    "Wenden oder in den Ofen geben: Gesamtgarzeit oft nur 8–12 Min je nach Dicke (1 cm ≈ 3 Min).",
    "Kerntemperatur 58–62 °C oder Flakes brechen sich leicht — nicht überziehen (trocken).",
    "Beilage parallel fertigstellen; Fisch sofort mit Zitrone und Kräutern servieren."
  ]
}$g$::jsonb,
  1737,
  NULL,
  'Fischgericht'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Lachs-Bowl mit Reis');

-- Krabben-Pasta
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Krabben-Pasta',
  4,
  $g${
  "titel": "Krabben-Pasta",
  "portionen": 4,
  "kategorie": "Fischgericht",
  "geschaetzte_kcal_gesamt": 1643,
  "zutaten": [
    {
      "name": "Garnelen",
      "menge": 400,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Zitrone",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Butter",
      "menge": 40,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Knoblauchzehen",
      "menge": 2,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Dill",
      "menge": 15,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Olivenöl",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Sahne",
      "menge": 100,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Kapern",
      "menge": 1,
      "einheit": "EL",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Fischfilet 20 Min vorher aus dem Kühlschrank, Hautseite trocken tupfen, Gräten mit Fingern prüfen.",
    "Pfanne oder Ofen vorbereiten: Pfanne auf Stufe 6–7, 1 EL Öl; Ofen 200 °C Umluft falls Ofengang.",
    "Fisch salzen und pfeffern, optional mit Zitrone beträufeln; bei Pfanne: Hautseite zuerst 3–4 Min ohne Wenden.",
    "Wenden oder in den Ofen geben: Gesamtgarzeit oft nur 8–12 Min je nach Dicke (1 cm ≈ 3 Min).",
    "Kerntemperatur 58–62 °C oder Flakes brechen sich leicht — nicht überziehen (trocken).",
    "Beilage parallel fertigstellen; Fisch sofort mit Zitrone und Kräutern servieren."
  ]
}$g$::jsonb,
  1643,
  NULL,
  'Fischgericht'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Krabben-Pasta');

-- Dorsch mit Remoulade
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Dorsch mit Remoulade',
  4,
  $g${
  "titel": "Dorsch mit Remoulade",
  "portionen": 4,
  "kategorie": "Fischgericht",
  "geschaetzte_kcal_gesamt": 1931,
  "zutaten": [
    {
      "name": "Kabeljaufilet",
      "menge": 600,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Zitrone",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Butter",
      "menge": 40,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Knoblauchzehen",
      "menge": 2,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Dill",
      "menge": 15,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Olivenöl",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Sahne",
      "menge": 100,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Kapern",
      "menge": 1,
      "einheit": "EL",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Fischfilet 20 Min vorher aus dem Kühlschrank, Hautseite trocken tupfen, Gräten mit Fingern prüfen.",
    "Pfanne oder Ofen vorbereiten: Pfanne auf Stufe 6–7, 1 EL Öl; Ofen 200 °C Umluft falls Ofengang.",
    "Fisch salzen und pfeffern, optional mit Zitrone beträufeln; bei Pfanne: Hautseite zuerst 3–4 Min ohne Wenden.",
    "Wenden oder in den Ofen geben: Gesamtgarzeit oft nur 8–12 Min je nach Dicke (1 cm ≈ 3 Min).",
    "Kerntemperatur 58–62 °C oder Flakes brechen sich leicht — nicht überziehen (trocken).",
    "Beilage parallel fertigstellen; Fisch sofort mit Zitrone und Kräutern servieren."
  ]
}$g$::jsonb,
  1931,
  NULL,
  'Fischgericht'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Dorsch mit Remoulade');

-- Fisch-Frikadellen
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Fisch-Frikadellen',
  4,
  $g${
  "titel": "Fisch-Frikadellen",
  "portionen": 4,
  "kategorie": "Fischgericht",
  "geschaetzte_kcal_gesamt": 1659,
  "zutaten": [
    {
      "name": "Fischfilet",
      "menge": 600,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Zitrone",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Butter",
      "menge": 40,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Knoblauchzehen",
      "menge": 2,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Dill",
      "menge": 15,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Olivenöl",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Sahne",
      "menge": 100,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Kapern",
      "menge": 1,
      "einheit": "EL",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Fischfilet 20 Min vorher aus dem Kühlschrank, Hautseite trocken tupfen, Gräten mit Fingern prüfen.",
    "Pfanne oder Ofen vorbereiten: Pfanne auf Stufe 6–7, 1 EL Öl; Ofen 200 °C Umluft falls Ofengang.",
    "Fisch salzen und pfeffern, optional mit Zitrone beträufeln; bei Pfanne: Hautseite zuerst 3–4 Min ohne Wenden.",
    "Wenden oder in den Ofen geben: Gesamtgarzeit oft nur 8–12 Min je nach Dicke (1 cm ≈ 3 Min).",
    "Kerntemperatur 58–62 °C oder Flakes brechen sich leicht — nicht überziehen (trocken).",
    "Beilage parallel fertigstellen; Fisch sofort mit Zitrone und Kräutern servieren."
  ]
}$g$::jsonb,
  1659,
  NULL,
  'Fischgericht'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Fisch-Frikadellen');

-- Lachs-Gravlax-Style
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Lachs-Gravlax-Style',
  4,
  $g${
  "titel": "Lachs-Gravlax-Style",
  "portionen": 4,
  "kategorie": "Fischgericht",
  "geschaetzte_kcal_gesamt": 1835,
  "zutaten": [
    {
      "name": "Lachsfilet",
      "menge": 600,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Zitrone",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Butter",
      "menge": 40,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Knoblauchzehen",
      "menge": 2,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Dill",
      "menge": 15,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Olivenöl",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Sahne",
      "menge": 100,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Kapern",
      "menge": 1,
      "einheit": "EL",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Fischfilet 20 Min vorher aus dem Kühlschrank, Hautseite trocken tupfen, Gräten mit Fingern prüfen.",
    "Pfanne oder Ofen vorbereiten: Pfanne auf Stufe 6–7, 1 EL Öl; Ofen 200 °C Umluft falls Ofengang.",
    "Fisch salzen und pfeffern, optional mit Zitrone beträufeln; bei Pfanne: Hautseite zuerst 3–4 Min ohne Wenden.",
    "Wenden oder in den Ofen geben: Gesamtgarzeit oft nur 8–12 Min je nach Dicke (1 cm ≈ 3 Min).",
    "Kerntemperatur 58–62 °C oder Flakes brechen sich leicht — nicht überziehen (trocken).",
    "Beilage parallel fertigstellen; Fisch sofort mit Zitrone und Kräutern servieren."
  ]
}$g$::jsonb,
  1835,
  NULL,
  'Fischgericht'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Lachs-Gravlax-Style');

-- Muscheln in Weißwein
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Muscheln in Weißwein',
  4,
  $g${
  "titel": "Muscheln in Weißwein",
  "portionen": 4,
  "kategorie": "Fischgericht",
  "geschaetzte_kcal_gesamt": 1661,
  "zutaten": [
    {
      "name": "Fischfilet",
      "menge": 600,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Zitrone",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Butter",
      "menge": 40,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Knoblauchzehen",
      "menge": 2,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Dill",
      "menge": 15,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Olivenöl",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Sahne",
      "menge": 100,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Kapern",
      "menge": 1,
      "einheit": "EL",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Fischfilet 20 Min vorher aus dem Kühlschrank, Hautseite trocken tupfen, Gräten mit Fingern prüfen.",
    "Pfanne oder Ofen vorbereiten: Pfanne auf Stufe 6–7, 1 EL Öl; Ofen 200 °C Umluft falls Ofengang.",
    "Fisch salzen und pfeffern, optional mit Zitrone beträufeln; bei Pfanne: Hautseite zuerst 3–4 Min ohne Wenden.",
    "Wenden oder in den Ofen geben: Gesamtgarzeit oft nur 8–12 Min je nach Dicke (1 cm ≈ 3 Min).",
    "Kerntemperatur 58–62 °C oder Flakes brechen sich leicht — nicht überziehen (trocken).",
    "Beilage parallel fertigstellen; Fisch sofort mit Zitrone und Kräutern servieren."
  ]
}$g$::jsonb,
  1661,
  NULL,
  'Fischgericht'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Muscheln in Weißwein');

-- Fisch auf mediterranem Gemüse
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Fisch auf mediterranem Gemüse',
  4,
  $g${
  "titel": "Fisch auf mediterranem Gemüse",
  "portionen": 4,
  "kategorie": "Fischgericht",
  "geschaetzte_kcal_gesamt": 1731,
  "zutaten": [
    {
      "name": "Fischfilet",
      "menge": 600,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Zitrone",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Butter",
      "menge": 40,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Knoblauchzehen",
      "menge": 2,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Dill",
      "menge": 15,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Olivenöl",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Sahne",
      "menge": 100,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Kapern",
      "menge": 1,
      "einheit": "EL",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Fischfilet 20 Min vorher aus dem Kühlschrank, Hautseite trocken tupfen, Gräten mit Fingern prüfen.",
    "Pfanne oder Ofen vorbereiten: Pfanne auf Stufe 6–7, 1 EL Öl; Ofen 200 °C Umluft falls Ofengang.",
    "Fisch salzen und pfeffern, optional mit Zitrone beträufeln; bei Pfanne: Hautseite zuerst 3–4 Min ohne Wenden.",
    "Wenden oder in den Ofen geben: Gesamtgarzeit oft nur 8–12 Min je nach Dicke (1 cm ≈ 3 Min).",
    "Kerntemperatur 58–62 °C oder Flakes brechen sich leicht — nicht überziehen (trocken).",
    "Beilage parallel fertigstellen; Fisch sofort mit Zitrone und Kräutern servieren."
  ]
}$g$::jsonb,
  1731,
  NULL,
  'Fischgericht'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Fisch auf mediterranem Gemüse');

-- Thunfisch-Pasta
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Thunfisch-Pasta',
  4,
  $g${
  "titel": "Thunfisch-Pasta",
  "portionen": 4,
  "kategorie": "Fischgericht",
  "geschaetzte_kcal_gesamt": 1890,
  "zutaten": [
    {
      "name": "Thunfischsteak",
      "menge": 600,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Zitrone",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Butter",
      "menge": 40,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Knoblauchzehen",
      "menge": 2,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Dill",
      "menge": 15,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Olivenöl",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Sahne",
      "menge": 100,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Kapern",
      "menge": 1,
      "einheit": "EL",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Fischfilet 20 Min vorher aus dem Kühlschrank, Hautseite trocken tupfen, Gräten mit Fingern prüfen.",
    "Pfanne oder Ofen vorbereiten: Pfanne auf Stufe 6–7, 1 EL Öl; Ofen 200 °C Umluft falls Ofengang.",
    "Fisch salzen und pfeffern, optional mit Zitrone beträufeln; bei Pfanne: Hautseite zuerst 3–4 Min ohne Wenden.",
    "Wenden oder in den Ofen geben: Gesamtgarzeit oft nur 8–12 Min je nach Dicke (1 cm ≈ 3 Min).",
    "Kerntemperatur 58–62 °C oder Flakes brechen sich leicht — nicht überziehen (trocken).",
    "Beilage parallel fertigstellen; Fisch sofort mit Zitrone und Kräutern servieren."
  ]
}$g$::jsonb,
  1890,
  NULL,
  'Fischgericht'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Thunfisch-Pasta');

-- Gebackener Scholle
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Gebackener Scholle',
  4,
  $g${
  "titel": "Gebackener Scholle",
  "portionen": 4,
  "kategorie": "Fischgericht",
  "geschaetzte_kcal_gesamt": 1745,
  "zutaten": [
    {
      "name": "Fischfilet",
      "menge": 600,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Zitrone",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Butter",
      "menge": 40,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Knoblauchzehen",
      "menge": 2,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Dill",
      "menge": 15,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Olivenöl",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Sahne",
      "menge": 100,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Kapern",
      "menge": 1,
      "einheit": "EL",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Fischfilet 20 Min vorher aus dem Kühlschrank, Hautseite trocken tupfen, Gräten mit Fingern prüfen.",
    "Pfanne oder Ofen vorbereiten: Pfanne auf Stufe 6–7, 1 EL Öl; Ofen 200 °C Umluft falls Ofengang.",
    "Fisch salzen und pfeffern, optional mit Zitrone beträufeln; bei Pfanne: Hautseite zuerst 3–4 Min ohne Wenden.",
    "Wenden oder in den Ofen geben: Gesamtgarzeit oft nur 8–12 Min je nach Dicke (1 cm ≈ 3 Min).",
    "Kerntemperatur 58–62 °C oder Flakes brechen sich leicht — nicht überziehen (trocken).",
    "Beilage parallel fertigstellen; Fisch sofort mit Zitrone und Kräutern servieren."
  ]
}$g$::jsonb,
  1745,
  NULL,
  'Fischgericht'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Gebackener Scholle');

-- Fisch-Spieße vom Grill
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Fisch-Spieße vom Grill',
  4,
  $g${
  "titel": "Fisch-Spieße vom Grill",
  "portionen": 4,
  "kategorie": "Fischgericht",
  "geschaetzte_kcal_gesamt": 1771,
  "zutaten": [
    {
      "name": "Fischfilet",
      "menge": 600,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Zitrone",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Butter",
      "menge": 40,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Knoblauchzehen",
      "menge": 2,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Dill",
      "menge": 15,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Olivenöl",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Sahne",
      "menge": 100,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Kapern",
      "menge": 1,
      "einheit": "EL",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Fischfilet 20 Min vorher aus dem Kühlschrank, Hautseite trocken tupfen, Gräten mit Fingern prüfen.",
    "Pfanne oder Ofen vorbereiten: Pfanne auf Stufe 6–7, 1 EL Öl; Ofen 200 °C Umluft falls Ofengang.",
    "Fisch salzen und pfeffern, optional mit Zitrone beträufeln; bei Pfanne: Hautseite zuerst 3–4 Min ohne Wenden.",
    "Wenden oder in den Ofen geben: Gesamtgarzeit oft nur 8–12 Min je nach Dicke (1 cm ≈ 3 Min).",
    "Kerntemperatur 58–62 °C oder Flakes brechen sich leicht — nicht überziehen (trocken).",
    "Beilage parallel fertigstellen; Fisch sofort mit Zitrone und Kräutern servieren."
  ]
}$g$::jsonb,
  1771,
  NULL,
  'Fischgericht'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Fisch-Spieße vom Grill');

-- Kartoffelsuppe
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Kartoffelsuppe',
  4,
  $g${
  "titel": "Kartoffelsuppe",
  "portionen": 4,
  "kategorie": "Suppe / Eintopf",
  "geschaetzte_kcal_gesamt": 1483,
  "zutaten": [
    {
      "name": "Kartoffeln",
      "menge": 800,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 2,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Gemüsebrühe",
      "menge": 1000,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Sahne",
      "menge": 150,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Muskatnuss",
      "menge": 0.5,
      "einheit": "TL",
      "aus_lager": false
    },
    {
      "name": "Lorbeerblatt",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Butter",
      "menge": 30,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Schnittlauch",
      "menge": 20,
      "einheit": "g",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Großen Topf (4–5 l) und Schöpfkelle bereitstellen; Gemüse waschen, Enden entfernen, in gleichmäßige Würfel schneiden.",
    "Topf auf Herdstufe 6 von 9 stellen, 2 EL Öl oder Butter erhitzen, Zwiebel und Knoblauch 4 Min glasig dünsten.",
    "Hartes Gemüse (Karotten, Sellerie, Kartoffeln) 5–6 Min mit anschwitzen, gelegentlich rühren, nicht bräunen.",
    "Brühe (ca. 1–1,2 l) angießen, mit einem Spritzer einmal aufkochen, dann Hitze auf Stufe 3–4 reduzieren.",
    "Kartoffelsuppe: 20–30 Min leicht köcheln, bis alles weich ist; mit dem Löffel prüfen — keine harten Stücke.",
    "Optional mit Stabmixer pürieren: Mixer tief ins Flüssige tauchen, kurze Pulse, Spritzer vermeiden; oder grob lassen.",
    "Mit Salz, Pfeffer, Muskat oder frischen Kräutern abschmecken; Konsistenz mit Wasser oder Sahne anpassen.",
    "Bei Bedarf Einlage (Nudeln, Croutons, Sahnehaube) separat zubereiten und erst beim Servieren zugeben.",
    "Suppe in vorgewärmte Schalen füllen, heiß servieren; Rest im Topf auf Stufe 2 warm halten."
  ]
}$g$::jsonb,
  1483,
  NULL,
  'Suppe / Eintopf'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Kartoffelsuppe');

-- Erbseneintopf
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Erbseneintopf',
  4,
  $g${
  "titel": "Erbseneintopf",
  "portionen": 4,
  "kategorie": "Suppe / Eintopf",
  "geschaetzte_kcal_gesamt": 1364,
  "zutaten": [
    {
      "name": "Gemüsebrühe",
      "menge": 1200,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Möhren",
      "menge": 200,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Sellerie",
      "menge": 100,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Lorbeerblatt",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Rote Linsen oder Erbsen",
      "menge": 250,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Sahne optional",
      "menge": 100,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Olivenöl",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Schweren Bräter oder großen Topf (5 l) bereitstellen; Fleisch oder Hülsenfrüchte trocken tupfen, Gemüse würfeln.",
    "Bräter auf Herdstufe 7 erhitzen, 2 EL Öl, Fleisch in Portionen scharf anbraten (nicht überfüllen), herausnehmen.",
    "Zwiebeln und Wurzelgemüse im Bratensatz 5 Min anschwitzen, mit Tomatenmark 1 Min mitrösten.",
    "Fleisch zurück, Flüssigkeit (Brühe, Bier, Wein) angießen, Lorbeer und Gewürze zugeben, aufkochen.",
    "Hitze auf Stufe 2–3, Deckel leicht an, 60–90 Min köcheln — Fleisch soll mit der Gabel zerfallen.",
    "Kartoffeln oder Kohl ggf. in der letzten halben Stunde zugeben, nicht zu früh (sonst matschig).",
    "Eintopf abschmecken (Salz, Pfeffer, Essig), 10 Min ruhen lassen, damit sich Aromen setzen.",
    "In tiefen Tellern servieren, mit frischem Brot; Rest am nächsten Tag schmeckt oft besser."
  ]
}$g$::jsonb,
  1364,
  NULL,
  'Suppe / Eintopf'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Erbseneintopf');

-- Linsensuppe
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Linsensuppe',
  4,
  $g${
  "titel": "Linsensuppe",
  "portionen": 4,
  "kategorie": "Suppe / Eintopf",
  "geschaetzte_kcal_gesamt": 1574,
  "zutaten": [
    {
      "name": "Gemüsebrühe",
      "menge": 1200,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Möhren",
      "menge": 200,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Sellerie",
      "menge": 100,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Lorbeerblatt",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Rote Linsen oder Erbsen",
      "menge": 250,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Sahne optional",
      "menge": 100,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Olivenöl",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Großen Topf (4–5 l) und Schöpfkelle bereitstellen; Gemüse waschen, Enden entfernen, in gleichmäßige Würfel schneiden.",
    "Topf auf Herdstufe 6 von 9 stellen, 2 EL Öl oder Butter erhitzen, Zwiebel und Knoblauch 4 Min glasig dünsten.",
    "Hartes Gemüse (Karotten, Sellerie, Kartoffeln) 5–6 Min mit anschwitzen, gelegentlich rühren, nicht bräunen.",
    "Brühe (ca. 1–1,2 l) angießen, mit einem Spritzer einmal aufkochen, dann Hitze auf Stufe 3–4 reduzieren.",
    "Linsensuppe: 20–30 Min leicht köcheln, bis alles weich ist; mit dem Löffel prüfen — keine harten Stücke.",
    "Optional mit Stabmixer pürieren: Mixer tief ins Flüssige tauchen, kurze Pulse, Spritzer vermeiden; oder grob lassen.",
    "Mit Salz, Pfeffer, Muskat oder frischen Kräutern abschmecken; Konsistenz mit Wasser oder Sahne anpassen.",
    "Bei Bedarf Einlage (Nudeln, Croutons, Sahnehaube) separat zubereiten und erst beim Servieren zugeben.",
    "Suppe in vorgewärmte Schalen füllen, heiß servieren; Rest im Topf auf Stufe 2 warm halten."
  ]
}$g$::jsonb,
  1574,
  NULL,
  'Suppe / Eintopf'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Linsensuppe');

-- Gulaschsuppe
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Gulaschsuppe',
  4,
  $g${
  "titel": "Gulaschsuppe",
  "portionen": 4,
  "kategorie": "Suppe / Eintopf",
  "geschaetzte_kcal_gesamt": 1268,
  "zutaten": [
    {
      "name": "Gemüsebrühe",
      "menge": 1200,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Möhren",
      "menge": 200,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Sellerie",
      "menge": 100,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Lorbeerblatt",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Rindfleisch",
      "menge": 500,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Paprikapulver edelsüß",
      "menge": 2,
      "einheit": "TL",
      "aus_lager": false
    },
    {
      "name": "Sahne optional",
      "menge": 100,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Olivenöl",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Schweren Bräter oder großen Topf (5 l) bereitstellen; Fleisch oder Hülsenfrüchte trocken tupfen, Gemüse würfeln.",
    "Bräter auf Herdstufe 7 erhitzen, 2 EL Öl, Fleisch in Portionen scharf anbraten (nicht überfüllen), herausnehmen.",
    "Zwiebeln und Wurzelgemüse im Bratensatz 5 Min anschwitzen, mit Tomatenmark 1 Min mitrösten.",
    "Fleisch zurück, Flüssigkeit (Brühe, Bier, Wein) angießen, Lorbeer und Gewürze zugeben, aufkochen.",
    "Hitze auf Stufe 2–3, Deckel leicht an, 60–90 Min köcheln — Fleisch soll mit der Gabel zerfallen.",
    "Kartoffeln oder Kohl ggf. in der letzten halben Stunde zugeben, nicht zu früh (sonst matschig).",
    "Eintopf abschmecken (Salz, Pfeffer, Essig), 10 Min ruhen lassen, damit sich Aromen setzen.",
    "In tiefen Tellern servieren, mit frischem Brot; Rest am nächsten Tag schmeckt oft besser."
  ]
}$g$::jsonb,
  1268,
  NULL,
  'Suppe / Eintopf'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Gulaschsuppe');

-- Minestrone
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Minestrone',
  4,
  $g${
  "titel": "Minestrone",
  "portionen": 4,
  "kategorie": "Suppe / Eintopf",
  "geschaetzte_kcal_gesamt": 1460,
  "zutaten": [
    {
      "name": "Gemüsebrühe",
      "menge": 1200,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Möhren",
      "menge": 200,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Sellerie",
      "menge": 100,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Lorbeerblatt",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Sahne optional",
      "menge": 100,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Olivenöl",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Großen Topf (4–5 l) und Schöpfkelle bereitstellen; Gemüse waschen, Enden entfernen, in gleichmäßige Würfel schneiden.",
    "Topf auf Herdstufe 6 von 9 stellen, 2 EL Öl oder Butter erhitzen, Zwiebel und Knoblauch 4 Min glasig dünsten.",
    "Hartes Gemüse (Karotten, Sellerie, Kartoffeln) 5–6 Min mit anschwitzen, gelegentlich rühren, nicht bräunen.",
    "Brühe (ca. 1–1,2 l) angießen, mit einem Spritzer einmal aufkochen, dann Hitze auf Stufe 3–4 reduzieren.",
    "Minestrone: 20–30 Min leicht köcheln, bis alles weich ist; mit dem Löffel prüfen — keine harten Stücke.",
    "Optional mit Stabmixer pürieren: Mixer tief ins Flüssige tauchen, kurze Pulse, Spritzer vermeiden; oder grob lassen.",
    "Mit Salz, Pfeffer, Muskat oder frischen Kräutern abschmecken; Konsistenz mit Wasser oder Sahne anpassen.",
    "Bei Bedarf Einlage (Nudeln, Croutons, Sahnehaube) separat zubereiten und erst beim Servieren zugeben.",
    "Suppe in vorgewärmte Schalen füllen, heiß servieren; Rest im Topf auf Stufe 2 warm halten."
  ]
}$g$::jsonb,
  1460,
  NULL,
  'Suppe / Eintopf'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Minestrone');

-- Französische Zwiebelsuppe
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Französische Zwiebelsuppe',
  4,
  $g${
  "titel": "Französische Zwiebelsuppe",
  "portionen": 4,
  "kategorie": "Suppe / Eintopf",
  "geschaetzte_kcal_gesamt": 1509,
  "zutaten": [
    {
      "name": "Gemüsebrühe",
      "menge": 1200,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Möhren",
      "menge": 200,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Sellerie",
      "menge": 100,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Lorbeerblatt",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Sahne optional",
      "menge": 100,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Olivenöl",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Großen Topf (4–5 l) und Schöpfkelle bereitstellen; Gemüse waschen, Enden entfernen, in gleichmäßige Würfel schneiden.",
    "Topf auf Herdstufe 6 von 9 stellen, 2 EL Öl oder Butter erhitzen, Zwiebel und Knoblauch 4 Min glasig dünsten.",
    "Hartes Gemüse (Karotten, Sellerie, Kartoffeln) 5–6 Min mit anschwitzen, gelegentlich rühren, nicht bräunen.",
    "Brühe (ca. 1–1,2 l) angießen, mit einem Spritzer einmal aufkochen, dann Hitze auf Stufe 3–4 reduzieren.",
    "Französische Zwiebelsuppe: 20–30 Min leicht köcheln, bis alles weich ist; mit dem Löffel prüfen — keine harten Stücke.",
    "Optional mit Stabmixer pürieren: Mixer tief ins Flüssige tauchen, kurze Pulse, Spritzer vermeiden; oder grob lassen.",
    "Mit Salz, Pfeffer, Muskat oder frischen Kräutern abschmecken; Konsistenz mit Wasser oder Sahne anpassen.",
    "Bei Bedarf Einlage (Nudeln, Croutons, Sahnehaube) separat zubereiten und erst beim Servieren zugeben.",
    "Suppe in vorgewärmte Schalen füllen, heiß servieren; Rest im Topf auf Stufe 2 warm halten."
  ]
}$g$::jsonb,
  1509,
  NULL,
  'Suppe / Eintopf'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Französische Zwiebelsuppe');

-- Tom-Kha-Suppe
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Tom-Kha-Suppe',
  4,
  $g${
  "titel": "Tom-Kha-Suppe",
  "portionen": 4,
  "kategorie": "Suppe / Eintopf",
  "geschaetzte_kcal_gesamt": 1595,
  "zutaten": [
    {
      "name": "Gemüsebrühe",
      "menge": 1200,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Möhren",
      "menge": 200,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Sellerie",
      "menge": 100,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Lorbeerblatt",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Sahne optional",
      "menge": 100,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Olivenöl",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Großen Topf (4–5 l) und Schöpfkelle bereitstellen; Gemüse waschen, Enden entfernen, in gleichmäßige Würfel schneiden.",
    "Topf auf Herdstufe 6 von 9 stellen, 2 EL Öl oder Butter erhitzen, Zwiebel und Knoblauch 4 Min glasig dünsten.",
    "Hartes Gemüse (Karotten, Sellerie, Kartoffeln) 5–6 Min mit anschwitzen, gelegentlich rühren, nicht bräunen.",
    "Brühe (ca. 1–1,2 l) angießen, mit einem Spritzer einmal aufkochen, dann Hitze auf Stufe 3–4 reduzieren.",
    "Tom-Kha-Suppe: 20–30 Min leicht köcheln, bis alles weich ist; mit dem Löffel prüfen — keine harten Stücke.",
    "Optional mit Stabmixer pürieren: Mixer tief ins Flüssige tauchen, kurze Pulse, Spritzer vermeiden; oder grob lassen.",
    "Mit Salz, Pfeffer, Muskat oder frischen Kräutern abschmecken; Konsistenz mit Wasser oder Sahne anpassen.",
    "Bei Bedarf Einlage (Nudeln, Croutons, Sahnehaube) separat zubereiten und erst beim Servieren zugeben.",
    "Suppe in vorgewärmte Schalen füllen, heiß servieren; Rest im Topf auf Stufe 2 warm halten."
  ]
}$g$::jsonb,
  1595,
  NULL,
  'Suppe / Eintopf'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Tom-Kha-Suppe');

-- Pho Bo
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Pho Bo',
  4,
  $g${
  "titel": "Pho Bo",
  "portionen": 4,
  "kategorie": "Suppe / Eintopf",
  "geschaetzte_kcal_gesamt": 1304,
  "zutaten": [
    {
      "name": "Gemüsebrühe",
      "menge": 1200,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Möhren",
      "menge": 200,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Sellerie",
      "menge": 100,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Lorbeerblatt",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Sahne optional",
      "menge": 100,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Olivenöl",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Großen Topf (4–5 l) und Schöpfkelle bereitstellen; Gemüse waschen, Enden entfernen, in gleichmäßige Würfel schneiden.",
    "Topf auf Herdstufe 6 von 9 stellen, 2 EL Öl oder Butter erhitzen, Zwiebel und Knoblauch 4 Min glasig dünsten.",
    "Hartes Gemüse (Karotten, Sellerie, Kartoffeln) 5–6 Min mit anschwitzen, gelegentlich rühren, nicht bräunen.",
    "Brühe (ca. 1–1,2 l) angießen, mit einem Spritzer einmal aufkochen, dann Hitze auf Stufe 3–4 reduzieren.",
    "Pho Bo: 20–30 Min leicht köcheln, bis alles weich ist; mit dem Löffel prüfen — keine harten Stücke.",
    "Optional mit Stabmixer pürieren: Mixer tief ins Flüssige tauchen, kurze Pulse, Spritzer vermeiden; oder grob lassen.",
    "Mit Salz, Pfeffer, Muskat oder frischen Kräutern abschmecken; Konsistenz mit Wasser oder Sahne anpassen.",
    "Bei Bedarf Einlage (Nudeln, Croutons, Sahnehaube) separat zubereiten und erst beim Servieren zugeben.",
    "Suppe in vorgewärmte Schalen füllen, heiß servieren; Rest im Topf auf Stufe 2 warm halten."
  ]
}$g$::jsonb,
  1304,
  NULL,
  'Suppe / Eintopf'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Pho Bo');

-- Bohneneintopf
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Bohneneintopf',
  4,
  $g${
  "titel": "Bohneneintopf",
  "portionen": 4,
  "kategorie": "Suppe / Eintopf",
  "geschaetzte_kcal_gesamt": 1359,
  "zutaten": [
    {
      "name": "Gemüsebrühe",
      "menge": 1200,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Möhren",
      "menge": 200,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Sellerie",
      "menge": 100,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Lorbeerblatt",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Sahne optional",
      "menge": 100,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Olivenöl",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Schweren Bräter oder großen Topf (5 l) bereitstellen; Fleisch oder Hülsenfrüchte trocken tupfen, Gemüse würfeln.",
    "Bräter auf Herdstufe 7 erhitzen, 2 EL Öl, Fleisch in Portionen scharf anbraten (nicht überfüllen), herausnehmen.",
    "Zwiebeln und Wurzelgemüse im Bratensatz 5 Min anschwitzen, mit Tomatenmark 1 Min mitrösten.",
    "Fleisch zurück, Flüssigkeit (Brühe, Bier, Wein) angießen, Lorbeer und Gewürze zugeben, aufkochen.",
    "Hitze auf Stufe 2–3, Deckel leicht an, 60–90 Min köcheln — Fleisch soll mit der Gabel zerfallen.",
    "Kartoffeln oder Kohl ggf. in der letzten halben Stunde zugeben, nicht zu früh (sonst matschig).",
    "Eintopf abschmecken (Salz, Pfeffer, Essig), 10 Min ruhen lassen, damit sich Aromen setzen.",
    "In tiefen Tellern servieren, mit frischem Brot; Rest am nächsten Tag schmeckt oft besser."
  ]
}$g$::jsonb,
  1359,
  NULL,
  'Suppe / Eintopf'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Bohneneintopf');

-- Kohleintopf
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Kohleintopf',
  4,
  $g${
  "titel": "Kohleintopf",
  "portionen": 4,
  "kategorie": "Suppe / Eintopf",
  "geschaetzte_kcal_gesamt": 1555,
  "zutaten": [
    {
      "name": "Gemüsebrühe",
      "menge": 1200,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Möhren",
      "menge": 200,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Sellerie",
      "menge": 100,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Lorbeerblatt",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Sahne optional",
      "menge": 100,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Olivenöl",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Schweren Bräter oder großen Topf (5 l) bereitstellen; Fleisch oder Hülsenfrüchte trocken tupfen, Gemüse würfeln.",
    "Bräter auf Herdstufe 7 erhitzen, 2 EL Öl, Fleisch in Portionen scharf anbraten (nicht überfüllen), herausnehmen.",
    "Zwiebeln und Wurzelgemüse im Bratensatz 5 Min anschwitzen, mit Tomatenmark 1 Min mitrösten.",
    "Fleisch zurück, Flüssigkeit (Brühe, Bier, Wein) angießen, Lorbeer und Gewürze zugeben, aufkochen.",
    "Hitze auf Stufe 2–3, Deckel leicht an, 60–90 Min köcheln — Fleisch soll mit der Gabel zerfallen.",
    "Kartoffeln oder Kohl ggf. in der letzten halben Stunde zugeben, nicht zu früh (sonst matschig).",
    "Eintopf abschmecken (Salz, Pfeffer, Essig), 10 Min ruhen lassen, damit sich Aromen setzen.",
    "In tiefen Tellern servieren, mit frischem Brot; Rest am nächsten Tag schmeckt oft besser."
  ]
}$g$::jsonb,
  1555,
  NULL,
  'Suppe / Eintopf'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Kohleintopf');

-- Hühnersuppe mit Einlage
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Hühnersuppe mit Einlage',
  4,
  $g${
  "titel": "Hühnersuppe mit Einlage",
  "portionen": 4,
  "kategorie": "Suppe / Eintopf",
  "geschaetzte_kcal_gesamt": 1597,
  "zutaten": [
    {
      "name": "Gemüsebrühe",
      "menge": 1200,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Möhren",
      "menge": 200,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Sellerie",
      "menge": 100,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Lorbeerblatt",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Sahne optional",
      "menge": 100,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Olivenöl",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Großen Topf (4–5 l) und Schöpfkelle bereitstellen; Gemüse waschen, Enden entfernen, in gleichmäßige Würfel schneiden.",
    "Topf auf Herdstufe 6 von 9 stellen, 2 EL Öl oder Butter erhitzen, Zwiebel und Knoblauch 4 Min glasig dünsten.",
    "Hartes Gemüse (Karotten, Sellerie, Kartoffeln) 5–6 Min mit anschwitzen, gelegentlich rühren, nicht bräunen.",
    "Brühe (ca. 1–1,2 l) angießen, mit einem Spritzer einmal aufkochen, dann Hitze auf Stufe 3–4 reduzieren.",
    "Hühnersuppe mit Einlage: 20–30 Min leicht köcheln, bis alles weich ist; mit dem Löffel prüfen — keine harten Stücke.",
    "Optional mit Stabmixer pürieren: Mixer tief ins Flüssige tauchen, kurze Pulse, Spritzer vermeiden; oder grob lassen.",
    "Mit Salz, Pfeffer, Muskat oder frischen Kräutern abschmecken; Konsistenz mit Wasser oder Sahne anpassen.",
    "Bei Bedarf Einlage (Nudeln, Croutons, Sahnehaube) separat zubereiten und erst beim Servieren zugeben.",
    "Suppe in vorgewärmte Schalen füllen, heiß servieren; Rest im Topf auf Stufe 2 warm halten."
  ]
}$g$::jsonb,
  1597,
  NULL,
  'Suppe / Eintopf'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Hühnersuppe mit Einlage');

-- Brokkolicremesuppe
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Brokkolicremesuppe',
  4,
  $g${
  "titel": "Brokkolicremesuppe",
  "portionen": 4,
  "kategorie": "Suppe / Eintopf",
  "geschaetzte_kcal_gesamt": 1510,
  "zutaten": [
    {
      "name": "Gemüsebrühe",
      "menge": 1200,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Möhren",
      "menge": 200,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Sellerie",
      "menge": 100,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Lorbeerblatt",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Sahne optional",
      "menge": 100,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Olivenöl",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Großen Topf (4–5 l) und Schöpfkelle bereitstellen; Gemüse waschen, Enden entfernen, in gleichmäßige Würfel schneiden.",
    "Topf auf Herdstufe 6 von 9 stellen, 2 EL Öl oder Butter erhitzen, Zwiebel und Knoblauch 4 Min glasig dünsten.",
    "Hartes Gemüse (Karotten, Sellerie, Kartoffeln) 5–6 Min mit anschwitzen, gelegentlich rühren, nicht bräunen.",
    "Brühe (ca. 1–1,2 l) angießen, mit einem Spritzer einmal aufkochen, dann Hitze auf Stufe 3–4 reduzieren.",
    "Brokkolicremesuppe: 20–30 Min leicht köcheln, bis alles weich ist; mit dem Löffel prüfen — keine harten Stücke.",
    "Optional mit Stabmixer pürieren: Mixer tief ins Flüssige tauchen, kurze Pulse, Spritzer vermeiden; oder grob lassen.",
    "Mit Salz, Pfeffer, Muskat oder frischen Kräutern abschmecken; Konsistenz mit Wasser oder Sahne anpassen.",
    "Bei Bedarf Einlage (Nudeln, Croutons, Sahnehaube) separat zubereiten und erst beim Servieren zugeben.",
    "Suppe in vorgewärmte Schalen füllen, heiß servieren; Rest im Topf auf Stufe 2 warm halten."
  ]
}$g$::jsonb,
  1510,
  NULL,
  'Suppe / Eintopf'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Brokkolicremesuppe');

-- Karotten-Ingwer-Suppe
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Karotten-Ingwer-Suppe',
  4,
  $g${
  "titel": "Karotten-Ingwer-Suppe",
  "portionen": 4,
  "kategorie": "Suppe / Eintopf",
  "geschaetzte_kcal_gesamt": 1275,
  "zutaten": [
    {
      "name": "Gemüsebrühe",
      "menge": 1200,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Möhren",
      "menge": 200,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Sellerie",
      "menge": 100,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Lorbeerblatt",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Sahne optional",
      "menge": 100,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Olivenöl",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Großen Topf (4–5 l) und Schöpfkelle bereitstellen; Gemüse waschen, Enden entfernen, in gleichmäßige Würfel schneiden.",
    "Topf auf Herdstufe 6 von 9 stellen, 2 EL Öl oder Butter erhitzen, Zwiebel und Knoblauch 4 Min glasig dünsten.",
    "Hartes Gemüse (Karotten, Sellerie, Kartoffeln) 5–6 Min mit anschwitzen, gelegentlich rühren, nicht bräunen.",
    "Brühe (ca. 1–1,2 l) angießen, mit einem Spritzer einmal aufkochen, dann Hitze auf Stufe 3–4 reduzieren.",
    "Karotten-Ingwer-Suppe: 20–30 Min leicht köcheln, bis alles weich ist; mit dem Löffel prüfen — keine harten Stücke.",
    "Optional mit Stabmixer pürieren: Mixer tief ins Flüssige tauchen, kurze Pulse, Spritzer vermeiden; oder grob lassen.",
    "Mit Salz, Pfeffer, Muskat oder frischen Kräutern abschmecken; Konsistenz mit Wasser oder Sahne anpassen.",
    "Bei Bedarf Einlage (Nudeln, Croutons, Sahnehaube) separat zubereiten und erst beim Servieren zugeben.",
    "Suppe in vorgewärmte Schalen füllen, heiß servieren; Rest im Topf auf Stufe 2 warm halten."
  ]
}$g$::jsonb,
  1275,
  NULL,
  'Suppe / Eintopf'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Karotten-Ingwer-Suppe');

-- Erbsen-Mint-Suppe
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Erbsen-Mint-Suppe',
  4,
  $g${
  "titel": "Erbsen-Mint-Suppe",
  "portionen": 4,
  "kategorie": "Suppe / Eintopf",
  "geschaetzte_kcal_gesamt": 1230,
  "zutaten": [
    {
      "name": "Gemüsebrühe",
      "menge": 1200,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Möhren",
      "menge": 200,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Sellerie",
      "menge": 100,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Lorbeerblatt",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Rote Linsen oder Erbsen",
      "menge": 250,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Sahne optional",
      "menge": 100,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Olivenöl",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Großen Topf (4–5 l) und Schöpfkelle bereitstellen; Gemüse waschen, Enden entfernen, in gleichmäßige Würfel schneiden.",
    "Topf auf Herdstufe 6 von 9 stellen, 2 EL Öl oder Butter erhitzen, Zwiebel und Knoblauch 4 Min glasig dünsten.",
    "Hartes Gemüse (Karotten, Sellerie, Kartoffeln) 5–6 Min mit anschwitzen, gelegentlich rühren, nicht bräunen.",
    "Brühe (ca. 1–1,2 l) angießen, mit einem Spritzer einmal aufkochen, dann Hitze auf Stufe 3–4 reduzieren.",
    "Erbsen-Mint-Suppe: 20–30 Min leicht köcheln, bis alles weich ist; mit dem Löffel prüfen — keine harten Stücke.",
    "Optional mit Stabmixer pürieren: Mixer tief ins Flüssige tauchen, kurze Pulse, Spritzer vermeiden; oder grob lassen.",
    "Mit Salz, Pfeffer, Muskat oder frischen Kräutern abschmecken; Konsistenz mit Wasser oder Sahne anpassen.",
    "Bei Bedarf Einlage (Nudeln, Croutons, Sahnehaube) separat zubereiten und erst beim Servieren zugeben.",
    "Suppe in vorgewärmte Schalen füllen, heiß servieren; Rest im Topf auf Stufe 2 warm halten."
  ]
}$g$::jsonb,
  1230,
  NULL,
  'Suppe / Eintopf'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Erbsen-Mint-Suppe');

-- Tortellini-Suppe
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Tortellini-Suppe',
  4,
  $g${
  "titel": "Tortellini-Suppe",
  "portionen": 4,
  "kategorie": "Suppe / Eintopf",
  "geschaetzte_kcal_gesamt": 1232,
  "zutaten": [
    {
      "name": "Gemüsebrühe",
      "menge": 1200,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Möhren",
      "menge": 200,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Sellerie",
      "menge": 100,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Lorbeerblatt",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Sahne optional",
      "menge": 100,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Olivenöl",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Großen Topf (4–5 l) und Schöpfkelle bereitstellen; Gemüse waschen, Enden entfernen, in gleichmäßige Würfel schneiden.",
    "Topf auf Herdstufe 6 von 9 stellen, 2 EL Öl oder Butter erhitzen, Zwiebel und Knoblauch 4 Min glasig dünsten.",
    "Hartes Gemüse (Karotten, Sellerie, Kartoffeln) 5–6 Min mit anschwitzen, gelegentlich rühren, nicht bräunen.",
    "Brühe (ca. 1–1,2 l) angießen, mit einem Spritzer einmal aufkochen, dann Hitze auf Stufe 3–4 reduzieren.",
    "Tortellini-Suppe: 20–30 Min leicht köcheln, bis alles weich ist; mit dem Löffel prüfen — keine harten Stücke.",
    "Optional mit Stabmixer pürieren: Mixer tief ins Flüssige tauchen, kurze Pulse, Spritzer vermeiden; oder grob lassen.",
    "Mit Salz, Pfeffer, Muskat oder frischen Kräutern abschmecken; Konsistenz mit Wasser oder Sahne anpassen.",
    "Bei Bedarf Einlage (Nudeln, Croutons, Sahnehaube) separat zubereiten und erst beim Servieren zugeben.",
    "Suppe in vorgewärmte Schalen füllen, heiß servieren; Rest im Topf auf Stufe 2 warm halten."
  ]
}$g$::jsonb,
  1232,
  NULL,
  'Suppe / Eintopf'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Tortellini-Suppe');

-- Chili-Suppe
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Chili-Suppe',
  4,
  $g${
  "titel": "Chili-Suppe",
  "portionen": 4,
  "kategorie": "Suppe / Eintopf",
  "geschaetzte_kcal_gesamt": 1459,
  "zutaten": [
    {
      "name": "Gemüsebrühe",
      "menge": 1200,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Möhren",
      "menge": 200,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Sellerie",
      "menge": 100,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Lorbeerblatt",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Sahne optional",
      "menge": 100,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Olivenöl",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Großen Topf (4–5 l) und Schöpfkelle bereitstellen; Gemüse waschen, Enden entfernen, in gleichmäßige Würfel schneiden.",
    "Topf auf Herdstufe 6 von 9 stellen, 2 EL Öl oder Butter erhitzen, Zwiebel und Knoblauch 4 Min glasig dünsten.",
    "Hartes Gemüse (Karotten, Sellerie, Kartoffeln) 5–6 Min mit anschwitzen, gelegentlich rühren, nicht bräunen.",
    "Brühe (ca. 1–1,2 l) angießen, mit einem Spritzer einmal aufkochen, dann Hitze auf Stufe 3–4 reduzieren.",
    "Chili-Suppe: 20–30 Min leicht köcheln, bis alles weich ist; mit dem Löffel prüfen — keine harten Stücke.",
    "Optional mit Stabmixer pürieren: Mixer tief ins Flüssige tauchen, kurze Pulse, Spritzer vermeiden; oder grob lassen.",
    "Mit Salz, Pfeffer, Muskat oder frischen Kräutern abschmecken; Konsistenz mit Wasser oder Sahne anpassen.",
    "Bei Bedarf Einlage (Nudeln, Croutons, Sahnehaube) separat zubereiten und erst beim Servieren zugeben.",
    "Suppe in vorgewärmte Schalen füllen, heiß servieren; Rest im Topf auf Stufe 2 warm halten."
  ]
}$g$::jsonb,
  1459,
  NULL,
  'Suppe / Eintopf'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Chili-Suppe');

-- Eintopf mit weißen Bohnen
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Eintopf mit weißen Bohnen',
  4,
  $g${
  "titel": "Eintopf mit weißen Bohnen",
  "portionen": 4,
  "kategorie": "Suppe / Eintopf",
  "geschaetzte_kcal_gesamt": 1312,
  "zutaten": [
    {
      "name": "Gemüsebrühe",
      "menge": 1200,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Möhren",
      "menge": 200,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Sellerie",
      "menge": 100,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Lorbeerblatt",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Sahne optional",
      "menge": 100,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Olivenöl",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Schweren Bräter oder großen Topf (5 l) bereitstellen; Fleisch oder Hülsenfrüchte trocken tupfen, Gemüse würfeln.",
    "Bräter auf Herdstufe 7 erhitzen, 2 EL Öl, Fleisch in Portionen scharf anbraten (nicht überfüllen), herausnehmen.",
    "Zwiebeln und Wurzelgemüse im Bratensatz 5 Min anschwitzen, mit Tomatenmark 1 Min mitrösten.",
    "Fleisch zurück, Flüssigkeit (Brühe, Bier, Wein) angießen, Lorbeer und Gewürze zugeben, aufkochen.",
    "Hitze auf Stufe 2–3, Deckel leicht an, 60–90 Min köcheln — Fleisch soll mit der Gabel zerfallen.",
    "Kartoffeln oder Kohl ggf. in der letzten halben Stunde zugeben, nicht zu früh (sonst matschig).",
    "Eintopf abschmecken (Salz, Pfeffer, Essig), 10 Min ruhen lassen, damit sich Aromen setzen.",
    "In tiefen Tellern servieren, mit frischem Brot; Rest am nächsten Tag schmeckt oft besser."
  ]
}$g$::jsonb,
  1312,
  NULL,
  'Suppe / Eintopf'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Eintopf mit weißen Bohnen');

-- Lauch-Kartoffel-Suppe
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Lauch-Kartoffel-Suppe',
  4,
  $g${
  "titel": "Lauch-Kartoffel-Suppe",
  "portionen": 4,
  "kategorie": "Suppe / Eintopf",
  "geschaetzte_kcal_gesamt": 1234,
  "zutaten": [
    {
      "name": "Gemüsebrühe",
      "menge": 1200,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Möhren",
      "menge": 200,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Sellerie",
      "menge": 100,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Lorbeerblatt",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Kartoffeln",
      "menge": 500,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Sahne optional",
      "menge": 100,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Olivenöl",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Großen Topf (4–5 l) und Schöpfkelle bereitstellen; Gemüse waschen, Enden entfernen, in gleichmäßige Würfel schneiden.",
    "Topf auf Herdstufe 6 von 9 stellen, 2 EL Öl oder Butter erhitzen, Zwiebel und Knoblauch 4 Min glasig dünsten.",
    "Hartes Gemüse (Karotten, Sellerie, Kartoffeln) 5–6 Min mit anschwitzen, gelegentlich rühren, nicht bräunen.",
    "Brühe (ca. 1–1,2 l) angießen, mit einem Spritzer einmal aufkochen, dann Hitze auf Stufe 3–4 reduzieren.",
    "Lauch-Kartoffel-Suppe: 20–30 Min leicht köcheln, bis alles weich ist; mit dem Löffel prüfen — keine harten Stücke.",
    "Optional mit Stabmixer pürieren: Mixer tief ins Flüssige tauchen, kurze Pulse, Spritzer vermeiden; oder grob lassen.",
    "Mit Salz, Pfeffer, Muskat oder frischen Kräutern abschmecken; Konsistenz mit Wasser oder Sahne anpassen.",
    "Bei Bedarf Einlage (Nudeln, Croutons, Sahnehaube) separat zubereiten und erst beim Servieren zugeben.",
    "Suppe in vorgewärmte Schalen füllen, heiß servieren; Rest im Topf auf Stufe 2 warm halten."
  ]
}$g$::jsonb,
  1234,
  NULL,
  'Suppe / Eintopf'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Lauch-Kartoffel-Suppe');

-- Rote-Linsen-Suppe
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Rote-Linsen-Suppe',
  4,
  $g${
  "titel": "Rote-Linsen-Suppe",
  "portionen": 4,
  "kategorie": "Suppe / Eintopf",
  "geschaetzte_kcal_gesamt": 1242,
  "zutaten": [
    {
      "name": "Gemüsebrühe",
      "menge": 1200,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Möhren",
      "menge": 200,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Sellerie",
      "menge": 100,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Lorbeerblatt",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Rote Linsen oder Erbsen",
      "menge": 250,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Sahne optional",
      "menge": 100,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Olivenöl",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Großen Topf (4–5 l) und Schöpfkelle bereitstellen; Gemüse waschen, Enden entfernen, in gleichmäßige Würfel schneiden.",
    "Topf auf Herdstufe 6 von 9 stellen, 2 EL Öl oder Butter erhitzen, Zwiebel und Knoblauch 4 Min glasig dünsten.",
    "Hartes Gemüse (Karotten, Sellerie, Kartoffeln) 5–6 Min mit anschwitzen, gelegentlich rühren, nicht bräunen.",
    "Brühe (ca. 1–1,2 l) angießen, mit einem Spritzer einmal aufkochen, dann Hitze auf Stufe 3–4 reduzieren.",
    "Rote-Linsen-Suppe: 20–30 Min leicht köcheln, bis alles weich ist; mit dem Löffel prüfen — keine harten Stücke.",
    "Optional mit Stabmixer pürieren: Mixer tief ins Flüssige tauchen, kurze Pulse, Spritzer vermeiden; oder grob lassen.",
    "Mit Salz, Pfeffer, Muskat oder frischen Kräutern abschmecken; Konsistenz mit Wasser oder Sahne anpassen.",
    "Bei Bedarf Einlage (Nudeln, Croutons, Sahnehaube) separat zubereiten und erst beim Servieren zugeben.",
    "Suppe in vorgewärmte Schalen füllen, heiß servieren; Rest im Topf auf Stufe 2 warm halten."
  ]
}$g$::jsonb,
  1242,
  NULL,
  'Suppe / Eintopf'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Rote-Linsen-Suppe');

-- Gulasch-Eintopf ungarisch
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Gulasch-Eintopf ungarisch',
  4,
  $g${
  "titel": "Gulasch-Eintopf ungarisch",
  "portionen": 4,
  "kategorie": "Suppe / Eintopf",
  "geschaetzte_kcal_gesamt": 1277,
  "zutaten": [
    {
      "name": "Gemüsebrühe",
      "menge": 1200,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Möhren",
      "menge": 200,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Sellerie",
      "menge": 100,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Lorbeerblatt",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Rindfleisch",
      "menge": 500,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Paprikapulver edelsüß",
      "menge": 2,
      "einheit": "TL",
      "aus_lager": false
    },
    {
      "name": "Sahne optional",
      "menge": 100,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Olivenöl",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Schweren Bräter oder großen Topf (5 l) bereitstellen; Fleisch oder Hülsenfrüchte trocken tupfen, Gemüse würfeln.",
    "Bräter auf Herdstufe 7 erhitzen, 2 EL Öl, Fleisch in Portionen scharf anbraten (nicht überfüllen), herausnehmen.",
    "Zwiebeln und Wurzelgemüse im Bratensatz 5 Min anschwitzen, mit Tomatenmark 1 Min mitrösten.",
    "Fleisch zurück, Flüssigkeit (Brühe, Bier, Wein) angießen, Lorbeer und Gewürze zugeben, aufkochen.",
    "Hitze auf Stufe 2–3, Deckel leicht an, 60–90 Min köcheln — Fleisch soll mit der Gabel zerfallen.",
    "Kartoffeln oder Kohl ggf. in der letzten halben Stunde zugeben, nicht zu früh (sonst matschig).",
    "Eintopf abschmecken (Salz, Pfeffer, Essig), 10 Min ruhen lassen, damit sich Aromen setzen.",
    "In tiefen Tellern servieren, mit frischem Brot; Rest am nächsten Tag schmeckt oft besser."
  ]
}$g$::jsonb,
  1277,
  NULL,
  'Suppe / Eintopf'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Gulasch-Eintopf ungarisch');

-- Fischsuppe nordisch
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Fischsuppe nordisch',
  4,
  $g${
  "titel": "Fischsuppe nordisch",
  "portionen": 4,
  "kategorie": "Suppe / Eintopf",
  "geschaetzte_kcal_gesamt": 1540,
  "zutaten": [
    {
      "name": "Gemüsebrühe",
      "menge": 1200,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Möhren",
      "menge": 200,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Sellerie",
      "menge": 100,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Lorbeerblatt",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Sahne optional",
      "menge": 100,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Olivenöl",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Großen Topf (4–5 l) und Schöpfkelle bereitstellen; Gemüse waschen, Enden entfernen, in gleichmäßige Würfel schneiden.",
    "Topf auf Herdstufe 6 von 9 stellen, 2 EL Öl oder Butter erhitzen, Zwiebel und Knoblauch 4 Min glasig dünsten.",
    "Hartes Gemüse (Karotten, Sellerie, Kartoffeln) 5–6 Min mit anschwitzen, gelegentlich rühren, nicht bräunen.",
    "Brühe (ca. 1–1,2 l) angießen, mit einem Spritzer einmal aufkochen, dann Hitze auf Stufe 3–4 reduzieren.",
    "Fischsuppe nordisch: 20–30 Min leicht köcheln, bis alles weich ist; mit dem Löffel prüfen — keine harten Stücke.",
    "Optional mit Stabmixer pürieren: Mixer tief ins Flüssige tauchen, kurze Pulse, Spritzer vermeiden; oder grob lassen.",
    "Mit Salz, Pfeffer, Muskat oder frischen Kräutern abschmecken; Konsistenz mit Wasser oder Sahne anpassen.",
    "Bei Bedarf Einlage (Nudeln, Croutons, Sahnehaube) separat zubereiten und erst beim Servieren zugeben.",
    "Suppe in vorgewärmte Schalen füllen, heiß servieren; Rest im Topf auf Stufe 2 warm halten."
  ]
}$g$::jsonb,
  1540,
  NULL,
  'Suppe / Eintopf'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Fischsuppe nordisch');

-- Kürbis-Kokos-Suppe
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Kürbis-Kokos-Suppe',
  4,
  $g${
  "titel": "Kürbis-Kokos-Suppe",
  "portionen": 4,
  "kategorie": "Suppe / Eintopf",
  "geschaetzte_kcal_gesamt": 1493,
  "zutaten": [
    {
      "name": "Gemüsebrühe",
      "menge": 1200,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Möhren",
      "menge": 200,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Sellerie",
      "menge": 100,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Lorbeerblatt",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Sahne optional",
      "menge": 100,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Olivenöl",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Großen Topf (4–5 l) und Schöpfkelle bereitstellen; Gemüse waschen, Enden entfernen, in gleichmäßige Würfel schneiden.",
    "Topf auf Herdstufe 6 von 9 stellen, 2 EL Öl oder Butter erhitzen, Zwiebel und Knoblauch 4 Min glasig dünsten.",
    "Hartes Gemüse (Karotten, Sellerie, Kartoffeln) 5–6 Min mit anschwitzen, gelegentlich rühren, nicht bräunen.",
    "Brühe (ca. 1–1,2 l) angießen, mit einem Spritzer einmal aufkochen, dann Hitze auf Stufe 3–4 reduzieren.",
    "Kürbis-Kokos-Suppe: 20–30 Min leicht köcheln, bis alles weich ist; mit dem Löffel prüfen — keine harten Stücke.",
    "Optional mit Stabmixer pürieren: Mixer tief ins Flüssige tauchen, kurze Pulse, Spritzer vermeiden; oder grob lassen.",
    "Mit Salz, Pfeffer, Muskat oder frischen Kräutern abschmecken; Konsistenz mit Wasser oder Sahne anpassen.",
    "Bei Bedarf Einlage (Nudeln, Croutons, Sahnehaube) separat zubereiten und erst beim Servieren zugeben.",
    "Suppe in vorgewärmte Schalen füllen, heiß servieren; Rest im Topf auf Stufe 2 warm halten."
  ]
}$g$::jsonb,
  1493,
  NULL,
  'Suppe / Eintopf'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Kürbis-Kokos-Suppe');

-- Spargelcremesuppe
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Spargelcremesuppe',
  4,
  $g${
  "titel": "Spargelcremesuppe",
  "portionen": 4,
  "kategorie": "Suppe / Eintopf",
  "geschaetzte_kcal_gesamt": 1399,
  "zutaten": [
    {
      "name": "Gemüsebrühe",
      "menge": 1200,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Möhren",
      "menge": 200,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Sellerie",
      "menge": 100,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Lorbeerblatt",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Sahne optional",
      "menge": 100,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Olivenöl",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Großen Topf (4–5 l) und Schöpfkelle bereitstellen; Gemüse waschen, Enden entfernen, in gleichmäßige Würfel schneiden.",
    "Topf auf Herdstufe 6 von 9 stellen, 2 EL Öl oder Butter erhitzen, Zwiebel und Knoblauch 4 Min glasig dünsten.",
    "Hartes Gemüse (Karotten, Sellerie, Kartoffeln) 5–6 Min mit anschwitzen, gelegentlich rühren, nicht bräunen.",
    "Brühe (ca. 1–1,2 l) angießen, mit einem Spritzer einmal aufkochen, dann Hitze auf Stufe 3–4 reduzieren.",
    "Spargelcremesuppe: 20–30 Min leicht köcheln, bis alles weich ist; mit dem Löffel prüfen — keine harten Stücke.",
    "Optional mit Stabmixer pürieren: Mixer tief ins Flüssige tauchen, kurze Pulse, Spritzer vermeiden; oder grob lassen.",
    "Mit Salz, Pfeffer, Muskat oder frischen Kräutern abschmecken; Konsistenz mit Wasser oder Sahne anpassen.",
    "Bei Bedarf Einlage (Nudeln, Croutons, Sahnehaube) separat zubereiten und erst beim Servieren zugeben.",
    "Suppe in vorgewärmte Schalen füllen, heiß servieren; Rest im Topf auf Stufe 2 warm halten."
  ]
}$g$::jsonb,
  1399,
  NULL,
  'Suppe / Eintopf'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Spargelcremesuppe');

-- Ramen mit Ei
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Ramen mit Ei',
  4,
  $g${
  "titel": "Ramen mit Ei",
  "portionen": 4,
  "kategorie": "Suppe / Eintopf",
  "geschaetzte_kcal_gesamt": 1467,
  "zutaten": [
    {
      "name": "Gemüsebrühe",
      "menge": 1200,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Möhren",
      "menge": 200,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Sellerie",
      "menge": 100,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Lorbeerblatt",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Sahne optional",
      "menge": 100,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Olivenöl",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Großen Topf (4–5 l) und Schöpfkelle bereitstellen; Gemüse waschen, Enden entfernen, in gleichmäßige Würfel schneiden.",
    "Topf auf Herdstufe 6 von 9 stellen, 2 EL Öl oder Butter erhitzen, Zwiebel und Knoblauch 4 Min glasig dünsten.",
    "Hartes Gemüse (Karotten, Sellerie, Kartoffeln) 5–6 Min mit anschwitzen, gelegentlich rühren, nicht bräunen.",
    "Brühe (ca. 1–1,2 l) angießen, mit einem Spritzer einmal aufkochen, dann Hitze auf Stufe 3–4 reduzieren.",
    "Ramen mit Ei: 20–30 Min leicht köcheln, bis alles weich ist; mit dem Löffel prüfen — keine harten Stücke.",
    "Optional mit Stabmixer pürieren: Mixer tief ins Flüssige tauchen, kurze Pulse, Spritzer vermeiden; oder grob lassen.",
    "Mit Salz, Pfeffer, Muskat oder frischen Kräutern abschmecken; Konsistenz mit Wasser oder Sahne anpassen.",
    "Bei Bedarf Einlage (Nudeln, Croutons, Sahnehaube) separat zubereiten und erst beim Servieren zugeben.",
    "Suppe in vorgewärmte Schalen füllen, heiß servieren; Rest im Topf auf Stufe 2 warm halten."
  ]
}$g$::jsonb,
  1467,
  NULL,
  'Suppe / Eintopf'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Ramen mit Ei');

-- Eintopf Linsen und Wurzelgemüse
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Eintopf Linsen und Wurzelgemüse',
  4,
  $g${
  "titel": "Eintopf Linsen und Wurzelgemüse",
  "portionen": 4,
  "kategorie": "Suppe / Eintopf",
  "geschaetzte_kcal_gesamt": 1595,
  "zutaten": [
    {
      "name": "Gemüsebrühe",
      "menge": 1200,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Möhren",
      "menge": 200,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Sellerie",
      "menge": 100,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Lorbeerblatt",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Rote Linsen oder Erbsen",
      "menge": 250,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Sahne optional",
      "menge": 100,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Olivenöl",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Schweren Bräter oder großen Topf (5 l) bereitstellen; Fleisch oder Hülsenfrüchte trocken tupfen, Gemüse würfeln.",
    "Bräter auf Herdstufe 7 erhitzen, 2 EL Öl, Fleisch in Portionen scharf anbraten (nicht überfüllen), herausnehmen.",
    "Zwiebeln und Wurzelgemüse im Bratensatz 5 Min anschwitzen, mit Tomatenmark 1 Min mitrösten.",
    "Fleisch zurück, Flüssigkeit (Brühe, Bier, Wein) angießen, Lorbeer und Gewürze zugeben, aufkochen.",
    "Hitze auf Stufe 2–3, Deckel leicht an, 60–90 Min köcheln — Fleisch soll mit der Gabel zerfallen.",
    "Kartoffeln oder Kohl ggf. in der letzten halben Stunde zugeben, nicht zu früh (sonst matschig).",
    "Eintopf abschmecken (Salz, Pfeffer, Essig), 10 Min ruhen lassen, damit sich Aromen setzen.",
    "In tiefen Tellern servieren, mit frischem Brot; Rest am nächsten Tag schmeckt oft besser."
  ]
}$g$::jsonb,
  1595,
  NULL,
  'Suppe / Eintopf'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Eintopf Linsen und Wurzelgemüse');

-- Tomatensuppe mit Basilikum
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Tomatensuppe mit Basilikum',
  4,
  $g${
  "titel": "Tomatensuppe mit Basilikum",
  "portionen": 4,
  "kategorie": "Suppe / Eintopf",
  "geschaetzte_kcal_gesamt": 1408,
  "zutaten": [
    {
      "name": "Gemüsebrühe",
      "menge": 1200,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Möhren",
      "menge": 200,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Sellerie",
      "menge": 100,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Lorbeerblatt",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Sahne optional",
      "menge": 100,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Olivenöl",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Großen Topf (4–5 l) und Schöpfkelle bereitstellen; Gemüse waschen, Enden entfernen, in gleichmäßige Würfel schneiden.",
    "Topf auf Herdstufe 6 von 9 stellen, 2 EL Öl oder Butter erhitzen, Zwiebel und Knoblauch 4 Min glasig dünsten.",
    "Hartes Gemüse (Karotten, Sellerie, Kartoffeln) 5–6 Min mit anschwitzen, gelegentlich rühren, nicht bräunen.",
    "Brühe (ca. 1–1,2 l) angießen, mit einem Spritzer einmal aufkochen, dann Hitze auf Stufe 3–4 reduzieren.",
    "Tomatensuppe mit Basilikum: 20–30 Min leicht köcheln, bis alles weich ist; mit dem Löffel prüfen — keine harten Stücke.",
    "Optional mit Stabmixer pürieren: Mixer tief ins Flüssige tauchen, kurze Pulse, Spritzer vermeiden; oder grob lassen.",
    "Mit Salz, Pfeffer, Muskat oder frischen Kräutern abschmecken; Konsistenz mit Wasser oder Sahne anpassen.",
    "Bei Bedarf Einlage (Nudeln, Croutons, Sahnehaube) separat zubereiten und erst beim Servieren zugeben.",
    "Suppe in vorgewärmte Schalen füllen, heiß servieren; Rest im Topf auf Stufe 2 warm halten."
  ]
}$g$::jsonb,
  1408,
  NULL,
  'Suppe / Eintopf'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Tomatensuppe mit Basilikum');

-- Borschtsch
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Borschtsch',
  4,
  $g${
  "titel": "Borschtsch",
  "portionen": 4,
  "kategorie": "Suppe / Eintopf",
  "geschaetzte_kcal_gesamt": 1443,
  "zutaten": [
    {
      "name": "Gemüsebrühe",
      "menge": 1200,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Möhren",
      "menge": 200,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Sellerie",
      "menge": 100,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Lorbeerblatt",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Sahne optional",
      "menge": 100,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Olivenöl",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Großen Topf (4–5 l) und Schöpfkelle bereitstellen; Gemüse waschen, Enden entfernen, in gleichmäßige Würfel schneiden.",
    "Topf auf Herdstufe 6 von 9 stellen, 2 EL Öl oder Butter erhitzen, Zwiebel und Knoblauch 4 Min glasig dünsten.",
    "Hartes Gemüse (Karotten, Sellerie, Kartoffeln) 5–6 Min mit anschwitzen, gelegentlich rühren, nicht bräunen.",
    "Brühe (ca. 1–1,2 l) angießen, mit einem Spritzer einmal aufkochen, dann Hitze auf Stufe 3–4 reduzieren.",
    "Borschtsch: 20–30 Min leicht köcheln, bis alles weich ist; mit dem Löffel prüfen — keine harten Stücke.",
    "Optional mit Stabmixer pürieren: Mixer tief ins Flüssige tauchen, kurze Pulse, Spritzer vermeiden; oder grob lassen.",
    "Mit Salz, Pfeffer, Muskat oder frischen Kräutern abschmecken; Konsistenz mit Wasser oder Sahne anpassen.",
    "Bei Bedarf Einlage (Nudeln, Croutons, Sahnehaube) separat zubereiten und erst beim Servieren zugeben.",
    "Suppe in vorgewärmte Schalen füllen, heiß servieren; Rest im Topf auf Stufe 2 warm halten."
  ]
}$g$::jsonb,
  1443,
  NULL,
  'Suppe / Eintopf'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Borschtsch');

-- Erbsensuppe mit Speck
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Erbsensuppe mit Speck',
  4,
  $g${
  "titel": "Erbsensuppe mit Speck",
  "portionen": 4,
  "kategorie": "Suppe / Eintopf",
  "geschaetzte_kcal_gesamt": 1260,
  "zutaten": [
    {
      "name": "Gemüsebrühe",
      "menge": 1200,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Möhren",
      "menge": 200,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Sellerie",
      "menge": 100,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Lorbeerblatt",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Rote Linsen oder Erbsen",
      "menge": 250,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Sahne optional",
      "menge": 100,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Olivenöl",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Großen Topf (4–5 l) und Schöpfkelle bereitstellen; Gemüse waschen, Enden entfernen, in gleichmäßige Würfel schneiden.",
    "Topf auf Herdstufe 6 von 9 stellen, 2 EL Öl oder Butter erhitzen, Zwiebel und Knoblauch 4 Min glasig dünsten.",
    "Hartes Gemüse (Karotten, Sellerie, Kartoffeln) 5–6 Min mit anschwitzen, gelegentlich rühren, nicht bräunen.",
    "Brühe (ca. 1–1,2 l) angießen, mit einem Spritzer einmal aufkochen, dann Hitze auf Stufe 3–4 reduzieren.",
    "Erbsensuppe mit Speck: 20–30 Min leicht köcheln, bis alles weich ist; mit dem Löffel prüfen — keine harten Stücke.",
    "Optional mit Stabmixer pürieren: Mixer tief ins Flüssige tauchen, kurze Pulse, Spritzer vermeiden; oder grob lassen.",
    "Mit Salz, Pfeffer, Muskat oder frischen Kräutern abschmecken; Konsistenz mit Wasser oder Sahne anpassen.",
    "Bei Bedarf Einlage (Nudeln, Croutons, Sahnehaube) separat zubereiten und erst beim Servieren zugeben.",
    "Suppe in vorgewärmte Schalen füllen, heiß servieren; Rest im Topf auf Stufe 2 warm halten."
  ]
}$g$::jsonb,
  1260,
  NULL,
  'Suppe / Eintopf'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Erbsensuppe mit Speck');

-- Kartoffelsalat norddeutsch
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Kartoffelsalat norddeutsch',
  4,
  $g${
  "titel": "Kartoffelsalat norddeutsch",
  "portionen": 4,
  "kategorie": "Beilage / Salat",
  "geschaetzte_kcal_gesamt": 978,
  "zutaten": [
    {
      "name": "Kartoffeln",
      "menge": 1000,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Essig",
      "menge": 3,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Senf",
      "menge": 1,
      "einheit": "TL",
      "aus_lager": false
    },
    {
      "name": "Öl",
      "menge": 4,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Gurken",
      "menge": 150,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Schnittlauch",
      "menge": 20,
      "einheit": "g",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Salatschüssel und große Schüssel mit kaltem Wasser bereitstellen; Gemüse gründlich waschen und trocken schleudern.",
    "Blattsalat in mundgerechte Stücke zupfen oder schneiden — Messer vermeidet braune Schnittkanten.",
    "Festes Gemüse (Gurke, Paprika, Tomaten) in gleichmäßige Stücke schneiden, separat lagern.",
    "Dressing in kleiner Schüssel: Öl, Essig, Senf, Salz, Pfeffer mit Schneebesen emulgieren.",
    "Käse, Nüsse oder Croutons erst kurz vor dem Servieren zugeben (sonst weich).",
    "Salat mit Dressing vermengen — nur so viel, dass Blätter glänzen, nicht schwimmen.",
    "Sofort auf kühlen Tellern anrichten; bei Meal Prep Dressing separat mitgeben."
  ]
}$g$::jsonb,
  978,
  NULL,
  'Beilage / Salat'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Kartoffelsalat norddeutsch');

-- Coleslaw
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Coleslaw',
  4,
  $g${
  "titel": "Coleslaw",
  "portionen": 4,
  "kategorie": "Beilage / Salat",
  "geschaetzte_kcal_gesamt": 800,
  "zutaten": [
    {
      "name": "Salat oder Gemüse",
      "menge": 400,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Olivenöl",
      "menge": 3,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Essig",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Senf",
      "menge": 1,
      "einheit": "TL",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 0.5,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Kräuter",
      "menge": 15,
      "einheit": "g",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Salatschüssel und große Schüssel mit kaltem Wasser bereitstellen; Gemüse gründlich waschen und trocken schleudern.",
    "Blattsalat in mundgerechte Stücke zupfen oder schneiden — Messer vermeidet braune Schnittkanten.",
    "Festes Gemüse (Gurke, Paprika, Tomaten) in gleichmäßige Stücke schneiden, separat lagern.",
    "Dressing in kleiner Schüssel: Öl, Essig, Senf, Salz, Pfeffer mit Schneebesen emulgieren.",
    "Käse, Nüsse oder Croutons erst kurz vor dem Servieren zugeben (sonst weich).",
    "Salat mit Dressing vermengen — nur so viel, dass Blätter glänzen, nicht schwimmen.",
    "Sofort auf kühlen Tellern anrichten; bei Meal Prep Dressing separat mitgeben."
  ]
}$g$::jsonb,
  800,
  NULL,
  'Beilage / Salat'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Coleslaw');

-- Taboulé
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Taboulé',
  4,
  $g${
  "titel": "Taboulé",
  "portionen": 4,
  "kategorie": "Beilage / Salat",
  "geschaetzte_kcal_gesamt": 800,
  "zutaten": [
    {
      "name": "Salat oder Gemüse",
      "menge": 400,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Olivenöl",
      "menge": 3,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Essig",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Senf",
      "menge": 1,
      "einheit": "TL",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 0.5,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Kräuter",
      "menge": 15,
      "einheit": "g",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Salatschüssel und große Schüssel mit kaltem Wasser bereitstellen; Gemüse gründlich waschen und trocken schleudern.",
    "Blattsalat in mundgerechte Stücke zupfen oder schneiden — Messer vermeidet braune Schnittkanten.",
    "Festes Gemüse (Gurke, Paprika, Tomaten) in gleichmäßige Stücke schneiden, separat lagern.",
    "Dressing in kleiner Schüssel: Öl, Essig, Senf, Salz, Pfeffer mit Schneebesen emulgieren.",
    "Käse, Nüsse oder Croutons erst kurz vor dem Servieren zugeben (sonst weich).",
    "Salat mit Dressing vermengen — nur so viel, dass Blätter glänzen, nicht schwimmen.",
    "Sofort auf kühlen Tellern anrichten; bei Meal Prep Dressing separat mitgeben."
  ]
}$g$::jsonb,
  800,
  NULL,
  'Beilage / Salat'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Taboulé');

-- Kartoffelstampf
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Kartoffelstampf',
  4,
  $g${
  "titel": "Kartoffelstampf",
  "portionen": 4,
  "kategorie": "Beilage / Salat",
  "geschaetzte_kcal_gesamt": 1077,
  "zutaten": [
    {
      "name": "Kartoffeln",
      "menge": 1000,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Essig",
      "menge": 3,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Senf",
      "menge": 1,
      "einheit": "TL",
      "aus_lager": false
    },
    {
      "name": "Öl",
      "menge": 4,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Gurken",
      "menge": 150,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Schnittlauch",
      "menge": 20,
      "einheit": "g",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Alle Zutaten laut Rezept abwiegen und bereitstellen; Arbeitsfläche und Utensilien griffbereit legen.",
    "Schrittweise nach Rezept vorgehen: zuerst lange Garzeiten (Ofen, Topf), parallel kurze Arbeiten.",
    "Temperaturen mit Thermometer oder Uhr kontrollieren, nicht nur nach Gefühl bei Fleisch und Backen.",
    "Zwischenproben abschmecken, Würzung erst am Ende nicht vergessen.",
    "Anrichten auf vorgewärmten Tellern, sofort servieren oder kühl stellen laut Haltbarkeit."
  ]
}$g$::jsonb,
  1077,
  NULL,
  'Beilage / Salat'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Kartoffelstampf');

-- Bratkartoffeln
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Bratkartoffeln',
  4,
  $g${
  "titel": "Bratkartoffeln",
  "portionen": 4,
  "kategorie": "Beilage / Salat",
  "geschaetzte_kcal_gesamt": 961,
  "zutaten": [
    {
      "name": "Kartoffeln",
      "menge": 1000,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Essig",
      "menge": 3,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Senf",
      "menge": 1,
      "einheit": "TL",
      "aus_lager": false
    },
    {
      "name": "Öl",
      "menge": 4,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Gurken",
      "menge": 150,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Schnittlauch",
      "menge": 20,
      "einheit": "g",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Alle Zutaten laut Rezept abwiegen und bereitstellen; Arbeitsfläche und Utensilien griffbereit legen.",
    "Schrittweise nach Rezept vorgehen: zuerst lange Garzeiten (Ofen, Topf), parallel kurze Arbeiten.",
    "Temperaturen mit Thermometer oder Uhr kontrollieren, nicht nur nach Gefühl bei Fleisch und Backen.",
    "Zwischenproben abschmecken, Würzung erst am Ende nicht vergessen.",
    "Anrichten auf vorgewärmten Tellern, sofort servieren oder kühl stellen laut Haltbarkeit."
  ]
}$g$::jsonb,
  961,
  NULL,
  'Beilage / Salat'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Bratkartoffeln');

-- Ofenkartoffeln mit Quark
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Ofenkartoffeln mit Quark',
  4,
  $g${
  "titel": "Ofenkartoffeln mit Quark",
  "portionen": 4,
  "kategorie": "Beilage / Salat",
  "geschaetzte_kcal_gesamt": 1070,
  "zutaten": [
    {
      "name": "Kartoffeln",
      "menge": 1000,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Essig",
      "menge": 3,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Senf",
      "menge": 1,
      "einheit": "TL",
      "aus_lager": false
    },
    {
      "name": "Öl",
      "menge": 4,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Gurken",
      "menge": 150,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Schnittlauch",
      "menge": 20,
      "einheit": "g",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Alle Zutaten laut Rezept abwiegen und bereitstellen; Arbeitsfläche und Utensilien griffbereit legen.",
    "Schrittweise nach Rezept vorgehen: zuerst lange Garzeiten (Ofen, Topf), parallel kurze Arbeiten.",
    "Temperaturen mit Thermometer oder Uhr kontrollieren, nicht nur nach Gefühl bei Fleisch und Backen.",
    "Zwischenproben abschmecken, Würzung erst am Ende nicht vergessen.",
    "Anrichten auf vorgewärmten Tellern, sofort servieren oder kühl stellen laut Haltbarkeit."
  ]
}$g$::jsonb,
  1070,
  NULL,
  'Beilage / Salat'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Ofenkartoffeln mit Quark');

-- Reis mit Butter
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Reis mit Butter',
  4,
  $g${
  "titel": "Reis mit Butter",
  "portionen": 4,
  "kategorie": "Beilage / Salat",
  "geschaetzte_kcal_gesamt": 927,
  "zutaten": [
    {
      "name": "Reis oder Risottoreis",
      "menge": 300,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Butter",
      "menge": 30,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Gemüsebrühe",
      "menge": 800,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Parmesan",
      "menge": 50,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Weißwein",
      "menge": 100,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Pilze",
      "menge": 200,
      "einheit": "g",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Alle Zutaten laut Rezept abwiegen und bereitstellen; Arbeitsfläche und Utensilien griffbereit legen.",
    "Schrittweise nach Rezept vorgehen: zuerst lange Garzeiten (Ofen, Topf), parallel kurze Arbeiten.",
    "Temperaturen mit Thermometer oder Uhr kontrollieren, nicht nur nach Gefühl bei Fleisch und Backen.",
    "Zwischenproben abschmecken, Würzung erst am Ende nicht vergessen.",
    "Anrichten auf vorgewärmten Tellern, sofort servieren oder kühl stellen laut Haltbarkeit."
  ]
}$g$::jsonb,
  927,
  NULL,
  'Beilage / Salat'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Reis mit Butter');

-- Knödel halb und halb
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Knödel halb und halb',
  4,
  $g${
  "titel": "Knödel halb und halb",
  "portionen": 4,
  "kategorie": "Beilage / Salat",
  "geschaetzte_kcal_gesamt": 1077,
  "zutaten": [
    {
      "name": "Salat oder Gemüse",
      "menge": 400,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Olivenöl",
      "menge": 3,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Essig",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Senf",
      "menge": 1,
      "einheit": "TL",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 0.5,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Kräuter",
      "menge": 15,
      "einheit": "g",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Alle Zutaten laut Rezept abwiegen und bereitstellen; Arbeitsfläche und Utensilien griffbereit legen.",
    "Schrittweise nach Rezept vorgehen: zuerst lange Garzeiten (Ofen, Topf), parallel kurze Arbeiten.",
    "Temperaturen mit Thermometer oder Uhr kontrollieren, nicht nur nach Gefühl bei Fleisch und Backen.",
    "Zwischenproben abschmecken, Würzung erst am Ende nicht vergessen.",
    "Anrichten auf vorgewärmten Tellern, sofort servieren oder kühl stellen laut Haltbarkeit."
  ]
}$g$::jsonb,
  1077,
  NULL,
  'Beilage / Salat'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Knödel halb und halb');

-- Rotkohl geschmort
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Rotkohl geschmort',
  4,
  $g${
  "titel": "Rotkohl geschmort",
  "portionen": 4,
  "kategorie": "Beilage / Salat",
  "geschaetzte_kcal_gesamt": 843,
  "zutaten": [
    {
      "name": "Salat oder Gemüse",
      "menge": 400,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Olivenöl",
      "menge": 3,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Essig",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Senf",
      "menge": 1,
      "einheit": "TL",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 0.5,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Kräuter",
      "menge": 15,
      "einheit": "g",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Alle Zutaten laut Rezept abwiegen und bereitstellen; Arbeitsfläche und Utensilien griffbereit legen.",
    "Schrittweise nach Rezept vorgehen: zuerst lange Garzeiten (Ofen, Topf), parallel kurze Arbeiten.",
    "Temperaturen mit Thermometer oder Uhr kontrollieren, nicht nur nach Gefühl bei Fleisch und Backen.",
    "Zwischenproben abschmecken, Würzung erst am Ende nicht vergessen.",
    "Anrichten auf vorgewärmten Tellern, sofort servieren oder kühl stellen laut Haltbarkeit."
  ]
}$g$::jsonb,
  843,
  NULL,
  'Beilage / Salat'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Rotkohl geschmort');

-- Grüner Bohnensalat
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Grüner Bohnensalat',
  4,
  $g${
  "titel": "Grüner Bohnensalat",
  "portionen": 4,
  "kategorie": "Beilage / Salat",
  "geschaetzte_kcal_gesamt": 1029,
  "zutaten": [
    {
      "name": "Salat oder Gemüse",
      "menge": 400,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Olivenöl",
      "menge": 3,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Essig",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Senf",
      "menge": 1,
      "einheit": "TL",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 0.5,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Kräuter",
      "menge": 15,
      "einheit": "g",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Salatschüssel und große Schüssel mit kaltem Wasser bereitstellen; Gemüse gründlich waschen und trocken schleudern.",
    "Blattsalat in mundgerechte Stücke zupfen oder schneiden — Messer vermeidet braune Schnittkanten.",
    "Festes Gemüse (Gurke, Paprika, Tomaten) in gleichmäßige Stücke schneiden, separat lagern.",
    "Dressing in kleiner Schüssel: Öl, Essig, Senf, Salz, Pfeffer mit Schneebesen emulgieren.",
    "Käse, Nüsse oder Croutons erst kurz vor dem Servieren zugeben (sonst weich).",
    "Salat mit Dressing vermengen — nur so viel, dass Blätter glänzen, nicht schwimmen.",
    "Sofort auf kühlen Tellern anrichten; bei Meal Prep Dressing separat mitgeben."
  ]
}$g$::jsonb,
  1029,
  NULL,
  'Beilage / Salat'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Grüner Bohnensalat');

-- Tomaten-Mozzarella-Salat
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Tomaten-Mozzarella-Salat',
  4,
  $g${
  "titel": "Tomaten-Mozzarella-Salat",
  "portionen": 4,
  "kategorie": "Beilage / Salat",
  "geschaetzte_kcal_gesamt": 1076,
  "zutaten": [
    {
      "name": "Salat oder Gemüse",
      "menge": 400,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Olivenöl",
      "menge": 3,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Essig",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Senf",
      "menge": 1,
      "einheit": "TL",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 0.5,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Kräuter",
      "menge": 15,
      "einheit": "g",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Salatschüssel und große Schüssel mit kaltem Wasser bereitstellen; Gemüse gründlich waschen und trocken schleudern.",
    "Blattsalat in mundgerechte Stücke zupfen oder schneiden — Messer vermeidet braune Schnittkanten.",
    "Festes Gemüse (Gurke, Paprika, Tomaten) in gleichmäßige Stücke schneiden, separat lagern.",
    "Dressing in kleiner Schüssel: Öl, Essig, Senf, Salz, Pfeffer mit Schneebesen emulgieren.",
    "Käse, Nüsse oder Croutons erst kurz vor dem Servieren zugeben (sonst weich).",
    "Salat mit Dressing vermengen — nur so viel, dass Blätter glänzen, nicht schwimmen.",
    "Sofort auf kühlen Tellern anrichten; bei Meal Prep Dressing separat mitgeben."
  ]
}$g$::jsonb,
  1076,
  NULL,
  'Beilage / Salat'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Tomaten-Mozzarella-Salat');

-- Wurzelsalat
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Wurzelsalat',
  4,
  $g${
  "titel": "Wurzelsalat",
  "portionen": 4,
  "kategorie": "Beilage / Salat",
  "geschaetzte_kcal_gesamt": 1082,
  "zutaten": [
    {
      "name": "Salat oder Gemüse",
      "menge": 400,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Olivenöl",
      "menge": 3,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Essig",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Senf",
      "menge": 1,
      "einheit": "TL",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 0.5,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Kräuter",
      "menge": 15,
      "einheit": "g",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Salatschüssel und große Schüssel mit kaltem Wasser bereitstellen; Gemüse gründlich waschen und trocken schleudern.",
    "Blattsalat in mundgerechte Stücke zupfen oder schneiden — Messer vermeidet braune Schnittkanten.",
    "Festes Gemüse (Gurke, Paprika, Tomaten) in gleichmäßige Stücke schneiden, separat lagern.",
    "Dressing in kleiner Schüssel: Öl, Essig, Senf, Salz, Pfeffer mit Schneebesen emulgieren.",
    "Käse, Nüsse oder Croutons erst kurz vor dem Servieren zugeben (sonst weich).",
    "Salat mit Dressing vermengen — nur so viel, dass Blätter glänzen, nicht schwimmen.",
    "Sofort auf kühlen Tellern anrichten; bei Meal Prep Dressing separat mitgeben."
  ]
}$g$::jsonb,
  1082,
  NULL,
  'Beilage / Salat'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Wurzelsalat');

-- Gurkensalat dill
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Gurkensalat dill',
  4,
  $g${
  "titel": "Gurkensalat dill",
  "portionen": 4,
  "kategorie": "Beilage / Salat",
  "geschaetzte_kcal_gesamt": 800,
  "zutaten": [
    {
      "name": "Salat oder Gemüse",
      "menge": 400,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Olivenöl",
      "menge": 3,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Essig",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Senf",
      "menge": 1,
      "einheit": "TL",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 0.5,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Kräuter",
      "menge": 15,
      "einheit": "g",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Salatschüssel und große Schüssel mit kaltem Wasser bereitstellen; Gemüse gründlich waschen und trocken schleudern.",
    "Blattsalat in mundgerechte Stücke zupfen oder schneiden — Messer vermeidet braune Schnittkanten.",
    "Festes Gemüse (Gurke, Paprika, Tomaten) in gleichmäßige Stücke schneiden, separat lagern.",
    "Dressing in kleiner Schüssel: Öl, Essig, Senf, Salz, Pfeffer mit Schneebesen emulgieren.",
    "Käse, Nüsse oder Croutons erst kurz vor dem Servieren zugeben (sonst weich).",
    "Salat mit Dressing vermengen — nur so viel, dass Blätter glänzen, nicht schwimmen.",
    "Sofort auf kühlen Tellern anrichten; bei Meal Prep Dressing separat mitgeben."
  ]
}$g$::jsonb,
  800,
  NULL,
  'Beilage / Salat'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Gurkensalat dill');

-- Kartoffelgratin klein
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Kartoffelgratin klein',
  4,
  $g${
  "titel": "Kartoffelgratin klein",
  "portionen": 4,
  "kategorie": "Beilage / Salat",
  "geschaetzte_kcal_gesamt": 834,
  "zutaten": [
    {
      "name": "Kartoffeln",
      "menge": 1000,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Essig",
      "menge": 3,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Senf",
      "menge": 1,
      "einheit": "TL",
      "aus_lager": false
    },
    {
      "name": "Öl",
      "menge": 4,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Gurken",
      "menge": 150,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Schnittlauch",
      "menge": 20,
      "einheit": "g",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Alle Zutaten laut Rezept abwiegen und bereitstellen; Arbeitsfläche und Utensilien griffbereit legen.",
    "Schrittweise nach Rezept vorgehen: zuerst lange Garzeiten (Ofen, Topf), parallel kurze Arbeiten.",
    "Temperaturen mit Thermometer oder Uhr kontrollieren, nicht nur nach Gefühl bei Fleisch und Backen.",
    "Zwischenproben abschmecken, Würzung erst am Ende nicht vergessen.",
    "Anrichten auf vorgewärmten Tellern, sofort servieren oder kühl stellen laut Haltbarkeit."
  ]
}$g$::jsonb,
  834,
  NULL,
  'Beilage / Salat'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Kartoffelgratin klein');

-- Spätzle einfach
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Spätzle einfach',
  4,
  $g${
  "titel": "Spätzle einfach",
  "portionen": 4,
  "kategorie": "Beilage / Salat",
  "geschaetzte_kcal_gesamt": 800,
  "zutaten": [
    {
      "name": "Salat oder Gemüse",
      "menge": 400,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Olivenöl",
      "menge": 3,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Essig",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Senf",
      "menge": 1,
      "einheit": "TL",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 0.5,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Kräuter",
      "menge": 15,
      "einheit": "g",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Alle Zutaten laut Rezept abwiegen und bereitstellen; Arbeitsfläche und Utensilien griffbereit legen.",
    "Schrittweise nach Rezept vorgehen: zuerst lange Garzeiten (Ofen, Topf), parallel kurze Arbeiten.",
    "Temperaturen mit Thermometer oder Uhr kontrollieren, nicht nur nach Gefühl bei Fleisch und Backen.",
    "Zwischenproben abschmecken, Würzung erst am Ende nicht vergessen.",
    "Anrichten auf vorgewärmten Tellern, sofort servieren oder kühl stellen laut Haltbarkeit."
  ]
}$g$::jsonb,
  800,
  NULL,
  'Beilage / Salat'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Spätzle einfach');

-- Semmelknödel
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Semmelknödel',
  4,
  $g${
  "titel": "Semmelknödel",
  "portionen": 4,
  "kategorie": "Beilage / Salat",
  "geschaetzte_kcal_gesamt": 883,
  "zutaten": [
    {
      "name": "Salat oder Gemüse",
      "menge": 400,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Olivenöl",
      "menge": 3,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Essig",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Senf",
      "menge": 1,
      "einheit": "TL",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 0.5,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Kräuter",
      "menge": 15,
      "einheit": "g",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Alle Zutaten laut Rezept abwiegen und bereitstellen; Arbeitsfläche und Utensilien griffbereit legen.",
    "Schrittweise nach Rezept vorgehen: zuerst lange Garzeiten (Ofen, Topf), parallel kurze Arbeiten.",
    "Temperaturen mit Thermometer oder Uhr kontrollieren, nicht nur nach Gefühl bei Fleisch und Backen.",
    "Zwischenproben abschmecken, Würzung erst am Ende nicht vergessen.",
    "Anrichten auf vorgewärmten Tellern, sofort servieren oder kühl stellen laut Haltbarkeit."
  ]
}$g$::jsonb,
  883,
  NULL,
  'Beilage / Salat'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Semmelknödel');

-- Pilzrisotto
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Pilzrisotto',
  4,
  $g${
  "titel": "Pilzrisotto",
  "portionen": 4,
  "kategorie": "Beilage / Salat",
  "geschaetzte_kcal_gesamt": 800,
  "zutaten": [
    {
      "name": "Reis oder Risottoreis",
      "menge": 300,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Butter",
      "menge": 30,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Gemüsebrühe",
      "menge": 800,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Parmesan",
      "menge": 50,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Weißwein",
      "menge": 100,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Pilze",
      "menge": 200,
      "einheit": "g",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Reis in einem Sieb 2–3 Mal kalt waschen, bis das Wasser klarer wird — entfernt überschüssige Stärke.",
    "Topf mit Deckel: Reis und Wasser im Verhältnis 1:1,5 (Basmati) oder 1:2 (Risotto), salzen.",
    "Aufkochen, dann Stufe 1–2, Deckel 12–18 Min (je nach Sorte), nicht rühren.",
    "Topf vom Herd, 10 Min quellen lassen; mit Gabel auflockern.",
    "Beilage oder unter Curry servieren."
  ]
}$g$::jsonb,
  800,
  NULL,
  'Beilage / Salat'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Pilzrisotto');

-- Gemüse-Reis-Pfanne
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Gemüse-Reis-Pfanne',
  4,
  $g${
  "titel": "Gemüse-Reis-Pfanne",
  "portionen": 4,
  "kategorie": "Beilage / Salat",
  "geschaetzte_kcal_gesamt": 942,
  "zutaten": [
    {
      "name": "Reis oder Risottoreis",
      "menge": 300,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Butter",
      "menge": 30,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Gemüsebrühe",
      "menge": 800,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Parmesan",
      "menge": 50,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Weißwein",
      "menge": 100,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Pilze",
      "menge": 200,
      "einheit": "g",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Alle Zutaten laut Rezept abwiegen und bereitstellen; Arbeitsfläche und Utensilien griffbereit legen.",
    "Schrittweise nach Rezept vorgehen: zuerst lange Garzeiten (Ofen, Topf), parallel kurze Arbeiten.",
    "Temperaturen mit Thermometer oder Uhr kontrollieren, nicht nur nach Gefühl bei Fleisch und Backen.",
    "Zwischenproben abschmecken, Würzung erst am Ende nicht vergessen.",
    "Anrichten auf vorgewärmten Tellern, sofort servieren oder kühl stellen laut Haltbarkeit."
  ]
}$g$::jsonb,
  942,
  NULL,
  'Beilage / Salat'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Gemüse-Reis-Pfanne');

-- Linsensalat
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Linsensalat',
  4,
  $g${
  "titel": "Linsensalat",
  "portionen": 4,
  "kategorie": "Beilage / Salat",
  "geschaetzte_kcal_gesamt": 1050,
  "zutaten": [
    {
      "name": "Salat oder Gemüse",
      "menge": 400,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Olivenöl",
      "menge": 3,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Essig",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Senf",
      "menge": 1,
      "einheit": "TL",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 0.5,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Kräuter",
      "menge": 15,
      "einheit": "g",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Salatschüssel und große Schüssel mit kaltem Wasser bereitstellen; Gemüse gründlich waschen und trocken schleudern.",
    "Blattsalat in mundgerechte Stücke zupfen oder schneiden — Messer vermeidet braune Schnittkanten.",
    "Festes Gemüse (Gurke, Paprika, Tomaten) in gleichmäßige Stücke schneiden, separat lagern.",
    "Dressing in kleiner Schüssel: Öl, Essig, Senf, Salz, Pfeffer mit Schneebesen emulgieren.",
    "Käse, Nüsse oder Croutons erst kurz vor dem Servieren zugeben (sonst weich).",
    "Salat mit Dressing vermengen — nur so viel, dass Blätter glänzen, nicht schwimmen.",
    "Sofort auf kühlen Tellern anrichten; bei Meal Prep Dressing separat mitgeben."
  ]
}$g$::jsonb,
  1050,
  NULL,
  'Beilage / Salat'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Linsensalat');

-- Kartoffelpüree
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Kartoffelpüree',
  4,
  $g${
  "titel": "Kartoffelpüree",
  "portionen": 4,
  "kategorie": "Beilage / Salat",
  "geschaetzte_kcal_gesamt": 800,
  "zutaten": [
    {
      "name": "Kartoffeln",
      "menge": 1000,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Essig",
      "menge": 3,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Senf",
      "menge": 1,
      "einheit": "TL",
      "aus_lager": false
    },
    {
      "name": "Öl",
      "menge": 4,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Gurken",
      "menge": 150,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Schnittlauch",
      "menge": 20,
      "einheit": "g",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Alle Zutaten laut Rezept abwiegen und bereitstellen; Arbeitsfläche und Utensilien griffbereit legen.",
    "Schrittweise nach Rezept vorgehen: zuerst lange Garzeiten (Ofen, Topf), parallel kurze Arbeiten.",
    "Temperaturen mit Thermometer oder Uhr kontrollieren, nicht nur nach Gefühl bei Fleisch und Backen.",
    "Zwischenproben abschmecken, Würzung erst am Ende nicht vergessen.",
    "Anrichten auf vorgewärmten Tellern, sofort servieren oder kühl stellen laut Haltbarkeit."
  ]
}$g$::jsonb,
  800,
  NULL,
  'Beilage / Salat'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Kartoffelpüree');

-- Ofengemüse bunt
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Ofengemüse bunt',
  4,
  $g${
  "titel": "Ofengemüse bunt",
  "portionen": 4,
  "kategorie": "Beilage / Salat",
  "geschaetzte_kcal_gesamt": 800,
  "zutaten": [
    {
      "name": "Salat oder Gemüse",
      "menge": 400,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Olivenöl",
      "menge": 3,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Essig",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Senf",
      "menge": 1,
      "einheit": "TL",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 0.5,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Kräuter",
      "menge": 15,
      "einheit": "g",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Alle Zutaten laut Rezept abwiegen und bereitstellen; Arbeitsfläche und Utensilien griffbereit legen.",
    "Schrittweise nach Rezept vorgehen: zuerst lange Garzeiten (Ofen, Topf), parallel kurze Arbeiten.",
    "Temperaturen mit Thermometer oder Uhr kontrollieren, nicht nur nach Gefühl bei Fleisch und Backen.",
    "Zwischenproben abschmecken, Würzung erst am Ende nicht vergessen.",
    "Anrichten auf vorgewärmten Tellern, sofort servieren oder kühl stellen laut Haltbarkeit."
  ]
}$g$::jsonb,
  800,
  NULL,
  'Beilage / Salat'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Ofengemüse bunt');

-- Quinoa-Beilage
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Quinoa-Beilage',
  4,
  $g${
  "titel": "Quinoa-Beilage",
  "portionen": 4,
  "kategorie": "Beilage / Salat",
  "geschaetzte_kcal_gesamt": 847,
  "zutaten": [
    {
      "name": "Salat oder Gemüse",
      "menge": 400,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Olivenöl",
      "menge": 3,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Essig",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Senf",
      "menge": 1,
      "einheit": "TL",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 0.5,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Kräuter",
      "menge": 15,
      "einheit": "g",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Alle Zutaten laut Rezept abwiegen und bereitstellen; Arbeitsfläche und Utensilien griffbereit legen.",
    "Schrittweise nach Rezept vorgehen: zuerst lange Garzeiten (Ofen, Topf), parallel kurze Arbeiten.",
    "Temperaturen mit Thermometer oder Uhr kontrollieren, nicht nur nach Gefühl bei Fleisch und Backen.",
    "Zwischenproben abschmecken, Würzung erst am Ende nicht vergessen.",
    "Anrichten auf vorgewärmten Tellern, sofort servieren oder kühl stellen laut Haltbarkeit."
  ]
}$g$::jsonb,
  847,
  NULL,
  'Beilage / Salat'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Quinoa-Beilage');

-- Bulgur-Beilage
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Bulgur-Beilage',
  4,
  $g${
  "titel": "Bulgur-Beilage",
  "portionen": 4,
  "kategorie": "Beilage / Salat",
  "geschaetzte_kcal_gesamt": 851,
  "zutaten": [
    {
      "name": "Salat oder Gemüse",
      "menge": 400,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Olivenöl",
      "menge": 3,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Essig",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Senf",
      "menge": 1,
      "einheit": "TL",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 0.5,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Kräuter",
      "menge": 15,
      "einheit": "g",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Alle Zutaten laut Rezept abwiegen und bereitstellen; Arbeitsfläche und Utensilien griffbereit legen.",
    "Schrittweise nach Rezept vorgehen: zuerst lange Garzeiten (Ofen, Topf), parallel kurze Arbeiten.",
    "Temperaturen mit Thermometer oder Uhr kontrollieren, nicht nur nach Gefühl bei Fleisch und Backen.",
    "Zwischenproben abschmecken, Würzung erst am Ende nicht vergessen.",
    "Anrichten auf vorgewärmten Tellern, sofort servieren oder kühl stellen laut Haltbarkeit."
  ]
}$g$::jsonb,
  851,
  NULL,
  'Beilage / Salat'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Bulgur-Beilage');

-- Kartoffel-Erbsen-Beilage
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Kartoffel-Erbsen-Beilage',
  4,
  $g${
  "titel": "Kartoffel-Erbsen-Beilage",
  "portionen": 4,
  "kategorie": "Beilage / Salat",
  "geschaetzte_kcal_gesamt": 1004,
  "zutaten": [
    {
      "name": "Kartoffeln",
      "menge": 1000,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Essig",
      "menge": 3,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Senf",
      "menge": 1,
      "einheit": "TL",
      "aus_lager": false
    },
    {
      "name": "Öl",
      "menge": 4,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Gurken",
      "menge": 150,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Schnittlauch",
      "menge": 20,
      "einheit": "g",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Alle Zutaten laut Rezept abwiegen und bereitstellen; Arbeitsfläche und Utensilien griffbereit legen.",
    "Schrittweise nach Rezept vorgehen: zuerst lange Garzeiten (Ofen, Topf), parallel kurze Arbeiten.",
    "Temperaturen mit Thermometer oder Uhr kontrollieren, nicht nur nach Gefühl bei Fleisch und Backen.",
    "Zwischenproben abschmecken, Würzung erst am Ende nicht vergessen.",
    "Anrichten auf vorgewärmten Tellern, sofort servieren oder kühl stellen laut Haltbarkeit."
  ]
}$g$::jsonb,
  1004,
  NULL,
  'Beilage / Salat'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Kartoffel-Erbsen-Beilage');

-- Blumenkohl-Püree
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Blumenkohl-Püree',
  4,
  $g${
  "titel": "Blumenkohl-Püree",
  "portionen": 4,
  "kategorie": "Beilage / Salat",
  "geschaetzte_kcal_gesamt": 834,
  "zutaten": [
    {
      "name": "Salat oder Gemüse",
      "menge": 400,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Olivenöl",
      "menge": 3,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Essig",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Senf",
      "menge": 1,
      "einheit": "TL",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 0.5,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Kräuter",
      "menge": 15,
      "einheit": "g",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Alle Zutaten laut Rezept abwiegen und bereitstellen; Arbeitsfläche und Utensilien griffbereit legen.",
    "Schrittweise nach Rezept vorgehen: zuerst lange Garzeiten (Ofen, Topf), parallel kurze Arbeiten.",
    "Temperaturen mit Thermometer oder Uhr kontrollieren, nicht nur nach Gefühl bei Fleisch und Backen.",
    "Zwischenproben abschmecken, Würzung erst am Ende nicht vergessen.",
    "Anrichten auf vorgewärmten Tellern, sofort servieren oder kühl stellen laut Haltbarkeit."
  ]
}$g$::jsonb,
  834,
  NULL,
  'Beilage / Salat'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Blumenkohl-Püree');

-- Krautsalat
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Krautsalat',
  4,
  $g${
  "titel": "Krautsalat",
  "portionen": 4,
  "kategorie": "Beilage / Salat",
  "geschaetzte_kcal_gesamt": 952,
  "zutaten": [
    {
      "name": "Salat oder Gemüse",
      "menge": 400,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Olivenöl",
      "menge": 3,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Essig",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Senf",
      "menge": 1,
      "einheit": "TL",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 0.5,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Kräuter",
      "menge": 15,
      "einheit": "g",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Salatschüssel und große Schüssel mit kaltem Wasser bereitstellen; Gemüse gründlich waschen und trocken schleudern.",
    "Blattsalat in mundgerechte Stücke zupfen oder schneiden — Messer vermeidet braune Schnittkanten.",
    "Festes Gemüse (Gurke, Paprika, Tomaten) in gleichmäßige Stücke schneiden, separat lagern.",
    "Dressing in kleiner Schüssel: Öl, Essig, Senf, Salz, Pfeffer mit Schneebesen emulgieren.",
    "Käse, Nüsse oder Croutons erst kurz vor dem Servieren zugeben (sonst weich).",
    "Salat mit Dressing vermengen — nur so viel, dass Blätter glänzen, nicht schwimmen.",
    "Sofort auf kühlen Tellern anrichten; bei Meal Prep Dressing separat mitgeben."
  ]
}$g$::jsonb,
  952,
  NULL,
  'Beilage / Salat'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Krautsalat');

-- Feldsalat mit Speck
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Feldsalat mit Speck',
  4,
  $g${
  "titel": "Feldsalat mit Speck",
  "portionen": 4,
  "kategorie": "Beilage / Salat",
  "geschaetzte_kcal_gesamt": 908,
  "zutaten": [
    {
      "name": "Salat oder Gemüse",
      "menge": 400,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Olivenöl",
      "menge": 3,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Essig",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Senf",
      "menge": 1,
      "einheit": "TL",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 0.5,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Kräuter",
      "menge": 15,
      "einheit": "g",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Salatschüssel und große Schüssel mit kaltem Wasser bereitstellen; Gemüse gründlich waschen und trocken schleudern.",
    "Blattsalat in mundgerechte Stücke zupfen oder schneiden — Messer vermeidet braune Schnittkanten.",
    "Festes Gemüse (Gurke, Paprika, Tomaten) in gleichmäßige Stücke schneiden, separat lagern.",
    "Dressing in kleiner Schüssel: Öl, Essig, Senf, Salz, Pfeffer mit Schneebesen emulgieren.",
    "Käse, Nüsse oder Croutons erst kurz vor dem Servieren zugeben (sonst weich).",
    "Salat mit Dressing vermengen — nur so viel, dass Blätter glänzen, nicht schwimmen.",
    "Sofort auf kühlen Tellern anrichten; bei Meal Prep Dressing separat mitgeben."
  ]
}$g$::jsonb,
  908,
  NULL,
  'Beilage / Salat'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Feldsalat mit Speck');

-- Kartoffel-Laibchen
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Kartoffel-Laibchen',
  4,
  $g${
  "titel": "Kartoffel-Laibchen",
  "portionen": 4,
  "kategorie": "Beilage / Salat",
  "geschaetzte_kcal_gesamt": 861,
  "zutaten": [
    {
      "name": "Kartoffeln",
      "menge": 1000,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Essig",
      "menge": 3,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Senf",
      "menge": 1,
      "einheit": "TL",
      "aus_lager": false
    },
    {
      "name": "Öl",
      "menge": 4,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Gurken",
      "menge": 150,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Schnittlauch",
      "menge": 20,
      "einheit": "g",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Alle Zutaten laut Rezept abwiegen und bereitstellen; Arbeitsfläche und Utensilien griffbereit legen.",
    "Schrittweise nach Rezept vorgehen: zuerst lange Garzeiten (Ofen, Topf), parallel kurze Arbeiten.",
    "Temperaturen mit Thermometer oder Uhr kontrollieren, nicht nur nach Gefühl bei Fleisch und Backen.",
    "Zwischenproben abschmecken, Würzung erst am Ende nicht vergessen.",
    "Anrichten auf vorgewärmten Tellern, sofort servieren oder kühl stellen laut Haltbarkeit."
  ]
}$g$::jsonb,
  861,
  NULL,
  'Beilage / Salat'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Kartoffel-Laibchen');

-- Schokoladenkuchen
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Schokoladenkuchen',
  8,
  $g${
  "titel": "Schokoladenkuchen",
  "portionen": 8,
  "kategorie": "Dessert / Backen",
  "geschaetzte_kcal_gesamt": 2169,
  "zutaten": [
    {
      "name": "Weizenmehl",
      "menge": 200,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Zucker",
      "menge": 200,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Kakaopulver",
      "menge": 50,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Eier",
      "menge": 3,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Butter",
      "menge": 150,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Backpulver",
      "menge": 1,
      "einheit": "Päckchen",
      "aus_lager": false
    },
    {
      "name": "Milch",
      "menge": 150,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Vanillezucker",
      "menge": 1,
      "einheit": "Päckchen",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Ofen auf 175 °C vorheizen; Backform fetten oder mit Papier auslegen, Zutaten auf Raumtemperatur bringen.",
    "Trockene Zutaten (Mehl, Backpulver, Kakao) in einer Schüssel sieben, verrühren.",
    "Butter/Zucker oder Eier nach Rezept schaumig rühren (Handrührer Stufe 2–3, 3–5 Min).",
    "Mehlmischung unterheben — nur bis kein Mehl mehr sichtbar (Überrühren macht trocken).",
    "Teig in die Form füllen, Oberfläche glatt streichen, ggf. Kerne oder Streusel darauf.",
    "Backzeit laut Rezept; Stäbchenprobe: Holzspieß kommt sauber heraus (außer Brownies: feuchte Krümel).",
    "Form 10 Min auf dem Rost abkühlen, dann stürzen oder Stücke schneiden.",
    "Vollständig abgekühlt lagern oder lauwarm mit Sahne servieren."
  ]
}$g$::jsonb,
  2169,
  NULL,
  'Dessert / Backen'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Schokoladenkuchen');

-- Käsekuchen ohne Boden
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Käsekuchen ohne Boden',
  8,
  $g${
  "titel": "Käsekuchen ohne Boden",
  "portionen": 8,
  "kategorie": "Dessert / Backen",
  "geschaetzte_kcal_gesamt": 2135,
  "zutaten": [
    {
      "name": "Weizenmehl",
      "menge": 250,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Zucker",
      "menge": 150,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Eier",
      "menge": 3,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Butter",
      "menge": 150,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Backpulver",
      "menge": 1,
      "einheit": "Päckchen",
      "aus_lager": false
    },
    {
      "name": "Vanillezucker",
      "menge": 1,
      "einheit": "Päckchen",
      "aus_lager": false
    },
    {
      "name": "Milch",
      "menge": 200,
      "einheit": "ml",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Ofen auf 175 °C vorheizen; Backform fetten oder mit Papier auslegen, Zutaten auf Raumtemperatur bringen.",
    "Trockene Zutaten (Mehl, Backpulver, Kakao) in einer Schüssel sieben, verrühren.",
    "Butter/Zucker oder Eier nach Rezept schaumig rühren (Handrührer Stufe 2–3, 3–5 Min).",
    "Mehlmischung unterheben — nur bis kein Mehl mehr sichtbar (Überrühren macht trocken).",
    "Teig in die Form füllen, Oberfläche glatt streichen, ggf. Kerne oder Streusel darauf.",
    "Backzeit laut Rezept; Stäbchenprobe: Holzspieß kommt sauber heraus (außer Brownies: feuchte Krümel).",
    "Form 10 Min auf dem Rost abkühlen, dann stürzen oder Stücke schneiden.",
    "Vollständig abgekühlt lagern oder lauwarm mit Sahne servieren."
  ]
}$g$::jsonb,
  2135,
  NULL,
  'Dessert / Backen'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Käsekuchen ohne Boden');

-- Apfelkuchen vom Blech
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Apfelkuchen vom Blech',
  8,
  $g${
  "titel": "Apfelkuchen vom Blech",
  "portionen": 8,
  "kategorie": "Dessert / Backen",
  "geschaetzte_kcal_gesamt": 2006,
  "zutaten": [
    {
      "name": "Weizenmehl",
      "menge": 250,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Zucker",
      "menge": 150,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Eier",
      "menge": 3,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Butter",
      "menge": 150,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Backpulver",
      "menge": 1,
      "einheit": "Päckchen",
      "aus_lager": false
    },
    {
      "name": "Vanillezucker",
      "menge": 1,
      "einheit": "Päckchen",
      "aus_lager": false
    },
    {
      "name": "Milch",
      "menge": 200,
      "einheit": "ml",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Ofen auf 175 °C vorheizen; Backform fetten oder mit Papier auslegen, Zutaten auf Raumtemperatur bringen.",
    "Trockene Zutaten (Mehl, Backpulver, Kakao) in einer Schüssel sieben, verrühren.",
    "Butter/Zucker oder Eier nach Rezept schaumig rühren (Handrührer Stufe 2–3, 3–5 Min).",
    "Mehlmischung unterheben — nur bis kein Mehl mehr sichtbar (Überrühren macht trocken).",
    "Teig in die Form füllen, Oberfläche glatt streichen, ggf. Kerne oder Streusel darauf.",
    "Backzeit laut Rezept; Stäbchenprobe: Holzspieß kommt sauber heraus (außer Brownies: feuchte Krümel).",
    "Form 10 Min auf dem Rost abkühlen, dann stürzen oder Stücke schneiden.",
    "Vollständig abgekühlt lagern oder lauwarm mit Sahne servieren."
  ]
}$g$::jsonb,
  2006,
  NULL,
  'Dessert / Backen'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Apfelkuchen vom Blech');

-- Brownies
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Brownies',
  8,
  $g${
  "titel": "Brownies",
  "portionen": 8,
  "kategorie": "Dessert / Backen",
  "geschaetzte_kcal_gesamt": 2041,
  "zutaten": [
    {
      "name": "Weizenmehl",
      "menge": 250,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Zucker",
      "menge": 150,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Eier",
      "menge": 3,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Butter",
      "menge": 150,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Backpulver",
      "menge": 1,
      "einheit": "Päckchen",
      "aus_lager": false
    },
    {
      "name": "Vanillezucker",
      "menge": 1,
      "einheit": "Päckchen",
      "aus_lager": false
    },
    {
      "name": "Milch",
      "menge": 200,
      "einheit": "ml",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Ofen auf 175 °C vorheizen; Backform fetten oder mit Papier auslegen, Zutaten auf Raumtemperatur bringen.",
    "Trockene Zutaten (Mehl, Backpulver, Kakao) in einer Schüssel sieben, verrühren.",
    "Butter/Zucker oder Eier nach Rezept schaumig rühren (Handrührer Stufe 2–3, 3–5 Min).",
    "Mehlmischung unterheben — nur bis kein Mehl mehr sichtbar (Überrühren macht trocken).",
    "Teig in die Form füllen, Oberfläche glatt streichen, ggf. Kerne oder Streusel darauf.",
    "Backzeit laut Rezept; Stäbchenprobe: Holzspieß kommt sauber heraus (außer Brownies: feuchte Krümel).",
    "Form 10 Min auf dem Rost abkühlen, dann stürzen oder Stücke schneiden.",
    "Vollständig abgekühlt lagern oder lauwarm mit Sahne servieren."
  ]
}$g$::jsonb,
  2041,
  NULL,
  'Dessert / Backen'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Brownies');

-- Vanillepudding
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Vanillepudding',
  8,
  $g${
  "titel": "Vanillepudding",
  "portionen": 8,
  "kategorie": "Dessert / Backen",
  "geschaetzte_kcal_gesamt": 2262,
  "zutaten": [
    {
      "name": "Weizenmehl",
      "menge": 250,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Zucker",
      "menge": 150,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Eier",
      "menge": 3,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Butter",
      "menge": 150,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Backpulver",
      "menge": 1,
      "einheit": "Päckchen",
      "aus_lager": false
    },
    {
      "name": "Vanillezucker",
      "menge": 1,
      "einheit": "Päckchen",
      "aus_lager": false
    },
    {
      "name": "Milch",
      "menge": 200,
      "einheit": "ml",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Ofen auf 175 °C vorheizen; Backform fetten oder mit Papier auslegen, Zutaten auf Raumtemperatur bringen.",
    "Trockene Zutaten (Mehl, Backpulver, Kakao) in einer Schüssel sieben, verrühren.",
    "Butter/Zucker oder Eier nach Rezept schaumig rühren (Handrührer Stufe 2–3, 3–5 Min).",
    "Mehlmischung unterheben — nur bis kein Mehl mehr sichtbar (Überrühren macht trocken).",
    "Teig in die Form füllen, Oberfläche glatt streichen, ggf. Kerne oder Streusel darauf.",
    "Backzeit laut Rezept; Stäbchenprobe: Holzspieß kommt sauber heraus (außer Brownies: feuchte Krümel).",
    "Form 10 Min auf dem Rost abkühlen, dann stürzen oder Stücke schneiden.",
    "Vollständig abgekühlt lagern oder lauwarm mit Sahne servieren."
  ]
}$g$::jsonb,
  2262,
  NULL,
  'Dessert / Backen'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Vanillepudding');

-- Crème brûlée
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Crème brûlée',
  8,
  $g${
  "titel": "Crème brûlée",
  "portionen": 8,
  "kategorie": "Dessert / Backen",
  "geschaetzte_kcal_gesamt": 2360,
  "zutaten": [
    {
      "name": "Weizenmehl",
      "menge": 250,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Zucker",
      "menge": 150,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Eier",
      "menge": 3,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Butter",
      "menge": 150,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Backpulver",
      "menge": 1,
      "einheit": "Päckchen",
      "aus_lager": false
    },
    {
      "name": "Vanillezucker",
      "menge": 1,
      "einheit": "Päckchen",
      "aus_lager": false
    },
    {
      "name": "Milch",
      "menge": 200,
      "einheit": "ml",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Ofen auf 175 °C vorheizen; Backform fetten oder mit Papier auslegen, Zutaten auf Raumtemperatur bringen.",
    "Trockene Zutaten (Mehl, Backpulver, Kakao) in einer Schüssel sieben, verrühren.",
    "Butter/Zucker oder Eier nach Rezept schaumig rühren (Handrührer Stufe 2–3, 3–5 Min).",
    "Mehlmischung unterheben — nur bis kein Mehl mehr sichtbar (Überrühren macht trocken).",
    "Teig in die Form füllen, Oberfläche glatt streichen, ggf. Kerne oder Streusel darauf.",
    "Backzeit laut Rezept; Stäbchenprobe: Holzspieß kommt sauber heraus (außer Brownies: feuchte Krümel).",
    "Form 10 Min auf dem Rost abkühlen, dann stürzen oder Stücke schneiden.",
    "Vollständig abgekühlt lagern oder lauwarm mit Sahne servieren."
  ]
}$g$::jsonb,
  2360,
  NULL,
  'Dessert / Backen'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Crème brûlée');

-- Tiramisu
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Tiramisu',
  8,
  $g${
  "titel": "Tiramisu",
  "portionen": 8,
  "kategorie": "Dessert / Backen",
  "geschaetzte_kcal_gesamt": 2046,
  "zutaten": [
    {
      "name": "Weizenmehl",
      "menge": 250,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Zucker",
      "menge": 150,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Eier",
      "menge": 3,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Butter",
      "menge": 150,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Backpulver",
      "menge": 1,
      "einheit": "Päckchen",
      "aus_lager": false
    },
    {
      "name": "Vanillezucker",
      "menge": 1,
      "einheit": "Päckchen",
      "aus_lager": false
    },
    {
      "name": "Milch",
      "menge": 200,
      "einheit": "ml",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Ofen auf 175 °C vorheizen; Backform fetten oder mit Papier auslegen, Zutaten auf Raumtemperatur bringen.",
    "Trockene Zutaten (Mehl, Backpulver, Kakao) in einer Schüssel sieben, verrühren.",
    "Butter/Zucker oder Eier nach Rezept schaumig rühren (Handrührer Stufe 2–3, 3–5 Min).",
    "Mehlmischung unterheben — nur bis kein Mehl mehr sichtbar (Überrühren macht trocken).",
    "Teig in die Form füllen, Oberfläche glatt streichen, ggf. Kerne oder Streusel darauf.",
    "Backzeit laut Rezept; Stäbchenprobe: Holzspieß kommt sauber heraus (außer Brownies: feuchte Krümel).",
    "Form 10 Min auf dem Rost abkühlen, dann stürzen oder Stücke schneiden.",
    "Vollständig abgekühlt lagern oder lauwarm mit Sahne servieren."
  ]
}$g$::jsonb,
  2046,
  NULL,
  'Dessert / Backen'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Tiramisu');

-- Panna Cotta
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Panna Cotta',
  8,
  $g${
  "titel": "Panna Cotta",
  "portionen": 8,
  "kategorie": "Dessert / Backen",
  "geschaetzte_kcal_gesamt": 2233,
  "zutaten": [
    {
      "name": "Weizenmehl",
      "menge": 250,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Zucker",
      "menge": 150,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Eier",
      "menge": 3,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Butter",
      "menge": 150,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Backpulver",
      "menge": 1,
      "einheit": "Päckchen",
      "aus_lager": false
    },
    {
      "name": "Vanillezucker",
      "menge": 1,
      "einheit": "Päckchen",
      "aus_lager": false
    },
    {
      "name": "Milch",
      "menge": 200,
      "einheit": "ml",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Ofen auf 175 °C vorheizen; Backform fetten oder mit Papier auslegen, Zutaten auf Raumtemperatur bringen.",
    "Trockene Zutaten (Mehl, Backpulver, Kakao) in einer Schüssel sieben, verrühren.",
    "Butter/Zucker oder Eier nach Rezept schaumig rühren (Handrührer Stufe 2–3, 3–5 Min).",
    "Mehlmischung unterheben — nur bis kein Mehl mehr sichtbar (Überrühren macht trocken).",
    "Teig in die Form füllen, Oberfläche glatt streichen, ggf. Kerne oder Streusel darauf.",
    "Backzeit laut Rezept; Stäbchenprobe: Holzspieß kommt sauber heraus (außer Brownies: feuchte Krümel).",
    "Form 10 Min auf dem Rost abkühlen, dann stürzen oder Stücke schneiden.",
    "Vollständig abgekühlt lagern oder lauwarm mit Sahne servieren."
  ]
}$g$::jsonb,
  2233,
  NULL,
  'Dessert / Backen'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Panna Cotta');

-- Zitronenkuchen
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Zitronenkuchen',
  8,
  $g${
  "titel": "Zitronenkuchen",
  "portionen": 8,
  "kategorie": "Dessert / Backen",
  "geschaetzte_kcal_gesamt": 2295,
  "zutaten": [
    {
      "name": "Weizenmehl",
      "menge": 250,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Zucker",
      "menge": 150,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Eier",
      "menge": 3,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Butter",
      "menge": 150,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Backpulver",
      "menge": 1,
      "einheit": "Päckchen",
      "aus_lager": false
    },
    {
      "name": "Vanillezucker",
      "menge": 1,
      "einheit": "Päckchen",
      "aus_lager": false
    },
    {
      "name": "Milch",
      "menge": 200,
      "einheit": "ml",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Ofen auf 175 °C vorheizen; Backform fetten oder mit Papier auslegen, Zutaten auf Raumtemperatur bringen.",
    "Trockene Zutaten (Mehl, Backpulver, Kakao) in einer Schüssel sieben, verrühren.",
    "Butter/Zucker oder Eier nach Rezept schaumig rühren (Handrührer Stufe 2–3, 3–5 Min).",
    "Mehlmischung unterheben — nur bis kein Mehl mehr sichtbar (Überrühren macht trocken).",
    "Teig in die Form füllen, Oberfläche glatt streichen, ggf. Kerne oder Streusel darauf.",
    "Backzeit laut Rezept; Stäbchenprobe: Holzspieß kommt sauber heraus (außer Brownies: feuchte Krümel).",
    "Form 10 Min auf dem Rost abkühlen, dann stürzen oder Stücke schneiden.",
    "Vollständig abgekühlt lagern oder lauwarm mit Sahne servieren."
  ]
}$g$::jsonb,
  2295,
  NULL,
  'Dessert / Backen'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Zitronenkuchen');

-- Marmorkuchen
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Marmorkuchen',
  8,
  $g${
  "titel": "Marmorkuchen",
  "portionen": 8,
  "kategorie": "Dessert / Backen",
  "geschaetzte_kcal_gesamt": 2060,
  "zutaten": [
    {
      "name": "Weizenmehl",
      "menge": 250,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Zucker",
      "menge": 150,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Eier",
      "menge": 3,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Butter",
      "menge": 150,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Backpulver",
      "menge": 1,
      "einheit": "Päckchen",
      "aus_lager": false
    },
    {
      "name": "Vanillezucker",
      "menge": 1,
      "einheit": "Päckchen",
      "aus_lager": false
    },
    {
      "name": "Milch",
      "menge": 200,
      "einheit": "ml",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Ofen auf 175 °C vorheizen; Backform fetten oder mit Papier auslegen, Zutaten auf Raumtemperatur bringen.",
    "Trockene Zutaten (Mehl, Backpulver, Kakao) in einer Schüssel sieben, verrühren.",
    "Butter/Zucker oder Eier nach Rezept schaumig rühren (Handrührer Stufe 2–3, 3–5 Min).",
    "Mehlmischung unterheben — nur bis kein Mehl mehr sichtbar (Überrühren macht trocken).",
    "Teig in die Form füllen, Oberfläche glatt streichen, ggf. Kerne oder Streusel darauf.",
    "Backzeit laut Rezept; Stäbchenprobe: Holzspieß kommt sauber heraus (außer Brownies: feuchte Krümel).",
    "Form 10 Min auf dem Rost abkühlen, dann stürzen oder Stücke schneiden.",
    "Vollständig abgekühlt lagern oder lauwarm mit Sahne servieren."
  ]
}$g$::jsonb,
  2060,
  NULL,
  'Dessert / Backen'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Marmorkuchen');

-- Plätzchen Butter
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Plätzchen Butter',
  8,
  $g${
  "titel": "Plätzchen Butter",
  "portionen": 8,
  "kategorie": "Dessert / Backen",
  "geschaetzte_kcal_gesamt": 2130,
  "zutaten": [
    {
      "name": "Weizenmehl",
      "menge": 250,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Zucker",
      "menge": 150,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Eier",
      "menge": 3,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Butter",
      "menge": 150,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Backpulver",
      "menge": 1,
      "einheit": "Päckchen",
      "aus_lager": false
    },
    {
      "name": "Vanillezucker",
      "menge": 1,
      "einheit": "Päckchen",
      "aus_lager": false
    },
    {
      "name": "Milch",
      "menge": 200,
      "einheit": "ml",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Ofen auf 175 °C vorheizen; Backform fetten oder mit Papier auslegen, Zutaten auf Raumtemperatur bringen.",
    "Trockene Zutaten (Mehl, Backpulver, Kakao) in einer Schüssel sieben, verrühren.",
    "Butter/Zucker oder Eier nach Rezept schaumig rühren (Handrührer Stufe 2–3, 3–5 Min).",
    "Mehlmischung unterheben — nur bis kein Mehl mehr sichtbar (Überrühren macht trocken).",
    "Teig in die Form füllen, Oberfläche glatt streichen, ggf. Kerne oder Streusel darauf.",
    "Backzeit laut Rezept; Stäbchenprobe: Holzspieß kommt sauber heraus (außer Brownies: feuchte Krümel).",
    "Form 10 Min auf dem Rost abkühlen, dann stürzen oder Stücke schneiden.",
    "Vollständig abgekühlt lagern oder lauwarm mit Sahne servieren."
  ]
}$g$::jsonb,
  2130,
  NULL,
  'Dessert / Backen'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Plätzchen Butter');

-- Streuselkuchen
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Streuselkuchen',
  8,
  $g${
  "titel": "Streuselkuchen",
  "portionen": 8,
  "kategorie": "Dessert / Backen",
  "geschaetzte_kcal_gesamt": 2293,
  "zutaten": [
    {
      "name": "Weizenmehl",
      "menge": 250,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Zucker",
      "menge": 150,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Eier",
      "menge": 3,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Butter",
      "menge": 150,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Backpulver",
      "menge": 1,
      "einheit": "Päckchen",
      "aus_lager": false
    },
    {
      "name": "Vanillezucker",
      "menge": 1,
      "einheit": "Päckchen",
      "aus_lager": false
    },
    {
      "name": "Milch",
      "menge": 200,
      "einheit": "ml",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Ofen auf 175 °C vorheizen; Backform fetten oder mit Papier auslegen, Zutaten auf Raumtemperatur bringen.",
    "Trockene Zutaten (Mehl, Backpulver, Kakao) in einer Schüssel sieben, verrühren.",
    "Butter/Zucker oder Eier nach Rezept schaumig rühren (Handrührer Stufe 2–3, 3–5 Min).",
    "Mehlmischung unterheben — nur bis kein Mehl mehr sichtbar (Überrühren macht trocken).",
    "Teig in die Form füllen, Oberfläche glatt streichen, ggf. Kerne oder Streusel darauf.",
    "Backzeit laut Rezept; Stäbchenprobe: Holzspieß kommt sauber heraus (außer Brownies: feuchte Krümel).",
    "Form 10 Min auf dem Rost abkühlen, dann stürzen oder Stücke schneiden.",
    "Vollständig abgekühlt lagern oder lauwarm mit Sahne servieren."
  ]
}$g$::jsonb,
  2293,
  NULL,
  'Dessert / Backen'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Streuselkuchen');

-- Schwarzwälder Kirsch
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Schwarzwälder Kirsch',
  8,
  $g${
  "titel": "Schwarzwälder Kirsch",
  "portionen": 8,
  "kategorie": "Dessert / Backen",
  "geschaetzte_kcal_gesamt": 2152,
  "zutaten": [
    {
      "name": "Weizenmehl",
      "menge": 250,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Zucker",
      "menge": 150,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Eier",
      "menge": 3,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Butter",
      "menge": 150,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Backpulver",
      "menge": 1,
      "einheit": "Päckchen",
      "aus_lager": false
    },
    {
      "name": "Vanillezucker",
      "menge": 1,
      "einheit": "Päckchen",
      "aus_lager": false
    },
    {
      "name": "Milch",
      "menge": 200,
      "einheit": "ml",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Ofen auf 175 °C vorheizen; Backform fetten oder mit Papier auslegen, Zutaten auf Raumtemperatur bringen.",
    "Trockene Zutaten (Mehl, Backpulver, Kakao) in einer Schüssel sieben, verrühren.",
    "Butter/Zucker oder Eier nach Rezept schaumig rühren (Handrührer Stufe 2–3, 3–5 Min).",
    "Mehlmischung unterheben — nur bis kein Mehl mehr sichtbar (Überrühren macht trocken).",
    "Teig in die Form füllen, Oberfläche glatt streichen, ggf. Kerne oder Streusel darauf.",
    "Backzeit laut Rezept; Stäbchenprobe: Holzspieß kommt sauber heraus (außer Brownies: feuchte Krümel).",
    "Form 10 Min auf dem Rost abkühlen, dann stürzen oder Stücke schneiden.",
    "Vollständig abgekühlt lagern oder lauwarm mit Sahne servieren."
  ]
}$g$::jsonb,
  2152,
  NULL,
  'Dessert / Backen'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Schwarzwälder Kirsch');

-- Rote Grütze
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Rote Grütze',
  8,
  $g${
  "titel": "Rote Grütze",
  "portionen": 8,
  "kategorie": "Dessert / Backen",
  "geschaetzte_kcal_gesamt": 2018,
  "zutaten": [
    {
      "name": "Weizenmehl",
      "menge": 250,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Zucker",
      "menge": 150,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Eier",
      "menge": 3,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Butter",
      "menge": 150,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Backpulver",
      "menge": 1,
      "einheit": "Päckchen",
      "aus_lager": false
    },
    {
      "name": "Vanillezucker",
      "menge": 1,
      "einheit": "Päckchen",
      "aus_lager": false
    },
    {
      "name": "Milch",
      "menge": 200,
      "einheit": "ml",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Ofen auf 175 °C vorheizen; Backform fetten oder mit Papier auslegen, Zutaten auf Raumtemperatur bringen.",
    "Trockene Zutaten (Mehl, Backpulver, Kakao) in einer Schüssel sieben, verrühren.",
    "Butter/Zucker oder Eier nach Rezept schaumig rühren (Handrührer Stufe 2–3, 3–5 Min).",
    "Mehlmischung unterheben — nur bis kein Mehl mehr sichtbar (Überrühren macht trocken).",
    "Teig in die Form füllen, Oberfläche glatt streichen, ggf. Kerne oder Streusel darauf.",
    "Backzeit laut Rezept; Stäbchenprobe: Holzspieß kommt sauber heraus (außer Brownies: feuchte Krümel).",
    "Form 10 Min auf dem Rost abkühlen, dann stürzen oder Stücke schneiden.",
    "Vollständig abgekühlt lagern oder lauwarm mit Sahne servieren."
  ]
}$g$::jsonb,
  2018,
  NULL,
  'Dessert / Backen'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Rote Grütze');

-- Milchreis
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Milchreis',
  8,
  $g${
  "titel": "Milchreis",
  "portionen": 8,
  "kategorie": "Dessert / Backen",
  "geschaetzte_kcal_gesamt": 2128,
  "zutaten": [
    {
      "name": "Weizenmehl",
      "menge": 250,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Zucker",
      "menge": 150,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Eier",
      "menge": 3,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Butter",
      "menge": 150,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Backpulver",
      "menge": 1,
      "einheit": "Päckchen",
      "aus_lager": false
    },
    {
      "name": "Vanillezucker",
      "menge": 1,
      "einheit": "Päckchen",
      "aus_lager": false
    },
    {
      "name": "Milch",
      "menge": 200,
      "einheit": "ml",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Ofen auf 175 °C vorheizen; Backform fetten oder mit Papier auslegen, Zutaten auf Raumtemperatur bringen.",
    "Trockene Zutaten (Mehl, Backpulver, Kakao) in einer Schüssel sieben, verrühren.",
    "Butter/Zucker oder Eier nach Rezept schaumig rühren (Handrührer Stufe 2–3, 3–5 Min).",
    "Mehlmischung unterheben — nur bis kein Mehl mehr sichtbar (Überrühren macht trocken).",
    "Teig in die Form füllen, Oberfläche glatt streichen, ggf. Kerne oder Streusel darauf.",
    "Backzeit laut Rezept; Stäbchenprobe: Holzspieß kommt sauber heraus (außer Brownies: feuchte Krümel).",
    "Form 10 Min auf dem Rost abkühlen, dann stürzen oder Stücke schneiden.",
    "Vollständig abgekühlt lagern oder lauwarm mit Sahne servieren."
  ]
}$g$::jsonb,
  2128,
  NULL,
  'Dessert / Backen'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Milchreis');

-- Waffeln
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Waffeln',
  8,
  $g${
  "titel": "Waffeln",
  "portionen": 8,
  "kategorie": "Dessert / Backen",
  "geschaetzte_kcal_gesamt": 2307,
  "zutaten": [
    {
      "name": "Weizenmehl",
      "menge": 250,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Zucker",
      "menge": 150,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Eier",
      "menge": 3,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Butter",
      "menge": 150,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Backpulver",
      "menge": 1,
      "einheit": "Päckchen",
      "aus_lager": false
    },
    {
      "name": "Vanillezucker",
      "menge": 1,
      "einheit": "Päckchen",
      "aus_lager": false
    },
    {
      "name": "Milch",
      "menge": 200,
      "einheit": "ml",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Ofen auf 175 °C vorheizen; Backform fetten oder mit Papier auslegen, Zutaten auf Raumtemperatur bringen.",
    "Trockene Zutaten (Mehl, Backpulver, Kakao) in einer Schüssel sieben, verrühren.",
    "Butter/Zucker oder Eier nach Rezept schaumig rühren (Handrührer Stufe 2–3, 3–5 Min).",
    "Mehlmischung unterheben — nur bis kein Mehl mehr sichtbar (Überrühren macht trocken).",
    "Teig in die Form füllen, Oberfläche glatt streichen, ggf. Kerne oder Streusel darauf.",
    "Backzeit laut Rezept; Stäbchenprobe: Holzspieß kommt sauber heraus (außer Brownies: feuchte Krümel).",
    "Form 10 Min auf dem Rost abkühlen, dann stürzen oder Stücke schneiden.",
    "Vollständig abgekühlt lagern oder lauwarm mit Sahne servieren."
  ]
}$g$::jsonb,
  2307,
  NULL,
  'Dessert / Backen'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Waffeln');

-- Pfannkuchen klassisch
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Pfannkuchen klassisch',
  8,
  $g${
  "titel": "Pfannkuchen klassisch",
  "portionen": 8,
  "kategorie": "Dessert / Backen",
  "geschaetzte_kcal_gesamt": 2134,
  "zutaten": [
    {
      "name": "Weizenmehl",
      "menge": 250,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Zucker",
      "menge": 150,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Eier",
      "menge": 3,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Butter",
      "menge": 150,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Backpulver",
      "menge": 1,
      "einheit": "Päckchen",
      "aus_lager": false
    },
    {
      "name": "Vanillezucker",
      "menge": 1,
      "einheit": "Päckchen",
      "aus_lager": false
    },
    {
      "name": "Milch",
      "menge": 200,
      "einheit": "ml",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Ofen auf 175 °C vorheizen; Backform fetten oder mit Papier auslegen, Zutaten auf Raumtemperatur bringen.",
    "Trockene Zutaten (Mehl, Backpulver, Kakao) in einer Schüssel sieben, verrühren.",
    "Butter/Zucker oder Eier nach Rezept schaumig rühren (Handrührer Stufe 2–3, 3–5 Min).",
    "Mehlmischung unterheben — nur bis kein Mehl mehr sichtbar (Überrühren macht trocken).",
    "Teig in die Form füllen, Oberfläche glatt streichen, ggf. Kerne oder Streusel darauf.",
    "Backzeit laut Rezept; Stäbchenprobe: Holzspieß kommt sauber heraus (außer Brownies: feuchte Krümel).",
    "Form 10 Min auf dem Rost abkühlen, dann stürzen oder Stücke schneiden.",
    "Vollständig abgekühlt lagern oder lauwarm mit Sahne servieren."
  ]
}$g$::jsonb,
  2134,
  NULL,
  'Dessert / Backen'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Pfannkuchen klassisch');

-- Muffins Blaubeere
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Muffins Blaubeere',
  8,
  $g${
  "titel": "Muffins Blaubeere",
  "portionen": 8,
  "kategorie": "Dessert / Backen",
  "geschaetzte_kcal_gesamt": 2063,
  "zutaten": [
    {
      "name": "Weizenmehl",
      "menge": 250,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Zucker",
      "menge": 150,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Eier",
      "menge": 3,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Butter",
      "menge": 150,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Backpulver",
      "menge": 1,
      "einheit": "Päckchen",
      "aus_lager": false
    },
    {
      "name": "Vanillezucker",
      "menge": 1,
      "einheit": "Päckchen",
      "aus_lager": false
    },
    {
      "name": "Milch",
      "menge": 200,
      "einheit": "ml",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Ofen auf 175 °C vorheizen; Backform fetten oder mit Papier auslegen, Zutaten auf Raumtemperatur bringen.",
    "Trockene Zutaten (Mehl, Backpulver, Kakao) in einer Schüssel sieben, verrühren.",
    "Butter/Zucker oder Eier nach Rezept schaumig rühren (Handrührer Stufe 2–3, 3–5 Min).",
    "Mehlmischung unterheben — nur bis kein Mehl mehr sichtbar (Überrühren macht trocken).",
    "Teig in die Form füllen, Oberfläche glatt streichen, ggf. Kerne oder Streusel darauf.",
    "Backzeit laut Rezept; Stäbchenprobe: Holzspieß kommt sauber heraus (außer Brownies: feuchte Krümel).",
    "Form 10 Min auf dem Rost abkühlen, dann stürzen oder Stücke schneiden.",
    "Vollständig abgekühlt lagern oder lauwarm mit Sahne servieren."
  ]
}$g$::jsonb,
  2063,
  NULL,
  'Dessert / Backen'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Muffins Blaubeere');

-- Bananenbrot
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Bananenbrot',
  8,
  $g${
  "titel": "Bananenbrot",
  "portionen": 8,
  "kategorie": "Dessert / Backen",
  "geschaetzte_kcal_gesamt": 2330,
  "zutaten": [
    {
      "name": "Weizenmehl",
      "menge": 250,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Zucker",
      "menge": 150,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Eier",
      "menge": 3,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Butter",
      "menge": 150,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Backpulver",
      "menge": 1,
      "einheit": "Päckchen",
      "aus_lager": false
    },
    {
      "name": "Vanillezucker",
      "menge": 1,
      "einheit": "Päckchen",
      "aus_lager": false
    },
    {
      "name": "Milch",
      "menge": 200,
      "einheit": "ml",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Ofen auf 175 °C vorheizen; Backform fetten oder mit Papier auslegen, Zutaten auf Raumtemperatur bringen.",
    "Trockene Zutaten (Mehl, Backpulver, Kakao) in einer Schüssel sieben, verrühren.",
    "Butter/Zucker oder Eier nach Rezept schaumig rühren (Handrührer Stufe 2–3, 3–5 Min).",
    "Mehlmischung unterheben — nur bis kein Mehl mehr sichtbar (Überrühren macht trocken).",
    "Teig in die Form füllen, Oberfläche glatt streichen, ggf. Kerne oder Streusel darauf.",
    "Backzeit laut Rezept; Stäbchenprobe: Holzspieß kommt sauber heraus (außer Brownies: feuchte Krümel).",
    "Form 10 Min auf dem Rost abkühlen, dann stürzen oder Stücke schneiden.",
    "Vollständig abgekühlt lagern oder lauwarm mit Sahne servieren."
  ]
}$g$::jsonb,
  2330,
  NULL,
  'Dessert / Backen'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Bananenbrot');

-- Linzer Augen
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Linzer Augen',
  8,
  $g${
  "titel": "Linzer Augen",
  "portionen": 8,
  "kategorie": "Dessert / Backen",
  "geschaetzte_kcal_gesamt": 2356,
  "zutaten": [
    {
      "name": "Weizenmehl",
      "menge": 250,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Zucker",
      "menge": 150,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Eier",
      "menge": 3,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Butter",
      "menge": 150,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Backpulver",
      "menge": 1,
      "einheit": "Päckchen",
      "aus_lager": false
    },
    {
      "name": "Vanillezucker",
      "menge": 1,
      "einheit": "Päckchen",
      "aus_lager": false
    },
    {
      "name": "Milch",
      "menge": 200,
      "einheit": "ml",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Ofen auf 175 °C vorheizen; Backform fetten oder mit Papier auslegen, Zutaten auf Raumtemperatur bringen.",
    "Trockene Zutaten (Mehl, Backpulver, Kakao) in einer Schüssel sieben, verrühren.",
    "Butter/Zucker oder Eier nach Rezept schaumig rühren (Handrührer Stufe 2–3, 3–5 Min).",
    "Mehlmischung unterheben — nur bis kein Mehl mehr sichtbar (Überrühren macht trocken).",
    "Teig in die Form füllen, Oberfläche glatt streichen, ggf. Kerne oder Streusel darauf.",
    "Backzeit laut Rezept; Stäbchenprobe: Holzspieß kommt sauber heraus (außer Brownies: feuchte Krümel).",
    "Form 10 Min auf dem Rost abkühlen, dann stürzen oder Stücke schneiden.",
    "Vollständig abgekühlt lagern oder lauwarm mit Sahne servieren."
  ]
}$g$::jsonb,
  2356,
  NULL,
  'Dessert / Backen'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Linzer Augen');

-- Kaiserschmarrn
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Kaiserschmarrn',
  8,
  $g${
  "titel": "Kaiserschmarrn",
  "portionen": 8,
  "kategorie": "Dessert / Backen",
  "geschaetzte_kcal_gesamt": 2269,
  "zutaten": [
    {
      "name": "Weizenmehl",
      "menge": 250,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Zucker",
      "menge": 150,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Eier",
      "menge": 3,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Butter",
      "menge": 150,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Backpulver",
      "menge": 1,
      "einheit": "Päckchen",
      "aus_lager": false
    },
    {
      "name": "Vanillezucker",
      "menge": 1,
      "einheit": "Päckchen",
      "aus_lager": false
    },
    {
      "name": "Milch",
      "menge": 200,
      "einheit": "ml",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Ofen auf 175 °C vorheizen; Backform fetten oder mit Papier auslegen, Zutaten auf Raumtemperatur bringen.",
    "Trockene Zutaten (Mehl, Backpulver, Kakao) in einer Schüssel sieben, verrühren.",
    "Butter/Zucker oder Eier nach Rezept schaumig rühren (Handrührer Stufe 2–3, 3–5 Min).",
    "Mehlmischung unterheben — nur bis kein Mehl mehr sichtbar (Überrühren macht trocken).",
    "Teig in die Form füllen, Oberfläche glatt streichen, ggf. Kerne oder Streusel darauf.",
    "Backzeit laut Rezept; Stäbchenprobe: Holzspieß kommt sauber heraus (außer Brownies: feuchte Krümel).",
    "Form 10 Min auf dem Rost abkühlen, dann stürzen oder Stücke schneiden.",
    "Vollständig abgekühlt lagern oder lauwarm mit Sahne servieren."
  ]
}$g$::jsonb,
  2269,
  NULL,
  'Dessert / Backen'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Kaiserschmarrn');

-- Topfenstrudel
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Topfenstrudel',
  8,
  $g${
  "titel": "Topfenstrudel",
  "portionen": 8,
  "kategorie": "Dessert / Backen",
  "geschaetzte_kcal_gesamt": 2191,
  "zutaten": [
    {
      "name": "Weizenmehl",
      "menge": 250,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Zucker",
      "menge": 150,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Eier",
      "menge": 3,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Butter",
      "menge": 150,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Backpulver",
      "menge": 1,
      "einheit": "Päckchen",
      "aus_lager": false
    },
    {
      "name": "Vanillezucker",
      "menge": 1,
      "einheit": "Päckchen",
      "aus_lager": false
    },
    {
      "name": "Milch",
      "menge": 200,
      "einheit": "ml",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Ofen auf 175 °C vorheizen; Backform fetten oder mit Papier auslegen, Zutaten auf Raumtemperatur bringen.",
    "Trockene Zutaten (Mehl, Backpulver, Kakao) in einer Schüssel sieben, verrühren.",
    "Butter/Zucker oder Eier nach Rezept schaumig rühren (Handrührer Stufe 2–3, 3–5 Min).",
    "Mehlmischung unterheben — nur bis kein Mehl mehr sichtbar (Überrühren macht trocken).",
    "Teig in die Form füllen, Oberfläche glatt streichen, ggf. Kerne oder Streusel darauf.",
    "Backzeit laut Rezept; Stäbchenprobe: Holzspieß kommt sauber heraus (außer Brownies: feuchte Krümel).",
    "Form 10 Min auf dem Rost abkühlen, dann stürzen oder Stücke schneiden.",
    "Vollständig abgekühlt lagern oder lauwarm mit Sahne servieren."
  ]
}$g$::jsonb,
  2191,
  NULL,
  'Dessert / Backen'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Topfenstrudel');

-- Erdbeer-Torte
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Erdbeer-Torte',
  8,
  $g${
  "titel": "Erdbeer-Torte",
  "portionen": 8,
  "kategorie": "Dessert / Backen",
  "geschaetzte_kcal_gesamt": 2068,
  "zutaten": [
    {
      "name": "Weizenmehl",
      "menge": 250,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Zucker",
      "menge": 150,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Eier",
      "menge": 3,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Butter",
      "menge": 150,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Backpulver",
      "menge": 1,
      "einheit": "Päckchen",
      "aus_lager": false
    },
    {
      "name": "Vanillezucker",
      "menge": 1,
      "einheit": "Päckchen",
      "aus_lager": false
    },
    {
      "name": "Milch",
      "menge": 200,
      "einheit": "ml",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Ofen auf 175 °C vorheizen; Backform fetten oder mit Papier auslegen, Zutaten auf Raumtemperatur bringen.",
    "Trockene Zutaten (Mehl, Backpulver, Kakao) in einer Schüssel sieben, verrühren.",
    "Butter/Zucker oder Eier nach Rezept schaumig rühren (Handrührer Stufe 2–3, 3–5 Min).",
    "Mehlmischung unterheben — nur bis kein Mehl mehr sichtbar (Überrühren macht trocken).",
    "Teig in die Form füllen, Oberfläche glatt streichen, ggf. Kerne oder Streusel darauf.",
    "Backzeit laut Rezept; Stäbchenprobe: Holzspieß kommt sauber heraus (außer Brownies: feuchte Krümel).",
    "Form 10 Min auf dem Rost abkühlen, dann stürzen oder Stücke schneiden.",
    "Vollständig abgekühlt lagern oder lauwarm mit Sahne servieren."
  ]
}$g$::jsonb,
  2068,
  NULL,
  'Dessert / Backen'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Erdbeer-Torte');

-- Schoko-Mousse
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Schoko-Mousse',
  8,
  $g${
  "titel": "Schoko-Mousse",
  "portionen": 8,
  "kategorie": "Dessert / Backen",
  "geschaetzte_kcal_gesamt": 2096,
  "zutaten": [
    {
      "name": "Weizenmehl",
      "menge": 250,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Zucker",
      "menge": 150,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Eier",
      "menge": 3,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Butter",
      "menge": 150,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Backpulver",
      "menge": 1,
      "einheit": "Päckchen",
      "aus_lager": false
    },
    {
      "name": "Vanillezucker",
      "menge": 1,
      "einheit": "Päckchen",
      "aus_lager": false
    },
    {
      "name": "Milch",
      "menge": 200,
      "einheit": "ml",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Ofen auf 175 °C vorheizen; Backform fetten oder mit Papier auslegen, Zutaten auf Raumtemperatur bringen.",
    "Trockene Zutaten (Mehl, Backpulver, Kakao) in einer Schüssel sieben, verrühren.",
    "Butter/Zucker oder Eier nach Rezept schaumig rühren (Handrührer Stufe 2–3, 3–5 Min).",
    "Mehlmischung unterheben — nur bis kein Mehl mehr sichtbar (Überrühren macht trocken).",
    "Teig in die Form füllen, Oberfläche glatt streichen, ggf. Kerne oder Streusel darauf.",
    "Backzeit laut Rezept; Stäbchenprobe: Holzspieß kommt sauber heraus (außer Brownies: feuchte Krümel).",
    "Form 10 Min auf dem Rost abkühlen, dann stürzen oder Stücke schneiden.",
    "Vollständig abgekühlt lagern oder lauwarm mit Sahne servieren."
  ]
}$g$::jsonb,
  2096,
  NULL,
  'Dessert / Backen'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Schoko-Mousse');

-- Zimtschnecken
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Zimtschnecken',
  8,
  $g${
  "titel": "Zimtschnecken",
  "portionen": 8,
  "kategorie": "Dessert / Backen",
  "geschaetzte_kcal_gesamt": 2166,
  "zutaten": [
    {
      "name": "Weizenmehl",
      "menge": 250,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Zucker",
      "menge": 150,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Eier",
      "menge": 3,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Butter",
      "menge": 150,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Backpulver",
      "menge": 1,
      "einheit": "Päckchen",
      "aus_lager": false
    },
    {
      "name": "Vanillezucker",
      "menge": 1,
      "einheit": "Päckchen",
      "aus_lager": false
    },
    {
      "name": "Milch",
      "menge": 200,
      "einheit": "ml",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Ofen auf 175 °C vorheizen; Backform fetten oder mit Papier auslegen, Zutaten auf Raumtemperatur bringen.",
    "Trockene Zutaten (Mehl, Backpulver, Kakao) in einer Schüssel sieben, verrühren.",
    "Butter/Zucker oder Eier nach Rezept schaumig rühren (Handrührer Stufe 2–3, 3–5 Min).",
    "Mehlmischung unterheben — nur bis kein Mehl mehr sichtbar (Überrühren macht trocken).",
    "Teig in die Form füllen, Oberfläche glatt streichen, ggf. Kerne oder Streusel darauf.",
    "Backzeit laut Rezept; Stäbchenprobe: Holzspieß kommt sauber heraus (außer Brownies: feuchte Krümel).",
    "Form 10 Min auf dem Rost abkühlen, dann stürzen oder Stücke schneiden.",
    "Vollständig abgekühlt lagern oder lauwarm mit Sahne servieren."
  ]
}$g$::jsonb,
  2166,
  NULL,
  'Dessert / Backen'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Zimtschnecken');

-- Donuts
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Donuts',
  8,
  $g${
  "titel": "Donuts",
  "portionen": 8,
  "kategorie": "Dessert / Backen",
  "geschaetzte_kcal_gesamt": 2237,
  "zutaten": [
    {
      "name": "Weizenmehl",
      "menge": 250,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Zucker",
      "menge": 150,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Eier",
      "menge": 3,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Butter",
      "menge": 150,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Backpulver",
      "menge": 1,
      "einheit": "Päckchen",
      "aus_lager": false
    },
    {
      "name": "Vanillezucker",
      "menge": 1,
      "einheit": "Päckchen",
      "aus_lager": false
    },
    {
      "name": "Milch",
      "menge": 200,
      "einheit": "ml",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Ofen auf 175 °C vorheizen; Backform fetten oder mit Papier auslegen, Zutaten auf Raumtemperatur bringen.",
    "Trockene Zutaten (Mehl, Backpulver, Kakao) in einer Schüssel sieben, verrühren.",
    "Butter/Zucker oder Eier nach Rezept schaumig rühren (Handrührer Stufe 2–3, 3–5 Min).",
    "Mehlmischung unterheben — nur bis kein Mehl mehr sichtbar (Überrühren macht trocken).",
    "Teig in die Form füllen, Oberfläche glatt streichen, ggf. Kerne oder Streusel darauf.",
    "Backzeit laut Rezept; Stäbchenprobe: Holzspieß kommt sauber heraus (außer Brownies: feuchte Krümel).",
    "Form 10 Min auf dem Rost abkühlen, dann stürzen oder Stücke schneiden.",
    "Vollständig abgekühlt lagern oder lauwarm mit Sahne servieren."
  ]
}$g$::jsonb,
  2237,
  NULL,
  'Dessert / Backen'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Donuts');

-- Apfelchips im Ofen
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Apfelchips im Ofen',
  8,
  $g${
  "titel": "Apfelchips im Ofen",
  "portionen": 8,
  "kategorie": "Dessert / Backen",
  "geschaetzte_kcal_gesamt": 2093,
  "zutaten": [
    {
      "name": "Weizenmehl",
      "menge": 250,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Zucker",
      "menge": 150,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Eier",
      "menge": 3,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Butter",
      "menge": 150,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Backpulver",
      "menge": 1,
      "einheit": "Päckchen",
      "aus_lager": false
    },
    {
      "name": "Vanillezucker",
      "menge": 1,
      "einheit": "Päckchen",
      "aus_lager": false
    },
    {
      "name": "Milch",
      "menge": 200,
      "einheit": "ml",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Ofen auf 175 °C vorheizen; Backform fetten oder mit Papier auslegen, Zutaten auf Raumtemperatur bringen.",
    "Trockene Zutaten (Mehl, Backpulver, Kakao) in einer Schüssel sieben, verrühren.",
    "Butter/Zucker oder Eier nach Rezept schaumig rühren (Handrührer Stufe 2–3, 3–5 Min).",
    "Mehlmischung unterheben — nur bis kein Mehl mehr sichtbar (Überrühren macht trocken).",
    "Teig in die Form füllen, Oberfläche glatt streichen, ggf. Kerne oder Streusel darauf.",
    "Backzeit laut Rezept; Stäbchenprobe: Holzspieß kommt sauber heraus (außer Brownies: feuchte Krümel).",
    "Form 10 Min auf dem Rost abkühlen, dann stürzen oder Stücke schneiden.",
    "Vollständig abgekühlt lagern oder lauwarm mit Sahne servieren."
  ]
}$g$::jsonb,
  2093,
  NULL,
  'Dessert / Backen'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Apfelchips im Ofen');

-- Rührei mit Speck
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Rührei mit Speck',
  4,
  $g${
  "titel": "Rührei mit Speck",
  "portionen": 4,
  "kategorie": "Sonstiges",
  "geschaetzte_kcal_gesamt": 1354,
  "zutaten": [
    {
      "name": "Hauptzutat",
      "menge": 500,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Knoblauchzehen",
      "menge": 2,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Tomaten",
      "menge": 300,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Gemüsebrühe",
      "menge": 500,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Olivenöl",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Kräuter frisch",
      "menge": 15,
      "einheit": "g",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Alle Zutaten laut Rezept abwiegen und bereitstellen; Arbeitsfläche und Utensilien griffbereit legen.",
    "Schrittweise nach Rezept vorgehen: zuerst lange Garzeiten (Ofen, Topf), parallel kurze Arbeiten.",
    "Temperaturen mit Thermometer oder Uhr kontrollieren, nicht nur nach Gefühl bei Fleisch und Backen.",
    "Zwischenproben abschmecken, Würzung erst am Ende nicht vergessen.",
    "Anrichten auf vorgewärmten Tellern, sofort servieren oder kühl stellen laut Haltbarkeit."
  ]
}$g$::jsonb,
  1354,
  NULL,
  'Sonstiges'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Rührei mit Speck');

-- Omelett mit Kräutern
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Omelett mit Kräutern',
  4,
  $g${
  "titel": "Omelett mit Kräutern",
  "portionen": 4,
  "kategorie": "Sonstiges",
  "geschaetzte_kcal_gesamt": 1399,
  "zutaten": [
    {
      "name": "Hauptzutat",
      "menge": 500,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Knoblauchzehen",
      "menge": 2,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Tomaten",
      "menge": 300,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Gemüsebrühe",
      "menge": 500,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Olivenöl",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Kräuter frisch",
      "menge": 15,
      "einheit": "g",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Alle Zutaten laut Rezept abwiegen und bereitstellen; Arbeitsfläche und Utensilien griffbereit legen.",
    "Schrittweise nach Rezept vorgehen: zuerst lange Garzeiten (Ofen, Topf), parallel kurze Arbeiten.",
    "Temperaturen mit Thermometer oder Uhr kontrollieren, nicht nur nach Gefühl bei Fleisch und Backen.",
    "Zwischenproben abschmecken, Würzung erst am Ende nicht vergessen.",
    "Anrichten auf vorgewärmten Tellern, sofort servieren oder kühl stellen laut Haltbarkeit."
  ]
}$g$::jsonb,
  1399,
  NULL,
  'Sonstiges'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Omelett mit Kräutern');

-- French Toast
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'French Toast',
  4,
  $g${
  "titel": "French Toast",
  "portionen": 4,
  "kategorie": "Sonstiges",
  "geschaetzte_kcal_gesamt": 1653,
  "zutaten": [
    {
      "name": "Hauptzutat",
      "menge": 500,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Knoblauchzehen",
      "menge": 2,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Tomaten",
      "menge": 300,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Gemüsebrühe",
      "menge": 500,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Olivenöl",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Kräuter frisch",
      "menge": 15,
      "einheit": "g",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Alle Zutaten laut Rezept abwiegen und bereitstellen; Arbeitsfläche und Utensilien griffbereit legen.",
    "Schrittweise nach Rezept vorgehen: zuerst lange Garzeiten (Ofen, Topf), parallel kurze Arbeiten.",
    "Temperaturen mit Thermometer oder Uhr kontrollieren, nicht nur nach Gefühl bei Fleisch und Backen.",
    "Zwischenproben abschmecken, Würzung erst am Ende nicht vergessen.",
    "Anrichten auf vorgewärmten Tellern, sofort servieren oder kühl stellen laut Haltbarkeit."
  ]
}$g$::jsonb,
  1653,
  NULL,
  'Sonstiges'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'French Toast');

-- Porridge
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Porridge',
  4,
  $g${
  "titel": "Porridge",
  "portionen": 4,
  "kategorie": "Sonstiges",
  "geschaetzte_kcal_gesamt": 1328,
  "zutaten": [
    {
      "name": "Hauptzutat",
      "menge": 500,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Knoblauchzehen",
      "menge": 2,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Tomaten",
      "menge": 300,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Gemüsebrühe",
      "menge": 500,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Olivenöl",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Kräuter frisch",
      "menge": 15,
      "einheit": "g",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Alle Zutaten laut Rezept abwiegen und bereitstellen; Arbeitsfläche und Utensilien griffbereit legen.",
    "Schrittweise nach Rezept vorgehen: zuerst lange Garzeiten (Ofen, Topf), parallel kurze Arbeiten.",
    "Temperaturen mit Thermometer oder Uhr kontrollieren, nicht nur nach Gefühl bei Fleisch und Backen.",
    "Zwischenproben abschmecken, Würzung erst am Ende nicht vergessen.",
    "Anrichten auf vorgewärmten Tellern, sofort servieren oder kühl stellen laut Haltbarkeit."
  ]
}$g$::jsonb,
  1328,
  NULL,
  'Sonstiges'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Porridge');

-- Shakshuka vegan
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Shakshuka vegan',
  4,
  $g${
  "titel": "Shakshuka vegan",
  "portionen": 4,
  "kategorie": "Sonstiges",
  "geschaetzte_kcal_gesamt": 1592,
  "zutaten": [
    {
      "name": "Hauptzutat",
      "menge": 500,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Knoblauchzehen",
      "menge": 2,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Tomaten",
      "menge": 300,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Gemüsebrühe",
      "menge": 500,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Olivenöl",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Kräuter frisch",
      "menge": 15,
      "einheit": "g",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Alle Zutaten laut Rezept abwiegen und bereitstellen; Arbeitsfläche und Utensilien griffbereit legen.",
    "Schrittweise nach Rezept vorgehen: zuerst lange Garzeiten (Ofen, Topf), parallel kurze Arbeiten.",
    "Temperaturen mit Thermometer oder Uhr kontrollieren, nicht nur nach Gefühl bei Fleisch und Backen.",
    "Zwischenproben abschmecken, Würzung erst am Ende nicht vergessen.",
    "Anrichten auf vorgewärmten Tellern, sofort servieren oder kühl stellen laut Haltbarkeit."
  ]
}$g$::jsonb,
  1592,
  NULL,
  'Sonstiges'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Shakshuka vegan');

-- Risotto mit Pilzen
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Risotto mit Pilzen',
  4,
  $g${
  "titel": "Risotto mit Pilzen",
  "portionen": 4,
  "kategorie": "Sonstiges",
  "geschaetzte_kcal_gesamt": 1476,
  "zutaten": [
    {
      "name": "Hauptzutat",
      "menge": 500,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Knoblauchzehen",
      "menge": 2,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Tomaten",
      "menge": 300,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Gemüsebrühe",
      "menge": 500,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Olivenöl",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Kräuter frisch",
      "menge": 15,
      "einheit": "g",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Reis in einem Sieb 2–3 Mal kalt waschen, bis das Wasser klarer wird — entfernt überschüssige Stärke.",
    "Topf mit Deckel: Reis und Wasser im Verhältnis 1:1,5 (Basmati) oder 1:2 (Risotto), salzen.",
    "Aufkochen, dann Stufe 1–2, Deckel 12–18 Min (je nach Sorte), nicht rühren.",
    "Topf vom Herd, 10 Min quellen lassen; mit Gabel auflockern.",
    "Beilage oder unter Curry servieren."
  ]
}$g$::jsonb,
  1476,
  NULL,
  'Sonstiges'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Risotto mit Pilzen');

-- Paella mit Meeresfrüchten
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Paella mit Meeresfrüchten',
  4,
  $g${
  "titel": "Paella mit Meeresfrüchten",
  "portionen": 4,
  "kategorie": "Sonstiges",
  "geschaetzte_kcal_gesamt": 1492,
  "zutaten": [
    {
      "name": "Hauptzutat",
      "menge": 500,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Knoblauchzehen",
      "menge": 2,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Tomaten",
      "menge": 300,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Gemüsebrühe",
      "menge": 500,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Olivenöl",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Kräuter frisch",
      "menge": 15,
      "einheit": "g",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Reis in einem Sieb 2–3 Mal kalt waschen, bis das Wasser klarer wird — entfernt überschüssige Stärke.",
    "Topf mit Deckel: Reis und Wasser im Verhältnis 1:1,5 (Basmati) oder 1:2 (Risotto), salzen.",
    "Aufkochen, dann Stufe 1–2, Deckel 12–18 Min (je nach Sorte), nicht rühren.",
    "Topf vom Herd, 10 Min quellen lassen; mit Gabel auflockern.",
    "Beilage oder unter Curry servieren."
  ]
}$g$::jsonb,
  1492,
  NULL,
  'Sonstiges'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Paella mit Meeresfrüchten');

-- Burrito Bowl
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Burrito Bowl',
  4,
  $g${
  "titel": "Burrito Bowl",
  "portionen": 4,
  "kategorie": "Sonstiges",
  "geschaetzte_kcal_gesamt": 1679,
  "zutaten": [
    {
      "name": "Hauptzutat",
      "menge": 500,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Knoblauchzehen",
      "menge": 2,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Tomaten",
      "menge": 300,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Gemüsebrühe",
      "menge": 500,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Olivenöl",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Kräuter frisch",
      "menge": 15,
      "einheit": "g",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Alle Zutaten laut Rezept abwiegen und bereitstellen; Arbeitsfläche und Utensilien griffbereit legen.",
    "Schrittweise nach Rezept vorgehen: zuerst lange Garzeiten (Ofen, Topf), parallel kurze Arbeiten.",
    "Temperaturen mit Thermometer oder Uhr kontrollieren, nicht nur nach Gefühl bei Fleisch und Backen.",
    "Zwischenproben abschmecken, Würzung erst am Ende nicht vergessen.",
    "Anrichten auf vorgewärmten Tellern, sofort servieren oder kühl stellen laut Haltbarkeit."
  ]
}$g$::jsonb,
  1679,
  NULL,
  'Sonstiges'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Burrito Bowl');

-- Quesadilla
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Quesadilla',
  4,
  $g${
  "titel": "Quesadilla",
  "portionen": 4,
  "kategorie": "Sonstiges",
  "geschaetzte_kcal_gesamt": 1529,
  "zutaten": [
    {
      "name": "Hauptzutat",
      "menge": 500,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Knoblauchzehen",
      "menge": 2,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Tomaten",
      "menge": 300,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Gemüsebrühe",
      "menge": 500,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Olivenöl",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Kräuter frisch",
      "menge": 15,
      "einheit": "g",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Alle Zutaten laut Rezept abwiegen und bereitstellen; Arbeitsfläche und Utensilien griffbereit legen.",
    "Schrittweise nach Rezept vorgehen: zuerst lange Garzeiten (Ofen, Topf), parallel kurze Arbeiten.",
    "Temperaturen mit Thermometer oder Uhr kontrollieren, nicht nur nach Gefühl bei Fleisch und Backen.",
    "Zwischenproben abschmecken, Würzung erst am Ende nicht vergessen.",
    "Anrichten auf vorgewärmten Tellern, sofort servieren oder kühl stellen laut Haltbarkeit."
  ]
}$g$::jsonb,
  1529,
  NULL,
  'Sonstiges'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Quesadilla');

-- Falafel-Teller
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Falafel-Teller',
  4,
  $g${
  "titel": "Falafel-Teller",
  "portionen": 4,
  "kategorie": "Sonstiges",
  "geschaetzte_kcal_gesamt": 1444,
  "zutaten": [
    {
      "name": "Hauptzutat",
      "menge": 500,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Knoblauchzehen",
      "menge": 2,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Tomaten",
      "menge": 300,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Gemüsebrühe",
      "menge": 500,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Olivenöl",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Kräuter frisch",
      "menge": 15,
      "einheit": "g",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Alle Zutaten laut Rezept abwiegen und bereitstellen; Arbeitsfläche und Utensilien griffbereit legen.",
    "Schrittweise nach Rezept vorgehen: zuerst lange Garzeiten (Ofen, Topf), parallel kurze Arbeiten.",
    "Temperaturen mit Thermometer oder Uhr kontrollieren, nicht nur nach Gefühl bei Fleisch und Backen.",
    "Zwischenproben abschmecken, Würzung erst am Ende nicht vergessen.",
    "Anrichten auf vorgewärmten Tellern, sofort servieren oder kühl stellen laut Haltbarkeit."
  ]
}$g$::jsonb,
  1444,
  NULL,
  'Sonstiges'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Falafel-Teller');

-- Döner zu Hause
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Döner zu Hause',
  4,
  $g${
  "titel": "Döner zu Hause",
  "portionen": 4,
  "kategorie": "Sonstiges",
  "geschaetzte_kcal_gesamt": 1544,
  "zutaten": [
    {
      "name": "Hauptzutat",
      "menge": 500,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Knoblauchzehen",
      "menge": 2,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Tomaten",
      "menge": 300,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Gemüsebrühe",
      "menge": 500,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Olivenöl",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Kräuter frisch",
      "menge": 15,
      "einheit": "g",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Alle Zutaten laut Rezept abwiegen und bereitstellen; Arbeitsfläche und Utensilien griffbereit legen.",
    "Schrittweise nach Rezept vorgehen: zuerst lange Garzeiten (Ofen, Topf), parallel kurze Arbeiten.",
    "Temperaturen mit Thermometer oder Uhr kontrollieren, nicht nur nach Gefühl bei Fleisch und Backen.",
    "Zwischenproben abschmecken, Würzung erst am Ende nicht vergessen.",
    "Anrichten auf vorgewärmten Tellern, sofort servieren oder kühl stellen laut Haltbarkeit."
  ]
}$g$::jsonb,
  1544,
  NULL,
  'Sonstiges'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Döner zu Hause');

-- Sushi-Rolls einfach
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Sushi-Rolls einfach',
  4,
  $g${
  "titel": "Sushi-Rolls einfach",
  "portionen": 4,
  "kategorie": "Sonstiges",
  "geschaetzte_kcal_gesamt": 1543,
  "zutaten": [
    {
      "name": "Hauptzutat",
      "menge": 500,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Knoblauchzehen",
      "menge": 2,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Tomaten",
      "menge": 300,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Gemüsebrühe",
      "menge": 500,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Olivenöl",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Kräuter frisch",
      "menge": 15,
      "einheit": "g",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Großen Topf (4–5 l) und Schöpfkelle bereitstellen; Gemüse waschen, Enden entfernen, in gleichmäßige Würfel schneiden.",
    "Topf auf Herdstufe 6 von 9 stellen, 2 EL Öl oder Butter erhitzen, Zwiebel und Knoblauch 4 Min glasig dünsten.",
    "Hartes Gemüse (Karotten, Sellerie, Kartoffeln) 5–6 Min mit anschwitzen, gelegentlich rühren, nicht bräunen.",
    "Brühe (ca. 1–1,2 l) angießen, mit einem Spritzer einmal aufkochen, dann Hitze auf Stufe 3–4 reduzieren.",
    "Sushi-Rolls einfach: 20–30 Min leicht köcheln, bis alles weich ist; mit dem Löffel prüfen — keine harten Stücke.",
    "Optional mit Stabmixer pürieren: Mixer tief ins Flüssige tauchen, kurze Pulse, Spritzer vermeiden; oder grob lassen.",
    "Mit Salz, Pfeffer, Muskat oder frischen Kräutern abschmecken; Konsistenz mit Wasser oder Sahne anpassen.",
    "Bei Bedarf Einlage (Nudeln, Croutons, Sahnehaube) separat zubereiten und erst beim Servieren zugeben.",
    "Suppe in vorgewärmte Schalen füllen, heiß servieren; Rest im Topf auf Stufe 2 warm halten."
  ]
}$g$::jsonb,
  1543,
  NULL,
  'Sonstiges'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Sushi-Rolls einfach');

-- Frühlingsrollen
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Frühlingsrollen',
  4,
  $g${
  "titel": "Frühlingsrollen",
  "portionen": 4,
  "kategorie": "Sonstiges",
  "geschaetzte_kcal_gesamt": 1433,
  "zutaten": [
    {
      "name": "Hauptzutat",
      "menge": 500,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Knoblauchzehen",
      "menge": 2,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Tomaten",
      "menge": 300,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Gemüsebrühe",
      "menge": 500,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Olivenöl",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Kräuter frisch",
      "menge": 15,
      "einheit": "g",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Ofen auf 180 °C Umluft vorheizen (nur Ober-/Unterhitze: +20 °C), Backblech mit Backpapier auslegen.",
    "Hauptzutat würzen, marinieren oder panieren wie im Rezept; Küchenthermometer bereitlegen bei Fleisch/Fisch.",
    "Ofenfeste Form oder Blech fetten oder mit Papier belegen, Zutaten in einer Schicht anordnen (gleichmäßige Hitze).",
    "In die mittlere Schiene schieben, 35–45 Min backen/braten — nicht zu früh die Tür öffnen (Temperaturverlust).",
    "Nach der Hälfte wenden oder begießen (Bratensoße, Marinade), Oberfläche soll goldbraun werden.",
    "Gargrad prüfen: Fisch 58–62 °C Kerntemperatur, Geflügel 74 °C, Rind medium ca. 55 °C (nach Ruhezeit).",
    "5–10 Min ruhen lassen unter Alufolie (locker), dann in Scheiben schneiden oder anrichten.",
    "Mit Beilage und heißer Sauce servieren; Ofenhandschuhe verwenden."
  ]
}$g$::jsonb,
  1433,
  NULL,
  'Sonstiges'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Frühlingsrollen');

-- Dim Sum gedämpft
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Dim Sum gedämpft',
  4,
  $g${
  "titel": "Dim Sum gedämpft",
  "portionen": 4,
  "kategorie": "Sonstiges",
  "geschaetzte_kcal_gesamt": 1326,
  "zutaten": [
    {
      "name": "Hauptzutat",
      "menge": 500,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Knoblauchzehen",
      "menge": 2,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Tomaten",
      "menge": 300,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Gemüsebrühe",
      "menge": 500,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Olivenöl",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Kräuter frisch",
      "menge": 15,
      "einheit": "g",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Großen Topf (4–5 l) und Schöpfkelle bereitstellen; Gemüse waschen, Enden entfernen, in gleichmäßige Würfel schneiden.",
    "Topf auf Herdstufe 6 von 9 stellen, 2 EL Öl oder Butter erhitzen, Zwiebel und Knoblauch 4 Min glasig dünsten.",
    "Hartes Gemüse (Karotten, Sellerie, Kartoffeln) 5–6 Min mit anschwitzen, gelegentlich rühren, nicht bräunen.",
    "Brühe (ca. 1–1,2 l) angießen, mit einem Spritzer einmal aufkochen, dann Hitze auf Stufe 3–4 reduzieren.",
    "Dim Sum gedämpft: 20–30 Min leicht köcheln, bis alles weich ist; mit dem Löffel prüfen — keine harten Stücke.",
    "Optional mit Stabmixer pürieren: Mixer tief ins Flüssige tauchen, kurze Pulse, Spritzer vermeiden; oder grob lassen.",
    "Mit Salz, Pfeffer, Muskat oder frischen Kräutern abschmecken; Konsistenz mit Wasser oder Sahne anpassen.",
    "Bei Bedarf Einlage (Nudeln, Croutons, Sahnehaube) separat zubereiten und erst beim Servieren zugeben.",
    "Suppe in vorgewärmte Schalen füllen, heiß servieren; Rest im Topf auf Stufe 2 warm halten."
  ]
}$g$::jsonb,
  1326,
  NULL,
  'Sonstiges'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Dim Sum gedämpft');

-- Pad Thai
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Pad Thai',
  4,
  $g${
  "titel": "Pad Thai",
  "portionen": 4,
  "kategorie": "Sonstiges",
  "geschaetzte_kcal_gesamt": 1599,
  "zutaten": [
    {
      "name": "Hauptzutat",
      "menge": 500,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Knoblauchzehen",
      "menge": 2,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Tomaten",
      "menge": 300,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Gemüsebrühe",
      "menge": 500,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Olivenöl",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Kräuter frisch",
      "menge": 15,
      "einheit": "g",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Arbeitsfläche freiräumen: große Pfanne oder Wok, Topf für Reis, Schöpfkelle, Küchenuhr und scharfes Messer bereitstellen.",
    "Reis parallel starten: 300 g Reis waschen, mit 450 ml Wasser salzen, aufkochen, Deckel, Stufe 1–2, 12–15 Min quellen lassen.",
    "Zwiebel schälen und fein würfeln, Ingwer und Knoblauch fein hacken — alles in Schälchen legen (Mise en place).",
    "Pfanne auf Herdstufe 6 von 9 stellen, 2 EL Öl erhitzen, Currypaste 1–2 Min anrösten, bis es duftet und leicht dunkler wird (nicht schwarz).",
    "Zwiebel und Ingwer 3–4 Min glasig dünsten, dann Fleisch oder Tofu zugeben und 4–5 Min anbraten oder mitgaren.",
    "Kokosmilch und passierte Tomaten einrühren, einmal aufkochen, Hitze auf Stufe 3–4 reduzieren.",
    "«Pad Thai» 15–20 Min leicht köcheln lassen, gelegentlich rühren, bis die Soße sämig ist und leichtes Öl an der Oberfläche perlt.",
    "Mit Limettensaft, Salz, Pfeffer und optional 1 TL Zucker abschmecken (süß-sauer-salzig ausbalancieren).",
    "Reis mit einer Gabel auflockern, Curry auf tiefe Teller geben, frischen Koriander darüber streuen.",
    "Sofort heiß servieren; Reste 2 Tage kühl lagern und nur einmal vollständig durcherhitzen."
  ]
}$g$::jsonb,
  1599,
  NULL,
  'Sonstiges'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Pad Thai');

-- Green Curry
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Green Curry',
  4,
  $g${
  "titel": "Green Curry",
  "portionen": 4,
  "kategorie": "Sonstiges",
  "geschaetzte_kcal_gesamt": 1562,
  "zutaten": [
    {
      "name": "Hauptzutat",
      "menge": 500,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Knoblauchzehen",
      "menge": 2,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Tomaten",
      "menge": 300,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Gemüsebrühe",
      "menge": 500,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Olivenöl",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Kräuter frisch",
      "menge": 15,
      "einheit": "g",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Arbeitsfläche freiräumen: große Pfanne oder Wok, Topf für Reis, Schöpfkelle, Küchenuhr und scharfes Messer bereitstellen.",
    "Reis parallel starten: 300 g Reis waschen, mit 450 ml Wasser salzen, aufkochen, Deckel, Stufe 1–2, 12–15 Min quellen lassen.",
    "Zwiebel schälen und fein würfeln, Ingwer und Knoblauch fein hacken — alles in Schälchen legen (Mise en place).",
    "Pfanne auf Herdstufe 6 von 9 stellen, 2 EL Öl erhitzen, Currypaste 1–2 Min anrösten, bis es duftet und leicht dunkler wird (nicht schwarz).",
    "Zwiebel und Ingwer 3–4 Min glasig dünsten, dann Fleisch oder Tofu zugeben und 4–5 Min anbraten oder mitgaren.",
    "Kokosmilch und passierte Tomaten einrühren, einmal aufkochen, Hitze auf Stufe 3–4 reduzieren.",
    "«Green Curry» 15–20 Min leicht köcheln lassen, gelegentlich rühren, bis die Soße sämig ist und leichtes Öl an der Oberfläche perlt.",
    "Mit Limettensaft, Salz, Pfeffer und optional 1 TL Zucker abschmecken (süß-sauer-salzig ausbalancieren).",
    "Reis mit einer Gabel auflockern, Curry auf tiefe Teller geben, frischen Koriander darüber streuen.",
    "Sofort heiß servieren; Reste 2 Tage kühl lagern und nur einmal vollständig durcherhitzen."
  ]
}$g$::jsonb,
  1562,
  NULL,
  'Sonstiges'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Green Curry');

-- Butter Chicken
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Butter Chicken',
  4,
  $g${
  "titel": "Butter Chicken",
  "portionen": 4,
  "kategorie": "Sonstiges",
  "geschaetzte_kcal_gesamt": 1455,
  "zutaten": [
    {
      "name": "Hauptzutat",
      "menge": 500,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Knoblauchzehen",
      "menge": 2,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Tomaten",
      "menge": 300,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Gemüsebrühe",
      "menge": 500,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Olivenöl",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Kräuter frisch",
      "menge": 15,
      "einheit": "g",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Alle Zutaten laut Rezept abwiegen und bereitstellen; Arbeitsfläche und Utensilien griffbereit legen.",
    "Schrittweise nach Rezept vorgehen: zuerst lange Garzeiten (Ofen, Topf), parallel kurze Arbeiten.",
    "Temperaturen mit Thermometer oder Uhr kontrollieren, nicht nur nach Gefühl bei Fleisch und Backen.",
    "Zwischenproben abschmecken, Würzung erst am Ende nicht vergessen.",
    "Anrichten auf vorgewärmten Tellern, sofort servieren oder kühl stellen laut Haltbarkeit."
  ]
}$g$::jsonb,
  1455,
  NULL,
  'Sonstiges'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Butter Chicken');

-- Biryani
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Biryani',
  4,
  $g${
  "titel": "Biryani",
  "portionen": 4,
  "kategorie": "Sonstiges",
  "geschaetzte_kcal_gesamt": 1618,
  "zutaten": [
    {
      "name": "Hauptzutat",
      "menge": 500,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Knoblauchzehen",
      "menge": 2,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Tomaten",
      "menge": 300,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Gemüsebrühe",
      "menge": 500,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Olivenöl",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Kräuter frisch",
      "menge": 15,
      "einheit": "g",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Reis in einem Sieb 2–3 Mal kalt waschen, bis das Wasser klarer wird — entfernt überschüssige Stärke.",
    "Topf mit Deckel: Reis und Wasser im Verhältnis 1:1,5 (Basmati) oder 1:2 (Risotto), salzen.",
    "Aufkochen, dann Stufe 1–2, Deckel 12–18 Min (je nach Sorte), nicht rühren.",
    "Topf vom Herd, 10 Min quellen lassen; mit Gabel auflockern.",
    "Beilage oder unter Curry servieren."
  ]
}$g$::jsonb,
  1618,
  NULL,
  'Sonstiges'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Biryani');

-- Couscous-Tajine
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Couscous-Tajine',
  4,
  $g${
  "titel": "Couscous-Tajine",
  "portionen": 4,
  "kategorie": "Sonstiges",
  "geschaetzte_kcal_gesamt": 1600,
  "zutaten": [
    {
      "name": "Hauptzutat",
      "menge": 500,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Knoblauchzehen",
      "menge": 2,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Tomaten",
      "menge": 300,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Gemüsebrühe",
      "menge": 500,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Olivenöl",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Kräuter frisch",
      "menge": 15,
      "einheit": "g",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Alle Zutaten laut Rezept abwiegen und bereitstellen; Arbeitsfläche und Utensilien griffbereit legen.",
    "Schrittweise nach Rezept vorgehen: zuerst lange Garzeiten (Ofen, Topf), parallel kurze Arbeiten.",
    "Temperaturen mit Thermometer oder Uhr kontrollieren, nicht nur nach Gefühl bei Fleisch und Backen.",
    "Zwischenproben abschmecken, Würzung erst am Ende nicht vergessen.",
    "Anrichten auf vorgewärmten Tellern, sofort servieren oder kühl stellen laut Haltbarkeit."
  ]
}$g$::jsonb,
  1600,
  NULL,
  'Sonstiges'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Couscous-Tajine');

-- Empanadas
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Empanadas',
  4,
  $g${
  "titel": "Empanadas",
  "portionen": 4,
  "kategorie": "Sonstiges",
  "geschaetzte_kcal_gesamt": 1406,
  "zutaten": [
    {
      "name": "Hauptzutat",
      "menge": 500,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Knoblauchzehen",
      "menge": 2,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Tomaten",
      "menge": 300,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Gemüsebrühe",
      "menge": 500,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Olivenöl",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Kräuter frisch",
      "menge": 15,
      "einheit": "g",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Ofen auf 180 °C Umluft vorheizen (nur Ober-/Unterhitze: +20 °C), Backblech mit Backpapier auslegen.",
    "Hauptzutat würzen, marinieren oder panieren wie im Rezept; Küchenthermometer bereitlegen bei Fleisch/Fisch.",
    "Ofenfeste Form oder Blech fetten oder mit Papier belegen, Zutaten in einer Schicht anordnen (gleichmäßige Hitze).",
    "In die mittlere Schiene schieben, 35–45 Min backen/braten — nicht zu früh die Tür öffnen (Temperaturverlust).",
    "Nach der Hälfte wenden oder begießen (Bratensoße, Marinade), Oberfläche soll goldbraun werden.",
    "Gargrad prüfen: Fisch 58–62 °C Kerntemperatur, Geflügel 74 °C, Rind medium ca. 55 °C (nach Ruhezeit).",
    "5–10 Min ruhen lassen unter Alufolie (locker), dann in Scheiben schneiden oder anrichten.",
    "Mit Beilage und heißer Sauce servieren; Ofenhandschuhe verwenden."
  ]
}$g$::jsonb,
  1406,
  NULL,
  'Sonstiges'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Empanadas');

-- Arepas
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Arepas',
  4,
  $g${
  "titel": "Arepas",
  "portionen": 4,
  "kategorie": "Sonstiges",
  "geschaetzte_kcal_gesamt": 1504,
  "zutaten": [
    {
      "name": "Hauptzutat",
      "menge": 500,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Knoblauchzehen",
      "menge": 2,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Tomaten",
      "menge": 300,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Gemüsebrühe",
      "menge": 500,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Olivenöl",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Kräuter frisch",
      "menge": 15,
      "einheit": "g",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Alle Zutaten laut Rezept abwiegen und bereitstellen; Arbeitsfläche und Utensilien griffbereit legen.",
    "Schrittweise nach Rezept vorgehen: zuerst lange Garzeiten (Ofen, Topf), parallel kurze Arbeiten.",
    "Temperaturen mit Thermometer oder Uhr kontrollieren, nicht nur nach Gefühl bei Fleisch und Backen.",
    "Zwischenproben abschmecken, Würzung erst am Ende nicht vergessen.",
    "Anrichten auf vorgewärmten Tellern, sofort servieren oder kühl stellen laut Haltbarkeit."
  ]
}$g$::jsonb,
  1504,
  NULL,
  'Sonstiges'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Arepas');

-- Ceviche
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Ceviche',
  4,
  $g${
  "titel": "Ceviche",
  "portionen": 4,
  "kategorie": "Sonstiges",
  "geschaetzte_kcal_gesamt": 1595,
  "zutaten": [
    {
      "name": "Hauptzutat",
      "menge": 500,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Knoblauchzehen",
      "menge": 2,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Tomaten",
      "menge": 300,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Gemüsebrühe",
      "menge": 500,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Olivenöl",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Kräuter frisch",
      "menge": 15,
      "einheit": "g",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Alle Zutaten laut Rezept abwiegen und bereitstellen; Arbeitsfläche und Utensilien griffbereit legen.",
    "Schrittweise nach Rezept vorgehen: zuerst lange Garzeiten (Ofen, Topf), parallel kurze Arbeiten.",
    "Temperaturen mit Thermometer oder Uhr kontrollieren, nicht nur nach Gefühl bei Fleisch und Backen.",
    "Zwischenproben abschmecken, Würzung erst am Ende nicht vergessen.",
    "Anrichten auf vorgewärmten Tellern, sofort servieren oder kühl stellen laut Haltbarkeit."
  ]
}$g$::jsonb,
  1595,
  NULL,
  'Sonstiges'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Ceviche');

-- Tacos vegetarisch
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Tacos vegetarisch',
  4,
  $g${
  "titel": "Tacos vegetarisch",
  "portionen": 4,
  "kategorie": "Sonstiges",
  "geschaetzte_kcal_gesamt": 1411,
  "zutaten": [
    {
      "name": "Hauptzutat",
      "menge": 500,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Knoblauchzehen",
      "menge": 2,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Tomaten",
      "menge": 300,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Gemüsebrühe",
      "menge": 500,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Olivenöl",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Kräuter frisch",
      "menge": 15,
      "einheit": "g",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Alle Zutaten laut Rezept abwiegen und bereitstellen; Arbeitsfläche und Utensilien griffbereit legen.",
    "Schrittweise nach Rezept vorgehen: zuerst lange Garzeiten (Ofen, Topf), parallel kurze Arbeiten.",
    "Temperaturen mit Thermometer oder Uhr kontrollieren, nicht nur nach Gefühl bei Fleisch und Backen.",
    "Zwischenproben abschmecken, Würzung erst am Ende nicht vergessen.",
    "Anrichten auf vorgewärmten Tellern, sofort servieren oder kühl stellen laut Haltbarkeit."
  ]
}$g$::jsonb,
  1411,
  NULL,
  'Sonstiges'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Tacos vegetarisch');

-- Ramen vegetarisch
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Ramen vegetarisch',
  4,
  $g${
  "titel": "Ramen vegetarisch",
  "portionen": 4,
  "kategorie": "Sonstiges",
  "geschaetzte_kcal_gesamt": 1404,
  "zutaten": [
    {
      "name": "Hauptzutat",
      "menge": 500,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Knoblauchzehen",
      "menge": 2,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Tomaten",
      "menge": 300,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Gemüsebrühe",
      "menge": 500,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Olivenöl",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Kräuter frisch",
      "menge": 15,
      "einheit": "g",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Großen Topf (4–5 l) und Schöpfkelle bereitstellen; Gemüse waschen, Enden entfernen, in gleichmäßige Würfel schneiden.",
    "Topf auf Herdstufe 6 von 9 stellen, 2 EL Öl oder Butter erhitzen, Zwiebel und Knoblauch 4 Min glasig dünsten.",
    "Hartes Gemüse (Karotten, Sellerie, Kartoffeln) 5–6 Min mit anschwitzen, gelegentlich rühren, nicht bräunen.",
    "Brühe (ca. 1–1,2 l) angießen, mit einem Spritzer einmal aufkochen, dann Hitze auf Stufe 3–4 reduzieren.",
    "Ramen vegetarisch: 20–30 Min leicht köcheln, bis alles weich ist; mit dem Löffel prüfen — keine harten Stücke.",
    "Optional mit Stabmixer pürieren: Mixer tief ins Flüssige tauchen, kurze Pulse, Spritzer vermeiden; oder grob lassen.",
    "Mit Salz, Pfeffer, Muskat oder frischen Kräutern abschmecken; Konsistenz mit Wasser oder Sahne anpassen.",
    "Bei Bedarf Einlage (Nudeln, Croutons, Sahnehaube) separat zubereiten und erst beim Servieren zugeben.",
    "Suppe in vorgewärmte Schalen füllen, heiß servieren; Rest im Topf auf Stufe 2 warm halten."
  ]
}$g$::jsonb,
  1404,
  NULL,
  'Sonstiges'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Ramen vegetarisch');

-- Okonomiyaki
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Okonomiyaki',
  4,
  $g${
  "titel": "Okonomiyaki",
  "portionen": 4,
  "kategorie": "Sonstiges",
  "geschaetzte_kcal_gesamt": 1662,
  "zutaten": [
    {
      "name": "Hauptzutat",
      "menge": 500,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Knoblauchzehen",
      "menge": 2,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Tomaten",
      "menge": 300,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Gemüsebrühe",
      "menge": 500,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Olivenöl",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Kräuter frisch",
      "menge": 15,
      "einheit": "g",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Alle Zutaten laut Rezept abwiegen und bereitstellen; Arbeitsfläche und Utensilien griffbereit legen.",
    "Schrittweise nach Rezept vorgehen: zuerst lange Garzeiten (Ofen, Topf), parallel kurze Arbeiten.",
    "Temperaturen mit Thermometer oder Uhr kontrollieren, nicht nur nach Gefühl bei Fleisch und Backen.",
    "Zwischenproben abschmecken, Würzung erst am Ende nicht vergessen.",
    "Anrichten auf vorgewärmten Tellern, sofort servieren oder kühl stellen laut Haltbarkeit."
  ]
}$g$::jsonb,
  1662,
  NULL,
  'Sonstiges'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Okonomiyaki');

-- Kimchi-Fried-Rice
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Kimchi-Fried-Rice',
  4,
  $g${
  "titel": "Kimchi-Fried-Rice",
  "portionen": 4,
  "kategorie": "Sonstiges",
  "geschaetzte_kcal_gesamt": 1664,
  "zutaten": [
    {
      "name": "Hauptzutat",
      "menge": 500,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Knoblauchzehen",
      "menge": 2,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Tomaten",
      "menge": 300,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Gemüsebrühe",
      "menge": 500,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Olivenöl",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Kräuter frisch",
      "menge": 15,
      "einheit": "g",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Alle Zutaten laut Rezept abwiegen und bereitstellen; Arbeitsfläche und Utensilien griffbereit legen.",
    "Schrittweise nach Rezept vorgehen: zuerst lange Garzeiten (Ofen, Topf), parallel kurze Arbeiten.",
    "Temperaturen mit Thermometer oder Uhr kontrollieren, nicht nur nach Gefühl bei Fleisch und Backen.",
    "Zwischenproben abschmecken, Würzung erst am Ende nicht vergessen.",
    "Anrichten auf vorgewärmten Tellern, sofort servieren oder kühl stellen laut Haltbarkeit."
  ]
}$g$::jsonb,
  1664,
  NULL,
  'Sonstiges'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Kimchi-Fried-Rice');

-- Moussaka
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Moussaka',
  4,
  $g${
  "titel": "Moussaka",
  "portionen": 4,
  "kategorie": "Sonstiges",
  "geschaetzte_kcal_gesamt": 1336,
  "zutaten": [
    {
      "name": "Hauptzutat",
      "menge": 500,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Zwiebeln",
      "menge": 1,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Knoblauchzehen",
      "menge": 2,
      "einheit": "Stück",
      "aus_lager": false
    },
    {
      "name": "Tomaten",
      "menge": 300,
      "einheit": "g",
      "aus_lager": false
    },
    {
      "name": "Gemüsebrühe",
      "menge": 500,
      "einheit": "ml",
      "aus_lager": false
    },
    {
      "name": "Olivenöl",
      "menge": 2,
      "einheit": "EL",
      "aus_lager": false
    },
    {
      "name": "Kräuter frisch",
      "menge": 15,
      "einheit": "g",
      "aus_lager": false
    }
  ],
  "kochschritte": [
    "Alle Zutaten laut Rezept abwiegen und bereitstellen; Arbeitsfläche und Utensilien griffbereit legen.",
    "Schrittweise nach Rezept vorgehen: zuerst lange Garzeiten (Ofen, Topf), parallel kurze Arbeiten.",
    "Temperaturen mit Thermometer oder Uhr kontrollieren, nicht nur nach Gefühl bei Fleisch und Backen.",
    "Zwischenproben abschmecken, Würzung erst am Ende nicht vergessen.",
    "Anrichten auf vorgewärmten Tellern, sofort servieren oder kühl stellen laut Haltbarkeit."
  ]
}$g$::jsonb,
  1336,
  NULL,
  'Sonstiges'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Moussaka');
