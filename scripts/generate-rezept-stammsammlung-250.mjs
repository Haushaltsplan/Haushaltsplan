#!/usr/bin/env node
/**
 * Generiert Migration: 250 neue Rezepte für lager_rezept_katalog.
 * Aufruf: node scripts/generate-rezept-stammsammlung-250.mjs
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUT = join(ROOT, 'supabase', 'migrations', '20260531210000_lager_rezept_stammsammlung_250.sql');

const SKIP = new Set([
  'Lasagne',
  'Wiener Schnitzel',
  'Spaghetti Carbonara',
  'Käsespätzle',
  'Rindergulasch',
  'Cremige Tomatensuppe',
  'Lachsfilet aus dem Ofen',
  'Bayerischer Kartoffelsalat',
  'Rinderrouladen',
  'Klassischer Apfelstrudel',
  'Griechischer Bauernsalat',
  'Hähnchenbrust in Kräutersoße',
]);

const KATS = [
  'Vegetarisch',
  'Vegan',
  'Nudelgericht',
  'Fleischgericht',
  'Fischgericht',
  'Suppe / Eintopf',
  'Beilage / Salat',
  'Dessert / Backen',
  'Sonstiges',
];

function z(name, menge, einheit) {
  return { name, menge, einheit, aus_lager: false };
}

function escapeSql(s) {
  return String(s).replace(/'/g, "''");
}

function jsonForSql(obj) {
  return JSON.stringify(obj, null, 2).replace(/\$/g, '\\$');
}

// ─── Step builders (8–18 detaillierte Schritte, Deutsch) ───────────────────

function stepsPasta(ctx) {
  const pasta = ctx.pasta ?? 'Nudeln';
  const sauce = ctx.sauce ?? 'Soße';
  const n = ctx.zutatenNames ?? 'die Zutaten';
  return [
    `Arbeitsfläche freiräumen: großer Topf (mind. 5 l), hohe Pfanne oder Sauteuse, Schöpfkelle, Sieb, Küchenuhr und großes Schneidebrett bereitstellen.`,
    `Großen Topf mit reichlich kaltem Wasser füllen (ca. 1 l pro 100 g ${pasta}), Deckel aufsetzen, auf Herdstufe 9 von 9 zum kräftigen Kochen bringen.`,
    `Während das Wasser heizt: ${n} vorbereiten — Gemüse schneiden, Kräuter waschen, Käse reiben, alles in Schüsseln getrennt bereitstellen.`,
    `Wasser kräftig salzen (ca. 1 EL Salz pro Liter), ${pasta} einrühren, Uhr stellen: Packungsangabe minus 1 Min als Richtwert für al dente.`,
    `Für ${sauce}: Pfanne auf Herdstufe 6–7 von 9 vorwärmen, Öl oder Butter erhitzen bis leicht glänzend, nicht rauchen lassen.`,
    `Aromaten (Zwiebel, Knoblauch) 3–4 Min glasig dünsten, dann Hauptzutaten nach Rezept anbraten oder mitgeben, Hitze anpassen.`,
    `Flüssigkeit (Tomaten, Sahne, Brühe) zugeben, einmal aufkochen, Hitze auf Stufe 3–4 reduzieren, 8–15 Min köcheln bis die Konsistenz an der Soßenkelle haftet.`,
    `Mit Salz, Pfeffer und ggf. Chili, Zitrone oder Käse abschmecken; Soße warm halten (Deckel, niedrige Stufe).`,
    `2–3 Min vor Ende der Nudelgarzeit eine Schöpfkelle Nudelwasser aufheben — enthält Stärke zum Binden der Soße.`,
    `${pasta} im Sieb abgießen, nicht abschrecken, sofort in die Pfanne zur Soße geben, mit etwas Nudelwasser unter Rühren emulgieren.`,
    `1–2 Min auf Stufe 4 mitrühren, bis die Soße glänzend an den Nudeln haftet; Portionen mit Kelle auf tiefe Teller geben.`,
    `Optional frisch geriebenen Käse, Kräuter oder Olivenöl darüber; sofort heiß servieren.`,
  ];
}

function stepsSuppe(ctx) {
  const name = ctx.titel;
  return [
    `Großen Topf (4–5 l) und Schöpfkelle bereitstellen; Gemüse waschen, Enden entfernen, in gleichmäßige Würfel schneiden.`,
    `Topf auf Herdstufe 6 von 9 stellen, 2 EL Öl oder Butter erhitzen, Zwiebel und Knoblauch 4 Min glasig dünsten.`,
    `Hartes Gemüse (Karotten, Sellerie, Kartoffeln) 5–6 Min mit anschwitzen, gelegentlich rühren, nicht bräunen.`,
    `Brühe (ca. 1–1,2 l) angießen, mit einem Spritzer einmal aufkochen, dann Hitze auf Stufe 3–4 reduzieren.`,
    `${name}: 20–30 Min leicht köcheln, bis alles weich ist; mit dem Löffel prüfen — keine harten Stücke.`,
    `Optional mit Stabmixer pürieren: Mixer tief ins Flüssige tauchen, kurze Pulse, Spritzer vermeiden; oder grob lassen.`,
    `Mit Salz, Pfeffer, Muskat oder frischen Kräutern abschmecken; Konsistenz mit Wasser oder Sahne anpassen.`,
    `Bei Bedarf Einlage (Nudeln, Croutons, Sahnehaube) separat zubereiten und erst beim Servieren zugeben.`,
    `Suppe in vorgewärmte Schalen füllen, heiß servieren; Rest im Topf auf Stufe 2 warm halten.`,
  ];
}

function stepsEintopf(ctx) {
  return [
    `Schweren Bräter oder großen Topf (5 l) bereitstellen; Fleisch oder Hülsenfrüchte trocken tupfen, Gemüse würfeln.`,
    `Bräter auf Herdstufe 7 erhitzen, 2 EL Öl, Fleisch in Portionen scharf anbraten (nicht überfüllen), herausnehmen.`,
    `Zwiebeln und Wurzelgemüse im Bratensatz 5 Min anschwitzen, mit Tomatenmark 1 Min mitrösten.`,
    `Fleisch zurück, Flüssigkeit (Brühe, Bier, Wein) angießen, Lorbeer und Gewürze zugeben, aufkochen.`,
    `Hitze auf Stufe 2–3, Deckel leicht an, 60–90 Min köcheln — Fleisch soll mit der Gabel zerfallen.`,
    `Kartoffeln oder Kohl ggf. in der letzten halben Stunde zugeben, nicht zu früh (sonst matschig).`,
    `Eintopf abschmecken (Salz, Pfeffer, Essig), 10 Min ruhen lassen, damit sich Aromen setzen.`,
    `In tiefen Tellern servieren, mit frischem Brot; Rest am nächsten Tag schmeckt oft besser.`,
  ];
}

function stepsOfen(ctx) {
  const temp = ctx.ofenTemp ?? 180;
  const zeit = ctx.ofenZeit ?? '35–45';
  return [
    `Ofen auf ${temp} °C Umluft vorheizen (nur Ober-/Unterhitze: +20 °C), Backblech mit Backpapier auslegen.`,
    `Hauptzutat würzen, marinieren oder panieren wie im Rezept; Küchenthermometer bereitlegen bei Fleisch/Fisch.`,
    `Ofenfeste Form oder Blech fetten oder mit Papier belegen, Zutaten in einer Schicht anordnen (gleichmäßige Hitze).`,
    `In die mittlere Schiene schieben, ${zeit} Min backen/braten — nicht zu früh die Tür öffnen (Temperaturverlust).`,
    `Nach der Hälfte wenden oder begießen (Bratensoße, Marinade), Oberfläche soll goldbraun werden.`,
    `Gargrad prüfen: Fisch 58–62 °C Kerntemperatur, Geflügel 74 °C, Rind medium ca. 55 °C (nach Ruhezeit).`,
    `5–10 Min ruhen lassen unter Alufolie (locker), dann in Scheiben schneiden oder anrichten.`,
    `Mit Beilage und heißer Sauce servieren; Ofenhandschuhe verwenden.`,
  ];
}

function stepsPfanne(ctx) {
  return [
    `Pfanne (28 cm) und Spatel bereitstellen; Zutaten in gleicher Größe schneiden, damit gleichzeitig gar sind.`,
    `Pfanne 2 Min auf Herdstufe 7 von 9 leer vorwärmen, dann 2 EL Öl — es soll leicht schimmern.`,
    `Fleisch oder Tofu zuerst bei hoher Hitze anbraten, nicht bewegen bis sich eine Kruste löst (2–3 Min), wenden.`,
    `Gemüse zugeben, 4–6 Min mitbraten, Pfanne nicht überfüllen (sonst dämpft es).`,
    `Sauce (Soja, Sahne, Brühe) einrühren, 2–3 Min einkochen lassen, bis die Soße am Spatel haftet.`,
    `Mit Salz, Pfeffer, Kräutern abschmecken; Hitze reduzieren, 1 Min ziehen lassen.`,
    `Sofort auf vorgewärmten Tellern servieren — Pfannengerichte verlieren schnell an Textur.`,
  ];
}

function stepsBraten(ctx) {
  return [
    `Bratofen oder schweren Topf auf Stufe 7 vorheizen; Fleisch 30 Min vorher aus dem Kühlschrank nehmen, trocken tupfen.`,
    `Rundum mit Salz und Pfeffer einreiben, optional mit Mehl dünn bestäuben für Kruste.`,
    `2 EL Öl im Topf erhitzen, Fleisch von allen Seiten 2–3 Min scharf anbraten (Maillard-Reaktion).`,
    `Zwiebeln, Möhren, Brühe und Gewürze zugeben, Flüssigkeit soll 1/3 des Fleisches bedecken.`,
    `Deckel auf, Ofen 160 °C oder Herd Stufe 3–4: Garzeit laut Gewicht (ca. 40 Min pro kg Rind).`,
    `Thermometer in die dickste Stelle: gewünschter Kerntemperatur minus 3 °C (Nachgaren).`,
    `Fleisch herausnehmen, Bratensoße durch Sieb passieren, mit Mehl-Butter-Einlage binden.`,
    `Fleisch 10 Min unter Folie ruhen, dann tranchieren, mit Soße und Beilage servieren.`,
  ];
}

function stepsSalat(ctx) {
  return [
    `Salatschüssel und große Schüssel mit kaltem Wasser bereitstellen; Gemüse gründlich waschen und trocken schleudern.`,
    `Blattsalat in mundgerechte Stücke zupfen oder schneiden — Messer vermeidet braune Schnittkanten.`,
    `Festes Gemüse (Gurke, Paprika, Tomaten) in gleichmäßige Stücke schneiden, separat lagern.`,
    `Dressing in kleiner Schüssel: Öl, Essig, Senf, Salz, Pfeffer mit Schneebesen emulgieren.`,
    `Käse, Nüsse oder Croutons erst kurz vor dem Servieren zugeben (sonst weich).`,
    `Salat mit Dressing vermengen — nur so viel, dass Blätter glänzen, nicht schwimmen.`,
    `Sofort auf kühlen Tellern anrichten; bei Meal Prep Dressing separat mitgeben.`,
  ];
}

function stepsBacken(ctx) {
  const temp = ctx.ofenTemp ?? 175;
  return [
    `Ofen auf ${temp} °C vorheizen; Backform fetten oder mit Papier auslegen, Zutaten auf Raumtemperatur bringen.`,
    `Trockene Zutaten (Mehl, Backpulver, Kakao) in einer Schüssel sieben, verrühren.`,
    `Butter/Zucker oder Eier nach Rezept schaumig rühren (Handrührer Stufe 2–3, 3–5 Min).`,
    `Mehlmischung unterheben — nur bis kein Mehl mehr sichtbar (Überrühren macht trocken).`,
    `Teig in die Form füllen, Oberfläche glatt streichen, ggf. Kerne oder Streusel darauf.`,
    `Backzeit laut Rezept; Stäbchenprobe: Holzspieß kommt sauber heraus (außer Brownies: feuchte Krümel).`,
    `Form 10 Min auf dem Rost abkühlen, dann stürzen oder Stücke schneiden.`,
    `Vollständig abgekühlt lagern oder lauwarm mit Sahne servieren.`,
  ];
}

function stepsFisch(ctx) {
  return [
    `Fischfilet 20 Min vorher aus dem Kühlschrank, Hautseite trocken tupfen, Gräten mit Fingern prüfen.`,
    `Pfanne oder Ofen vorbereiten: Pfanne auf Stufe 6–7, 1 EL Öl; Ofen 200 °C Umluft falls Ofengang.`,
    `Fisch salzen und pfeffern, optional mit Zitrone beträufeln; bei Pfanne: Hautseite zuerst 3–4 Min ohne Wenden.`,
    `Wenden oder in den Ofen geben: Gesamtgarzeit oft nur 8–12 Min je nach Dicke (1 cm ≈ 3 Min).`,
    `Kerntemperatur 58–62 °C oder Flakes brechen sich leicht — nicht überziehen (trocken).`,
    `Beilage parallel fertigstellen; Fisch sofort mit Zitrone und Kräutern servieren.`,
  ];
}

function stepsCurry(ctx) {
  const titel = ctx.titel ?? 'Curry';
  const vegan = ctx.vegan === true;
  const main = vegan ? 'Tofu oder Kichererbsen' : ctx.vegetarisch ? 'Gemüse in gleich großen Stücken' : 'Fleisch oder Tofu';
  return [
    `Arbeitsfläche freiräumen: große Pfanne oder Wok, Topf für Reis, Schöpfkelle, Küchenuhr und scharfes Messer bereitstellen.`,
    `Reis parallel starten: 300 g Reis waschen, mit 450 ml Wasser salzen, aufkochen, Deckel, Stufe 1–2, 12–15 Min quellen lassen.`,
    `Zwiebel schälen und fein würfeln, Ingwer und Knoblauch fein hacken — alles in Schälchen legen (Mise en place).`,
    `Pfanne auf Herdstufe 6 von 9 stellen, 2 EL Öl erhitzen, Currypaste 1–2 Min anrösten, bis es duftet und leicht dunkler wird (nicht schwarz).`,
    `Zwiebel und Ingwer 3–4 Min glasig dünsten, dann ${main} zugeben und 4–5 Min anbraten oder mitgaren.`,
    `Kokosmilch und passierte Tomaten einrühren, einmal aufkochen, Hitze auf Stufe 3–4 reduzieren.`,
    `«${titel}» 15–20 Min leicht köcheln lassen, gelegentlich rühren, bis die Soße sämig ist und leichtes Öl an der Oberfläche perlt.`,
    `Mit Limettensaft, Salz, Pfeffer und optional 1 TL Zucker abschmecken (süß-sauer-salzig ausbalancieren).`,
    `Reis mit einer Gabel auflockern, Curry auf tiefe Teller geben, frischen Koriander darüber streuen.`,
    `Sofort heiß servieren; Reste 2 Tage kühl lagern und nur einmal vollständig durcherhitzen.`,
  ];
}

function stepsReis(ctx) {
  return [
    `Reis in einem Sieb 2–3 Mal kalt waschen, bis das Wasser klarer wird — entfernt überschüssige Stärke.`,
    `Topf mit Deckel: Reis und Wasser im Verhältnis 1:1,5 (Basmati) oder 1:2 (Risotto), salzen.`,
    `Aufkochen, dann Stufe 1–2, Deckel 12–18 Min (je nach Sorte), nicht rühren.`,
    `Topf vom Herd, 10 Min quellen lassen; mit Gabel auflockern.`,
    `Beilage oder unter Curry servieren.`,
  ];
}

function stepsWrap(ctx) {
  return [
    `Füllung vorbereiten: Protein/Gemüse würzen und in Pfanne oder Ofen garen, abkühlen lassen falls nötig.`,
    `Tortillas oder Fladen kurz in trockener Pfanne erwärmen (30 s pro Seite), geschmeidig machen.`,
    `Sauce (Joghurt, Tahini, Salsa) dünn auf die Mitte streichen, nicht bis zum Rand.`,
    `Füllung in der Mitte stapeln, Seiten einschlagen, fest rollen.`,
    `Optional in Pfanne 2 Min goldbraun anpressen; diagonal schneiden und servieren.`,
  ];
}

function stepsSonstig(ctx) {
  return [
    `Alle Zutaten laut Rezept abwiegen und bereitstellen; Arbeitsfläche und Utensilien griffbereit legen.`,
    `Schrittweise nach Rezept vorgehen: zuerst lange Garzeiten (Ofen, Topf), parallel kurze Arbeiten.`,
    `Temperaturen mit Thermometer oder Uhr kontrollieren, nicht nur nach Gefühl bei Fleisch und Backen.`,
    `Zwischenproben abschmecken, Würzung erst am Ende nicht vergessen.`,
    `Anrichten auf vorgewärmten Tellern, sofort servieren oder kühl stellen laut Haltbarkeit.`,
  ];
}

const BUILDERS = {
  pasta: stepsPasta,
  suppe: stepsSuppe,
  eintopf: stepsEintopf,
  ofen: stepsOfen,
  pfanne: stepsPfanne,
  braten: stepsBraten,
  salat: stepsSalat,
  backen: stepsBacken,
  fisch: stepsFisch,
  curry: stepsCurry,
  reis: stepsReis,
  wrap: stepsWrap,
  sonstig: stepsSonstig,
};

function expandSteps(recipe) {
  const fn = BUILDERS[recipe.methode] ?? stepsSonstig;
  const base = fn({
    titel: recipe.titel,
    portionen: recipe.portionen,
    zutatenNames: recipe.zutaten.map((x) => x.name).slice(0, 4).join(', '),
    vegetarisch: recipe.kategorie === 'Vegetarisch',
    vegan: recipe.kategorie === 'Vegan',
    ...recipe.ctx,
  });
  const merged = [...base];
  if (merged.length > 18) return merged.slice(0, 18);
  return merged;
}

function buildInsert(recipe) {
  const gericht = {
    titel: recipe.titel,
    portionen: recipe.portionen,
    kategorie: recipe.kategorie,
    geschaetzte_kcal_gesamt: recipe.kcal,
    zutaten: recipe.zutaten,
    kochschritte: expandSteps(recipe),
  };
  const titelEsc = escapeSql(recipe.titel);
  const json = jsonForSql(gericht);
  return `-- ${recipe.titel}
INSERT INTO public.lager_rezept_katalog (titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie)
SELECT
  '${titelEsc}',
  ${recipe.portionen},
  $g$${json}$g$::jsonb,
  ${recipe.kcal},
  NULL,
  '${escapeSql(recipe.kategorie)}'
WHERE NOT EXISTS (SELECT 1 FROM public.lager_rezept_katalog WHERE titel = '${titelEsc}');
`;
}

// ─── Katalog: 250 Titel (~28 pro Kategorie, 27 bei Dessert/Sonstiges) ───────

const CATALOG_BY_KAT = {
  Vegetarisch: [
    'Gemüsecurry mit Kokosmilch', 'Spinat-Linsen-Dal', 'Caprese-Salat', 'Auberginen-Parmigiana',
    'Ratatouille aus dem Ofen', 'Vegetarische Gemüselasagne', 'Margherita-Pizza', 'Shakshuka',
    'Falafel mit Tahini', 'Vegetarische Bolognese', 'Kürbissuppe mit Ingwer', 'Halloumi-Grillpfanne',
    'Vegetarische Paella', 'Spinat-Ricotta-Cannelloni', 'Möhren-Ingwer-Suppe', 'Zucchini-Frittata',
    'Bulgursalat mit Minze', 'Vegetarisches Chili sin Carne', 'Kartoffelgratin', 'Couscous mit Gemüse',
    'Erbsensuppe mit Minze', 'Gnocchi Tomate-Mozzarella', 'Blumenkohl-Steaks aus dem Ofen',
    'Brokkoli-Käse-Auflauf', 'Reibekuchen mit Apfelmus', 'Gebratener Blumenkohl', 'Käsesoufflé',
    'Tomaten-Feta-Pfanne',
  ],
  Vegan: [
    'Veganes Linsencurry', 'Vegane Bolognese', 'Tofu-Gemüse-Pfanne', 'Kichererbsen-Curry',
    'Vegane Zucchini-Lasagne', 'Süßkartoffel-Bowl', 'Veganer Kidney-Bohnen-Burger', 'Erdnuss-Nudeln',
    'Vegane Pasta Arrabbiata', 'Kokos-Linsensuppe', 'Gebackene Süßkartoffel', 'Quinoa-Salat',
    'Veganes Chili', 'Tofu-Scramble', 'Vegane Pfannkuchen', 'Hummus mit Fladenbrot',
    'Vegane Gemüsepaella', 'Rote-Bete-Salat', 'Vegane Schoko-Brownies', 'Avocado-Toast',
    'Vegane Minestrone', 'Tempeh-Gemüse-Pfanne', 'Vegane Kartoffelsuppe', 'Schwarze-Bohnen-Bowl',
    'Veganes Ratatouille', 'Erbsen-Hummus-Wrap', 'Vegane Haferflocken-Kekse', 'Kokos-Mango-Reis',
  ],
  Nudelgericht: [
    "Penne all'Arrabbiata", 'Tagliatelle mit Steinpilzen', 'Spaghetti Aglio e Olio',
    'Tortellini in Sahnesoße', 'Linguine mit Meeresfrüchten', 'Penne alla Vodka',
    'Fettuccine Alfredo', 'Spaghetti Bolognese', 'Pasta Pesto Genovese', 'Rigatoni al Forno',
    'Spaghetti Marinara', 'Mac and Cheese', 'Spaghetti mit Meatballs', 'Penne Brokkoli-Sahne',
    'Pasta alla Norma', 'Spaghetti Napoli', 'One-Pot Pasta Tomate-Mozzarella',
    'Penne Pesto und Cherrytomaten', 'Spaghetti Cacio e Pepe', 'Gnocchi in Butter-Salbei',
    'Pasta mit Artischocken', 'Mediterraner Nudelsalat', 'Spätzle mit Rosenkohl',
    'Ravioli in Brunnenkresse-Soße', 'Pasta mit Sardellen', 'Tortellini in Brühe',
    'Lasagne vegetarisch mit Spinat', 'Spaghetti mit Garnelen', 'Penne mit Ricotta und Zitrone',
  ],
  Fleischgericht: [
    'Schweinebraten mit Kruste', 'Hähnchenschenkel im Ofen', 'Rindersteak mit Pfeffersoße',
    'Putenbraten mit Orangen', 'Schweinefilet Medaillons', 'Hackbraten klassisch',
    'Geschnetzeltes Zürcher Art', 'Sauerbraten rheinisch', 'Schweinshaxe aus dem Ofen',
    'Hähnchen-Cordon-Bleu', 'Rindersteak mit Zwiebeln', 'Puten-Geschnetzeltes',
    'Schweinefilet in Champignonrahm', 'Köttbullar mit Preiselbeeren', 'Chili con Carne',
    'Gyros mit Tzatziki', 'Pulled Pork', 'Hähnchen Tikka Masala', 'Rinderburger selbst gemacht',
    'Schweinekoteletts paniert', 'Entenbrust mit Orangensoße', 'Lammkoteletts mit Rosmarin',
    'Hähnchenwings im Ofen', 'Rindfleisch-Stroganoff', 'Schweinerouladen',
    'Hackfleisch-Pfanne mexikanisch', 'Coq au Vin', 'Schweinebauch kross',
  ],
  Fischgericht: [
    'Forelle Müllerin Art', 'Kabeljau mit Senfsoße', 'Garnelen in Knoblauchöl',
    'Thunfischsteak kurz angebraten', 'Fischstäbchen selbst gemacht', 'Lachs in Dill-Senfsoße',
    'Zanderfilet auf Tomatenbett', 'Meeresfrüchte-Pfanne', 'Matjes mit Bratkartoffeln',
    'Fischcurry mit Kokosmilch', 'Sardinen-Pasta', 'Tintenfischringe gebraten',
    'Lachs-Tatar-Bowl', 'Fischsuppe bouillabaisse-artig', 'Seelachs im Backteig',
    'Garnele-Cocktail klassisch', 'Hering in Sahne', 'Fisch-Burger', 'Lachs-Bowl mit Reis',
    'Krabben-Pasta', 'Dorsch mit Remoulade', 'Fisch-Frikadellen', 'Lachs-Gravlax-Style',
    'Muscheln in Weißwein', 'Fisch auf mediterranem Gemüse', 'Thunfisch-Pasta',
    'Gebackener Scholle', 'Fisch-Spieße vom Grill',
  ],
  'Suppe / Eintopf': [
    'Kartoffelsuppe', 'Erbseneintopf', 'Linsensuppe', 'Gulaschsuppe',
    'Minestrone', 'Französische Zwiebelsuppe', 'Tom-Kha-Suppe', 'Pho Bo',
    'Bohneneintopf', 'Kohleintopf', 'Hühnersuppe mit Einlage', 'Brokkolicremesuppe',
    'Karotten-Ingwer-Suppe', 'Erbsen-Mint-Suppe', 'Tortellini-Suppe', 'Chili-Suppe',
    'Eintopf mit weißen Bohnen', 'Lauch-Kartoffel-Suppe', 'Rote-Linsen-Suppe',
    'Gulasch-Eintopf ungarisch', 'Fischsuppe nordisch', 'Kürbis-Kokos-Suppe',
    'Spargelcremesuppe', 'Ramen mit Ei', 'Eintopf Linsen und Wurzelgemüse',
    'Tomatensuppe mit Basilikum', 'Borschtsch', 'Erbsensuppe mit Speck',
  ],
  'Beilage / Salat': [
    'Kartoffelsalat norddeutsch', 'Coleslaw', 'Taboulé', 'Kartoffelstampf',
    'Bratkartoffeln', 'Ofenkartoffeln mit Quark', 'Reis mit Butter', 'Knödel halb und halb',
    'Rotkohl geschmort', 'Grüner Bohnensalat', 'Tomaten-Mozzarella-Salat', 'Wurzelsalat',
    'Gurkensalat dill', 'Kartoffelgratin klein', 'Spätzle einfach', 'Semmelknödel',
    'Pilzrisotto', 'Gemüse-Reis-Pfanne', 'Linsensalat', 'Kartoffelpüree',
    'Ofengemüse bunt', 'Quinoa-Beilage', 'Bulgur-Beilage', 'Kartoffel-Erbsen-Beilage',
    'Blumenkohl-Püree', 'Krautsalat', 'Feldsalat mit Speck', 'Kartoffel-Laibchen',
  ],
  'Dessert / Backen': [
    'Schokoladenkuchen', 'Käsekuchen ohne Boden', 'Apfelkuchen vom Blech',
    'Brownies', 'Vanillepudding', 'Crème brûlée', 'Tiramisu', 'Panna Cotta',
    'Zitronenkuchen', 'Marmorkuchen', 'Plätzchen Butter', 'Streuselkuchen',
    'Schwarzwälder Kirsch', 'Rote Grütze', 'Milchreis', 'Waffeln',
    'Pfannkuchen klassisch', 'Muffins Blaubeere', 'Bananenbrot', 'Linzer Augen',
    'Kaiserschmarrn', 'Topfenstrudel', 'Erdbeer-Torte', 'Schoko-Mousse',
    'Zimtschnecken', 'Donuts', 'Apfelchips im Ofen',
  ],
  Sonstiges: [
    'Rührei mit Speck', 'Omelett mit Kräutern', 'French Toast', 'Porridge',
    'Shakshuka vegan', 'Risotto mit Pilzen', 'Paella mit Meeresfrüchten',
    'Burrito Bowl', 'Quesadilla', 'Falafel-Teller', 'Döner zu Hause',
    'Sushi-Rolls einfach', 'Frühlingsrollen', 'Dim Sum gedämpft',
    'Pad Thai', 'Green Curry', 'Butter Chicken', 'Biryani',
    'Couscous-Tajine', 'Empanadas', 'Arepas', 'Ceviche',
    'Tacos vegetarisch', 'Ramen vegetarisch', 'Okonomiyaki', 'Kimchi-Fried-Rice',
    'Moussaka', 'Spanakopita',
  ],
};

/** Pro-Titel-Zutaten (5–10 Stück, realistisch) */
const ZUTATEN_DB = {
  "Penne all'Arrabbiata": [
    z('Penne', 400, 'g'), z('passierte Tomaten', 500, 'g'), z('Knoblauchzehen', 3, 'Stück'),
    z('Chiliflocken', 1, 'TL'), z('Olivenöl', 4, 'EL'), z('Petersilie', 15, 'g'),
    z('Parmesan', 40, 'g'),
  ],
  'Spaghetti Bolognese': [
    z('Spaghetti', 400, 'g'), z('Rinderhackfleisch', 500, 'g'), z('passierte Tomaten', 400, 'g'),
    z('Zwiebeln', 2, 'Stück'), z('Möhren', 150, 'g'), z('Sellerie', 80, 'g'),
    z('Rotwein', 100, 'ml'), z('Olivenöl', 2, 'EL'), z('Parmesan', 50, 'g'),
  ],
  'Schokoladenkuchen': [
    z('Weizenmehl', 200, 'g'), z('Zucker', 200, 'g'), z('Kakaopulver', 50, 'g'),
    z('Eier', 3, 'Stück'), z('Butter', 150, 'g'), z('Backpulver', 1, 'Päckchen'),
    z('Milch', 150, 'ml'), z('Vanillezucker', 1, 'Päckchen'),
  ],
  'Kartoffelsuppe': [
    z('Kartoffeln', 800, 'g'), z('Zwiebeln', 2, 'Stück'), z('Gemüsebrühe', 1000, 'ml'),
    z('Sahne', 150, 'ml'), z('Muskatnuss', 0.5, 'TL'), z('Lorbeerblatt', 1, 'Stück'),
    z('Butter', 30, 'g'), z('Schnittlauch', 20, 'g'),
  ],
};

