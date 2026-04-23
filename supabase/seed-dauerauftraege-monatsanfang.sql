-- Einmalig in Supabase SQL Editor ausführen (optional).
-- Alle Abbuchungen am 1. des Monats (tag_des_monats = 1), typ = Ausgabe.

INSERT INTO dauerauftraege (typ, kategorie, betrag, tag_des_monats)
VALUES
  ('ausgabe', 'Aktien', 1200, 1),
  ('ausgabe', 'Schwäbisch Hall Bausparer', 200, 1),
  ('ausgabe', 'Maximilian Eichlseder', 7, 1),
  ('ausgabe', 'Allianz Lebensversicherung', 57.56, 1),
  ('ausgabe', 'UniProfiRente Select Fond', 50, 1),
  ('ausgabe', 'O2 Handyvertrag', 8.49, 1),
  ('ausgabe', 'UniGlobal Fond', 125, 1),
  ('ausgabe', 'Gemini', 7.99, 1),
  ('ausgabe', 'Strava', 6.25, 1),
  ('ausgabe', 'Whoop', 22, 1),
  ('ausgabe', 'Netflix', 4.99, 1),
  ('ausgabe', 'Discovery+', 3.99, 1);
