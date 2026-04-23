-- Beliebte Standard-Rezepte für den Katalog (Speisekammer → Rezepte).
-- Läuft idempotent: gleicher Titel wird nicht doppelt eingefügt.

-- Lasagne
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Lasagne',
  4,
  $g${
    "titel": "Lasagne",
    "portionen": 4,
    "kategorie": "Nudelgericht",
    "geschaetzte_kcal_gesamt": 2800,
    "zutaten": [
      { "name": "Lasagneplatten (trocken)", "menge": 12, "einheit": "Stück", "aus_lager": false },
      { "name": "Rinderhackfleisch", "menge": 500, "einheit": "g", "aus_lager": false },
      { "name": "passierte Tomaten", "menge": 500, "einheit": "g", "aus_lager": false },
      { "name": "Zwiebeln", "menge": 150, "einheit": "g", "aus_lager": false },
      { "name": "Möhren", "menge": 100, "einheit": "g", "aus_lager": false },
      { "name": "Knoblauchzehen", "menge": 2, "einheit": "Stück", "aus_lager": false },
      { "name": "Olivenöl", "menge": 2, "einheit": "EL", "aus_lager": false },
      { "name": "Milch (für Bechamel)", "menge": 500, "einheit": "ml", "aus_lager": false },
      { "name": "Butter (für Bechamel)", "menge": 40, "einheit": "g", "aus_lager": false },
      { "name": "Weizenmehl (für Bechamel)", "menge": 40, "einheit": "g", "aus_lager": false },
      { "name": "geriebener Hartkäse (Parmesan/Gouda)", "menge": 120, "einheit": "g", "aus_lager": false }
    ],
    "kochschritte": [
      "Für die Bolognese Zwiebeln, Möhren und Knoblauch fein schneiden, Hack anbraten, mit Tomaten 30–40 Min köcheln lassen, würzen (Salz, Pfeffer, Oregano, evtl. etwas Gemüsebrühe).",
      "Bechamel aus Butter, Mehl und Milch unter Rühren kochen, salzen und pfeffern.",
      "Form fetten, abwechselnd Platten, Bolognese, Bechamel schichten, oben Käse. Bei 180 °C (Umluft) ca. 35–40 Min backen, bis die Oberfläche goldbraun ist."
    ]
  }$g$::jsonb,
  2800,
  NULL,
  'Nudelgericht'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Lasagne');

-- Wiener Schnitzel
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Wiener Schnitzel',
  2,
  $g${
    "titel": "Wiener Schnitzel",
    "portionen": 2,
    "kategorie": "Fleischgericht",
    "geschaetzte_kcal_gesamt": 1100,
    "zutaten": [
      { "name": "Kalbsschnitzel (trockengetupft)", "menge": 2, "einheit": "Stück (à ca. 150 g)", "aus_lager": false },
      { "name": "Mehl", "menge": 50, "einheit": "g", "aus_lager": false },
      { "name": "Eier (verquirl)", "menge": 2, "einheit": "Stück", "aus_lager": false },
      { "name": "Paniermehl (Semmelbrösel)", "menge": 100, "einheit": "g", "aus_lager": false },
      { "name": "Butterschmalz oder Öl (zum Braten)", "menge": 4, "einheit": "EL", "aus_lager": false },
      { "name": "Zitronen (Spalten)", "menge": 0.5, "einheit": "Stück", "aus_lager": false }
    ],
    "kochschritte": [
      "Schnitzel leicht plattieren, salzen, pfeffern. Durch Mehl, dann Ei, dann Paniermehl ziehen und kurz antrocknen lassen.",
      "Fett in breiter Pfanne heiß werden lassen, Schnitzel nacheinander beidseitig goldbraun braten, dabei nicht «schwimmen» lassen, Hitze ggf. anpassen. Auf Küchenkübel abtropfen lassen, mit Zitrone servieren (klassisch: Petersilieneräpfel dazu)."
    ]
  }$g$::jsonb,
  1100,
  NULL,
  'Fleischgericht'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Wiener Schnitzel');

