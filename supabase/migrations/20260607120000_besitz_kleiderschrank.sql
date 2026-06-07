-- Besitz: Kleidungsart, Größe, Farbe, Foto + privater Storage-Bucket

ALTER TABLE public.besitz_gegenstand
  ADD COLUMN IF NOT EXISTS kleidungsart text,
  ADD COLUMN IF NOT EXISTS groesse text,
  ADD COLUMN IF NOT EXISTS farbe text,
  ADD COLUMN IF NOT EXISTS bild_pfad text;

CREATE INDEX IF NOT EXISTS idx_besitz_gegenstand_kleidungsart
  ON public.besitz_gegenstand (kleidungsart)
  WHERE kleidungsart IS NOT NULL;

COMMENT ON COLUMN public.besitz_gegenstand.kleidungsart IS 'Feinere Art (T-Shirt, Jeans, Sneaker …) für Kleiderschrank-Ansicht.';
COMMENT ON COLUMN public.besitz_gegenstand.bild_pfad IS 'Pfad in Storage-Bucket besitz-fotos (Ordner = owner user id).';

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'besitz-fotos',
  'besitz-fotos',
  false,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS besitz_fotos_select_own ON storage.objects;
CREATE POLICY besitz_fotos_select_own ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'besitz-fotos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS besitz_fotos_insert_own ON storage.objects;
CREATE POLICY besitz_fotos_insert_own ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'besitz-fotos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS besitz_fotos_update_own ON storage.objects;
CREATE POLICY besitz_fotos_update_own ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'besitz-fotos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'besitz-fotos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS besitz_fotos_delete_own ON storage.objects;
CREATE POLICY besitz_fotos_delete_own ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'besitz-fotos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
