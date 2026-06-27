-- Nachkauf-Radar: Tabelle für KI-gestützte Kaufempfehlungen
CREATE TABLE IF NOT EXISTS public.nachkauf_kaufempfehlung (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL DEFAULT auth.uid(),
  monat         text NOT NULL,               -- 'YYYY-MM'
  kandidaten    jsonb,                        -- Liste der betrachteten Ticker
  basis_allokation jsonb,                    -- regelbasierte Allokation
  ki_text       text,                         -- vollständige KI-Empfehlung
  erstellt_am   timestamptz NOT NULL DEFAULT now()
);

-- Nur neuesten Eintrag pro Monat behalten (Upsert-Key)
CREATE UNIQUE INDEX IF NOT EXISTS nachkauf_kaufempfehlung_owner_monat
  ON public.nachkauf_kaufempfehlung (owner_user_id, monat);

-- RLS
ALTER TABLE public.nachkauf_kaufempfehlung ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Nur eigene Kaufempfehlungen"
  ON public.nachkauf_kaufempfehlung
  FOR ALL
  USING (owner_user_id = auth.uid())
  WITH CHECK (owner_user_id = auth.uid());
