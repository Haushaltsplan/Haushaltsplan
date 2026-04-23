-- Ersetzt kochschritte in der Stammsammlung durch ausführliche Schritt-für-Schritt-Anleitungen.
-- UPDATE pro titel; jsonb_set-Pfad: ARRAY['kochschritte'].

UPDATE public.lager_rezept_katalog
SET
  gericht_json = jsonb_set(
    gericht_json,
    ARRAY['kochschritte']::text[],
    to_jsonb(ARRAY[
      $s$ Arbeitsfläche freiräumen: großes Schneidebrett, scharfes Messer, großer Topf, hohe Pfanne, Schneebesen, Schöpfkelle, Käsereibe, feuerfeste Auflaufform (ca. 30×20 cm) bereitlegen.$s$,
      $s$ Ofen auf 180 °C Umluft vorheizen; falls nur Ober-/Unterhitze: 200 °C, Rost in die mittlere Schiene.$s$,
      $s$ Zwiebeln schälen, Wurzel- und Stumpfende entfernen, in Würfel von 5–7 mm schneiden.$s$,
      $s$ Möhren schälen, Enden abschneiden, in feine Würfel; in eine Schüssel legen (separat von der Zwiebel).$s$,
      $s$ Knoblauch schälen und fein hacken oder pressen; in eine kleine Schale.$s$,
      $s$ Große Pfanne auf Herdstufe 5–6 von 9 stellen, 1–2 Min vorwärmen, dann 2 EL Olivenöl hinein. Wenn das Öl leicht glänzt, ist die Temperatur passend (nicht rauchen lassen).$s$,
      $s$ Zwiebeln einfüllen, unter Rühren 4–5 Min glasig dünsten; nicht bräunen. Dann Möhren 3 Min mitdünsten.$s$,
      $s$ Rinderhack dazugeben, mit dem Löffel in kleine Stücke teilen, 5–6 Min anbraten, bis durchgegart und keine rosa Röllchen mehr sichtbar sind.$s$,
      $s$ Passierte Tomaten und Knoblauch zugeben, 1 Prise Salz, 0,5 TL getrockneter Oregano, wenig Pfeffer; einmal aufkochen, dann die Hitze auf Stufe 2–3 reduzieren.$s$,
      $s$ Deckel leicht ansetzen, 30–40 Min leicht köcheln lassen; alle 8–10 Min rühren und ggf. 2–3 EL Wasser oder Brühe nachgießen, falls es zu dick ansetzt. Sauce soll sämig, nicht wässrig sein; abschmecken, optional Prise Zucker gegen Säure.$s$,
      $s$ Bolognese in eine Schüssel umfüllen; Pfanne auswischen. Für Bechamel einen mittleren Topf (1–1,5 l) nehmen.$s$,
      $s$ Bechamel: 40 g Butter schmelzen (mittlere Hitze) ohne bräunen. Mehl einstreuen, 1–2 Min anschwitzen, bis es duftet und glasig bleibt.$s$,
      $s$ Milch in mehreren Portionen unter kräftigem Schlagen mit dem Schneebesen eingießen, Klumpen vermeiden. 5–6 Min ganz leicht kochen, bis die Soße dickt und am Löffel sichtbar einnickt. Mit Salz, Pfeffer und optional frisch geriebener Muskatnuss würzen.$s$,
      $s$ Auflaufform innen dick mit Butter bestreichen (Boden und alle Seiten, damit nichts klebt).$s$,
      $s$ Erste Schicht: 3–4 trockene Lasagneplatten nebeneinander legen; eine Lücke? Platten vorsichtig brechen und Lücken füllen.$s$,
      $s$ Darauf etwa ein Drittel der Bolognese streichen, glatt ziehen, dann ein Drittel Bechamel; optional dünn Käse darauf.$s$,
      $s$ Zweite Schicht Platten, dann wieder Bolognese und Bechamel; dritte Schicht Platten, restliche Bolognese, restliche Bechamel, 120 g Käse gleichmäßig oben; Rand nicht voll mit Käse bedecken, damit Heißluft an die Seiten kommt.$s$,
      $s$ In den vorgeheizten Ofen, Mitte, 35–40 Min, bis oben goldbraun und am Rand Bläschen. Optional mit Thermometer: Mitte 75 °C.$s$,
      $s$ Form 5–10 Min auf dem Herd aus dem Ofen stellen, ruhen lassen, dann in Stücke schneiden. Heiße Form mit Handschuh anfassen. Mit Basilikum oder frischem Käse servieren — sofort heiß essen.$s$
    ]::text[]),
    true
  ),
  aktualisiert_am = now()
