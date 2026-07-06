-- Nachkauf-Radar: Verkaufsempfehlungen in Kaufempfehlung speichern
ALTER TABLE public.nachkauf_kaufempfehlung
  ADD COLUMN IF NOT EXISTS verkauf_allokation jsonb;