-- Spaghetti Carbonara
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Spaghetti Carbonara',
  2,
  $g${
    "titel": "Spaghetti Carbonara",
    "portionen": 2,
    "kategorie": "Nudelgericht",
    "geschaetzte_kcal_gesamt": 1250,
    "zutaten": [
      { "name": "Spaghetti", "menge": 250, "einheit": "g", "aus_lager": false },
      { "name": "Pancetta oder durchwachsener Speck in Streifen", "menge": 150, "einheit": "g", "aus_lager": false },
      { "name": "Eigelb (Mischung mit Parmesan)", "menge": 2, "einheit": "Stück", "aus_lager": false },
      { "name": "geriebener Pecorino oder Parmesan", "menge": 80, "einheit": "g", "aus_lager": false },
      { "name": "schwarzer Pfeffer, frisch gemahlen", "menge": 1, "einheit": "TL", "aus_lager": false }
    ],
    "kochschritte": [
      "Nudeln in reichlich Salzwasser bissfest kochen. Speck in der Pfanne knusprig anbraten (ohne viel Fett, Speck fettet aus).",
      "Eigelb mit reichlich Parmesan, etwas Nudelwasser und Pfeffer glattrühren, nicht anbacken. Nudeln abgießen, heiß in die Pfanne mischen, von der heißen Platte nehmen, Eigelb-creme unterziehen, sofort anrichten. Keine kochende Sahne-Variante: klassisch nussig und cremig."
    ]
  }$g$::jsonb,
  1250,
  NULL,
  'Nudelgericht'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Spaghetti Carbonara');

-- Käsespätzle
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Käsespätzle',
  2,
  $g${
    "titel": "Käsespätzle",
    "portionen": 2,
    "kategorie": "Vegetarisch",
    "geschaetzte_kcal_gesamt": 1500,
    "zutaten": [
      { "name": "Spätzlemehl (oder Type 550 mit Eiern)", "menge": 250, "einheit": "g", "aus_lager": false },
      { "name": "Eier", "menge": 3, "einheit": "Stück", "aus_lager": false },
      { "name": "Wasser bzw. Milch (für Teig, nach Anleitung)", "menge": 200, "einheit": "ml", "aus_lager": false },
      { "name": "Emmentaler, gerieben", "menge": 200, "einheit": "g", "aus_lager": false },
      { "name": "Zwiebeln (für Röstzwiebeln)", "menge": 200, "einheit": "g", "aus_lager": false },
      { "name": "Butter", "menge": 2, "einheit": "EL", "aus_lager": false }
    ],
    "kochschritte": [
      "Spätzleteig rühren, durch Spätzlehobel oder Löffel in siedendes Salzwasser stechen, abschwimmen, abschöpfen, abschrecken bzw. warm halten.",
      "Fett in Auflaufform, Schichten Spätzle–Käse–Spätzle, oben viel Käse. Im Ofen 180 °C Umluft 15–20 Min überbacken, bis goldgelb. Zwiebeln in Butter goldbraun rösten und oben servieren."
    ]
  }$g$::jsonb,
  1500,
  NULL,
  'Vegetarisch'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Käsespätzle');