function methodeFor(titel, kategorie) {
  const t = titel.toLowerCase();
  if (kategorie === 'Nudelgericht') return 'pasta';
  if (kategorie === 'Fischgericht') return t.includes('suppe') ? 'suppe' : 'fisch';
  if (kategorie === 'Dessert / Backen') return 'backen';
  if (kategorie === 'Suppe / Eintopf') {
    if (t.includes('eintopf') || t.includes('gulasch') || t.includes('bohnen') || t.includes('kohl'))
      return 'eintopf';
    return 'suppe';
  }
  if (kategorie === 'Beilage / Salat') {
    if (t.includes('salat') || t.includes('coleslaw') || t.includes('taboulé') || t.includes('kraut'))
      return 'salat';
    if (t.includes('risotto')) return 'reis';
    return 'sonstig';
  }
  if (kategorie === 'Fleischgericht') {
    if (t.includes('braten') || t.includes('haxe') || t.includes('steak') || t.includes('cordon'))
      return t.includes('pfanne') || t.includes('geschnetzel') ? 'pfanne' : 'braten';
    if (t.includes('burger') || t.includes('tacos') || t.includes('gyros')) return 'pfanne';
    return 'pfanne';
  }
  if (kategorie === 'Vegan') {
    if (t.includes('suppe') || t.includes('minestrone')) return 'suppe';
    if (t.includes('curry') || t.includes('chili')) return 'curry';
    if (t.includes('wrap')) return 'wrap';
    if (t.includes('brownies') || t.includes('kekse') || t.includes('pfannkuchen')) return 'backen';
    if (t.includes('salat') || t.includes('bowl')) return 'salat';
    if (t.includes('nudeln') || t.includes('pasta')) return 'pasta';
    return 'pfanne';
  }
  if (kategorie === 'Vegetarisch') {
    if (t.includes('suppe') || t.includes('dal')) return 'suppe';
    if (t.includes('pizza') || t.includes('lasagne') || t.includes('auflauf') || t.includes('parmigiana') || t.includes('ratatouille'))
      return 'ofen';
    if (t.includes('salat') || t.includes('caprese')) return 'salat';
    if (t.includes('curry') || t.includes('paella') || t.includes('chili')) return 'curry';
    if (t.includes('gnocchi')) return 'pasta';
    return 'pfanne';
  }
  if (kategorie === 'Sonstiges') {
    if (t.includes('risotto') || t.includes('biryani') || t.includes('paella')) return 'reis';
    if (t.includes('curry') || t.includes('pad thai')) return 'curry';
    if (t.includes('ramen') || t.includes('sushi') || t.includes('dim sum')) return 'suppe';
    if (t.includes('frühlingsrollen') || t.includes('empanadas')) return 'ofen';
    return 'sonstig';
  }
  return 'sonstig';
}

