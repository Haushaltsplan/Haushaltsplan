-- Manuelle Kategorie-Korrektur: optionale Spalte `kategorie_key` an Einnahmen/Ausgaben.
-- Ist sie gesetzt, hat sie Vorrang vor der automatischen Kategorisierung (lib/finanz-kategorisierung.ts).
-- NULL = automatische Zuordnung (Standard).

ALTER TABLE public.einnahmen ADD COLUMN IF NOT EXISTS kategorie_key text;
ALTER TABLE public.ausgaben  ADD COLUMN IF NOT EXISTS kategorie_key text;
