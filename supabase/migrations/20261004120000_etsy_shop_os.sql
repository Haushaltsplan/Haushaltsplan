-- Etsy Shop-OS: Geld, Betrieb, Conversion, Saison, CRM, Strategie (Phasen A–G).

-- ---------------------------------------------------------------------------
-- Shop-Einstellungen (Zielmarge, Kapazität, Star-Seller-Check)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.etsy_shop_einstellungen (
  owner_user_id uuid PRIMARY KEY DEFAULT auth.uid() REFERENCES auth.users (id) ON DELETE CASCADE,
  ziel_marge_pct numeric(5, 2) NOT NULL DEFAULT 55,
  etsy_gebuehr_pct numeric(5, 2) NOT NULL DEFAULT 6.5,
  payment_gebuehr_pct numeric(5, 2) NOT NULL DEFAULT 4.0,
  payment_gebuehr_fix numeric(6, 2) NOT NULL DEFAULT 0.25,
  kapazitaet_pro_woche integer NOT NULL DEFAULT 4,
  star_seller jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Phase A: Stückkosten (pro Listing oder Holzart-Vorlage)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.etsy_kosten_vorlage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users (id) ON DELETE CASCADE,
  name text NOT NULL,
  holzart text,
  holz_eur numeric(10, 2) NOT NULL DEFAULT 0,
  oel_eur numeric(10, 2) NOT NULL DEFAULT 0,
  schleif_eur numeric(10, 2) NOT NULL DEFAULT 0,
  werkzeug_eur numeric(10, 2) NOT NULL DEFAULT 0,
  strom_eur numeric(10, 2) NOT NULL DEFAULT 0,
  verpackung_eur numeric(10, 2) NOT NULL DEFAULT 0,
  sonstiges_eur numeric(10, 2) NOT NULL DEFAULT 0,
  arbeitsstunden numeric(6, 2) NOT NULL DEFAULT 0,
  stundensatz_eur numeric(8, 2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_user_id, name)
);

CREATE TABLE IF NOT EXISTS public.etsy_produkt_kosten (
  owner_user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users (id) ON DELETE CASCADE,
  listing_id bigint NOT NULL,
  listing_title text NOT NULL DEFAULT '',
  holzart text,
  holz_eur numeric(10, 2) NOT NULL DEFAULT 0,
  oel_eur numeric(10, 2) NOT NULL DEFAULT 0,
  schleif_eur numeric(10, 2) NOT NULL DEFAULT 0,
  werkzeug_eur numeric(10, 2) NOT NULL DEFAULT 0,
  strom_eur numeric(10, 2) NOT NULL DEFAULT 0,
  verpackung_eur numeric(10, 2) NOT NULL DEFAULT 0,
  sonstiges_eur numeric(10, 2) NOT NULL DEFAULT 0,
  arbeitsstunden numeric(6, 2) NOT NULL DEFAULT 0,
  stundensatz_eur numeric(8, 2) NOT NULL DEFAULT 0,
  versand_anteil_eur numeric(10, 2) NOT NULL DEFAULT 0,
  notiz text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_user_id, listing_id)
);

-- ---------------------------------------------------------------------------
-- Phase B: Bestell-Pipeline + Versandvorlagen + Rohholz
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.etsy_bestellung (
  owner_user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users (id) ON DELETE CASCADE,
  receipt_id bigint NOT NULL,
  listing_id bigint,
  listing_title text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'neu'
    CHECK (status IN ('neu', 'fertigung', 'verpacken', 'versendet', 'erledigt', 'problem')),
  kaeufer_name text NOT NULL DEFAULT '',
  land_iso text,
  stadt text,
  plz text,
  adresse text,
  betrag_eur numeric(10, 2),
  menge integer NOT NULL DEFAULT 1,
  is_shipped boolean NOT NULL DEFAULT false,
  gewicht_g integer,
  masse_text text,
  zoll_hinweis text NOT NULL DEFAULT '',
  notiz text NOT NULL DEFAULT '',
  gekauft_at timestamptz,
  status_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_user_id, receipt_id)
);

CREATE INDEX IF NOT EXISTS etsy_bestellung_status_idx
  ON public.etsy_bestellung (owner_user_id, status, gekauft_at DESC);

CREATE TABLE IF NOT EXISTS public.etsy_versand_vorlage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users (id) ON DELETE CASCADE,
  schluessel text NOT NULL CHECK (char_length(schluessel) BETWEEN 2 AND 40),
  titel text NOT NULL,
  text text NOT NULL,
  UNIQUE (owner_user_id, schluessel)
);