function zutatenFor(titel, kategorie) {
  if (ZUTATEN_DB[titel]) return ZUTATEN_DB[titel];
  const t = titel.toLowerCase();
  if (kategorie === 'Nudelgericht') {
    const pasta = titel.includes('Penne') ? 'Penne' : titel.includes('Spaghetti') ? 'Spaghetti' : titel.includes('Tagliatelle') ? 'Tagliatelle' : titel.includes('Tortellini') ? 'Tortellini' : titel.includes('Gnocchi') ? 'Gnocchi' : titel.includes('Rigatoni') ? 'Rigatoni' : titel.includes('Linguine') ? 'Linguine' : titel.includes('Fettuccine') ? 'Fettuccine' : titel.includes('Ravioli') ? 'Ravioli' : 'Pasta';
    const list = [
      z(pasta, 400, 'g'), z('Zwiebeln', 1, 'Stück'), z('Knoblauchzehen', 2, 'Stück'),
      z('Olivenöl', 3, 'EL'), z('Parmesan', 50, 'g'),
    ];
    if (t.includes('pesto')) list.push(z('Basilikum-Pesto', 120, 'g'), z('Pinienkerne', 30, 'g'));
    else if (t.includes('alfredo') || t.includes('sahne')) list.push(z('Sahne', 200, 'ml'), z('Butter', 40, 'g'));
    else if (t.includes('meeresfrüchte') || t.includes('garnelen')) list.push(z('Meeresfrüchte-Mix', 400, 'g'), z('Weißwein', 100, 'ml'));
    else list.push(z('passierte Tomaten', 400, 'g'), z('Basilikum', 10, 'g'));
    if (t.includes('meatballs') || t.includes('bolognese')) list.push(z('Rinderhackfleisch', 400, 'g'));
    return list.slice(0, 10);
  }
  if (kategorie === 'Fischgericht') {
    let fName = 'Fischfilet';
    let fMenge = 600;
    let fEinheit = 'g';
    if (t.includes('forelle')) {
      fName = 'Forelle';
      fMenge = 2;
      fEinheit = 'Stück';
    } else if (t.includes('lachs')) fName = 'Lachsfilet';
    else if (t.includes('kabeljau') || t.includes('dorsch')) fName = 'Kabeljaufilet';
    else if (t.includes('zander')) fName = 'Zanderfilet';
    else if (t.includes('thunfisch')) fName = 'Thunfischsteak';
  else if (t.includes('garnelen') || t.includes('krabben')) {
      fName = 'Garnelen';
      fMenge = 400;
    }
    return [
      z(fName, fMenge, fEinheit), z('Zitrone', 1, 'Stück'), z('Butter', 40, 'g'),
      z('Knoblauchzehen', 2, 'Stück'), z('Dill', 15, 'g'), z('Olivenöl', 2, 'EL'),
      z('Sahne', 100, 'ml'), z('Kapern', 1, 'EL'),
    ];
  }
  if (kategorie === 'Fleischgericht') {
    const fleisch = t.includes('hähnchen') || t.includes('huhn') ? 'Hähnchen' : t.includes('rind') ? 'Rindfleisch' : t.includes('schwein') ? 'Schweinefleisch' : t.includes('pute') ? 'Putenfleisch' : t.includes('lamm') ? 'Lamm' : t.includes('ente') ? 'Entenbrust' : 'Fleisch';
    return [
      z(fleisch, 800, 'g'), z('Zwiebeln', 2, 'Stück'), z('Knoblauchzehen', 2, 'Stück'),
      z('Gemüsebrühe', 400, 'ml'), z('Tomatenmark', 1, 'EL'), z('Butter', 40, 'g'),
      z('Rosmarin', 2, 'Zweige'), z('Pfeffer', 1, 'Prise'),
    ];
  }
  if (kategorie === 'Suppe / Eintopf') {
    const list = [
      z('Gemüsebrühe', 1200, 'ml'), z('Zwiebeln', 1, 'Stück'), z('Möhren', 200, 'g'),
      z('Sellerie', 100, 'g'), z('Lorbeerblatt', 1, 'Stück'),
    ];
    if (t.includes('kartoffel')) list.push(z('Kartoffeln', 500, 'g'));
    if (t.includes('linse') || t.includes('erbsen')) list.push(z('Rote Linsen oder Erbsen', 250, 'g'));
    if (t.includes('huhn')) list.push(z('Hähnchenbrust', 300, 'g'));
    if (t.includes('gulasch')) list.push(z('Rindfleisch', 500, 'g'), z('Paprikapulver edelsüß', 2, 'TL'));
    list.push(z('Sahne optional', 100, 'ml'), z('Olivenöl', 2, 'EL'));
    return list.slice(0, 10);
  }
  if (kategorie === 'Beilage / Salat') {
    if (t.includes('kartoffel')) {
      return [
        z('Kartoffeln', 1000, 'g'), z('Zwiebeln', 1, 'Stück'), z('Essig', 3, 'EL'),
        z('Senf', 1, 'TL'), z('Öl', 4, 'EL'), z('Gurken', 150, 'g'),
        z('Schnittlauch', 20, 'g'),
      ];
    }
    if (t.includes('reis') || t.includes('risotto')) {
      return [
        z('Reis oder Risottoreis', 300, 'g'), z('Butter', 30, 'g'), z('Gemüsebrühe', 800, 'ml'),
        z('Zwiebeln', 1, 'Stück'), z('Parmesan', 50, 'g'), z('Weißwein', 100, 'ml'),
        z('Pilze', 200, 'g'),
      ];
    }
    return [
      z('Salat oder Gemüse', 400, 'g'), z('Olivenöl', 3, 'EL'), z('Essig', 2, 'EL'),
      z('Senf', 1, 'TL'), z('Zwiebeln', 0.5, 'Stück'), z('Kräuter', 15, 'g'),
    ];
  }
  if (kategorie === 'Dessert / Backen') {
    return [
      z('Weizenmehl', 250, 'g'), z('Zucker', 150, 'g'), z('Eier', 3, 'Stück'),
      z('Butter', 150, 'g'), z('Backpulver', 1, 'Päckchen'), z('Vanillezucker', 1, 'Päckchen'),
      z('Milch', 200, 'ml'),
    ];
  }
  if (kategorie === 'Vegan') {
    return [
      z('Tofu oder Kichererbsen', 400, 'g'), z('Kokosmilch', 400, 'ml'), z('Zwiebeln', 1, 'Stück'),
      z('Currypaste', 2, 'EL'), z('Limettensaft', 2, 'EL'), z('Reis oder Nudeln', 300, 'g'),
      z('Gemüse der Saison', 400, 'g'), z('Sojasauce', 2, 'EL'),
    ];
  }
  if (kategorie === 'Vegetarisch') {
    if (t.includes('curry')) {
      return [
        z('Kokosmilch', 400, 'ml'), z('rote Currypaste', 2, 'EL'), z('Gemüsemix (Paprika, Zucchini)', 500, 'g'),
        z('Zwiebeln', 1, 'Stück'), z('Ingwer', 20, 'g'), z('Reis (Beilage)', 300, 'g'),
        z('Limettensaft', 2, 'EL'), z('Koriander frisch', 10, 'g'),
      ];
    }
    if (t.includes('dal') || t.includes('linsen')) {
      return [
        z('rote Linsen', 250, 'g'), z('Spinat', 300, 'g'), z('Kokosmilch', 200, 'ml'),
        z('Zwiebeln', 1, 'Stück'), z('Knoblauchzehen', 2, 'Stück'), z('Currypulver', 2, 'TL'),
        z('Tomatenmark', 1, 'EL'), z('Gemüsebrühe', 600, 'ml'),
      ];
    }
    if (t.includes('pizza')) {
      return [
        z('Pizzateig', 1, 'Stück'), z('passierte Tomaten', 200, 'g'), z('Mozzarella', 250, 'g'),
        z('Basilikum', 15, 'g'), z('Olivenöl', 2, 'EL'), z('Oregano getrocknet', 1, 'TL'),
        z('Knoblauchzehen', 1, 'Stück'),
      ];
    }
  }
  return [
    z('Hauptzutat', 500, 'g'), z('Zwiebeln', 1, 'Stück'), z('Knoblauchzehen', 2, 'Stück'),
    z('Tomaten', 300, 'g'), z('Gemüsebrühe', 500, 'ml'), z('Olivenöl', 2, 'EL'),
    z('Kräuter frisch', 15, 'g'),
  ];
}

