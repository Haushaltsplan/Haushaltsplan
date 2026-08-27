-- Ab welchem Kalendertag Einnahmen/Ausgaben das Girokonto automatisch verändern.
-- Der gespeicherte `betrag` bleibt der manuell gesetzte Startstand.

ALTER TABLE public.finanz_vermoegen
  ADD COLUMN IF NOT EXISTS cashflow_ab_datum date;