WHERE titel = 'Lasagne';

UPDATE public.lager_rezept_katalog
SET
  gericht_json = jsonb_set(
    gericht_json,
    ARRAY['kochschritte']::text[],
    to_jsonb(ARRAY[
      $s$ Kalbsschnitzel 20–30 Min aus dem Kühlschrank, Küchenpapier trocken tupfen, keine stehende Flüssigkeit auf dem Fleisch, sonst hält die Panade nicht.$s$,
      $s$ Je Schnitzel zwischen Frischhaltefolie oder in einen großen Gefrierbeutel legen, mit Fleischklopfer oder dem flachen Boden einer Pfanne gleichmäßig plattieren auf ca. 5–6 mm, keine Löcher, Fleisch dabei nicht zerreißen.$s$,
      $s$ Beide Seiten leicht salzen (Prise) und pfeffern, 2–3 Min ziehen lassen; zu viel Salz = Panade weich.$s$,
      $s$ Wichtig: drei flache Teller: (1) Mehl, (2) Eier in einem Teller verquirlen, Prise Salz, (3) Paniermehl lockern, nicht pressen — Krume soll luftig bleiben.$s$,
      $s$ Erstes Schnitzel: eine Hand nur zum Halten, andere zum Wenden — zuerst in Mehl, überschüssiges Mehl abklopfen, dann vollständig in Ei, kurz abtropfen, dann in Paniermehl, leicht andrücken, überstehende Brösel abklopfen.$s$,
      $s$ Schnitzel 2–3 Min auf einem Rost oder Gitter liegen lassen, damit die Panade antrocknet und im Fett nicht weich wird. Zweites Schnitzel genauso panieren und ruhen lassen.$s$,
      $s$ Breite hohe Pfanne (mind. 28 cm) auf Herdstufe 6–7 stellen, 2 EL Butterschmalz oder genug Öl, dass das Fett ca. 2–3 mm tief in der Mitte steht, aber kein Tauchen. Wenn ein Semmelbrösel-Tropfen in 2–3 s gold wird, ist die Temperatur reif.$s$,
      $s$ Nur ein Schnitzel in die Pfanne, nicht anstoßen, 1,5–2 Min erste Seite goldgelb, dann mit Fischwender wenden, 1–1,5 Min Rückseite, Hitze bei Bedarf leicht drosseln, nicht schwarz anbrennen lassen. Innen 60–70 °C ist für Kalb ausreichend, nicht länger braten, sonst trocken.$s$,
      $s$ Schnitzel auf Küchenkrepp legen, 1–2 Min Fett abtropfen lassen, dann wärmen oder direkt anrichten. Fett: wenn es sehr dunkel ist, gießen, Pfanne wischen, neues Fett erhitzen, zweites Schnitzel in frischem Fett, sonst bitter.$s$,
      $s$ Zitrone in Spalten schneiden, daneben anrichten, vor dem Essen drüberdrücken; die Säure schneidet das Fett. Sofort heiß servieren.$s$
    ]::text[]),
    true
  ),
  aktualisiert_am = now()
WHERE titel = 'Wiener Schnitzel';

