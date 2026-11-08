-- VidIQ-Cache und View-Stände. Nur die Server-Rolle schreibt.

CREATE TABLE IF NOT EXISTS public.youtube_vidiq_cache (
  owner_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  cache_key text NOT NULL,
  payload jsonb NOT NULL,
  expires_at timestamptz NOT NULL,
  PRIMARY KEY (owner_user_id, cache_key)
);

CREATE TABLE IF NOT EXISTS public.youtube_vidiq_snapshot (
  owner_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  video_id text NOT NULL,
  captured_at timestamptz NOT NULL DEFAULT now(),
  view_count bigint NOT NULL,
  like_count bigint NOT NULL,
  PRIMARY KEY (owner_user_id, video_id, captured_at)
);

CREATE INDEX IF NOT EXISTS idx_youtube_vidiq_snapshot_video
  ON public.youtube_vidiq_snapshot (owner_user_id, video_id, captured_at DESC);

ALTER TABLE public.youtube_vidiq_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.youtube_vidiq_cache FORCE ROW LEVEL SECURITY;
ALTER TABLE public.youtube_vidiq_snapshot ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.youtube_vidiq_snapshot FORCE ROW LEVEL SECURITY;

REVOKE ALL ON public.youtube_vidiq_cache FROM anon, authenticated, PUBLIC;
REVOKE ALL ON public.youtube_vidiq_snapshot FROM anon, authenticated, PUBLIC;