-- Rindergulasch
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Rindergulasch',
  4,
  $g${
    "titel": "Rindergulasch",
    "portionen": 4,
    "kategorie": "Suppe / Eintopf",
    "geschaetzte_kcal_gesamt": 2200,
    "zutaten": [
      { "name": "Rindergulasch, gewürfelt", "menge": 800, "einheit": "g", "aus_lager": false },
      { "name": "Zwiebeln", "menge": 400, "einheit": "g", "aus_lager": false },
      { "name": "Tomatenmark", "menge": 2, "einheit": "EL", "aus_lager": false },
      { "name": "Paprikapulver (edelsüß)", "menge": 1, "einheit": "EL", "aus_lager": false },
      { "name": "Knoblauch", "menge": 2, "einheit": "Zehen", "aus_lager": false },
      { "name": "Rindsuppe (Flüssigkeit)", "menge": 500, "einheit": "ml", "aus_lager": false },
      { "name": "Rotwein (optional; sonst Wasser/Suppe)", "menge": 150, "einheit": "ml", "aus_lager": false },
      { "name": "Öl", "menge": 2, "einheit": "EL", "aus_lager": false }
    ],
    "kochschritte": [
      "Fleisch portionsweise kräftig anbraten, Hitzefond mit Rotwein oder Wasser ablöschen, alles herausnehmen. Zwiebeln glasig dünsten, Tomatenmark anrösten, mit Paprikapulver, Knoblauch und Fleisch mischen, mit Brühe aufgießen, aufkochen, Hitze niedrig.",
      "Zugedeckt 2–2,5 h schmoren, ggf. Flüssigkeit nachgiessen, würzen. Mit Bandnudeln, Knödel oder Brot servieren — am nächsten Tag noch besser."
    ]
  }$g$::jsonb,
  2200,
  NULL,
  'Suppe / Eintopf'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Rindergulasch');

-- Cremige Tomatensuppe
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Cremige Tomatensuppe',
  4,
  $g${
    "titel": "Cremige Tomatensuppe",
    "portionen": 4,
    "kategorie": "Suppe / Eintopf",
    "geschaetzte_kcal_gesamt": 900,
    "zutaten": [
      { "name": "stückige Tomaten (Dose) oder reife frische Tomaten", "menge": 800, "einheit": "g", "aus_lager": false },
      { "name": "Schalotten oder Zwiebeln", "menge": 1, "einheit": "Stück (mittel)", "aus_lager": false },
      { "name": "Knoblauch", "menge": 2, "einheit": "Zehen", "aus_lager": false },
      { "name": "gemüsebrühe (Flüssigkeit)", "menge": 500, "einheit": "ml", "aus_lager": false },
      { "name": "Sahne (optional) oder pflanzliche Alternative", "menge": 100, "einheit": "ml", "aus_lager": false },
      { "name": "Olivenöl, Basilikum, Salz, Pfeffer", "menge": 1, "einheit": "Prise/EL", "aus_lager": false }
    ],
    "kochschritte": [
      "Zwiebel und Knoblauch in Öl andünsten, Tomaten dazugeben, 10 min köcheln, würzen, pürieren (Stabmixer).",
      "Brühe zugeben, 10 min ziehen lassen, Sahne untermischen, abschmecken, mit frischem Basilikum und Croutons servieren."
    ]
  }$g$::jsonb,
  900,
  NULL,
  'Suppe / Eintopf'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Cremige Tomatensuppe');

-- Lachsfilet aus dem Ofen
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Lachsfilet aus dem Ofen',
  2,
  $g${
    "titel": "Lachsfilet aus dem Ofen",
    "portionen": 2,
    "kategorie": "Fischgericht",
    "geschaetzte_kcal_gesamt": 800,
    "zutaten": [
      { "name": "Lachsfilet (Hautseite: knusprig, Haut an)", "menge": 2, "einheit": "Stück (à ca. 180 g)", "aus_lager": false },
      { "name": "Zitronen (Saft und Schale)", "menge": 0.5, "einheit": "Stück", "aus_lager": false },
      { "name": "Dill (frisch oder TK)", "menge": 1, "einheit": "EL gehackt", "aus_lager": false },
      { "name": "Olivenöl", "menge": 1, "einheit": "EL", "aus_lager": false },
      { "name": "Salz, Pfeffer, evtl. Honig/Soja für Glasur", "menge": 1, "einheit": "Prise", "aus_lager": false }
    ],
    "kochschritte": [
      "Lachs trocken tupfen, salzen, pfeffern, mit Zitrone, Dill und Öl würzen. Backofen 200 °C Umluft, auf Backpapier 12–16 Min, bis zart und innen noch ganz leicht rosa-rosa.",
      "Mit Fenchel, Ofengemüse oder Kartoffelpüree anrichten, gehackten Dill und Zitrone on top."
    ]
  }$g$::jsonb,
  800,
  NULL,
  'Fischgericht'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Lachsfilet aus dem Ofen');

