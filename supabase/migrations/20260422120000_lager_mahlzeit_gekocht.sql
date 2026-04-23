-- Gekochte Mahlzeiten: gruppiert Verbrauch, schätzt Zutatenkosten aus Ø-Einkauf (lager_einkauf).

CREATE TABLE IF NOT EXISTS public.lager_mahlzeit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titel text NOT NULL,
  gekocht_am timestamptz NOT NULL DEFAULT now(),
  quelle text NOT NULL DEFAULT 'manuell',
  kosten_geschaetzt_eur numeric NOT NULL DEFAULT 0 CHECK (kosten_geschaetzt_eur >= 0)
);

CREATE INDEX IF NOT EXISTS idx_lager_mahlzeit_gekocht_am ON public.lager_mahlzeit (gekocht_am DESC);

COMMENT ON TABLE public.lager_mahlzeit IS 'Gekochte/verzehrte Mahlzeit — gruppiert lager_verbrauch für Kostenrückblick.';

ALTER TABLE public.lager_mahlzeit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lager_mahlzeit_select_anon" ON public.lager_mahlzeit;
CREATE POLICY "lager_mahlzeit_select_anon" ON public.lager_mahlzeit FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "lager_mahlzeit_select_authenticated" ON public.lager_mahlzeit;
CREATE POLICY "lager_mahlzeit_select_authenticated" ON public.lager_mahlzeit FOR SELECT TO authenticated USING (true);

ALTER TABLE public.lager_verbrauch
  ADD COLUMN IF NOT EXISTS mahlzeit_id uuid REFERENCES public.lager_mahlzeit (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_lager_verbrauch_mahlzeit_id ON public.lager_verbrauch (mahlzeit_id);

COMMENT ON COLUMN public.lager_verbrauch.mahlzeit_id IS 'Optional: Zuordnung zu einer gebuchten Mahlzeit (Rezept / manuell).';

-- Atomar: Mahlzeit anlegen, Bestand reduzieren, Verbrauch schreiben, Kosten summieren.
DROP FUNCTION IF EXISTS public.lager_buche_mahlzeit(text, timestamptz, text, jsonb);

CREATE OR REPLACE FUNCTION public.lager_buche_mahlzeit(
  p_titel text,
  p_gekocht_am timestamptz,
  p_quelle text,
  p_zeilen jsonb
)
RETURNS TABLE (mahlzeit_id uuid, kosten_eur numeric)
LANGUAGE plpgsql
AS $$
DECLARE
  v_mid uuid;
  v_total numeric := 0;
  i int := 0;
  el jsonb;
  v_pid uuid;
  v_menge numeric;
  v_notiz text;
  v_bestand numeric;
  v_neu numeric;
  v_basis_sum_m numeric;
  v_basis_sum_p numeric;
  v_avg numeric;
  v_line_cost numeric;
  v_len int;
BEGIN
  IF trim(coalesce(p_titel, '')) = '' THEN
    RAISE EXCEPTION 'TITEL_FEHLT';
  END IF;
  IF p_zeilen IS NULL OR jsonb_typeof(p_zeilen) <> 'array' THEN
    RAISE EXCEPTION 'ZEILEN_UNGUELTIG';
  END IF;
  v_len := coalesce(jsonb_array_length(p_zeilen), 0);
  IF v_len = 0 THEN
    RAISE EXCEPTION 'ZEILEN_LEER';
  END IF;

  INSERT INTO public.lager_mahlzeit (titel, gekocht_am, quelle, kosten_geschaetzt_eur)
  VALUES (
    trim(p_titel),
    coalesce(p_gekocht_am, now()),
    coalesce(nullif(trim(p_quelle), ''), 'manuell'),
    0
  )
  RETURNING id INTO v_mid;

  WHILE i < v_len LOOP
    el := p_zeilen -> i;
    i := i + 1;

    v_pid := (el ->> 'produkt_id')::uuid;
    v_menge := (el ->> 'menge')::numeric;
    v_notiz := nullif(left(trim(coalesce(el ->> 'notiz', '')), 500), '');

    IF v_pid IS NULL OR v_menge IS NULL OR v_menge <= 0 THEN
      RAISE EXCEPTION 'ZEILE_UNGUELTIG';
    END IF;

    SELECT lb.aktuelle_menge INTO v_bestand
    FROM public.lagerbestand lb
    WHERE lb.produkt_id = v_pid
    FOR UPDATE;

    IF NOT FOUND OR v_bestand IS NULL THEN
      RAISE EXCEPTION 'KEIN_LAGERBESTAND';
    END IF;

    IF v_bestand < v_menge THEN
      RAISE EXCEPTION 'ZU_WENIG_BESTAND';
    END IF;

    SELECT coalesce(sum(le.gesamtpreis), 0),
           coalesce(
             sum(
               CASE
                 WHEN coalesce(le.basis_menge, 0) > 0 THEN le.basis_menge
                 ELSE le.menge
               END
             ),
             0
           )
    INTO v_basis_sum_p, v_basis_sum_m
    FROM public.lager_einkauf le
    WHERE le.produkt_id = v_pid;

    IF v_basis_sum_m > 0 THEN
      v_avg := v_basis_sum_p / v_basis_sum_m;
    ELSE
      v_avg := NULL;
    END IF;

    v_line_cost := CASE WHEN v_avg IS NOT NULL THEN round(v_menge * v_avg, 4) ELSE 0 END;
    v_total := v_total + v_line_cost;

    v_neu := round(v_bestand - v_menge, 3);
    IF v_neu < 0 THEN
      RAISE EXCEPTION 'BESTAND_NEGATIV';
    END IF;

    UPDATE public.lagerbestand SET aktuelle_menge = v_neu WHERE produkt_id = v_pid;

    INSERT INTO public.lager_verbrauch (produkt_id, menge, notiz, quelle, mahlzeit_id)
    VALUES (v_pid, v_menge, v_notiz, 'mahlzeit', v_mid);
  END LOOP;

  UPDATE public.lager_mahlzeit
  SET kosten_geschaetzt_eur = round(v_total, 2)
  WHERE id = v_mid;

  RETURN QUERY
  SELECT v_mid, round(v_total, 2);
END;
$$;

COMMENT ON FUNCTION public.lager_buche_mahlzeit(text, timestamptz, text, jsonb) IS
  'Bucht eine Mahlzeit atomar: Bestand ↓, Verbrauch mit mahlzeit_id, Kosten = Summe (Menge × Ø-Einkauf je Produkt).';