UPDATE public.lager_rezept_katalog
SET
  gericht_json = jsonb_set(
    gericht_json,
    ARRAY['kochschritte']::text[],
    to_jsonb(ARRAY[
      $s$ Großen Topf mit reichlich Wasser füllen, Deckel, auf Stufe 9 zum Kochen bringen, dann 1–2 Esslöffel Salz fürs Nudelwasser (pro Liter etwa 1 TL Salz) — wichtig für den Pastageschmack.$s$,
      $s$ Währenddessen: Speck oder Pancetta in 3–4 mm breite Streifen schneiden. Kleine Pfanne, Speck hinein, Herd auf 5, langsam anbraten, bis das Fett raus ist und der Speck knusprig ist, 5–7 Min, nicht schwarz. Restfett 1–2 EL in der Pfanne lassen, Speck auf Küchenkrepp abtropfen lassen, warm stellen.$s$,
      $s$ 2 Eigelb in eine Schale, etwa 50 g geriebener Parmesan, frisch gemahlenen Pfeffer dazu, mit einer Gabel in eine feste, cremige Paste rühren (kein Schaum nötig).$s$,
      $s$ Wenn das Nudelwasser kräftig kocht, Spaghetti in den Topf, mit einer Gabel auseinanderdrehen, Packungszeit minus 1 Minute für bissfest; Timer stellen. Vor dem Abgießen 150 ml heißes Nudelwasser in ein Messgefäß schöpfen — wird für die Creme benötigt.$s$,
      $s$ Nudelwasser-Rest 2 EL heiß in die Eigelb-Parmesan-Mischung rühren, sofort schnell verrühren, damit nichts stockt, aber noch nicht dick.$s$,
      $s$ Nudeln abgießen, nicht abspülen, dazu die warme, leer ausgeschüttete große Rührschüssel: heiße Nudeln, Speck, 1–2 EL Speckfett aus der Pfanne, alles schnell wenden, nicht kalt werden lassen.$s$,
      $s$ Schüssel vom Herd, Eigelb-Mischung sofort dazu, mit Zangen oder Gabel 30–40 Sek schnell heben, Creme muss sämig umschließen, kein laufendes Eigelb sichtbar. Wenn zu fest: 1 EL heißes Nudelwasser nach, wieder heben, bis glänzend und cremig. Rest Käse und Pfeffer, abschmecken, optional Salz (Speck würzt).$s$,
      $s$ Sofort auf tiefe, vorgewärmte Teller portionieren, nicht im Topf wiederverwärmen, sonst werden Eier fest. Tisch anrichten, warm essen. Kein Sahne, kein vorgekochtes Rührei — nur diese Technik, sonst Gerinnung.$s$
    ]::text[]),
    true
  ),
  aktualisiert_am = now()
WHERE titel = 'Spaghetti Carbonara';

UPDATE public.lager_rezept_katalog
SET
  gericht_json = jsonb_set(
    gericht_json,
    ARRAY['kochschritte']::text[],
    to_jsonb(ARRAY[
      $s$ Topf (mind. 4 l) knapp 3/4 mit Wasser füllen, 1 Esslöffel Salz, zum Kochen bringen, Deckel, Stufe 7–8.$s$,
      $s$ Spätzlemehl, Eier, Salz und Wasser bzw. Milch laut typischer Mischverhältnisse in eine Schüssel, mit Löffel oder Maschine 2–3 Min zu einem glatten, zähen, tropfenden Teig rühren; keine Klumpen, Teig muss dick, aber laufen.$s$,
      $s$ Feuerfeste Form (z. B. 25×20) innen reichlich mit Butter einfetten, auch den Rand, damit Käse nicht anbackt.$s$,
      $s$ Sieden: Spätzlehobel an den Topf, halben Teig durchziehen, 1–2 Min in kochendem, leicht siedendem Wasser, bis Spätzle oben schwimmen, mit Schaumlöffel abnehmen, optional kurz in kaltes Wasser, dann in Sieb, gut abtropfen lassen, nicht lange, sonst klumpt es.$s$,
      $s$ Restteig derselbe Vorgang. Alle Spätzle, wenn nötig, in einer Schale mit 1 Nuss Butter trennen, damit es nicht aneinanderbackt, bis zur Schichtung.$s$,
      $s$ Erste Lage Spätzle in die Form, ein Drittel des Emmentalers darauf; zweite Lage, wieder Käse; dritte Lage, restlicher Käse oben, Rand 0,5–1 cm frei, damit heißer Käse nicht überkocht.$s$,
      $s$ Ofen auf 180 °C Umluft, Form auf mittlerer Schiene 15–20 Min, Käse gold und Bläschen, nicht schwarz — nach 12 Min in den Blick, Hitze 170 °C, wenn zu schnell.$s$,
      $s$ Zwiebeln in feine Ringe, in 1–2 EL Butter 6–8 Min bräunen, nicht schwarz, wenden. Auf die fertig gratinierte Spätzle oben, servieren, 3–5 Min im Ofen-Rest warm halten, wenn nötig.$s$,
      $s$ 3 Min ruhen, Käse setzt, nicht brennend. Mit Salat dazu, warm essen — Spätzle bleibt sonst festsitzend, bei Bedarf 1 Löffel Wasser dazu.$s$
    ]::text[]),
    true
  ),
  aktualisiert_am = now()
