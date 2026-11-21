-- VidIQ ist entfernt. Long-Form-Aktienanalysen: Projektzustand + Assets. Nur die Server-Rolle schreibt.

DROP TABLE IF EXISTS public.youtube_vidiq_snapshot;
DROP TABLE IF EXISTS public.youtube_vidiq_cache;

CREATE TABLE IF NOT EXISTS public.youtube_longform_projekt (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  ticker text NOT NULL,
  firmenname text NOT NULL,
  titel text,
  zustand jsonb NOT NULL,
  -- Abwechslung über Videos hinweg: was dieses Video schon benutzt hat.
  hook_typ text,
  leitfrage text,
  varianten jsonb NOT NULL DEFAULT '{}'::jsonb,
  kernphrasen text[] NOT NULL DEFAULT '{}',
  erstellt_am timestamptz NOT NULL DEFAULT now(),
  aktualisiert_am timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_youtube_longform_projekt_owner
  ON public.youtube_longform_projekt (owner_user_id, aktualisiert_am DESC);

ALTER TABLE public.youtube_longform_projekt ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.youtube_longform_projekt FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.youtube_longform_projekt FROM anon, authenticated, PUBLIC;

INSERT INTO storage.buckets (id, name, public)
VALUES ('youtube-longform', 'youtube-longform', false)
ON CONFLICT (id) DO NOTHING;