function kcalFor(kategorie, titel) {
  const base = {
    'Dessert / Backen': 2200,
    Fleischgericht: 2400,
    Fischgericht: 1800,
    Nudelgericht: 2000,
    'Suppe / Eintopf': 1400,
    'Beilage / Salat': 900,
    Vegan: 1600,
    Vegetarisch: 1700,
    Sonstiges: 1500,
  };
  let k = base[kategorie] ?? 1600;
  const h = [...titel].reduce((a, c) => a + c.charCodeAt(0), 0);
  k += (h % 400) - 200;
  return Math.max(800, Math.min(3200, k));
}

function ctxFor(titel, kategorie, methode) {
  const ctx = {};
  if (methode === 'pasta') {
    ctx.pasta = titel.split(' ')[0].includes('Spaghetti') ? 'Spaghetti' : titel.includes('Penne') ? 'Penne' : 'Nudeln';
    ctx.sauce = 'Soße passend zum Gericht';
  }
  if (methode === 'ofen') {
    ctx.ofenTemp = 180;
    ctx.ofenZeit = '35–45';
  }
  if (methode === 'backen') ctx.ofenTemp = 175;
  return ctx;
}

const TARGET_PER_KAT = {
  Vegetarisch: 28,
  Vegan: 28,
  Nudelgericht: 28,
  Fleischgericht: 28,
  Fischgericht: 28,
  'Suppe / Eintopf': 28,
  'Beilage / Salat': 28,
  'Dessert / Backen': 27,
  Sonstiges: 27,
};