WHERE titel = 'Käsespätzle';

UPDATE public.lager_rezept_katalog
SET
  gericht_json = jsonb_set(
    gericht_json,
    ARRAY['kochschritte']::text[],
    to_jsonb(ARRAY[
      $s$ Gulaschfleisch in 3–4 cm Würfel, Küchenpapier abtupfen, Zwiebeln würfeln, Knoblauch fein hacken – alles in Schälchen legen, Topf 5 l oder großer Bräter bereitstellen.$s$,
      $s$ 2 EL Öl, Herd 6–7, Fleisch in zwei Chargen: Stücke flach legen, 2–3 Min pro Seite scharf anbraten, nur bräunen, nicht im Saft dünsten. Zwischendurch in Schüssel. Zweite Charge gleich, Hitze drosseln, wenn es zu schnell schwarz wird.$s$,
      $s$ Hitze 4–5, Zwiebeln 5–6 Min glasig, Tomatenmark 2 Min anrösten, bis es duftet, nicht schwarz, Paprika und Knoblauch kurz, Fleisch wieder einfüllen, umrühren, Rotwein oder 150 ml Wasser dazu, Brühe 500 ml, Lorbeer, aufkochen, Deckel.$s$,
      $s$ Herd 2, 1,5–2 h köcheln, alle 20 min umrühren, 50–100 ml Wasser nachgießen, wenn zu viel einkocht. Wenn die Soße sämig und das Fleisch mit der Gabel zerfällt: abschmecken, Salz, Pfeffer, optional Lorbeer entfernen. Mit Nudeln oder Knödeln servieren; Rest im Kühlschrank, am nächsten Tag nochmals 10 min leicht erhitzen.$s$,
    ]::text[]),
    true
  ),
  aktualisiert_am = now()
WHERE titel = 'Rindergulasch';

UPDATE public.lager_rezept_katalog
SET
  gericht_json = jsonb_set(
    gericht_json,
    ARRAY['kochschritte']::text[],
    to_jsonb(ARRAY[
      $s$ Schalotte oder halbe große Zwiebel schälen, fein würfeln. Knoblauchzehen pressen. Topf, 2 EL Olivenöl, Stufe 4–5, 2 Min, Zwiebel glasig, Gold vermeiden.$s$,
      $s$ Tomaten aus der Dose abgießen, Saft 100 ml auffangen. Frische: viertel, Stiele entfernen. Alles 8–10 min bei mittlerer Hitze, gelegentlich wenden, würzen: Salz, 1/2 TL Zucker, Pfeffer, optional Chiliflock, bis weich, Flüssigkeit reduziert.$s$,
      $s$ Stabmixer: Suppe pürieren, bis ganz fein, nicht schaumig, mit Topfboden, Rest Brühe 500 ml dazu, aufkochen, 5 min köcheln, dick, nicht anbrennen.$s$,
      $s$ Hitze 2, Sahne 100 ml einrühren, nicht kochen lassen, sonst gerinnt, nur heiß, 2 min. Abschmecken, Salz, ggf. Zitronensaft 1/2 Zitrone, frische Kräuter, Basilikum, Oliven.$s$,
      $s$ Teller, optional Croutons, Olivenöl tröpfchen, Pfeffer. Warm essen, Rest Kühlschrank 3 Tage. Kalt nicht optimal; nachwärmen vorsichtig, nicht sieden, Sahne trennt.$s$
    ]::text[]),
    true
  ),
  aktualisiert_am = now()
