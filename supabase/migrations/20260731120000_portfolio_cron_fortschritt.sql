-- Fortschritt für lange Cron-Jobs (z. B. Quartals-Auto-KI), damit nach
-- Token-/Quota-Erschöpfung am nächsten Tag exakt weitergemacht wird.

CREATE TABLE IF NOT EXISTS public.portfolio_cron_fortschritt (
  job_id text PRIMARY KEY,
  resume_offset integer NOT NULL DEFAULT 0,
  resume_phase text NOT NULL DEFAULT 'earnings',
  pause_grund text,
  kandidaten_gesamt integer,
  aktualisiert_am timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT portfolio_cron_fortschritt_phase_chk
    CHECK (resume_phase IN ('earnings', 'sec'))
);

COMMENT ON TABLE public.portfolio_cron_fortschritt IS
  'Persistierter Cursor für Portfolio-Cronjobs (Service Role only).';

ALTER TABLE public.portfolio_cron_fortschritt ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolio_cron_fortschritt FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.portfolio_cron_fortschritt FROM anon, PUBLIC, authenticated;

NOTIFY pgrst, 'reload schema';