-- Bayerischer Kartoffelsalat
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Bayerischer Kartoffelsalat',
  6,
  $g${
    "titel": "Bayerischer Kartoffelsalat",
    "portionen": 6,
    "kategorie": "Beilage / Salat",
    "geschaetzte_kcal_gesamt": 1400,
    "zutaten": [
      { "name": "festkochende Kartoffeln", "menge": 1200, "einheit": "g", "aus_lager": false },
      { "name": "Brühe (warm, kräftig, für Einlage)", "menge": 300, "einheit": "ml", "aus_lager": false },
      { "name": "Essig, Öl, Senf", "menge": 2, "einheit": "EL je", "aus_lager": false },
      { "name": "Zwiebel, fein gewürfelt", "menge": 1, "einheit": "Stück (mittel)", "aus_lager": false },
      { "name": "Schnittlauch", "menge": 1, "einheit": "Bund", "aus_lager": false }
    ],
    "kochschritte": [
      "Kartoffeln in Salzwasser kochen, schälen, in Scheiben schneiden, noch warm mit warmer Brühe, Essig-Öl-Senf, Zwiebeln und Gewürz abschmecken, mindestens 1 h durchziehen lassen, mehrmals wenden.",
      "Vor dem Servieren Schnittlauch mischen, mit Weißwurst, Schnitzel oder allein (klassisch süddeutsch) essen. Kein Mayo-Variant: das ist ein anderer Salat."
    ]
  }$g$::jsonb,
  1400,
  NULL,
  'Beilage / Salat'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Bayerischer Kartoffelsalat');

-- Rinderrouladen
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Rinderrouladen',
  4,
  $g${
    "titel": "Rinderrouladen",
    "portionen": 4,
    "kategorie": "Fleischgericht",
    "geschaetzte_kcal_gesamt": 3200,
    "zutaten": [
      { "name": "Rinderrouladen (vom Oberschale)", "menge": 4, "einheit": "Stück (à ca. 200 g)", "aus_lager": false },
      { "name": "Speckstreifen, Essiggurken, Zwiebel (Füllung)", "menge": 200, "einheit": "g (gemischt)", "aus_lager": false },
      { "name": "Senf, Salz, Pfeffer", "menge": 2, "einheit": "EL Senf (gesamt)", "aus_lager": false },
      { "name": "Rinder- oder Bratenfond, Rotwein", "menge": 600, "einheit": "ml (gesamt flüssig)", "aus_lager": false },
      { "name": "Öl, Butter", "menge": 2, "einheit": "EL", "aus_lager": false }
    ],
    "kochschritte": [
      "Fleisch klopfen, würzen, Senf, Speck, Gurke, Zwiebel einrollen, mit Rouladennadeln oder Faden fixieren, rundum anbraten. Mit Weinfond, Deckel, niedrige Hitze 1,5–2 h schmoren, Sauce einreduzieren, mit Klöße oder Nudeln servieren (Rotkohl dazu, wenn gewünscht)."
    ]
  }$g$::jsonb,
  3200,
  NULL,
  'Fleischgericht'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Rinderrouladen');