WHERE titel = 'Cremige Tomatensuppe';

UPDATE public.lager_rezept_katalog
SET
  gericht_json = jsonb_set(
    gericht_json,
    ARRAY['kochschritte']::text[],
    to_jsonb(ARRAY[
      $s$ Lachsfilets 20 Min außerhalb des Kühlschranks, kühl aber nicht eiskalt, damit die Garung gleichmäßig ist. Küchenpapier trocken tupfen, besonders die Haut, damit sie im Ofen kross wird, nicht wässerig dünsten.$s$,
      $s$ Fisch mit Salz und Pfeffer beidseitig würzen, dabei die Haut leicht einsalzen, nicht zu viel, sonst zieht Flüssigkeit. 1/2 Zitrone auspressen, Saft leicht tröpfchenweise aufs Fleisch, nicht in Schalen lassen, sonst sauer.$s$,
      $s$ 1 EL Olivenöl und fein gehackten Dill gleichmäßig, Haut bleibt flach, nicht einrollen. Backblech, Backpapier, dünnes Öl auf dem Papier verstreichen, Fisch mit der Hautseite zuerst auflegen — Haut liegt auf dem heißeren Blech, dadurch kross, Fleisch bescheidener.$s$,
      $s$ Ofen 200 °C Umluft, mindestens 10 min vorheizen, Blech in die Mitte, Timer 10 min. Je nach Dicke 10–15 min, nicht den Ofen ständig öffnen, sonst verzögert es die Gare.$s$,
      $s$ Ab ca. 8 min mit Fleischthermometer in die dickste Stelle stechen (Fleisch, nicht die Haut anstechen): 50–52 °C = im Kern noch rosa, 55–58 °C = voll, darüber: eher trocken, nicht länger backen, als nötig.$s$,
      $s$ Heißes Blech mit Ofenhandschuh anfassen. Lachs 1–2 min ruhen. Mit Kräutern, Zitrone und Beilage warm servieren. Restfisch kühl lagern und am nächsten Tag kalt oder nur kurz erwärmt verzehren.$s$,
    ]::text[]),
    true
  ),
  aktualisiert_am = now()
WHERE titel = 'Lachsfilet aus dem Ofen';

UPDATE public.lager_rezept_katalog
SET
  gericht_json = jsonb_set(
    gericht_json,
    ARRAY['kochschritte']::text[],
    to_jsonb(ARRAY[
      $s$ Kartoffeln gründlich bürsten, festkochende Sorte, gleich groß wählen. In einen großen Topf, kalt mit Wasser bedecken, 1 Esslöffel Salz, Herd hoch, zum Kochen bringen, dann 18–22 min bei leichtem Sieden garen, bis eine Gabel mühelos eindringt, nicht zerfallen.$s$,
      $s$ Abgießen, kurz abdampfen lassen, solange sie heiß sind Schale abziehen (Vorsicht Dampf) oder abkühlen lassen und schälen. In 3–4 mm dicke Scheiben schneiden, noch warm in eine große Schüssel.$s$,
      $s$ Zwiebel fein würfeln. Warme, kräftige Brühe (300 ml) bereitstellen — muss heiß sein, damit die Kartoffelscheiben die Flüssigkeit aufsaugen.$s$,
      $s$ Essig (2 EL), Öl (2 EL), Senf (2 EL) in einer kleinen Schüssel mit einer Gabel zu einer glatten Emulsion verquirlen, mit Prise Salz und Pfeffer abschmecken — leicht säuerlich, nicht sauer.$s$,
      $s$ Warme Brühe über die heißen Kartoffelscheiben gießen, Zwiebeln dazu, Dressing darüber, sofort vorsichtig wenden (nicht zerdrücken), 1 h bei Raumtemperatur ziehen lassen, alle 15 min wenden. Salat wird mit der Zeit geschmackvoller.$s$,
      $s$ Vor dem Servieren gehackten Schnittlauch unterheben, nochmals abschmecken. Klassisch zu Weißwurst, Schnitzel oder kalt — kein Mayonnaise, das wäre ein anderer Kartoffelsalat.$s$
    ]::text[]),
    true
  ),
  aktualisiert_am = now()