CREATE TABLE IF NOT EXISTS public.etsy_rohholz (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users (id) ON DELETE CASCADE,
  holzart text NOT NULL,
  beschreibung text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'gekauft'
    CHECK (status IN ('gekauft', 'trocknung', 'bereit', 'verarbeitet', 'verworfen')),
  kosten_eur numeric(10, 2),
  gekauft_at date,
  bereit_at date,
  listing_id bigint,
  notiz text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS etsy_rohholz_status_idx
  ON public.etsy_rohholz (owner_user_id, status);

-- ---------------------------------------------------------------------------
-- Phase C: A/B + Reviews
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.etsy_ab_test (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users (id) ON DELETE CASCADE,
  listing_id bigint NOT NULL,
  listing_title text NOT NULL DEFAULT '',
  variante text NOT NULL CHECK (variante IN ('A', 'B')),
  aktiv boolean NOT NULL DEFAULT true,
  titel text,
  tags text[],
  gestartet_at timestamptz NOT NULL DEFAULT now(),
  beendet_at timestamptz,
  views_start integer,
  favs_start integer,
  verkaufe_start integer NOT NULL DEFAULT 0,
  notiz text NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS etsy_ab_test_listing_idx
  ON public.etsy_ab_test (owner_user_id, listing_id, aktiv);

CREATE TABLE IF NOT EXISTS public.etsy_review_notiz (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users (id) ON DELETE CASCADE,
  receipt_id bigint,
  listing_id bigint,
  kaeufer_name text NOT NULL DEFAULT '',
  sterne integer CHECK (sterne IS NULL OR (sterne BETWEEN 1 AND 5)),
  zitat text NOT NULL DEFAULT '',
  angefragt_at timestamptz,
  erhalten_at timestamptz,
  fuer_listing_nutzen boolean NOT NULL DEFAULT false,
  notiz text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Phase D: Saison + Content
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.etsy_saison_kampagne (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users (id) ON DELETE CASCADE,
  saison_id text NOT NULL,
  listing_id bigint NOT NULL,
  listing_title text NOT NULL DEFAULT '',
  tag_geplant boolean NOT NULL DEFAULT true,
  gift_foto boolean NOT NULL DEFAULT false,
  preis_ok boolean NOT NULL DEFAULT true,
  erledigt boolean NOT NULL DEFAULT false,
  notiz text NOT NULL DEFAULT '',
  UNIQUE (owner_user_id, saison_id, listing_id)
);

CREATE TABLE IF NOT EXISTS public.etsy_content_idee (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users (id) ON DELETE CASCADE,
  listing_id bigint,
  listing_title text NOT NULL DEFAULT '',
  kanal text NOT NULL DEFAULT 'reel' CHECK (kanal IN ('reel', 'post', 'story', 'blog')),
  idee text NOT NULL,
  geplant_fuer date,
  erledigt boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Phase F: CRM + Gravur + Inbox-Notizen
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.etsy_kaeufer (
  owner_user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users (id) ON DELETE CASCADE,
  kaeufer_key text NOT NULL,
  name text NOT NULL DEFAULT '',
  land_iso text,
  kaeufe integer NOT NULL DEFAULT 0,
  umsatz_eur numeric(12, 2) NOT NULL DEFAULT 0,
  letzte_kauf_at timestamptz,
  holz_vorlieben text[] NOT NULL DEFAULT '{}',
  anlaesse text[] NOT NULL DEFAULT '{}',
  notiz text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_user_id, kaeufer_key)
);

CREATE TABLE IF NOT EXISTS public.etsy_crm_aufgabe (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users (id) ON DELETE CASCADE,
  kaeufer_key text NOT NULL,
  kaeufer_name text NOT NULL DEFAULT '',
  art text NOT NULL CHECK (art IN ('pflege_30d', 'geschenk_11m', 'review', 'manuell')),
  faellig_am date NOT NULL,
  erledigt boolean NOT NULL DEFAULT false,
  text text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS etsy_crm_aufgabe_offen_idx
  ON public.etsy_crm_aufgabe (owner_user_id, erledigt, faellig_am);

CREATE TABLE IF NOT EXISTS public.etsy_gravur_anfrage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users (id) ON DELETE CASCADE,
  receipt_id bigint,
  listing_id bigint,
  kaeufer_name text NOT NULL DEFAULT '',
  text_wunsch text NOT NULL DEFAULT '',
  aufschlag_eur numeric(10, 2) NOT NULL DEFAULT 15,
  status text NOT NULL DEFAULT 'offen'
    CHECK (status IN ('offen', 'skizze', 'fertig', 'abgelehnt')),
  notiz text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.etsy_nachricht_notiz (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users (id) ON DELETE CASCADE,
  prioritaet text NOT NULL DEFAULT 'mittel'
    CHECK (prioritaet IN ('kaufabsicht', 'hoch', 'mittel', 'niedrig')),
  betreff text NOT NULL DEFAULT '',
  kaeufer_name text NOT NULL DEFAULT '',
  erledigt boolean NOT NULL DEFAULT false,
  notiz text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Phase G: CEO-Briefing
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.etsy_ceo_briefing (
  owner_user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users (id) ON DELETE CASCADE,
  woche text NOT NULL,
  inhalt jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_user_id, woche)
);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'etsy_shop_einstellungen',
    'etsy_kosten_vorlage',
    'etsy_produkt_kosten',
    'etsy_bestellung',
    'etsy_versand_vorlage',
    'etsy_rohholz',
    'etsy_ab_test',
    'etsy_review_notiz',
    'etsy_saison_kampagne',
    'etsy_content_idee',
    'etsy_kaeufer',
    'etsy_crm_aufgabe',
    'etsy_gravur_anfrage',
    'etsy_nachricht_notiz',
    'etsy_ceo_briefing'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, PUBLIC', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (owner_user_id = auth.uid()) WITH CHECK (owner_user_id = auth.uid())',
      t || '_owner',
      t
    );
  END LOOP;
END $$;