-- Klassischer Apfelstrudel
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Klassischer Apfelstrudel',
  8,
  $g${
    "titel": "Klassischer Apfelstrudel",
    "portionen": 8,
    "kategorie": "Dessert / Backen",
    "geschaetzte_kcal_gesamt": 2600,
    "zutaten": [
      { "name": "Strudelteig (Fertig oder selbst) oder Yufka/Blätter-Alternative", "menge": 1, "einheit": "Rolle/Portionen", "aus_lager": false },
      { "name": "Äpfel, säurehaltig, geschält und in Spalten", "menge": 1000, "einheit": "g", "aus_lager": false },
      { "name": "Semmelbrösel, Butter, Zimt, Zucker", "menge": 80, "einheit": "g Zucker (Richtwert)", "aus_lager": false },
      { "name": "Rosinen (eingeweicht optional)", "menge": 50, "einheit": "g", "aus_lager": false },
      { "name": "Puderzucker, Vanillesauce (optional servieren)", "menge": 1, "einheit": "Prise/Portion", "aus_lager": false }
    ],
    "kochschritte": [
      "Brösel in Butter rösten, mit Äpfeln, Zucker, Zimt, Zitronensaft (und Rosinen) füllen, Strudel einrollen, mit Butter bestreichen, 180 °C 25–35 Min goldbraun backen, mit Puderzucker bestäuben, warm mit Vanillesoße oder Eis servieren (Teig dunn auswallen, wenn frisch: Ruhe wichtig)."
    ]
  }$g$::jsonb,
  2600,
  NULL,
  'Dessert / Backen'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Klassischer Apfelstrudel');

-- Griechischer Bauernsalat
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Griechischer Bauernsalat',
  4,
  $g${
    "titel": "Griechischer Bauernsalat",
    "portionen": 4,
    "kategorie": "Beilage / Salat",
    "geschaetzte_kcal_gesamt": 650,
    "zutaten": [
      { "name": "Gurke, Tomate, rote Paprika", "menge": 600, "einheit": "g (gemischt)", "aus_lager": false },
      { "name": "rote Zwiebel", "menge": 1, "einheit": "Stück", "aus_lager": false },
      { "name": "Oliven, Feta (oder veganes Substitut)", "menge": 200, "einheit": "g (Feta)", "aus_lager": false },
      { "name": "Olivenöl, Oregano, Zitronensaft, Salz, Pfeffer", "menge": 3, "einheit": "EL Olivenöl", "aus_lager": false }
    ],
    "kochschritte": [
      "Gemüse in grobe Stücke, Zwiebel in feine Ringe, mischen, mit Oliven, gewürfeltem Feta (nicht sofort: erst vor Servieren) und Dressing würzen, 10 min im Kühlschrank ziehen lassen, mit Brot als Vorspeise oder leichte Mahlzeit."
    ]
  }$g$::jsonb,
  650,
  NULL,
  'Beilage / Salat'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Griechischer Bauernsalat');

-- Hähnchenbrust in Kräutersoße
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  'Hähnchenbrust in Kräutersoße',
  2,
  $g${
    "titel": "Hähnchenbrust in Kräutersoße",
    "portionen": 2,
    "kategorie": "Fleischgericht",
    "geschaetzte_kcal_gesamt": 950,
    "zutaten": [
      { "name": "Hähnchenbrustfilet", "menge": 2, "einheit": "Stück (à ca. 200 g)", "aus_lager": false },
      { "name": "Schalotte oder Knoblauch", "menge": 1, "einheit": "Stück/2 Zehen", "aus_lager": false },
      { "name": "Hühnerfond (oder Brühe)", "menge": 200, "einheit": "ml", "aus_lager": false },
      { "name": "Sahne oder Creme fraîche (leichtere Variante: etwas Joghurt am Ende)", "menge": 100, "einheit": "ml", "aus_lager": false },
      { "name": "Petersilie, Estragon/Schnittlauch, Salz, Pfeffer", "menge": 1, "einheit": "Handvoll", "aus_lager": false }
    ],
    "kochschritte": [
      "Fleisch salzen, pfeffern, in Pfanne beidseitig gold, herausnehmen, Schalotte glasig, mit Fond ablöschen, reduzieren, Sahne und feine Kräuter einrühren, Hähnchen zurücklegen und gar ziehen lassen, Sauce bindet leicht, mit Reis oder Nudeln servieren. Hitze nicht übertreiben, damit Brust saftig bleibt."
    ]
  }$g$::jsonb,
  950,
  NULL,
  'Fleischgericht'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = 'Hähnchenbrust in Kräutersoße');