WHERE titel = 'Bayerischer Kartoffelsalat';

UPDATE public.lager_rezept_katalog
SET
  gericht_json = jsonb_set(
    gericht_json,
    ARRAY['kochschritte']::text[],
    to_jsonb(ARRAY[
      $s$ Rouladenfläche mit Folie belegen, Fleisch trocken tupfen, auf ca. 5–7 mm klopfen, gleichmäßig, keine Löcher. Pro Stück salzen, pfeffern, dünn Senf bestreichen.$s$,
      $s$ Speck, Essiggurke, Zwiebel in Streifen in den vorderen Bereich legen, nicht zu voll, sonst lässt sich nicht rollen. Fest einrollen, mit Rouladennadeln oder Küchengarn fixieren, Enden eintucken.$s$,
      $s$ Bräter oder hohe Pfanne, 2 EL Öl, Stufe 6, Rouladen von allen Seiten 2–3 Min anbraten, nur anrösten, heraus in eine Schale.$s$,
      $s$ Wenn Bräter mit Bratensatz: Restzwiebel glasig, mit Rotwein ablöschen, Fond, Brühe, Lorbeer, Rouladen zurück, Flüssigkeit knapp bedeckt, aufkochen, Deckel, Herd 2, 1,5–2 h, gelegentlich wenden, Flüssigkeit nachschütten, nicht trockenbrennen.$s$,
      $s$ Garprobe: Fleisch weich, Soße sämig. Lorbeer entfernen, Soße ggf. mit Stärke oder längerer Reduktion andicken, abschmecken, mit Beilage warm servieren, Rest 2 Tage im Kühlschrank, langsam aufwärmen.$s$
    ]::text[]),
    true
  ),
  aktualisiert_am = now()
WHERE titel = 'Rinderrouladen';

UPDATE public.lager_rezept_katalog
SET
  gericht_json = jsonb_set(
    gericht_json,
    ARRAY['kochschritte']::text[],
    to_jsonb(ARRAY[
      $s$ Ofen 180 °C Umluft vorheizen, Backblech mit Backpapier. Semmelbrösel in 1 EL Butter in einer Pfanne 2–3 Min gold rösten, leicht salzen, optional Zimt, abkühlen lassen.$s$,
      $s$ Äpfel schälen, entkernen, in dünne Spalten, mit Zitronensaft mischen, damit sie nicht braun werden. Zucker, Zimt, Rosinen optional 5 Min in einer Schüssel ziehen lassen, etwas Saft am Boden ist in Ordnung.$s$,
      $s$ Strudelteig (Fertig) vorsichtig auf bemehlter Fläche ausrollen, dünn, nicht reißen, mit weichem Tuch oder Folie abdecken, 2 Min ruhen, wenn Anleitung auf der Packung.$s$,
      $s$ Teig mit der Hälfte der Brösel bestreichen, Apfelmischung gleichmäßig verteilen, Rand 2–3 cm frei, mit weichem Rand einschlagen, von der Längsseite fest einrollen, Enden eintucken, Naht unten aufs Backpapier.$s$,
      $s$ Strudel mit Rest-Butter bestreichen, evtl. 1 Prise Zucker auf der Oberfläche. Einschneiden oberflächlich, damit Dampf entweicht. 25–35 Min backen, bis goldbraun, Duft nach gebackenem Apfel, nicht schwarz.$s$,
      $s$ 5–10 Min ruhen, lauwarm mit Puderzucker, Vanillesoße oder Vanilleeis servieren. Scharfes Messer, heiße Stücke vorsichtig schneiden.$s$
    ]::text[]),
    true
  ),
  aktualisiert_am = now()
