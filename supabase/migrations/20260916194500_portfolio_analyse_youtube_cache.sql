-- YouTube-Leiste: Kanalvideos cachen (letztes Jahr aktuell halten, ältere behalten).
-- Zugriff nur über Service Role — nicht über den Browser-Anon-Key.

CREATE TABLE IF NOT EXISTS public.fundamental_youtube_videos (
  video_id        text PRIMARY KEY,
  channel_id      text NOT NULL,
  creator         text NOT NULL,
  titel           text NOT NULL,
  beschreibung    text NOT NULL DEFAULT '',
  published_at    timestamptz,
  thumbnail_url   text NOT NULL,
  aktualisiert_am timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS fundamental_youtube_videos_channel_published
  ON public.fundamental_youtube_videos (channel_id, published_at DESC);

CREATE TABLE IF NOT EXISTS public.fundamental_youtube_kanal_sync (
  channel_id             text PRIMARY KEY,
  creator                text NOT NULL,
  letzter_jahr_sync_am   timestamptz,
  backfill_fertig        boolean NOT NULL DEFAULT false,
  backfill_continuation  text,
  aktualisiert_am        timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.fundamental_youtube_videos IS
  'Whitelist-YouTube-Videos für die Fundamentaldaten-Leiste. Letztes Jahr wird regelmäßig nachgeladen; ältere Zeilen bleiben.';

ALTER TABLE public.fundamental_youtube_videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fundamental_youtube_videos FORCE ROW LEVEL SECURITY;
ALTER TABLE public.fundamental_youtube_kanal_sync ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fundamental_youtube_kanal_sync FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.fundamental_youtube_videos FROM anon, PUBLIC, authenticated;
REVOKE ALL ON TABLE public.fundamental_youtube_kanal_sync FROM anon, PUBLIC, authenticated;

NOTIFY pgrst, 'reload schema';