function buildRecipes() {
  const recipes = [];
  for (const kategorie of KATS) {
    const titles = CATALOG_BY_KAT[kategorie].slice(0, TARGET_PER_KAT[kategorie]);
    if (!titles.length) throw new Error(`Fehlende Kategorie: ${kategorie}`);
    for (const titel of titles) {
      if (SKIP.has(titel)) continue;
      const methode = methodeFor(titel, kategorie);
      const portionen =
        kategorie === 'Dessert / Backen' ? 8 : titel.toLowerCase().includes('burger') ? 4 : 4;
      recipes.push({
        titel,
        portionen,
        kategorie,
        kcal: kcalFor(kategorie, titel),
        methode,
        zutaten: zutatenFor(titel, kategorie),
        ctx: ctxFor(titel, kategorie, methode),
      });
    }
  }
  return recipes;
}

function main() {
  const recipes = buildRecipes().filter((r) => !SKIP.has(r.titel));
  const titles = new Set(recipes.map((r) => r.titel));
  if (titles.size !== recipes.length) {
    console.error('Doppelte Titel im Katalog!');
    process.exit(1);
  }
  if (recipes.length !== 250) {
    console.error(`Erwartet 250 Rezepte, erhalten: ${recipes.length}`);
    process.exit(1);
  }

  const header = `-- 250 neue Standard-Rezepte (Stammsammlung Erweiterung).
-- Generiert von scripts/generate-rezept-stammsammlung-250.mjs
-- Idempotent: gleicher Titel wird nicht doppelt eingefügt.

`;

  const body = recipes.map(buildInsert).join('\n');
  writeFileSync(OUT, header + body, 'utf8');

  const insertCount = (header + body).split('INSERT INTO').length - 1;
  const lines = (header + body).split('\n').length;
  console.log(`Migration geschrieben: ${OUT}`);
  console.log(`INSERT-Statements: ${insertCount}`);
  console.log(`Zeilen: ${lines}`);
  if (insertCount !== 250) {
    console.error('INSERT-Anzahl stimmt nicht!');
    process.exit(1);
  }
}

main();