WHERE titel = 'Klassischer Apfelstrudel';

UPDATE public.lager_rezept_katalog
SET
  gericht_json = jsonb_set(
    gericht_json,
    ARRAY['kochschritte']::text[],
    to_jsonb(ARRAY[
      $s$ Gurke waschen, Enden abschneiden, wahlweise Kerne mit dem Löffel leicht entfernen, in große Stücke. Tomaten waschen, Stielansatz entfernen, grob würfeln. Paprika halbieren, Kerne entfernen, in Streifen.$s$,
      $s$ Rote Zwiebel in feine Ringe schneiden. Oliven abtropfen lassen. Feta in Würfel, nicht zu klein, separat aufbewahren — erst zuletzt dazu, sonst zerfällt er.$s$,
      $s$ Dressing: 3 EL Olivenöl, 1 EL Zitronensaft, Oregano, Salz, Pfeffer in einem Glas schütteln oder schlagen, bis es emulgiert.$s$,
      $s$ Gurke, Tomate, Paprika, Zwiebel, Oliven in einer großen Schüssel vorsichtig mischen, Dressing darüber, gut wenden, 10 Min im Kühlschrank ziehen lassen, einmal wenden.$s$,
      $s$ Vor dem Servieren Feta daraufstreuen, nicht zu früh rühren. Mit Brot oder als Beilage servieren, sofort essen, Rest am selben Tag verbrauchen, Feta wird sonst matschig.$s$
    ]::text[]),
    true
  ),
  aktualisiert_am = now()
WHERE titel = 'Griechischer Bauernsalat';

UPDATE public.lager_rezept_katalog
SET
  gericht_json = jsonb_set(
    gericht_json,
    ARRAY['kochschritte']::text[],
    to_jsonb(ARRAY[
      $s$ Hähnchenbrust trocken tupfen, überschüssiges Fett entfernen, beidseitig salzen und pfeffern, 10–15 Min ziehen lassen. Fleisch 15 min vor dem Braten aus dem Kühlschrank nehmen, damit es gleichmäßig gart.$s$,
      $s$ Große Pfanne, 1 EL Öl oder Butter, Stufe 6–7. Wenn das Fett leicht raucht, Brust mit der flachen Seite zuerst 4–5 Min anbraten, goldbraun, Hitze drosseln, bevor es schwarz wird.$s$,
      $s$ Wenden, zweite Seite 3–4 Min, Innentemperatur am dicksten Stück 72–75 °C, nicht über 78 °C, sonst trocken. Brust heraus, locker in Alufolie wickeln, 3–5 Min ruhen, Saft auffangen.$s$,
      $s$ Dieselbe Pfanne auf mittlere Hitze, fein gewürfelte Schalotte oder 2 gepresste Knoblauchzehen 1–2 Min glasig, Bratfond und Fleischsäfte mit Löffel ankratzen, mit 100 ml trockenem Weißwein oder 1 EL Zitrone ablöschen, fast verdampfen lassen.$s$,
      $s$ 200 ml Hühner- oder Gemüsefond dazu, aufkochen, 3–4 Min sämig einkochen, 100 ml Schlagsahne oder Crème fraîche einrühren, nicht kochen lassen, nur köcheln, bis die Soße andickt, Salz, Pfeffer, Muskat.$s$,
      $s$ Kräuter (z. B. Petersilie, Estragon, Thymian) fein gehackt, 1 Min in die heiße Soße. Hähnchen in Scheiben schneiden, Soße drüber, mit Kartoffeln oder Nudeln servieren, Reste 1 Tag kühl, aufwärmen vorsichtig, nicht hart kochen.$s$
    ]::text[]),
    true
  ),
  aktualisiert_am = now()
WHERE titel = 'Hähnchenbrust in Kräutersoße';
